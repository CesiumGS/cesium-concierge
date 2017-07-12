'use strict';
var getUniqueMatch = require('./getUniqueMatch');

/** Find unique GoogleGroup links in array of strings
 *
 * @param {String[]} textArray Array of strings to regex search
 * @return {String[]} Unique links
 */
var googleLinkRegex = /https?:\/\/groups\.google\.com[^\s.,:]*/ig;

module.exports = function getGoogleGroupLinks(textArray) {
    return getUniqueMatch(textArray, googleLinkRegex);
};
