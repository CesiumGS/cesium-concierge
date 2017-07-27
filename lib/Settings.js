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
    var full_name;
    var short_name;
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
        full_name = repositoryNames[i];
        if (!/\//.test(full_name)) {
            return Promise.reject('repository ' + full_name + ' must be in the form {user}/{repository}');
        }
        // Modify repository names to be accessed by their short names
        short_name = full_name.split('/')[1];
        var tmp = configJson[full_name];
        configJson[short_name] = tmp;
        delete configJson[full_name];
        repositoryNames[i] = short_name;

        if (!defined(configJson[short_name]['gitHubToken'])) {
            return Promise.reject('repository ' + short_name + ' must have a `gitHubToken`');
        }

        thirdPartyFolders = configJson[short_name]['thirdPartyFolders'];
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
            configJson[short_name]['thirdPartyFolders'] = thirdPartyFoldersArray;
        }

        var bumpStalePullRequests = configJson[short_name]['bumpStalePullRequests'];
        if (defined(bumpStalePullRequests)) {
            configJson[short_name].bumpStalePullRequestsUrl = 'https://api.github.com/repos/' + full_name + '/pulls';
        }
    }
    nconf.set('repositories', configJson);
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
