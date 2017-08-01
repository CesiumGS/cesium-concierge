'use strict';

var bufferEq = require('buffer-equal-constant-time');
var Cesium = require('cesium');
var crypto = require('crypto');
var events = require('events');
var util = require('util');

var Check = Cesium.Check;
var defined = Cesium.defined;

var EventEmitter = events.EventEmitter;

function signData(secret, data) {
    return 'sha1=' + crypto.createHmac('sha1', secret).update(data).digest('hex');
}

function verifySignature(secret, data, signature) {
    return bufferEq(Buffer.from(signature), Buffer.from(signData(secret, data)));
}

var gitHubWebHook = function (options) {
    Check.typeOf.object('options', options);
    Check.typeOf.string('options.path', options.path);

    options.secret = options.secret || '';

    Object.setPrototypeOf(handler, EventEmitter.prototype);
    EventEmitter.call(handler);

    return handler;

    function handler(req, res, next) {
        if (req.method !== 'POST' || req.url.split('?')[0] !== options.path) {
            return next();
        }

        function reportError(message) {
            // respond error to sender
            res.status(400).send({
                error: message
            });

            // emit error
            handler.emit('error', new Error(message), req, res);
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
        if (options.secret && !sign) {
            return reportError('No signature found in the request');
        }

        if (!defined(req.body)) {
            return reportError('Make sure body-parser is used');
        }

        // verify signature (if any)
        if (options.secret && !verifySignature(options.secret, JSON.stringify(req.body), sign)) {
            return reportError('Failed to verify signature');
        }

        // parse payload
        var payloadData = req.body;
        var repo = payloadData.repository && payloadData.repository.full_name;

        // emit events
        if (repo) {
            handler.emit(repo, event, payloadData);
        }

        res.status(200).send({
            success: true
        });
    }
};

module.exports = gitHubWebHook;
