'use strict';
var Cesium = require('cesium');

var defined = Cesium.defined;

module.exports = {
    findGoogleGroupLinksWithRegex: findGoogleGroupLinksWithRegex,
    findGitHubIssueLinksWithRegex: findGitHubIssueLinksWithRegex,
    regexSearch: regexSearch
};

/** Find unique GoogleGroup links in body of comments
 *
 * @param {String[]} comments The returned comments from GitHub.
 * @return {String[] | undefined} Unique links
 */
function findGoogleGroupLinksWithRegex(comments) {
    if (!defined(comments)) {
        return;
    }
    var linkMatches = [];
    comments.forEach(function(comment) {
        regexSearch(comment, /https?:\/\/groups\.google\.com[^\s.,:]*/ig, linkMatches);
    });
    return linkMatches;
}

/** Find unique issue links in body of comments
 *
 * @param {String[]} comments The returned comments from GitHub.
 * @return {String[] | undefined} Unique links
 */
function findGitHubIssueLinksWithRegex(comments) {
    if (!defined(comments)) {
        return;
    }
    var linkMatches = [];
    comments.forEach(function(comment) {
        regexSearch(comment, /https:\/\/github\.com[^\s.,:]*/ig, linkMatches);
    });
    return linkMatches;
}

/** Generic regex search over block of text. Requires global regex!
 *
 * @param {String} text
 * @param {Object} regex
 * @param {String[]} matches Already-matched strings. Warning: mutated in this function.
 * @returns undefined
 */
function regexSearch(text, regex, matches) {
    var matchResult;
    while ((matchResult = regex.exec(text)) !== null) {
        if (!matches.includes(matchResult[0])) {
            matches.push(matchResult[0]);
        }
    }
}
