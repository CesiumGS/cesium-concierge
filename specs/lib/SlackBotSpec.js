'use strict';

var Promise = require('bluebird');
var fs = require('fs');
var handlebars = require('handlebars');
var path = require('path');

var SlackBot = require('../../lib/SlackBot');
var RepositorySettings = require('../../lib/RepositorySettings');

fdescribe('SlackBot', function () {
    var repositories;
    var today = new Date();
    var earlyDate = new Date(today.getFullYear(), today.getMonth(), today.getDate() + 14);
    var mediumDate = new Date(today.getFullYear(), today.getMonth(), today.getDate() + 7);
    var lateDate = new Date(today.getFullYear(), today.getMonth(), today.getDate() + 1);
    var user = 'omar';
    var ID = '1';
    var realName = 'Omar Shehata';

    function setupFakeIDs() {
        SlackBot._userIDs = {};
        SlackBot._userData = {};
        SlackBot._channelIDs = {};

        SlackBot._userIDs[user] = ID;
        SlackBot._userData[ID] = {
            real_name: realName
        };
        SlackBot._channelIDs['general'] = 1;
    }

    function getMessage(templateName) {
        var template = fs.readFileSync(path.join(__dirname, '../../lib/templates', templateName + '.hbs')).toString();
        var firstName = realName.split(' ')[0];

        return handlebars.compile(template)({
            name : firstName
        });
    }

    beforeEach(function () {
        repositories = {
            'owner/repo' : new RepositorySettings(),
            'owner2/repo2' : new RepositorySettings()
        };
    });

    afterEach(function () {
        delete repositories['owner/repo'];
    });

    it('is disabled if no Slack token is found.', function () {
        SlackBot.init({
            configUrl: 'slackConfigUrl'
        });

        expect(SlackBot._isDisabled).toBe(true);
    });

    it('authenticates and gets Slack metadata.', function () {
        spyOn(SlackBot, '_authenticateGitHub');
        spyOn(SlackBot, '_getSlackMetadata');

        SlackBot.init({
            token: 'token',
            configUrl: 'slackConfigUrl',
            repositories: repositories
        });

        expect(SlackBot._authenticateGitHub).toHaveBeenCalled();
        expect(SlackBot._getSlackMetadata).toHaveBeenCalled();
    });

    it('posts early release reminder.', function () {
        spyOn(SlackBot, '_getConfig').and.callFake(function() {
            var releaseSchedule = {};
            releaseSchedule[user] = earlyDate;
            return Promise.resolve(releaseSchedule);
        });

        setupFakeIDs();

        spyOn(SlackBot, 'postMessage');

        return SlackBot._sendReleaseReminders()
        .then(function() {
            expect(SlackBot.postMessage).toHaveBeenCalledWith(ID, getMessage('releaseReminderEarly'));
        })
        .catch(function(error) {
            throw Error(error);
        });
    });

    it('posts release reminder.', function () {
        spyOn(SlackBot, '_getConfig').and.callFake(function() {
            var releaseSchedule = {};
            releaseSchedule[user] = mediumDate;
            return Promise.resolve(releaseSchedule);
        });

        setupFakeIDs();

        spyOn(SlackBot, 'postMessage');

        return SlackBot._sendReleaseReminders()
        .then(function() {
            expect(SlackBot.postMessage).toHaveBeenCalledWith(ID, getMessage('releaseReminder'));
        })
        .catch(function(error) {
            throw Error(error);
        });
    });

    it('posts late release reminder.', function () {
        spyOn(SlackBot, '_getConfig').and.callFake(function() {
            var releaseSchedule = {};
            releaseSchedule[user] = lateDate;
            return Promise.resolve(releaseSchedule);
        });

        setupFakeIDs();

        spyOn(SlackBot, 'postMessage');

        return SlackBot._sendReleaseReminders()
        .then(function() {
            expect(SlackBot.postMessage).toHaveBeenCalledWith(ID, getMessage('releaseReminderLate'));
        })
        .catch(function(error) {
            throw Error(error);
        });
    });

    it('does not post release reminder on other days.', function () {
        spyOn(SlackBot, '_getConfig').and.callFake(function() {
            var releaseSchedule = {};
            releaseSchedule[user] = today;
            return Promise.resolve(releaseSchedule);
        });

        setupFakeIDs();

        spyOn(SlackBot, 'postMessage');

        return SlackBot._sendReleaseReminders()
        .then(function() {
            expect(SlackBot.postMessage).not.toHaveBeenCalled();
        })
        .catch(function(error) {
            throw Error(error);
        });
    });

    it('posts weekly statistics message.', function () {
        var yesterday = new Date(today.getFullYear(), today.getMonth(), today.getDate() - 1);
        var lastWeek = new Date(today.getFullYear(), today.getMonth(), today.getDate() - 7);

        var promiseArray = [];
        var issues = [];
        issues.push({
            pull_request: {},
            closed_at: yesterday,
            created_at: lastWeek
        });
        issues.push({
            pull_request: {},
            closed_at: yesterday,
            created_at: yesterday
        });
        promiseArray.push(Promise.resolve(issues));

        spyOn(SlackBot, '_getAllIssuesLastWeek').and.callFake(function() {
            return promiseArray;
        });

        setupFakeIDs();

        spyOn(SlackBot, 'postMessage');

        SlackBot._sendWeeklyStats(true)
        .then(function() {
            var templateName = 'weeklyStats';
            var template = fs.readFileSync(path.join(__dirname, '../../lib/templates', templateName + '.hbs')).toString();
            var messageText = handlebars.compile(template)({
                greeting : 'Happy Friday everyone!',
                averageMergeTime : '3.0',
                numberOfPullRequests : issues.length,
                unusuallyLongPRMessage : ''
            });
            expect(SlackBot.postMessage).toHaveBeenCalledWith(SlackBot._channelIDs['general'], messageText);
        })
        .catch(function(error) {
            throw Error(error);
        });

    });

});
