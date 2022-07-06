'use strict';
const Cesium = require('cesium');
const Promise = require('bluebird');
const requestPromise = require('request-promise');

const Check = Cesium.Check;
const defined = Cesium.defined;
const RuntimeError = Cesium.RuntimeError;

module.exports = commentOnClosedIssue;

/**
 * Post a comment on an issue/pull request that just closed, congratulating them if this is their first contribution.
 *
 * @param {Object} body The GitHub event body.
 * @param {Object} repositorySettings Headers to use for making additional GitHub requests.
 * @returns {Promise} A promise that resolves when the function is complete.
 */
function commentOnClosedIssue(body, repositorySettings) {
    Check.typeOf.object('body', body);
    Check.typeOf.object('repositorySettings', repositorySettings);

    const options = {};

    const pullRequest = body.pull_request;
    const issue = body.issue;
    if (defined(pullRequest)) {
        options.url = pullRequest.url;
        options.isPullRequest = true;
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

    return commentOnClosedIssue._implementation(options);
}

commentOnClosedIssue._implementation = function (options) {
    const issueUrl = options.url;
    const isPullRequest = options.isPullRequest;
    const repositorySettings = options.repositorySettings;

    if (!isPullRequest) {
        return Promise.resolve(false);
    }

    // Check if this PR was merged, since the GitHub API returns "closed" for BOTH merged or closed.
    // This returns an error if the PR was NOT merged.
    return requestPromise.get({
        url: `${issueUrl  }/merge`,
        headers: repositorySettings.headers,
        json: true
    })
        .catch(function(error) {
            // We expect a 404 if a PR was closed and not merged.
            // Otherwise, propagate the error
            if (error.name !== 'StatusCodeError' || error.statusCode !== 404) {
                throw error;
            }
        });
};
