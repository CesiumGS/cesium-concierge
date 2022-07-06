'use strict';

const bodyParser = require('body-parser');
const checkWebHook = require('../../lib/checkWebHook');
const crypto = require('crypto');
const express = require('express');
const nconf = require('nconf');
const request = require('supertest');

function signData(secret, data) {
    return `sha1=${  crypto.createHmac('sha1', secret).update(data).digest('hex')}`;
}

describe('Invalid request meta', function () {
    /**
     * Create mock express app
     */
    let app;
    beforeEach(function () {
        spyOn(nconf, 'get').and.returnValue('secret');
        app = express();
        app.use(bodyParser.json());
        app.use(checkWebHook);
        app.use(function (err, req, res, next) { // eslint-disable-line no-unused-vars
            res.send({error: err.message});
        });
    });

    it('request should have id', function (done) {
        request(app)
            .post('/github/hook')
            .set('Content-Type', 'application/json')
            .expect('Content-Type', /text/)
            .end(function (err, res) {
                if (err) {
                    return done(err);
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
    let app;
    beforeEach(function () {
        spyOn(nconf, 'get').and.returnValue('secret');
        app = express();
        app.use(bodyParser.json());
        app.use(checkWebHook);
        app.use(function (err, req, res, next) { // eslint-disable-line no-unused-vars
            res.send({error: err.message});
        });
    });

    const invalidSignature = 'signature';

    it('signature does not match', function (done) {
        request(app)
            .post('/github/hook')
            .set('Content-Type', 'application/json')
            .set('X-GitHub-Delivery', 'id')
            .set('X-GitHub-Event', 'event')
            .set('X-Hub-Signature', invalidSignature)
            .expect('Content-Type', /json/)
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
    let app;
    beforeEach(function () {
        spyOn(nconf, 'get').and.returnValue('secret');
        app = express();
        app.use(checkWebHook);
        app.use(function (err, req, res, next) { // eslint-disable-line no-unused-vars
            res.send({error: err.message});
        });
    });

    const invalidSignature = 'signature';

    it('Verify use of body-parser', function (done) {
        request(app)
            .post('/github/hook')
            .set('Content-Type', 'application/json')
            .set('X-GitHub-Delivery', 'id')
            .set('X-GitHub-Event', 'event')
            .set('X-Hub-Signature', invalidSignature)
            .expect('Content-Type', /json/)
            .end(function (err, res) {
                if (err) {
                    done.fail(err);
                }
                expect(res.body).toEqual({error: 'Expected req.body to be defined'});
                done();
            });
    });
});

describe('Accept a valid request with json data', function () {
    /**
     * Create mock express app
     */
    let app;
    beforeEach(function () {
        spyOn(nconf, 'get').and.returnValue('secret');
        app = express();
        app.use(bodyParser.json());
        app.use(checkWebHook);
        app.use(function (err, req, res, next) { // eslint-disable-line no-unused-vars
            expect(true).toBe(false);
        });
    });

    /**
     * Mock request data
     */
    const data = {
        ref: 'ref',
        foo: 'bar',
        repository: {
            full_name: 'my/repo'
        }
    };
    const json = JSON.stringify(data);

    it('accepts valid json request', function (done) {
        request(app)
            .post('/github/hook')
            .send(json)
            .set('Content-Type', 'application/json')
            .set('X-GitHub-Delivery', 'id')
            .set('X-GitHub-Event', 'push')
            .set('X-Hub-Signature', signData('secret', json))
            .expect('Content-Type', /text/)
            .end(function (err, res) { // eslint-disable-line no-unused-vars
                if (err) {
                    done.fail(err);
                }
                done();
            });
    });
});
