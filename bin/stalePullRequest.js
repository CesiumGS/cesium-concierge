'use strict';

var Cesium = require('cesium');
var handlebars = require('handlebars');
var Promise = require('bluebird');
var requestPromise = require('request-promise');

var defined = Cesium.defined;

var Settings = require('../lib/Settings');

module.exports = stalePullRequest;

if (require.main === module) {
    Settings.loadRepositoriesSettings('./config.json')
        .then(stalePullRequest)
        .catch(function (err) {
            console.log(err);
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
        url: pullRequestsUrl,
        headers: headers,
        json: true,
        resolveWithFullResponse: true
    })
        .then(function (pullRequestsJsonResponse) {
            return Promise.each(pullRequestsJsonResponse.body, function (pullRequest) {
                var commentsUrl = pullRequest.comments_url;
                // Check if last post was cesium-concierge
                return requestPromise.get({
                    url: commentsUrl,
                    headers: headers,
                    json: true,
                    resolveWithFullResponse: true
                })
                    .then(function (commentsJsonResponse) {
                        var latestCommentCreatedAt = commentsJsonResponse.body[commentsJsonResponse.body.length - 1].created_at;
                        if (stalePullRequest.dateIsOlderThan(new Date(latestCommentCreatedAt), maxDaysSinceUpdate)) {
                            var alreadyBumped = false;
                            commentsJsonResponse.body.forEach(function (comment) {
                                if (comment.user.login === 'cesium-concierge') {
                                    alreadyBumped = true;
                                }
                            });
                            var message = alreadyBumped ? Settings.getSecondaryStalePullRequestTemplate() : Settings.getInitialStalePullRequestTemplate();

                            var template = handlebars.compile(message);
                            message = template({
                                maxDaysSinceUpdate: maxDaysSinceUpdate
                            });

                            return requestPromise.post({
                                url: commentsUrl,
                                headers: headers,
                                body: {
                                    body: message
                                },
                                json: true
                            });
                        }
                    });
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
