'use strict';

const Promise = require('bluebird');

const postToGitHub = require('../../lib/postToGitHub');
const RepositorySettings = require('../../lib/RepositorySettings');
const Settings = require('../../lib/Settings');

describe('postToGitHub', function () {
    let res;
    let repositorySettings;

    beforeEach(function () {
        res = {
            status: jasmine.createSpy('status').and.callFake(function () {
                return res;
            }),
            end: jasmine.createSpy('end')
        };

        repositorySettings = new RepositorySettings();
        Settings.repositories['AnalyticalGraphics/cesium'] = repositorySettings;
    });

    afterEach(function () {
        delete Settings.repositories['AnalyticalGraphics/cesium'];
    });

    it('errors if the specified repository is not configured', function () {
        const req = {
            body: {
                repository: {
                    full_name: 'ThisDoesNotExist'
                }
            }
        };

        const next = jasmine.createSpy('next');
        postToGitHub(req, {}, next);
        expect(next).toHaveBeenCalledWith(new Error('ThisDoesNotExist is not a configured repository.'));
    });

    it('calls commentOnClosedIssue for a closed pull request', function (done) {
        const req = {
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
        const next = jasmine.createSpy('next');

        postToGitHub(req, res, next)
            .then(function () {
                expect(postToGitHub._commentOnClosedIssue).toHaveBeenCalledWith(req.body, repositorySettings);
                expect(res.status).toHaveBeenCalledWith(204);
                expect(res.end).toHaveBeenCalled();
                expect(next).toHaveBeenCalledWith();
                done();
            })
            .catch(done.fail);
    });

    it('calls commentOnClosedIssue for a closed issue', function (done) {
        const req = {
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
        const next = jasmine.createSpy('next');

        postToGitHub(req, res, next)
            .then(function () {
                expect(postToGitHub._commentOnClosedIssue).toHaveBeenCalledWith(req.body, repositorySettings);
                expect(res.status).toHaveBeenCalledWith(204);
                expect(res.end).toHaveBeenCalled();
                expect(next).toHaveBeenCalledWith();
                done();
            })
            .catch(done.fail);
    });

    it('calls commentOnOpenedPullRequest for a opened pull request', function (done) {
        const req = {
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
        const next = jasmine.createSpy('next');

        postToGitHub(req, res, next)
            .then(function () {
                expect(postToGitHub._commentOnOpenedPullRequest).toHaveBeenCalledWith(req.body, repositorySettings);
                expect(res.status).toHaveBeenCalledWith(204);
                expect(res.end).toHaveBeenCalled();
                expect(next).toHaveBeenCalledWith();
                done();
            })
            .catch(done.fail);
    });

    it('no-op on an unknown event', function (done) {
        const req = {
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

        const next = jasmine.createSpy('next');

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
        const req = {
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

        const error = new Error('Something bad happened');
        spyOn(postToGitHub, '_commentOnOpenedPullRequest').and.returnValue(Promise.reject(error));
        const next = jasmine.createSpy('next');

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
