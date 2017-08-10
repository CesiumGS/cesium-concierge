'use strict';
var Cesium = require('cesium');
var handlebars = require('handlebars');
var Promise = require('bluebird');
var requestPromise = require('request-promise');
var dateLog = require('./dateLog');

var checkStatus = require('./checkStatus');
var getUniqueMatch = require('./getUniqueMatch');

var Check = Cesium.Check;
var defined = Cesium.defined;

module.exports = commentOnClosedIssue;

var messageBeforeLinks = 'Congratulations on closing the issue! I found these {{ project }} forum links in the comments above:\n';
var messageAfterLinks = '\nIf this issue affects any of these threads, please post a comment like the following:\n\n' +
    '> The issue at {{ issueHtmlUrl }} has just been closed and may resolve your issue. Look for the change in the next stable release of {{ project }}!\n' +
    '> Or get it now in the master branch on GitHub {{ projectGitHub }}\n\n{{ signature }}';

/** Post a comment on an issue/pull request that just closed, reminding the users to update Google Group forum links (if there
 * were any linked in the comments)
 *
 * @param {Object} jsonResponse GitHub Response for issue or pull_request (https://developer.github.com/v3/activity/events/types/#issuesevent)
 * @param {Object} headers Request headers
 * @param {Object} templateObject Template object to populate strings
 * @return {Promise<http.IncomingMessage | String>} Response
 * @throws {DeveloperError} If `jsonResponse` or `headers` are not defined objects
 */
function commentOnClosedIssue(jsonResponse, headers, templateObject) {
    Check.typeOf.object('jsonResponse', jsonResponse);
    Check.typeOf.object('headers', headers);
    var body = defined(jsonResponse.pull_request) ? jsonResponse.pull_request : jsonResponse.issue;
    return commentOnClosedIssue._implementation(body.url, body.comments_url, headers, templateObject);
}

/** implementation
 *
 * @param {String} issueUrl issue url
 * @param {String} commentsUrl comment url
 * @param {Object} headers headers
 * @param {Object} templateObject Template object to populate strings
 * @private
 * @returns {Promise<http.IncomingMessage | String>} message response or string with error description
 */
commentOnClosedIssue._implementation = function (issueUrl, commentsUrl, headers, templateObject) {
    var comments = [];
    var linkMatches = [];
    var issueHtmlUrl;

    return commentOnClosedIssue.get(issueUrl, headers)
    .then(checkStatus)
    .then(function (issueResponse) {
        issueHtmlUrl = issueResponse.body.html_url;
        comments.push(issueResponse.body.body);
    })
    .then(function () {
        return commentOnClosedIssue.get(commentsUrl, headers);
    })
    .then(checkStatus)
    .then(function (commentsJsonResponse) {
        commentsJsonResponse.body.forEach(function (commentJson) {
            comments.push(commentJson.body);
        });
        dateLog('Received comments: ' + comments);
        linkMatches = getUniqueMatch(comments, commentOnClosedIssue._googleLinkRegex);
        if (linkMatches.length === 0) {
            return Promise.resolve('No google group links found in comments!');
        }
        dateLog('Found these links in the comments: ' + linkMatches);

        var message = messageBeforeLinks;
        linkMatches.forEach(function(match) {
            message += '- ' + match + '\n';
        });
        message += messageAfterLinks;
        var template = handlebars.compile(message);
        templateObject.issueHtmlUrl = issueHtmlUrl;
        var finalMessage = template(templateObject);

        return requestPromise.post({
            uri: commentsUrl,
            headers: headers,
            body: {
                body: finalMessage
            },
            json: true,
            resolveWithFullResponse: true
        });
    });
};

/** Helper getter
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

commentOnClosedIssue._googleLinkRegex = /https?:\/\/groups\.google\.com[^\s.,:)\\]*/ig;
