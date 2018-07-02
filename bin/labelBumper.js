'use strict';

var Cesium = require('cesium');
var Promise = require('bluebird');
var requestPromise = require('request-promise');
var parseLink = require('parse-link-header');

var Settings = require('../lib/Settings');
var dateLog = require('../lib/dateLog');

module.exports = labelBumper;

if (require.main === module) {
    Settings.loadRepositoriesSettings('./config.json')
        .then(function () {
            return stalePullRequest(Settings.repositories);
        })
        .catch(function (err) {
            console.error(err);
        });
}

/**
 * TODO: Add description
 *
 * @param {Object} repositories The Settings.repositories object.
 * @returns {Promise} A promise that resolves when the process is complete.
 */
function labelBumper(repositories) {
    dateLog('Initiating `labelBumper` job.');
    return Promise.each(Object.keys(repositories), function (repositoryName) {
        var repositorySettings = repositories[repositoryName];
        return stalePullRequest._processRepository(repositoryName, repositorySettings)
            .catch(function (error) {
                //Eat the error here so that all repositories are processed.
                console.error(error);
            });
    });
}

/**
 * TODO: Add description
 *
 */
stalePullRequest._processRepository = function (repositoryName, repositorySettings) {
    // Check if repo has this setting defined 
        // Get all issues for this repo
            // Check if any of them have any of the labels 
                // Check number of days before beginning of month 
                    // Bump if not found stop comment
        // Get all PR's for this repo 
            // Check if any of them have any of the labels 
                // Check number of days before beginning of month 
                    // Bump if not found stop comment
};
