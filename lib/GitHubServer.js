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

/** Helper to abstract GitHub API
 *
 * @param {Object} jsonResponse GitHub response object
 * @return {String} Url for comments API
 */
GitHubServer.pullRequest.getCommentsUrl = function(jsonResponse) {
    return jsonResponse.pull_request._links.comments.href;
};
