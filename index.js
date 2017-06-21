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
    secret: 'secret'
});

var app = express();
app.set('port', process.env.PORT || 5000);
app.use(bodyParser.json());
app.use(webhookHandler);

/**
 *
 * @param repo
 * @param data
 * @returns Promise
 */
function handleClosedIssue(repo, data) {
	// Check if issue is closed
    //if (data.action !== 'opened') {return;}
    // GET comments from issue
    rp.get({
        uri: data.issue.url + '/comments',
        headers: {
            'User-Agent': 'forum-reminder',
            'Authorization': 'token ' + accessToken,
            'Content-Type': 'application/json'
        }
    })
    .then(function(comments) {
        console.log(comments[0].body);
    });
    // // Foreach comment (GET individual comments? Or GET entire array of comments)
    // //   If keyword found in comment -> Add user to list of users to @mention
    // // Create message
    // // POST comment using Github API
    // var opts = {
    //     method:'POST',
    //     uri: data.issue.url + '/labels',
    //     headers: {
    //         'User-Agent': 'forum-reminder',
    //         'Authorization': 'token '+accessToken,
    //         'Content-Type': 'application/json'
    //     },
    //     form: ""
    // };
    // request(opts, function(err, results, body){ // request-promise?
    //     if (err) {console.error(err);}
    //     debug('[%s] API response %s', chalk.magenta('github'), JSON.stringify(body, null, ' '));
    // });
}

webhookHandler.on('issues', handleClosedIssue);

webhookHandler.on('error', function (err, req, res) {
	console.error('an error occurred', err);
});

app.listen(app.get('port'), function () {
	console.log('Forum reminder listening on port ' + app.get('port'));
});
