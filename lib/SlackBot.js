'use strict';

var WebClient = require('@slack/client').WebClient;
var Octokit = require('@octokit/rest');
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
var SLACK_ANNOUNCEMENT_CHANNEL = 'engineering';

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
  this._githubClient = this._authenticateGitHub();

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

  return {
    releaseReminder: releaseReminder
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
        link_names: true,
        as_user: true
      });
    });
};

SlackBot._getAllPullRequestsMergedLastWeek = function(repositoryNames) {
  // Given a list of repository names, return a list of promises that resolve to
  // a list of all PR's merged last week.
  var pullRequests = [];
  var repositoryPromises = [];
  var that = this;
  var today = moment().startOf('day');

  function processRepositoryIssues(issue) {
    // Filter out issues that are not pull requests, and anything whose closed_at date is older than a week.
    var pullRequest = issue.pull_request;
    if (!defined(pullRequest)) {
      return;
    }

    var closedTime = moment(issue.closed_at);
    if (today.diff(closedTime, 'days') > 7) {
      return;
    }

    // Filter out anything that was not merged.
    var urlParts = pullRequest.url.replace('https://api.github.com/repos/', '').split('/');
    return that._githubClient.pulls.checkIfMerged({
      owner : urlParts[0],
      repo : urlParts[1],
      pull_number : urlParts[3]
    })
      .then(function(result) {
        if (result.status === 204) {
          pullRequests.push(issue);
        }
      })
      .catch(function() {
        // Will 404 if the PR wasn't merged.
      });
  }

  for (var i = 0; i < repositoryNames.length; ++i) {
      var nameSplit = repositoryNames[i].split('/');
      var owner = nameSplit[0];
      var repo = nameSplit[1];
      // Get all closed issues/PRs for this repo for last week.
      var lastWeek = moment().subtract(7, 'days');
      var options = this._githubClient.issues.listForRepo.endpoint.merge({
        owner: owner,
        repo: repo,
        since: lastWeek.format(),
        state: 'closed'
      });

      var repositoryIssuesPromise = Promise.each(this._githubClient.paginate(options), processRepositoryIssues);
      repositoryPromises.push(repositoryIssuesPromise);
  }

  return Promise.all(repositoryPromises)
    .then(function() {
      return pullRequests;
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
          // A user may have multiple release dates (if they are doing the release in January and in April for example).
          // We check all of them to send reminders.
          var userDates = releaseSchedule[user];
          for (var i = 0; i < userDates.length; i++) {
            var date = userDates[i];
            var today = moment().startOf('day');
            var days = today.diff(date, 'days');
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
              var userId = userObject.id;
              var template = fs.readFileSync(path.join(__dirname, 'templates', templateName + '.hbs')).toString();
              var messageText = handlebars.compile(template)({
                userId : '<@' + userId + '>'
              });

              return that.postMessage(that._channelIDs[SLACK_ANNOUNCEMENT_CHANNEL], messageText);
            }
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

        for (var i = 0; i < yamlSchedule.length; i++) {
          var row = yamlSchedule[i];
          var user = row.split(',')[0].trim();
          var dateString = row.split(',')[1].trim();

          var date = moment(dateString, 'MM/DD/YYYY').startOf('day');
          if (!defined(releaseSchedule[user])) {
            releaseSchedule[user] = [];
          }
          releaseSchedule[user].push(date);
        }

        var slackBotSettings = {
          releaseSchedule: releaseSchedule
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
  return new Octokit({
    auth: 'token ' + this._repositories[repositoryNames[0]].gitHubToken
  });
};

module.exports = SlackBot;
