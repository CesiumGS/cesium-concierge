'use strict';
const path = require('path');

const Cesium = require('cesium');
const Promise = require('bluebird');
const requestPromise = require('request-promise');

const Check = Cesium.Check;

module.exports = loadRepoConfig;

/**
 * Loads any additional repository settings configuration or templates from the specified repository.
 *
 * @param {String} repositoryName The GitHub repository full name.
 * @param {Object} headers The headers to supply to the request.
 * @param {Object} config The default configuration settings to fall back on.
 * @returns {Promise<Object|String>} A Promise that resolves with the new configuration, or the error message if the Promise fails.
 */
function loadRepoConfig(repositoryName, headers, config) {
    Check.typeOf.string('repositoryName', repositoryName);
    Check.typeOf.object('headers', headers);
    Check.typeOf.object('config', config);

    const configUrl = new URL(path.join(repositoryName, 'contents', loadRepoConfig._configDirectory), 'https://api.github.com/repos/').href;

    return loadRepoConfig._getConfig(configUrl, headers, config)
        .then(function () {
            return loadRepoConfig._getTemplates(configUrl, headers, config);
        });
}

loadRepoConfig._configDirectory = '.concierge/';
loadRepoConfig._configFile = 'config.json';
loadRepoConfig._templateDirectory = 'templates/';

loadRepoConfig._getConfig = function (configUrl, headers, config) {
    const url = new URL(loadRepoConfig._configFile, configUrl).href;
    return requestPromise.get({
            url: url,
            headers: headers,
            json: true
        })
        .then(function (response) {
            const content = Buffer.from(response.content, 'base64').toString();
            const repoConfig = JSON.parse(content);

            for (const key in repoConfig) {
                if (repoConfig.hasOwnProperty(key)) {
                    config[key] = repoConfig[key];
                }
            }

            return config;
        })
        .catch(function (error) {
            return catchNotFound(error, config);
        });
};

loadRepoConfig._getTemplates = function (configUrl, headers, config) {
    return requestPromise.get({
            url: new URL(loadRepoConfig._templateDirectory, configUrl).href,
            headers: headers,
            json: true
        })
        .then(function (response) {
            return Promise.each(response, function (template) {
                if (path.extname(template.name) === '.hbs') {
                    const property = `${path.basename(template.name, '.hbs')  }Template`;
                    return loadRepoConfig._getTemplate(template.url, headers).then(function (content) {
                        config[property] = content;
                    });
                }
            }).then(function () {
                return config;
            });
        })
        .catch(function (error) {
            return catchNotFound(error, config);
        });
};

loadRepoConfig._getTemplate = function (url, headers) {
    return requestPromise.get({
            url: url,
            headers: headers,
            json: true
        })
        .then(function (response) {
            return Buffer.from(response.content, response.encoding)
                .toString('ascii');
        });
};

function catchNotFound(error, config) {
    if (error.statusCode === 404) {
        // No config file present, return default configuration
        return config;
    }

    return Promise.reject(error);
}