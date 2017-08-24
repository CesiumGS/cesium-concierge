'use strict';

var Cesium = require('cesium');
var fs = require('fs');
var handlebars = require('handlebars');
var path = require('path');

var defined = Cesium.defined;
var defaultValue = Cesium.defaultValue;

module.exports = RepositorySettings;

var defaultInitialStalePullRequest = fs.readFileSync(path.join(__dirname, 'templates', 'initialStalePullRequest.hbs')).toString();
var defaultIssueClosed = fs.readFileSync(path.join(__dirname, 'templates', 'issueClosed.hbs')).toString();
var defaultPullRequestOpened = fs.readFileSync(path.join(__dirname, 'templates', 'pullRequestOpened.hbs')).toString();
var defaultSecondaryStalePullRequest = fs.readFileSync(path.join(__dirname, 'templates', 'secondaryStalePullRequest.hbs')).toString();
var defaultSignature = fs.readFileSync(path.join(__dirname, 'templates', 'signature.hbs')).toString();

/**
 * Encapsulate available options for each repository.
 * @param {Object} [options] The repository options, see below for full details.
 * @constructor
 */
function RepositorySettings(options) {

    options = defaultValue(options, defaultValue.EMPTY_OBJECT);

    var thirdPartyFolders = options.thirdPartyFolders;
    if (defined(thirdPartyFolders)) {
        var thirdPartyFoldersArray = thirdPartyFolders.split(',');
        for (var j = 0; j < thirdPartyFoldersArray.length; j++) {
            var folder = thirdPartyFoldersArray[j];
            if (folder.startsWith('/')) {
                thirdPartyFoldersArray[j] = folder.slice(1);
            }
            if (!folder.endsWith('/')) {
                thirdPartyFoldersArray[j] = folder + '/';
            }
        }
        thirdPartyFolders = thirdPartyFoldersArray;
    }

    var signature = '\n\n' + defaultValue(options.signature, defaultSignature);

    /**
     * Gets the headers to use for authenticated GitHub requests.
     * @type {Object}
     */
    this.headers = {
        'User-Agent': 'cesium-concierge',
        Authorization: 'token ' + options.gitHubToken
    };

    /**
     * Gets the access token for this repository.
     * @type {String}
     */
    this.gitHubToken = options.gitHubToken;

    /**
     * Gets the array of third party source files.
     */
    this.thirdPartyFolders = defaultValue(thirdPartyFolders, []);

    /**
     * Gets the handlebars template to use when commenting on a closed issue.
     */
    this.issueClosedTemplate = handlebars.compile(defaultValue(options.issueClosedTemplate, defaultIssueClosed) + signature);

    /**
     * Gets the handlebars template to use when commenting on a new pull request.
     */
    this.pullRequestOpenedTemplate = handlebars.compile(defaultValue(options.pullRequestOpenedTemplate, defaultPullRequestOpened) + signature);

    /**
     * Gets the handlebars template to use when commenting on a stale pull request for the first time.
     */
    this.initialStalePullRequestTemplate = handlebars.compile(defaultValue(options.initialStalePullRequestTemplate, defaultInitialStalePullRequest) + signature);

    /**
     * Gets the handlebars template to use when commenting on a stale pull request for the second time.
     */
    this.secondaryStalePullRequestTemplate = handlebars.compile(defaultValue(options.secondaryStalePullRequestTemplate, defaultSecondaryStalePullRequest) + signature);

    /**
     * Gets the amount of days before a pull request is considered stale.
     */
    this.maxDaysSinceUpdate = defaultValue(options.maxDaysSinceUpdate, 30);
}
