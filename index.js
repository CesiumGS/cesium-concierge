'use strict';
var express = require('express');
var request = require('request');
var githubWebHook = require('express-github-webhook');
var bodyParser = require('body-parser');
var chalk = require('chalk');
var debug = require('debug')('forum-reminder');

var repos = ['https://github.com/omh1280/cesium'];

var labels = {
	pr: process.env.GITHUB_PR_LABELS,
	issue: process.env.GITHUB_ISSUE_LABELS
};

var accessToken = process.env.GITHUB_TOKEN;
var webhookSettings = {
	path: process.env.WEBHOOK_PATH || '/',
	secret: process.env.GITHUB_SECRET || 'thisIsASuperSecretSecret'
};

var webhookHandler = githubWebHook(webhookSettings);

var app = express();
app.set('port', process.env.PORT || 5555);
app.use(bodyParser.json());
app.use(webhookHandler);

webhookHandler.on('pull_request', function (repo, data) {
	if (repos.indexOf(repo) < 0 || data.action !== 'opened' || labels.pr.length === 0) {return;}
	debug('[%s] Incoming webhook. adding labels %s to %s#%s', chalk.yellow('forum-reminder'), JSON.stringify(labels.pr), repo, data.pull_request.number);
	var opts = {
		method:'POST',
		uri: data.pull_request.issue_url + '/labels', // repo/labels?
		headers: {
			'User-Agent': 'forum-reminder',
			'Authorization': 'token '+accessToken,
			'Content-Type': 'application/json'
		},
		form: JSON.stringify(labels.pr)
	};
	request(opts, function(err, results, body){
		if (err) {console.error(err);}
		debug('[%s] API response %s', chalk.magenta('github'), JSON.stringify(body, null, ' '));
	});
});

webhookHandler.on('issues', function (repo, data) {
	if (repos.indexOf(repo) < 0 || data.action !== 'opened' || labels.issue.length === 0) {return;}
	debug('[%s] Incoming webhook. adding labels %s to %s#%s', chalk.yellow('forum-reminder'), JSON.stringify(labels.issue), repo, data.issue.number);
	var opts = {
		method:'POST',
		uri: data.issue.url + '/labels',
		headers: {
			'User-Agent': 'forum-reminder',
			'Authorization': 'token '+accessToken,
			'Content-Type': 'application/json'
		},
		form: JSON.stringify(labels.issue)
	};
	request(opts, function(err, results, body){
		if (err) {console.error(err);}
		debug('[%s] API response %s', chalk.magenta('github'), JSON.stringify(body, null, ' '));
	});
});

webhookHandler.on('error', function (err, req, res) {
	console.error('an error occurred', err);
});

app.listen(app.get('port'), function () {
	console.log('Auto Labeler listening on port ' + app.get('port'));
});
