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

/**
 * Search for old pull requests, comment on each to remind user that they are stale
 * @param {String} repo REST URL repository to search (https://api.github.com/repos/AnalyticalGraphicsInc/cesium/pulls)
 * @return {Promise | undefined}
 */
GitHubServer.prototype.bumpAllPullRequests = function(repo) {
    if (!defined(repo)) {
        return;
    }

    return this.get(repo + '?state=open&sort=updated&direction=asc')
    .then(function() {
        // loop through PRs
        // if (older than some date)
        //    postComment()
    });
};

/** Find unique GoogleGroup links in body of comments (probably does not belong in this file)
 *
 * @param {String[]} comments The returned comments from GitHub.
 * @return {String[] | undefined} Unique links
 */
GitHubServer.findGoogleGroupLinksWithRegex = function(comments) {
    if (!defined(comments)) {
        return;
    }
    var linkMatches = [];
    for (var i = 0; i < comments.length; i++) {
        regexSearch(comments[i], /https?:\/\/groups\.google\.com[^\s.,:]*/ig, linkMatches);
    }
    return linkMatches;
};

/** Find unique issue links in body of comments (probably does not belong in this file)
 *
 * @param {String[]} comments The returned comments from GitHub.
 * @return {String[] | undefined} Unique links
 */
GitHubServer.findGitHubIssueLinksWithRegex = function(comments) {
    if (!defined(comments)) {
        return;
    }
    var linkMatches = [];
    for (var i = 0; i < comments.length; i++) {
        regexSearch(comments[i], /https:\/\/github\.com[^\s.,:]*/ig, linkMatches);
    }
    return linkMatches;
};

/** Generic regex search over block of text. Requires global regex!
 *
 * @param {String} text
 * @param {Object} regex
 * @param {String[]} matches Already-matched strings. Warning: mutated in this function.
 * @returns undefined
 */
function regexSearch(text, regex, matches) {
    var matchResult;
    while ((matchResult = regex.exec(text)) !== null) {
        if (!matches.includes(matchResult[0])) {
            matches.push(matchResult[0]);
        }
    }
}

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
