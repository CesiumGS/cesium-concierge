'use strict';

var Cesium = require('cesium');
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

/** Find unique links in body of comments
 *
 * @param {String[]} comments The returned comments from GitHub.
 * @return {String[] | undefined} Unique links
 */
GitHubServer.findLinksWithRegex = function(comments) {
    if (!defined(comments)) {
        return;
    }
    var linkMatches = [];
    for (var i = 0; i < comments.length; i++) {
        var matchResult = comments[i].match(/https?:\/\/groups\.google\.com[^\s]*/ig);
        if (matchResult && !linkMatches.includes(matchResult[0])) {
            linkMatches.push(matchResult[0]);
        }
    }
    return linkMatches;
};

/** Send GET request to GitHub issue and return Promise to results
 *
 * @param {String} url
 * @return {Promise<String[]> | undefined}
 */
GitHubServer.prototype.get = function(url) {
    if (!defined(url)) {
        return;
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
 * @return {Promise<String> | undefined} Status of response
 */
GitHubServer.prototype.postComment = function(url, message) {
    if (!defined(url) || !defined(message)) {
        return;
    }
    return rp.post({
        uri: url,
        headers: this.headers,
        body: {
            'body': message
        },
        json: true
    });
};
