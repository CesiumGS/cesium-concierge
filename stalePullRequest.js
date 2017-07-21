'use strict';

var requestPromise = require('request-promise');
var Promise = require('bluebird');

var dateLog = require('./lib/dateLog');
// var statusCode = require('...');
var Settings = require('./lib/Settings');

var url;
var headers = {
    'User-Agent': 'cesium-concierge',
    Authorization: 'token ' //+ Settings.repositories[repositoryName].gitHubToken
};


Settings.loadRepositoriesSettings('./config.json')
.then(function (repositoryNames) {
    var promises = [];
    repositoryNames.foreach(function(repositoryName) {
        if (!Settings.repositories[repositoryName].bumpStalePullRequests) {
            dateLog('Repository ' + repositoryName + ' does not have `bumpStalePullRequests` turned on');
            return;
        }
        var url = Settings.repositories[repositoryName].pullRequestsUrl; // Alternatively, create URL based on `full_name` of repository?
        promises.push(requestPromise.get({
            uri: url + '?sort=updated&direction=asc',
            headers: headers,
            json: true,
            resolveWithFullResponse: true
        })
        .then(function (jsonResponse) {
            if (jsonResponse.statusCode !== 200) {
                return Promise.reject('');
            }
            var message = 'It looks like this pull request hasn\'t been updated in a while!\n' +
                'Make sure to updated it soon or close it! :smile:';

            return requestPromise.post({
                uri: url + '/comments',
                headers: headers,
                body: {
                    body: message
                },
                json: true,
                resolveWithFullResponse: true
            });
        })
        .then(function (response) {
            dateLog('GitHub returned with code: ' + response.statusCode);
            dateLog('Received response from GitHub: ' + response.body);
        }));
    });
    return promises;
})
.then(function(promises) {
    // Not using Promise.all because it will fail if ANY fail.
    // This is probably wrong
    promises.forEach(function (promise) {
        promise.catch(function (err) {
            dateLog('Promise failed with: ' + err);
        });
    });
})
.catch(function (err) {
    dateLog('Settings did not load: ' + err);
});
