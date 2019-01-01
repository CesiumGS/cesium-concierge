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

var dateLog = require('./dateLog');
var daysSince = require('./daysSince');

var web;

var SlackBot = {};

var repoNameRegex = /repos\/([\w-]+\/[\w-]+)/;

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

  // Authenticate using the first token found.
  this._authenticateGitHub();
  
  // Request and save the user ID's and channel ID's for subsequent calls to the Slack API.
  // This returns a promise, so if you wanted to just send a message to a particular user
  // you would do:
  //
  // this._getSlackMetadata()
  // .then(function(){
  //   that.postMessage(this._userIDs['oshehata'], 'Hello ' + this._userData[this._userIDs['oshehata']].real_name);
  // });
  //
  // Which would print 'Hello Omar Shehata' to @oshehata.
  this._getSlackMetadata();
};

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
}

SlackBot._sendWeeklyStats = function() {
    var repositoryNames = Object.keys(this._repositories);
    var promises = [];
    for (var i = 0; i < repositoryNames.length; ++i) {
      var nameSplit = repositoryNames[i].split('/');
      var owner = nameSplit[0];
      var repo = nameSplit[1];
      // Get all closed issues/PRs for this repo for last week.
      var today = new Date();
      var lastWeek = new Date(today.getFullYear(), today.getMonth(), today.getDate() - 7);
      var options = octokit.issues.listForRepo.endpoint.merge({ owner: owner, repo: repo, since: lastWeek.toISOString(), state: 'closed' });
      promises.push(octokit.paginate(options));
    }

    var longestMergeTime = 0;
    var longestPullRequest;
    var mergeTimes = [];
    var that = this;

    Promise.all(promises)
    .then(function(values) {
      for(var i = 0; i < values.length; ++i) {
        var listOfIssues = values[i];
        for(var j = 0; j < listOfIssues.length; ++j) {
          var issue = listOfIssues[j];
          
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
        }
      }
    })
    .then(function() {
      var averageMergeTime = average(mergeTimes).toFixed(1);
      longestMergeTime = longestMergeTime.toFixed(1);

      // Compute the standard deviation. If the longest merge time is more than 3 times that, report is as unusual.
      var unusuallyLongPRMessage = '';
      var deviation = standardDeviation(mergeTimes);

      if (Math.abs(longestMergeTime - averageMergeTime) >= deviation * 2) {
        unusuallyLongPRMessage = 'This PR (' + longestPullRequest.html_url + ') took an unusually long amount of time to get merged (' + longestMergeTime + ' days).';
      }

      var greetings = ['Happy Friday everyone!', 'Can you believe Friday is already here?', 'I hope you all had awesome week!',
                      'I skipped breakfast, so I hope Gary baked something good today...', 'Good morning everyone!'];

      var templateName = 'weeklyStats';
      var template = fs.readFileSync(path.join(__dirname, 'templates', templateName + '.hbs')).toString();
      var messageText = handlebars.compile(template)({
        greeting : greetings[Math.floor(Math.random() * greetings.length)],
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
  return this._getConfig(this._configUrl)
  .then(function(releaseSchedule) {
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

SlackBot._getConfig = function(configUrl) {
  if (!defined(this._repoName)) {
    // If we find a config url but no token for that repo, print a warning.
    var matchResults = configUrl.match(repoNameRegex);
    var repoName;
    if (defined(matchResults)) {
      repoName = matchResults[1];
    }

    if (!defined(repoName) || !defined(this._repositories[repoName])) {
      dateLog('Config file is hosted on ' + repoName + ' but no GitHub token found for this repo! SlackBot is disabled.');
      this._repoName = -1;
    } else {
      this._repoName = repoName;
    }
  }

  if (this._repoName === -1) {
    return Promise.resolve();
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
        var yamlSchedule = configData['release-schedule'];
        var releaseSchedule = {};

        for (var user in yamlSchedule) {
          if (yamlSchedule.hasOwnProperty(user)) {
            var date = stringToDate(yamlSchedule[user], 'MM/dd/yyyy', '/');
            releaseSchedule[user] = date;
          }
        }

        return releaseSchedule;
    });
};

SlackBot._getSlackMetadata = function() {
  web = new WebClient(this._token);
  var that = this;

  return getAllChannels()
  .then(function(channels) {
    channels.forEach(function(channel) {
      that._channelIDs[channel.name] = channel.id;
    });
  })
  .then(function(){ return getAllUsers(); })
  .then(function(members) {
    members.forEach(function(member) {
      that._userIDs[member.name] = member.id;
      that._userData[member.id] = member;
    });
  })
  .catch(function(error) {
    console.log(error);
  });
};

SlackBot._authenticateGitHub = function() {
  var repositoryNames = Object.keys(this._repositories);
  octokit.authenticate({
    type: 'token',
    token: this._repositories[repositoryNames[0]].gitHubToken
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