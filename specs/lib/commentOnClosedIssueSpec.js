'use strict';

var fsExtra = require('fs-extra');
var Promise = require('bluebird');
var requestPromise = require('request-promise');

var getUniqueMatch = require('../../lib/getUniqueMatch');

var commentOnClosedIssue = require('../../lib/commentOnClosedIssue');

describe('commentOnClosedIssue', function() {
    it('throws if `url` or `message` is undefined', function () {
        expect(function() {
            commentOnClosedIssue();
        }).toThrowError();

        expect(function() {
            commentOnClosedIssue({});
        }).toThrowError();
    });

    it('passes correct commentsUrl to _implementation', function() {
        spyOn(commentOnClosedIssue, '_implementation').and.callFake(function(commentsUrl) {
            expect(commentsUrl).toEqual('https://api.github.com/repos/baxterthehacker/public-repo/issues/2/comments');
        });

        commentOnClosedIssue(fsExtra.readJsonSync('./specs/data/issueResponse.json'), {});
    });
});

describe('commentOnClosedIssue._implementation', function() {
    var commentsJson = fsExtra.readJsonSync('./specs/data/issueComments.json');
    beforeEach(function() {
        spyOn(requestPromise, 'get').and.returnValue(Promise.resolve(commentsJson));
        spyOn(requestPromise, 'post');
    });

    it('gets the list of comments', function() {
        spyOn(getUniqueMatch, '_implementation').and.callFake(function(comments) {
            expect(comments).toEqual(['Sup.', 'Hi.', 'Howdy.']);
        });
        commentOnClosedIssue(fsExtra.readJsonSync('./specs/data/issueResponse.json'), {});
    });
});
