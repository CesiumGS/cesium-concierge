'use strict';

var WebClient = require('@slack/client').WebClient;
var YAML = require('yaml');
var requestPromise = require('request-promise');
var schedule = require('node-schedule');
var Cesium = require('cesium');
var Promise = require('bluebird');
var fs = require('fs');
var handlebars = require('handlebars');
var path = require('path');
var defined = Cesium.defined;

var dateLog = require('./dateLog');
var daysSince = require('./daysSince');
var Settings = require('./Settings');

var web;
var userIDs = {};
var userData = {};
var channelIDs = {};
var releaseSchedule = {};

var SlackBot = {};

var repoNameRegex = /repos\/([\w-]+\/[\w-]+)/;

SlackBot.init = function(options) {
  this._token = options.token;
  this._configUrl = options.configUrl;
  if (!defined(this._token)) {
    dateLog('No Slack token found. SlackBot is disabled.');
    return;
  }

  // Initialize the web client.
  web = new WebClient(this._token);
  // Request and save the user ID's and channel ID's for subsequent calls to the Slack API.
  // This returns a promise, so if you wanted to just send a message to a particular user
  // you would do:
  //
  // var that = this;
  // this.getSlackMetaData()
  // .then(function(){
  //   that.postMessage(userIDs['oshehata'], 'Hello ' + userData[userIDs['oshehata']].real_name);
  // });
  //
  // Which would print 'Hello Omar Shehata' to @oshehata.
  this.getSlackMetadata();

  this.setupReleaseReminders();
  this.setupWeeklyStats();
};

SlackBot.setupWeeklyStats = function() {
  schedule.scheduleJob('0 8 * * FRI', function(){
      /*
      - Get all PRs
      - Compute resolution time
      - Get all issues, see how many bugs
      */
      console.log('Friday morning reminder');
  });
};

SlackBot.setupReleaseReminders = function() {
  var that = this;
  // Set up the release reminders check every morning at 8 am.
  schedule.scheduleJob('0 8 * * *', function(){
      // Update config before we post any reminders,
      // that way, we can update the config and the bot will always have the latest copy.
      that.getConfig(that._configUrl)
      .then(function() {
        for (var user in releaseSchedule) {
          if (releaseSchedule.hasOwnProperty(user)) {
            var days = Math.floor(daysSince(releaseSchedule[user]));
            var templateName;

            if (days === -14) {
              templateName = 'releaseReminderEarly';
            } else if (days === -7) {
              templateName = 'releaseReminder';
            } else if (days === -1) {
              templateName = 'releaseReminderLate';
            }

            if (defined(templateName)) {
              var userObject = userData[userIDs[user]];
              var firstName = userObject.real_name.split(' ')[0];
              var template = fs.readFileSync(path.join(__dirname, 'templates', templateName + '.hbs')).toString();
              var messageText = handlebars.compile(template)({
                name : firstName
              });

              that.postMessage(userIDs[user], messageText);
            }
          }
        }
      });
  });
};

SlackBot.postMessage = function(ID, message) {
  if (!defined(this._token)) {
    return;
  }

  var param = {
    channel: ID,
    text: message,
    as_user: true
  };
  web.chat.postMessage(param)
  .catch(console.error);
};

SlackBot.getConfig = function(configUrl) {
  if (!defined(this._repoName)) {
    // If we find a config url but no token for that repo, print a warning.
    var matchResults = configUrl.match(repoNameRegex);
    var repoName;
    if (defined(matchResults)) {
      repoName = matchResults[1];
    }

    if (!defined(repoName) || !defined(Settings.repositories[repoName])) {
      dateLog('Config file is hosted on ' + repoName + ' but no GitHub token found for this repo! SlackBot is disabled.');
      this._repoName = -1;
    } else {
      this._repoName = repoName;
    }
  }

  if (this._repoName === -1) {
    return Promise.resolve();
  }

  var settings = Settings.repositories[this._repoName];

  return requestPromise.get({
        url: configUrl,
        headers: settings.headers,
        json: true
    })
    .then(function (response) {
        var content = Buffer.from(response.content, 'base64').toString();

        var configData = YAML.parse(content);
        var yamlSchedule = configData['release-schedule'];
        releaseSchedule = {};

        for (var user in yamlSchedule) {
          if (yamlSchedule.hasOwnProperty(user)) {
            var date = stringToDate(yamlSchedule[user], 'MM/dd/yyyy', '/');
            releaseSchedule[user] = date;
          }
        }
    });
};

SlackBot.getSlackMetadata = function() {
  return getAllChannels()
  .then(function(channels) {
    channels.forEach(function(channel) {
      channelIDs[channel.name] = channel.id;
    });
  })
  .then(function(){ return getAllUsers(); })
  .then(function(members) {
    members.forEach(function(member) {
      userIDs[member.name] = member.id;
      userData[member.id] = member;
    });
  })
  .catch(function(error) {
    console.log(error);
  });
};

function getAllChannels() {
  var param = {
    exclude_archived: true,
    types: 'public_channel',
    limit: 100
  };
  return web.conversations.list(param)
  .then(function(results) {
    return results.channels;
  });
}

function getAllUsers() {
  return web.users.list()
  .then(function(results) {
    return results.members;
  });
}

function stringToDate(date, format, delimeter) {
  // from https://stackoverflow.com/a/25961926/1278023
  var formatLowerCase= format.toLowerCase();
  var formatItems= formatLowerCase.split( delimeter);
  var dateItems= date.split( delimeter);
  var monthIndex= formatItems.indexOf('mm');
  var dayIndex= formatItems.indexOf('dd');
  var yearIndex= formatItems.indexOf('yyyy');
  var month= parseInt(dateItems[monthIndex]);
  month -= 1;
  var formatedDate = new Date(dateItems[yearIndex],month,dateItems[dayIndex]);
  return formatedDate;
}

module.exports = SlackBot;