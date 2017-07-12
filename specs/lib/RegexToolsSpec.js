'use strict';
var RegexTools = require('../../lib/RegexTools');

var getGoogleGroupLinks = RegexTools.getGoogleGroupLinks;

describe('RegexTools._getUniqueMatch', function() {
    var t1 = ['a', 'b', 'c', 'd'];
    var t2 = ['a', 'a', 'b', 'bb', 'c', 'aaa', 'cab', 'c'];

    it('returns [] when parameters are undefined', function() {
        expect(RegexTools._getUniqueMatch()).toEqual([]);
        expect(RegexTools._getUniqueMatch(['array'])).toEqual([]);
    });

    it('throws error if not passed an array', function() {
        expect(function() {
            RegexTools._getUniqueMatch('not array', /a/);
        }).toThrowError(TypeError);
    });

    it('finds unique matches', function() {
        expect(RegexTools._getUniqueMatch(t1, /[a-z]/g)).toEqual(t1);
        expect(RegexTools._getUniqueMatch(t2, /[a-z]/g)).toEqual(['a', 'b', 'c']);
    });
});

describe('RegexTools.getGoogleGroupLinks', function() {
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

    it('Returns [] when comments is undefined', function() {
        expect(getGoogleGroupLinks()).toEqual([]);
    });

    it('Finds correct number of unique links', function() {
        expect(getGoogleGroupLinks(comments).length).toEqual(6);
    });

    it('Returns links intact', function() {
        expect(getGoogleGroupLinks([comments[2]])).toEqual([comments[2]]);
        expect(getGoogleGroupLinks([comments[3]])).toEqual([comments[3]]);
        expect(getGoogleGroupLinks([comments[4]])).toEqual([comments[4]]);
    });

    it('Finds link when surrounded by text', function() {
        expect(getGoogleGroupLinks([comments[6]])).toEqual(['https://groups.google.com/forum/?hl=en#!topic/cesium-dev/fewafjdsk']);
    });

    it('Finds two links in the same comment', function() {
        expect(getGoogleGroupLinks([comments[7]])).toEqual(['https://groups.google.com/forum/?hl=en#!topic/cesium-dev/test1', 'https://groups.google.com/forum/?hl=en#!topic/cesium-dev/test2']);
    });
});
