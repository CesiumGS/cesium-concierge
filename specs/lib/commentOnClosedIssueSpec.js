'use strict';

var fsExtra = require('fs-extra');
var Promise = require('bluebird');
var requestPromise = require('request-promise');

var commentOnClosedIssue = require('../../lib/commentOnClosedIssue');
var getUniqueMatch = require('../../lib/getUniqueMatch');

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
    var issueJson = fsExtra.readJsonSync('./specs/data/issueResponse.json');
    var issueEventJson = fsExtra.readJsonSync('./specs/data/issueEvent.json');

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
