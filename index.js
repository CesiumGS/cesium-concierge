'use strict';
var bodyParser = require('body-parser');
var express = require('express');
var gitHubWebHook = require('express-github-webhook');

var commentOnClosedIssue = require('./lib/commentOnClosedIssue');
var Settings = require('./lib/Settings');

Settings.loadRepositoriesSettings('./config.json')
.then(function (repositoryNames) {
    var webHookHandler = gitHubWebHook({
        path: Settings.listenPath,
        secret: Settings.secret
    });

    var app = express();
    app.use(bodyParser.json());
    app.use(webHookHandler);

    repositoryNames.forEach(function (repositoryName) {
        webHookHandler.on(repositoryName, function (event, jsonResponse) {
            if (Settings.get(repositoryName, 'remindForum') && event === 'issues' && jsonResponse.data === 'closed') {
                commentOnClosedIssue(jsonResponse, {
                    'User-Agent': 'cesium-concierge',
                    Authorization: 'token ' + Settings.get(repositoryName, 'gitHubToken')
                }).then(function (status) {
                    console.log('GitHub API returned with:', status);
                }).catch(function (e) {
                    console.log('commentOnClosedIssue got an error:', e);
                });
            }
        });
    });

    webHookHandler.on('error', function (err, req, res) { // eslint-disable-line no-unused-vars
        console.log('WebHookHandler got error:', err);
    });

    // Start server on port specified by env.PORT
    app.listen(Settings.port, function () {
        console.log('cesium-concierge listening on port', Settings.port);
    });
})
.catch(function (err) {
    console.log('Could not parse `repository`.json:', err);
    process.exit(1);
});
