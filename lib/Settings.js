'use strict';

var Cesium = require('cesium');
var nconf = require('nconf');
var Promise = require('bluebird');
var fs = require('fs');
var googleapis = require('googleapis');

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
    }).then(setupGoogleAPI);
};

/** TODO
 *
 * @return {undefined}
 */
function setupGoogleAPI() {
    // Write the config to a file
    var googleConfigFilePath = 'GoogleConfig.json';
    fs.writeFileSync(googleConfigFilePath, JSON.stringify(Settings.googleApiConfig));
    return googleapis.google.auth.getClient({
        keyFile: googleConfigFilePath,
        scopes: ['https://www.googleapis.com/auth/spreadsheets']
    }).then(function(client) {
        var sheetsClient = googleapis.google.sheets({ version:'v4', auth: client });
        Settings.googleSheetsApi = sheetsClient;
        return sheetsClient;
    });
}

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
    },
    /** The GitHub API URL to a YAML file containing the release schedule
     * and other SlackBot config.
     * @memberOf Settings
     * @type {String}
     */
    slackConfigUrl: {
        get: function () {
            return nconf.get('slackConfigUrl');
        }
    },
    /**
     * TODO
     * @type {String}
     */
    googleApiConfig: {
        get: function () {
            // The config is either coming from a config JSON file, in which case it's already an object.
            // Or it's coming from an environment variable, where it's a JSON string.
            var config = nconf.get('googleApiConfig');
            if (typeof config === 'object') {
                return config;
            } else if (typeof config === 'string') {
                return JSON.parse(config);
            }
        }
    },
    /**
     * TODO
     * @type {String}
     */
    individualClaSheetID: {
        get: function () {
            return nconf.get('individualClaSheetID');
        }
    },
    /**
     * TODO
     * @type {String}
     */
    corporateClaSheetID: {
        get: function () {
            return nconf.get('corporateClaSheetID');
        }
    }
});

module.exports = Settings;
