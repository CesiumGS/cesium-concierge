'use strict';

var Cesium = require('cesium');
var Promise = require('bluebird');
var requestPromise = require('request-promise');
var parseLink = require('parse-link-header');

var Settings = require('../lib/Settings');
var dateLog = require('../lib/dateLog');
var checkStopCondition = require('../lib/checkStopCondition');

module.exports = labelBumper;

if (require.main === module) {
    Settings.loadRepositoriesSettings('./config.json')
        .then(function () {
            return labelBumper(Settings.repositories);
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
        return labelBumper._processRepository(repositoryName, repositorySettings)
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
labelBumper._processRepository = function (repositoryName, repositorySettings) {
    var labelsToBump = repositorySettings.labelsToBump;
    if (Cesium.defined(labelsToBump)) {
        labelBumper._getAllIssuesWithLabels(repositoryName, repositorySettings)
        .then(function(issues) {
            return Promise.each(issues, function (issue) {
                var minLabel = labelBumper._getLabelWithMinDay(issue, labelsToBump);
                var daysToBump = labelsToBump[minLabel];
                var daysLeft = labelBumper.daysInCurrentMonth() - new Date().getDate(); 
                if (daysLeft <= daysToBump) {
                   return labelBumper._bump(issue, minLabel, repositorySettings);
                }
            }); 
        }); 
    }
    return Promise.resolve();
};

labelBumper._getAllIssuesWithLabels = function(repositoryName, repositorySettings) {
    var labelsToBump = repositorySettings.labelsToBump;
    var issues = [];

    function processPage(response) {
        var linkData = parseLink(response.headers.link);
        issues = issues.concat(response.body);
        // If we're at the last page
        if (!Cesium.defined(linkData) || !Cesium.defined(linkData.next)) {
            return Promise.resolve(issues);
        }
        // Otherwise, request the next page
        return requestPromise.get({
            url: linkData.next.url,
            headers: repositorySettings.headers,
            json: true,
            resolveWithFullResponse: true
        }).then(processPage);
    }

    return requestPromise.get({
        url: 'https://api.github.com/repos/' + repositoryName + '/issues?labels=' + Object.keys(labelsToBump).join(),
        headers: repositorySettings.headers,
        json: true,
        resolveWithFullResponse: true
    }).then(processPage);
}

labelBumper._getLabelWithMinDay = function(issue, labelsToBump) {
    var minDay;
    var label;
    for (var i = 0;i < issue.labels.length;i++) {
        var name = issue.labels[i].name;
        var day = labelsToBump[name];
        if (!Cesium.defined(minDay) || day < minDay) {
            minDay = day;
            label = name;
        }
    }
    return label;
}

labelBumper._getAllComments = function(issue, repositorySettings) {
    var comments = [];
    function processPage(response) {
        var linkData = parseLink(response.headers.link);
        comments = comments.concat(response.body);
        // If we're at the last page
        if (!Cesium.defined(linkData) || !Cesium.defined(linkData.next)) {
            return Promise.resolve(comments);
        }
        // Otherwise, request the next page
        return requestPromise.get({
            url: linkData.next.url,
            headers: repositorySettings.headers,
            json: true,
            resolveWithFullResponse: true
        }).then(processPage);
    }

    return requestPromise.get({
        url: issue.comments_url,
        headers: repositorySettings.headers,
        json: true,
        resolveWithFullResponse: true
    }).then(processPage);
}

labelBumper._bump = function(issue, minLabel, repositorySettings) {
    labelBumper._getAllComments(issue, repositorySettings)
    .then(function(comments) {
        var foundStop = checkStopCondition(comments);
        var template = repositorySettings.labelBumpTemplate;
        var isAlreadyBumped = labelBumper._isAlreadyBumped(comments, minLabel, template);
        if (!foundStop && !isAlreadyBumped) {
            return requestPromise.post({
                url: issue.comments_url,
                headers: repositorySettings.headers,
                body: {
                    body: template({
                        label: minLabel,
                        days: repositorySettings.labelsToBump[minLabel]
                    })
                },
                json: true
            });
        }
    });
}

labelBumper.daysInCurrentMonth = function() {
    var current = new Date();
    return new Date(current.getFullYear(), current.getMonth() + 1, 0).getDate();
};

labelBumper._isAlreadyBumped = function(comments, minLabel, template) {
    for (var i = 0;i < comments.length;i++) {
        var comment = comments[i];
        var daysBeforeRelease = labelBumper.daysInCurrentMonth() - new Date().getDate();
        if (comment.body === template({label: minLabel, days: daysBeforeRelease})) {
            return true;
        }
    }
    return false;
};