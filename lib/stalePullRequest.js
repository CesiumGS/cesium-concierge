'use strict';

const Cesium = require('cesium');
const Promise = require('bluebird');
const requestPromise = require('request-promise');
const parseLink = require('parse-link-header');
const moment = require('moment');

const dateLog = require('./dateLog');

module.exports = stalePullRequest;

/**
 * Bumps stale pull requests for all configured repositories.
 *
 * @param {Object} repositories The Settings.repositories object.
 * @returns {Promise} A promise that resolves when the process is complete.
 */
function stalePullRequest(repositories) {
    dateLog('Initiating `stalePullRequest` job.');
    return Promise.each(Object.keys(repositories), function (repositoryName) {
        const repositorySettings = repositories[repositoryName];
        return stalePullRequest._processRepository(repositoryName, repositorySettings)
            .catch(function (error) {
                //Eat the error here so that all repositories are processed.
                console.error(error);
            });
    });
}

/**
 * Get all pull requests for the given repository by going sequentially requesting all pages
 * from the GitHub API.
 *
 * @param {String} repositoryName Base url to list pull requests https://developer.github.com/v3/pulls/#list-pull-requests
 * @param {RepositorySettings} repositorySettings The repository settings
 * @return {Promise<Array<http.IncomingMessage | undefined>>} Promise to an array of incoming messages
 */
stalePullRequest._processRepository = function (repositoryName, repositorySettings) {
    dateLog(`Checking ${  repositoryName}`);
    let pullRequests = [];

    function processPage(response) {
        const linkData = parseLink(response.headers.link);
        pullRequests = pullRequests.concat(response.body);
        // If we're at the last page
        if (!Cesium.defined(linkData) || !Cesium.defined(linkData.next)) {
            return Promise.each(pullRequests, function (pullRequest) {
                return stalePullRequest._processPullRequest(pullRequest, repositorySettings);
            });
        }
        // Otherwise, request the next page
        return requestPromise.get({
            url: linkData.next.url,
            headers: repositorySettings.headers,
            json: true,
            resolveWithFullResponse: true
        }).then(processPage);
    }

    return requestPromise.get({
        url: `https://api.github.com/repos/${  repositoryName  }/pulls?state=open&base=main`,
        headers: repositorySettings.headers,
        json: true,
        resolveWithFullResponse: true
    }).then(processPage);
};

stalePullRequest._processPullRequest = function (pullRequest, repositorySettings) {
    const commentsUrl = `${pullRequest.comments_url  }?sort=updated`;
    const commitsUrl = pullRequest.commits_url;

    function checkForUpdates(commentsJsonResponse, commitsJsonResponse) {
        let lastCommentDate;
        const lastCommitDate = moment(commitsJsonResponse[commitsJsonResponse.length - 1].commit.author.date).startOf('date');

        if (commentsJsonResponse.length === 0) {
            lastCommentDate = moment(pullRequest.updated_at).startOf('day');
        } else {
            lastCommentDate = moment(commentsJsonResponse[commentsJsonResponse.length - 1].updated_at).startOf('day');
        }

        const foundStop = stalePullRequest._foundStopComment(commentsJsonResponse);
        const today = moment().startOf('day');

        const daysSinceComment = today.diff(lastCommentDate, 'days');
        const daysSinceCommit = today.diff(lastCommitDate, 'days');

        const daysSinceUpdate = Math.min(daysSinceComment, daysSinceCommit);

        if (!foundStop && daysSinceUpdate >= repositorySettings.maxDaysSinceUpdate) {
            const template = repositorySettings.stalePullRequestTemplate;
            return requestPromise.post({
                url: pullRequest.comments_url,
                headers: repositorySettings.headers,
                body: {
                    body: template({
                        maxDaysSinceUpdate: repositorySettings.maxDaysSinceUpdate,
                        userName: pullRequest.user.login
                    })
                },
                json: true
            });
        }
    }

    let commitsJsonResponse;

    return stalePullRequest._getCommits(commitsUrl, repositorySettings)
        .then(function (commits) {
            commitsJsonResponse = commits;
            return stalePullRequest._getComments(commentsUrl, repositorySettings);
        })
        .then(function (commentsJsonResponse) {
            return checkForUpdates(commentsJsonResponse, commitsJsonResponse);
        });
};

stalePullRequest._foundStopComment = function (commentsJsonResponse) {
    for (let i = 0; i < commentsJsonResponse.length; i++){
        const comment = commentsJsonResponse[i].body.toLowerCase();
        const userName = commentsJsonResponse[i].user.login;
        if (userName !== 'cesium-concierge' && comment.indexOf('@cesium-concierge stop') !== -1) {
            return true;
        }
    }

    return false;
};

stalePullRequest._getCommits = function (commitsUrl, repositorySettings) {
    return requestPromise.get({
        url: commitsUrl,
        headers: repositorySettings.headers,
        json: true
    })
    .then(function (commits) {
        return commits;
    });
};

stalePullRequest._getComments = function (commentsUrl, repositorySettings) {
    return requestPromise.get({
        url: commentsUrl,
        headers: repositorySettings.headers,
        json: true,
        resolveWithFullResponse: true
    })
    .then(function (response) {
        const linkData = parseLink(response.headers.link);
        if (Cesium.defined(linkData)) {
            const lastUrl = linkData.last.url;
            return requestPromise.get({
                url: lastUrl,
                headers: repositorySettings.headers,
                json: true,
            })
            .then(function (comments) {
                return comments;
            });
        }
        return response.body;
    });
};
