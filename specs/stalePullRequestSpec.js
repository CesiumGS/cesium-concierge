'use strict';

var fsExtra = require('fs-extra');
var nconf = require('nconf');
var Promise = require('bluebird');
var requestPromise = require('request-promise');

var stalePullRequest = require('../stalePullRequest');

describe('stalePullRequest', function () {
    beforeEach(function (){
        spyOn(nconf, 'get').and.callFake(function (key) {
            if (key === 'repositories') {
                return {
                    one: {
                        gitHubToken: 'oneGHT',
                        bumpStalePullRequests: {
                            url: 'one.example.com'
                        }
                    },
                    two: {
                        gitHubToken: 'twoGHT',
                        bumpStalePullRequests: {
                            url: 'two.example.com'
                        }
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
            expect(stalePullRequest.implementation.calls.argsFor(0)).toEqual(['one.example.com?sort=updated&direction=asc', 'oneGHT']);
            expect(stalePullRequest.implementation.calls.argsFor(1)).toEqual(['two.example.com?sort=updated&direction=asc', 'twoGHT']);
            done();
        })
        .catch(function (err) {
            done.fail(err);
        });
    });
});

describe('stalePullRequest.implementation', function () {
    var pullRequests = fsExtra.readJsonSync('./specs/data/responses/pullRequests.json');
    var pullRequests404 = fsExtra.readJsonSync('./specs/data/responses/pullRequests_404.json');
    beforeEach(function () {
        spyOn(requestPromise, 'post');
    });

    it('returns rejected Promise if statusCode is bad', function (done) {
        spyOn(requestPromise, 'get').and.returnValue(Promise.resolve(pullRequests404));
        stalePullRequest.implementation(['one']).then(function () {
            done.fail();
        })
        .catch(function (err) {
            if (/Status code/i.test(err)) {
                return done();
            }
            done.fail();
        });
    });
});
