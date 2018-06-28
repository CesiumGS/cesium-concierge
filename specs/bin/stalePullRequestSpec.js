'use strict';

var Promise = require('bluebird');
var requestPromise = require('request-promise');

var stalePullRequest = require('../../bin/stalePullRequest');
var RepositorySettings = require('../../lib/RepositorySettings');

describe('stalePullRequest', function () {
    var repositories;
    beforeEach(function () {
        repositories = {
            'AnalyticalGraphics/cesium': new RepositorySettings({
                gitHubToken: 'token1'
            }),
            'AnalyticalGraphics/cesium-concierge': new RepositorySettings({
                gitHubToken: 'token2'
            })
        };
    });

    it('calls stalePullRequest._processRepository once for each repository', function (done) {
        spyOn(stalePullRequest, '_processRepository').and.returnValue(Promise.resolve());
        stalePullRequest(repositories)
            .then(function () {
                var keys = Object.keys(repositories);
                expect(stalePullRequest._processRepository).toHaveBeenCalledTimes(2);
                expect(stalePullRequest._processRepository.calls.argsFor(0)).toEqual([keys[0], repositories[keys[0]]]);
                expect(stalePullRequest._processRepository.calls.argsFor(1)).toEqual([keys[1], repositories[keys[1]]]);
                done();
            })
            .catch(done.fail);
    });

    it('calls stalePullRequest._processPullRequest once for each returned pull request', function (done) {
        var mockPullRequest = {};
        var mockPullRequest2 = {};
        var firstResponse = {
            headers : {
                link : '<https://url?page=2>; rel="next",<https://url?page=2>; rel="last"'
            },
            body: [mockPullRequest]
        };
        var secondResponse = {
            headers : {
                link : '<https://url?page=1>; rel="first",<https://url?page=2>; rel="prev"'
            },
            body: [mockPullRequest2]
        };

        spyOn(requestPromise, 'get').and.callFake(function (options) {
            if (options.url === 'https://api.github.com/repos/AnalyticalGraphics/cesium/pulls?state=open&base=master') {
                return Promise.resolve(firstResponse);
            }
            else if (options.url === 'https://url?page=2') {
                return Promise.resolve(secondResponse);
            }
            return Promise.reject(new Error('Unexpected Url'));
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
        var repositorySettings = new RepositorySettings();
        var commentsUrl = 'https://url';
        var pullRequest = {
            comments_url: commentsUrl
        };

        spyOn(requestPromise, 'get').and.callFake(function (options) {
            if (options.resolveWithFullResponse === true) {
                return Promise.resolve({headers: {link: '<https://url?page=2>; rel="next",<https://url?page=3>; rel="last"'}});
            }
            else if (options.url === commentsUrl + '?page=3') {
                var timestamp = new Date(Date.now());
                return Promise.resolve([{
                    updated_at: timestamp
                }]);
            }
            return Promise.reject(new Error('Unexpected Url'));
        });
        spyOn(requestPromise, 'post');
        spyOn(stalePullRequest, 'foundStopComment').and.callFake(function () {
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
        var repositorySettings = new RepositorySettings();
        var commentsUrl = 'https://url';
        var pullRequest = {
            comments_url: commentsUrl,
            user: {login: 'boomerjones'}
        };

        spyOn(requestPromise, 'get').and.callFake(function (options) {
            if (options.resolveWithFullResponse === true) {
                return Promise.resolve({headers: {link: '<https://url?page=2>; rel="next",<https://url?page=3>; rel="last"'}});
            }
            else if (options.url === commentsUrl + '?page=3') {
                var timestamp = new Date(Date.now());
                timestamp.setDate(timestamp.getDate() - repositorySettings.maxDaysSinceUpdate);
                return Promise.resolve([{
                    updated_at: timestamp,
                    user: {login: 'boomerjones'}
                }]);
            }
            return Promise.reject(new Error('Unexpected Url'));
        });
        spyOn(requestPromise, 'post');
        spyOn(stalePullRequest, 'foundStopComment').and.callFake(function () {
            return false;
        });

        stalePullRequest._processPullRequest(pullRequest, repositorySettings)
            .then(function () {
                expect(requestPromise.post).toHaveBeenCalledWith({
                    url: commentsUrl + '?page=3',
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

    it('stalePullRequest._processPullRequest does not post when asked to stop', function (done) {
        var repositorySettings = new RepositorySettings();
        var commentsUrl = 'https://url';
        var pullRequest = {
            comments_url: commentsUrl
        };

        spyOn(requestPromise, 'get').and.callFake(function (options) {
            if (options.resolveWithFullResponse === true) {
                return Promise.resolve({headers: {link: '<https://url?page=2>; rel="next",<https://url?page=3>; rel="last"'}});
            }
            else if (options.url === commentsUrl + '?page=3') {
                var timestamp = new Date(Date.now());
                timestamp.setDate(timestamp.getDate() - repositorySettings.maxDaysSinceUpdate);
                return Promise.resolve([{
                    updated_at: timestamp,
                    user: {login: 'boomerjones'}
                }]);
            }
            return Promise.reject(new Error('Unexpected Url'));
        });
        spyOn(requestPromise, 'post');
        spyOn(stalePullRequest, 'foundStopComment').and.callFake(function () {
            return true;
        });

        stalePullRequest._processPullRequest(pullRequest, repositorySettings)
            .then(function () {
                expect(requestPromise.post).not.toHaveBeenCalled();
                done();
            })
            .catch(done.fail);
    });
});
