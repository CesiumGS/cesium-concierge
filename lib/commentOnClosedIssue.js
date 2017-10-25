'use strict';
var Cesium = require('cesium');
var Promise = require('bluebird');
var requestPromise = require('request-promise');

var getUniqueMatch = require('./getUniqueMatch');

var Check = Cesium.Check;
var defined = Cesium.defined;
var RuntimeError = Cesium.RuntimeError;

module.exports = commentOnClosedIssue;

/**
 * Post a comment on an issue/pull request that just closed, reminding the users to update Google Group forum links (if there
 * were any linked in the comments)
 *
 * @param {Object} body The GitHub event body.
 * @param {Object} repositorySettings Headers to use for making additional GitHub requests.
 * @returns {Promise} A promise that resolves when the function is complete.
 */
function commentOnClosedIssue(body, repositorySettings) {
    Check.typeOf.object('body', body);
    Check.typeOf.object('repositorySettings', repositorySettings);

    var url;
    var commentsUrl;

    var pullRequest = body.pull_request;
    var issue = body.issue;
    if (defined(pullRequest)) {
        url = pullRequest.url;
        commentsUrl = pullRequest.comments_url;
    } else if (defined(issue)) {
        url = issue.url;
        commentsUrl = issue.comments_url;
    } else {
        return Promise.reject(new RuntimeError('Unknown body type'));
    }

    return commentOnClosedIssue._implementation(url, commentsUrl, repositorySettings);
}

commentOnClosedIssue._implementation = function (issueUrl, commentsUrl, repositorySettings) {
    var comments = [];
    var issueHtmlUrl;

    return repositorySettings.fetchSettings()
        .then(function () {
            return requestPromise.get({
                url: issueUrl,
                headers: repositorySettings.headers,
                json: true
            });
        })
        .then(function (issueResponse) {
            issueHtmlUrl = issueResponse.html_url;
            comments.push(issueResponse.body);
        })
        .then(function () {
            return requestPromise.get({
                url: commentsUrl,
                headers: repositorySettings.headers,
                json: true
            });
        })
        .then(function (commentsJsonResponse) {
            commentsJsonResponse.forEach(function (commentJson) {
                comments.push(commentJson.body);
            });

            var forum_links = getUniqueMatch(comments, commentOnClosedIssue._googleLinkRegex);
            if (forum_links.length === 0) {
                return Promise.resolve();
            }

            return requestPromise.post({
                url: commentsUrl,
                headers: repositorySettings.headers,
                body: {
                    body: repositorySettings.issueClosedTemplate({
                        html_url: issueHtmlUrl,
                        forum_links: forum_links
                    })
                },
                json: true
            });
        });
};

commentOnClosedIssue._googleLinkRegex = /https?:\/\/groups\.google\.com\/[^\s.,:)\\]*cesium-dev\/[^\s.,:)\\]+/ig;
