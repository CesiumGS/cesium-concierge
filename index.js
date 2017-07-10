'use strict';
var bodyParser = require('body-parser');
var express = require('express');
var GitHubServer = require('./lib/GitHubServer');
var gitHubWebHook = require('express-github-webhook');
var nconf = require('nconf');
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

app.set('port', nconf.get('port'));
app.use(bodyParser.json());
app.use(webHookHandler);

var gitHubServer = new GitHubServer('cesium-concierge', nconf.get('github_token'));

/** Get comments -> regex search -> post comment
 *
 * @param {Object} data Generic JSON object passed from the GitHub REST API (https://developer.github.com/v3/activity/events/types/#issuesevent)
 */
function commentOnClosedIssue(data) {
    var commentsUrl = data.issue.comments_url;

    return gitHubServer.get(commentsUrl)
    .then(function(commentsJsonResponse) {
        var linkMatches = RegexTools.findGoogleGroupLinksWithRegex(commentsJsonResponse.body);
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
function labelOpenedIssue(data, commentsUrl) { // eslint-disable-line no-unused-vars
    return gitHubServer.get(commentsUrl)
    .then(function(commentsJsonResponse) {
        // https://developer.github.com/v3/activity/events/types/#webhook-payload-example-23
        var linkMatches = RegexTools.findGitHubIssueLinksWithRegex(commentsJsonResponse.body);
        if (linkMatches.length === 0) {
            console.log('No GitHub issue links found in comments!');
            return;
        }
        console.log('Found these links in the comments: ', linkMatches);
        var potentialLablels = [];
        linkMatches.forEach(function(link) {
            potentialLablels.push(
                link // TODO - Incomplete
            );
        });
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

// Listen to `Issues` Event
webHookHandler.on('issues', function(repo, data) { // eslint-disable-line no-unused-vars
    switch (data.action) {
        case 'opened':
            labelOpenedIssue(data, data.pull_request._links.comments);
            break;
        case 'closed':
            commentOnClosedIssue(data);
            break;
        default:
    }
});

// Listen to `PullRequests` Event
webHookHandler.on('pull_request', function (repo, data) { // eslint-disable-line no-unused-vars
    if (data.action === 'opened') {
        // Pull requests are issues
        labelOpenedIssue(data, data.issue.comments_url);
    }
});

webHookHandler.on('error', function (err, req, res) { // eslint-disable-line no-unused-vars
	console.log('WebHookHandler got error: ', err);
});

// Listen for cron job and spool a PR bumper
app.get('/cron', function(req, res) { // eslint-disable-line no-unused-vars
    // TODO - check for secret
    gitHubServer.bumpAllPullRequests(nconf.get('repo'));
});

// Start server on port specified by env.PORT
app.listen(app.get('port'), function () {
	console.log('cesium-concierge listening on port ' + app.get('port'));
});
