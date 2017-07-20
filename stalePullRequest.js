'use strict';

var requestPromise = require('request-promise');
var Promise = require('bluebird');

var dateLog = require('./lib/dateLog');
// var statusCode = require('...');

var url;
var headers = {
    'User-Agent': 'cesium-concierge',
    Authorization: 'token ' //+ Settings.repositories[repositoryName].gitHubToken
};

requestPromise.get({
    uri: url + '?sort=updated&direction=asc',
    headers: headers,
    json: true,
    resolveWithFullResponse: true
})
.then(function (jsonResponse){
    if (jsonResponse.statusCode !== 200) {
        return Promise.reject('');
    }

})
.catch(function (err) {
    dateLog(err);
});
// Get Settings

