'use strict';

var bodyParser = require('body-parser');
var express = require('express');

var checkWebHook = require('./lib/checkWebHook');
var dateLog = require('./lib/dateLog');
var postToGitHub = require('./lib/postToGitHub');
var Settings = require('./lib/Settings');

Settings.loadRepositoriesSettings('./config.json')
    .then(function () {
        dateLog('Loaded settings successfully');

        var app = express();
        app.post(Settings.listenPath, bodyParser.json(), checkWebHook, postToGitHub);

        // Start server on port specified by env.PORT
        app.listen(Settings.port, function () {
            dateLog('cesium-concierge listening on port ' + Settings.port);
        });
    })
    .catch(function (err) {
        dateLog('Could not parse environment settings: ' + err);
        process.exit(1);
    });
