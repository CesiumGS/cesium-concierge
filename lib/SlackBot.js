'use strict';

const WebClient = require('@slack/client').WebClient;
const Octokit = require('@octokit/rest');
const YAML = require('yaml');
const requestPromise = require('request-promise');
const schedule = require('node-schedule');
const Cesium = require('cesium');
const Promise = require('bluebird');
const fs = require('fs');
const handlebars = require('handlebars');
const path = require('path');
const moment = require('moment');
const defined = Cesium.defined;

const dateLog = require('./dateLog');

const SlackBot = {};

const repoNameRegex = /repos\/([\w-]+\/[\w-]+)/;
const SLACK_ANNOUNCEMENT_CHANNEL = 'cesiumjs';

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
      dateLog(`SlackBot._getSlackMetadata failed. SlackBot is disabled. ${  error}`);
    });
};

/**
 * Sets up scheduled jobs, like weekly statistics and release reminders.
 *
 * @return {undefined}
 */
SlackBot.initializeScheduledJobs = function() {
  const that = this;

  // Set up the release reminders check every morning at 8 am.
  const releaseReminder = schedule.scheduleJob('0 8 * * *', function(){
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

  const that = this;

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
  const pullRequests = [];
  const repositoryPromises = [];
  const that = this;
  const today = moment().startOf('day');

  function processRepositoryIssues(issue) {
    // Filter out issues that are not pull requests, and anything whose closed_at date is older than a week.
    const pullRequest = issue.pull_request;
    if (!defined(pullRequest)) {
      return;
    }

    const closedTime = moment(issue.closed_at);
    if (today.diff(closedTime, 'days') > 7) {
      return;
    }

    // Filter out anything that was not merged.
    const urlParts = pullRequest.url.replace('https://api.github.com/repos/', '').split('/');
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

  for (let i = 0; i < repositoryNames.length; ++i) {
      const nameSplit = repositoryNames[i].split('/');
      const owner = nameSplit[0];
      const repo = nameSplit[1];
      // Get all closed issues/PRs for this repo for last week.
      const lastWeek = moment().subtract(7, 'days');
      const options = this._githubClient.issues.listForRepo.endpoint.merge({
        owner: owner,
        repo: repo,
        since: lastWeek.format(),
        state: 'closed'
      });

      const repositoryIssuesPromise = Promise.each(this._githubClient.paginate(options), processRepositoryIssues);
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
  const that = this;
  return this._getConfig()
    .then(function(slackBotSettings) {
      const releaseSchedule = slackBotSettings.releaseSchedule;
      for (const user in releaseSchedule) {
        if (releaseSchedule.hasOwnProperty(user)) {
          // A user may have multiple release dates (if they are doing the release in January and in April for example).
          // We check all of them to send reminders.
          const userDates = releaseSchedule[user];
          for (let i = 0; i < userDates.length; i++) {
            const date = userDates[i];
            const today = moment().startOf('day');
            const days = today.diff(date, 'days');
            let templateName;

            if (days === -14) {
              templateName = 'releaseReminderEarly';
            } else if (days === -7) {
              templateName = 'releaseReminder';
            } else if (days === 0) {
              templateName = 'releaseReminderLate';
            }

            if (defined(templateName)) {
              const userObject = that._userData[that._userIDs[user]];
              const userId = userObject.id;
              const template = fs.readFileSync(path.join(__dirname, 'templates', `${templateName  }.hbs`)).toString();
              const messageText = handlebars.compile(template)({
                userId : `<@${  userId  }>`
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
  const configUrl = this._configUrl;

  if (this._isDisabled) {
    return Promise.resolve('Warning: SlackBot is disabled.');
  }
  if (!defined(this._repoName)) {
    // If we find a config url but no token for that repo, print a warning.
    const matchResults = configUrl.match(repoNameRegex);
    let repoName;
    if (defined(matchResults)) {
      repoName = matchResults[1];
    }

    if (!defined(repoName) || !defined(this._repositories[repoName])) {
      dateLog(`Config file is hosted on ${  repoName  } but no GitHub token found for this repo! SlackBot is disabled.`);
      this._isDisabled = true;
      return Promise.resolve('Warning: Could not find config file.');
    }

    this._repoName = repoName;
  }

  const settings = this._repositories[this._repoName];

  return requestPromise.get({
        url: configUrl,
        headers: settings.headers,
        json: true
    })
    .then(function (response) {
        const content = Buffer.from(response.content, 'base64').toString();

        const configData = YAML.parse(content);
        const yamlSchedule = configData['releaseSchedule'];
        const releaseSchedule = {};

        for (let i = 0; i < yamlSchedule.length; i++) {
          const row = yamlSchedule[i];
          const user = row.split(',')[0].trim();
          const dateString = row.split(',')[1].trim();

          const date = moment(dateString, 'MM/DD/YYYY').startOf('day');
          if (!defined(releaseSchedule[user])) {
            releaseSchedule[user] = [];
          }
          releaseSchedule[user].push(date);
        }

        const slackBotSettings = {
          releaseSchedule: releaseSchedule
        };

        return slackBotSettings;
    });
};

// Returns a promise that resolves after requesting  and saving
// the user ID's and channel ID's required for subsequent calls to the Slack API.
SlackBot._getSlackMetadata = function() {
  const that = this;
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
  const repositoryNames = Object.keys(this._repositories);
  return new Octokit({
    auth: `token ${  this._repositories[repositoryNames[0]].gitHubToken}`
  });
};

module.exports = SlackBot;
