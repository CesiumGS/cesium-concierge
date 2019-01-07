'use strict';

var WebClient = require('@slack/client').WebClient;
var octokit = require('@octokit/rest')();
var YAML = require('yaml');
var requestPromise = require('request-promise');
var schedule = require('node-schedule');
var Cesium = require('cesium');
var Promise = require('bluebird');
var fs = require('fs');
var handlebars = require('handlebars');
var path = require('path');
var defined = Cesium.defined;
var RuntimeError = Cesium.RuntimeError;

var dateLog = require('./dateLog');
var daysSince = require('./daysSince');

var SlackBot = {};

var repoNameRegex = /repos\/([\w-]+\/[\w-]+)/;

/** Fetches Slack metadata and authenticates with GitHub. Sets Slackbot.ready to true when done.
 *
 * @param {Object} options Object with the following properties:
 * @param {String} options.token A Slack API token. See this repository's README for instructions on obtaining one.
 * @param {String} options.configUrl The GitHub API URL to a YAML file containing the release schedule and other SlackBot config.
 * @param {Object[]} options.repositories Array of repository settings objects.
 *
 * @return {undefined}
 */
SlackBot.init = function(options) {
  this._token = options.token;
  this._configUrl = options.configUrl;
  this._repositories = options.repositories;
  this._isDisabled = false;
  this._userIDs = {};
  this._userData = {};
  this._channelIDs = {};
  this._ready = false;
  if (!defined(this._token)) {
    dateLog('No Slack token found. SlackBot is disabled.');
    this._isDisabled = true;
    return;
  }

  this._slackClient = new WebClient(this._token);

  // Authenticate using the first token found.
  this._authenticateGitHub();

  var that = this;
  this._getSlackMetadata()
    .then(function() {
      that._ready = true;
    })
    .catch(function(error) {
      dateLog('SlackBot._getSlackMetadata failed. SlackBot is disabled.' + error);
    });
};

/**
 * Sets up scheduled jobs, like weekly statistics and release reminders.
 *
 * @return {undefined}
 */
SlackBot.initializeScheduledJobs = function() {
  var that = this;

  // Set up the release reminders check every morning at 8 am.
  schedule.scheduleJob('0 8 * * *', function(){
    that._sendReleaseReminders();
  });

  // Set up weekly Slack message every Friday morning.
  schedule.scheduleJob('0 8 * * FRI', function(){
    that._sendWeeklyStats();
  });
};

/** Post a message to a Slack user or channel as the Concierge bot.
 * Must be called after Slack metadata resolves and SlackBot.ready is true.
 *
 * @param {String} ID A channel/user ID to post to. See SlackBot._getSlackMetadata for how these are stored.
 * @param {String} message The message to post.
 *
 * @exception {RuntimeError} Cannot post Slack message until _getSlackMetadata finishes resolving.
 *
 * @return {undefined}
 */
SlackBot.postMessage = function(ID, message) {
  if (this._isDisabled) {
    return;
  }

  if (!this._ready) {
    throw new RuntimeError('Cannot post Slack message until _getSlackMetadata finishes resolving.');
  }

  this._slackClient.chat.postMessage({
    channel: ID,
    text: message,
    as_user: true
  })
  .catch(console.error);
};

SlackBot._getAllIssuesLastWeek = function(repositoryNames) {
  // Given a list of repository names, return a list of promises that resolve to
  // a list of all closed issues/PR's last week.
  var promisesArray = [];
  for (var i = 0; i < repositoryNames.length; ++i) {
      var nameSplit = repositoryNames[i].split('/');
      var owner = nameSplit[0];
      var repo = nameSplit[1];
      // Get all closed issues/PRs for this repo for last week.
      var today = new Date();
      var lastWeek = new Date(today.getFullYear(), today.getMonth(), today.getDate() - 7);
      var options = octokit.issues.listForRepo.endpoint.merge({ owner: owner, repo: repo, since: lastWeek.toISOString(), state: 'closed' });
      promisesArray.push(octokit.paginate(options));
    }

  return promisesArray;
};

