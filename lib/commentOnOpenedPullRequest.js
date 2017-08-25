'use strict';
var Cesium = require('cesium');
var Promise = require('bluebird');
var requestPromise = require('request-promise');

var Check = Cesium.Check;
var defined = Cesium.defined;

module.exports = commentOnOpenedPullRequest;

/**
 * Comments on a newly opened pull request.
 *
 * @param {Object} body The GitHub event body.
 * @param {Object} repositorySettings Headers to use for making additional GitHub requests.
 * @returns {Promise} A Promise that resolves when processing is complete.
 */
function commentOnOpenedPullRequest(body, repositorySettings) {
    Check.typeOf.object('body', body);
    Check.typeOf.object('repositorySettings', repositorySettings);

    var pullRequest = body.pull_request;
    var filesUrl = pullRequest.url + '/files';
    var commentsUrl = pullRequest.comments_url;
    var userName = pullRequest.user.login;

    var repository = body.repository;
    var repositoryUrl = repository.html_url;

    return commentOnOpenedPullRequest._implementation(filesUrl, commentsUrl, repositorySettings, userName, repositoryUrl);
}

commentOnOpenedPullRequest._implementation = function (pullRequestFilesUrl, pullRequestCommentsUrl, repositorySettings, userName, repositoryUrl) {
    var claEnabled = defined(repositorySettings.claUrl);
    var askForCla = false;
    return commentOnOpenedPullRequest._askForCla(userName, repositorySettings)
        .then(function (result) {
            askForCla = result;
        })
        .then(function () {
            return requestPromise.get({
                url: pullRequestFilesUrl,
                headers: repositorySettings.headers,
                json: true
            });
        })
        .then(function (filesJsonResponse) {
            var files = filesJsonResponse.map(function (file) {
                return file.filename;
            });

            var askAboutChanges = commentOnOpenedPullRequest._askAboutChanges(files);
            var askAboutThirdParty = commentOnOpenedPullRequest._askAboutThirdParty(files, repositorySettings.thirdPartyFolders);

            var message = repositorySettings.pullRequestOpenedTemplate({
                userName: userName,
                repository_url: repositoryUrl,
                claEnabled: claEnabled,
                askForCla: askForCla,
                askAboutChanges: askAboutChanges,
                askAboutThirdParty: askAboutThirdParty,
                thirdPartyFolders: repositorySettings.thirdPartyFolders.join(', ')
            });
            return requestPromise.post({
                url: pullRequestCommentsUrl,
                headers: repositorySettings.headers,
                body: {
                    body: message
                },
                json: true
            });
        });
};

commentOnOpenedPullRequest._askAboutChanges = function (files) {
    for (var i = 0; i < files.length; i++) {
        if (/^CHANGES\.md$/.test(files[i])) {
            return false;
        }
    }
    return true;
};

commentOnOpenedPullRequest._askAboutThirdParty = function (files, thirdPartyFolders) {
    if (!defined(thirdPartyFolders) || thirdPartyFolders.length === 0) {
        return false;
    }
    for (var i = 0; i < files.length; i++) {
        for (var j = 0; j < thirdPartyFolders.length; j++) {
            var folder = thirdPartyFolders[j];
            if (files[i].startsWith(folder)) {
                return true;
            }
        }
    }
    return false;
};

commentOnOpenedPullRequest._askForCla = function (username, repositorySettings) {
    if (!defined(repositorySettings.claUrl)) {
        return Promise.resolve(false);
    }

    return requestPromise.get({
        url: repositorySettings.claUrl,
        headers: repositorySettings.headers,
        json: true
    })
        .then(function (response) {
            var cla = JSON.parse(Buffer.from(response.content, 'base64').toString());
            for (var i = 0; i < cla.length; i++) {
                var claUsername = cla[i].gitHub;
                if (defined(claUsername) && claUsername === username) {
                    return false;
                }
            }
            return true;
        });
};
