'use strict';

var Promise = require('bluebird');
var requestPromise = require('request-promise');

var commentOnClosedIssue = require('../../lib/commentOnClosedIssue');

describe('commentOnClosedIssue', function () {
    var headers = Object.freeze({
        'User-Agent': 'cesium-concierge',
        Authorization: 'token notARealToken'
    });

    var issueEventJson;
    var pullRequestEventJson;
    var issueUrl = 'issueUrl';
    var commentsUrl = 'commentsUrl';

    beforeEach(function () {
        issueEventJson = {
            issue: {
                url: issueUrl,
                comments_url: commentsUrl
            }
        };

        pullRequestEventJson = {
            pull_request: {
                url: issueUrl,
                comments_url: commentsUrl
            }
        };
    });

    it('throws if body is undefined', function () {
        expect(function () {
            commentOnClosedIssue(undefined, headers);
        }).toThrowError();
    });

    it('throws if `headers` is undefined', function () {
        expect(function () {
            commentOnClosedIssue(issueEventJson, undefined);
        }).toThrowError();
    });

    it('rejects with unknown body type', function (done) {
        commentOnClosedIssue({}, headers)
            .then(done.fail)
            .catch(function (error) {
                expect(error.message).toBe('Unknown body type');
                done();
            });
    });

    it('passes expected parameters to implementation for closed issue', function () {
        spyOn(commentOnClosedIssue, '_implementation');
        commentOnClosedIssue(issueEventJson, headers);
        expect(commentOnClosedIssue._implementation).toHaveBeenCalledWith(issueUrl, commentsUrl, headers);
    });

    it('passes expected parameters to implementation for closed pull request', function () {
        spyOn(commentOnClosedIssue, '_implementation');
        commentOnClosedIssue(pullRequestEventJson, headers);
        expect(commentOnClosedIssue._implementation).toHaveBeenCalledWith(issueUrl, commentsUrl, headers);
    });

    function runTestWithLinks(forumLinks) {
        var issueResponseJson = {
            html_url: 'html_url',
            body: 'This is my issue description. ' + forumLinks[0]
        };

        var commentsJson = [{
            body: forumLinks[1]
        }];

        spyOn(requestPromise, 'get').and.callFake(function (options) {
            if (options.url === issueUrl) {
                return Promise.resolve(issueResponseJson);
            }
            if (options.url === commentsUrl) {
                return Promise.resolve(commentsJson);
            }

            return Promise.reject('Unknown url.');
        });
        spyOn(requestPromise, 'post');

        return commentOnClosedIssue._implementation('issueUrl', 'commentsUrl', headers);
    }

    it('commentOnClosedIssue._implementation posts expected message.', function (done) {
        var forumLinks = [
            'https://groups.google.com/forum/?hl=en#!topic/cesium-dev/qw36Qo60i4s',
            'https://groups.google.com/forum/?hl=en#!topic/cesium-dev/gn56Qo60i4s'
        ];
        runTestWithLinks(forumLinks)
            .then(function () {
                expect(requestPromise.post).toHaveBeenCalledWith({
                    url: 'commentsUrl',
                    headers: headers,
                    body: {body: commentOnClosedIssue.renderMessage('html_url', forumLinks)},
                    json: true
                });
                done();
            })
            .catch(done.fail);
    });

    it('commentOnClosedIssue._implementation does not post when no forum links are found.', function (done) {
        var forumLinks = [
            '',
            ''
        ];
        runTestWithLinks(forumLinks)
            .then(function () {
                expect(requestPromise.post).not.toHaveBeenCalled();
                done();
            })
            .catch(done.fail);
    });

    it('commentOnClosedIssue._implementation rejects is issueUrl cannot be retrieved.', function (done) {
        var commentsJson = [];

        spyOn(requestPromise, 'get').and.callFake(function (options) {
            if (options.url === issueUrl) {
                return Promise.reject('Bad request');
            }
            if (options.url === commentsUrl) {
                return Promise.resolve(commentsJson);
            }

            return Promise.reject('Unknown url.');
        });
        spyOn(requestPromise, 'post');

        commentOnClosedIssue._implementation('issueUrl', 'commentsUrl', headers)
            .then(done.fail)
            .catch(function (error) {
                expect(error).toEqual('Bad request');
                expect(requestPromise.post).not.toHaveBeenCalled();
                done();
            });
    });

    it('commentOnClosedIssue._implementation rejects is commentsUrl cannot be retrieved.', function (done) {
        var issueResponseJson = {
            html_url: 'html_url',
            body: ''
        };

        spyOn(requestPromise, 'get').and.callFake(function (options) {
            if (options.url === issueUrl) {
                return Promise.resolve(issueResponseJson);
            }

            if (options.url === commentsUrl) {
                return Promise.reject('Bad request');
            }

            return Promise.reject('Unknown url.');
        });
        spyOn(requestPromise, 'post');

        commentOnClosedIssue._implementation('issueUrl', 'commentsUrl', headers)
            .then(done.fail)
            .catch(function (error) {
                expect(error).toEqual('Bad request');
                expect(requestPromise.post).not.toHaveBeenCalled();
                done();
            });
    });
});
