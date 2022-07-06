'use strict';
const Cesium = require('cesium');
const defined = Cesium.defined;

module.exports = getUniqueMatch;

/** Generic regex search over array of String. (Requires global regex)
 *
 * @param {String[]} textArray Array of strings to regex search
 * @param {Object} regex Global Regex
 * @returns {String[]} Unique matches of the regex
 */
function getUniqueMatch(textArray, regex) {
    if (!defined(textArray) || !defined(regex)) {
        return [];
    }
    return getUniqueMatch._implementation(textArray, regex);
}

getUniqueMatch._implementation = function (textArray, regex) {
    const matches = [];
    let matchResult;
    textArray.forEach(function (text) {
        while ((matchResult = regex.exec(text)) !== null) {
            if (!matches.includes(matchResult[0])) {
                matches.push(matchResult[0]);
            }
        }
    });
    return matches;
};
