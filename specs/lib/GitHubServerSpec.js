'use strict';
var GitHubServer = require('../../lib/GitHubServer');
var rp = require('request-promise');

describe('postComment and get work as expected', function() {
    var server = new GitHubServer('agent', '1234');

    it('sets User-Agent and token correctly', function() {
        expect(server.headers['User-Agent']).toEqual('agent');
        expect(server.headers.Authorization).toEqual('token 1234');
    });

    it('postComment returns undefined if `url` or `message` is undefined', function() {
        expect(server.postComment()).toBe(undefined);
        expect(server.postComment('url')).toBe(undefined);
    });

    it('get returns undefined if `url` is undefined', function() {
        expect(server.get()).toBe(undefined);
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

describe('BumpAllPullRequests', function() {

});
