'use strict';

const Promise = require('bluebird');
const requestPromise = require('request-promise');

const stalePullRequest = require('../../lib/stalePullRequest');
const RepositorySettings = require('../../lib/RepositorySettings');

describe('stalePullRequest', function () {
    let repositories;
    let commitsData;

    beforeEach(function () {
        repositories = {
            'AnalyticalGraphics/cesium': new RepositorySettings({
                gitHubToken: 'token1'
            }),
            'AnalyticalGraphics/cesium-concierge': new RepositorySettings({
                gitHubToken: 'token2'
            })
        };

        commitsData = [{
            commit: {
                author: {
                    date: new Date(Date.now())
                }
            }
        }];
    });

    it('calls stalePullRequest._processRepository once for each repository', function (done) {
        spyOn(stalePullRequest, '_processRepository').and.returnValue(Promise.resolve());
        stalePullRequest(repositories)
            .then(function () {
                const keys = Object.keys(repositories);
                expect(stalePullRequest._processRepository).toHaveBeenCalledTimes(2);
                expect(stalePullRequest._processRepository.calls.argsFor(0)).toEqual([keys[0], repositories[keys[0]]]);
                expect(stalePullRequest._processRepository.calls.argsFor(1)).toEqual([keys[1], repositories[keys[1]]]);
                done();
            })
            .catch(done.fail);
    });

    it('calls stalePullRequest._processPullRequest once for each returned pull request', function (done) {
        const mockPullRequest = {};
        const mockPullRequest2 = {};
        const firstResponse = {
            headers : {
                link : '<https://url?page=2>; rel="next",<https://url?page=2>; rel="last"'
            },
            body: [mockPullRequest]
        };
        const secondResponse = {
            headers : {
                link : '<https://url?page=1>; rel="first",<https://url?page=2>; rel="prev"'
            },
            body: [mockPullRequest2]
        };

        spyOn(requestPromise, 'get').and.callFake(function (options) {
            if (options.url === 'https://api.github.com/repos/AnalyticalGraphics/cesium/pulls?state=open&base=main') {
                return Promise.resolve(firstResponse);
            } else if (options.url === 'https://url?page=2') {
                return Promise.resolve(secondResponse);
            }
            return Promise.reject(new Error(`Unexpected Url: ${  options.url}`));
        });

        spyOn(stalePullRequest, '_processPullRequest').and.returnValue(Promise.resolve());

        stalePullRequest._processRepository('AnalyticalGraphics/cesium', repositories['AnalyticalGraphics/cesium'])
            .then(function () {
                expect(stalePullRequest._processPullRequest).toHaveBeenCalledTimes(2);
                expect(stalePullRequest._processPullRequest.calls.argsFor(0)).toEqual([mockPullRequest, repositories['AnalyticalGraphics/cesium']]);
                expect(stalePullRequest._processPullRequest.calls.argsFor(1)).toEqual([mockPullRequest2, repositories['AnalyticalGraphics/cesium']]);
                done();
            })
            .catch(done.fail);
    });

    it('stalePullRequest._processPullRequest does not post non-stale pull request', function (done) {
        const repositorySettings = new RepositorySettings();
        const commentsUrl = 'https://url';
        const commitsUrl = 'https://commits';
        const pullRequest = {
            comments_url: commentsUrl,
            commits_url: commitsUrl
        };

        spyOn(requestPromise, 'get').and.callFake(function (options) {
            if (options.resolveWithFullResponse === true) {
                return Promise.resolve({headers: {link: '<https://url?page=2>; rel="next",<https://url?page=3>; rel="last"'}});
            } else if (options.url === `${commentsUrl  }?page=3`) {
                const timestamp = new Date(Date.now());
                return Promise.resolve([{
                    updated_at: timestamp
                }]);
            } else if (options.url === commitsUrl) {
                return Promise.resolve(commitsData);
            }
            return Promise.reject(new Error(`Unexpected Url: ${  options.url}`));
        });
        spyOn(requestPromise, 'post');
        spyOn(stalePullRequest, '_foundStopComment').and.callFake(function () {
            return false;
        });

        stalePullRequest._processPullRequest(pullRequest, repositorySettings)
            .then(function () {
                expect(requestPromise.post).not.toHaveBeenCalled();
                done();
            })
            .catch(done.fail);
    });

    it('stalePullRequest._processPullRequest posts expected message for stale pull request', function (done) {
        const repositorySettings = new RepositorySettings();
        const commentsUrl = 'https://url';
        const commitsUrl = 'https://commits';
        const pullRequest = {
            comments_url: commentsUrl,
            commits_url: commitsUrl,
            user: {
                login: 'boomerjones'
            }
        };

        const timestamp = new Date(Date.now());
        timestamp.setDate(timestamp.getDate() - repositorySettings.maxDaysSinceUpdate);

        spyOn(requestPromise, 'get').and.callFake(function (options) {
            if (options.resolveWithFullResponse === true) {
                return Promise.resolve({headers: {link: '<https://url?page=2>; rel="next",<https://url?page=3>; rel="last"'}});
            } else if (options.url === `${commentsUrl  }?page=3`) {
                return Promise.resolve([{
                    updated_at: timestamp,
                    user: {
                        login: 'boomerjones'
                    }
                }]);
            } else if (options.url === commitsUrl) {
                const commitsDataOld = JSON.parse(JSON.stringify(commitsData));
                commitsDataOld[0].commit.author.date = timestamp;
                return Promise.resolve(commitsDataOld);
            }
            return Promise.reject(new Error(`Unexpected Url: ${  options.url}`));
        });
        spyOn(requestPromise, 'post');
        spyOn(stalePullRequest, '_foundStopComment').and.callFake(function () {
            return false;
        });

        stalePullRequest._processPullRequest(pullRequest, repositorySettings)
            .then(function () {
                expect(requestPromise.post).toHaveBeenCalledWith({
                    url: commentsUrl,
                    headers: repositorySettings.headers,
                    body: {
                        body: repositorySettings.stalePullRequestTemplate({
                            maxDaysSinceUpdate: repositorySettings.maxDaysSinceUpdate,
                            userName: pullRequest.user.login
                        })
                    },
                    json: true
                });
                done();
            })
            .catch(done.fail);
    });

    it('stalePullRequest._processPullRequest does not post if there is a recent commit', function (done) {
        const repositorySettings = new RepositorySettings();
        const commentsUrl = 'https://url';
        const commitsUrl = 'https://commits';
        const pullRequest = {
            comments_url: commentsUrl,
            commits_url: commitsUrl,
            user: {
                login: 'boomerjones'
            }
        };

        spyOn(requestPromise, 'get').and.callFake(function (options) {
            if (options.resolveWithFullResponse === true) {
                return Promise.resolve({headers: {link: '<https://url?page=2>; rel="next",<https://url?page=3>; rel="last"'}});
            } else if (options.url === `${commentsUrl  }?page=3`) {
                const timestamp = new Date(Date.now());
                timestamp.setDate(timestamp.getDate() - repositorySettings.maxDaysSinceUpdate);
                return Promise.resolve([{
                    updated_at: timestamp,
                    user: {
                        login: 'boomerjones'
                    }
                }]);
            } else if (options.url === commitsUrl) {
                return Promise.resolve(commitsData);
            }
            return Promise.reject(new Error(`Unexpected Url: ${  options.url}`));
        });
        spyOn(requestPromise, 'post');
        spyOn(stalePullRequest, '_foundStopComment').and.callFake(function () {
            return false;
        });

        stalePullRequest._processPullRequest(pullRequest, repositorySettings)
            .then(function () {
                expect(requestPromise.post).not.toHaveBeenCalled();
                done();
            })
            .catch(done.fail);
    });

    it('stalePullRequest._processPullRequest does not post when asked to stop', function (done) {
        const repositorySettings = new RepositorySettings();
        const commentsUrl = 'https://url';
        const commitsUrl = 'https://commits';
        const pullRequest = {
            comments_url: commentsUrl,
            commits_url: commitsUrl
        };

        spyOn(requestPromise, 'get').and.callFake(function (options) {
            if (options.resolveWithFullResponse === true) {
                return Promise.resolve({headers: {link: '<https://url?page=2>; rel="next",<https://url?page=3>; rel="last"'}});
            } else if (options.url === `${commentsUrl  }?page=3`) {
                const timestamp = new Date(Date.now());
                timestamp.setDate(timestamp.getDate() - repositorySettings.maxDaysSinceUpdate);
                return Promise.resolve([{
                    updated_at: timestamp,
                    user: {
                        login: 'boomerjones'
                    }
                }]);
            } else if (options.url === commitsUrl) {
                return Promise.resolve(commitsData);
            }
            return Promise.reject(new Error(`Unexpected Url: ${  options.url}`));
        });
        spyOn(requestPromise, 'post');
        spyOn(stalePullRequest, '_foundStopComment').and.callFake(function () {
            return true;
        });

        stalePullRequest._processPullRequest(pullRequest, repositorySettings)
            .then(function () {
                expect(requestPromise.post).not.toHaveBeenCalled();
                done();
            })
            .catch(done.fail);
    });

    it('stalePullRequest.foundStopComment works', function () {
        const conciergeUser = {login: 'cesium-concierge'};
        const otherUser = {login: 'BobDylan'};

        expect(stalePullRequest._foundStopComment([{ body: '', user: otherUser }])).toBe(false);
        expect(stalePullRequest._foundStopComment([{ body: '', user: conciergeUser }])).toBe(false);
        expect(stalePullRequest._foundStopComment([{ body: '@cesium-concierge stop', user: conciergeUser }])).toBe(false);
        expect(stalePullRequest._foundStopComment([{ body: 'This is a profound PR.', user: otherUser }])).toBe(false);

        expect(stalePullRequest._foundStopComment([{ body: '@cesium-concierge stop', user: otherUser }])).toBe(true);
        expect(stalePullRequest._foundStopComment([{ body: '', user: conciergeUser }, { body: '@cesium-concierge stop', user: otherUser }])).toBe(true);
    });

});
