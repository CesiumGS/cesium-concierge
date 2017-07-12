'use strict';
var fsExtra = require('fs-extra');

var commentOnClosedIssue = require('../../lib/commentOnClosedIssue');

describe('commentOnClosedIssue', function() {
    it('returns rejected Promise if `url` or `message` is undefined', function (done) {
        commentOnClosedIssue().then(function () {
            done(new Error('Promise should not be resolved'));
        }, function () {
            done();
        });
        commentOnClosedIssue({}).then(function () {
            done(new Error('Promise should not be resolved'));
        }, function () {
            done();
        });
    });
});

describe('commentOnClosedIssue._getCommentsFromResponse', function() {
    it('returns [] if parameter is undefined', function() {
        expect(commentOnClosedIssue._getCommentsFromResponse()).toEqual([]);
    });

    it('returns array of strings', function() {
        var issueJson = fsExtra.readJsonSync('./specs/data/issueComments.json');
        expect(commentOnClosedIssue._getCommentsFromResponse(issueJson)).toEqual(['Me too']);
    });

    it('returns array of undefined if pass malformed JSON', function() {
        var issueJson = fsExtra.readJsonSync('./specs/data/issueComments.bad.json');
        expect(commentOnClosedIssue._getCommentsFromResponse(issueJson)).toEqual([undefined, undefined]);
    });
});
