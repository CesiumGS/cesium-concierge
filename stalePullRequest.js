'use strict';

var requestPromise = require('request-promise');

var dateLog = require('./lib/dateLog');
// var checkStatus = require('...');
var Settings = require('./lib/Settings');

var url;
var headers = {
    'User-Agent': 'cesium-concierge',
    Authorization: 'token ' //+ Settings.repositories[repositoryName].gitHubToken
};


Settings.loadRepositoriesSettings('./config.json')
.then(function (repositoryNames) {
    repositoryNames.foreach(function(repositoryName) {
        if (!Settings.repositories[repositoryName].bumpStalePullRequests) {
            dateLog('Repository ' + repositoryName + ' does not have `bumpStalePullRequests` turned on');
            return;
        }
        var url = Settings.repositories[repositoryName].pullRequestsUrl; // Alternatively, create URL based on `full_name` of repository?
        requestPromise.get({
            uri: url + '?sort=updated&direction=asc',
            headers: headers,
            json: true,
            resolveWithFullResponse: true
        })
        .then(function (jsonResponse) {
            // return checkStatus
        })
        .then(function (jsonResponse) {
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
        })
        .catch(function (err) {
            dateLog('Promise failed with: ' + err);
        });
    });
})
.catch(function (err) {
    dateLog('Settings did not load: ' + err);
});
