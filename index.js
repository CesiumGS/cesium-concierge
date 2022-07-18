'use strict';

const bodyParser = require('body-parser');
const express = require('express');
const schedule = require('node-schedule');

const stalePullRequest = require('./lib/stalePullRequest');
const checkWebHook = require('./lib/checkWebHook');
const dateLog = require('./lib/dateLog');
const postToGitHub = require('./lib/postToGitHub');
const Settings = require('./lib/Settings');
const SlackBot = require('./lib/SlackBot');


Settings.loadRepositoriesSettings('./config.json')
    .then(function () {
        dateLog('Loaded settings successfully');

        const app = express();
        app.post(Settings.listenPath, bodyParser.json(), checkWebHook, postToGitHub);

        // Start server on port specified by env.PORT
        app.listen(Settings.port, function () {
            dateLog(`cesium-concierge listening on port ${  Settings.port}`);
        });

        // Run every night.
        schedule.scheduleJob('0 22 * * *', function () {
            stalePullRequest(Settings.repositories)
                .catch(function (err) {
                    console.error(err);
                });
        });

        SlackBot.init({
            token: Settings.slackToken,
            configUrl: Settings.slackConfigUrl,
            repositories: Settings.repositories
        });

        SlackBot.initializeScheduledJobs();
    })
    .catch(function (err) {
        dateLog(`Could not parse environment settings: ${  err}`);
        process.exit(1);
    });
