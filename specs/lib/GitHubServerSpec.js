'use strict';
var GitHubServer = require('../../lib/GitHubServer');

var findLinksWithRegex = GitHubServer.findLinksWithRegex;

describe('postComment and getComments work as expected', function() {
    var server = new GitHubServer('agent', '1234');

    it('sets User-Agent and token correctly', function() {
        expect(server.headers['User-Agent']).toEqual('agent');
        expect(server.headers.Authorization).toEqual('token 1234');
    });

    it('postComment returns undefined if `url` or `message` is undefined', function() {
        expect(server.postComment()).toBe(undefined);
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
