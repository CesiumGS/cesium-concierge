'use strict';

var Cesium = require('cesium');
var Promise = require('bluebird');
var requestPromise = require('request-promise');
var parseLink = require('parse-link-header');

var Settings = require('../lib/Settings');
var dateLog = require('../lib/dateLog');

module.exports = stalePullRequest;

if (require.main === module) {
    Settings.loadRepositoriesSettings('./config.json')
        .then(function () {
            return stalePullRequest(Settings.repositories);
        })
        .catch(function (err) {
            console.error(err);
        });
}

/**
 * Bumps stale pull requests for all configured repositories.
 *
 * @param {Object} repositories The Settings.repositories object.
 * @returns {Promise} A promise that resolves when the process is complete.
 */
function stalePullRequest(repositories) {
    dateLog('Initiating `stalePullRequest` job.');
    return Promise.each(Object.keys(repositories), function (repositoryName) {
        var repositorySettings = repositories[repositoryName];
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
    dateLog('Checking ' + repositoryName);
    var pullRequests = [];

    function processPage(response) {
        var linkData = parseLink(response.headers.link);
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
        url: 'https://api.github.com/repos/' + repositoryName + '/pulls?state=open&base=master',
        headers: repositorySettings.headers,
        json: true,
        resolveWithFullResponse: true
    }).then(processPage);
};

stalePullRequest._processPullRequest = function (pullRequest, repositorySettings) {
    var commentsUrl = pullRequest.comments_url + '?sort=updated';
    return requestPromise.get({
        url: commentsUrl,
        headers: repositorySettings.headers,
        json: true,
        resolveWithFullResponse: true
    })
        .then(function (response) {
            var linkData = parseLink(response.headers.link);
            if (Cesium.defined(linkData)) {
                commentsUrl = linkData.last.url;
            }
            return requestPromise.get({
                url: commentsUrl,
                headers: repositorySettings.headers,
                json: true,
            }).then(function (commentsJsonResponse) {
                var lastComment = commentsJsonResponse[commentsJsonResponse.length - 1];
                var foundStop = stalePullRequest.foundStopComment(commentsJsonResponse);
                if (!foundStop && stalePullRequest.daysSince(new Date(lastComment.updated_at)) >= repositorySettings.maxDaysSinceUpdate) {
                    var template = repositorySettings.stalePullRequestTemplate;
                    return requestPromise.post({
                        url: commentsUrl,
                        headers: repositorySettings.headers,
                        body: {
                            body: template({
                                maxDaysSinceUpdate: repositorySettings.maxDaysSinceUpdate
                            })
                        },
                        json: true
                    });
                }
            });
        });
};

stalePullRequest.daysSince = function (date) {
    var msPerDay = 24 * 60 * 60 * 1000;
    return (Date.now() - date.getTime()) / msPerDay;
};

stalePullRequest.foundStopComment = function (commentsJsonResponse) {
    for(var i = 0; i < commentsJsonResponse.length; i++){
        var comment = commentsJsonResponse[i].body.toLowerCase();
        var userName = commentsJsonResponse[i].user.login;
        if (userName !== 'cesium-concierge' && comment.indexOf('@cesium-concierge stop') !== -1) {
            return true;
        }
    }

    return false;
};