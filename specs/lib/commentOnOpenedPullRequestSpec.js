'use strict';

const fsExtra = require('fs-extra');

const Promise = require('bluebird');
const requestPromise = require('request-promise');

const commentOnOpenedPullRequest = require('../../lib/commentOnOpenedPullRequest');
const RepositorySettings = require('../../lib/RepositorySettings');
const Settings = require('../../lib/Settings');

describe('commentOnOpenedPullRequest', function () {
    const filesUrl = 'url/files';
    const commentsUrl = 'https://api.github.com/repos/CesiumGS/cesium/issues/1/comments';
    const userName = 'boomerJones';
    const repositoryName = 'CesiumGS/cesium';
    const repositoryUrl = 'https://github.com/CesiumGS/cesium';
    const repositoryContributorsUrl = 'https://api.github.com/repos/CesiumGS/cesium/contributors';
    const thirdPartyFolders = ['ThirdParty/', 'Source/ThirdParty/'];
    const baseBranch = 'main';
    const headBranch = 'feature';
    const headHtmlUrl = repositoryUrl;
    const headApiUrl = 'https://api.github.com/repos/CesiumGS/cesium';

    const pullRequestJson = {
        pull_request: {
            url: 'url',
            comments_url: commentsUrl,
            user: {
                login: userName
            },
            head: {
                ref: 'feature',
                repo: {
                    url: headApiUrl,
                    html_url: headHtmlUrl
                }
            },
            base: {
                ref: 'main'
            }
        },
        repository: {
            html_url: repositoryUrl,
            contributors_url: repositoryContributorsUrl,
            full_name: repositoryName
        }
    };

    const googleSheetsIndividualResponse = {
        data : {
            values : [
                ['boomerJones'],
                []//The spreadsheet may have an empty row
            ]
        }
    };

    const googleSheetsCorporateResponse = {
        data : {
            values : [
                [],
                ['Boomer Jones - boomerJones\nOmar Shehata - OmarShehata']
            ]
        }
    };

    beforeEach(function () {
        spyOnProperty(Settings, 'individualClaSheetID').and.returnValue('individual');
        spyOnProperty(Settings, 'corporateClaSheetID').and.returnValue('corporate');

        Settings.googleSheetsApi = {
            spreadsheets : {
                values : {
                    get : function(options) {
                        if (options.spreadsheetId === 'individual') {
                            return Promise.resolve(googleSheetsIndividualResponse);
                        } else if (options.spreadsheetId === 'corporate') {
                            return Promise.resolve(googleSheetsCorporateResponse);
                        }

                        return Promise.reject('Invalid sheet ID.');
                    }
                }
            }
        };
    });

    afterEach(function () {
        delete Settings['googleSheetsApi'];
    });

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
        const issueJson = fsExtra.readJsonSync('./specs/data/events/issue.json');
        expect(function () {
            commentOnOpenedPullRequest(issueJson, {});
        }).toThrowError();
    });

    it('passes expected parameters to implementation', function () {
        spyOn(commentOnOpenedPullRequest, '_implementation');

        const repositorySettings = new RepositorySettings();

        commentOnOpenedPullRequest(pullRequestJson, repositorySettings);

        expect(commentOnOpenedPullRequest._implementation).toHaveBeenCalledWith(filesUrl, commentsUrl, repositorySettings, userName, repositoryUrl, baseBranch, headBranch, headHtmlUrl, headApiUrl, repositoryContributorsUrl);
    });

    it('commentOnOpenedPullRequest._askAboutChanges works', function () {
        expect(commentOnOpenedPullRequest._askAboutChanges(['CHANGES.md'],'main')).toBe(false);
        expect(commentOnOpenedPullRequest._askAboutChanges(['file.txt'],'feature-branch')).toBe(false);

        expect(commentOnOpenedPullRequest._askAboutChanges([],'main')).toBe(true);
        expect(commentOnOpenedPullRequest._askAboutChanges(['file.txt'],'main')).toBe(true);
        expect(commentOnOpenedPullRequest._askAboutChanges(['CHANGES.MD'],'main')).toBe(true);
        expect(commentOnOpenedPullRequest._askAboutChanges(['leadingCHANGES.md'],'main')).toBe(true);
        expect(commentOnOpenedPullRequest._askAboutChanges(['CHANGES.mdtrailing'],'main')).toBe(true);
    });

    it('commentOnOpenedPullRequest._askAboutTests works', function () {
        expect(commentOnOpenedPullRequest._askAboutTests(['file.txt'])).toBe(false);
        expect(commentOnOpenedPullRequest._askAboutTests(['Specs/lib/testSpec.js'])).toBe(false);
        expect(commentOnOpenedPullRequest._askAboutTests(['Specs/lib/testSpec.js'], 'Specs/')).toBe(false);
        expect(commentOnOpenedPullRequest._askAboutTests(['specs/lib/testSpec.js'], 'Specs/')).toBe(false);

        expect(commentOnOpenedPullRequest._askAboutTests(['file.txt'], 'Specs/')).toBe(true);
    });

    it('commentOnOpenedPullRequest._askAboutThirdParty works', function () {
        expect(commentOnOpenedPullRequest._askAboutThirdParty(['ThirdParty/file.js'], ['ThirdParty'])).toBe(true);

        expect(commentOnOpenedPullRequest._askAboutThirdParty(['file.txt'], [])).toBe(false);
        expect(commentOnOpenedPullRequest._askAboutThirdParty(['file.txt'], undefined)).toBe(false);
        expect(commentOnOpenedPullRequest._askAboutThirdParty(['NotThirdParty/file.js'], ['ThirdParty'])).toBe(false);
    });

    it('commentOnOpenedPullRequest._implementation fetches latest repository settings.', function (done) {
        const pullRequestFilesUrl = 'pullRequestFilesUrl';
        const pullRequestCommentsUrl = 'pullRequestCommentsUrl';

        const repositorySettings = new RepositorySettings();

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
        const pullRequestFilesUrl = 'pullRequestFilesUrl';
        const pullRequestCommentsUrl = 'pullRequestCommentsUrl';

        const repositorySettings = new RepositorySettings();

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
                            claEnabled: true,
                            askForCla: false,
                            askAboutChanges: false,
                            askAboutThirdParty: false,
                            thirdPartyFolders: thirdPartyFolders.join(', '),
                            headBranch: headBranch
                        })
                    },
                    json: true
                });
                done();
            })
            .catch(done.fail);
    });

    it('commentOnOpenedPullRequest._askForCla catches and reports errors with Google Sheets API', function () {
        const errorText = 'Google Sheets API failed.';

        spyOn(Settings.googleSheetsApi.spreadsheets.values, 'get').and.callFake(function () {
            return Promise.reject(errorText);
        });

        return commentOnOpenedPullRequest._askForCla(userName)
            .then(function() {
                fail('expected promise to reject.');
            })
            .catch(function(error) {
                expect(error).toBe(errorText);
            });
    });

    it('commentOnOpenedPullRequest._implementation catches and reports errors processing CLA check', function (done) {
        const pullRequestFilesUrl = 'pullRequestFilesUrl';
        const pullRequestCommentsUrl = 'pullRequestCommentsUrl';
        const errorCla = new Error('Error checking CLA.');
        const repositorySettings = new RepositorySettings();

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

        spyOn(commentOnOpenedPullRequest, '_askForCla').and.callFake(function () {
            return Promise.reject(errorCla);
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
                            thirdPartyFolders: thirdPartyFolders.join(', '),
                            headBranch: headBranch
                        })
                    },
                    json: true
                });
                done();
            })
            .catch(done.fail);
    });

    it('commentOnOpenedPullRequest._implementation posts if CHANGES.md was not updated and there are no modified ThirdParty folders or CLA', function (done) {
        const pullRequestFilesUrl = 'pullRequestFilesUrl';
        const pullRequestCommentsUrl = 'pullRequestCommentsUrl';

        const repositorySettings = new RepositorySettings({
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

        commentOnOpenedPullRequest._implementation(pullRequestFilesUrl, pullRequestCommentsUrl, repositorySettings, userName, repositoryUrl, baseBranch, headBranch)
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
                            askAboutThirdParty: false,
                            thirdPartyFolders: thirdPartyFolders.join(', '),
                            headBranch: headBranch
                        })
                    },
                    json: true
                });
                done();
            })
            .catch(done.fail);
    });

    it('commentOnOpenedPullRequest._implementation does not post when the target branch is not main', function (done) {
        const pullRequestFilesUrl = 'pullRequestFilesUrl';
        const pullRequestCommentsUrl = 'pullRequestCommentsUrl';

        const repositorySettings = new RepositorySettings({
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
                            claEnabled: true,
                            askForCla: false,
                            askAboutChanges: false,
                            askAboutThirdParty: false,
                            thirdPartyFolders: thirdPartyFolders.join(', '),
                            headBranch: headBranch
                        })
                    },
                    json: true
                });
                done();
            })
            .catch(done.fail);
    });

    it('commentOnOpenedPullRequest._implementation posts if CHANGES.md was updated but there are modified ThirdParty folders', function (done) {
        const pullRequestFilesUrl = 'pullRequestFilesUrl';
        const pullRequestCommentsUrl = 'pullRequestCommentsUrl';

        const repositorySettings = new RepositorySettings({
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
                            claEnabled: true,
                            askForCla: false,
                            askAboutChanges: false,
                            askAboutThirdParty: true,
                            thirdPartyFolders: thirdPartyFolders.join(', '),
                            headBranch: headBranch
                        })
                    },
                    json: true
                });
                done();
            })
            .catch(done.fail);
    });

    it('commentOnOpenedPullRequest._implementation posts if CHANGES.md was not updated and there are modified ThirdParty folders', function (done) {
        const pullRequestFilesUrl = 'pullRequestFilesUrl';
        const pullRequestCommentsUrl = 'pullRequestCommentsUrl';

        const repositorySettings = new RepositorySettings({
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

        commentOnOpenedPullRequest._implementation(pullRequestFilesUrl, pullRequestCommentsUrl, repositorySettings, userName, repositoryUrl, baseBranch, headBranch)
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
                            thirdPartyFolders: thirdPartyFolders.join(', '),
                            headBranch: headBranch
                        })
                    },
                    json: true
                });
                done();
            })
            .catch(done.fail);
    });

    it('commentOnOpenedPullRequest._implementation posts if CHANGES.md was not updated and there are modified ThirdParty folders, and CLA check succeeded.', function (done) {
        const pullRequestFilesUrl = 'pullRequestFilesUrl';
        const pullRequestCommentsUrl = 'pullRequestCommentsUrl';
        const claUrl = 'cla.json';

        const repositorySettings = new RepositorySettings({
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
                const content = Buffer.from(JSON.stringify([{gitHub: userName}])).toString('base64');
                return Promise.resolve({
                    content: content
                });
            }
            return Promise.reject('Unknown url.');
        });

        commentOnOpenedPullRequest._implementation(pullRequestFilesUrl, pullRequestCommentsUrl, repositorySettings, userName, repositoryUrl, baseBranch, headBranch)
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
                            thirdPartyFolders: thirdPartyFolders.join(', '),
                            headBranch: headBranch
                        })
                    },
                    json: true
                });
                done();
            })
            .catch(done.fail);
    });

    it('commentOnOpenedPullRequest._implementation posts if CHANGES.md was not updated and there are modified ThirdParty folders, and CLA check failed.', function (done) {
        const pullRequestFilesUrl = 'pullRequestFilesUrl';
        const pullRequestCommentsUrl = 'pullRequestCommentsUrl';
        const newContributor = 'newContributor';

        const repositorySettings = new RepositorySettings({
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

        commentOnOpenedPullRequest._implementation(pullRequestFilesUrl, pullRequestCommentsUrl, repositorySettings, newContributor, repositoryUrl, baseBranch, headBranch)
            .then(function () {
                expect(requestPromise.post).toHaveBeenCalledWith({
                    url: pullRequestCommentsUrl,
                    headers: repositorySettings.headers,
                    body: {
                        body: repositorySettings.pullRequestOpenedTemplate({
                            userName: newContributor,
                            repository_url: repositoryUrl,
                            claEnabled: true,
                            askForCla: true,
                            askAboutChanges: true,
                            askAboutThirdParty: true,
                            thirdPartyFolders: thirdPartyFolders.join(', '),
                            headBranch: headBranch
                        })
                    },
                    json: true
                });
                done();
            })
            .catch(done.fail);
    });

    it('commentOnOpenedPullRequest._implementation reminds user to add to CONTRIBUTORS.md.', function (done) {
        const pullRequestFilesUrl = 'pullRequestFilesUrl';
        const pullRequestCommentsUrl = 'pullRequestCommentsUrl';
        const contributorsPath = 'CONTRIBUTORS.md';
        const apiUrl = `${headApiUrl  }/contents/${  contributorsPath  }?ref=${  headBranch}`;
        const htmlUrl =  `${headHtmlUrl  }/blob/${  headBranch  }/${  contributorsPath}`;
        const newContributor = 'newContributor';

        const repositorySettings = new RepositorySettings({
            contributorsPath: contributorsPath,
        });

        spyOn(repositorySettings, 'fetchSettings').and.callFake(function() {
            return Promise.resolve(repositorySettings);
        });

        spyOn(requestPromise, 'post');

        spyOn(requestPromise, 'get').and.callFake(function (options) {
            if (options.url === pullRequestFilesUrl) {
                return Promise.resolve([
                    {filename: 'file.txt'}
                ]);
            }

            if (options.url === apiUrl) {
                const content = Buffer.from(`* [Jane Doe](https://github.com/JaneDoe)\n* [Boomer Jones](https://github.com/${  userName  })`).toString('base64');
                return Promise.resolve({
                    content: content
                });
            }

            return Promise.reject(`Unknown url: ${  options.url}`);
        });

        commentOnOpenedPullRequest._implementation(pullRequestFilesUrl, pullRequestCommentsUrl, repositorySettings, newContributor, repositoryUrl, baseBranch, headBranch, headHtmlUrl, headApiUrl, repositoryContributorsUrl)
            .then(function () {
                expect(requestPromise.post).toHaveBeenCalledWith({
                    url: pullRequestCommentsUrl,
                    headers: repositorySettings.headers,
                    body: {
                        body: repositorySettings.pullRequestOpenedTemplate({
                            userName: newContributor,
                            repository_url: repositoryUrl,
                            claEnabled: true,
                            askForCla: true,
                            askAboutContributors: true,
                            contributorsUrl: htmlUrl,
                            askAboutChanges: true,
                            headBranch: headBranch
                        })
                    },
                    json: true
                });
                done();
            })
            .catch(done.fail);
    });

    it('commentOnOpenedPullRequest._implementation informs about first time user using GitHub Contributors', function (done) {
        const pullRequestFilesUrl = 'pullRequestFilesUrl';
        const pullRequestCommentsUrl = 'pullRequestCommentsUrl';
        const newContributor = 'newContributor';

        const repositorySettings = new RepositorySettings({
            contributorsFromGitHub: true
        });

        spyOn(repositorySettings, 'fetchSettings').and.callFake(function() {
            return Promise.resolve(repositorySettings);
        });

        spyOn(requestPromise, 'post');

        spyOn(requestPromise, 'get').and.callFake(function (options) {
            if (options.url === pullRequestFilesUrl) {
                return Promise.resolve([
                    {filename: 'file.txt'}
                ]);
            }

            if (options.url === repositoryContributorsUrl) {
                return Promise.resolve({
                    headers: {},
                    body: []
                });
            }

            return Promise.reject(`Unknown url: ${  options.url}`);
        });

        commentOnOpenedPullRequest._implementation(pullRequestFilesUrl, pullRequestCommentsUrl, repositorySettings, newContributor, repositoryUrl, baseBranch, headBranch, headHtmlUrl, headApiUrl, repositoryContributorsUrl)
            .then(function () {
                expect(requestPromise.post).toHaveBeenCalledWith({
                    url: pullRequestCommentsUrl,
                    headers: repositorySettings.headers,
                    body: {
                        body: repositorySettings.pullRequestOpenedTemplate({
                            userName: newContributor,
                            repository_url: repositoryUrl,
                            claEnabled: true,
                            askForCla: true,
                            askAboutContributors: true,
                            askAboutChanges: true,
                            headBranch: headBranch
                        })
                    },
                    json: true
                });
                done();
            })
            .catch(done.fail);
    });

    it('commentOnOpenedPullRequest._implementation informs about first time user using GitHub Contributors from different page', function (done) {
        const pullRequestFilesUrl = 'pullRequestFilesUrl';
        const pullRequestCommentsUrl = 'pullRequestCommentsUrl';
        const newContributor = 'newContributor';
        const nextContributorsPageUrl = 'https://api.github.com/repositories/3606738/contributors?page=2';

        const repositorySettings = new RepositorySettings({
            contributorsFromGitHub: true
        });

        spyOn(repositorySettings, 'fetchSettings').and.callFake(function() {
            return Promise.resolve(repositorySettings);
        });

        spyOn(requestPromise, 'post');

        spyOn(requestPromise, 'get').and.callFake(function (options) {
            if (options.url === pullRequestFilesUrl) {
                return Promise.resolve([
                    {filename: 'file.txt'}
                ]);
            }


            if (options.url === repositoryContributorsUrl) {
                return Promise.resolve({
                    headers: {
                        link: '<https://api.github.com/repositories/3606738/contributors?page=2>; rel="next", <https://api.github.com/repositories/3606738/contributors?page=9>; rel="last"',
                    },
                    body: []
                });
            }

            if (options.url === nextContributorsPageUrl) {
                return Promise.resolve({
                    headers: {},
                    body: []
                });
            }

            return Promise.reject(`Unknown url: ${  options.url}`);
        });

        commentOnOpenedPullRequest._implementation(pullRequestFilesUrl, pullRequestCommentsUrl, repositorySettings, newContributor, repositoryUrl, baseBranch, headBranch, headHtmlUrl, headApiUrl, repositoryContributorsUrl)
            .then(function () {
                expect(requestPromise.post).toHaveBeenCalledWith({
                    url: pullRequestCommentsUrl,
                    headers: repositorySettings.headers,
                    body: {
                        body: repositorySettings.pullRequestOpenedTemplate({
                            userName: newContributor,
                            repository_url: repositoryUrl,
                            claEnabled: true,
                            askForCla: true,
                            askAboutContributors: true,
                            askAboutChanges: true,
                            headBranch: headBranch
                        })
                    },
                    json: true
                });
                done();
            })
            .catch(done.fail);
    });

    it('commentOnOpenedPullRequest._implementation does not post reminder about CONTRIBUTORS.md if user is already in there.', function (done) {
        const pullRequestFilesUrl = 'pullRequestFilesUrl';
        const pullRequestCommentsUrl = 'pullRequestCommentsUrl';
        const contributorsPath = 'CONTRIBUTORS.md';
        const apiUrl = `${headApiUrl  }/contents/${  contributorsPath  }?ref=${  headBranch}`;

        const repositorySettings = new RepositorySettings({
            contributorsPath: contributorsPath
        });

        spyOn(repositorySettings, 'fetchSettings').and.callFake(function() {
            return Promise.resolve(repositorySettings);
        });

        spyOn(requestPromise, 'post');

        spyOn(requestPromise, 'get').and.callFake(function (options) {
            if (options.url === pullRequestFilesUrl) {
                return Promise.resolve([
                    {filename: 'file.txt'}
                ]);
            }

            if (options.url === apiUrl) {
                const content = Buffer.from(`* [Jane Doe](https://github.com/JaneDoe)\n* [Boomer Jones](https://github.com/${  userName  })`).toString('base64');
                return Promise.resolve({
                    content: content
                });
            }
            return Promise.reject(`Unknown url: ${  options.url}`);
        });

        commentOnOpenedPullRequest._implementation(pullRequestFilesUrl, pullRequestCommentsUrl, repositorySettings, userName, repositoryUrl, baseBranch, headBranch, headHtmlUrl, headApiUrl, repositoryContributorsUrl)
            .then(function () {
                expect(requestPromise.post).toHaveBeenCalledWith({
                    url: pullRequestCommentsUrl,
                    headers: repositorySettings.headers,
                    body: {
                        body: repositorySettings.pullRequestOpenedTemplate({
                            userName: userName,
                            repository_url: repositoryUrl,
                            claEnabled: true,
                            askAboutContributors: false,
                            askAboutChanges: true,
                            headBranch: headBranch
                        })
                    },
                    json: true
                });
                done();
            })
            .catch(done.fail);
    });

    it('commentOnOpenedPullRequest._implementation does not remind existing contributor using GitHub Contributors', function (done) {
        const pullRequestFilesUrl = 'pullRequestFilesUrl';
        const pullRequestCommentsUrl = 'pullRequestCommentsUrl';

        const repositorySettings = new RepositorySettings({
            contributorsFromGitHub: true
        });

        spyOn(repositorySettings, 'fetchSettings').and.callFake(function() {
            return Promise.resolve(repositorySettings);
        });

        spyOn(requestPromise, 'post');

        spyOn(requestPromise, 'get').and.callFake(function (options) {
            if (options.url === pullRequestFilesUrl) {
                return Promise.resolve([
                    {filename: 'file.txt'}
                ]);
            }

            if (options.url === repositoryContributorsUrl) {
                return Promise.resolve({
                    headers: {},
                    body: [{
                        login: userName
                    }]
                });
            }

            return Promise.reject(`Unknown url: ${  options.url}`);
        });

        commentOnOpenedPullRequest._implementation(pullRequestFilesUrl, pullRequestCommentsUrl, repositorySettings, userName, repositoryUrl, baseBranch, headBranch, headHtmlUrl, headApiUrl, repositoryContributorsUrl)
            .then(function () {
                expect(requestPromise.post).toHaveBeenCalledWith({
                    url: pullRequestCommentsUrl,
                    headers: repositorySettings.headers,
                    body: {
                        body: repositorySettings.pullRequestOpenedTemplate({
                            userName: userName,
                            repository_url: repositoryUrl,
                            claEnabled: true,
                            askAboutContributors: false,
                            askAboutChanges: true,
                            headBranch: headBranch
                        })
                    },
                    json: true
                });
                done();
            })
            .catch(done.fail);
    });

    it('works when Google Sheets API is not configured', function () {
        const pullRequestFilesUrl = 'pullRequestFilesUrl';
        const pullRequestCommentsUrl = 'pullRequestCommentsUrl';

        Settings.googleSheetsApi = undefined;

        const repositorySettings = new RepositorySettings();

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

        return commentOnOpenedPullRequest._implementation(pullRequestFilesUrl, pullRequestCommentsUrl, repositorySettings, userName, repositoryUrl)
            .then(function () {
                expect(requestPromise.post).toHaveBeenCalledWith({
                    url: pullRequestCommentsUrl,
                    headers: repositorySettings.headers,
                    body: {
                        body: repositorySettings.pullRequestOpenedTemplate({
                            userName: userName,
                            repository_url: repositoryUrl,
                            claEnabled: false,
                            askAboutChanges: false,
                            askAboutThirdParty: false,
                            thirdPartyFolders: thirdPartyFolders.join(', '),
                            headBranch: headBranch
                        })
                    },
                    json: true
                });
            });
        });
});
