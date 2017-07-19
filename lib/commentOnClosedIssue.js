'use strict';
var Cesium = require('cesium');
var Promise = require('bluebird');
var requestPromise = require('request-promise');

var dateLog = require('./dateLog');
var getUniqueMatch = require('./getUniqueMatch');

var Check = Cesium.Check;

module.exports = commentOnClosedIssue;

/** Post a comment on an issue that just closed, reminding the users to update Google Group forum links (if there
 * were any linked in the comments)
 *
 * @param {Object} jsonResponse GitHub Response (https://developer.github.com/v3/activity/events/types/#issuesevent)
 * @param {Object} headers Request headers
 * @return {Promise<http.IncomingMessage | String>} Response
 * @throws {DeveloperError} If `jsonResponse` or `headers` are not defined objects
 */
function commentOnClosedIssue(jsonResponse, headers) {
    Check.typeOf.object('jsonResponse', jsonResponse);
    Check.typeOf.object('headers', headers);

    return commentOnClosedIssue._implementation(jsonResponse.issue.url, jsonResponse.issue.comments_url, headers);
}

/** implementation
 *
 * @param {String} issueUrl issue url
 * @param {String} commentsUrl comment url
 * @param {Object} headers headers
 * @private
 * @returns {Promise<http.IncomingMessage | String>} message response or string with error description
 */
commentOnClosedIssue._implementation = function (issueUrl, commentsUrl, headers) {
    var comments = [];
    var linkMatches = [];

    return commentOnClosedIssue.get(issueUrl, headers)
    .then(function (issueResponse) {
        if (!statusCodeIsOk(issueResponse)) {
            return Promise.reject('Did not receive response code 200 for issue url:', issueUrl);
        }
        comments.push(issueResponse.body.body);
    })
    .then(function () {
        return commentOnClosedIssue.get(commentsUrl, headers);
    })
    .then(function (commentsJsonResponse) {
        if (!statusCodeIsOk(commentsJsonResponse)) {
            return Promise.reject('Did not receive response code 200 for comments url:', commentsUrl);
        }
        commentsJsonResponse.body.forEach(function (commentJson) {
            comments.push(commentJson.body);
        });
        dateLog('Received comments: ' + comments);
        linkMatches = getUniqueMatch(comments, commentOnClosedIssue._googleLinkRegex);
        if (linkMatches.length === 0) {
            return Promise.resolve('No google group links found in comments!');
        }
        dateLog('Found these links in the comments: ' + linkMatches);
        var message = 'Please make sure to update:\n';
        linkMatches.forEach(function(match) {
            message += '- ' + match + '\n';
        });
        message += 'on this closed issue.\n\n__I am a bot__! Have a wonderful day!';
        return requestPromise.post({
            uri: commentsUrl,
            headers: headers,
            body: {
                body: message
            },
            json: true,
            resolveWithFullResponse: true
        });
    });
};

/** Helper for unit testing
 *
 * @param {String} url URL
 * @param {Object} headers Headers
 * @return {Promise<http.IncomingMessage>} response
 */
commentOnClosedIssue.get = function (url, headers) {
    return requestPromise.get({
        uri: url,
        headers: headers,
        json: true,
        resolveWithFullResponse: true
    });
};

/** Helper to check statusCode
 *
 * @param {Object} response JSON response
 * @return {boolean} true if the statusCode is 200
 */
function statusCodeIsOk(response) {
    dateLog('Received from server:' + JSON.stringify(response));
    if (response.statusCode === 200) {
        dateLog('Status code OK 200');
        return true;
    }
    dateLog('Status code ERROR: ' + response.statusCode + ', ' + response.statusMessage);
    return false;
}

commentOnClosedIssue._googleLinkRegex = /https?:\/\/groups\.google\.com[^\s.,:]*/ig;
