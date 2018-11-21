'use strict';

/**
 * @param {Date} date The date to check.
 * @return {Number} The number of days since the given date.
 */
module.exports = function (date) {
    var msPerDay = 24 * 60 * 60 * 1000;
    return (Date.now() - date.getTime()) / msPerDay;
};
