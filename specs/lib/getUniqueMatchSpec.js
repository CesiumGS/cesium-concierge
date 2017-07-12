'use strict';

var commentOnClosedIssue = require('../../lib/commentOnClosedIssue');
var getUniqueMatch = require('../../lib/getUniqueMatch');

var googleLinkRegex = commentOnClosedIssue._googleLinkRegex;

describe('getUniqueMatch', function() {
    var t1 = ['a', 'b', 'c', 'd'];
    var t2 = ['a', 'a', 'b', 'bb', 'c', 'aaa', 'cab', 'c'];

    it('returns [] when parameters are undefined', function() {
        expect(getUniqueMatch()).toEqual([]);
        expect(getUniqueMatch(['array'])).toEqual([]);
    });

    it('throws error if not passed an array', function() {
        expect(function() {
            getUniqueMatch('not array', /a/);
        }).toThrowError(TypeError);
    });

    it('finds unique matches', function() {
        expect(getUniqueMatch(t1, /[a-z]/g)).toEqual(t1);
        expect(getUniqueMatch(t2, /[a-z]/g)).toEqual(['a', 'b', 'c']);
    });
});

describe('Google Group regex', function() {
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
        expect(getUniqueMatch(comments, googleLinkRegex).length).toEqual(6);
    });

    it('Returns links intact', function() {
        expect(getUniqueMatch([comments[2]], googleLinkRegex)).toEqual([comments[2]]);
        expect(getUniqueMatch([comments[3]], googleLinkRegex)).toEqual([comments[3]]);
        expect(getUniqueMatch([comments[4]], googleLinkRegex)).toEqual([comments[4]]);
    });

    it('Finds link when surrounded by text', function() {
        expect(getUniqueMatch([comments[6]], googleLinkRegex)).toEqual(['https://groups.google.com/forum/?hl=en#!topic/cesium-dev/fewafjdsk']);
    });

    it('Finds two links in the same comment', function() {
        expect(getUniqueMatch([comments[7]], googleLinkRegex)).toEqual(['https://groups.google.com/forum/?hl=en#!topic/cesium-dev/test1', 'https://groups.google.com/forum/?hl=en#!topic/cesium-dev/test2']);
    });
});
