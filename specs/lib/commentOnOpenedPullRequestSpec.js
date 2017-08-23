'use strict';

var fsExtra = require('fs-extra');
var Settings = require('../../lib/Settings');

var Promise = require('bluebird');
var requestPromise = require('request-promise');

var commentOnOpenedPullRequest = require('../../lib/commentOnOpenedPullRequest');
describe('commentOnOpenedPullRequest', function () {
    var headers = Object.freeze({
        'User-Agent': 'cesium-concierge',
        Authorization: 'token notARealToken'
    });

    var filesUrl = 'url/files';
    var commentsUrl = 'https://api.github.com/repos/AnalyticalGraphicsInc/cesium/issues/1/comments';
    var userName = 'boomerJones';
    var repositoryName = 'AnalyticalGraphics/cesium';
    var repositoryUrl = 'https://github.com/AnalyticalGraphicsInc/cesium';
    var thirdPartyFolders = ['ThirdParty', 'Source/ThirdParty'];

    var pullRequestJson = {
        pull_request: {
            url: 'url',
            comments_url: commentsUrl,
            user: {
                login: userName
            }
        },
        repository: {
            html_url: repositoryUrl,
            full_name: repositoryName
        }
    };

    it('throws if body is undefined', function () {
        expect(function () {
            commentOnOpenedPullRequest(undefined, headers);
        }).toThrowError();
    });

    it('throws if headers is undefined', function () {
        expect(function () {
            commentOnOpenedPullRequest(pullRequestJson, undefined);
        }).toThrowError();
    });

    it('throws if json is not a pull request event', function () {
        var issueJson = fsExtra.readJsonSync('./specs/data/events/issue.json');
        expect(function () {
            commentOnOpenedPullRequest(issueJson, {});
        }).toThrowError();
    });

    it('passes expected parameters to implementation', function () {
        spyOn(Settings, 'getThirdPartyFolders').and.returnValue(thirdPartyFolders);
        spyOn(commentOnOpenedPullRequest, '_implementation');

        commentOnOpenedPullRequest(pullRequestJson, headers);

        expect(commentOnOpenedPullRequest._implementation).toHaveBeenCalledWith(filesUrl, commentsUrl, headers, userName, repositoryUrl, thirdPartyFolders);
        expect(Settings.getThirdPartyFolders).toHaveBeenCalledWith(repositoryName);
    });

    it('commentOnOpenedPullRequest._askAboutChanges works', function () {
        expect(commentOnOpenedPullRequest._askAboutChanges(['CHANGES.md'])).toBe(false);

        expect(commentOnOpenedPullRequest._askAboutChanges([])).toBe(true);
        expect(commentOnOpenedPullRequest._askAboutChanges(['CHANGES.MD'])).toBe(true);
        expect(commentOnOpenedPullRequest._askAboutChanges(['leadingCHANGES.md'])).toBe(true);
        expect(commentOnOpenedPullRequest._askAboutChanges(['CHANGES.mdtrailing'])).toBe(true);
    });

    it('commentOnOpenedPullRequest._askAboutThirdParty works', function () {
        expect(commentOnOpenedPullRequest._askAboutThirdParty(['ThirdParty/file.js'], ['ThirdParty'])).toBe(true);

        expect(commentOnOpenedPullRequest._askAboutThirdParty(['file.txt'], [])).toBe(false);
        expect(commentOnOpenedPullRequest._askAboutThirdParty(['file.txt'], undefined)).toBe(false);
        expect(commentOnOpenedPullRequest._askAboutThirdParty(['NotThirdParty/file.js'], ['ThirdParty'])).toBe(false);
    });

    it('commentOnOpenedPullRequest._implementation does not post if CHANGES.md was updated and there are no modified ThirdParty folders', function (done) {
        var pullRequestFilesUrl = 'pullRequestFilesUrl';
        var pullRequestCommentsUrl = 'pullRequestCommentsUrl';

        spyOn(Settings, 'getThirdPartyFolders').and.returnValue(thirdPartyFolders);
        spyOn(requestPromise, 'post');

        spyOn(requestPromise, 'get').and.callFake(function (options) {
            if (options.url === pullRequestFilesUrl) {
                return Promise.resolve([
                    {filename: 'CHANGES.md'}
                ]);
            }
            return Promise.reject('Unknown url.');
        });

        commentOnOpenedPullRequest._implementation(pullRequestFilesUrl, pullRequestCommentsUrl, headers, userName, repositoryUrl, thirdPartyFolders)
            .then(function () {
                expect(requestPromise.post).not.toHaveBeenCalled();
                done();
            })
            .catch(done.fail);
    });

    it('commentOnOpenedPullRequest._implementation posts if CHANGES.md was not updated and there are no modified ThirdParty folders', function (done) {
        var pullRequestFilesUrl = 'pullRequestFilesUrl';
        var pullRequestCommentsUrl = 'pullRequestCommentsUrl';

        spyOn(Settings, 'getThirdPartyFolders').and.returnValue(thirdPartyFolders);
        spyOn(requestPromise, 'post');

        spyOn(requestPromise, 'get').and.callFake(function (options) {
            if (options.url === pullRequestFilesUrl) {
                return Promise.resolve([
                        {filename: 'notCHANGES.md'}
                    ]);
            }
            return Promise.reject('Unknown url.');
        });

        commentOnOpenedPullRequest._implementation(pullRequestFilesUrl, pullRequestCommentsUrl, headers, userName, repositoryUrl, thirdPartyFolders)
            .then(function () {
                expect(requestPromise.post).toHaveBeenCalledWith({
                    url: pullRequestCommentsUrl,
                    headers: headers,
                    body: {
                        body: commentOnOpenedPullRequest.renderMessage(userName, repositoryUrl, true, false, thirdPartyFolders)
                    },
                    json: true
                });
                done();
            })
            .catch(done.fail);
    });

    it('commentOnOpenedPullRequest._implementation posts if CHANGES.md was updated but there are modified ThirdParty folders', function (done) {
        var pullRequestFilesUrl = 'pullRequestFilesUrl';
        var pullRequestCommentsUrl = 'pullRequestCommentsUrl';

        spyOn(Settings, 'getThirdPartyFolders').and.returnValue(thirdPartyFolders);
        spyOn(requestPromise, 'post');

        spyOn(requestPromise, 'get').and.callFake(function (options) {
            if (options.url === pullRequestFilesUrl) {
                return Promise.resolve([
                        {filename: 'CHANGES.md'},
                        {filename: 'ThirdParty/stuff.js'}
                    ]);
            }
            return Promise.reject('Unknown url.');
        });

        commentOnOpenedPullRequest._implementation(pullRequestFilesUrl, pullRequestCommentsUrl, headers, userName, repositoryUrl, thirdPartyFolders)
            .then(function () {
                expect(requestPromise.post).toHaveBeenCalledWith({
                    url: pullRequestCommentsUrl,
                    headers: headers,
                    body: {
                        body: commentOnOpenedPullRequest.renderMessage(userName, repositoryUrl, false, true, thirdPartyFolders)
                    },
                    json: true
                });
                done();
            })
            .catch(done.fail);
    });


    it('commentOnOpenedPullRequest._implementation posts if CHANGES.md was not updated and there are modified ThirdParty folders', function (done) {
        var pullRequestFilesUrl = 'pullRequestFilesUrl';
        var pullRequestCommentsUrl = 'pullRequestCommentsUrl';

        spyOn(Settings, 'getThirdPartyFolders').and.returnValue(thirdPartyFolders);
        spyOn(requestPromise, 'post');

        spyOn(requestPromise, 'get').and.callFake(function (options) {
            if (options.url === pullRequestFilesUrl) {
                return Promise.resolve([
                        {filename: 'ThirdParty/stuff.js'}
                    ]);
            }
            return Promise.reject('Unknown url.');
        });

        commentOnOpenedPullRequest._implementation(pullRequestFilesUrl, pullRequestCommentsUrl, headers, userName, repositoryUrl, thirdPartyFolders)
            .then(function () {
                expect(requestPromise.post).toHaveBeenCalledWith({
                    url: pullRequestCommentsUrl,
                    headers: headers,
                    body: {
                        body: commentOnOpenedPullRequest.renderMessage(userName, repositoryUrl, true, true, thirdPartyFolders)
                    },
                    json: true
                });
                done();
            })
            .catch(done.fail);
    });
});
