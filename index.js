'use strict';
var bodyParser = require('body-parser');
var express = require('express');
var GitHubServer = require('./lib/GitHubServer');
var gitHubWebHook = require('express-github-webhook');
var nconf = require('nconf');

// Setup
var app = express();
module.exports = app;

nconf.argv({
    'port': {
        describe: 'Port on which to listen for GitHub WebHooks',
        type: 'number'
    },
    'secret': {
        alias: 's',
        describe: 'Repository secret to verify incoming WebHook requests from GitHub',
        type: 'string'
    },
    'github_token': {
        alias: 'gt',
        describe: 'Token used to verify outgoing requests to GitHub repository',
        type: 'string'
    }
}).env();

var webHookHandler = gitHubWebHook({
    path: '/',
    secret: nconf.get('secret') || ''
});

app.set('port', nconf.get('port') || 5000);
app.use(bodyParser.json());
app.use(webHookHandler);

/** Get comments -> regex search -> post comment
 *
 * @param {Object} data Generic JSON object passed from the GitHub REST API (https://developer.github.com/v3/activity/events/types/#issuesevent)
 */
function handleClosedIssue(data) {
    var gitHubServer = new GitHubServer('to-be-named', nconf.get('github_token'));
    var commentsUrl = data.issue.url + '/comments';

    return gitHubServer.getComments(commentsUrl)
    .then(function(comments) {
        var linkMatches = GitHubServer.findLinksWithRegex(comments);
        if (linkMatches.length === 0) {
            console.log('No google group links found in comments!');
            return;
        }
        console.log('Found these links in the comments: ', linkMatches);
        var message = 'Please make sure to update ' + linkMatches + ' on this closed issue.\n\n__I am a bot BEEEP BOOOP__';
        return gitHubServer.postComment(commentsUrl, message);
    })
    .then(function(status) {
        console.log('GitHub API returned with: ' + status);
    })
    .catch(function(e) {
        console.log('Got an ERROR: ' + e);
    });
}

// Listen to `issues` WebHook
webHookHandler.on('issues', function(repo, data) { //eslint-disable-line no-unused-vars
    if (data.action !== 'closed') {
        return;
    }
    handleClosedIssue(data);
});

webHookHandler.on('error', function (err, req, res) { //eslint-disable-line no-unused-vars
	console.log('An error occurred: ', err);
});

// Start server on port specified by env.PORT
app.listen(app.get('port'), function () {
	console.log('Forum-reminder listening on port ' + app.get('port'));
});
