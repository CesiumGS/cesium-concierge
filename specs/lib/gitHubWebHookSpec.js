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
    /* eslint-enable no-unused-vars */
});
//
// it('Ignore unmatched request method', function (t) {
//     t.plan(1);
//
//     /**
//      * Create mock express app
//      */
//     var webhookHandler = gitHubWebHook({path: '/github/hook'});
//     var app = express();
//
//     app.use(webhookHandler); // use our middleware
//     app.use(function (req, res) {
//         res.status(200).send({message: 'Here'});
//     });
//
//     request(app)
//         .get('/github/hook')
//         .expect('Content-Type', /json/)
//         .expect(200)
//         .end(function (err, res) {
//             t.deepEqual(res.body, {message: 'Here'}, 'ignore unmatched request method');
//         });
// });
//
// it('Invalid request meta', function (t) {
//     t.plan(6);
//     /**
//      * Create mock express app
//      */
//     var webhookHandler = gitHubWebHook({path: '/github/hook', secret: 'secret'});
//     var app = express();
//     app.use(bodyParser.json());
//     app.use(webhookHandler); // use our middleware
//     app.use(function (req, res) {
//         res.status(200).send({message: 'Here'});
//         t.fail(true, 'should not reach here');
//     });
//
//     request(app)
//         .post('/github/hook')
//         .set('Content-Type', 'application/json')
//         .expect('Content-Type', /json/)
//         .expect(400)
//         .end(function (err, res) {
//             t.deepEqual(res.body, {error: 'No id found in the request'}, 'request should have id');
//         });
//
//     request(app)
//         .post('/github/hook')
//         .set('Content-Type', 'application/json')
//         .set('X-GitHub-Delivery', 'id')
//         .expect('Content-Type', /json/)
//         .expect(400)
//         .end(function (err, res) {
//             t.deepEqual(res.body, {error: 'No event found in the request'}, 'request should have event');
//         });
//
//     request(app)
//         .post('/github/hook')
//         .set('Content-Type', 'application/json')
//         .set('X-GitHub-Delivery', 'id')
//         .set('X-GitHub-Event', 'event')
//         .expect('Content-Type', /json/)
//         .expect(400)
//         .end(function (err, res) {
//             t.deepEqual(res.body, {error: 'No signature found in the request'}, 'request should have signature');
//         });
//
//     webhookHandler.on('error', function (err, req, res) {
//         t.ok(err, 'error caught');
//     });
// });
//
// it('Invalid signature', function (t) {
//     t.plan(2);
//     /**
//      * Create mock express app
//      */
//     var webhookHandler = gitHubWebHook({path: '/github/hook', secret: 'secret'});
//     var app = express();
//     app.use(bodyParser.json());
//     app.use(webhookHandler); // use our middleware
//     app.use(function (req, res) {
//         res.status(200).send({message: 'Here'});
//         t.fail(true, 'should not reach here');
//     });
//
//     var invalidSignature = 'signature';
//
//     request(app)
//         .post('/github/hook')
//         .set('Content-Type', 'application/json')
//         .set('X-GitHub-Delivery', 'id')
//         .set('X-GitHub-Event', 'event')
//         .set('X-Hub-Signature', invalidSignature)
//         .expect('Content-Type', /json/)
//         .expect(400)
//         .end(function (err, res) {
//             t.deepEqual(res.body, {error: 'Failed to verify signature'}, 'signature does not match');
//         });
//
//     webhookHandler.on('error', function (err, req, res) {
//         t.ok(err, 'error caught');
//     });
// });
//
// it('No body-parser is used', function (t) {
//     t.plan(2);
//     /**
//      * Create mock express app
//      */
//     var webhookHandler = gitHubWebHook({path: '/github/hook', secret: 'secret'});
//     var app = express();
//     app.use(webhookHandler); // use our middleware
//     app.use(function (req, res) {
//         res.status(200).send({message: 'Here'});
//         t.fail(true, 'should not reach here');
//     });
//
//     var invalidSignature = 'signature';
//
//     request(app)
//         .post('/github/hook')
//         .set('Content-Type', 'application/json')
//         .set('X-GitHub-Delivery', 'id')
//         .set('X-GitHub-Event', 'event')
//         .set('X-Hub-Signature', invalidSignature)
//         .expect('Content-Type', /json/)
//         .expect(400)
//         .end(function (err, res) {
//             t.deepEqual(res.body, {error: 'Make sure body-parser is used'}, 'Verify use of body-parser');
//         });
//
//     webhookHandler.on('error', function (err, req, res) {
//         t.ok(err, 'error caught');
//     });
// });
//
// it('Accept a valid request with json data', function (t) {
//     t.plan(8);
//     /**
//      * Create mock express app
//      */
//     var webhookHandler = gitHubWebHook({path: '/github/hook', secret: 'secret'});
//     var app = express();
//     app.use(bodyParser.json());
//     app.use(webhookHandler); // use our middleware
//     app.use(function (req, res) {
//         res.status(200).send({message: 'Here'});
//         t.fail(true, 'should not reach here');
//     });
//
//     /**
//      * Mock request data
//      */
//     var data = {
//         ref: 'ref',
//         foo: 'bar',
//         repository: {
//             name: 'repo'
//         }
//     };
//     var json = JSON.stringify(data);
//
//     request(app)
//         .post('/github/hook')
//         .send(json)
//         .set('Content-Type', 'application/json')
//         .set('X-GitHub-Delivery', 'id')
//         .set('X-GitHub-Event', 'push')
//         .set('X-Hub-Signature', signData('secret', json))
//         .expect('Content-Type', /json/)
//         .expect(200)
//         .end(function (err, res) {
//             t.deepEqual(res.body, {success: true}, 'accept valid json request');
//         });
//
//     webhookHandler.on('repo', function (event, data) {
//         t.equal(event, 'push', 'receive a push event on event \'repo\'');
//         t.deepEqual(data, data, 'receive correct data on event \'repo\'');
//     });
//
//     webhookHandler.on('push', function (repo, data) {
//         t.equal(repo, 'repo', 'receive a event for repo on event \'push\'');
//         t.deepEqual(data, data, 'receive correct data on event \'push\'');
//     });
//
//     webhookHandler.on('*', function (event, repo, data) {
//         t.equal(event, 'push', 'receive a push event on event \'*\'');
//         t.equal(repo, 'repo', 'receive a event for repo on event \'*\'');
//         t.deepEqual(data, data, 'receive correct data on event \'*\'');
//     });
// });
