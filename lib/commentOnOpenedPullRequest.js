'use strict';
var Cesium = require('cesium');
var Promise = require('bluebird');
var requestPromise = require('request-promise');

var Settings = require('./Settings');
var deferredPromise = require('./deferredPromise');

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
    var baseBranch = pullRequest.base.ref;
    var headBranch = pullRequest.head.ref;
    var headHtmlUrl = pullRequest.head.repo.html_url;
    var headApiUrl = pullRequest.head.repo.url;

    var repository = body.repository;
    var repositoryUrl = repository.html_url;

    return commentOnOpenedPullRequest._implementation(filesUrl, commentsUrl, repositorySettings, userName, repositoryUrl, baseBranch, headBranch, headHtmlUrl, headApiUrl);
}

commentOnOpenedPullRequest._implementation = function (pullRequestFilesUrl, pullRequestCommentsUrl, repositorySettings, userName, repositoryUrl, baseBranch, headBranch, headHtmlUrl, headApiUrl) {
    var claEnabled = defined(repositorySettings.claUrl);
    var askForCla = false;
    var askAboutContributors = false;
    var errorCla;
    return repositorySettings.fetchSettings()
        .then(function () {
            return commentOnOpenedPullRequest._askForCla(userName, repositorySettings);
        })
        .then(function (result) {
            askForCla = result;
        })
        .catch(function(error) {
            errorCla = error.toString();
        })
        .then(function () {
            return commentOnOpenedPullRequest._askAboutContributors(userName, repositorySettings, headApiUrl, headBranch);
        })
        .then(function (result) {
            askAboutContributors = result;
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

            var askAboutChanges = commentOnOpenedPullRequest._askAboutChanges(files, baseBranch);
            var askAboutThirdParty = commentOnOpenedPullRequest._askAboutThirdParty(files, repositorySettings.thirdPartyFolders);
            var askAboutTests = commentOnOpenedPullRequest._askAboutTests(files, repositorySettings.unitTestPath);
            var contributorsUrl;
            if (defined(repositorySettings.contributorsPath)) {
                contributorsUrl = headHtmlUrl + '/blob/' + headBranch + '/' + repositorySettings.contributorsPath;
            }

            var message = repositorySettings.pullRequestOpenedTemplate({
                userName: userName,
                repository_url: repositoryUrl,
                claEnabled: claEnabled,
                askForCla: askForCla,
                errorCla: errorCla,
                askAboutChanges: askAboutChanges,
                askAboutContributors: askAboutContributors,
                contributorsUrl: contributorsUrl,
                askAboutThirdParty: askAboutThirdParty,
                thirdPartyFolders: repositorySettings.thirdPartyFolders.join(', '),
                headBranch: headBranch,
                askAboutTests: askAboutTests
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

commentOnOpenedPullRequest._askAboutChanges = function (files, baseBranch) {
    if (baseBranch !== 'master') {
        return false;
    }
    for (var i = 0; i < files.length; i++) {
        if (/^CHANGES\.md$/.test(files[i])) {
            return false;
        }
    }
    return true;
};

commentOnOpenedPullRequest._askAboutContributors = function (userName, repositorySettings, headApiUrl, headBranch) {
    if (!defined(repositorySettings.contributorsPath)) {
        return Promise.resolve(false);
    }

    var url = headApiUrl + '/contents/' + repositorySettings.contributorsPath + '?ref=' + headBranch;

    return requestPromise.get({
        url: url,
        headers: repositorySettings.headers,
        json: true
    })
    .then(function (response) {
        var contributorsFileContent = Buffer.from(response.content, 'base64').toString();
        return contributorsFileContent.indexOf(userName) === -1;
    });
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

commentOnOpenedPullRequest._askAboutTests = function (files, unitTestPath) {
    if (!defined(unitTestPath)) {
        return false;
    }
    for (var i = 0; i < files.length; i++) {
        var regex = new RegExp('^' + unitTestPath, 'i');
        if (regex.test(files[i])) {
            return false;
        }
    }
    return true;
};

commentOnOpenedPullRequest._askForCla = function (username) {
    if (!defined(Settings.googleApiConfig) || !defined(Settings.individualClaSheetID) || !defined(Settings.corporateClaSheetID) || !defined(Settings.googleSheetsApi)) {
        return Promise.resolve(false);
    }

    var deferred = deferredPromise();

    // Check individual CLA sheet.
    Settings.googleSheetsApi.spreadsheets.values.get({
        spreadsheetId: Settings.individualClaSheetID,
        range: 'D2:D'
    }, function(error, response) {
        if (error) {return console.error('Google Sheets API error: ' + error);}

        var rows = response.data.values;
        var i;
        var foundIndividualCLA = false;
        var foundCorporateCLA = false;

        for (i = 0; i < rows.length; i++) {
            if(rows[i].length === 0) {continue;}
            var rowUsername = rows[i][0].toLowerCase();
            if (username.toLowerCase() === rowUsername) {
                foundIndividualCLA = true;
            }
        }

        Settings.googleSheetsApi.spreadsheets.values.get({
            spreadsheetId: Settings.corporateClaSheetID,
            range: 'H2:H'
        }, function(error, response) {
            if (error) {return console.error('Google Sheets API error: ' + error);}

            rows = response.data.values;
            for (i = 0; i < rows.length; i++) {
                if(rows[i].length === 0) {continue;}
                var rowScheduleA = rows[i][0].toLowerCase();
                // We're a little more lenient with the ScheduleA username check, since it's an unformatted text field.
                if (rowScheduleA.indexOf(username.toLowerCase()) !== -1) {
                    foundIndividualCLA = true;
                }
            }

            deferred.resolve(!foundIndividualCLA && !foundCorporateCLA);
        });


    });

    return deferred.promise;
};
