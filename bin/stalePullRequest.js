'use strict';

var Cesium = require('cesium');
var Promise = require('bluebird');
var requestPromise = require('request-promise');

var defined = Cesium.defined;

var dateLog = require('../lib/dateLog');
var checkStatus = require('../lib/checkStatus');
var Settings = require('../lib/Settings');

module.exports = stalePullRequest;

if (require.main === module) {
    Settings.loadRepositoriesSettings('./config.json')
        .then(stalePullRequest)
        .catch(function (err) {
            dateLog('Received error: ' + err);
        });
}
/** Bump stale pull requests for each repository
 *
 * @param {String[]} repositoryNames Names of repositories
 * @returns {Promise<Array<http.IncomingMessage | undefined> | undefined>} Promise to an array of incoming messages
 */
function stalePullRequest(repositoryNames) {
    return Promise.all(
        repositoryNames.map(function (repositoryName) {
            var bumpStalePullRequests = Settings.repositories[repositoryName].bumpStalePullRequests;
            if (!defined(bumpStalePullRequests)) {
                dateLog('Repository ' + repositoryName + ' does not have `bumpStalePullRequests` turned on');
                return Promise.resolve();
            }
            return stalePullRequest.implementation(bumpStalePullRequests.url + '?sort=updated&direction=asc',
                Settings.repositories[repositoryName].gitHubToken, Settings.repositories[repositoryName].maxDaysSinceUpdate);
        })
    );
}

/** Implementation
 *
 * @param {String} pullRequestsUrl Base url to list pull requests https://developer.github.com/v3/pulls/#list-pull-requests
 * @param {String} gitHubToken Token to verify with github
 * @param {Number} maxDaysSinceUpdate Maximum days since a PR has been updated
 * @return {Promise<Array<http.IncomingMessage | undefined>>} Promise to an array of incoming messages
 */
stalePullRequest.implementation = function (pullRequestsUrl, gitHubToken, maxDaysSinceUpdate) {
    var headers = {
        'User-Agent': 'cesium-concierge',
        Authorization: 'token ' + gitHubToken
    };
    return requestPromise.get({
        uri: pullRequestsUrl,
        headers: headers,
        json: true,
        resolveWithFullResponse: true
    })
    .then(function (pullRequestsJsonResponse) {
        return checkStatus(pullRequestsJsonResponse);
    })
    .then(function (pullRequestsJsonResponse) {
        var firstMessage = 'Thank you for this pull request.\n\n' +
            'If it has pending requests for code changes, please address all comments and post a new message when it is ready for review.\n\n' +
            'If you are waiting for review, we\'re sorry for the delay. A Cesium maintainer will be by to comment or review soon.';
        var alreadyBumpedMessage = 'This pull request hasn\'t seen activity in a while. Please close it if it is no longer relevant.\n\n\'' +
            'Otherwise, please address all comments and post a new message when it is ready for review.';
        return Promise.each(pullRequestsJsonResponse.body, function(pullRequest) {
            var lastUpdate = new Date(pullRequest.updated_at);
            var commentsUrl = pullRequest.comments_url;
            maxDaysSinceUpdate = defined(maxDaysSinceUpdate) ? maxDaysSinceUpdate : 30;
            if (stalePullRequest.dateIsOlderThan(lastUpdate, maxDaysSinceUpdate)) {
                // Check if last post was cesium-concierge
                return requestPromise.get({
                    uri: commentsUrl,
                    headers: headers,
                    json: true,
                    resolveWithFullResponse: true
                })
                .then(function (commentsJsonResponse) {
                    return checkStatus(commentsJsonResponse);
                })
                .then(function (commentsJsonResponse) {
                    var alreadyBumped = false;
                    commentsJsonResponse.body.forEach(function (comment) {
                        if (comment.user.login === 'cesium-concierge') {
                            alreadyBumped = true;
                        }
                    });
                    var message = alreadyBumped ? alreadyBumpedMessage : firstMessage;
                    return requestPromise.post({
                        uri: commentsUrl,
                        headers: headers,
                        body: {
                            body: message
                        },
                        json: true,
                        resolveWithFullResponse: true
                    });
                });
            }
        });
    });
};

/** Time in seconds from date and now
 *
 * @param {Date} date Date to compare
 * @param {Number} days Days from Date.now() to compare
 * @return {boolean} True if date is older than `days` ago
 */
stalePullRequest.dateIsOlderThan = function (date, days) {
    return date.getTime() + days * 86400000 <= Date.now();
};
