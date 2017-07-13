'use strict';

var Cesium = require('cesium');
var fsExtra = require('fs-extra');
var nconf = require('nconf');
var Promise = require('bluebird');

var defined = Cesium.defined;

nconf.env('__')
    .file({
        file: 'config.json'
    })
    .defaults({
        port: 5000,
        listenPath: '/'
    })
    .required([
        'secret',
        'repositories'
    ]);

var Settings = {};
Settings.loadRepositoriesSettings = function() {
    return fsExtra.readJson('config.json')
    .then(function(configJson) {
        if (!configJson.hasOwnProperty('repositories')) {
            return Promise.reject('config.json needs a `repositories` field');
        }
        configJson.repositories.keys.forEach(function(name) {
            if (!defined(name.gitHubToken)) {
                return Promise.reject('Repository ' + name + ' must have a `gitHubToken`');
            }
            Settings._repositories.push(name);
        });
    });
};

Settings.get = function(repositoryName, key) {
    return nconf.get(['repositories', repositoryName, key].join(':'));
};

Object.defineProperties(Settings, {
    port: {
        get: function() {
            return parseInt(nconf.get('port'));
        }
    },
    listenPath: {
        get: function() {
            return nconf.get('listenPath');
        }
    },
    repositories: {
        get: function() {
            return Settings._repositories;
        }
    }
});

module.exports = Settings;
