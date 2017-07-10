'use strict';
var Cesium = require('cesium');
var defined = Cesium.defined;

var RegexTools = {};
module.exports = RegexTools;

var googleLinkRegex = /https?:\/\/groups\.google\.com[^\s.,:]*/ig;
var gitHubLinkRegex = /https:\/\/github\.com[^\s.,]*\/issues\/\d+[^\s.,:]*/ig;

/** Find unique GoogleGroup links in array of strings
 *
 * @param {String[]} textArray
 * @return {String[]} Unique links
 */
RegexTools.getGoogleGroupLinks = function(textArray) {
    return getUniqueMatch(textArray, googleLinkRegex);
};

/** Find unique issue links in array of strings
 *
 * @param {String[]} textArray
 * @return {String[]} Unique links
 */
RegexTools.getGitHubIssueLinks = function(textArray) {
    return getUniqueMatch(textArray, gitHubLinkRegex);
};

/** Generic regex search over array of String. (Requires global regex)
 *
 * @param {String[]} textArray
 * @param {Object} regex
 * @param {String[]} matches Already-matched strings. Warning: mutated in this function.
 * @returns {String[]}
 */
function getUniqueMatch(textArray, regex) {
    var matches = [];
    var matchResult;
    if (!defined(textArray)) {
        return [];
    }
    textArray.forEach(function(text){
        while ((matchResult = regex.exec(text)) !== null) {
            if (!matches.includes(matchResult[0])) {
                matches.push(matchResult[0]);
            }
        }
    });
    return matches;
}
