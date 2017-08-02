'use strict';

var bufferEq = require('buffer-equal-constant-time');
var Cesium = require('cesium');
var crypto = require('crypto');

var defined = Cesium.defined;

module.exports = checkWebHook;

/** Verifies incoming request is from GitHub
 *
 * @param {Object} req Request from body-parser
 * @param {Object} res Response
 * @param {String} secret GitHub Secret
 * @return {undefined | Error} Undefined if successful. Otherwise, an Error with a description.
 */
function checkWebHook(req, res, secret) {
    function reportError(message) {
        // respond error to sender
        res.status(400).send({
            error: message
        });
        return new Error(message);
    }

    if (req.method !== 'POST') {
        return reportError('Request was not POST');
    }

    // check header fields
    var id = req.headers['x-github-delivery'];
    if (!defined(id)) {
        return reportError('No id found in the request');
    }

    var event = req.headers['x-github-event'];
    if (!defined(event)) {
        return reportError('No event found in the request');
    }

    var sign = req.headers['x-hub-signature'] || '';
    if (secret && !sign) {
        return reportError('No signature found in the request');
    }

    if (!defined(req.body)) {
        return reportError('Make sure body-parser is used');
    }

    // verify signature (if any)
    if (secret && !checkWebHook.verifySignature(secret, JSON.stringify(req.body), sign)) {
        return reportError('Failed to verify signature');
    }
}

checkWebHook.signData = function (secret, data) {
    return 'sha1=' + crypto.createHmac('sha1', secret).update(data).digest('hex');
};

checkWebHook.verifySignature = function (secret, data, signature) {
    return bufferEq(Buffer.from(signature), Buffer.from(checkWebHook.signData(secret, data)));
};
