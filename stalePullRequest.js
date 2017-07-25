'use strict';

var Cesium = require('cesium');
var Promise = require('bluebird');
var requestPromise = require('request-promise');

var defined = Cesium.defined;

var dateLog = require('./lib/dateLog');
var checkStatus = require('./lib/checkStatus');
var Settings = require('./lib/Settings');

module.exports = stalePullRequest;

function stalePullRequest(repositoryNames) {
    return Promise.all(
        repositoryNames.map(function (repositoryName) {
            var bumpStalePullRequests = Settings.repositories[repositoryName].bumpStalePullRequests;
            if (!defined(bumpStalePullRequests)) {
                dateLog('Repository ' + repositoryName + ' does not have `bumpStalePullRequests` turned on');
                return Promise.resolve();
            }
            return stalePullRequest.implementation(bumpStalePullRequests.url + '?sort=updated&direction=asc',
                Settings.repositories[repositoryName].gitHubToken);
        })
    );
}

/** Implementation
 *
 * @param {String} pullRequestsUrl Base url to list pull requests https://developer.github.com/v3/pulls/#list-pull-requests
 * @param {String} gitHubToken Token to verify with github
 * @return {Promise<http.IncomingMessage | undefined>[]} Array of promises to incoming messages
 */
stalePullRequest.implementation = function (pullRequestsUrl, gitHubToken) {
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
    .then(function (pullRequestsjsonResponse) {
        return checkStatus(pullRequestsjsonResponse);
    })
    .then(function (pullRequestsjsonResponse) {
        var firstMessage = 'It looks like this pull request hasn\'t been updated in a while!\n\n' +
            'Please update it soon or close it!';
        var alreadyBumpedMessage = 'Hi again!\n\nThis pull request has not been active in a while. Please consider ' +
            'closing it!';
        return Promise.all(pullRequestsjsonResponse.body.map(function(pullRequest) {
            var lastUpdate = new Date(pullRequest.updated_at);

            if (stalePullRequest.dateIsOlderThan(lastUpdate, 30)) {
                // Check if last post was cesium-concierge
                return requestPromise.get({
                    uri: pullRequest._links.comments.href,
                    headers: headers,
                    json: true,
                    resolveWithFullResponse: true
                })
                .then(function (commentsJsonResponse) {
                    return checkStatus(commentsJsonResponse);
                })
                .then(function (commentsJsonResponse) {
                    var alreadyBumped = false;
                    var message = alreadyBumped ? alreadyBumpedMessage : firstMessage;
                    commentsJsonResponse.body.forEach(function (comment) {
                        if (comment.user.login === 'cesium-concierge') {
                            alreadyBumped = true;
                        }
                    });
                    message = alreadyBumped ? alreadyBumpedMessage : firstMessage;
                    return requestPromise.post({
                        uri: pullRequest.comments_url,
                        headers: headers,
                        body: {
                            body: message
                        },
                        json: true,
                        resolveWithFullResponse: true
                    });
                });
            }
            return Promise.resolve();
        }));
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
