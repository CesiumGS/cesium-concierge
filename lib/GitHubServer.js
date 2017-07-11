'use strict';

var Cesium = require('cesium');
var Promise = require('bluebird');
var rp = require('request-promise');

var defined = Cesium.defined;

module.exports = GitHubServer;

/** Constructor
 *
 * @param {String} userAgent User agent for requests
 * @param {String} authToken Unique GitHub Personal Access Token https://help.github.com/articles/creating-a-personal-access-token-for-the-command-line/
 * @constructor
 */
function GitHubServer(userAgent, authToken) {
    this.headers = {
        'User-Agent': userAgent,
        Authorization: 'token ' + authToken
    };
}

GitHubServer.issue = {};
GitHubServer.pullRequest = {};

/** Search for old pull requests, comment on each to remind user that they are stale
 *
 *  @param {String} repo REST URL repository to search (https://api.github.com/repos/AnalyticalGraphicsInc/cesium/pulls)
 * @return {Promise<http.IncomingMessage>} Response
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
 * @param {String} url GitHub API url
 * @return {Promise<Object>} JSON response
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

/** Return the labels from Issue/PR
 *
 * @param {String} url Generic API URL to issue/pr
 * @return {Promise<Object>} Labels JSON object
 */
GitHubServer.prototype.getLabels = function(url) {
    url += 'labels';
    return rp.get(this.get(url))
    .then(function(responseJson) {
        return responseJson.map(function(label) {
            return label.name;
        });
    });
};

/** Post a single comment to `url`
 *
 * @param {String} url GitHub API url
 * @param {String} message Comment body
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
 * @param {Object} jsonResponse GitHub response object
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
 * @param {Object} jsonResponse GitHub response object
 * @return {String} Url for comments API
 */
GitHubServer.issue.getCommentsUrl = function(jsonResponse) {
    return jsonResponse.issue.comments_url;
};

/** Convert Issue html URL to GitHub API
 *
 * @param {String} url html url
 * @return {String | undefined} API url
 */
GitHubServer.issue.htmlUrlToApi = function(url) {
    if(!defined(url)) {
        return;
    }
};

/** Helper to abstract GitHub API
 *
 * @param {Object} jsonResponse GitHub response object
 * @return {String} Url for comments API
 */
GitHubServer.pullRequest.getCommentsUrl = function(jsonResponse) {
    return jsonResponse.pull_request._links.comments;
};
