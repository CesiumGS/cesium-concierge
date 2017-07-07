'use strict';
var GitHubServer = require('../../lib/GitHubServer');
var rp = require('request-promise');

var findGoogleGroupLinksWithRegex = GitHubServer.findGoogleGroupLinksWithRegex;

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

describe('GoogleGroup Regex work correctly', function() {
    var comments = [];
    beforeEach(function() {
        comments = [
            '',
            'this has no google link',
            'https://groups.google.com/',
            'http://groups.google.com/',
            'https://groups.google.com/forum/?hl=en#!topic/cesium-dev/x02lygB7hYc',
            'https://groups.google.com/forum/?hl=en#!topic/cesium-dev/x02lygB7hYc',
            'Reported here: https://groups.google.com/forum/?hl=en#!topic/cesium-dev/fewafjdsk\n\nSeen with Chrome 59.0.3071.102. iOS version: 10.3.2. Perhaps a driver issue?\n',
            'https://groups.google.com/forum/?hl=en#!topic/cesium-dev/test1, https://groups.google.com/forum/?hl=en#!topic/cesium-dev/test2'];
    });

    it('Finds correct number of unique links', function() {
        expect(findGoogleGroupLinksWithRegex(comments).length).toEqual(6);
    });

    it('Returns links intact', function() {
        expect(findGoogleGroupLinksWithRegex([comments[2]])).toEqual([comments[2]]);
        expect(findGoogleGroupLinksWithRegex([comments[3]])).toEqual([comments[3]]);
        expect(findGoogleGroupLinksWithRegex([comments[4]])).toEqual([comments[4]]);
    });

    it('Finds link when surrounded by text', function() {
        expect(findGoogleGroupLinksWithRegex([comments[6]])).toEqual(['https://groups.google.com/forum/?hl=en#!topic/cesium-dev/fewafjdsk']);
    });

    it('Finds two links in the same comment', function() {
        expect(findGoogleGroupLinksWithRegex([comments[7]])).toEqual(['https://groups.google.com/forum/?hl=en#!topic/cesium-dev/test1', 'https://groups.google.com/forum/?hl=en#!topic/cesium-dev/test2']);
    });
});

describe('BumpAllPullRequests', function() {
    xit('works', function() {

    });
});
