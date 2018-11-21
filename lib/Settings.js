'use strict';

var Cesium = require('cesium');
var nconf = require('nconf');
var Promise = require('bluebird');

var loadRepoConfig = require('./loadRepoConfig');
var RepositorySettings = require('./RepositorySettings');

var defined = Cesium.defined;

var Settings = {};

var repositories = {};

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
    var configJson;

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

    return Promise.each(repositoryNames, function (name) {
        if (!/\//.test(name)) {
            return Promise.reject('repository ' + name + ' must be in the form {user}/{repository}');
        }

        var repositorySettings = configJson[name];
        if (!defined(repositorySettings.gitHubToken)) {
            return Promise.reject('repository ' + name + ' must have a `gitHubToken`');
        }

        repositorySettings.name = name;

        return loadRepoConfig(name, {
            'User-Agent': 'cesium-concierge',
            Authorization: 'token ' + repositorySettings.gitHubToken
        }, repositorySettings).then(function (settings) {
            repositories[name] = new RepositorySettings(settings);
        });
    });
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
            return repositories;
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
    },
    /** Slack access token. If defined, concierge will post reminders and
     * fun stats to the Slack team.
     * @memberOf Settings
     * @type {String}
     */
    slackToken: {
        get: function () {
            return nconf.get('slackToken');
        }
    }
});

module.exports = Settings;
