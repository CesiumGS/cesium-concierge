'use strict';
var RegexTools = require('../../lib/RegexTools');

var getGoogleGroupLinks = RegexTools.getGoogleGroupLinks;
var getGitHubIssueLinks = RegexTools.getGitHubIssueLinks;

describe('getUnique', function() {

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

describe('GitHub regex works correctly', function() {
    var comments = [];
    beforeEach(function() {
        comments = [
            '',
            'this has no github link',
            'https://github.com/AnalyticalGraphicsInc/agi-cesium-people/issues/156',
            'https://github.com/AnalyticalGraphicsInc/agi-cesium-people/issues/4920?fdsf=fdsf',
            'https://github.com/AnalyticalGraphicsInc/agi-cesium-people/issues/',
            'https://github.com/AnalyticalGraphicsInc/agi-cesium-people/issues/3, https://github.com/AnalyticalGraphicsInc/agi-cesium-people/issues/156120'
        ];
    });

    it('Returns [] when comments is undefined', function() {
        expect(getGitHubIssueLinks()).toEqual([]);
    });

    it('Finds correct number of unique links', function() {
        expect(getGitHubIssueLinks(comments).length).toEqual(4);
    });
    // TODO - More tests
});
