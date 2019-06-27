'use strict';

var Promise = require('bluebird');

/** A helper function for creating a deferred promise.
 * This should only be used when using an API that does not support
 * promises, such as loading an HTMLImageElement, or using Google's NodeJS API.
 *
 * @return {Object} An object with a promise, and reject and resolve functions.
 */
module.exports = function () {
    var resolve, reject;
    var promise = new Promise(function() {
        resolve = arguments[0];
        reject = arguments[1];
    });
    return {
        resolve: resolve,
        reject: reject,
        promise: promise
    };
};
