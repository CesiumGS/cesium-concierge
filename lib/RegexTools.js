'use strict';
var Cesium = require('cesium');

var defined = Cesium.defined;

module.exports = {
    getGoogleGroupLinks: getGoogleGroupLinks,
    getGitHubIssueLinks: getGitHubIssueLinks,
    getUnique: getUnique
};

/** Find unique GoogleGroup links in array of strings
 *
 * @param {String[]} text
 * @return {String[]} Unique links
 */
function getGoogleGroupLinks(textArray) {
    if (!defined(textArray)) {
        return [];
    }
    var linkMatches = [];
    textArray.forEach(function(text) {
        getUnique(text, /https?:\/\/groups\.google\.com[^\s.,:]*/ig, linkMatches);
    });
    return linkMatches;
}

/** Find unique issue links in array of strings
 *
 * @param {String[]} text
 * @return {String[]} Unique links
 */
function getGitHubIssueLinks(textArray) {
    if (!defined(textArray)) {
        return [];
    }
    var linkMatches = [];
    textArray.forEach(function(comment) {
        getUnique(comment, /https:\/\/github\.com[^\s.,]*\/issues\/\d+[^\s.,:]*/ig, linkMatches);
    });
    return linkMatches;
}

/** Generic regex search over block of text. (Requires global regex)
 *
 * @param {String} text
 * @param {Object} regex
 * @param {String[]} matches Already-matched strings. Warning: mutated in this function.
 * @returns undefined
 */
function getUnique(text, regex, matches) {
    var matchResult;
    while ((matchResult = regex.exec(text)) !== null) {
        if (!matches.includes(matchResult[0])) {
            matches.push(matchResult[0]);
        }
    }
}
