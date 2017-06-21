'use strict';
var express = require('express');
var rp = require('request-promise');
var githubWebHook = require('express-github-webhook');
var bodyParser = require('body-parser');
//var chalk = require('chalk');
//var debug = require('debug')('forum-reminder');

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

function handleClosedIssue(repo, data) {
	// Check if issue is closed
    if (data.action !== 'closed') {
        return;
    }
    // GET comments from issue
    var googleGroupOccurences = [];
    rp.get({
        uri: data.issue.url + '/comments',
        headers: {
            'User-Agent': 'forum-reminder',
            'Authorization': 'token ' + accessToken,
            'Content-Type': 'application/json'
        },
        json: true
    })
    .then(function(comments) {
        var re = /https:\/\/groups\.google\.com[^\s]*/ig;
        // Foreach comment (GET individual comments? Or GET entire array of comments)
        //   If keyword found in comment -> Add user to list of users to @mention
        for (var i = 0; i < comments.length; i++) {
            var matches = comments[i].body.match(re);
            if (matches && !googleGroupOccurences.includes(matches[0])) {
                googleGroupOccurences.push(matches[0]);
            }
        }
        console.log(googleGroupOccurences);
    })
    .then(function() {
        // Create message
        // POST comment using Github API
        if (googleGroupOccurences.length === 0) {
            console.log('No google group links found in comments!');
            return;
        }
        var message = 'Please make sure to update ' + googleGroupOccurences + ' on this closed issue.\n\n__I am a bot BEEEP BOOOP__';
        var opts = {
            uri: data.issue.url + '/comments',
            headers: {
                'User-Agent': 'forum-reminder',
                'Authorization': 'token '+ accessToken
            },
            body: {
                'body': message
            },
            json: true
        };
        return rp.post(opts).then(function(status) {
            console.log('GitHub API returned with: ' + status);
        });
    })
    .catch(function(e) {
        console.log('Got an ERROR: ' + e);
    });
}

webhookHandler.on('issues', handleClosedIssue);

webhookHandler.on('error', function (err, req, res) {
	console.error('an error occurred', err);
});

app.listen(app.get('port'), function () {
	console.log('Forum-reminder listening on port ' + app.get('port'));
});
