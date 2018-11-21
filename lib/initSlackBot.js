'use strict';

var WebClient = require('@slack/client').WebClient;
var web;
var userIDs = {};
var channelIDs = {};

module.exports = initSlackBot;

function getAllChannels() {
  // See: https://api.slack.com/methods/conversations.list#arguments
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

function postMessage(userID, message) {
  var param = {
    channel: userIDs[userID],
    text: message,
    as_user: true
  };
  web.chat.postMessage(param)
  .catch(console.error);
}


function initSlackBot(token) {
  web  = new WebClient(token);

  getAllChannels()
  .then(function(channels) {
    channels.forEach(function(channel) {
      channelIDs[channel.name] = channel.id;
    });
  })
  .then(function(){ return getAllUsers(); })
  .then(function(members) {
    members.forEach(function(member) {
      userIDs[member.name] = member.id;
    });
  })
  .then(function(){
    postMessage('oshehata', 'Hey!');
  })
  .catch(function(error) {
    console.log(error);
  });
}