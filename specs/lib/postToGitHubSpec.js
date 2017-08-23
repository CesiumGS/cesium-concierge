'use strict';

var nconf = require('nconf');
var Promise = require('bluebird');

var postToGitHub = require('../../lib/postToGitHub');

describe('postToGitHub', function () {
    var res;
    var headers;

    beforeEach(function () {
        res = {
            status: jasmine.createSpy('status').and.callFake(function () {
                return res;
            }),
            end: jasmine.createSpy('end')
        };

        spyOn(nconf, 'get').and.returnValue({
            'AnalyticalGraphics/cesium': {
                gitHubToken: '123442345'
            }
        });

        headers = {
            'User-Agent': 'cesium-concierge',
            Authorization: 'token 123442345'
        };
    });

    it('errors if the specified repository is not configured', function () {
        var req = {
            body: {
                repository: {
                    full_name: 'ThisDoesNotExist'
                }
            }
        };

        var next = jasmine.createSpy('next');
        postToGitHub(req, {}, next);
        expect(next).toHaveBeenCalledWith(new Error('ThisDoesNotExist is not a configured repository.'));
    });

    it('calls commentOnClosedIssue for a closed pull request', function (done) {
        var req = {
            headers: {
                'x-github-event': 'pull_request'
            },
            body: {
                action: 'closed',
                repository: {
                    full_name: 'AnalyticalGraphics/cesium'
                }
            }
        };

        spyOn(postToGitHub, '_commentOnClosedIssue').and.returnValue(Promise.resolve());
        var next = jasmine.createSpy('next');

        postToGitHub(req, res, next)
            .then(function () {
                expect(postToGitHub._commentOnClosedIssue).toHaveBeenCalledWith(req.body, headers);
                expect(res.status).toHaveBeenCalledWith(204);
                expect(res.end).toHaveBeenCalled();
                expect(next).toHaveBeenCalledWith();
                done();
            })
            .catch(done.fail);
    });

    it('calls commentOnClosedIssue for a closed issue', function (done) {
        var req = {
            headers: {
                'x-github-event': 'issues'
            },
            body: {
                action: 'closed',
                repository: {
                    full_name: 'AnalyticalGraphics/cesium'
                }
            }
        };

        spyOn(postToGitHub, '_commentOnClosedIssue').and.returnValue(Promise.resolve());
        var next = jasmine.createSpy('next');

        postToGitHub(req, res, next)
            .then(function () {
                expect(postToGitHub._commentOnClosedIssue).toHaveBeenCalledWith(req.body, headers);
                expect(res.status).toHaveBeenCalledWith(204);
                expect(res.end).toHaveBeenCalled();
                expect(next).toHaveBeenCalledWith();
                done();
            })
            .catch(done.fail);
    });

    it('calls commentOnOpenedPullRequest for a opened pull request', function (done) {
        var req = {
            headers: {
                'x-github-event': 'pull_request'
            },
            body: {
                action: 'opened',
                repository: {
                    full_name: 'AnalyticalGraphics/cesium'
                }
            }
        };

        spyOn(postToGitHub, '_commentOnOpenedPullRequest').and.returnValue(Promise.resolve());
        var next = jasmine.createSpy('next');

        postToGitHub(req, res, next)
            .then(function () {
                expect(postToGitHub._commentOnOpenedPullRequest).toHaveBeenCalledWith(req.body, headers);
                expect(res.status).toHaveBeenCalledWith(204);
                expect(res.end).toHaveBeenCalled();
                expect(next).toHaveBeenCalledWith();
                done();
            })
            .catch(done.fail);
    });

    it('no-op on an unknown event', function (done) {
        var req = {
            headers: {
                'x-github-event': 'na-da'
            },
            body: {
                action: 'opened',
                repository: {
                    full_name: 'AnalyticalGraphics/cesium'
                }
            }
        };

        var next = jasmine.createSpy('next');

        postToGitHub(req, res, next)
            .then(function () {
                expect(res.status).toHaveBeenCalledWith(204);
                expect(res.end).toHaveBeenCalled();
                expect(next).toHaveBeenCalledWith();
                done();
            })
            .catch(done.fail);
    });

    it('calls next with rejected promise error', function (done) {
        var req = {
            headers: {
                'x-github-event': 'pull_request'
            },
            body: {
                action: 'opened',
                repository: {
                    full_name: 'AnalyticalGraphics/cesium'
                }
            }
        };

        var error = new Error('Something bad happened');
        spyOn(postToGitHub, '_commentOnOpenedPullRequest').and.returnValue(Promise.reject(error));
        var next = jasmine.createSpy('next');

        postToGitHub(req, res, next)
            .then(done.fail)
            .catch(function () {
                expect(res.status).not.toHaveBeenCalled();
                expect(res.end).not.toHaveBeenCalled();
                expect(next).toHaveBeenCalledWith(error);
                done();
            });
    });
});
