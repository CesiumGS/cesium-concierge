'use strict';

var Cesium = require('cesium');
var fsExtra = require('fs-extra');
var nconf = require('nconf');

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
    var repositoryJson;
    var name;
    repositoryJson = fsExtra.readJsonSync('repositories.json');
    if (!defined(repositoryJson) || !(repositoryJson instanceof Array)) {
        throw new Error('Must put at least one repository in `repositories.json` as Array');
    }
    Settings._repositories = [];
    repositoryJson.forEach(function(repository) {
        name = repository.name;
        if (!defined(name)) {
            throw new Error('Repository must have `name` field!');
        }
        if (!defined(repository.gitHubToken)) {
            throw new Error('Repository ' + name + ' must have a `gitHubToken`');
        }
        Settings._repositories.push(name);
        Settings.set(name, 'gitHubToken', repository.gitHubToken);
        Settings.set(name, 'remindForum', repository.remindForum);
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
