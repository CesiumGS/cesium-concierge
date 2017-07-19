'use strict';
var Cesium = require('cesium');
var Promise = require('bluebird');
var requestPromise = require('request-promise');

var dateLog = require('./dateLog');
var getUniqueMatch = require('./getUniqueMatch');
var statusCodeIsOk = require('./statusCodeIsOk');

var Check = Cesium.Check;
var defined = Cesium.defined;

module.exports = commentOnOpenedPullRequest;

function commentOnOpenedPullRequest(jsonResponse, headers) {
    Check.typeOf.object('jsonResponse', jsonResponse);
    Check.typeOf.object('headers', headers);

    commentOnOpenedPullRequest._implementation();
}

commentOnOpenedPullRequest._implementation = function (pullRequestFilesUrl, pullRequestCommentsUrl, headers) {
    var didUpdateChanges = false;
    var didUpdateThirdParty = false;
    var files;

    return requestPromise.get({
        url: pullRequestFilesUrl,
        headers: headers,
        json: true,
        resolveWithFullResponse: true
    })
    .then(function (filesJsonResponse) {
        if (!statusCodeIsOk(filesJsonResponse)) {
            return Promise.reject('Bad status code with url ' + pullRequestFilesUrl);
        }
        files = filesJsonResponse.body.map(function (file) {
            return file.filename;
        });
        dateLog('These files changed in the pull request: ' + files);

        didUpdateChanges = commentOnOpenedPullRequest._didUpdateChanges(files);
        didUpdateThirdParty = commentOnOpenedPullRequest._didUpdateThirdParty(files);
    });
};

commentOnOpenedPullRequest._didUpdateChanges = function (files) {
    for (var i = 0; i < files.length; i++) {
        if (/CHANGES.md/.test(files[i])) {
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
 * @return {boolean} True if files in `thirdPartyFolders` have changed
 */
commentOnOpenedPullRequest._didUpdateThirdParty = function (files, thirdPartyFolders) {

};
