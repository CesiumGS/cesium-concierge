'use strict';

var Cesium = require('cesium');

var defined = Cesium.defined;
var RuntimeError = Cesium.RuntimeError;

module.exports = parseBoolean;

/**
 * Helper function for parsing boolean values from nconf.
 *
 * undefined, null, 0, '0', false, and 'false' are considered false.
 * 1, '1', true, and 'true' are considered true.
 * Everything else is a RuntimeError.
 *
 * @param {Any} value The value to be parsed.
 * @returns {boolean} The parsed boolean.
 */
function parseBoolean(value) {
    if (!defined(value)) {
        return false;
    }

    if (typeof value === 'boolean') {
        return value;
    }

    var numericValue = Number(value);
    if (numericValue === 1) {
        return true;
    }

    if (numericValue === 0) {
        return false;
    }

    if (/^TRUE$/i.test(value)) {
        return true;
    }

    if (/^FALSE$/i.test(value)) {
        return false;
    }

    throw new RuntimeError('Invalid configuration option');
}
