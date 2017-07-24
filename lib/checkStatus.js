'use strict';
var Promise = require('bluebird');

/** Helper to check statusCode
 *
 * @param {Object} response JSON response
 * @return {Promise<http.IncomingMessage>} Resolved promise if 200 <= statusCode < 300
 */
module.exports = function checkStatus(response) {
    if (response.statusCode < 200 || response.statusCode >= 300) {
        return Promise.reject('Status code ERROR: ' + response.statusCode + ', ' + response.statusMessage);
    }
    return Promise.resolve(response);
};
