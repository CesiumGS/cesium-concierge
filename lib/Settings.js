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
        'secret'
    ]);

var Settings = {};
Settings.loadRepositoriesSettings = function() {
    var name;
    return fsExtra.readJson('repositories.json')
    .then(function(repositoryJson) {
        if (!(repositoryJson instanceof Array)) {
            return Promise.reject('Must put at least one repository in `repositories.json` as Array');
        }
        Settings._repositories = [];
        repositoryJson.forEach(function(repository) {
            name = repository.name;
            if (!defined(name)) {
                return Promise.reject('Repository must have `name` field!');
            }
            if (!defined(repository.gitHubToken)) {
                return Promise.reject('Repository ' + name + ' must have a `gitHubToken`');
            }
            Settings._repositories.push(name);
            Settings.set(name, 'gitHubToken', repository.gitHubToken);
            Settings.set(name, 'remindForum', repository.remindForum);
        });
    });
};

Settings.set = function(repositoryName, key, value) {
    nconf.set(['repositories', repositoryName, key].join(':'), value);
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
