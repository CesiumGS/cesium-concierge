'use strict';

const Cesium = require('cesium');
const child_process = require('child_process');
const eventStream = require('event-stream');
const fsExtra = require('fs-extra');
const gulp = require('gulp');
const gulpTap = require('gulp-tap');
const gulpZip = require('gulp-zip');
const Jasmine = require('jasmine');
const JasmineSpecReporter = require('jasmine-spec-reporter');
const open = require('open');
const yargs = require('yargs');

const defined = Cesium.defined;
const argv = yargs.argv;

gulp.task('test', function (done) {
    const jasmine = new Jasmine();
    jasmine.loadConfigFile('specs/jasmine.json');
    jasmine.addReporter(new JasmineSpecReporter.SpecReporter({
        displaySuccessfulSpec: !defined(argv.suppressPassed) || !argv.suppressPassed
    }));
    jasmine.execute();
    jasmine.onComplete(function (passed) {
        done(argv.failTaskOnError && !passed ? 1 : 0);
    });
});

gulp.task('coverage', function () {
    fsExtra.removeSync('coverage');

    child_process.execSync('nyc' +
        ' --all' +
        ' --report-dir coverage/' +
        ' -x "specs/**"' +
        ' -x "coverage/**"' +
        ' -x "gulpfile.js"' +
        ' --reporter=lcov' +
        ' node_modules/jasmine/bin/jasmine.js' +
        ' JASMINE_CONFIG_PATH=specs/jasmine.json', {
        stdio: [process.stdin, process.stdout, process.stderr]
    });
    open('coverage/lcov-report/index.html');
});

gulp.task('create-zip', function () {
    let hash;
    const status = child_process.execSync('git status -uno -s').toString().trim();
    if (!/^\s*$/.test(status)) {
        if (!argv.force) {
            console.log('Refusing to create a release for a modified branch. Pass the --force flag if you know what you\'re doing.');
            return;
        }
        hash = 'local-modifications';
    } else {
        hash = child_process.execSync('git rev-parse HEAD').toString().trim();
    }

    const zipName = `cesium-concierge-${  hash  }.zip`;

    const serverFiles = gulp.src([
            'bin/**',
            'lib/**',
            'Dockerfile',
            'package-lock.json',
            'index.js'],
        {
            base: '.'
        });

    const packageJson = gulp.src('./package.json');

    return eventStream.merge(serverFiles, packageJson)
        .pipe(gulpTap(function (file) {
            // Work around an issue with gulp-zip where archives generated on Windows do
            // not properly have their directory executable mode set.
            // see https://github.com/sindresorhus/gulp-zip/issues/64#issuecomment-205324031
            if (file.isDirectory()) {
                file.stat.mode = parseInt('40777', 8);
            }
        }))
        .pipe(gulpZip(zipName))
        .pipe(gulp.dest('.'));
});