SlackBot._sendWeeklyStats = function() {
    var repositoryNames = Object.keys(this._repositories);
    var issuePromises = this._getAllIssuesLastWeek(repositoryNames);

    var longestMergeTime = 0;
    var longestPullRequest;
    var mergeTimes = [];
    var that = this;

    // Each promise here is a list of issues from one repository.
    return Promise.each(issuePromises, function(issues) {
      issues.forEach(function(issue) {
        if (defined(issue.pull_request)) {
          var endTime = new Date(issue.closed_at);
          var startTime = new Date(issue.created_at);
          var daysDifference = (endTime - startTime) / (24 * 60 * 60 * 1000);
          mergeTimes.push(daysDifference);

          if (!defined(longestPullRequest) || daysDifference > longestMergeTime) {
            longestPullRequest = issue;
            longestMergeTime = daysDifference;
          }
        }
      });
    }).then(that._getConfig)
      .then(function(slackBotSettings) {
        var greetings = slackBotSettings.greetings;
        if (!defined(greetings)) {
          greetings = ['Happy Friday everyone!'];
        }

        var averageMergeTime = average(mergeTimes).toFixed(1);
        longestMergeTime = longestMergeTime.toFixed(1);

        // Compute the standard deviation. If the longest merge time is more than 3 times that, report is as unusual.
        var unusuallyLongPRMessage = '';
        var deviation = standardDeviation(mergeTimes);

        if (Math.abs(longestMergeTime - averageMergeTime) >= deviation * 2) {
          unusuallyLongPRMessage = 'This PR (' + longestPullRequest.html_url + ') took an unusually long amount of time to get merged (' + longestMergeTime + ' days).';
        }

        var greeting = greetings[Math.floor(Math.random() * greetings.length)];
        var templateName = 'weeklyStats';
        var template = fs.readFileSync(path.join(__dirname, 'templates', templateName + '.hbs')).toString();

        var messageText = handlebars.compile(template)({
          greeting : greeting,
          averageMergeTime : averageMergeTime,
          numberOfPullRequests : mergeTimes.length,
          unusuallyLongPRMessage : unusuallyLongPRMessage
        });

        that.postMessage(that._channelIDs['general'], messageText);
      });
};

SlackBot._sendReleaseReminders = function() {
  // Update config before we post any reminders,
  // that way, we can update the config and the bot will always have the latest copy.
  var that = this;
  return this._getConfig()
  .then(function(slackBotSettings) {
    var releaseSchedule = slackBotSettings.releaseSchedule;
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
          var userObject = that._userData[that._userIDs[user]];
          var firstName = userObject.real_name.split(' ')[0];
          var template = fs.readFileSync(path.join(__dirname, 'templates', templateName + '.hbs')).toString();
          var messageText = handlebars.compile(template)({
            name : firstName
          });

          that.postMessage(that._userIDs[user], messageText);
        }
      }
    }
  });
};

// Read the release schedule from the config YAML file.
SlackBot._getConfig = function() {
  var configUrl = this._configUrl;

  if (this._isDisabled) {
    return Promise.resolve();
  }

  if (!defined(this._repoName)) {
    // If we find a config url but no token for that repo, print a warning.
    var matchResults = configUrl.match(repoNameRegex);
    var repoName;
    if (defined(matchResults)) {
      repoName = matchResults[1];
    }

    if (!defined(repoName) || !defined(this._repositories[repoName])) {
      dateLog('Config file is hosted on ' + repoName + ' but no GitHub token found for this repo! SlackBot is disabled.');
      this._isDisabled = true;
      return Promise.resolve();
    }

    this._repoName = repoName;
  }

  var settings = this._repositories[this._repoName];

  return requestPromise.get({
        url: configUrl,
        headers: settings.headers,
        json: true
    })
    .then(function (response) {
        var content = Buffer.from(response.content, 'base64').toString();

        var configData = YAML.parse(content);
        var yamlSchedule = configData['releaseSchedule'];
        var releaseSchedule = {};

        for (var user in yamlSchedule) {
          if (yamlSchedule.hasOwnProperty(user)) {
            var date = stringToDate(yamlSchedule[user], 'MM/dd/yyyy', '/');
            releaseSchedule[user] = date;
          }
        }

        var slackBotSettings = {
          releaseSchedule: releaseSchedule,
          greetings: configData['greetings']
        };

        return slackBotSettings;
    });
};

// Returns a promise that resolves after requesting  and saving
// the user ID's and channel ID's required for subsequent calls to the Slack API.
SlackBot._getSlackMetadata = function() {
  var that = this;

  return this.getAllChannels()
  .then(function(channels) {
    channels.forEach(function(channel) {
      that._channelIDs[channel.name] = channel.id;
    });
  })
  .then(this.getAllUsers)
  .then(function(members) {
    members.forEach(function(member) {
      that._userIDs[member.name] = member.id;
      that._userData[member.id] = member;
    });
  });
};

SlackBot._getAllChannels = function() {
  return this._slackClient.conversations.list({
    exclude_archived: true,
    types: 'public_channel',
    limit: 100
  }).then(function(results) {
    return results.channels;
  });
};

SlackBot._getAllUsers = function() {
  return this._slackClient.users.list()
    .then(function(results) {
      return results.members;
    });
};

SlackBot._authenticateGitHub = function() {
  var repositoryNames = Object.keys(this._repositories);
  octokit.authenticate({
    type: 'token',
    token: this._repositories[repositoryNames[0]].gitHubToken
  });
};


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

function standardDeviation(values){
  var avg = average(values);

  var squareDiffs = values.map(function(value){
    var diff = value - avg;
    var sqrDiff = diff * diff;
    return sqrDiff;
  });

  var avgSquareDiff = average(squareDiffs);

  var stdDev = Math.sqrt(avgSquareDiff);
  return stdDev;
}

function average(data){
  var sum = data.reduce(function(sum, value){
    return sum + value;
  }, 0);

  var avg = sum / data.length;
  return avg;
}

module.exports = SlackBot;