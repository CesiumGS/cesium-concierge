'use strict';

const Cesium = require('cesium');
const nconf = require('nconf');
const Promise = require('bluebird');
const fsExtra = require('fs-extra');
const googleapis = require('googleapis');

const loadRepoConfig = require('./loadRepoConfig');
const RepositorySettings = require('./RepositorySettings');

const defined = Cesium.defined;

const Settings = {};

const repositories = {};

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

    if (!defined(nconf.get('secret'))) {
      return Promise.reject('`secret` key must be defined');
    }
    const configJson = nconf.get('repositories');
    if (!defined(configJson)) {
      return Promise.reject('`repositories` key must be defined');
    }
    const repositoryNames = Object.keys(configJson);
    if (repositoryNames.length === 0) {
      return Promise.reject('`repositories` must be non-empty');
    }

    return Promise.each(repositoryNames, function (name) {
        if (!/\//.test(name)) {
            return Promise.reject(`repository ${  name  } must be in the form {user}/{repository}`);
        }

        const repositorySettings = configJson[name];
        if (!defined(repositorySettings.gitHubToken)) {
            return Promise.reject(`repository ${  name  } must have a \`gitHubToken\``);
        }

        repositorySettings.name = name;

        return loadRepoConfig(name, {
            'User-Agent': 'cesium-concierge',
            Authorization: `token ${  repositorySettings.gitHubToken}`
        }, repositorySettings).then(function (settings) {
            repositories[name] = new RepositorySettings(settings);
        });
    }).then(setupGoogleAPI);
};

/** This function reads the Google API config and initializes the client library.
 * It writes the configuration in a GoogleConfig.json, because the Google client expects
 * the config to be in a file.
 *
 * @return {Promise<Object>} Returns an instance to the Google Sheets API client.
 */
function setupGoogleAPI() {
    if (!defined(Settings.googleApiConfig) || !defined(Settings.individualClaSheetID) || !defined(Settings.individualClaSheetID)) {
        return;
    }

    const googleConfigFilePath = 'GoogleConfig.json';
    fsExtra.writeFileSync(googleConfigFilePath, JSON.stringify(Settings.googleApiConfig));

    return googleapis.google.auth.getClient({
        keyFile: googleConfigFilePath,
        scopes: ['https://www.googleapis.com/auth/spreadsheets']
    }).then(function(client) {
        const sheetsClient = googleapis.google.sheets({ version:'v4', auth: client });
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
     * Google API config for reading the list of CLA signers from Google Sheets.
     * This is the content of the key file downloaded from the Google Cloud Platform service account.
     * See {@link https://cloud.google.com/docs/authentication/getting-started}
     *
     * @type {String}
     */
    googleApiConfig: {
        // eslint-disable-next-line getter-return
        get: function () {
            // The config is either coming from a config JSON file, in which case it's already an object.
            // Or it's coming from an environment variable, where it's a JSON string.
            const config = nconf.get('googleApiConfig');
            if (typeof config === 'object') {
                return config;
            } else if (typeof config === 'string') {
                return JSON.parse(config);
            }
        }
    },
    /**
     * The ID of the Google Sheet that contains the GitHub usernames of the CLA signers.
     * See the CLA Checking section in this project's README for details.
     * @memberOf Settings
     * @type {String}
     */
    individualClaSheetID: {
        get: function () {
            return nconf.get('individualClaSheetID');
        },
        configurable: true
    },
    /**
     * The ID of the Google Sheet that contains the GitHub usernames of the corporate CLA signers.
     * See the CLA Checking section in this project's README for details.
     * @memberOf Settings
     * @type {String}
     */
    corporateClaSheetID: {
        get: function () {
            return nconf.get('corporateClaSheetID');
        },
        configurable: true
    }
});

module.exports = Settings;
