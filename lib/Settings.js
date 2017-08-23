'use strict';

var Cesium = require('cesium');
var nconf = require('nconf');
var Promise = require('bluebird');

var defined = Cesium.defined;
var defaultValue = Cesium.defaultValue;

var Settings = {};
/** Check for necessary settings in `configPath` file and initialize `nconf`
 *
 * @param {String} configPath Path to configuration file (usually `./config.json`)
 * @return {Promise<undefined | String>} Error message if Promise fails
 */
Settings.loadRepositoriesSettings = function (configPath) {
    nconf.env('__')
        .file({
            file: configPath
        })
        .defaults({
            port: 5000,
            listenPath: '/'
        });

    var repositoryNames;
    var name;
    var configJson;
    var thirdPartyFolders = [];

    if (!defined(nconf.get('secret'))) {
        return Promise.reject('`secret` key must be defined');
    }
    configJson = nconf.get('repositories');
    if (!defined(configJson)) {
        return Promise.reject('`repositories` key must be defined');
    }
    repositoryNames = Object.keys(configJson);
    if (repositoryNames.length === 0) {
        return Promise.reject('`repositories` must be non-empty');
    }
    for (var i = 0; i < repositoryNames.length; i++) {
        name = repositoryNames[i];
        if (!/\//.test(name)) {
            return Promise.reject('repository ' + name + ' must be in the form {user}/{repository}');
        }
        var repositorySettings = configJson[name];
        if (!defined(repositorySettings.gitHubToken)) {
            return Promise.reject('repository ' + name + ' must have a `gitHubToken`');
        }

        thirdPartyFolders = repositorySettings.thirdPartyFolders;

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
            repositorySettings.thirdPartyFolders = thirdPartyFoldersArray;
        }
        if (defined(repositorySettings.bumpStalePullRequests)) {
            repositorySettings.bumpStalePullRequestsUrl = 'https://api.github.com/repos/' + name + '/pulls';
        }
    }
    return Promise.resolve();
};

Settings.getIssueClosedTemplate = function () {
    return 'Congratulations on closing the issue! I found these Cesium forum links in the comments above:\n' +
        '\n{{#each forum_links}}' +
        '{{ this }}\n' +
        '{{/each}}\n\n' +
        'If this issue affects any of these threads, please post a comment like the following:\n' +
        '> The issue at {{ html_url }} has just been closed and may resolve your issue. Look for the change in the' +
        'next stable release of Cesium or get it now in the master branch on GitHub https://github.com/AnalyticalGraphicsInc/cesium.' +
        '\n\n' +
        Settings.getSignature();
};

Settings.getPullRequestOpenedTemplate = function () {
    return '@{{ userName }}, thanks for the pull request!\n\n' +
        '{{#if askAboutChanges}}' +
        'I noticed that [CHANGES.md]({{ repository_url }}/blob/master/CHANGES.md) has not been updated. ' +
        'If this change updates the public API in any way, fixes a bug, or makes any non-trivial update, please add a bullet point to `CHANGES.md` and comment on this pull request so we know it was updated. ' +
        'For more info, see the [Pull Request Guidelines]( https://github.com/AnalyticalGraphicsInc/cesium/blob/master/CONTRIBUTING.md#pull-request-guidelines).\n\n' +
        '{{/if}}' +
        '{{#if askAboutThirdParty}}' +
        'I noticed that a file in one of our ThirdParty folders (`{{ thirdPartyFolders }}`) has been added or modified. ' +
        'Please verify that it has a section in [LICENSE.md]({{ repository_url }}/blob/master/LICENSE.md) ' +
        'and that its license information is up to date with this new version. Once you do, please confirm by commenting on this pull request.\n\n' +
        '{{/if}}' +
        Settings.getSignature();
};

Settings.getInitialStalePullRequestTemplate = function () {
    return 'Thanks again for the pull request!\n\n' +
        'I noticed that this pull request hasn\'t been commented on in {{ maxDaysSinceUpdate }} days. ' +
        'If it is waiting on a review or changes from a previous review, could someone please take a look?\n\n' +
        'If I don’t see a commit or comment in the next {{ maxDaysSinceUpdate }} days, we may want to close this pull request to keep things tidy.' +
        '\n\n' +
        Settings.getSignature();
};

Settings.getSecondaryStalePullRequestTemplate = function () {
    return 'Thanks again for the pull request!\n\n' +
        'Looks like this pull request hasn\'t been updated in {{ maxDaysSinceUpdate }} days since I last commented.\n\n' +
        'To keep things tidy should this be closed? Perhaps keep the branch and submit an issue?' +
        '\n\n' +
        Settings.getSignature();
};

Settings.getSignature = function () {
    return '__I am a bot who helps you make Cesium awesome!__ Thanks again.';
};

Settings.getThirdPartyFolders = function (repositoryName) {
    return defaultValue(Settings.repositories[repositoryName].thirdPartyFolders, []);
};

Object.defineProperties(Settings, {
    /** Path to listen on for incoming GitHub requests
     * @memberOf Settings
     * @type {String}
     */
    listenPath: {
        get: function () {
            return nconf.get('listenPath');
        }
    },
    /** Port to listen on for incoming GitHub requests
     * @memberOf Settings
     * @type {Number}
     */
    port: {
        get: function () {
            return parseInt(nconf.get('port'));
        }
    },
    /** Array of repository settings objects
     * @memberOf Settings
     * @type {Object[]}
     */
    repositories: {
        get: function () {
            return defaultValue(nconf.get('repositories'), {});
        }
    },
    /** Shared secret to verify incoming GitHub requests
     * @memberOf Settings
     * @type {String}
     */
    secret: {
        get: function () {
            return nconf.get('secret');
        }
    }
});

module.exports = Settings;
