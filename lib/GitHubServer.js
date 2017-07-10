'use strict';

var Cesium = require('cesium');
var Promise = require('bluebird');
var rp = require('request-promise');

var defined = Cesium.defined;

module.exports = GitHubServer;

/**
 *
 * @param {String} userAgent
 * @param {String} authToken
 * @constructor
 */
function GitHubServer(userAgent, authToken) {
    this.headers = {
        'User-Agent': userAgent,
        Authorization: 'token ' + authToken
    };
}

/**
 * Search for old pull requests, comment on each to remind user that they are stale
 * @param {String} repo REST URL repository to search (https://api.github.com/repos/AnalyticalGraphicsInc/cesium/pulls)
 * @return {Promise<String>} Promise to status code of request
 */
GitHubServer.prototype.bumpAllPullRequests = function(repo) {
    if (!defined(repo)) {
        return Promise.reject('`repo` is undefined');
    }

    return this.get(repo + '?state=open&sort=updated&direction=asc')
    .then(function() {
        // TODO
        // loop through PRs
        // if (older than some date)
        //    postComment()
    });
};

/** Send GET request to GitHub issue and return Promise to results
 *
 * @param {String} url
 * @return {Promise<String[]>}
 */
GitHubServer.prototype.get = function(url) {
    if (!defined(url)) {
        return Promise.reject('`url` is undefined');
    }
    return rp.get({
        uri: url,
        headers: this.headers,
        json: true
    });
};

/** Post a single comment to `url`
 *
 * @param {String} url
 * @param {String} message
 * @return {Promise<String>} Status of response
 */
GitHubServer.prototype.postComment = function(url, message) {
    if (!defined(url) || !defined(message)) {
        return Promise.reject('`url` is undefined');
    }
    return rp.post({
        uri: url,
        headers: this.headers,
        body: {
            body: message
        },
        json: true
    });
};

/** Helper to abstract GitHub API
 *
 * @param jsonResponse
 * @return {String[]} Comments
 */
GitHubServer.getCommentsFromResponse = function(jsonResponse) {
    if (!defined(jsonResponse)) {
        return [];
    }
    return jsonResponse.map(function(commentJson) {
        return commentJson.body;
    });
};

/** Helper to abstract GitHub API
 *
 * @param jsonResponse
 * @return {String} Url for comments API
 */
GitHubServer.issue.getCommentsUrl = function(jsonResponse) {
    return jsonResponse.issue.comments_url;
};

/** Helper to abstract GitHub API
 *
 * @param jsonResponse
 * @return {String} Url for comments API
 */
GitHubServer.pull_request.getCommentsUrl = function(jsonResponse) {
    return jsonResponse.pull_request._links.comments;
};
