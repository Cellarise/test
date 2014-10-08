/**
 * A gulp build task to generate license documentation from all dependent packages.
 * The license data is automatically sourced from node_package folder using `npm-license`.
 * The result is saved to `doc/templates/readme-license.dust.md`.
 * @alias tasks:license
 */
module.exports = function (gulp, context) {
    "use strict";
    var rename = require("gulp-rename");
    var path = require('path');
    var GulpDustCompileRender = require('gulp-dust-compile-render');
    var AsyncPipe = require('gulp-async-func-runner');
    var checker = require('npm-license');

    gulp.task("license", function(){
        var cwd = context.cwd;
        var pkg = context.package;
        var directories = pkg.directories;

        return gulp.src(path.join(cwd, directories.tasks, 'templates') + '/readme-license.dust')
            .pipe(new AsyncPipe({
                    oneTimeRun: true,
                    passThrough: true
                },
                function(opts, chunk, cb){
                    checker.init({
                        unknown: false,          // Boolean: generate only a list of unknown licenses
                        start: '.',              // String: path to start the dependency checks
                        depth: '1',            // Number | 'all': how deep to recurse through the dependencies
                        include: 'all' // String | Array | 'all': recurse through various types of dependencies (https://npmjs.org/doc/json.html)
                    }, function (dependencies) {
                        cb(null, dependencies);
                    });
                },
                function(error, data){
                    if(!error){
                        pkg.licenses = [];
                        //process to get into format for dust
                        var dep, result;
                        for (dep in data) {
                            if (data.hasOwnProperty(dep)) {
                                result = {
                                    name: dep,
                                    license: JSON.stringify(data[dep].licenses),
                                    repository: JSON.stringify(data[dep].repository)
                                };
                                pkg.licenses.push(result);
                            }
                        }
                    }
                }))
            .pipe(new GulpDustCompileRender(pkg))
            .pipe(rename(function (path) {
                path.extname = '.dust.md';
            }))
            .pipe(gulp.dest(directories.doc + '/templates'));
    });
};
