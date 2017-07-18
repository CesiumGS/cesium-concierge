'use strict';

/** Log with date
 *
 * @param {String} message Message to log
 * @return {undefined}
 */
module.exports = function (message) {
    console.log(new Date(Date.now()).toISOString() + ' ' + message);
};
