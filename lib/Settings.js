'use strict';

var Cesium = require('cesium');
var nconf = require('nconf');
var Promise = require('bluebird');

var defined = Cesium.defined;

var Settings = {};
/** Check for necessary settings in `configPath` file and initialize `nconf`
 *
 * @param {String} configPath Path to configuration file (usually `./config.json`)
 * @return {Promise<String[] | String>} Repository names or Error message if Promise fails
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
        return Promise.reject('`repositories` be non-empty');
    }
    for (var i = 0; i < repositoryNames.length; i++) {
        name = repositoryNames[i];

        if (!defined(configJson[name]['gitHubToken'])) {
            return Promise.reject('repository ' + name + ' must have a `gitHubToken`');
        }

        thirdPartyFolders = configJson[name]['thirdPartyFolders'];
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
            configJson[name]['thirdPartyFolders'] = thirdPartyFoldersArray;
        }

        var bumpStalePullRequests = configJson[name]['bumpStalePullRequests'];
        if (defined(bumpStalePullRequests)) {
            if (!defined(bumpStalePullRequests.url)) {
                return Promise.reject('bumpStalePullRequests needs `url` key');
            }
        }
    }
    return Promise.resolve(repositoryNames);
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
