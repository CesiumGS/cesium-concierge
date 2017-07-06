'use strict';
var app = require('../index');
var regexTest = app.findLinksWithRegex;
var googleGroupRegex = app.googleGroupRegex;

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
        ]
    });

    it('Finds correct number of unique links', function() {
        expect(regexTest(comments, googleGroupRegex).length).toEqual(3);
    });
});
