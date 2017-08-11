'use strict';

var fsExtra = require('fs-extra');
var Promise = require('bluebird');
var requestPromise = require('request-promise');

var commentOnOpenedPullRequest = require('../../lib/commentOnOpenedPullRequest');

var claJson = fsExtra.readJsonSync('./specs/data/config/CLA.json');
var content = Buffer.from(JSON.stringify(claJson)).toString('base64');
var cla = {
    body: {
        content: content
    }
};

describe('commentOnOpenedPullRequest', function () {
    it('throws if `jsonResponse` is undefined', function () {
        expect(function () {
            commentOnOpenedPullRequest(undefined);
        }).toThrowError();
    });

    it('throws if `headers` is undefined', function () {
        expect(function () {
            commentOnOpenedPullRequest({}, undefined);
        }).toThrowError();
    });

    it('throws if json is not a pull request event', function () {
        var issueJson = fsExtra.readJsonSync('./specs/data/events/issue.json');
        expect(function () {
            commentOnOpenedPullRequest(issueJson, {});
        }).toThrowError();
    });

    it('gets correct URLs from JSON response', function () {
        spyOn(commentOnOpenedPullRequest, '_implementation');
        var pullRequestJson = fsExtra.readJsonSync('./specs/data/events/pullRequest.json');
        commentOnOpenedPullRequest(pullRequestJson, {}, [], false);
        expect(commentOnOpenedPullRequest._implementation).toHaveBeenCalledWith('https://api.github.com/repos/baxterthehacker/public-repo/pulls/1/files',
            'https://api.github.com/repos/baxterthehacker/public-repo/issues/1/comments', {}, [], false, undefined, 'baxterthehacker');

        commentOnOpenedPullRequest(pullRequestJson, {}, ['c'], true);
        expect(commentOnOpenedPullRequest._implementation).toHaveBeenCalledWith('https://api.github.com/repos/baxterthehacker/public-repo/pulls/1/files',
            'https://api.github.com/repos/baxterthehacker/public-repo/issues/1/comments', {}, ['c'], true, undefined, 'baxterthehacker');
    });
});

