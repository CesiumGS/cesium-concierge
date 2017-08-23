'use strict';
var Cesium = require('cesium');
var handlebars = require('handlebars');
var Promise = require('bluebird');
var requestPromise = require('request-promise');

var getUniqueMatch = require('./getUniqueMatch');
var Settings = require('./Settings');

var Check = Cesium.Check;
var defined = Cesium.defined;
var RuntimeError = Cesium.RuntimeError;

module.exports = commentOnClosedIssue;

/**
 * Post a comment on an issue/pull request that just closed, reminding the users to update Google Group forum links (if there
 * were any linked in the comments)
 *
 * @param {Object} body The GitHub event body.
 * @param {Object} headers Headers to use for making additional GitHub requests.
 * @returns {Promise} A promise that resolves when the function is complete.
 */
function commentOnClosedIssue(body, headers) {
    Check.typeOf.object('body', body);
    Check.typeOf.object('headers', headers);

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

    return commentOnClosedIssue._implementation(url, commentsUrl, headers);
}

commentOnClosedIssue._implementation = function (issueUrl, commentsUrl, headers) {
    var comments = [];
    var issueHtmlUrl;

    return requestPromise.get({
        url: issueUrl,
        headers: headers,
        json: true
    })
        .then(function (issueResponse) {
            issueHtmlUrl = issueResponse.html_url;
            comments.push(issueResponse.body);
        })
        .then(function () {
            return requestPromise.get({
                url: commentsUrl,
                headers: headers,
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
                headers: headers,
                body: {
                    body: commentOnClosedIssue.renderMessage(issueHtmlUrl, forum_links)
                },
                json: true
            });
        });
};

commentOnClosedIssue.renderMessage = function (issueHtmlUrl, forum_links) {
    var template = handlebars.compile(Settings.getIssueClosedTemplate());
    return template({
        html_url: issueHtmlUrl,
        forum_links: forum_links
    });
};

commentOnClosedIssue._googleLinkRegex = /https?:\/\/groups\.google\.com[^\s.,:)\\]*/ig;
