'use strict';

var Cesium = require('cesium');
var fsExtra = require('fs-extra');
var nconf = require('nconf');
var Promise = require('bluebird');

var defined = Cesium.defined;

var Settings = {};
Settings.loadRepositoriesSettings = function (configPath) {
    Settings._repositories = [];
    nconf.env('__')
        .file({
            file: configPath
        })
        .defaults({
            port: 5000,
            listenPath: '/'
        })
        .required([
            'secret',
            'repositories'
        ]);

    return fsExtra.readJson(configPath)
        .then(function (configJson) {
            var repositoryNames;
            var name;
            repositoryNames = Object.keys(configJson['repositories']);
            if (repositoryNames.length === 0) {
                return Promise.reject(configPath + ' requires `repositories` be non-empty');
            }
            for (var i = 0; i < repositoryNames.length; i++) {
                name = repositoryNames[i];
                if (!defined(configJson['repositories'][name]['gitHubToken'])) {
                    return Promise.reject('Repository ' + name + ' must have a `gitHubToken`');
                }
                Settings._repositories.push(name);
            }
        });
};

Settings.get = function (repositoryName, key) {
    return nconf.get(['repositories', repositoryName, key].join(':'));
};

Object.defineProperties(Settings, {
    listenPath: {
        get: function () {
            return nconf.get('listenPath');
        }
    },
    port: {
        get: function () {
            return parseInt(nconf.get('port'));
        }
    },
    repositories: {
        get: function () {
            return Settings._repositories;
        }
    },
    secret: {
        get: function () {
            return nconf.get('secret');
        }
    }
});

module.exports = Settings;
