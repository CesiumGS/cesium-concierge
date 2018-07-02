'use strict';

/** 
 * Checks the list of comments to see if someone asked the Concierge to 
 * stop bumping/interacting with this resource. Any comment that has 
 * `@cesium-concierge stop` will trigger this.
 *
 * @param {Array.<Object>} commentsJsonResponse Array of comment objects returned by GitHub API.
 * @return {undefined}
 */
module.exports = function (commentsJsonResponse) {
    for (var i = 0; i < commentsJsonResponse.length; i++){
        var comment = commentsJsonResponse[i].body.toLowerCase();
        var userName = commentsJsonResponse[i].user.login;
        if (userName !== 'cesium-concierge' && comment.indexOf('@cesium-concierge stop') !== -1) {
            return true;
        }
    }

    return false;
};
