'use strict';
var bodyParser = require('body-parser');
var express = require('express');
var GitHubServer = require('./lib/GitHubServer');
var gitHubWebHook = require('express-github-webhook');

var gitHubServer = new GitHubServer('to-be-named', process.env.GITHUB_TOKEN);

var webHookHandler = gitHubWebHook({
    path: '/',
    secret: process.env.SECRET || ''
});

// Setup
var app = express();
module.exports = app;

app.set('port', process.env.PORT || 5000);
app.use(bodyParser.json());
app.use(webHookHandler);

function handleClosedIssue(data) {
    var commentsUrl = data.issue.url + '/comments';

    // Return big Promise chain
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

// Listen to port specified by env.PORT
app.listen(app.get('port'), function () {
	console.log('Forum-reminder listening on port ' + app.get('port'));
});
