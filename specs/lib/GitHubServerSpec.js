'use strict';
var fsExtra = require('fs-extra');
var GitHubServer = require('../../lib/GitHubServer');
var rp = require('request-promise');

describe('postComment and get work as expected', function() {
    var server;
    beforeEach(function() {
        server = new GitHubServer('agent', '1234');
    });

    it('sets User-Agent and token correctly', function() {
        expect(server.headers['User-Agent']).toEqual('agent');
        expect(server.headers.Authorization).toEqual('token 1234');
    });

    it('postComment returns rejected Promise if `url` or `message` is undefined', function(done) {
        server.postComment().then(function() {
            done(new Error('Promise should not be resolved'));
        }, function() {
            done();
        });
        server.postComment('url').then(function() {
            done(new Error('Promise should not be resolved'));
        }, function() {
            done();
        });
    });

    it('get returns undefined if `url` is undefined', function(done) {
        server.get().then(function() {
            done(new Error('Promise should not be resolved'));
        }, function () {
            done();
        });
    });

    it('request-promise receives well-formated POST for `postComment`', function() {
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

        spyOn(rp, 'post').and.callFake(function(postJson) {
            expect(postJson).toEqual(expected);
        });

        server.postComment('http://test', 'hello');
    });

    it('request-promise receives well-formated GET for `get`', function() {
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

describe('Static helper functions', function() {
    it('getCommentsFromResponse returns [] if parameter is undefined', function() {
        expect(GitHubServer.getCommentsFromResponse()).toEqual([]);
    });

    it('getCommentsFromResponse returns array of strings', function() {
        var issueJson = fsExtra.readJsonSync('./specs/issueComments.json');
        expect(GitHubServer.getCommentsFromResponse(issueJson)).toEqual(['Me too']);
    });
});

describe('issue.htmlUrlToApi', function() {
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

describe('BumpAllPullRequests', function() {

});
