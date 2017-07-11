'use strict';
var Cesium = require('cesium');
var defined = Cesium.defined;

var RegexTools = {};
module.exports = RegexTools;

var googleLinkRegex = /https?:\/\/groups\.google\.com[^\s.,:]*/ig;
var gitHubLinkRegex = /https:\/\/github\.com[^\s.,]*\/issues\/\d+[^\s.,:]*/ig;

/** Find unique GoogleGroup links in array of strings
 *
 * @param {String[]} textArray Array of strings to regex search
 * @return {String[]} Unique links
 */
RegexTools.getGoogleGroupLinks = function(textArray) {
    return RegexTools._getUniqueMatch(textArray, googleLinkRegex);
};

/** Find unique issue links in array of strings
 *
 * @param {String[]} textArray Array of strings to regex search
 * @return {String[]} Unique links
 */
RegexTools.getGitHubIssueLinks = function(textArray) {
    return RegexTools._getUniqueMatch(textArray, gitHubLinkRegex);
};

/** Generic regex search over array of String. (Requires global regex)
 *
 * @private
 * @param {String[]} textArray Array of strings to regex search
 * @param {Object} regex Global Regex
 * @returns {String[]} Unique matches of the regex
 */
RegexTools._getUniqueMatch = function(textArray, regex) {
    var matches = [];
    var matchResult;
    if (!defined(textArray) || !defined(regex)) {
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
};
