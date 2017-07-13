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
    var empty = '';
    var noLink = 'this has no google link';
    var sslLink = 'https://groups.google.com/';
    var noSslLink = 'http://groups.google.com/';
    var surroundedText = 'Reported here: https://groups.google.com/forum/?hl=en#!topic/cesium-dev/fewafjdsk\n\nSeen with Chrome 59.0.3071.102. iOS version: 10.3.2. Perhaps a driver issue?\n';
    var commaAtEnd = 'https://groups.google.com/forum/?hl=en#!topic/cesium-dev/test1, fdsfoewjaf fjdsa f';
    var twoLinks = 'https://groups.google.com/forum/?hl=en#!topic/cesium-dev/test2, https://groups.google.com/forum/?hl=en#!topic/cesium-dev/test5';
    var twoSameLinks = 'https://groups.google.com/forum/?hl=en#!topic/cesium-dev/test2, https://groups.google.com/forum/?hl=en#!topic/cesium-dev/test2, https://groups.google.com/forum/?hl=en#!topic/cesium-dev/test3';

    it('Returns empty array for ""', function() {
        expect(getUniqueMatch([empty], googleLinkRegex)).toEqual([]);
    });

    it('Returns empty array if `textArray` is undefined', function() {
        expect(getUniqueMatch(undefined)).toEqual([]);
    });

    it('Returns empty array if `regex` is undefined', function() {
        expect(getUniqueMatch(['test'], undefined)).toEqual([]);
    });

    it('Finds correct number of unique links', function() {
        expect(getUniqueMatch([noLink], googleLinkRegex)).toEqual([]);
        expect(getUniqueMatch([sslLink], googleLinkRegex)).toEqual([sslLink]);
        expect(getUniqueMatch([sslLink, sslLink], googleLinkRegex)).toEqual([sslLink]);
        expect(getUniqueMatch([noSslLink, noSslLink], googleLinkRegex)).toEqual([noSslLink]);
    });

    it('Finds links when surrounded by text', function() {
        expect(getUniqueMatch([surroundedText, surroundedText], googleLinkRegex)).toEqual(['https://groups.google.com/forum/?hl=en#!topic/cesium-dev/fewafjdsk']);
        expect(getUniqueMatch([commaAtEnd], googleLinkRegex)).toEqual(['https://groups.google.com/forum/?hl=en#!topic/cesium-dev/test1']);
        expect(getUniqueMatch([twoLinks], googleLinkRegex)).toEqual(['https://groups.google.com/forum/?hl=en#!topic/cesium-dev/test2', 'https://groups.google.com/forum/?hl=en#!topic/cesium-dev/test5']);
        expect(getUniqueMatch([twoSameLinks], googleLinkRegex)).toEqual(['https://groups.google.com/forum/?hl=en#!topic/cesium-dev/test2', 'https://groups.google.com/forum/?hl=en#!topic/cesium-dev/test3']);
    });
});
