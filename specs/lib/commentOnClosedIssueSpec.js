'use strict';

var Promise = require('bluebird');
var requestPromise = require('request-promise');

var commentOnClosedIssue = require('../../lib/commentOnClosedIssue');
var RepositorySettings = require('../../lib/RepositorySettings');

describe('commentOnClosedIssue', function () {
    var repositorySettings = new RepositorySettings();
    repositorySettings.contributorsPath = 'CONTRIBUTORS.md';

    var issueEventJson;
    var pullRequestEventJson;
    var issueUrl = 'issueUrl';
    var commentsUrl = 'commentsUrl';
    var baseBranch = 'master';
    var baseApiUrl = 'https://api.github.com/repos/AnalyticalGraphicsInc/cesium';
    var userName = 'Joan';
    var outreachUsers = '@OmarShehata';

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
                comments_url: commentsUrl,
                user: {
                    login: userName
                },
                base: {
                    ref: 'master',
                    repo: {
                        url: baseApiUrl
                    }
                }
            }
        };
    });

    it('throws if body is undefined', function () {
        expect(function () {
            commentOnClosedIssue(undefined, repositorySettings, outreachUsers);
        }).toThrowError();
    });

    it('throws if `repositorySettings` is undefined', function () {
        expect(function () {
            commentOnClosedIssue(issueEventJson, undefined, outreachUsers);
        }).toThrowError();
    });

    it('rejects with unknown body type', function (done) {
        commentOnClosedIssue({}, repositorySettings, outreachUsers)
            .then(done.fail)
            .catch(function (error) {
                expect(error.message).toBe('Unknown body type');
                done();
            });
    });

    it('passes expected parameters to implementation for closed issue', function () {
        var isPullRequest = false;

        spyOn(commentOnClosedIssue, '_implementation');
        commentOnClosedIssue(issueEventJson, repositorySettings, outreachUsers);
        expect(commentOnClosedIssue._implementation).toHaveBeenCalledWith({
            url: issueUrl,
            commentsUrl: commentsUrl,
            isPullRequest: isPullRequest,
            repositorySettings: repositorySettings,
            outreachUsers: outreachUsers
        });
    });

    it('passes expected parameters to implementation for closed pull request', function () {
        var isPullRequest = true;

        spyOn(commentOnClosedIssue, '_implementation');
        commentOnClosedIssue(pullRequestEventJson, repositorySettings, outreachUsers);
        expect(commentOnClosedIssue._implementation).toHaveBeenCalledWith({
            url: issueUrl,
            commentsUrl: commentsUrl,
            isPullRequest: isPullRequest,
            baseBranch: baseBranch,
            baseApiUrl: baseApiUrl,
            userName: userName,
            repositorySettings: repositorySettings,
            outreachUsers: outreachUsers
        });
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

        return commentOnClosedIssue._implementation({
            url: issueUrl,
            commentsUrl: commentsUrl,
            repositorySettings: repositorySettings,
            outreachUsers: outreachUsers
        });
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
                            foundForumLinks: true,
                            outreachUsers: outreachUsers
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

        var options = {
            url: issueUrl,
            commentsUrl: commentsUrl,
            repositorySettings: repositorySettings,
            outreachUsers: outreachUsers
        };

        commentOnClosedIssue._implementation(options)
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

        var options = {
            url: issueUrl,
            commentsUrl: commentsUrl,
            repositorySettings: repositorySettings,
            outreachUsers: outreachUsers
        };

        commentOnClosedIssue._implementation(options)
            .then(done.fail)
            .catch(function (error) {
                expect(error).toEqual('Bad request');
                expect(requestPromise.post).not.toHaveBeenCalled();
                done();
            });
    });

    it('commentOnClosedIssue._implementation posts about first timer\'s contribution.', function (done) {
        var contributorsUrl = baseApiUrl + '/contents/' + repositorySettings.contributorsPath + '?ref=' + baseBranch;

        spyOn(repositorySettings, 'fetchSettings').and.callFake(function() {
            return Promise.resolve(repositorySettings);
        });
        spyOn(requestPromise, 'get').and.callFake(function (options) {
            if (options.url === issueUrl) {
                return Promise.resolve(pullRequestEventJson);
            }

            if (options.url === contributorsUrl) {
                var content = Buffer.from('* [Jane Doe](https://github.com/JaneDoe)').toString('base64');
                return Promise.resolve({
                    content: content
                });
            }

            if (options.url === commentsUrl) {
                return Promise.resolve([]);
            }

            return Promise.reject('Unknown url: ' + options.url);
        });
        spyOn(requestPromise, 'post');

        var options = {
            url: issueUrl,
            commentsUrl: commentsUrl,
            isPullRequest: true,
            baseBranch: baseBranch,
            baseApiUrl: baseApiUrl,
            userName: userName,
            repositorySettings: repositorySettings,
            outreachUsers: outreachUsers
        };

        commentOnClosedIssue._implementation(options)
            .then(function () {
                expect(requestPromise.post).toHaveBeenCalledWith({
                    url: commentsUrl,
                    headers: repositorySettings.headers,
                    body: {
                        body: repositorySettings.issueClosedTemplate({
                            isFirstContribution: true,
                            outreachUsers: outreachUsers,
                            userName: userName
                        })
                    },
                    json: true
                });
                done();
            })
            .catch(done.fail);
    });
});
