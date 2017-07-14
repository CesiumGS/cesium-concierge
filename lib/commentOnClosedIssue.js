'use strict';
var Cesium = require('cesium');
var Promise = require('bluebird');
var requestPromise = require('request-promise');

var getUniqueMatch = require('./getUniqueMatch');

var Check = Cesium.Check;

module.exports = commentOnClosedIssue;

/** Post a comment on an issue that just closed, reminding the users to update Google Group forum links (if there
 * were any linked in the comments)
 *
 * @param {Object} jsonResponse GitHub Response (https://developer.github.com/v3/activity/events/types/#issuesevent)
 * @param {Object} headers Request headers
 * @return {Promise<http.IncomingMessage>} Response
 */
function commentOnClosedIssue(jsonResponse, headers) {
    Check.typeOf.object('jsonResponse', jsonResponse);
    Check.typeOf.object('headers', headers);

    return commentOnClosedIssue._implementation(jsonResponse.issue.comments_url, headers);
}

commentOnClosedIssue._implementation = function (commentsUrl, headers) {
    var comments = [];
    var linkMatches = [];

    return requestPromise.get({
        uri: commentsUrl,
        headers: headers,
        json: true
    })
    .then(function (commentsJsonResponse) {
        comments = commentsJsonResponse.map(function (commentJson) {
            return commentJson.body;
        });
        linkMatches = getUniqueMatch(comments, commentOnClosedIssue._googleLinkRegex);
        if (linkMatches.length === 0) {
            return Promise.resolve('No google group links found in comments!');
        }
        console.log('Found these links in the comments: ', linkMatches);
        return requestPromise.post({
            uri: commentsUrl,
            headers: headers,
            body: {
                body: 'Please make sure to update ' + linkMatches + ' on this closed issue.\n\n__I am a bot BEEEP BOOOP__'
            },
            json: true
        });
    });
};

commentOnClosedIssue._googleLinkRegex = /https?:\/\/groups\.google\.com[^\s.,:]*/ig;
