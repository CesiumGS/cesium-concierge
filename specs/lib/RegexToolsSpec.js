'use strict';
var RegexTools = require('../../lib/RegexTools');

var findGoogleGroupLinksWithRegex = RegexTools.findGoogleGroupLinksWithRegex;
var findGitHubIssueLinksWithRegex = RegexTools.findGitHubIssueLinksWithRegex;

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

    it('Returns undefined when comments is undefined', function() {
        expect(findGoogleGroupLinksWithRegex()).toEqual(undefined);
    });

    it('Finds correct number of unique links', function() {
        expect(findGoogleGroupLinksWithRegex(comments).length).toEqual(6);
    });

    it('Returns links intact', function() {
        expect(findGoogleGroupLinksWithRegex([comments[2]])).toEqual([comments[2]]);
        expect(findGoogleGroupLinksWithRegex([comments[3]])).toEqual([comments[3]]);
        expect(findGoogleGroupLinksWithRegex([comments[4]])).toEqual([comments[4]]);
    });

    it('Finds link when surrounded by text', function() {
        expect(findGoogleGroupLinksWithRegex([comments[6]])).toEqual(['https://groups.google.com/forum/?hl=en#!topic/cesium-dev/fewafjdsk']);
    });

    it('Finds two links in the same comment', function() {
        expect(findGoogleGroupLinksWithRegex([comments[7]])).toEqual(['https://groups.google.com/forum/?hl=en#!topic/cesium-dev/test1', 'https://groups.google.com/forum/?hl=en#!topic/cesium-dev/test2']);
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

    it('Returns undefined when comments is undefined', function() {
        expect(findGitHubIssueLinksWithRegex()).toEqual(undefined);
    });

    it('Finds correct number of unique links', function() {
        expect(findGitHubIssueLinksWithRegex(comments).length).toEqual(4);
    });
    // TODO - More tests
});
