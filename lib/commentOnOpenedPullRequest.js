'use strict';
const Cesium = require('cesium');
const parseLink = require('parse-link-header');
const Promise = require('bluebird');
const requestPromise = require('request-promise');

const Settings = require('./Settings');

const Check = Cesium.Check;
const defined = Cesium.defined;

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

    const pullRequest = body.pull_request;
    const filesUrl = `${pullRequest.url  }/files`;
    const commentsUrl = pullRequest.comments_url;
    const userName = pullRequest.user.login;
    const baseBranch = pullRequest.base.ref;
    const headBranch = pullRequest.head.ref;
    const headHtmlUrl = pullRequest.head.repo.html_url;
    const headApiUrl = pullRequest.head.repo.url;

    const repository = body.repository;
    const repositoryUrl = repository.html_url;
    const repositoryContributorsUrl = repository.contributors_url;

    return commentOnOpenedPullRequest._implementation(filesUrl, commentsUrl, repositorySettings, userName, repositoryUrl, baseBranch, headBranch, headHtmlUrl, headApiUrl, repositoryContributorsUrl);
}

commentOnOpenedPullRequest._implementation = function (pullRequestFilesUrl, pullRequestCommentsUrl, repositorySettings, userName, repositoryUrl, baseBranch, headBranch, headHtmlUrl, headApiUrl, repositoryContributorsUrl) {
    // The google sheets API will fail to initialize if any of the required settings are missing.
    const claEnabled = defined(Settings.googleSheetsApi);
    let askForCla = false;
    let askAboutContributors = false;
    let errorCla;
    return repositorySettings.fetchSettings()
        .then(function () {
            return commentOnOpenedPullRequest._askForCla(userName);
        })
        .then(function (result) {
            askForCla = result;
        })
        .catch(function(error) {
            errorCla = error.toString();
        })
        .then(function () {
            return commentOnOpenedPullRequest._askAboutContributors(userName, repositorySettings, headApiUrl, headBranch, repositoryContributorsUrl);
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
            const files = filesJsonResponse.map(function (file) {
                return file.filename;
            });

            const askAboutChanges = commentOnOpenedPullRequest._askAboutChanges(files, baseBranch);
            const askAboutThirdParty = commentOnOpenedPullRequest._askAboutThirdParty(files, repositorySettings.thirdPartyFolders);
            const askAboutTests = commentOnOpenedPullRequest._askAboutTests(files, repositorySettings.unitTestPath);
            let contributorsUrl;
            if (defined(repositorySettings.contributorsPath)) {
                contributorsUrl = `${headHtmlUrl  }/blob/${  headBranch  }/${  repositorySettings.contributorsPath}`;
            }

            const message = repositorySettings.pullRequestOpenedTemplate({
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
    if (baseBranch !== 'main') {
        return false;
    }
    for (let i = 0; i < files.length; i++) {
        if (/^CHANGES\.md$/.test(files[i])) {
            return false;
        }
    }
    return true;
};

function findContributorFromGitHub(userName, repositoryContributorsUrl, repositorySettingsHeaders) {
    return requestPromise.get({
        url: repositoryContributorsUrl,
        headers: repositorySettingsHeaders,
        json: true,
        resolveWithFullResponse: true
    })
    .then(function (response) {
        const contributors = response.body;
        const result = contributors.find(function(contributor) {
            return contributor.login === userName;
        });

        if (defined(result)) {
            return result;
        }

        const linkData = parseLink(response.headers.link);
        if (defined(linkData) && defined(linkData.next)) {
            return findContributorFromGitHub(userName, linkData.next.url, repositorySettingsHeaders);
        }
    });
}

commentOnOpenedPullRequest._askAboutContributors = function (userName, repositorySettings, headApiUrl, headBranch, repositoryContributorsUrl) {
    if (!defined(repositorySettings.contributorsPath) && !repositorySettings.contributorsFromGitHub) {
        return Promise.resolve(false);
    }

    if (repositorySettings.contributorsFromGitHub) { // GitHub maintains only 500 named contributors
        return findContributorFromGitHub(userName, repositoryContributorsUrl, repositorySettings.headers)
        .then(function (result) {
            return !defined(result);
        });
    }

    const url = `${headApiUrl  }/contents/${  repositorySettings.contributorsPath  }?ref=${  headBranch}`;

    return requestPromise.get({
        url: url,
        headers: repositorySettings.headers,
        json: true
    })
    .then(function (response) {
        const contributorsFileContent = Buffer.from(response.content, 'base64').toString();
        return contributorsFileContent.indexOf(userName) === -1;
    });
};

commentOnOpenedPullRequest._askAboutThirdParty = function (files, thirdPartyFolders) {
    if (!defined(thirdPartyFolders) || thirdPartyFolders.length === 0) {
        return false;
    }
    for (let i = 0; i < files.length; i++) {
        for (let j = 0; j < thirdPartyFolders.length; j++) {
            const folder = thirdPartyFolders[j];
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
    for (let i = 0; i < files.length; i++) {
        const regex = new RegExp(`^${  unitTestPath}`, 'i');
        if (regex.test(files[i])) {
            return false;
        }
    }
    return true;
};

commentOnOpenedPullRequest._askForCla = function (userName) {
    if (!defined(Settings.googleSheetsApi)) {
        return Promise.resolve(false);
    }

    let foundIndividualCLA = false;
    let foundCorporateCLA = false;
    // Check individual CLA sheet.
    return Settings.googleSheetsApi.spreadsheets.values.get({
        spreadsheetId: Settings.individualClaSheetID,
        range: 'D2:D'
    })
    .then(function(response) {
        const rows = response.data.values;

        for (let i = 0; i < rows.length; i++) {
            if(rows[i].length === 0) {
                continue;
            }
            const rowUserName = rows[i][0].toLowerCase();
            if (userName.toLowerCase() === rowUserName) {
                foundIndividualCLA = true;
                break;
            }
        }

        // Now check corporate CLA sheet.
        return Settings.googleSheetsApi.spreadsheets.values.get({
            spreadsheetId: Settings.corporateClaSheetID,
            range: 'H2:H'
        });
    })
    .then(function(response) {
        const rows = response.data.values;
        for (let i = 0; i < rows.length; i++) {
            if(rows[i].length === 0) {
                continue;
            }
            let rowScheduleA = rows[i][0].toLowerCase();
            // We're a little more lenient with the ScheduleA userName check, since it's an unformatted text field.
            // We split the ScheduleA field by whitespace see if we can find the GitHub username in there.
            rowScheduleA = rowScheduleA.replace(/\n/g, ' ');
            const words = rowScheduleA.split(' ');
            for (let j = 0; j < words.length; j++) {
                if (userName.toLowerCase() === words[j].trim()) {
                    foundCorporateCLA = true;
                    break;
                }
            }
        }

        return !foundIndividualCLA && !foundCorporateCLA;
    });
};
