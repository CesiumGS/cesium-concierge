'use strict';
var Cesium = require('cesium');
var Promise = require('bluebird');
var rp = require('request-promise');

var getUniqueMatch = require('./getUniqueMatch');

var defined = Cesium.defined;

/** Get comments -> regex search -> post comment
 *
 * @param {String} jsonResponse GitHub Response
 * @param {Object} headers Request headers
 * @return {Promise<http.IncomingMessage>} Response
 */
var commentOnClosedIssue = function(jsonResponse, headers) {
    if (!defined(jsonResponse) || !defined(headers)) {
        return Promise.reject('jsonResponse is undefined');
    }
    var commentsUrl = jsonResponse.issue.comments_url;
    var comments = [];
    var linkMatches = [];

    return rp.get({
        uri: commentsUrl,
        headers: headers,
        json: true
    }).then(function(commentsJsonResponse) {
        comments = commentOnClosedIssue._getCommentsFromResponse(commentsJsonResponse);
        linkMatches = getUniqueMatch(comments, commentOnClosedIssue._googleLinkRegex);
        if (linkMatches === []) {
            return Promise.reject('No google group links found in comments!');
        }
        console.log('Found these links in the comments: ', linkMatches);
        return rp.post({
            uri: commentsUrl,
            headers: headers,
            body: {
                body: 'Please make sure to update ' + linkMatches + ' on this closed issue.\n\n__I am a bot BEEEP BOOOP__'
            },
            json: true
        });
    });
};

/** Helper to abstract GitHub API
 *
 * @param {Object} jsonResponse GitHub response object
 * @return {String[]} Comments
 */
commentOnClosedIssue._getCommentsFromResponse = function(jsonResponse) {
    if (!defined(jsonResponse)) {
        return [];
    }
    return jsonResponse.map(function(commentJson) {
        return commentJson.body;
    });
};

commentOnClosedIssue._googleLinkRegex = /https?:\/\/groups\.google\.com[^\s.,:]*/ig;

module.exports = commentOnClosedIssue;
