'use strict';

var nconf = require('nconf');

var Settings = require('../../lib/Settings');

describe('loadRepositoriesSettings', function () {
    beforeEach(function () {
        spyOn(nconf, 'env').and.returnValue(nconf);
    });

    it('returns rejected Promise when config does not have `secret`', function (done) {
        Settings.loadRepositoriesSettings('./specs/data/config/noSecret.json')
            .then(function () {
                done.fail();
            })
            .catch(function () {
                done();
            });
    });

    it('returns rejected Promise when config does not have `repositories`', function (done) {
        Settings.loadRepositoriesSettings('./specs/data/config/noRepositories.json')
            .then(function () {
                done.fail();
            })
            .catch(function () {
                done();
            });
    });

    it('returns rejected Promise when `repositories` do not have names', function (done) {
        Settings.loadRepositoriesSettings('./specs/data/config/noRepositoryNames.json')
            .then(function () {
                done.fail();
            })
            .catch(function (err) {
                if (/repositories/.test(err)) {
                    return done();
                }
                done.fail(err);
            });
    });

    it('returns rejected Promise when `repositories` do not have `gitHubToken`s', function (done) {
        Settings.loadRepositoriesSettings('./specs/data/config/noGitHubToken.json')
            .then(function () {
                done.fail();
            })
            .catch(function (err) {
                if (/gitHubToken/.test(err)) {
                    return done();
                }
                done.fail(err);
            });
    });

    it('returns rejected Promise when repositories don\'t have a user prepended', function (done) {
        Settings.loadRepositoriesSettings('./specs/data/config/noUserBeforeRepository.json')
        .then(function () {
            done.fail();
        })
        .catch(function (err) {
            if (/must be in the form/.test(err)) {
                return done();
            }
            done.fail(err);
        });
    });

    it('removes `/` from `thirdPartyFolders` that begin with `/`', function (done) {
        Settings.loadRepositoriesSettings('./specs/data/config/slashWithThirdPartyFolders.json')
            .then(function () {
                console.log(Settings.repositories);
                expect(Settings.repositories['a/one'].thirdPartyFolders).toEqual(['ThirdParty/']);
                done();
            })
            .catch(function (err) {
                done.fail(err);
            });
    });

    it('appends `/` to `thirdPartyFolders that don\'t end with `/`', function (done) {
        Settings.loadRepositoriesSettings('./specs/data/config/noEndSlashThirdPartyFolders.json')
            .then(function () {
                expect(Settings.repositories['a/one'].thirdPartyFolders).toEqual(['ThirdParty/']);
                done();
            })
            .catch(function (err) {
                done.fail(err);
            });
    });

    it('splits `thirdPartyFolders`', function (done) {
        Settings.loadRepositoriesSettings('./specs/data/config/multipleThirdPartyFolders.json')
            .then(function () {
                expect(Settings.repositories['a/one'].thirdPartyFolders).toEqual(['ThirdParty/', 'AnotherFolder/']);
                done();
            })
            .catch(function (err) {
                done.fail(err);
            });
    });

    it('sets `bumpStalePullRequests` `url` correctly', function (done) {
        Settings.loadRepositoriesSettings('./specs/data/config/bumpStalePullRequests_noUrl.json')
            .then(function () {
                expect(Settings.repositories['a/one'].bumpStalePullRequestsUrl).toEqual('https://api.github.com/repos/a/one/pulls');
                done();
            })
            .catch(function (err) {
                done.fail(err);
            });
    });

    it('correctly loads values', function (done) {
        Settings.loadRepositoriesSettings('./specs/data/config/noError.json')
            .then(function () {
                expect(Settings.repositories['a/one'].gitHubToken).toEqual('bar');
                expect(Settings.repositories['a/one'].someVal).toBe(true);
                expect(Settings.repositories['a/two'].gitHubToken).toEqual('bar2');
                expect(Settings.repositories['a/two'].someVal).toEqual(false);

                expect(Settings.port).toEqual(10);
                expect(Settings.listenPath).toEqual('/foo');
                expect(Settings.secret).toEqual('foo');
                done();
            })
            .catch(function (err) {
                done.fail(err);
            });
    });
});
