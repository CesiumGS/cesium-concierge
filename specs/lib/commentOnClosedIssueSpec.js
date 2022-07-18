'use strict';

const Promise = require('bluebird');
const requestPromise = require('request-promise');

const commentOnClosedIssue = require('../../lib/commentOnClosedIssue');
const RepositorySettings = require('../../lib/RepositorySettings');

describe('commentOnClosedIssue', function () {
    const repositorySettings = new RepositorySettings();
    repositorySettings.contributorsPath = 'CONTRIBUTORS.md';
    let commonOptions;

    let issueEventJson;
    let pullRequestEventJson;
    const issueUrl = 'issueUrl';
    const commentsUrl = 'commentsUrl';
    const isMergedUrl = `${issueUrl  }/merge`;
    const userName = 'Joan';

    beforeEach(function () {
        commonOptions = {
            url: issueUrl,
            commentsUrl: commentsUrl,
            repositorySettings: repositorySettings,
            isPullRequest: true,
            userName: userName
        };

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
                    ref: 'main',
                    repo: {
                    }
                }
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
            commentOnClosedIssue(issueEventJson);
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
        const isPullRequest = false;

        spyOn(commentOnClosedIssue, '_implementation');
        commentOnClosedIssue(issueEventJson, repositorySettings);
        expect(commentOnClosedIssue._implementation).toHaveBeenCalledWith({
            url: issueUrl,
            commentsUrl: commentsUrl,
            isPullRequest: isPullRequest,
            repositorySettings: repositorySettings
        });
    });

    it('passes expected parameters to implementation for closed pull request', function () {
        const isPullRequest = true;

        spyOn(commentOnClosedIssue, '_implementation');
        commentOnClosedIssue(pullRequestEventJson, repositorySettings);
        expect(commentOnClosedIssue._implementation).toHaveBeenCalledWith({
            url: issueUrl,
            commentsUrl: commentsUrl,
            isPullRequest: isPullRequest,
            userName: userName,
            repositorySettings: repositorySettings
        });
    });

    it('commentOnClosedIssue._implementation propagates unexpected errors.', function (done) {
        spyOn(repositorySettings, 'fetchSettings').and.callFake(function() {
            return Promise.resolve(repositorySettings);
        });
        spyOn(requestPromise, 'get').and.callFake(function (options) {
            if (options.url === issueUrl) {
                return Promise.resolve(pullRequestEventJson);
            }
            if (options.url === isMergedUrl) {
                return Promise.reject('Unexpected Error');
            }

            if (options.url === commentsUrl) {
                return Promise.resolve([]);
            }

            return Promise.reject(`Unknown url: ${  options.url}`);
        });
        spyOn(requestPromise, 'post');

        commentOnClosedIssue._implementation(commonOptions)
            .then(done.fail)
            .catch(function() {
                done();
            });
    });
});
