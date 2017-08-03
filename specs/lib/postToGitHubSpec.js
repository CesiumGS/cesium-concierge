'use strict';

var fsExtra = require('fs-extra');
var nconf = require('nconf');
var Promise = require('bluebird');

var commentOnClosedIssue = require('../../lib/commentOnClosedIssue');
var commentOnOpenedPullRequest = require('../../lib/commentOnOpenedPullRequest');
var postToGitHub = require('../../lib/postToGitHub');

describe('postToGitHub', function () {
    var successResponse = {
        status: function (code) {
            expect(code).toEqual(200);
            return {
                send: function () {
                }
            };
        }
    };

    it('returns error if `repository` is not in `repositoryNames`', function () {
        var reqSimplePullRequest = {
            headers: {
                'x-github-event': 'pull_request'
            },
            body: {
                repository: {
                    full_name: 'agi/uno'
                }
            }
        };
        spyOn(nconf, 'get').and.returnValue({
            'agi/one/': {},
            'agi/two': {}
        });
        postToGitHub(reqSimplePullRequest, {}, function (err) {
            expect(err.message).toMatch(/Could not find/);
        });
    });

    it('calls commentOnClosedIssue', function (done) {
        var reqClosedIssue = {
            headers: {
                'x-github-event': 'issues'
            }
        };
        reqClosedIssue.body = fsExtra.readJsonSync('./specs/data/events/issue.json');
        reqClosedIssue.body.action = 'closed';
        spyOn(nconf, 'get').and.returnValue({
            'baxterthehacker/public-repo': {
                gitHubToken: '',
                remindForum: true
            }
        });
        spyOn(commentOnClosedIssue, '_implementation');
        postToGitHub(reqClosedIssue, successResponse, function (err) {
            var obj = commentOnClosedIssue._implementation.calls.argsFor(0);
            expect(obj[0]).toEqual('https://api.github.com/repos/baxterthehacker/public-repo/issues/2');
            expect(obj[1]).toEqual('https://api.github.com/repos/baxterthehacker/public-repo/issues/2/comments');
            // ignore expected error
            if (/did not match any events/.test(err)) {
                return done();
            }
            done.fail(err);
        });
    });

    it('calls commentOnOpenedPullRequest', function (done) {
        var reqClosedIssue = {
            headers: {
                'x-github-event': 'pull_request'
            }
        };
        reqClosedIssue.body = fsExtra.readJsonSync('./specs/data/events/pullRequest.json');
        spyOn(nconf, 'get').and.returnValue({
            'baxterthehacker/public-repo': {
                gitHubToken: '',
                checkChangesMd: true
            }
        });
        spyOn(commentOnOpenedPullRequest, '_implementation');
        postToGitHub(reqClosedIssue, successResponse, function (err) {
            var obj = commentOnOpenedPullRequest._implementation.calls.argsFor(0);
            expect(obj[0]).toEqual('https://api.github.com/repos/baxterthehacker/public-repo/pulls/1/files');
            expect(obj[1]).toEqual('https://api.github.com/repos/baxterthehacker/public-repo/issues/1/comments');
            expect(obj[4]).toBe(true);
            // ignore expected error
            if (/did not match any events/.test(err)) {
                return done();
            }
            done.fail(err);
        });
    });

    it('calls next with Error when Promise fails', function (done) {
        var reqClosedIssue = {
            headers: {
                'x-github-event': 'pull_request'
            }
        };
        reqClosedIssue.body = fsExtra.readJsonSync('./specs/data/events/pullRequest.json');
        spyOn(nconf, 'get').and.returnValue({
            'baxterthehacker/public-repo': {
                gitHubToken: '',
                checkChangesMd: true
            }
        });
        spyOn(commentOnOpenedPullRequest, '_implementation').and.returnValue(Promise.reject('uh-oh'));
        postToGitHub(reqClosedIssue, successResponse, function (err) {
            if (/uh-oh/.test(err)) {
                return done();
            }
            done.fail(err);
        });
    });

    it('calls next if everything works', function (done) {
        var reqClosedIssue = {
            headers: {
                'x-github-event': 'pull_request'
            }
        };
        reqClosedIssue.body = fsExtra.readJsonSync('./specs/data/events/pullRequest.json');
        spyOn(nconf, 'get').and.returnValue({
            'baxterthehacker/public-repo': {
                gitHubToken: '',
                checkChangesMd: true
            }
        });
        spyOn(commentOnOpenedPullRequest, '_implementation').and.returnValue(Promise.resolve({}));
        postToGitHub(reqClosedIssue, successResponse, function (err) {
            if (err) {
                return done.fail(err);
            }
            done();
        });
    });
});
