'use strict';

var Cesium = require('cesium');
var requestPromise = require('request-promise');

var defined = Cesium.defined;

var dateLog = require('./lib/dateLog');
var checkStatus = require('./lib/checkStatus');
var Settings = require('./lib/Settings');

Settings.loadRepositoriesSettings('./config.json')
.then(function (repositoryNames) {
    repositoryNames.foreach(function(repositoryName) {
        var headers = {
            'User-Agent': 'cesium-concierge',
            Authorization: 'token ' + Settings.repositories[repositoryName].gitHubToken
        };

        var bumpStalePullRequests = Settings.repositories[repositoryName].bumpStalePullRequests;
        if (!defined(bumpStalePullRequests)) {
            dateLog('Repository ' + repositoryName + ' does not have `bumpStalePullRequests` turned on');
            return;
        }

        var pullRequestsUrl = bumpStalePullRequests.url;
        pullRequestsUrl += '?sort=updated&direction=asc';
        requestPromise.get({
            uri: pullRequestsUrl,
            headers: headers,
            json: true,
            resolveWithFullResponse: true
        })
        .then(function (jsonResponse) {
            return checkStatus(jsonResponse);
        })
        .then(function (jsonResponse) {
            var promises = [];
            var message = 'It looks like this pull request hasn\'t been updated in a while!\n' +
                'Make sure to updated it soon or close it!';
            for (var i = 0; i < jsonResponse.body.length; i++) {
                var pullRequest = jsonResponse.body[i];
                var lastUpdate = new Date(pullRequest.updated_at);
                lastUpdate.setMonth(lastUpdate.getMonth() + 1);
                if (lastUpdate < Date.now()) {
                    promises.push(requestPromise.post({
                        uri: pullRequest.comments_url,
                        headers: headers,
                        body: {
                            body: message
                        },
                        json: true,
                        resolveWithFullResponse: true
                    }));
                }
            }
        })
        .then(function (response) {
            dateLog('GitHub returned with code: ' + response.statusCode);
            dateLog('Received response from GitHub: ' + response.body);
        })
        .catch(function (err) {
            dateLog('Promise failed with: ' + err);
        });
    });
})
.catch(function (err) {
    dateLog('Settings did not load: ' + err);
});
