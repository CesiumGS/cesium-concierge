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
        console.log(new Date(Date.now()).toISOString() + ' Listening to', repositoryName);
        webHookHandler.on(repositoryName, function (event, jsonResponse) {
            console.log(new Date(Date.now()).toISOString() + ' Received event to repository:', repositoryName);
            console.log(new Date(Date.now()).toISOString() + ' event:', event);
            console.log(new Date(Date.now()).toISOString() + ' jsonResponse:', jsonResponse);
            //var repository = Settings.repositories[repositoryName];
            if (event === 'issues' &&
                jsonResponse.action === 'closed') {
                commentOnClosedIssue(jsonResponse, {
                    'User-Agent': 'cesium-concierge',
                    Authorization: 'token ' + Settings.repositories[repositoryName].gitHubToken
                }).then(function (status) {
                    console.log(new Date(Date.now()).toISOString() + ' GitHub API returned with:', status);
                }).catch(function (e) {
                    console.log(new Date(Date.now()).toISOString() + ' commentOnClosedIssue got an error:', e);
                });
            }
        });
    });

    webHookHandler.on('error', function (err, req, res) { // eslint-disable-line no-unused-vars
        console.log(new Date(Date.now()).toISOString() + ' WebHookHandler got error:', err);
    });

    // Start server on port specified by env.PORT
    app.listen(Settings.port, function () {
        console.log(new Date(Date.now()).toISOString() + ' cesium-concierge listening on port', Settings.port);
    });
})
.catch(function (err) {
    console.log('Could not parse environment settings:', err);
    process.exit(1);
});
