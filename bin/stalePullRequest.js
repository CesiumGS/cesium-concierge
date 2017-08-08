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
 * @returns {Promise<Array<http.IncomingMessage | undefined> | undefined>} Promise to an array of incoming messages
 */
function stalePullRequest() {
    var repositoryNames = Object.keys(Settings.repositories);
    return Promise.all(
        repositoryNames.map(function (repositoryName) {
            var repositorySettings = Settings.repositories[repositoryName];
            if (!defined(repositorySettings.bumpStalePullRequests)) {
                dateLog('Repository ' + repositoryName + ' does not have `bumpStalePullRequests` turned on');
                return Promise.resolve();
            }
            return stalePullRequest.implementation(repositorySettings.bumpStalePullRequestsUrl + '?sort=updated&direction=asc',
                repositorySettings.gitHubToken, repositorySettings.maxDaysSinceUpdate);
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
    maxDaysSinceUpdate = defined(maxDaysSinceUpdate) ? maxDaysSinceUpdate : 30;
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
        var thankYou = 'Thank you for the pull request!\n\n';
        var firstMessage = thankYou + 'I noticed that this pull request hasn\'t been updated in ' + maxDaysSinceUpdate + ' days. ' +
            'If it is waiting on a review or changes from a previous review, could someone please take a look?\n' +
            'If I don’t see a commit or comment in the next ' + maxDaysSinceUpdate + ' days, we may want to close this pull request to keep things tidy.\n\n' +
            '__I am a bot who helps facilitate your development!__ Thanks again for contributing.';

        var alreadyBumpedMessage = thankYou + 'Looks like this pull request hasn\'t been updated in ' + maxDaysSinceUpdate + ' days since I last commented.\n' +
            'To keep things tidy should this be closed? Perhaps keep the branch and submit an issue?\n\n' +
            '__I am a bot who helps facilitate your development!__ Have a nice day.\n';

        return Promise.each(pullRequestsJsonResponse.body, function(pullRequest) {
            var lastUpdate = new Date(pullRequest.updated_at);
            var commentsUrl = pullRequest.comments_url;
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
                    dateLog('Posting comment to ' + commentsUrl);
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
            dateLog('Pull request at ' + pullRequest.url + ' was not older than ' + maxDaysSinceUpdate + ' days.');
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
