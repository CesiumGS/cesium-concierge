'use strict';

var bufferEq = require('buffer-equal-constant-time');
var Cesium = require('cesium');
var crypto = require('crypto');

var Check = Cesium.Check;
var defined = Cesium.defined;

module.exports = checkWebHook;

/** Verifies incoming request is from GitHub
 *
 * @param {Object} req Request from body-parser
 * @param {String} secret GitHub Secret
 * @return {Object | Error} Object with `full_name` and `event` if successful. Otherwise, an Error with a description.
 */
function checkWebHook(req, secret) {
    Check.typeOf.object('req', req);
    Check.typeOf.string('secret', secret);

    if (req.method !== 'POST') {
        return new Error('Request was not POST');
    }

    // check header fields
    var id = req.headers['x-github-delivery'];
    if (!defined(id)) {
        return new Error('No id found in the request');
    }

    var event = req.headers['x-github-event'];
    if (!defined(event)) {
        return new Error('No event found in the request');
    }

    var sign = req.headers['x-hub-signature'] || '';
    if (secret && !sign) {
        return new Error('No signature found in the request');
    }

    if (!defined(req.body)) {
        return new Error('Make sure body-parser is used');
    }

    // verify signature (if any)
    if (secret && !checkWebHook.verifySignature(secret, JSON.stringify(req.body), sign)) {
        return new Error('Failed to verify signature');
    }

    return {
        full_name: req.body.repository.full_name,
        event: req.headers['x-github-event']
    };
}

checkWebHook.signData = function (secret, data) {
    return 'sha1=' + crypto.createHmac('sha1', secret).update(data).digest('hex');
};

checkWebHook.verifySignature = function (secret, data, signature) {
    return bufferEq(Buffer.from(signature), Buffer.from(checkWebHook.signData(secret, data)));
};
