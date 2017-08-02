'use strict';
var Cesium = require('cesium');
var bodyParser = require('body-parser');
var express = require('express');
var Promise = require('bluebird');

var defined = Cesium.defined;

var commentOnClosedIssue = require('./lib/commentOnClosedIssue');
var commentOnOpenedPullRequest = require('./lib/commentOnOpenedPullRequest');
var checkWebHook = require('./lib/checkWebHook');

var dateLog = require('./lib/dateLog');
var Settings = require('./lib/Settings');

Settings.loadRepositoriesSettings('./config.json')
.then(function (repositoryNames) {
    dateLog('Loaded settings successfully');

    var app = express();
    app.use(bodyParser.json());
    app.use(Settings.listenPath, function (req, res) {
        var check = checkWebHook(req, Settings.secret);
        if (typeof(check) === Error) {
            dateLog('Throwing ' + check);
            throw check;
        }

        var repositoryName = check.full_name;
        var event = check.event;
        if (!(repositoryName in repositoryNames)) {
            dateLog('Could not find ' + repositoryName + ' in ' + repositoryNames);
            return;
        }

        dateLog('Received event to repository: ' + repositoryName);
        dateLog('event: ' + event);
        dateLog('jsonResponse: ' + res.body);

        var promise = Promise.resolve();
        var repositorySettings = Settings.repositories[repositoryName];
        var headers = {
            'User-Agent': 'cesium-concierge',
            Authorization: 'token ' + repositorySettings.gitHubToken
        };
        var checkChangesMd = repositorySettings.checkChangesMd;

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
            dateLog('Got an error: ' + e);
        });
    });

    // Handle errors
    app.use(function (err, req, res, next) { // eslint-disable-line no-unused-vars
        dateLog(err);
        res.status(400).send('Error:' + err);
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
