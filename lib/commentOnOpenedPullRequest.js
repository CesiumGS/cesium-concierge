'use strict';
var Cesium = require('cesium');
var Promise = require('bluebird');
var requestPromise = require('request-promise');

var dateLog = require('./dateLog');
var checkStatus = require('./checkStatus');

var Check = Cesium.Check;

var changesMessage = 'Thank you for the pull request.\nI noticed that `CHANGES.md` has not been updated. ' +
    'If this change affects users in any way, please add a bullet point describing the change and include a link back to this pull request.\n' +
    'Thanks again!';
var thirdPartyMessage = 'Thank you for the pull request.\n I noticed that {ThirdPartyFileName} has been added or modified. ' +
    'Since this is a Third-party library, please verify that it has a section in `LICENSE.md` and that its license information is up to date with this new version.\n' +
    'Thanks again!';

module.exports = commentOnOpenedPullRequest;

/** Post comment on newly opened pull request
 *
 * @param {Object} jsonResponse Full response from GitHub event
 * @param {Object} headers Headers to use in GET requests
 * @param {String[]} thirdPartyFolders Folder paths to search for third party file changes
 * @return {Promise<http.IncomingMessage | String>} Response of POST
 * @throws {DeveloperError} if `jsonResponse`, `headers`, or `pullRequest` are not objects
 */
function commentOnOpenedPullRequest(jsonResponse, headers, thirdPartyFolders) {
    Check.typeOf.object('jsonResponse', jsonResponse);
    Check.typeOf.object('headers', headers);
    var pullRequest = jsonResponse.pull_request;
    Check.typeOf.object('pullRequest', pullRequest);
    return commentOnOpenedPullRequest._implementation(pullRequest.url + '/files', pullRequest.comments_url, headers, thirdPartyFolders);
}

/** Implementation
 *
 * @param {String} pullRequestFilesUrl API Url to GET which files changed in pull request (https://developer.github.com/v3/pulls/#list-pull-requests-files)
 * @param {String} pullRequestCommentsUrl API Url to POST comments to
 * @param {Object} headers Headers
 * @param {String[]} thirdPartyFolders Folder paths to search for third party file changes
 * @private
 * @return {Promise<http.IncomingMessage | String>} Response of POST
 */
commentOnOpenedPullRequest._implementation = function (pullRequestFilesUrl, pullRequestCommentsUrl, headers, thirdPartyFolders) {
    return requestPromise.get({
        url: pullRequestFilesUrl,
        headers: headers,
        json: true,
        resolveWithFullResponse: true
    })
    .then(function (filesJsonResponse) {
        return checkStatus(filesJsonResponse);
    })
    .then(function (filesJsonResponse) {
        var message = '';
        var files;
        var didUpdateChanges;
        var didUpdateThirdParty;

        files = filesJsonResponse.body.map(function (file) {
            return file.filename;
        });
        dateLog('These files changed in the pull request: ' + files);

        didUpdateChanges = commentOnOpenedPullRequest._didUpdateChanges(files);
        didUpdateThirdParty = commentOnOpenedPullRequest._didUpdateThirdParty(files, thirdPartyFolders);
        if (didUpdateChanges) {
            dateLog('CHANGES.md was updated');
            message += changesMessage;
        }
        if (didUpdateThirdParty) {
            dateLog('A third party file changed');
            message += '\nAlso: ' + thirdPartyMessage;
        }
        if (didUpdateChanges || didUpdateThirdParty) {
            return requestPromise.post({
                uri: pullRequestCommentsUrl,
                headers: headers,
                body: {
                    body: message
                },
                json: true,
                resolveWithFullResponse: true
            });
        }
        return Promise.resolve();
    });
};

/** Check if CHANGES.md updated
 *
 * @param {String[]} files Paths to changed files
 * @private
 * @return {boolean} True `CHANGES.md` has changed
 */
commentOnOpenedPullRequest._didUpdateChanges = function (files) {
    for (var i = 0; i < files.length; i++) {
        if (/^CHANGES\.md/.test(files[i])) {
            return true;
        }
    }
    return false;
};

/** Check if any third party files were updated
 *
 * @param {String[]} files Paths to changed files
 * @param {String[]} thirdPartyFolders Paths to third party folders
 * @private
 * @return {boolean} True if any file in `thirdPartyFolders` has changed
 */
commentOnOpenedPullRequest._didUpdateThirdParty = function (files, thirdPartyFolders) {
    if (thirdPartyFolders.length === 0) {
        return false;
    }
    for (var i = 0; i < files.length; i++) {
        for (var j = 0; j < thirdPartyFolders.length; j++) {
            console.log(files[i], thirdPartyFolders[j]);
            if (files[i].startsWith(thirdPartyFolders[j]) || ('/' + files[i]).startsWith(thirdPartyFolders[j])) {
                dateLog('File ' + files[i] + ' matched with third party folder ' + thirdPartyFolders[j]);
                return true;
            }
        }
    }
    dateLog('No files matched with third party folders');
    return false;
};
