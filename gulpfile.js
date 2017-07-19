'use strict';

var Cesium = require('cesium');
var child_process = require('child_process');
var eventStream = require('event-stream');
var fsExtra = require('fs-extra');
var gulp = require('gulp');
var gulpTap = require('gulp-tap');
var gulpZip = require('gulp-zip');
var Jasmine = require('jasmine');
var JasmineSpecReporter = require('jasmine-spec-reporter');
var open = require('open');
var yargs = require('yargs');

var defined = Cesium.defined;
var argv = yargs.argv;

gulp.task('test', function (done) {
    var jasmine = new Jasmine();
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
    var hash;
    var status = child_process.execSync('git status -uno -s').toString().trim();
    if (!/^\s*$/.test(status)) {
        if (!argv.force) {
            console.log('Refusing to create a release for a modified branch. Pass the --force flag if you know what you\'re doing.');
            return;
        }
        hash = 'local-modifications';
    } else {
        hash = child_process.execSync('git rev-parse HEAD').toString().trim();
    }

    var zipName = 'cesium-concierge-' + hash + '.zip';

    var serverFiles = gulp.src([
            'lib/**',
            'Dockerfile',
            'index.js'],
        {
            base: '.'
        });

    child_process.execSync('npm shrinkwrap');

    var packageJson = gulp.src('./package.json');
    var shrinkWrapFile = gulp.src('npm-shrinkwrap.json');

    return eventStream.merge(serverFiles, packageJson, shrinkWrapFile)
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
