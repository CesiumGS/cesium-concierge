'use strict';
var bodyParser = require('body-parser');
var express = require('express');
var GitHubServer = require('./lib/GitHubServer');
var gitHubWebHook = require('express-github-webhook');
var nconf = require('nconf');
var Promise = require('bluebird');
var RegexTools = require('./lib/RegexTools');

var app = express();
module.exports = app;

nconf.env('__')
    .file({
        file: 'config.json'
    });

nconf.defaults({
    port: 5000,
    secret: '', // Repository secret to verify incoming WebHook requests from GitHub
    gitHubToken: '', // Token used to verify outgoing requests to GitHub repository
    repository: '', // Repository to scan for outdated pull requests and bump them
    listenPath: '/' // Path on which to listen for incoming requests
});

var webHookHandler = gitHubWebHook({
    path: nconf.get('listenPath'),
    secret: nconf.get('secret')
});

app.use(bodyParser.json());
app.use(webHookHandler);

var gitHubServer = new GitHubServer('cesium-concierge', nconf.get('gitHubToken'));

/** Get comments -> regex search -> post comment
 *
 * @param {String} commentsUrl URL to set/get comments on issue (https://developer.github.com/v3/activity/events/types/#issuesevent)
 * @return {Promise<http.IncomingMessage>} Response
 */
function commentOnClosedIssue(commentsUrl) {
    var comments = [];
    var linkMatches = [];

    return gitHubServer.get(commentsUrl)
    .then(function(commentsJsonResponse) {
        comments = GitHubServer.getCommentsFromResponse(commentsJsonResponse);
        linkMatches = RegexTools.getGoogleGroupLinks(comments);
        if (linkMatches === []) {
            return Promise.reject('No google group links found in comments!');
        }
        console.log('Found these links in the comments: ', linkMatches);
        return gitHubServer.postComment(commentsUrl,
            'Please make sure to update ' + linkMatches + ' on this closed issue.\n\n__I am a bot BEEEP BOOOP__');
    });
}

webHookHandler.on('issues', function(repo, jsonResponse) { // eslint-disable-line no-unused-vars
    var commentsUrl = GitHubServer.issue.getCommentsUrl(jsonResponse);
    switch (jsonResponse.action) {
        case 'closed':
            commentOnClosedIssue(commentsUrl).then(function(status) {
                console.log('GitHub API returned with:', status);
            }).catch(function(e) {
                console.log('commentOnClosedIssue got an error:', e);
            });
            break;
        default:
    }
});

webHookHandler.on('error', function (err, req, res) { // eslint-disable-line no-unused-vars
	console.log('WebHookHandler got error:', err);
});

// Start server on port specified by env.PORT
app.listen(nconf.get('port'), function () {
	console.log('cesium-concierge listening on port', nconf.get('port'));
});
