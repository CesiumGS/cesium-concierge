'use strict';

var Promise = require('bluebird');
var requestPromise = require('request-promise');

var commentOnClosedIssue = require('../../lib/commentOnClosedIssue');
var RepositorySettings = require('../../lib/RepositorySettings');

describe('commentOnClosedIssue', function () {
    var repositorySettings = new RepositorySettings();

    var issueEventJson;
    var pullRequestEventJson;
    var issueUrl = 'issueUrl';
    var commentsUrl = 'commentsUrl';

    beforeEach(function () {
        issueEventJson = {
            issue: {
                url: issueUrl,
                comments_url: commentsUrl
            }
        };

        pullRequestEventJson = {
            pull_request: {
                url: issueUrl,
                comments_url: commentsUrl
            }
        };
    });

    it('throws if body is undefined', function () {
        expect(function () {
            commentOnClosedIssue(undefined, repositorySettings);
        }).toThrowError();
    });

    it('throws if `repositorySettings` is undefined', function () {
        expect(function () {
            commentOnClosedIssue(issueEventJson, undefined);
        }).toThrowError();
    });

    it('rejects with unknown body type', function (done) {
        commentOnClosedIssue({}, repositorySettings)
            .then(done.fail)
            .catch(function (error) {
                expect(error.message).toBe('Unknown body type');
                done();
            });
    });

    it('passes expected parameters to implementation for closed issue', function () {
        spyOn(commentOnClosedIssue, '_implementation');
        commentOnClosedIssue(issueEventJson, repositorySettings);
        expect(commentOnClosedIssue._implementation).toHaveBeenCalledWith(issueUrl, commentsUrl, repositorySettings);
    });

    it('passes expected parameters to implementation for closed pull request', function () {
        spyOn(commentOnClosedIssue, '_implementation');
        commentOnClosedIssue(pullRequestEventJson, repositorySettings);
        expect(commentOnClosedIssue._implementation).toHaveBeenCalledWith(issueUrl, commentsUrl, repositorySettings);
    });

    function runTestWithLinks(forumLinks) {
        var issueResponseJson = {
            html_url: 'html_url',
            body: 'This is my issue description. ' + forumLinks[0]
        };

        var commentsJson = [{
            body: forumLinks[1]
        }];

        spyOn(repositorySettings, 'fetchSettings').and.callFake(function() {
           return Promise.resolve(repositorySettings);
        });

        spyOn(requestPromise, 'get').and.callFake(function (options) {
            if (options.url === issueUrl) {
                return Promise.resolve(issueResponseJson);
            }
            if (options.url === commentsUrl) {
                return Promise.resolve(commentsJson);
            }

            return Promise.reject('Unknown url.');
        });
        spyOn(requestPromise, 'post');

        return commentOnClosedIssue._implementation('issueUrl', 'commentsUrl', repositorySettings);
    }

    it('commentOnClosedIssue._implementation fetches latest repository settings.', function (done) {
        var forumLinks = [
            '',
            ''
        ];
        runTestWithLinks(forumLinks)
            .then(function () {
                expect(repositorySettings.fetchSettings).toHaveBeenCalled();
                done();
            })
            .catch(done.fail);
    });

    it('commentOnClosedIssue._implementation posts expected message.', function (done) {
        var forumLinks = [
            'https://groups.google.com/forum/?hl=en#!topic/cesium-dev/qw36Qo60i4s',
            'https://groups.google.com/forum/?hl=en#!topic/cesium-dev/gn56Qo60i4s'
        ];
        runTestWithLinks(forumLinks)
            .then(function () {
                expect(requestPromise.post).toHaveBeenCalledWith({
                    url: 'commentsUrl',
                    headers: repositorySettings.headers,
                    body: {
                        body: repositorySettings.issueClosedTemplate({
                            html_url: 'html_url',
                            forum_links: forumLinks,
                            signature: repositorySettings.signature
                        })
                    },
                    json: true
                });
                done();
            })
            .catch(done.fail);
    });

    it('commentOnClosedIssue._implementation does not post when no forum links are found.', function (done) {
        var forumLinks = [
            '',
            ''
        ];
        runTestWithLinks(forumLinks)
            .then(function () {
                expect(requestPromise.post).not.toHaveBeenCalled();
                done();
            })
            .catch(done.fail);
    });

    it('commentOnClosedIssue._implementation rejects if issueUrl cannot be retrieved.', function (done) {
        var commentsJson = [];

        spyOn(repositorySettings, 'fetchSettings').and.callFake(function() {
            return Promise.resolve(repositorySettings);
        });
        spyOn(requestPromise, 'get').and.callFake(function (options) {
            if (options.url === issueUrl) {
                return Promise.reject('Bad request');
            }
            if (options.url === commentsUrl) {
                return Promise.resolve(commentsJson);
            }

            return Promise.reject('Unknown url.');
        });
        spyOn(requestPromise, 'post');

        commentOnClosedIssue._implementation('issueUrl', 'commentsUrl', repositorySettings)
            .then(done.fail)
            .catch(function (error) {
                expect(error).toEqual('Bad request');
                expect(requestPromise.post).not.toHaveBeenCalled();
                done();
            });
    });

    it('commentOnClosedIssue._implementation rejects if commentsUrl cannot be retrieved.', function (done) {
        var issueResponseJson = {
            html_url: 'html_url',
            body: ''
        };

        spyOn(repositorySettings, 'fetchSettings').and.callFake(function() {
            return Promise.resolve(repositorySettings);
        });
        spyOn(requestPromise, 'get').and.callFake(function (options) {
            if (options.url === issueUrl) {
                return Promise.resolve(issueResponseJson);
            }

            if (options.url === commentsUrl) {
                return Promise.reject('Bad request');
            }

            return Promise.reject('Unknown url.');
        });
        spyOn(requestPromise, 'post');

        commentOnClosedIssue._implementation('issueUrl', 'commentsUrl', repositorySettings)
            .then(done.fail)
            .catch(function (error) {
                expect(error).toEqual('Bad request');
                expect(requestPromise.post).not.toHaveBeenCalled();
                done();
            });
    });
});
