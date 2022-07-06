'use strict';

const Cesium = require('cesium');
const crypto = require('crypto');

const defined = Cesium.defined;

const Settings = require('./Settings');
module.exports = checkWebHook;

function checkWebHook(req, res, next) { // eslint-disable-line no-unused-vars
    // check header fields
    const id = req.headers['x-github-delivery'];
    if (!defined(id)) {
        next(new Error('No id found in the request'));
        return;
    }

    const event = req.headers['x-github-event'];
    if (!defined(event)) {
        next(new Error('No event found in the request'));
        return;
    }

    const sign = req.headers['x-hub-signature'] || '';
    if (Settings.secret && !sign) {
        next(new Error('No signature found in the request'));
        return;
    }

    if (!defined(req.body)) {
        next(new Error('Expected req.body to be defined'));
        return;
    }

    // verify signature (if any)
    if (Settings.secret && !checkWebHook.verifySignature(Settings.secret, JSON.stringify(req.body), sign)) {
        next(new Error('Failed to verify signature'));
        return;
    }
    next();
}

checkWebHook.signData = function (secret, data) {
    return `sha1=${  crypto.createHmac('sha1', secret).update(data).digest('hex')}`;
};

checkWebHook.verifySignature = function (secret, data, signature) {
    return signature === checkWebHook.signData(secret, data);
};
