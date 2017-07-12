'use strict';
var fsExtra = require('fs-extra');
var GitHubServer = require('../../lib/GitHubServer');
var rp = require('request-promise');

var server;
beforeEach(function () {
    server = new GitHubServer('agent', '1234');
});
describe('GitHubServer constructor', function() {
    it('sets User-Agent and token correctly', function () {
        expect(server.headers['User-Agent']).toEqual('agent');
        expect(server.headers.Authorization).toEqual('token 1234');
    });
});

describe('GitHubServer.postComment', function() {
    it('returns rejected Promise if `url` or `message` is undefined', function (done) {
        server.postComment().then(function () {
            done(new Error('Promise should not be resolved'));
        }, function () {
            done();
        });
        server.postComment('url').then(function () {
            done(new Error('Promise should not be resolved'));
        }, function () {
            done();
        });
    });

    it('sends request-promise a well-formated POST', function () {
        var fakeUrl = 'http://test';
        var fakeMessage = 'hello';
        var expected = {
            uri: fakeUrl,
            headers: server.headers,
            body: {
                'body': fakeMessage
            },
            json: true
        };

        spyOn(rp, 'post').and.callFake(function (postJson) {
            expect(postJson).toEqual(expected);
        });

        server.postComment('http://test', 'hello');
    });
});

describe('GitHubServer.get', function() {
    it('returns rejected Promise if `url` is undefined', function(done) {
        server.get().then(function() {
            done(new Error('Promise should not be resolved'));
        }, function () {
            done();
        });
    });

    it('sends request-promise a well-formated GET request', function() {
        var fakeUrl = 'http://test';
        var expected = {
            uri: fakeUrl,
            headers: server.headers,
            json: true
        };

        spyOn(rp, 'get').and.callFake(function(getJson) {
            expect(getJson).toEqual(expected);
        });

        server.get('http://test');
    });
});

describe('GitHubServer.getCommentsFromResponse', function() {
    it('returns [] if parameter is undefined', function() {
        expect(GitHubServer.getCommentsFromResponse()).toEqual([]);
    });

    it('returns array of strings', function() {
        var issueJson = fsExtra.readJsonSync('./specs/data/issueComments.json');
        expect(GitHubServer.getCommentsFromResponse(issueJson)).toEqual(['Me too']);
    });

    it('returns array of undefined if pass malformed JSON', function() {
        var issueJson = fsExtra.readJsonSync('./specs/data/issueComments.bad.json');
        expect(GitHubServer.getCommentsFromResponse(issueJson)).toEqual([undefined, undefined]);
    });
});

describe('GitHubServer.issue.getCommentsUrl', function() {
    it('returns correct URL', function() {
        var issueJson = fsExtra.readJsonSync('./specs/data/issueResponse.json');
        expect(GitHubServer.issue.getCommentsUrl(issueJson)).toEqual('https://api.github.com/repos/baxterthehacker/public-repo/issues/2/comments');
    });
});

describe('GitHubServer.pullRequest.getCommentsUrl', function() {
    it('returns correct URL', function() {
        var pullRequestJson = fsExtra.readJsonSync('./specs/data/pullRequestResponse.json');
        expect(GitHubServer.pullRequest.getCommentsUrl(pullRequestJson)).toEqual('https://api.github.com/repos/baxterthehacker/public-repo/issues/1/comments');
    });
});
