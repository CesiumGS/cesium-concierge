'use strict';

const Promise = require('bluebird');
const fs = require('fs');
const handlebars = require('handlebars');
const path = require('path');
const moment = require('moment');
const requestPromise = require('request-promise');

const SlackBot = require('../../lib/SlackBot');
const RepositorySettings = require('../../lib/RepositorySettings');

describe('SlackBot', function () {
    let repositories;
    const today = moment();
    const tomorrow = moment().add(1, 'days').startOf('day');
    const earlyDate = moment().add(14, 'days').startOf('day');
    const mediumDate = moment().add(7, 'days').startOf('day');
    const user = 'omar';
    const userID = '1';
    const displayName = 'Omar';
    const cesiumjsChannelId = '123';
    const configUrl = 'https://api.github.com/repos/owner/repo/contents/.slackbot.yml';
    let mockYAML;

    function setupFakeIDs() {
        SlackBot._userIDs = {};
        SlackBot._userData = {};
        SlackBot._channelIDs = {
            'cesiumjs': cesiumjsChannelId
        };

        SlackBot._userIDs[user] = userID;
        SlackBot._userData[userID] = {
            display_name: displayName,
            id: userID
        };
        SlackBot._channelIDs['general'] = 1;
    }

    function getMessage(templateName) {
        const template = fs.readFileSync(path.join(__dirname, '../../lib/templates', `${templateName  }.hbs`)).toString();

        return handlebars.compile(template)({
            userId : `<@${  userID  }>`
        });
    }

    beforeEach(function () {
        repositories = {
            'owner/repo' : new RepositorySettings(),
            'owner2/repo2' : new RepositorySettings()
        };

        SlackBot._repositories = repositories;

        mockYAML = fs.readFileSync('./specs/data/slackbot.yml').toString();
    });

    afterEach(function () {
        delete repositories['owner/repo'];
    });

    it('is disabled if no Slack token is found.', function () {
        SlackBot.init({
            configUrl: configUrl
        });

        expect(SlackBot._isDisabled).toBe(true);
    });

    it('authenticates and gets Slack metadata.', function () {
        spyOn(SlackBot, '_authenticateGitHub');
        spyOn(SlackBot, '_getSlackMetadata').and.callFake(function() {
            return Promise.resolve();
        });

        SlackBot.init({
            token: 'token',
            configUrl: configUrl,
            repositories: repositories
        });

        expect(SlackBot._authenticateGitHub).toHaveBeenCalled();
        expect(SlackBot._getSlackMetadata).toHaveBeenCalled();
    });

    it('postMessage rejects if required metadata fails.', function (done) {
        spyOn(SlackBot, '_authenticateGitHub');
        spyOn(SlackBot, '_getSlackMetadata').and.callFake(function() {
            return Promise.reject(new Error('Failed to obtain Slack metadata.'));
        });

        SlackBot.init({
            token: 'token',
            configUrl: configUrl,
            repositories: repositories
        });

        SlackBot.postMessage('userID', 'message')
            .catch(function () {
                done();
            });
    });

    it('posts early release reminder to #cesiumjs channel.', function () {
        spyOn(SlackBot, '_getConfig').and.callFake(function() {
            const releaseSchedule = {};
            releaseSchedule[user] = [earlyDate];
            return Promise.resolve({
                releaseSchedule: releaseSchedule
            });
        });

        setupFakeIDs();

        spyOn(SlackBot, 'postMessage');

        return SlackBot._sendReleaseReminders()
            .then(function() {
                expect(SlackBot.postMessage).toHaveBeenCalledWith(cesiumjsChannelId, getMessage('releaseReminderEarly'));
            })
            .catch(function(error) {
                throw Error(error);
            });
    });

    it('posts release reminder to #cesiumjs channel.', function () {
        spyOn(SlackBot, '_getConfig').and.callFake(function() {
            const releaseSchedule = {};
            releaseSchedule[user] = [mediumDate];
            return Promise.resolve({
                releaseSchedule: releaseSchedule
            });
        });

        setupFakeIDs();

        spyOn(SlackBot, 'postMessage');

        return SlackBot._sendReleaseReminders()
        .then(function() {
            expect(SlackBot.postMessage).toHaveBeenCalledWith(cesiumjsChannelId, getMessage('releaseReminder'));
        })
        .catch(function(error) {
            throw Error(error);
        });
    });

    it('posts late release reminder to #cesiumjs channel.', function () {
        spyOn(SlackBot, '_getConfig').and.callFake(function() {
            const releaseSchedule = {};
            releaseSchedule[user] = [today];
            return Promise.resolve({
                releaseSchedule: releaseSchedule
            });
        });

        setupFakeIDs();

        spyOn(SlackBot, 'postMessage');

        return SlackBot._sendReleaseReminders()
        .then(function() {
            expect(SlackBot.postMessage).toHaveBeenCalledWith(cesiumjsChannelId, getMessage('releaseReminderLate'));
        })
        .catch(function(error) {
            throw Error(error);
        });
    });

    it('does not post release reminder on other days.', function () {
        spyOn(SlackBot, '_getConfig').and.callFake(function() {
            const releaseSchedule = {};
            releaseSchedule[user] = tomorrow;
            return Promise.resolve({
                releaseSchedule: releaseSchedule
            });
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

    it('_getConfig disables bot if config file is not in a known repository.', function (done) {
        spyOn(SlackBot, '_authenticateGitHub');
        spyOn(SlackBot, '_getSlackMetadata').and.callFake(function() {
            return Promise.resolve();
        });

        SlackBot.init({
            token: 'token',
            configUrl: configUrl,
            repositories: {
                'unknown/unknown' : new RepositorySettings()
            }
        });

        SlackBot._getConfig()
            .then(function (result) {
                expect(result).toBe('Warning: Could not find config file.');
                done();
            })
            .catch(done.fail);
    });

    it('_getConfig works.', function (done) {
        spyOn(SlackBot, '_authenticateGitHub');
        spyOn(SlackBot, '_getSlackMetadata').and.callFake(function() {
            return Promise.resolve();
        });

        SlackBot.init({
            token: 'token',
            configUrl: configUrl,
            repositories: repositories
        });

        spyOn(requestPromise, 'get').and.callFake(function (options) {
            if (options.url === configUrl) {
                return Promise.resolve({
                    content: Buffer.from(mockYAML).toString('base64')
                });
            }
            return Promise.reject(new Error(`Unexpected Url: ${  options.url}`));
        });

        SlackBot._getConfig()
            .then(function (slackBotSettings) {
                const date = moment('2/4/2019', 'MM/DD/YYYY').startOf('day');
                expect(slackBotSettings.releaseSchedule['oshehata'][0].format()).toBe(date.format());
                done();
            })
            .catch(done.fail);
    });

    it('_getAllPullRequestsMergedLastWeek works.', function () {
        const repositoryNames = Object.keys(repositories);
        const foreverAgo = moment().subtract(701, 'days').startOf('day');
        const pullRequestNumber = '12';

        SlackBot._githubClient = jasmine.createSpy('_githubClient');
        SlackBot._githubClient.issues = {
            listForRepo : {
                endpoint : {
                    merge : {

                    }
                }
            }
        };
        SlackBot._githubClient.paginate = {};
        SlackBot._githubClient.pulls = {
            checkIfMerged : {

            }
        };

        spyOn(SlackBot._githubClient.issues.listForRepo.endpoint, 'merge').and.callFake(function() {
            return {};
        });
        spyOn(SlackBot._githubClient.pulls, 'checkIfMerged').and.callFake(function() {
            return Promise.resolve({
                status: 204
            });
        });
        spyOn(SlackBot._githubClient, 'paginate').and.callFake(function() {
            return Promise.resolve([
            {
                closed_at: today.format(),
                pull_request : {
                    url: `https://api.github.com/repos/owner/repo/pulls/${  pullRequestNumber}`
                }
            },
            {
                closed_at: foreverAgo.format()
            }
            ]);
        });

        const pullRequestsPromise = SlackBot._getAllPullRequestsMergedLastWeek(repositoryNames);

        const lastWeek = moment().subtract(7, 'days');

        expect(SlackBot._githubClient.issues.listForRepo.endpoint.merge).toHaveBeenCalledWith({
            owner: 'owner',
            repo: 'repo',
            since: lastWeek.format(),
            state: 'closed'
        });

        expect(SlackBot._githubClient.issues.listForRepo.endpoint.merge.calls.length).toEqual(repositories.length);

        return pullRequestsPromise.then(function(pullRequests) {
            expect(SlackBot._githubClient.pulls.checkIfMerged).toHaveBeenCalledWith({
                owner: 'owner',
                repo: 'repo',
                pull_number: pullRequestNumber
            });
            // We expect one from each repo.
            expect(pullRequests.length).toBe(2);
        });
    });

    it('_getSlackMetadata works.', function (done) {
        const channels = [];
        channels.push({
            name: 'channel1',
            id: '1'
        });
        channels.push({
            name: 'channel2',
            id: '2'
        });

        const members = [];
        members.push({
            name: 'member1',
            id: '1'
        });
        members.push({
            name: 'member2',
            id: '2'
        });

        spyOn(SlackBot, '_getAllChannels').and.callFake(function() {
            return Promise.resolve(channels);
        });
        spyOn(SlackBot, '_getAllUsers').and.callFake(function() {
            return Promise.resolve(members);
        });

        SlackBot._userIDs = {};
        SlackBot._userData = {};
        SlackBot._channelIDs = {};

        SlackBot._getSlackMetadata()
            .then(function () {
                expect(SlackBot._userIDs['member1']).toBe('1');
                expect(SlackBot._userData['2']).toBe(members[1]);
                expect(SlackBot._channelIDs['channel2']).toBe('2');
                done();
            })
            .catch(done.fail);
    });

    it('initializes scheduled jobs.', function () {
        const jobs = SlackBot.initializeScheduledJobs();

        expect(jobs.releaseReminder).toBeDefined();

        jobs.releaseReminder.cancel();
    });

    it('does not post message or get config if disabled.', function (done) {
        SlackBot.init({});

        const slackBotWarning = 'Warning: SlackBot is disabled.';

        SlackBot.postMessage()
            .then(function (result) {
                expect(result).toBe(slackBotWarning);
                return SlackBot._getConfig();
            })
            .then(function (result) {
                expect(result).toBe(slackBotWarning);
                done();
            })
            .catch(done.fail);
    });

    it('postMessage calls the Slack API.', function () {
        spyOn(SlackBot, '_authenticateGitHub');
        spyOn(SlackBot, '_getSlackMetadata').and.callFake(function() {
            return Promise.resolve();
        });

        SlackBot.init({
            token: 'token',
            configUrl: configUrl,
            repositories: repositories
        });

        spyOn(SlackBot._slackClient.chat, 'postMessage');
        return SlackBot.postMessage()
            .then(function() {
                expect(SlackBot._slackClient.chat.postMessage).toHaveBeenCalled();
            });
    });
});
