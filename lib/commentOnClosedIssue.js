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
 * were any linked in the comments) or congratulating them if this is their first contribution.
 *
 * @param {Object} body The GitHub event body.
 * @param {Object} repositorySettings Headers to use for making additional GitHub requests.
 * @param {String} outreachUsers Username(s) to mention when someone makes their first contribution..
 * @returns {Promise} A promise that resolves when the function is complete.
 */
function commentOnClosedIssue(body, repositorySettings, outreachUsers) {
    Check.typeOf.object('body', body);
    Check.typeOf.object('repositorySettings', repositorySettings);

    var options = {};

    var pullRequest = body.pull_request;
    var issue = body.issue;
    if (defined(pullRequest)) {
        options.url = pullRequest.url;
        options.isPullRequest = true;
        options.baseBranch = pullRequest.base.ref;
        options.baseApiUrl = pullRequest.base.repo.url;
        options.commentsUrl = pullRequest.comments_url;
        options.userName = pullRequest.user.login;
    } else if (defined(issue)) {
        options.url = issue.url;
        options.isPullRequest = false;
        options.commentsUrl = issue.comments_url;
    } else {
        return Promise.reject(new RuntimeError('Unknown body type'));
    }

    options.repositorySettings = repositorySettings;
    options.outreachUsers = outreachUsers;

    return commentOnClosedIssue._implementation(options);
}

commentOnClosedIssue._implementation = function (options) {
    var issueUrl = options.url;
    var commentsUrl = options.commentsUrl;
    var isPullRequest = options.isPullRequest;
    var baseBranch = options.baseBranch;
    var baseApiUrl = options.baseApiUrl;
    var userName = options.userName;
    var repositorySettings = options.repositorySettings;

    var comments = [];
    var issueHtmlUrl;
    var isFirstContribution;
    var outreachUsers = options.outreachUsers;

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
            if (!isPullRequest) {
                return Promise.resolve(false);
            }
            return commentOnClosedIssue._isFirstContribution(userName, repositorySettings, baseBranch, baseApiUrl);
        })
        .then(function (result) {
            isFirstContribution = result;
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
            var foundForumLinks = forum_links.length !== 0;

            // If there's no one to @mention, don't post the first contribution message.
            if (!defined(outreachUsers)) {
                isFirstContribution = false;
            }

            if (!foundForumLinks && !isFirstContribution) {
                return Promise.resolve();
            }

            return requestPromise.post({
                url: commentsUrl,
                headers: repositorySettings.headers,
                body: {
                    body: repositorySettings.issueClosedTemplate({
                        html_url: issueHtmlUrl,
                        forum_links: forum_links,
                        isFirstContribution: isFirstContribution,
                        foundForumLinks: foundForumLinks,
                        userName: userName,
                        outreachUsers: outreachUsers
                    })
                },
                json: true
            });
        });
};

commentOnClosedIssue._isFirstContribution = function (userName, repositorySettings, baseBranch, baseApiUrl) {
    // This is a user's first contribution if the repo/branch they're merging _into_ does not have their name in the contributors.
    if (!defined(repositorySettings.contributorsPath)) {
        return Promise.resolve(false);
    }

    var url = baseApiUrl + '/contents/' + repositorySettings.contributorsPath + '?ref=' + baseBranch;

    return requestPromise.get({
        url: url,
        headers: repositorySettings.headers,
        json: true
    })
    .then(function (response) {
        var contributorsFileContent = Buffer.from(response.content, 'base64').toString();
        return contributorsFileContent.indexOf(userName) === -1;
    });
};


commentOnClosedIssue._googleLinkRegex = /https?:\/\/groups\.google\.com\/[^\s.,:)\\]*cesium-dev\/[^\s.,:)\\]+/ig;
