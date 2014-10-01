/**
 * A gulp build task to check whether the package NPM dependencies are out of date.
 * @alias tasks:david
 */
module.exports = function(gulp, context) {
    "use strict";
    var davidUtils = require('./utils/david')();
    var async = require('async');
    var fs = require('fs');
    var path = require('path');
    var mkdirp = require('mkdirp');
    var pkg = context.package;
    var directories = context.package.directories;
    var cwd = context.cwd;

    /**
     * A gulp build task to check whether the package NPM dependencies are out of date.
     * @alias tasks:david
     */
    gulp.task('david', function(cb) {

        var report = {
            "stats": {
                "suites": 0,
                "tests": 0,
                "passes": 0,
                "pending": 0,
                "failures": 0,
                "start":  new global.Date(),
                "end":  new global.Date(),
                "duration": 0
            },
            "failures": [],
            "passes": [],
            "skipped": []
        };

        async.series([
            function(callback){
                davidUtils.recordDependencies(pkg, { type: 'Production dependencies' }, report, callback);
            },
            function(callback){
                davidUtils.recordDependencies(pkg, { type: 'Dev dependencies', dev: true }, report, callback);
            },
            function(callback){
                davidUtils.recordDependencies(pkg, { type: 'Optional dependencies', optional: true }, report, callback);
            }
        ], function(err){
            if(!err){
                mkdirp.sync(path.join(cwd, directories.reports)); //make sure the Reports directory exists
                fs.writeFileSync(path.join(cwd, directories.reports, 'david-mocha-tests.json'), JSON.stringify(report, null, 2));
            }
            cb(err);
        });
    });
    /**
     * A gulp build task to update the package NPM dependencies to the most recent stable versions.
     * @alias tasks:david
     */
    gulp.task('david-update', function(cb) {
        var pathToManifest = path.join(cwd, 'package.json');
        async.series([
            function(callback){
                davidUtils.addUpdatedDeps(pathToManifest, { stable: true }, callback);
            },
            function(callback){
                davidUtils.addUpdatedDeps(pathToManifest, { stable: true, dev: true }, callback);
            },
            function(callback){
                davidUtils.addUpdatedDeps(pathToManifest, { stable: true, optional: true }, callback);
            }
        ], function(err){
            cb(err);
        });
    });
};
