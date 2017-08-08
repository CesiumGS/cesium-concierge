'use strict';

var Cesium = require('cesium');
var Promise = require('bluebird');

var commentOnClosedIssue = require('./commentOnClosedIssue');
var commentOnOpenedPullRequest = require('./commentOnOpenedPullRequest');
var dateLog = require('./dateLog');
var Settings = require('./Settings');

var defined = Cesium.defined;

module.exports = postToGitHub;

function postToGitHub(req, res, next) {
    var repositoryName = req.body.repository.full_name;
    var action = req.body.action;
    var event = req.headers['x-github-event'];

    var repositoryNames = Object.keys(Settings.repositories);
    if (repositoryNames.indexOf(repositoryName) < 0) {
        var message = 'Could not find ' + repositoryName + ' in ' + repositoryNames;
        dateLog(message);
        next(new Error(message));
        return;
    }

    dateLog('Received event to repository: ' + repositoryName);
    dateLog('event: ' + event);
    dateLog('jsonResponse: ' + req.body);

    var repositorySettings = Settings.repositories[repositoryName];
    var headers = {
        'User-Agent': 'cesium-concierge',
        Authorization: 'token ' + repositorySettings.gitHubToken
    };
    var checkChangesMd = repositorySettings.checkChangesMd;
    var promise = Promise.resolve();
    if ((event === 'issues' || event === 'pull_request') && action === 'closed' &&
        repositorySettings.remindForum) {
        promise = promise.then(function () {
            dateLog('Calling commentOnClosedIssue');
            return commentOnClosedIssue(req.body, headers);
        });
    } else if (event === 'pull_request' && action === 'opened' &&
        (defined(repositorySettings.thirdPartyFolders) || checkChangesMd)) {
        promise = promise.then(function () {
            dateLog('Calling commentOnOpenedPullRequest');
            return commentOnOpenedPullRequest(req.body, headers, repositorySettings.thirdPartyFolders,
                checkChangesMd, repositorySettings.claUrl);
        });
    }

    promise.then(function (result) {
        res.status(200).send({
            success: true
        });

        if (!defined(result)) {
            var message = 'GitHub request did not match any events the server is listening for';
            dateLog(message);
            next(new Error(message));
            return;
        }
        dateLog('GitHub API returned with statusCode: ' + result.statusCode);
        dateLog('and statusMessage: ' + result.statusMessage);
        next();
    }).catch(function (e) {
        var message = 'Got an error: ' + e;
        dateLog(message);
        next(new Error('Got an error: ' + e));
    });
}
