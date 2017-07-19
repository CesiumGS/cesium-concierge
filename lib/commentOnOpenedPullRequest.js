'use strict';
var Cesium = require('cesium');
var Promise = require('bluebird');
var requestPromise = require('request-promise');

var dateLog = require('./dateLog');
var statusCodeIsOk = require('./statusCodeIsOk');

var Check = Cesium.Check;
var defined = Cesium.defined;

module.exports = commentOnOpenedPullRequest;

/** Post comment on newly opened pull request
 *
 * @param {Object} jsonResponse Full response from GitHub event
 * @param {Object} headers Headers to use in GET requests
 * @param {String} changesSignature Message to post if CHANGES.md has changed in PR
 * @param {String} thirdPartySignature Message to post if any third party files have changed
 * @return {Promise<http.IncomingMessage | String>} Response of POST
 * @throws {DeveloperError} if jsonResponse or headers are not objects
 */
function commentOnOpenedPullRequest(jsonResponse, headers, changesSignature, thirdPartySignature) {
    Check.typeOf.object('jsonResponse', jsonResponse);
    Check.typeOf.object('headers', headers);
    var url = jsonResponse.pull_request.url;
    commentOnOpenedPullRequest._implementation(url + '/files', url, headers, changesSignature, thirdPartySignature);
}

/** Implementation
 *
 * @param {String} pullRequestFilesUrl API Url to GET which files changed in pull request (https://developer.github.com/v3/pulls/#list-pull-requests-files)
 * @param {String} pullRequestCommentsUrl API Url to POST comments to
 * @param {Object} headers Headers
 * @param {String} changesSignature Message to post if CHANGES.md has changed in PR
 * @param {String} thirdPartySignature Message to post if any third party files have changed
 * @private
 * @return {Promise<http.IncomingMessage | String>} Response of POST
 */
commentOnOpenedPullRequest._implementation = function (pullRequestFilesUrl, pullRequestCommentsUrl, headers,
                                                        changesSignature, thirdPartySignature) {
    var files;

    return requestPromise.get({
        url: pullRequestFilesUrl,
        headers: headers,
        json: true,
        resolveWithFullResponse: true
    })
    .then(function (filesJsonResponse) {
        var message = '';
        var didUpdateChanges = false;
        var didUpdateThirdParty = false;

        if (!statusCodeIsOk(filesJsonResponse)) {
            return Promise.reject('Bad status code with url ' + pullRequestFilesUrl);
        }
        files = filesJsonResponse.body.map(function (file) {
            return file.filename;
        });
        dateLog('These files changed in the pull request: ' + files);

        didUpdateChanges = commentOnOpenedPullRequest._didUpdateChanges(files);
        didUpdateThirdParty = commentOnOpenedPullRequest._didUpdateThirdParty(files);
        if (didUpdateChanges) {
            dateLog('CHANGES.md was updated');
            message += changesSignature;
        }
        if (didUpdateThirdParty) {
            dateLog('A third party file changed');
            message += '\n' + thirdPartySignature;
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
        return Promise.reject('Did not change CHANGES.md or any third party files');
    });
};

/** Check if CHANGES.md updated
 *
 * @param {String[]} files Paths to changed files
 * @private
 * @return {boolean} True if any file in `thirdPartyFolders` has changed
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
    for (var i = 0; i < files.length; i++) {
        for (var j = 0; j < thirdPartyFolders.length; j++) {
            if (files[i].search(thirdPartyFolders[j]) >= 0) {
                dateLog('File ' + files[i] + ' matched with third party folder ' + thirdPartyFolders[j]);
                return true;
            }
        }
    }
    dateLog('No files matched with third party folders');
    return false;
};
