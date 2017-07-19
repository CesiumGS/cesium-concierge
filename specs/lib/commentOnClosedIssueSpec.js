'use strict';

var fsExtra = require('fs-extra');
var Promise = require('bluebird');
var requestPromise = require('request-promise');

var commentOnClosedIssue = require('../../lib/commentOnClosedIssue');
var getUniqueMatch = require('../../lib/getUniqueMatch');

var issueEventJson = fsExtra.readJsonSync('./specs/data/issueEvent.json');
var issueJson = fsExtra.readJsonSync('./specs/data/issueResponse.json');

describe('commentOnClosedIssue', function () {
    it('throws if `jsonResponse` is undefined', function () {
        expect(function () {
            commentOnClosedIssue(undefined);
        }).toThrowError();
    });

    it('throws if `headers` is undefined', function () {
        expect(function () {
            commentOnClosedIssue({}, undefined);
        }).toThrowError();
    });

    it('passes correct issueUrl and commentsUrl to _implementation', function () {
        spyOn(commentOnClosedIssue, '_implementation');
        commentOnClosedIssue(fsExtra.readJsonSync('./specs/data/issueEvent.json'), {test: true});
        expect(commentOnClosedIssue._implementation).toHaveBeenCalledWith('https://api.github.com/repos/baxterthehacker/public-repo/issues/2',
            'https://api.github.com/repos/baxterthehacker/public-repo/issues/2/comments', {test: true});
    });
});

describe('commentOnClosedIssue._implementation', function () {
    var commentsJson = fsExtra.readJsonSync('./specs/data/issueComments.json');

    beforeEach(function () {
        spyOn(commentOnClosedIssue, 'get').and.callFake(function (url) {
            if (/\/comments/.test(url)) {
                return Promise.resolve(commentsJson);
            }
            return Promise.resolve(issueJson);
        });
        spyOn(requestPromise, 'post');
    });

    it('gets the list of comments', function (done) {
        spyOn(getUniqueMatch, '_implementation').and.callThrough();
        commentOnClosedIssue(issueEventJson, {}).then(function () {
            expect(getUniqueMatch._implementation).toHaveBeenCalledWith(['I\'m having a problem with this.', 'Sup.', 'Hi.', 'Howdy.'], commentOnClosedIssue._googleLinkRegex);
            done();
        }).catch(function () {
            done.fail();
        });
    });

    it('returns Promise and does not call requestPromise.post if no linkMatches', function (done) {
        spyOn(getUniqueMatch, '_implementation').and.returnValue([]);
        commentOnClosedIssue(issueEventJson, {}).then(function () {
            expect(requestPromise.post).not.toHaveBeenCalled();
            done();
        }).catch(function () {
            done.fail();
        });
    });

    it('calls requestPromise.post with correct values', function (done) {
        spyOn(getUniqueMatch, '_implementation').and.returnValue(['https://example.com']);
        commentOnClosedIssue(issueEventJson, {test: true})
            .then(function () {
                var obj = requestPromise.post.calls.argsFor(0)[0];
                expect(obj.uri).toEqual('https://api.github.com/repos/baxterthehacker/public-repo/issues/2/comments');
                expect(obj.headers).toEqual({test: true});
                expect(obj.json).toEqual(true);
                done();
            })
            .catch(function (err) {
                done.fail(err);
            });
    });
});

describe('commentOnClosedIssue._implementation detects bad statusCodes', function () {
    var issueJson404 = fsExtra.readJsonSync('./specs/data/issueResponse_404.json');
    var commentsJson404 = fsExtra.readJsonSync('./specs/data/issueComments_404.json');

    it('returns rejected Promise if statusCode for issue !== 200', function (done) {
        spyOn(requestPromise, 'post');
        spyOn(commentOnClosedIssue, 'get').and.returnValue(Promise.resolve(issueJson404));
        commentOnClosedIssue(issueEventJson, {test: true})
        .then(function () {
            done.fail();
        })
        .catch(function () {
            done();
        });
    });

    it('returns rejected Promise if statusCode for issue comments !== 200', function (done) {
        spyOn(requestPromise, 'post');
        spyOn(commentOnClosedIssue, 'get').and.callFake(function (url) {
            if (/\/comments/.test(url)) {
                return Promise.resolve(commentsJson404);
            }
            return Promise.resolve(issueJson);
        });
        commentOnClosedIssue(issueEventJson, {test: true})
            .then(function () {
                done.fail();
            })
            .catch(function () {
                done();
            });
    });
});

describe('commentOnClosedIssue.get', function () {
    it('calls request-promise.get with correct parameters', function () {
        spyOn(requestPromise, 'get');
        commentOnClosedIssue.get('www.example.com', { test: true });
        expect(requestPromise.get).toHaveBeenCalledWith({
            uri: 'www.example.com',
            headers: { test: true },
            json: true,
            resolveWithFullResponse: true
        });
    });
});
