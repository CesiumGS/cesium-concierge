'use strict';

var Cesium = require('cesium');
var nconf = require('nconf');
var Promise = require('bluebird');

var defined = Cesium.defined;

var parseBoolean = require('./parseBoolean');

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

        var checkChangesMd = repositorySettings.checkChangesMd;
        var remindForum = repositorySettings.remindForum;
        repositorySettings.checkChangesMd = defined(checkChangesMd) ? parseBoolean(checkChangesMd) : true;
        repositorySettings.remindForum = defined(remindForum) ? parseBoolean(remindForum) : true;

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
            return nconf.get('repositories');
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
