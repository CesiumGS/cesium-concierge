'use strict';
var GitHubServer = require('../../lib/GitHubServer');

var regexTest = GitHubServer.findLinksWithRegex;
var googleGroupRegex = GitHubServer.googleGroupRegex;

describe('Regex work correctly', function() {
    var comments = [];
    beforeEach(function() {
        comments = [
            { body: '' },
            { body: 'this has no google link' },
            { body: 'https://groups.google.com/' },
            { body: 'http://groups.google.com/'},
            { body: 'https://groups.google.com/forum/?hl=en#!topic/cesium-dev/x02lygB7hYc' },
            { body: 'https://groups.google.com/forum/?hl=en#!topic/cesium-dev/x02lygB7hYc' }
        ];
    });

    it('Finds correct number of unique links', function() {
        expect(regexTest(comments).length).toEqual(3);
    });
});
