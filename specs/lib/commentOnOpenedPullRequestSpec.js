'use strict';

var fsExtra = require('fs-extra');
var Promise = require('bluebird');
var requestPromise = require('request-promise');

var commentOnOpenedPullRequest = require('../../lib/commentOnOpenedPullRequest');

describe('commentOnOpenedPullRequest._didUpdateChanges', function () {
    it('returns false for []', function () {
        expect(commentOnOpenedPullRequest._didUpdateChanges([])).toEqual(false);
    });

    it('returns true for CHANGES.md at top level', function () {
        expect(commentOnOpenedPullRequest._didUpdateChanges(['CHANGES.md'])).toEqual(true);
        expect(commentOnOpenedPullRequest._didUpdateChanges(['/test/test.txt', '/a/b/c', 'CHANGES.md'])).toEqual(true);
        expect(commentOnOpenedPullRequest._didUpdateChanges(['/a', './CHANGES.md', 'b'])).toEqual(true);
    });

    it('returns false for closely-named CHANGES.md files', function () {
        expect(commentOnOpenedPullRequest._didUpdateChanges(['CHANGES.txt'])).toEqual(false);
        expect(commentOnOpenedPullRequest._didUpdateChanges(['CHANGES.old.md'])).toEqual(false);
        expect(commentOnOpenedPullRequest._didUpdateChanges(['.CHANGES.md'])).toEqual(false);
        expect(commentOnOpenedPullRequest._didUpdateChanges(['/CHANGES'])).toEqual(false);
    });

    it('returns false for CHANGES.md at other levels', function () {
        expect(commentOnOpenedPullRequest._didUpdateChanges(['./a/CHANGES.md', './b/CHANGES.md'])).toEqual(false);
        expect(commentOnOpenedPullRequest._didUpdateChanges(['/a/b/c/CHANGES.md'])).toEqual(false);
    });
});
