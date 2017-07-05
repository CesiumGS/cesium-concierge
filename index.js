'use strict';
var express = require('express');
var rp = require('request-promise');
var githubWebHook = require('express-github-webhook');
var bodyParser = require('body-parser');

//var repos = ['https://github.com/omh1280/cesium'];

var accessToken = process.env.GITHUB_TOKEN;
var webhookHandler = githubWebHook({
    path: '/',
    secret: ''
});

var app = express();
app.set('port', process.env.PORT || 5000);
app.use(bodyParser.json());
app.use(webhookHandler);

function findGoogleGroupOccurences(comments) {
    var googleGroupOccurences = [];
    var re = /https:\/\/groups\.google\.com[^\s]*/ig;
    // If keyword found in comment -> Add user to list of users to @mention
    for (var i = 0; i < comments.length; i++) {
        var matches = comments[i].body.match(re);
        if (matches && !googleGroupOccurences.includes(matches[0])) {
            googleGroupOccurences.push(matches[0]);
        }
    }
    console.log(googleGroupOccurences);
    return googleGroupOccurences;
}

function postMessage(googleGroupOccurences, url) {
    // Create message
    // POST comment using Github API
    if (googleGroupOccurences.length === 0) {
        console.log('No google group links found in comments!');
        return;
    }
    var message = 'Please make sure to update ' + googleGroupOccurences + ' on this closed issue.\n\n__I am a bot BEEEP BOOOP__';
    var opts = {
        uri: url,
        headers: {
            'User-Agent': 'forum-reminder',
            'Authorization': 'token ' + accessToken
        },
        body: {
            'body': message
        },
        json: true
    };
    return rp.post(opts).then(function(status) {
        console.log('GitHub API returned with: ' + status);
    });
}

function handleClosedIssue(repo, data) { //eslint-disable-line no-unused-vars
	// Check if issue is closed
    if (data.action !== 'closed') {
        return;
    }
    // GET comments from issue
    rp.get({
        uri: data.issue.url + '/comments',
        headers: {
            'User-Agent': 'forum-reminder',
            'Authorization': 'token ' + accessToken,
            'Content-Type': 'application/json'
        },
        json: true
    })
    .then(findGoogleGroupOccurences)
    .then(function(googleGroupOccurences) {
        return postMessage(googleGroupOccurences, data.issue.url + '/comments');
    })
    .catch(function(e) {
        console.log('Got an ERROR: ' + e);
    });
}

webhookHandler.on('issues', handleClosedIssue);

webhookHandler.on('error', function (err, req, res) { //eslint-disable-line no-unused-vars
	console.error('an error occurred', err);
});

app.listen(app.get('port'), function () {
	console.log('Forum-reminder listening on port ' + app.get('port'));
});
