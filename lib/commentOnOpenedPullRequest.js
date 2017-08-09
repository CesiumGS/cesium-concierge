'use strict';
var Cesium = require('cesium');
var handlebars = require('handlebars');
var Promise = require('bluebird');
var requestPromise = require('request-promise');

var dateLog = require('./dateLog');
var checkStatus = require('./checkStatus');

var Check = Cesium.Check;
var defined = Cesium.defined;

var thankYouMessage = '@{{ user }} thanks for the pull request!\n\n';
var changesMessage = 'I noticed that {{ changesMarkdownLink }} has not been updated. ' +
    'If this change updates the {{ project }} API in any way, fixes a bug, or makes any non-trivial update, please add ' +
    'a bullet point to `CHANGES.md` and bump this pull request so we know it was updated. ' +
    'For more info, see the {{ guidelines }}.\n\n{{ signature }}';
var thirdPartyMessage1 = 'I noticed that a file in ';
var thirdPartyMessage2 = ' has been added or modified. ' +
    'Please verify that it has a section in {{ licenseMarkdownLink }} and that its license information is up to date with this new version. ' +
    'Once you do, please confirm by commenting on this pull request.\n\n{{ signature }}';

var project = 'Cesium';
var changesMarkdownLink = '[CHANGES.md](https://github.com/AnalyticalGraphicsInc/cesium/blob/master/CHANGES.md)';
var signature = '__I am a bot who helps you make Cesium awesome!__ Thanks again.';
var licenseMarkdownLink = '[LICENSE.md](https://github.com/AnalyticalGraphicsInc/cesium/blob/master/LICENSE.md)';
var guidelines = '[Pull Request Guidelines](https://github.com/AnalyticalGraphicsInc/cesium/blob/master/CONTRIBUTING.md#pull-request-guidelines)';

module.exports = commentOnOpenedPullRequest;

var user = '';

/** Post comment on newly opened pull request
 *
 * @param {Object} jsonResponse Full response from GitHub event
 * @param {Object} headers Headers to use in GET requests
 * @param {String[]} thirdPartyFolders Folder paths to search for third party file changes
 * @param {Boolean} checkChangesMd If true, post about `CHANGES.md` not being updated
 * @return {Promise<http.IncomingMessage | String>} Response of POST
 * @throws {DeveloperError} if `jsonResponse`, `headers`, or `pullRequest` are not objects
 */
function commentOnOpenedPullRequest(jsonResponse, headers, thirdPartyFolders, checkChangesMd) {
    Check.typeOf.object('jsonResponse', jsonResponse);
    Check.typeOf.object('headers', headers);
    var pullRequest = jsonResponse.pull_request;
    Check.typeOf.object('pullRequest', pullRequest);
    user = jsonResponse.pull_request.user.login;
    return commentOnOpenedPullRequest._implementation(pullRequest.url + '/files', pullRequest.comments_url, headers, thirdPartyFolders, checkChangesMd);
}

/** Implementation
 *
 * @param {String} pullRequestFilesUrl API Url to GET which files changed in pull request (https://developer.github.com/v3/pulls/#list-pull-requests-files)
 * @param {String} pullRequestCommentsUrl API Url to POST comments to
 * @param {Object} headers Headers
 * @param {String[]} thirdPartyFolders Folder paths to search for third party file changes
 * @param {Boolean} checkChangesMd If true, post about `CHANGES.md` not being updated
 * @private
 * @return {Promise<http.IncomingMessage | String>} Response of POST
 */
commentOnOpenedPullRequest._implementation = function (pullRequestFilesUrl, pullRequestCommentsUrl, headers, thirdPartyFolders, checkChangesMd) {
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
        var message;
        var finalMessage;
        var template;
        var prom = Promise.resolve();

        var files = filesJsonResponse.body.map(function (file) {
            return file.filename;
        });
        dateLog('These files changed in the pull request: ' + files);
        dateLog('checkChangesMd is set to: ' + checkChangesMd);

        var didUpdateChanges = commentOnOpenedPullRequest._didUpdateChanges(files);
        var didUpdateThirdParty = commentOnOpenedPullRequest._didUpdateThirdParty(files, thirdPartyFolders);

        if (!didUpdateChanges && checkChangesMd) {
            dateLog('CHANGES.md was updated');
            message = thankYouMessage + changesMessage;

            template = handlebars.compile(message);
            finalMessage = template({
                licenseMarkdownLink: licenseMarkdownLink,
                signature: signature,
                project: project,
                changesMarkdownLink: changesMarkdownLink,
                guidelines: guidelines,
                user: user
            });
            console.log(finalMessage);
            prom = prom.then(requestPromise.post({
                uri: pullRequestCommentsUrl,
                headers: headers,
                body: {
                    body: finalMessage
                },
                json: true,
                resolveWithFullResponse: true
            }));
        }
        if (didUpdateThirdParty) {
            dateLog('A third party file changed');
            message = thankYouMessage;
            message += thirdPartyMessage1;
            switch (thirdPartyFolders.length) {
                case 1:
                    message += '`' + thirdPartyFolders[0] + '`';
                    break;
                case 2:
                    message += '`' + thirdPartyFolders[0] + '` or `' + thirdPartyFolders[1] + '`';
                    break;
                default:
                    var folder;
                    for (var i = 0; i < thirdPartyFolders.length - 1; i++) {
                        folder = thirdPartyFolders[i];
                        message += '`' + folder + '`, ';
                    }
                    message += 'or `' + thirdPartyFolders[thirdPartyFolders.length - 1] + '`';
            }
            message += thirdPartyMessage2;

            template = handlebars.compile(message);
            finalMessage = template({
                licenseMarkdownLink: licenseMarkdownLink,
                signature: signature,
                project: project,
                changesMarkdownLink: changesMarkdownLink,
                guidelines: guidelines,
                user: user
            });

            prom = prom.then(requestPromise.post({
                uri: pullRequestCommentsUrl,
                headers: headers,
                body: {
                    body: finalMessage
                },
                json: true,
                resolveWithFullResponse: true
            }));
        }
        return prom;
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
    if (!defined(thirdPartyFolders) || thirdPartyFolders.length === 0) {
        return false;
    }
    for (var i = 0; i < files.length; i++) {
        for (var j = 0; j < thirdPartyFolders.length; j++) {
            var folder = thirdPartyFolders[j];
            dateLog(files[i] + folder);
            if (files[i].startsWith(folder)) {
                dateLog('File ' + files[i] + ' matched with third party folder ' + folder);
                return true;
            }
        }
    }
    dateLog('No files matched with third party folders');
    return false;
};
