'use strict';
var Cesium = require('cesium');
var handlebars = require('handlebars');
var requestPromise = require('request-promise');

var Settings = require('./Settings');

var Check = Cesium.Check;
var defined = Cesium.defined;

module.exports = commentOnOpenedPullRequest;

/**
 * Comments on a newly opened pull request.
 *
 * @param {Object} body The GitHub event body.
 * @param {Object} headers Headers to use for making additional GitHub requests.
 * @returns {Promise} A Promise that resolves when processing is complete.
 */
function commentOnOpenedPullRequest(body, headers) {
    Check.typeOf.object('body', body);
    Check.typeOf.object('headers', headers);

    var pullRequest = body.pull_request;
    var filesUrl = pullRequest.url + '/files';
    var commentsUrl = pullRequest.comments_url;
    var userName = pullRequest.user.login;

    var repository = body.repository;
    var repositoryUrl = repository.html_url;

    var thirdPartyFolders = Settings.getThirdPartyFolders(repository.full_name);

    return commentOnOpenedPullRequest._implementation(filesUrl, commentsUrl, headers, userName, repositoryUrl, thirdPartyFolders);
}

commentOnOpenedPullRequest._implementation = function (pullRequestFilesUrl, pullRequestCommentsUrl, headers, userName, repositoryUrl, thirdPartyFolders) {
    return requestPromise.get({
        url: pullRequestFilesUrl,
        headers: headers,
        json: true
    })
        .then(function (filesJsonResponse) {
            var files = filesJsonResponse.map(function (file) {
                return file.filename;
            });

            var askAboutChanges = commentOnOpenedPullRequest._askAboutChanges(files);
            var askAboutThirdParty = commentOnOpenedPullRequest._askAboutThirdParty(files, thirdPartyFolders);

            if (askAboutChanges || askAboutThirdParty) {
                var message = commentOnOpenedPullRequest.renderMessage(userName, repositoryUrl, askAboutChanges, askAboutThirdParty, thirdPartyFolders);
                return requestPromise.post({
                    url: pullRequestCommentsUrl,
                    headers: headers,
                    body: {
                        body: message
                    },
                    json: true
                });
            }
        });
};

commentOnOpenedPullRequest.renderMessage = function (userName, repositoryUrl, askAboutChanges, askAboutThirdParty, thirdPartyFolders) {
    var template = handlebars.compile(Settings.getPullRequestOpenedTemplate());
    return template({
        userName: userName,
        repository_url: repositoryUrl,
        askAboutChanges: askAboutChanges,
        askAboutThirdParty: askAboutThirdParty,
        thirdPartyFolders: thirdPartyFolders.join(', ')
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
