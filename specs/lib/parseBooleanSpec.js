'use strict';

var parseBoolean = require('../../lib/parseBoolean');

describe('parseBoolean', function () {
    it('returns existing boolean value', function () {
        expect(parseBoolean(true)).toBe(true);
        expect(parseBoolean(false)).toBe(false);
    });

    it('parses numeric value', function () {
        expect(parseBoolean(1)).toBe(true);
        expect(parseBoolean(0)).toBe(false);
    });

    it('parses string boolean value', function () {
        expect(parseBoolean('trUe')).toBe(true);
        expect(parseBoolean('1')).toBe(true);
        expect(parseBoolean('')).toBe(false);
        expect(parseBoolean('faLse')).toBe(false);
        expect(parseBoolean('0')).toBe(false);
    });

    it('parses undefined values', function () {
        expect(parseBoolean(undefined)).toBe(false);
        expect(parseBoolean(null)).toBe(false);
    });

    it('throws with invalid parameters', function () {
        expect(function () {
            parseBoolean({});
        }).toThrowError();

        expect(function () {
            parseBoolean(2);
        }).toThrowError();

        expect(function () {
            parseBoolean('2');
        }).toThrowError();
    });
});
