/**
 * A gulp build task to compile and render the `doc/templates/readme.dust.md` document template.
 * The document template readme.dust.md references three other templates:
 * 1) readme-license.dust.md (this file is produced by the `license` gulp task)
 * 2) readme-usage.dust.md (this file is updated manually with installation and usage information)
 * 3) readme-changelog.dust.md (this file is using to provide the layout for the changelog)
 * The changelog data is automatically sourced from Jira if the oauth config.json file exists and
 * package.json file contains property `config.projectCode`.
 * The result is saved to `doc/readme.md`.
 * This step is a pre-requisite to running the `doc` gulp task.
 * The `doc` gulp task executes the JSDoc documentation generator, which requires files saved to disk.
 * @alias tasks:docs-pre
 */
module.exports = function(gulp, context) {
    "use strict";
    var rename = require("gulp-rename");
    var path = require('path');
    var GulpDustCompileRender = require('gulp-dust-compile-render');
    var asyncPipe = require('gulp-async-func-runner');
    var jiraUtils = require('./utils/jira')();

    gulp.task("docs-pre", function(){
        var cwd = context.cwd;
        var pkg = context.package;
        var directories = pkg.directories;
        var options = {
            partialsGlob: path.join(cwd, directories.doc) + '/templates/*.dust*'
        };

        return gulp.src(directories.doc + '/templates/readme.dust.md')
            .pipe(asyncPipe({
                oneTimeRun: true,
                passThrough: true
            },
                function(opts, chunk, cb){
                    jiraUtils.getChangelog(pkg.config.projectCode, cb);
                },
                function(error, data){
                    if(!error){
                        pkg.changelog = data;
                    }
                }))
            .pipe(new GulpDustCompileRender(pkg, options))
            .pipe(rename(function (path) {
                path.basename = path.basename.replace('.dust','');
            }))
            .pipe(gulp.dest(directories.doc));
    });
};

