'use strict';

var Promise = require('bluebird');

var commentOnClosedIssue = require('./commentOnClosedIssue');
var commentOnOpenedPullRequest = require('./commentOnOpenedPullRequest');
var Settings = require('./Settings');

module.exports = postToGitHub;

function postToGitHub(req, res, next) {
    var repositoryName = req.body.repository.full_name;
    var repositoryNames = Object.keys(Settings.repositories);
    if (!repositoryNames.includes(repositoryName)) {
        next(new Error(repositoryName + ' is not a configured repository.'));
        return;
    }

    var action = req.body.action;
    var event = req.headers['x-github-event'];
    var repositorySettings = Settings.repositories[repositoryName];

    var promise;
    if ((event === 'issues' || event === 'pull_request') && action === 'closed') {
        promise = postToGitHub._commentOnClosedIssue(req.body, repositorySettings, Settings.outreachUsers);
    } else if (event === 'pull_request' && action === 'opened') {
        promise = postToGitHub._commentOnOpenedPullRequest(req.body, repositorySettings);
    } else {
        promise = Promise.resolve();
    }

    return promise
        .then(function () {
            res.status(204).end();
            next();
        })
        .catch(function (error) {
            next(error);
            return Promise.reject(error);
        });
}

//Exposed for testing
postToGitHub._commentOnClosedIssue = commentOnClosedIssue;
postToGitHub._commentOnOpenedPullRequest = commentOnOpenedPullRequest;