describe('commentOnOpenedPullRequest._implementation', function () {
    var pullRequestFiles = fsExtra.readJsonSync('./specs/data/responses/pullRequestFiles.json');
    var pullRequestFiles404 = fsExtra.readJsonSync('./specs/data/responses/pullRequestFiles_404.json');
    var pullRequestFilesWithChanges = fsExtra.readJsonSync('./specs/data/responses/pullRequestFiles_CHANGES.json');

    function okPullRequest() {
        spyOn(requestPromise, 'get').and.returnValue(Promise.resolve(pullRequestFiles));
    }
    beforeEach(function () {
        spyOn(requestPromise, 'post');
    });

    it('rejects 404 code', function (done) {
        spyOn(requestPromise, 'get').and.returnValue(Promise.resolve(pullRequestFiles404));
        commentOnOpenedPullRequest._implementation()
            .then(function () {
                done.fail();
            })
            .catch(function (err) {
                if (/status code/i.test(err)) {
                    return done();
                }
                done.fail();
            });
    });

    it('gets files from JSON', function (done) {
        okPullRequest();
        spyOn(commentOnOpenedPullRequest, '_didUpdateChanges');
        spyOn(commentOnOpenedPullRequest, '_didUpdateThirdParty');
        commentOnOpenedPullRequest._implementation()
            .then(function () {
                expect(commentOnOpenedPullRequest._didUpdateChanges).toHaveBeenCalledWith(['.gitignore',
                    'index.js', 'lib/Settings.js', 'lib/commentOnClosedIssue.js', 'lib/getUniqueMatch.js',
                    'specs/data/config_noError.json', 'specs/data/config_noGitHubToken.json',
                    'specs/data/config_noRepositories.json', 'specs/data/config_noRepositoryNames.json',
                    'specs/data/config_noSecret.json', 'specs/lib/SettingsSpec.js']);
                expect(commentOnOpenedPullRequest._didUpdateThirdParty).toHaveBeenCalledWith(['.gitignore',
                    'index.js', 'lib/Settings.js', 'lib/commentOnClosedIssue.js', 'lib/getUniqueMatch.js',
                    'specs/data/config_noError.json', 'specs/data/config_noGitHubToken.json',
                    'specs/data/config_noRepositories.json', 'specs/data/config_noRepositoryNames.json',
                    'specs/data/config_noSecret.json', 'specs/lib/SettingsSpec.js'], undefined);
                done();
            })
            .catch(function (err) {
                done.fail(err);
            });
    });

    it('Posts Third Party and CHANGES signature', function (done) {
        okPullRequest();
        commentOnOpenedPullRequest._implementation('', '', {}, ['specs/data/'], true)
            .then(function () {
                expect(requestPromise.post.calls.argsFor(0)[0].body.body).toMatch(/CHANGES/);
                expect(requestPromise.post.calls.argsFor(1)[0].body.body).toMatch(/license/i);
                done();
            })
            .catch(function (err) {
                done.fail(err);
            });
    });

    it('Posts well-formatted English for two Third Party folders', function (done) {
        okPullRequest();
        commentOnOpenedPullRequest._implementation('', '', {}, ['specs/data/', 'a/b/'], true)
            .then(function () {
                var obj = requestPromise.post.calls.argsFor(1)[0];
                expect(obj.body.body).toMatch(/`specs\/data\/` or `a\/b\/`/i);
                done();
            })
            .catch(function (err) {
                done.fail(err);
            });
    });

    it('Posts well-formatted English for three Third Party folders', function (done) {
        okPullRequest();
        commentOnOpenedPullRequest._implementation('', '', {}, ['specs/data/', 'a/b/', 'some/folder/'], true)
            .then(function () {
                var obj = requestPromise.post.calls.argsFor(1)[0];
                expect(obj.body.body).toMatch(/`specs\/data\/`, `a\/b\/`, or `some\/folder\/`/i);
                done();
            })
            .catch(function (err) {
                done.fail(err);
            });
    });

    it('Does not post CHANGES or Third Party signature', function (done) {
        spyOn(requestPromise, 'get').and.returnValue(Promise.resolve(pullRequestFilesWithChanges));
        commentOnOpenedPullRequest._implementation('', '', {}, ['/some/folder'], true)
            .then(function () {
                expect(requestPromise.post).toHaveBeenCalledTimes(0);
                done();
            })
            .catch(function (err) {
                done.fail(err);
            });
    });

    function switchGet() {
        spyOn(requestPromise, 'get').and.callFake(function (obj) {
            if (/files/.test(obj.url)) {
                return Promise.resolve(pullRequestFiles);
            }
            return Promise.resolve(cla);
        });
    }
    it('Does not post when user has signed CLA', function (done) {
        switchGet();
        commentOnOpenedPullRequest._implementation('.../files', '', {}, [], false,
            'https://api.github.com/repos/AnalyticalGraphicsInc/cesium-concierge/contents/specs/data/responses/issue.json', 'bbb')
            .then(function () {
                expect(requestPromise.post).not.toHaveBeenCalled();
                done();
            })
            .catch(function (err) {
                done.fail(err);
            });
    });

    it('Posts when user has not signed CLA', function (done) {
        switchGet();
        commentOnOpenedPullRequest._implementation('.../files', '', {}, [], false,
            'https://api.github.com/repos/AnalyticalGraphicsInc/cesium-concierge/contents/specs/data/responses/issue.json', 'test')
            .then(function () {
                var obj = requestPromise.post.calls.argsFor(0)[0];
                console.log(requestPromise.post.calls.argsFor(0));
                expect(obj.body.body).toMatch(/Welcome/);
                done();
            })
            .catch(function (err) {
                done.fail(err);
            });
    });
});

