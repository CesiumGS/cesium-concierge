'use strict';

var request = require('supertest');
var crypto = require('crypto');
var express = require('express');
var bodyParser = require('body-parser');
var gitHubWebHook = require('../../lib/gitHubWebHook');

function signData(secret, data) {
    return 'sha1=' + crypto.createHmac('sha1', secret).update(data).digest('hex');
}

describe('Invalid construction of gitHubWebHook handler', function () {
    it('exports a function', function () {
        expect(typeof gitHubWebHook).toEqual('function');
    });
    it('throws if no options', function () {
        expect(function () {
            return gitHubWebHook();
        }).toThrowError();
    });
    it('throws if option is not an object', function () {
        expect(function () {
            return gitHubWebHook('');
        }).toThrow();
    });
    it('throws if no path option', function () {
        expect(function () {
            return gitHubWebHook({});
        }).toThrow();
    });
});


describe('gitHubWebHook handler is an EventEmitter', function () {
    var options = {path: '/hook', secret: 'secret'};
    var handler = gitHubWebHook(options);
    it('has h.on()', function () {
        console.log(handler);
        expect(handler.on).toEqual(jasmine.any(Function));
    });
    it('has h.emit()', function () {
        expect(typeof handler.emit).toBe('function');
    });
    it('has h.removeListener()', function () {
        expect(typeof handler.removeListener).toBe('function');
    });
    it('got event', function (done) {
        handler.on('foo', function (bar) {
            expect(bar).toBe('bar');
            done();
        });
        handler.emit('foo', 'bar');
    });
});

describe('Ignore unmatched path', function () {
    /* eslint-disable no-unused-vars */
    /**
     * Create mock express app
     */
    var webhookHandler = gitHubWebHook({path: '/github/hook'});
    var app = express();

    app.use(webhookHandler); // use our middleware
    app.use(function (req, res) {
        res.status(200).send({message: 'Here'});
    });
    it('ignore path unmatched request /', function (done) {
        request(app)
            .get('/')
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

    it('ignore path unmatched request /github/hook', function (done) {
        request(app)
            .get('/github/hook/')
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

    it('ignore path unmatched request /github', function (done) {
        request(app)
            .get('/github')
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

describe('Invalid request meta', function () {
    /**
     * Create mock express app
     */
    var webhookHandler = gitHubWebHook({path: '/github/hook', secret: 'secret'});
    var app = express();
    app.use(bodyParser.json());
    app.use(webhookHandler); // use our middleware
    app.use(function (req, res) {
        res.status(200).send({message: 'Here'});
        expect(true).toBe(false); // shouldn't reach here
    });

    it('request should have id', function (done) {
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
    var webhookHandler = gitHubWebHook({path: '/github/hook', secret: 'secret'});
    var app = express();
    app.use(bodyParser.json());
    app.use(webhookHandler); // use our middleware
    app.use(function (req, res) {
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
    var webhookHandler = gitHubWebHook({path: '/github/hook', secret: 'secret'});
    var app = express();
    app.use(webhookHandler); // use our middleware
    app.use(function (req, res) {
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
    var webhookHandler = gitHubWebHook({path: '/github/hook', secret: 'secret'});
    var app = express();
    app.use(bodyParser.json());
    app.use(webhookHandler); // use our middleware
    app.use(function (req, res) {
        res.status(200).send({message: 'Here'});
        expect(true).toBe(false); // shouldn't reach here
    });

    /**
     * Mock request data
     */
    var data = {
        ref: 'ref',
        foo: 'bar',
        repository: {
            name: 'repo'
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
                expect(res.body).toEqual({success: true});
                done();
            });
    });

    webhookHandler.on('repo', function (event, data) {
        expect(event).toEqual('push');
        expect(data).toEqual(data);
    });
});
/* eslint-enable no-unused-vars */
