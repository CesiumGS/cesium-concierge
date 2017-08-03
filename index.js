'use strict';
var Cesium = require('cesium');
var bodyParser = require('body-parser');
var express = require('express');
var Promise = require('bluebird');

var defined = Cesium.defined;

var checkWebHook = require('./lib/checkWebHook');
var commentOnClosedIssue = require('./lib/commentOnClosedIssue');
var commentOnOpenedPullRequest = require('./lib/commentOnOpenedPullRequest');

var dateLog = require('./lib/dateLog');
var Settings = require('./lib/Settings');

Settings.loadRepositoriesSettings('./config.json')
    .then(function (repositoryNames) {
        dateLog('Loaded settings successfully');

        var app = express();

        app.use(bodyParser.json());
        app.use(checkWebHook);

        app.post(Settings.listenPath, function (req, res, next) {
            var repositoryName = req.body.repository.full_name;
            var event = req.headers['x-github-event'];
            if (!(repositoryName in repositoryNames)) {
                var message = 'Could not find ' + repositoryName + ' in ' + repositoryNames;
                dateLog(message);
                next(new Error(message));
            }

            dateLog('Received event to repository: ' + repositoryName);
            dateLog('event: ' + event);
            dateLog('jsonResponse: ' + res.body);

            var repositorySettings = Settings.repositories[repositoryName];
            var headers = {
                'User-Agent': 'cesium-concierge',
                Authorization: 'token ' + repositorySettings.gitHubToken
            };
            var checkChangesMd = repositorySettings.checkChangesMd;
            var promise = Promise.resolve();
            if ((event === 'issues' || event === 'pull_request') && res.body.action === 'closed' &&
                repositorySettings.remindForum) {
                promise = promise.then(function () {
                    dateLog('Calling commentOnClosedIssue');
                    return commentOnClosedIssue(res.body, headers);
                });
            } else if (event === 'pull_request' && res.body.action === 'opened' &&
                (defined(repositorySettings.thirdPartyFolders) || checkChangesMd)) {
                promise = promise.then(function () {
                    dateLog('Calling commentOnOpenedPullRequest');
                    return commentOnOpenedPullRequest(res.body, headers, repositorySettings.thirdPartyFolders,
                        checkChangesMd);
                });
            }

            promise.then(function (result) {
                res.status(200).send({
                    success: true
                });

                if (!defined(result)) {
                    dateLog('GitHub request did not match any events the server is listening for');
                    return;
                }
                dateLog('GitHub API returned with statusCode: ' + result.statusCode);
                dateLog('and statusMessage: ' + result.statusMessage);
            }).catch(function (e) {
                var message = 'Got an error: ' + e;
                dateLog(message);
                next(new Error('Got an error: ' + e));
            });
        });

        // Handle errors
        app.use(function (err, req, res, next) { // eslint-disable-line no-unused-vars
            dateLog(err);
            res.status(400).send('Error: ' + err);
        });

        // Start server on port specified by env.PORT
        app.listen(Settings.port, function () {
            dateLog('cesium-concierge listening on port ' + Settings.port);
        });
    })
    .catch(function (err) {
        dateLog('Could not parse environment settings: ' + err);
        process.exit(1);
    });
