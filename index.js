'use strict';
var Cesium = require('cesium');
var bodyParser = require('body-parser');
var express = require('express');
var gitHubWebHook = require('express-github-webhook');
var Promise = require('bluebird');

var defined = Cesium.defined;

var commentOnClosedIssue = require('./lib/commentOnClosedIssue');
var dateLog = require('./lib/dateLog');
var Settings = require('./lib/Settings');

Settings.loadRepositoriesSettings('./config.json')
.then(function (repositoryNames) {
    dateLog('Loaded settings successfully');
    var webHookHandler = gitHubWebHook({
        path: Settings.listenPath,
        secret: Settings.secret
    });

    var app = express();
    app.use(bodyParser.json());
    app.use(webHookHandler);

    repositoryNames.forEach(function (repositoryName) {
        dateLog('Listening to ' + repositoryName);
        webHookHandler.on(repositoryName, function (event, jsonResponse) {
            dateLog('Received event to repository: ' + repositoryName);
            dateLog('event: ' + event);
            dateLog('jsonResponse: ' + jsonResponse);

            var promise = Promise.resolve();
            if ((event === 'issues' || event === 'pull_request') && jsonResponse.action === 'closed') {
                promise = promise.then(function () {
                    return commentOnClosedIssue(jsonResponse, {
                        'User-Agent': 'cesium-concierge',
                        Authorization: 'token ' + Settings.repositories[repositoryName].gitHubToken
                    });
                });
            }
            promise.then(function (res) {
                if (!defined(res)) {
                    dateLog('GitHub request did not match any events the server is listening for');
                    return;
                }
                dateLog('GitHub API returned with statusCode: ' + res.statusCode);
                dateLog('and statusMessage: ' + res.statusMessage);
            }).catch(function (e) {
                dateLog('Got an error: ' + e);
            });
        });
    });

    webHookHandler.on('error', function (err, req, res) { // eslint-disable-line no-unused-vars
        dateLog('WebHookHandler got error: ' + err);
    });

    // Start server on port specified by env.PORT
    app.listen(Settings.port, function () {
        dateLog('cesium-concierge listening on port ' +  Settings.port);
    });
})
.catch(function (err) {
    dateLog('Could not parse environment settings: ' + err);
    process.exit(1);
});
