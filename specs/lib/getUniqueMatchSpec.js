'use strict';

var commentOnClosedIssue = require('../../lib/commentOnClosedIssue');
var getUniqueMatch = require('../../lib/getUniqueMatch');

describe('getUniqueMatch', function () {
    var t1 = ['a', 'b', 'c', 'd'];
    var t2 = ['a', 'a', 'b', 'bb', 'c', 'aaa', 'cab', 'c'];

    it('returns [] when parameters are undefined', function () {
        expect(getUniqueMatch()).toEqual([]);
        expect(getUniqueMatch(['array'])).toEqual([]);
    });

    it('throws error if not passed an array', function () {
        expect(function () {
            getUniqueMatch('not array', /a/);
        }).toThrowError(TypeError);
    });

    it('finds unique matches', function () {
        expect(getUniqueMatch(t1, /[a-z]/g)).toEqual(t1);
        expect(getUniqueMatch(t2, /[a-z]/g)).toEqual(['a', 'b', 'c']);
    });
});
