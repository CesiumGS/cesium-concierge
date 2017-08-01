'use strict';
var Cesium = require('cesium');
var bodyParser = require('body-parser');
var express = require('express');
var Promise = require('bluebird');

var defined = Cesium.defined;

var commentOnClosedIssue = require('./lib/commentOnClosedIssue');
var commentOnOpenedPullRequest = require('./lib/commentOnOpenedPullRequest');
var gitHubWebHook = require('./lib/gitHubWebHook');

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
            var repositorySettings = Settings.repositories[repositoryName];
            var headers = {
                'User-Agent': 'cesium-concierge',
                Authorization: 'token ' + repositorySettings.gitHubToken
            };
            var checkChangesMd = repositorySettings.checkChangesMd;

            if ((event === 'issues' || event === 'pull_request') && jsonResponse.action === 'closed' &&
                repositorySettings.remindForum) {
                promise = promise.then(function () {
                    dateLog('Calling commentOnClosedIssue');
                    return commentOnClosedIssue(jsonResponse, headers);
                });
            } else if (event === 'pull_request' && jsonResponse.action === 'opened' &&
                (defined(repositorySettings.thirdPartyFolders) || checkChangesMd)) {
                promise = promise.then(function () {
                    dateLog('Calling commentOnOpenedPullRequest');
                    return commentOnOpenedPullRequest(jsonResponse, headers, repositorySettings.thirdPartyFolders,
                        checkChangesMd);
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
