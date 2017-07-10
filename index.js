'use strict';
var bodyParser = require('body-parser');
var express = require('express');
var GitHubServer = require('./lib/GitHubServer');
var gitHubWebHook = require('express-github-webhook');
var nconf = require('nconf');
var Promise = require('bluebird');
var RegexTools = require('./lib/RegexTools');

// Setup
var app = express();
module.exports = app;

// CLI/Env Arguments
nconf.env('__')
    .file({
        file: 'config.json'
    });

nconf.defaults({
    port: 5000,
    secret: '', // Repository secret to verify incoming WebHook requests from GitHub
    githubToken: '', // Token used to verify outgoing requests to GitHub repository
    repository: '', // Repository to scan for outdated pull requests and bump them
    listenPath: '/' // Path on which to listen for incoming requests
});

var webHookHandler = gitHubWebHook({
    path: nconf.get('path'),
    secret: nconf.get('secret')
});

app.use(bodyParser.json());
app.use(webHookHandler);

var gitHubServer = new GitHubServer('cesium-concierge', nconf.get('github_token'));

/** Get comments -> regex search -> post comment
 *
 * @param {String} commentsUrl URL to set/get comments on issue (https://developer.github.com/v3/activity/events/types/#issuesevent)
 */
function commentOnClosedIssue(commentsUrl) {
    return gitHubServer.get(commentsUrl)
    .then(function(commentsJsonResponse) {
        var comments = GitHubServer.getCommentsFromResponse(commentsJsonResponse);
        var linkMatches = RegexTools.getGoogleGroupLinks(comments);
        if (linkMatches === []) {
            return Promise.reject('No google group links found in comments!');
        }
        console.log('Found these links in the comments: ', linkMatches);
        return gitHubServer.postComment(commentsUrl,
            'Please make sure to update ' + linkMatches + ' on this closed issue.\n\n__I am a bot BEEEP BOOOP__');
    })
    .then(function(status) {
        console.log('GitHub API returned with:', status);
    });
}

/** Get PR title + body -> parse for keywords -> post labels + comment
 *
 * @param {String} commentsUrl
 */
function labelOpenedIssue(commentsUrl) {
    return gitHubServer.get(commentsUrl)
    .then(function(commentsJsonResponse) {
        // https://developer.github.com/v3/activity/events/types/#webhook-payload-example-23
        var comments = GitHubServer.getCommentsFromResponse(commentsJsonResponse);
        var linkMatches = RegexTools.getGitHubIssueLinks(comments);
        if (linkMatches === []) {
            return Promise.reject('No GitHub issue links found in comments!');
        }
        console.log('Found these links in the comments: ', linkMatches);

        var potentialLabels = [];
        linkMatches.forEach(function(link) { // eslint-disable-line no-unused-vars
            // /repos/:owner/:repo/issues/:number/labels
            potentialLabels.push();
        });
        return Promise.all(potentialLabels);
        // TODO
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

webHookHandler.on('issues', function(repo, jsonResponse) { // eslint-disable-line no-unused-vars
    var commentsUrl = GitHubServer.issue.getCommentsUrl(jsonResponse);
    switch (jsonResponse.action) {
        case 'opened':
            labelOpenedIssue(jsonResponse, commentsUrl).catch(function (e) {
                console.log('labelOpenedIssue got an error:', e);
            });
            break;
        case 'closed':
            commentOnClosedIssue(commentsUrl).catch(function(e) {
                console.log('commentOnClosedIssue got an error:', e);
            });
            break;
        default:
    }
});

webHookHandler.on('pull_request', function (repo, responseData) { // eslint-disable-line no-unused-vars
    if (responseData.action === 'opened') {
        // Pull requests are issues
        labelOpenedIssue(GitHubServer.pull_request.getCommentsUrl(responseData))
        .catch(function (e) {
            console.log('labelOpenedIssue got an error:', e);
        });
    }
});

webHookHandler.on('error', function (err, req, res) { // eslint-disable-line no-unused-vars
	console.log('WebHookHandler got error:', err);
});

// Listen for cron job and spool a PR bumper
app.get('/cron', function(req, res) { // eslint-disable-line no-unused-vars
    // TODO - check for secret
    gitHubServer.bumpAllPullRequests(nconf.get('repo'));
});

// Start server on port specified by env.PORT
app.listen(nconf.get('port'), function () {
	console.log('cesium-concierge listening on port', nconf.get('port'));
});
