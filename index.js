'use strict';
var bodyParser = require('body-parser');
var express = require('express');
var gitHubWebHook = require('express-github-webhook');
var nconf = require('nconf');

var commentOnClosedIssue = require('./lib/commentOnClosedIssue');

var app = express();
module.exports = app;

nconf.env('__')
    .file({
        file: 'config.json'
    });

nconf.defaults({
    port: 5000,
    secret: '', // Repository secret to verify incoming WebHook requests from GitHub
    gitHubToken: '', // Token used to verify outgoing requests to GitHub repository
    listenPath: '/' // Path on which to listen for incoming requests
});

var webHookHandler = gitHubWebHook({
    path: nconf.get('listenPath'),
    secret: nconf.get('secret')
});

app.use(bodyParser.json());
app.use(webHookHandler);

webHookHandler.on('issues', function (repo, jsonResponse) { // eslint-disable-line no-unused-vars
    switch (jsonResponse.action) {
        case 'closed':
            commentOnClosedIssue(jsonResponse, {
                'User-Agent': 'cesium-concierge',
                Authorization: 'token ' + nconf.get('gitHubToken')
            }).then(function (status) {
                console.log('GitHub API returned with:', status);
            }).catch(function (e) {
                console.log('commentOnClosedIssue got an error:', e);
            });
            break;
        default:
    }
});

webHookHandler.on('error', function (err, req, res) { // eslint-disable-line no-unused-vars
    console.log('WebHookHandler got error:', err);
});

// Start server on port specified by env.PORT
app.listen(nconf.get('port'), function () {
    console.log('cesium-concierge listening on port', nconf.get('port'));
});
