'use strict';

var fsExtra = require('fs-extra');
var nconf = require('nconf');
var Promise = require('bluebird');
var requestPromise = require('request-promise');

var stalePullRequest = require('../../bin/stalePullRequest');

var pullRequests = fsExtra.readJsonSync('./specs/data/responses/pullRequests.json');

describe('stalePullRequest', function () {
    beforeEach(function (){
        spyOn(nconf, 'get').and.callFake(function (key) {
            if (key === 'repositories') {
                return {
                    one: {
                        gitHubToken: 'oneGHT',
                        bumpStalePullRequests: true,
                        bumpStalePullRequestsUrl: 'one.example.com'
                    },
                    two: {
                        gitHubToken: 'twoGHT',
                        bumpStalePullRequests: true,
                        bumpStalePullRequestsUrl: 'two.example.com'
                    },
                    three: {}
                };
            }
        });
    });

    it('calls implementation the correct number of times', function (done) {
        spyOn(stalePullRequest, 'implementation');
        stalePullRequest(['one', 'two', 'three']).then(function () {
            expect(stalePullRequest.implementation).toHaveBeenCalledTimes(2);
            done();
        })
        .catch(function (err) {
            done.fail(err);
        });
    });

    it('calls implementation with correct values', function (done) {
        spyOn(stalePullRequest, 'implementation');
        stalePullRequest(['one', 'two']).then(function () {
            var obj = stalePullRequest.implementation.calls.argsFor(0);
            expect(obj[0]).toEqual('one.example.com?sort=updated&direction=asc');
            expect(obj[1]).toEqual('oneGHT');
            obj = stalePullRequest.implementation.calls.argsFor(1);
            expect(obj[0]).toEqual('two.example.com?sort=updated&direction=asc');
            expect(obj[1]).toEqual('twoGHT');
            done();
        })
        .catch(function (err) {
            done.fail(err);
        });
    });
});

describe('stalePullRequest.implementation', function () {
    beforeEach(function (){
        spyOn(nconf, 'get').and.callFake(function (key) {
            if (key === 'repositories') {
                return {
                    one: {
                        gitHubToken: 'oneGHT',
                        bumpStalePullRequests: true,
                        bumpStalePullRequestsUrl: 'one.example.com'
                    },
                    two: {
                        gitHubToken: 'twoGHT',
                        bumpStalePullRequests: true,
                        bumpStalePullRequestsUrl: 'two.example.com'
                    },
                    three: {}
                };
            }
        });
    });

    var comments = fsExtra.readJsonSync('./specs/data/responses/pullRequestComments.json');
    var noConciergeComments = fsExtra.readJsonSync('./specs/data/responses/pullRequestCommentsNoConcierge.json');
    var pullRequests404 = fsExtra.readJsonSync('./specs/data/responses/pullRequests_404.json');
    beforeEach(function () {
        spyOn(Date, 'now').and.returnValue(new Date(1500921244516));
    });

    function getSwitch(obj) {
        if (/\/comments/.test(obj.uri)) {
            return Promise.resolve(comments);
        }
        return Promise.resolve(pullRequests);
    }

    it('returns rejected Promise if statusCode is bad', function (done) {
        spyOn(requestPromise, 'get').and.returnValue(Promise.resolve(pullRequests404));
        stalePullRequest.implementation().then(function () {
            done.fail();
        })
        .catch(function (err) {
            if (/Status code/i.test(err)) {
                return done();
            }
            done.fail();
        });
    });

    it('dateIsOlderThan gets called once for each pull request', function (done) {
        spyOn(requestPromise, 'get').and.callFake(getSwitch);
        spyOn(stalePullRequest, 'dateIsOlderThan');
        stalePullRequest.implementation().then(function () {
            expect(stalePullRequest.dateIsOlderThan).toHaveBeenCalledTimes(30);
            done();
        })
        .catch(function (err) {
            done.fail(err);
        });
    });

    it('requestPromise.post gets called once for each pull request older than 30 days', function (done) {
        spyOn(requestPromise, 'get').and.callFake(getSwitch);
        spyOn(requestPromise, 'post');
        stalePullRequest.implementation().then(function () {
            expect(requestPromise.post).toHaveBeenCalledTimes(15);
            done();
        })
        .catch(function (err) {
            done.fail(err);
        });
    });

    it('requestPromise.post is called with the correct URLs', function (done) {
        spyOn(requestPromise, 'get').and.callFake(getSwitch);
        spyOn(requestPromise, 'post');
        stalePullRequest.implementation().then(function () {
            var obj = requestPromise.post.calls.argsFor(0)[0];
            expect(obj.uri).toEqual('https://api.github.com/repos/AnalyticalGraphicsInc/cesium/issues/4635/comments');
            done();
        })
        .catch(function (err) {
            done.fail(err);
        });
    });

    it('recognizes it has commented on a post before', function (done) {
        spyOn(requestPromise, 'get').and.callFake(getSwitch);
        spyOn(requestPromise, 'post');
        stalePullRequest.implementation().then(function () {
            var obj = requestPromise.post.calls.argsFor(0)[0];
            expect(obj.body.body).toMatch(/last commented/i);
            done();
        })
        .catch(function (err) {
            done.fail(err);
        });
    });

    it('recognizes it has not commented on a post before', function (done) {
        spyOn(requestPromise, 'get').and.callFake(function (obj) {
            if (/\/comments/.test(obj.uri)) {
                return Promise.resolve(noConciergeComments);
            }
            return Promise.resolve(pullRequests);
        });
        spyOn(requestPromise, 'post');
        stalePullRequest.implementation().then(function () {
            var obj = requestPromise.post.calls.argsFor(0)[0];
            expect(obj.body.body).toMatch(/could someone please/i);
            done();
        })
        .catch(function (err) {
            done.fail(err);
        });
    });
});

describe('stalePullRequest.dateIsOlderThan', function () {
    beforeEach(function () {
        spyOn(Date, 'now').and.returnValue(new Date(1500921244516));
    });

    it('returns true for dates older than specified number of days ago', function () {
        expect(stalePullRequest.dateIsOlderThan(new Date(pullRequests.body[0].updated_at), 1)).toBe(true);
        expect(stalePullRequest.dateIsOlderThan(new Date(pullRequests.body[0].updated_at), 10)).toBe(true);
        expect(stalePullRequest.dateIsOlderThan(new Date(pullRequests.body[0].updated_at), 100)).toBe(true);
        expect(stalePullRequest.dateIsOlderThan(new Date(pullRequests.body[0].updated_at), 189)).toBe(true);
    });

    it('returns false for dates before specified number of days ago', function () {
        expect(stalePullRequest.dateIsOlderThan(new Date(pullRequests.body[0].updated_at), 191)).toBe(false);
        expect(stalePullRequest.dateIsOlderThan(new Date(pullRequests.body[0].updated_at), 1000)).toBe(false);
    });
});