describe('commentOnOpenedPullRequest._didUpdateChanges', function () {
    it('returns false for []', function () {
        expect(commentOnOpenedPullRequest._didUpdateChanges([])).toBe(false);
    });

    it('returns true for CHANGES.md at top level', function () {
        expect(commentOnOpenedPullRequest._didUpdateChanges(['CHANGES.md'])).toBe(true);
        expect(commentOnOpenedPullRequest._didUpdateChanges(['/test/test.txt', '/a/b/c', 'CHANGES.md'])).toBe(true);
    });

    it('returns false for closely-named CHANGES.md files', function () {
        expect(commentOnOpenedPullRequest._didUpdateChanges(['CHANGES.txt'])).toBe(false);
        expect(commentOnOpenedPullRequest._didUpdateChanges(['CHANGES.old.md'])).toBe(false);
        expect(commentOnOpenedPullRequest._didUpdateChanges(['.CHANGES.md'])).toBe(false);
        expect(commentOnOpenedPullRequest._didUpdateChanges(['/CHANGES'])).toBe(false);
    });

    it('returns false for CHANGES.md at other levels', function () {
        expect(commentOnOpenedPullRequest._didUpdateChanges(['./a/CHANGES.md', './b/CHANGES.md'])).toBe(false);
        expect(commentOnOpenedPullRequest._didUpdateChanges(['/a/b/c/CHANGES.md'])).toBe(false);
    });
});

describe('commentOnOpenedPullRequest._didUpdateThirdParty', function () {
    it('returns false when thirdPartyFolders is [] or undefined', function () {
        expect(commentOnOpenedPullRequest._didUpdateThirdParty(['file.txt'], undefined)).toBe(false);
        expect(commentOnOpenedPullRequest._didUpdateThirdParty(['file.txt'], [])).toBe(false);
    });

    it('matches file with list of folders', function () {
        expect(commentOnOpenedPullRequest._didUpdateThirdParty(['/a/b/file.txt'], ['/some/folder', '/a/b'])).toBe(true);
        expect(commentOnOpenedPullRequest._didUpdateThirdParty(['.gitignore',
            'index.js', 'lib/Settings.js', 'lib/commentOnClosedIssue.js', 'lib/getUniqueMatch.js',
            'specs/data/config_noError.json', 'specs/data/config_noGitHubToken.json',
            'specs/data/config_noRepositories.json', 'specs/data/config_noRepositoryNames.json',
            'specs/data/config_noSecret.json', 'specs/lib/SettingsSpec.js'], 'lib')).toBe(true);
    });

    it('matches multiple files with list of folders', function () {
        expect(commentOnOpenedPullRequest._didUpdateThirdParty(['a/b/file.txt', ''], ['some/folder/', 'a/b/'])).toBe(true);
        expect(commentOnOpenedPullRequest._didUpdateThirdParty(['file.txt'], ['', 'a/b/'])).toBe(true);
        expect(commentOnOpenedPullRequest._didUpdateThirdParty(['b/file.txt'], ['some/folder/', 'b/'])).toBe(true);
    });

    it('does not confuse files with folders', function () {
        expect(commentOnOpenedPullRequest._didUpdateThirdParty(['c.txt'], ['/some/folder/', '/a/b/', '/c/'])).toBe(false);
        expect(commentOnOpenedPullRequest._didUpdateThirdParty(['./c.txt'], ['/some/folder/', '/a/b/', '/c/npm/'])).toBe(false);
    });

    it('returns false for non-matching files', function () {
        expect(commentOnOpenedPullRequest._didUpdateThirdParty(['c.txt'], ['/some/folder/'])).toBe(false);
        expect(commentOnOpenedPullRequest._didUpdateThirdParty(['c.txt'], ['/a/b/c/'])).toBe(false);
        expect(commentOnOpenedPullRequest._didUpdateThirdParty(['/a/bc.txt'], ['/a/b/c/'])).toBe(false);
    });
});

describe('commentOnOpenedPullRequest._needsToUpdateCLA', function () {
    it('returns true when username is not in cla', function () {
        expect(commentOnOpenedPullRequest._needsToUpdateCLA('test', claJson)).toBe(true);
    });

    it('returns false when username is in cla', function () {
        expect(commentOnOpenedPullRequest._needsToUpdateCLA('bbb', claJson)).toBe(false);
    });

    it('returns false when cla is null', function () {
        expect(commentOnOpenedPullRequest._needsToUpdateCLA('test', null)).toBe(false);
    });
});
