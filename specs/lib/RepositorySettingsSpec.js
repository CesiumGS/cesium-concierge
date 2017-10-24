'use strict';
var Promise = require('bluebird');

var RepositorySettings = require('../../lib/RepositorySettings');

describe('RepositorySettings', function () {
    it('fetchSettings requests repository settings from repo', function (done) {
        var settings = new RepositorySettings({
            name: 'Org/repo'
        });

        spyOn(settings, '_loadRepoConfig').and.callFake(function () {
            return Promise.resolve(settings);
        });

        settings.fetchSettings()
            .then(function () {
                expect(settings._loadRepoConfig).toHaveBeenCalledWith(settings.name, settings.headers, settings);
                done();
            })
            .catch(done.fail);
    });
});
