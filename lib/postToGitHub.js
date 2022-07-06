'use strict';

const Promise = require('bluebird');

const commentOnClosedIssue = require('./commentOnClosedIssue');
const commentOnOpenedPullRequest = require('./commentOnOpenedPullRequest');
const Settings = require('./Settings');

module.exports = postToGitHub;

function postToGitHub(req, res, next) {
    const repositoryName = req.body.repository.full_name;
    const repositoryNames = Object.keys(Settings.repositories);
    if (!repositoryNames.includes(repositoryName)) {
        next(new Error(`${repositoryName  } is not a configured repository.`));
        return;
    }

    const action = req.body.action;
    const event = req.headers['x-github-event'];
    const repositorySettings = Settings.repositories[repositoryName];

    let promise;
    if ((event === 'issues' || event === 'pull_request') && action === 'closed') {
        promise = postToGitHub._commentOnClosedIssue(req.body, repositorySettings);
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
