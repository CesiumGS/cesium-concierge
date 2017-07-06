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

var gitHubServer = new GitHubServer('to-be-named', nconf.get('github_token'));

/** Get Issue title + body -> parse for keywords -> post labels + comment
 *
 * @param {Object} data Generic JSON object passed from the GitHub REST API (https://developer.github.com/v3/activity/events/types/)
 */
function labelOpenedIssue(data) {
    var issueUrl = data.issue.url;

    return gitHubServer.get(issueUrl)
    .then(function() {
        // TODO
    });
}

/** Get comments -> regex search -> post comment
 *
 * @param {Object} data Generic JSON object passed from the GitHub REST API (https://developer.github.com/v3/activity/events/types/#issuesevent)
 */
function commentOnClosedIssue(data) {
    var commentsUrl = data.issue.url + '/comments';

    return gitHubServer.get(commentsUrl)
    .then(function(jsonResponse) {
        var linkMatches = GitHubServer.findLinksWithRegex(jsonResponse.body);
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

/** Get PR title + body -> parse for keywords -> post labels + comment
 *
 * @param {Object} data Generic JSON object passed from the GitHub REST API (https://developer.github.com/v3/activity/events/types/)
 */
function labelOpenedPullRequest(data) {
    var pullRequestUrl = data.pull_request.url;

    return gitHubServer.get(pullRequestUrl)
    .then(function(jsonResponse) { // eslint-disable-line no-unused-vars
        // https://developer.github.com/v3/activity/events/types/#webhook-payload-example-23
        // url + '/comments' -> commentsUrl
        // gitHubServer.get(commentsUrl) -> regex for linked issues -> issuesUrls[]
        // for issuesUrl[]:
        //   get labels +-> availableLabels
        // if availableLabels:
        //   choose 2 most common -> ret[]
        // else:
        //   jsonResponse.data.pull_request.head.repo.labels_url -> labelsUrl
        //   gitHubServer.getLabels(labelsUrl) -> availableLabels[]
        //   LabelPicker.chooseLabels(availableLabels) -> ret[]
        // gitHubServer.postLabels(url, ret[])
    });
}

// Listen to `Issues` Event
webHookHandler.on('issues', function(repo, data) { //eslint-disable-line no-unused-vars
    if (data.action === 'opened') {
        labelOpenedIssue(data);
    } else if (data.action === 'closed') {
        commentOnClosedIssue(data);
    }
});

// Listen to `PullRequests` Event
webHookHandler.on('pull_request', function (repo, data) { // eslint-disable-line no-unused-vars
    if (data.action !== 'opened') {
        return;
    }
    labelOpenedPullRequest(data);
});

webHookHandler.on('error', function (err, req, res) { //eslint-disable-line no-unused-vars
	console.log('An error occurred: ', err);
});

// Start server on port specified by env.PORT
app.listen(app.get('port'), function () {
	console.log('~to-be-named~ listening on port ' + app.get('port'));
});
