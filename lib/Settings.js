'use strict';

var Cesium = require('cesium');
var fsExtra = require('fs-extra');
var nconf = require('nconf');
var Promise = require('bluebird');

var defined = Cesium.defined;

var Settings = {};
/** Check for necessary settings in `configPath` file and initialize `nconf`
 *
 * @param {String} configPath Path to configuration file (usually `./config.json`)
 * @return {Promise<String | undefined>} Error message if Promise fails
 */
Settings.loadRepositoriesSettings = function (configPath) {
    Settings._repositories = [];
    nconf.env('__')
        .file({
            file: configPath
        })
        .defaults({
            port: 5000,
            listenPath: '/'
        })
        .required([
            'secret',
            'repositories'
        ]);

    return fsExtra.readJson(configPath)
        .then(function (configJson) {
            var repositoryNames;
            var name;
            repositoryNames = Object.keys(configJson['repositories']);
            if (repositoryNames.length === 0) {
                return Promise.reject(configPath + ' requires `repositories` be non-empty');
            }
            for (var i = 0; i < repositoryNames.length; i++) {
                name = repositoryNames[i];
                if (!defined(configJson['repositories'][name]['gitHubToken'])) {
                    return Promise.reject('Repository ' + name + ' must have a `gitHubToken`');
                }
                Settings._repositories.push(name);
            }
        });
};

/** Get `key` specific to `repositoryName`
 *
 * @param {String} repositoryName Repository name
 * @param {String} key Key to search for
 * @return {*} Value
 */
Settings.get = function (repositoryName, key) {
    return nconf.get(['repositories', repositoryName, key].join(':'));
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
    /** Names of repositories set in `config.json`
     * @memberOf Settings
     * @type {String[]}
     */
    repositories: {
        get: function () {
            return Settings._repositories;
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
