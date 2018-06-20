'use strict';

var fsExtra = require('fs-extra');

var Promise = require('bluebird');
var requestPromise = require('request-promise');

var commentOnOpenedPullRequest = require('../../lib/commentOnOpenedPullRequest');
var RepositorySettings = require('../../lib/RepositorySettings');

describe('commentOnOpenedPullRequest', function () {
    var filesUrl = 'url/files';
    var commentsUrl = 'https://api.github.com/repos/AnalyticalGraphicsInc/cesium/issues/1/comments';
    var userName = 'boomerJones';
    var repositoryName = 'AnalyticalGraphics/cesium';
    var repositoryUrl = 'https://github.com/AnalyticalGraphicsInc/cesium';
    var thirdPartyFolders = ['ThirdParty/', 'Source/ThirdParty/'];
    var baseBranch = 'master';

    var pullRequestJson = {
        pull_request: {
            url: 'url',
            comments_url: commentsUrl,
            user: {
                login: userName
            },
            head: {
                ref: 'feature'
            },
            base: {
                ref: 'master'
            }
        },
        repository: {
            html_url: repositoryUrl,
            full_name: repositoryName
        }
    };

    it('throws if body is undefined', function () {
        expect(function () {
            commentOnOpenedPullRequest(undefined, {});
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
        spyOn(commentOnOpenedPullRequest, '_implementation');

        var repositorySettings = new RepositorySettings();

        commentOnOpenedPullRequest(pullRequestJson, repositorySettings);

        expect(commentOnOpenedPullRequest._implementation).toHaveBeenCalledWith(filesUrl, commentsUrl, repositorySettings, userName, repositoryUrl, baseBranch);
    });

    it('commentOnOpenedPullRequest._askAboutChanges works', function () {
        expect(commentOnOpenedPullRequest._askAboutChanges(['CHANGES.md'],'master')).toBe(false);
        expect(commentOnOpenedPullRequest._askAboutChanges(['file.txt'],'feature-branch')).toBe(false);
        
        expect(commentOnOpenedPullRequest._askAboutChanges([],'master')).toBe(true);
        expect(commentOnOpenedPullRequest._askAboutChanges(['file.txt'],'master')).toBe(true);
        expect(commentOnOpenedPullRequest._askAboutChanges(['CHANGES.MD'],'master')).toBe(true);
        expect(commentOnOpenedPullRequest._askAboutChanges(['leadingCHANGES.md'],'master')).toBe(true);
        expect(commentOnOpenedPullRequest._askAboutChanges(['CHANGES.mdtrailing'],'master')).toBe(true);
    });

    it('commentOnOpenedPullRequest._askAboutThirdParty works', function () {
        expect(commentOnOpenedPullRequest._askAboutThirdParty(['ThirdParty/file.js'], ['ThirdParty'])).toBe(true);

        expect(commentOnOpenedPullRequest._askAboutThirdParty(['file.txt'], [])).toBe(false);
        expect(commentOnOpenedPullRequest._askAboutThirdParty(['file.txt'], undefined)).toBe(false);
        expect(commentOnOpenedPullRequest._askAboutThirdParty(['NotThirdParty/file.js'], ['ThirdParty'])).toBe(false);
    });

    it('commentOnOpenedPullRequest._implementation fetches latest repository settings.', function (done) {
        var pullRequestFilesUrl = 'pullRequestFilesUrl';
        var pullRequestCommentsUrl = 'pullRequestCommentsUrl';

        var repositorySettings = new RepositorySettings();

        spyOn(repositorySettings, 'fetchSettings').and.callFake(function() {
            return Promise.resolve(repositorySettings);
        });

        spyOn(requestPromise, 'post');

        spyOn(requestPromise, 'get').and.callFake(function (options) {
            if (options.url === pullRequestFilesUrl) {
                return Promise.resolve([
                    {filename: 'CHANGES.md'}
                ]);
            }
            return Promise.reject('Unknown url.');
        });

        commentOnOpenedPullRequest._implementation(pullRequestFilesUrl, pullRequestCommentsUrl, repositorySettings, userName, repositoryUrl)
            .then(function () {
                expect(repositorySettings.fetchSettings).toHaveBeenCalled();
                done();
            })
            .catch(done.fail);
    });

    it('commentOnOpenedPullRequest._implementation posts CLA confirmation if CHANGES.md was updated and there are no modified ThirdParty folders or CLA', function (done) {
        var pullRequestFilesUrl = 'pullRequestFilesUrl';
        var pullRequestCommentsUrl = 'pullRequestCommentsUrl';

        var repositorySettings = new RepositorySettings();

        spyOn(repositorySettings, 'fetchSettings').and.callFake(function() {
            return Promise.resolve(repositorySettings);
        });

        spyOn(requestPromise, 'post');

        spyOn(requestPromise, 'get').and.callFake(function (options) {
            if (options.url === pullRequestFilesUrl) {
                return Promise.resolve([
                    {filename: 'CHANGES.md'}
                ]);
            }
            return Promise.reject('Unknown url.');
        });

        commentOnOpenedPullRequest._implementation(pullRequestFilesUrl, pullRequestCommentsUrl, repositorySettings, userName, repositoryUrl)
            .then(function () {
                expect(requestPromise.post).toHaveBeenCalledWith({
                    url: pullRequestCommentsUrl,
                    headers: repositorySettings.headers,
                    body: {
                        body: repositorySettings.pullRequestOpenedTemplate({
                            userName: userName,
                            repository_url: repositoryUrl,
                            askForCla: false,
                            askAboutChanges: false,
                            askAboutThirdParty: false,
                            thirdPartyFolders: thirdPartyFolders.join(', ')
                        })
                    },
                    json: true
                });
                done();
            })
            .catch(done.fail);
    });

    it('commentOnOpenedPullRequest._implementation catches and reports errors processing CLA.json', function (done) {
        var pullRequestFilesUrl = 'pullRequestFilesUrl';
        var pullRequestCommentsUrl = 'pullRequestCommentsUrl';
        var claUrl = 'cla.json';
        var errorCla = new SyntaxError('Unexpected token a in JSON at position 15045');

        var repositorySettings = new RepositorySettings({
            claUrl: claUrl
        });

        spyOn(repositorySettings, 'fetchSettings').and.callFake(function() {
            return Promise.resolve(repositorySettings);
        });

        spyOn(requestPromise, 'post');

        spyOn(requestPromise, 'get').and.callFake(function (options) {
            if (options.url === pullRequestFilesUrl) {
                return Promise.resolve([
                    {filename: 'CHANGES.md'}
                ]);
            }

            if (options.url === claUrl) {
                return Promise.reject(errorCla);
            }
            return Promise.reject('Unknown url.');
        });

        commentOnOpenedPullRequest._implementation(pullRequestFilesUrl, pullRequestCommentsUrl, repositorySettings, userName, repositoryUrl)
            .then(function () {
                expect(requestPromise.post).toHaveBeenCalledWith({
                    url: pullRequestCommentsUrl,
                    headers: repositorySettings.headers,
                    body: {
                        body: repositorySettings.pullRequestOpenedTemplate({
                            userName: userName,
                            repository_url: repositoryUrl,
                            claEnabled: true,
                            askForCla: false,
                            errorCla: errorCla.toString(),
                            askAboutChanges: false,
                            askAboutThirdParty: false,
                            thirdPartyFolders: thirdPartyFolders.join(', ')
                        })
                    },
                    json: true
                });
                done();
            })
            .catch(done.fail);
    });

    it('commentOnOpenedPullRequest._implementation posts if CHANGES.md was not updated and there are no modified ThirdParty folders or CLA', function (done) {
        var pullRequestFilesUrl = 'pullRequestFilesUrl';
        var pullRequestCommentsUrl = 'pullRequestCommentsUrl';

        var repositorySettings = new RepositorySettings({
            thirdPartyFolders: thirdPartyFolders.join(',')
        });

        spyOn(repositorySettings, 'fetchSettings').and.callFake(function() {
            return Promise.resolve(repositorySettings);
        });

        spyOn(requestPromise, 'post');

        spyOn(requestPromise, 'get').and.callFake(function (options) {
            if (options.url === pullRequestFilesUrl) {
                return Promise.resolve([
                    {filename: 'notCHANGES.md'}
                ]);
            }
            return Promise.reject('Unknown url.');
        });

        commentOnOpenedPullRequest._implementation(pullRequestFilesUrl, pullRequestCommentsUrl, repositorySettings, userName, repositoryUrl, baseBranch)
            .then(function () {
                expect(requestPromise.post).toHaveBeenCalledWith({
                    url: pullRequestCommentsUrl,
                    headers: repositorySettings.headers,
                    body: {
                        body: repositorySettings.pullRequestOpenedTemplate({
                            userName: userName,
                            repository_url: repositoryUrl,
                            askForCla: false,
                            askAboutChanges: true,
                            askAboutThirdParty: false,
                            thirdPartyFolders: thirdPartyFolders.join(', ')
                        })
                    },
                    json: true
                });
                done();
            })
            .catch(done.fail);
    });

    it('commentOnOpenedPullRequest._implementation does not post when the target branch is not master', function (done) {
        var pullRequestFilesUrl = 'pullRequestFilesUrl';
        var pullRequestCommentsUrl = 'pullRequestCommentsUrl';

        var repositorySettings = new RepositorySettings({
            thirdPartyFolders: thirdPartyFolders.join(',')
        });

        spyOn(repositorySettings, 'fetchSettings').and.callFake(function() {
            return Promise.resolve(repositorySettings);
        });

        spyOn(requestPromise, 'post');

        spyOn(requestPromise, 'get').and.callFake(function (options) {
            if (options.url === pullRequestFilesUrl) {
                return Promise.resolve([
                    {filename: 'notCHANGES.md'}
                ]);
            }
            return Promise.reject('Unknown url.');
        });

        commentOnOpenedPullRequest._implementation(pullRequestFilesUrl, pullRequestCommentsUrl, repositorySettings, userName, repositoryUrl, 'feature-branch')
            .then(function () {
                expect(requestPromise.post).toHaveBeenCalledWith({
                    url: pullRequestCommentsUrl,
                    headers: repositorySettings.headers,
                    body: {
                        body: repositorySettings.pullRequestOpenedTemplate({
                            userName: userName,
                            repository_url: repositoryUrl,
                            askForCla: false,
                            askAboutChanges: false,
                            askAboutThirdParty: false,
                            thirdPartyFolders: thirdPartyFolders.join(', ')
                        })
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

        var repositorySettings = new RepositorySettings({
            thirdPartyFolders: thirdPartyFolders.join(',')
        });

        spyOn(repositorySettings, 'fetchSettings').and.callFake(function() {
            return Promise.resolve(repositorySettings);
        });

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

        commentOnOpenedPullRequest._implementation(pullRequestFilesUrl, pullRequestCommentsUrl, repositorySettings, userName, repositoryUrl)
            .then(function () {
                expect(requestPromise.post).toHaveBeenCalledWith({
                    url: pullRequestCommentsUrl,
                    headers: repositorySettings.headers,
                    body: {
                        body: repositorySettings.pullRequestOpenedTemplate({
                            userName: userName,
                            repository_url: repositoryUrl,
                            askForCla: false,
                            askAboutChanges: false,
                            askAboutThirdParty: true,
                            thirdPartyFolders: thirdPartyFolders.join(', ')
                        })
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

        var repositorySettings = new RepositorySettings({
            thirdPartyFolders: thirdPartyFolders.join(',')
        });

        spyOn(repositorySettings, 'fetchSettings').and.callFake(function() {
            return Promise.resolve(repositorySettings);
        });

        spyOn(requestPromise, 'post');

        spyOn(requestPromise, 'get').and.callFake(function (options) {
            if (options.url === pullRequestFilesUrl) {
                return Promise.resolve([
                    {filename: 'ThirdParty/stuff.js'}
                ]);
            }
            return Promise.reject('Unknown url.');
        });

        commentOnOpenedPullRequest._implementation(pullRequestFilesUrl, pullRequestCommentsUrl, repositorySettings, userName, repositoryUrl, baseBranch)
            .then(function () {
                expect(requestPromise.post).toHaveBeenCalledWith({
                    url: pullRequestCommentsUrl,
                    headers: repositorySettings.headers,
                    body: {
                        body: repositorySettings.pullRequestOpenedTemplate({
                            userName: userName,
                            repository_url: repositoryUrl,
                            askForCla: false,
                            askAboutChanges: true,
                            askAboutThirdParty: true,
                            thirdPartyFolders: thirdPartyFolders.join(', ')
                        })
                    },
                    json: true
                });
                done();
            })
            .catch(done.fail);
    });

    it('commentOnOpenedPullRequest._implementation posts if CHANGES.md was not updated and there are modified ThirdParty folders, and CLA check succeeded.', function (done) {
        var pullRequestFilesUrl = 'pullRequestFilesUrl';
        var pullRequestCommentsUrl = 'pullRequestCommentsUrl';
        var claUrl = 'cla.json';

        var repositorySettings = new RepositorySettings({
            thirdPartyFolders: thirdPartyFolders.join(','),
            claUrl: claUrl
        });

        spyOn(repositorySettings, 'fetchSettings').and.callFake(function() {
            return Promise.resolve(repositorySettings);
        });

        spyOn(requestPromise, 'post');

        spyOn(requestPromise, 'get').and.callFake(function (options) {
            if (options.url === pullRequestFilesUrl) {
                return Promise.resolve([
                    {filename: 'ThirdParty/stuff.js'}
                ]);
            }
            if (options.url === claUrl) {
                var content = Buffer.from(JSON.stringify([{gitHub: userName}])).toString('base64');
                return Promise.resolve({
                    content: content
                });
            }
            return Promise.reject('Unknown url.');
        });

        commentOnOpenedPullRequest._implementation(pullRequestFilesUrl, pullRequestCommentsUrl, repositorySettings, userName, repositoryUrl, baseBranch)
            .then(function () {
                expect(requestPromise.post).toHaveBeenCalledWith({
                    url: pullRequestCommentsUrl,
                    headers: repositorySettings.headers,
                    body: {
                        body: repositorySettings.pullRequestOpenedTemplate({
                            userName: userName,
                            repository_url: repositoryUrl,
                            claEnabled: true,
                            askForCla: false,
                            askAboutChanges: true,
                            askAboutThirdParty: true,
                            thirdPartyFolders: thirdPartyFolders.join(', ')
                        })
                    },
                    json: true
                });
                done();
            })
            .catch(done.fail);
    });

    it('commentOnOpenedPullRequest._implementation posts if CHANGES.md was not updated and there are modified ThirdParty folders, and CLA check failed.', function (done) {
        var pullRequestFilesUrl = 'pullRequestFilesUrl';
        var pullRequestCommentsUrl = 'pullRequestCommentsUrl';
        var claUrl = 'cla.json';

        var repositorySettings = new RepositorySettings({
            thirdPartyFolders: thirdPartyFolders.join(','),
            claUrl: claUrl
        });

        spyOn(repositorySettings, 'fetchSettings').and.callFake(function() {
            return Promise.resolve(repositorySettings);
        });

        spyOn(requestPromise, 'post');

        spyOn(requestPromise, 'get').and.callFake(function (options) {
            if (options.url === pullRequestFilesUrl) {
                return Promise.resolve([
                    {filename: 'ThirdParty/stuff.js'}
                ]);
            }
            if (options.url === claUrl) {
                var content = Buffer.from(JSON.stringify([{gitHub: 'bjones'}])).toString('base64');
                return Promise.resolve({
                    content: content
                });
            }
            return Promise.reject('Unknown url.');
        });

        commentOnOpenedPullRequest._implementation(pullRequestFilesUrl, pullRequestCommentsUrl, repositorySettings, userName, repositoryUrl, baseBranch)
            .then(function () {
                expect(requestPromise.post).toHaveBeenCalledWith({
                    url: pullRequestCommentsUrl,
                    headers: repositorySettings.headers,
                    body: {
                        body: repositorySettings.pullRequestOpenedTemplate({
                            userName: userName,
                            repository_url: repositoryUrl,
                            claEnabled: true,
                            askForCla: true,
                            askAboutChanges: true,
                            askAboutThirdParty: true,
                            thirdPartyFolders: thirdPartyFolders.join(', ')
                        })
                    },
                    json: true
                });
                done();
            })
            .catch(done.fail);
    });
});
