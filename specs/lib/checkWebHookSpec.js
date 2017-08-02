'use strict';

var request = require('supertest');
var crypto = require('crypto');
var express = require('express');
var bodyParser = require('body-parser');
var checkWebHook = require('../../lib/checkWebHook');

function signData(secret, data) {
    return 'sha1=' + crypto.createHmac('sha1', secret).update(data).digest('hex');
}

describe('Invalid construction of checkWebHook handler', function () {
    it('exports a function', function () {
        expect(typeof checkWebHook).toEqual('function');
    });
    it('throws if no options', function () {
        expect(function () {
            return checkWebHook();
        }).toThrowError();
    });
    it('throws if option is not an object', function () {
        expect(function () {
            return checkWebHook('');
        }).toThrow();
    });
    it('throws if no path option', function () {
        expect(function () {
            return checkWebHook({});
        }).toThrow();
    });
});

describe('Invalid request meta', function () {
    /**
     * Create mock express app
     */
    var app;
    beforeEach(function () {
        app = express();
        app.use(bodyParser.json());
    });

    it('request should have id', function (done) {
        app.use('/github/hook', function (req, res) {
            expect(checkWebHook(req, 'secret')).not.toBe(undefined);
            res.status(200).send({message: 'Here'});
        });
        request(app)
            .post('/github/hook')
            .set('Content-Type', 'application/json')
            .expect('Content-Type', /json/)
            .expect(400)
            .end(function (err, res) {
                if (err) {
                    done.fail(err);
                }
                expect(res.body).toEqual({error: 'No id found in the request'});
                done();
            });
    });

    it('request should have event', function (done) {
        request(app)
            .post('/github/hook')
            .set('Content-Type', 'application/json')
            .set('X-GitHub-Delivery', 'id')
            .expect('Content-Type', /json/)
            .expect(400)
            .end(function (err, res) {
                if (err) {
                    done.fail(err);
                }
                expect(res.body).toEqual({error: 'No event found in the request'});
                done();
            });
    });

    it('request should have signature', function (done) {
        request(app)
            .post('/github/hook')
            .set('Content-Type', 'application/json')
            .set('X-GitHub-Delivery', 'id')
            .set('X-GitHub-Event', 'event')
            .expect('Content-Type', /json/)
            .expect(400)
            .end(function (err, res) {
                if (err) {
                    done.fail(err);
                }
                expect(res.body).toEqual({error: 'No signature found in the request'});
                done();
            });
    });
});

describe('Invalid signature', function () {
    /**
     * Create mock express app
     */
    var app = express();
    app.use(bodyParser.json());
    app.use('/github/hook', function (req, res) {
        expect(checkWebHook(req, res, 'secret')).not.toBe(undefined);
        res.status(200).send({message: 'Here'});
        expect(true).toBe(false); // shouldn't reach here
    });

    var invalidSignature = 'signature';

    it('signature does not match', function (done) {
        request(app)
            .post('/github/hook')
            .set('Content-Type', 'application/json')
            .set('X-GitHub-Delivery', 'id')
            .set('X-GitHub-Event', 'event')
            .set('X-Hub-Signature', invalidSignature)
            .expect('Content-Type', /json/)
            .expect(400)
            .end(function (err, res) {
                if (err) {
                    done.fail(err);
                }
                expect(res.body).toEqual({error: 'Failed to verify signature'});
                done();
            });
    });
});

describe('No body-parser is used', function () {
    /**
     * Create mock express app
     */
    var app = express();
    app.use('/github/hook', function (req, res) {
        expect(checkWebHook(req, res, 'secret')).not.toBe(undefined);
        res.status(200).send({message: 'Here'});
        expect(true).toBe(false); // shouldn't reach here
    });

    var invalidSignature = 'signature';

    it('Verify use of body-parser', function (done) {
        request(app)
            .post('/github/hook')
            .set('Content-Type', 'application/json')
            .set('X-GitHub-Delivery', 'id')
            .set('X-GitHub-Event', 'event')
            .set('X-Hub-Signature', invalidSignature)
            .expect('Content-Type', /json/)
            .expect(400)
            .end(function (err, res) {
                if (err) {
                    done.fail(err);
                }
                expect(res.body).toEqual({error: 'Make sure body-parser is used'});
                done();
            });
    });
});

describe('Accept a valid request with json data', function () {
    /**
     * Create mock express app
     */
    var app = express();
    app.use(bodyParser.json());
    app.use('/github/hook', function (req, res) {
        expect(checkWebHook(req, res, 'secret')).toBe(undefined);
        expect(req.headers['x-github-event']).toEqual('push');
        expect(req.body.repository.full_name).toEqual('my/repo');
        res.status(200).send({message: 'Here'});
    });

    /**
     * Mock request data
     */
    var data = {
        ref: 'ref',
        foo: 'bar',
        repository: {
            full_name: 'my/repo'
        }
    };
    var json = JSON.stringify(data);

    it('accepts valid json request', function (done) {
        request(app)
            .post('/github/hook')
            .send(json)
            .set('Content-Type', 'application/json')
            .set('X-GitHub-Delivery', 'id')
            .set('X-GitHub-Event', 'push')
            .set('X-Hub-Signature', signData('secret', json))
            .expect('Content-Type', /json/)
            .expect(200)
            .end(function (err, res) {
                if (err) {
                    done.fail(err);
                }
                expect(res.body).toEqual({message: 'Here'});
                done();
            });
    });
});
/* eslint-enable no-unused-vars */
