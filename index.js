'use strict';
var bodyParser = require('body-parser');
var express = require('express');
var gitHubWebHook = require('express-github-webhook');
var rp = require('request-promise');

var headers = {
    'User-Agent': 'forum-reminder',
    'Authorization': 'token ' + process.env.GITHUB_TOKEN
};

var webHookHandler = gitHubWebHook({
    path: '/',
    secret: process.env.SECRET || ''
});

var app = express();
app.set('port', process.env.PORT || 5000);
app.use(bodyParser.json());
app.use(webHookHandler);

function findLinksWithRegex(comments, re) {
    var linkMatches = [];
    for (var i = 0; i < comments.length; i++) {
        var matchResult = comments[i].body.match(re);
        if (matchResult && !linkMatches.includes(matchResult[0])) {
            linkMatches.push(matchResult[0]);
        }
    }
    return linkMatches;
}

function postComment(message, url) {
    return rp.post({
        uri: url,
        headers: headers,
        body: {
            'body': message
        },
        json: true
    });
}

function handleClosedIssue(data) {
    // GET comments from issue
    rp.get({
        uri: data.issue.url + '/comments',
        headers: headers,
        json: true
    })
    .then(function(comments) {
        return findLinksWithRegex(comments, /https:\/\/groups\.google\.com[^\s]*/ig);
    })
    .then(function(linkMatches) {
        if (linkMatches.length === 0) {
            console.log('No google group links found in comments!');
            return;
        }
        console.log(linkMatches);
        var message = 'Please make sure to update ' + linkMatches + ' on this closed issue.\n\n__I am a bot BEEEP BOOOP__';

        return postComment(message, data.issue.url + '/comments');
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
	console.error('An error occurred: ', err);
});

// Listen to port specified by env.PORT
app.listen(app.get('port'), function () {
	console.log('Forum-reminder listening on port ' + app.get('port'));
});
