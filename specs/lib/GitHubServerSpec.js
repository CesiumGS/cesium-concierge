'use strict';
var GitHubServer = require('../../lib/GitHubServer');
var rp = require('request-promise');

var findLinksWithRegex = GitHubServer.findLinksWithRegex;

describe('postComment and getComments work as expected', function() {
    var server = new GitHubServer('agent', '1234');

    it('sets User-Agent and token correctly', function() {
        expect(server.headers['User-Agent']).toEqual('agent');
        expect(server.headers.Authorization).toEqual('token 1234');
    });

    it('postComment returns undefined if `url` or `message` is undefined', function() {
        expect(server.postComment()).toBe(undefined);
        expect(server.postComment('url')).toBe(undefined);
    });

    it('getComments returns undefined if `url` is undefined', function() {
        expect(server.getComments()).toBe(undefined);
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

    it('request-promise receives well-formated GET for `getComments`', function() {
        var fakeUrl = 'http://test';
        var expected = {
            uri: fakeUrl,
            headers: server.headers,
            json: true
        };

        spyOn(rp, 'get').and.callFake(function(getJson) {
            expect(getJson).toEqual(expected);
        });

        server.getComments('http://test');
    });
});

describe('Regex work correctly', function() {
    var comments = [];
    beforeEach(function() {
        comments = [
            { body: '' },
            { body: 'this has no google link' },
            { body: 'https://groups.google.com/' },
            { body: 'http://groups.google.com/'},
            { body: 'https://groups.google.com/forum/?hl=en#!topic/cesium-dev/x02lygB7hYc' },
            { body: 'https://groups.google.com/forum/?hl=en#!topic/cesium-dev/x02lygB7hYc' },
            { body: 'Reported here: https://groups.google.com/forum/?hl=en#!topic/cesium-dev/fewafjdsk\n\nSeen with Chrome 59.0.3071.102. iOS version: 10.3.2. Perhaps a driver issue?\n' }
        ];
    });

    it('Finds correct number of unique links', function() {
        expect(findLinksWithRegex(comments).length).toEqual(4);
    });

    it('Returns links intact', function() {
        expect(findLinksWithRegex([comments[2]])).toEqual([comments[2].body]);
        expect(findLinksWithRegex([comments[3]])).toEqual([comments[3].body]);
        expect(findLinksWithRegex([comments[4]])).toEqual([comments[4].body]);
    });

    it('Finds link when surrounded by text', function() {
        expect(findLinksWithRegex([comments[6]])).toEqual(['https://groups.google.com/forum/?hl=en#!topic/cesium-dev/fewafjdsk']);
    });
});
