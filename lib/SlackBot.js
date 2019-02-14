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
var moment = require('moment');
var defined = Cesium.defined;

var dateLog = require('./dateLog');

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
  if (!defined(this._token)) {
    dateLog('No Slack token found. SlackBot is disabled.');
    this._isDisabled = true;
    return;
  }

  this._slackClient = new WebClient(this._token);

  // Authenticate using the first token found.
  this._authenticateGitHub();

  this._readyPromise = this._getSlackMetadata()
    .catch(function(error) {
      dateLog('SlackBot._getSlackMetadata failed. SlackBot is disabled. ' + error);
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
  var releaseReminder = schedule.scheduleJob('0 8 * * *', function(){
    that._sendReleaseReminders().catch(console.error);
  });

  // Set up weekly Slack message every Friday morning.
  var weeklyStats = schedule.scheduleJob('0 8 * * FRI', function(){
    that._sendWeeklyStats().catch(console.error);
  });

  return {
    releaseReminder: releaseReminder,
    weeklyStats: weeklyStats
  };
};

/** Post a message to a Slack user or channel as the Concierge bot.
 *
 * @param {String} channelId A channel/user ID to post to. See SlackBot._getSlackMetadata for how these are stored.
 * @param {String} message The message to post.
 *
 * @return {Promise<Object | String>} Slack API response or error otherwise.
 *
 */
SlackBot.postMessage = function(channelId, message) {
  if (this._isDisabled) {
    return Promise.resolve('Warning: SlackBot is disabled.');
  }

  var that = this;

  return this._readyPromise
    .then(function () {
      return that._slackClient.chat.postMessage({
        channel: channelId,
        text: message,
        as_user: true
      });
    });
};

SlackBot._getAllIssuesLastWeek = function(repositoryNames, octokitReference) {
  // octokitReference makes it easier to test this function by passing in a stubbed version of the library.
  // Given a list of repository names, return a list of promises that resolve to
  // a list of all closed issues/PR's last week.
  var promisesArray = [];
  for (var i = 0; i < repositoryNames.length; ++i) {
      var nameSplit = repositoryNames[i].split('/');
      var owner = nameSplit[0];
      var repo = nameSplit[1];
      // Get all closed issues/PRs for this repo for last week.
      var lastWeek = moment().subtract(7, 'days');
      var options = octokitReference.issues.listForRepo.endpoint.merge({
        owner: owner,
        repo: repo,
        since: lastWeek.format(),
        state: 'closed'
      });
      promisesArray.push(octokitReference.paginate(options));
  }

  return Promise.all(promisesArray)
    .then(function(listsOfIssues) {
      // Since the GitHub API returns anything created or updated last week,
      // we remove anything whose closed_at date is older than a week.
      var filteredList = [];
      var today = moment().startOf('day');

      for(var i = 0; i < listsOfIssues.length; ++i) {
        var newList = [];
        for (var j = 0; j < listsOfIssues[i].length; ++j) {
          var issue = listsOfIssues[i][j];
          var closedTime = moment(issue.closed_at);
          if (today.diff(closedTime, 'days') <= 7) {
            newList.push(issue);
          }
        }

        filteredList.push(newList);
      }

      return filteredList;
    });
};

SlackBot._sendWeeklyStats = function() {
    var repositoryNames = Object.keys(this._repositories);
    var issuePromises = this._getAllIssuesLastWeek(repositoryNames, octokit);

    var longestMergeTime = 0;
    var longestPullRequest;
    var mergeTimes = [];
    var that = this;

    // Each promise here is a list of issues from one repository.
    return Promise.each(issuePromises, function(issues) {
      issues.forEach(function(issue) {
        if (defined(issue.pull_request)) {
          var endTime = moment(issue.closed_at);
          var startTime = moment(issue.created_at);
          var daysDifference = endTime.diff(startTime, 'days');
          mergeTimes.push(daysDifference);

          if (!defined(longestPullRequest) || daysDifference > longestMergeTime) {
            longestPullRequest = issue;
            longestMergeTime = daysDifference;
          }
        }
      });
    })
    .then(function() {
      return that._getConfig();
    })
    .then(function(slackBotSettings) {
      var greetings = slackBotSettings.greetings;
      if (!defined(greetings)) {
        greetings = ['Happy Friday everyone!'];
      }

      var averageMergeTime = getAverage(mergeTimes).toFixed(1);
      longestMergeTime = longestMergeTime.toFixed(1);

      // Compute the standard deviation. If the longest merge time is more than 3 times that, report is as unusual.
      var deviation = getStandardDeviation(mergeTimes);
      var longMergeTitle;

      if (Math.abs(longestMergeTime - averageMergeTime) >= deviation * 2) {
        longMergeTitle = longestPullRequest.title;
      }

      var greeting = greetings[Math.floor(Math.random() * greetings.length)];
      var templateName = 'weeklyStats';
      var template = fs.readFileSync(path.join(__dirname, 'templates', templateName + '.hbs')).toString();

      var messageText = handlebars.compile(template)({
        greeting : greeting,
        averageMergeTime : averageMergeTime,
        numberOfPullRequests : mergeTimes.length,
        longMergeTitle : longMergeTitle,
        longMergeTime : longestMergeTime,
        longMergeURL : longestPullRequest.html_url
      });

      return that.postMessage(that._channelIDs['general'], messageText);
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
          var today = moment().startOf('day');
          var days = today.diff(releaseSchedule[user], 'days');
          var templateName;

          if (days === -14) {
            templateName = 'releaseReminderEarly';
          } else if (days === -7) {
            templateName = 'releaseReminder';
          } else if (days === 0) {
            templateName = 'releaseReminderLate';
          }

          if (defined(templateName)) {
            var userObject = that._userData[that._userIDs[user]];
            var name = userObject.display_name;
            if (!defined(name) || name.length === 0) {
              name = userObject.real_name;
            }
            var template = fs.readFileSync(path.join(__dirname, 'templates', templateName + '.hbs')).toString();
            var messageText = handlebars.compile(template)({
              name : name
            });

            return that.postMessage(that._userIDs[user], messageText);
          }
        }
      }
    });
};

// Read the release schedule from the config YAML file.
SlackBot._getConfig = function() {
  var configUrl = this._configUrl;

  if (this._isDisabled) {
    return Promise.resolve('Warning: SlackBot is disabled.');
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
      return Promise.resolve('Warning: Could not find config file.');
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
            var date = moment(yamlSchedule[user], 'MM/DD/YYYY').startOf('day');
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
  return this._getAllChannels()
    .then(function(channels) {
      channels.forEach(function(channel) {
        that._channelIDs[channel.name] = channel.id;
      });
    })
    .then(function() {
      return that._getAllUsers();
    })
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

function getStandardDeviation(values){
  var average = getAverage(values);

  var squaredDifferences = values.map(function(value){
    return Math.pow(value - average, 2);
  });

  var averageSquaredDifference = getAverage(squaredDifferences);

  var standardDeviation = Math.sqrt(averageSquaredDifference);
  return standardDeviation;
}

function getAverage(data){
  var sum = data.reduce(function(sum, value){
    return sum + value;
  }, 0);

  var average = sum / data.length;
  return average;
}

module.exports = SlackBot;