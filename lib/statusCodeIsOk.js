'use strict';
var dateLog = require('./dateLog');
/** Helper to check statusCode
 *
 * @param {Object} response JSON response
 * @return {boolean} true if the statusCode is 200
 */
module.exports = function statusCodeIsOk(response) {
    dateLog('Received from server:' + JSON.stringify(response));
    if (response.statusCode === 200) {
        dateLog('Status code OK 200');
        return true;
    }
    dateLog('Status code ERROR: ' + response.statusCode + ', ' + response.statusMessage);
    return false;
};
