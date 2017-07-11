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

describe('GitHubServer.issue.htmlUrlToApi', function() {
    it('returns undefined when url is undefined', function() {
        expect(GitHubServer.issue.htmlUrlToApi()).toEqual(undefined);
    });

    xit('formats basic links to issues', function() {
        expect(GitHubServer.issue.htmlUrlToApi('https://github.com/AnalyticalGraphicsInc/cesium/issues/5608')).toEqual('https://api.github.com/repos/AnalyticalGraphicsInc/cesium/issues/5608/comments');
        expect(GitHubServer.issue.htmlUrlToApi('https://github.com/AnalyticalGraphicsInc/cesium/issues/5503')).toEqual('https://api.github.com/repos/AnalyticalGraphicsInc/cesium/issues/5503/comments');
    });

    xit('formats links with queries', function() {
        expect(GitHubServer.issue.htmlUrlToApi('https://github.com/AnalyticalGraphicsInc/cesium/issues/5608?this=is&a=test')).toEqual('https://api.github.com/repos/AnalyticalGraphicsInc/cesium/issues/5608/comments');
        expect(GitHubServer.issue.htmlUrlToApi('https://github.com/AnalyticalGraphicsInc/cesium/issues/5503?m=34343&f=232')).toEqual('https://api.github.com/repos/AnalyticalGraphicsInc/cesium/issues/5503/comments');
    });
});

describe('GitHubServer.BumpAllPullRequests', function() {

});
