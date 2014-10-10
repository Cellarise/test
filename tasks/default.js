/**
 * The default gulp build task. The following tasks are executed in sequence:
 * ['test']
 * @alias tasks:default
 */
module.exports = function(gulp) {
    "use strict";
    var runSequence = require('run-sequence');
    // Run tasks synchronously in order
    gulp.task('default', function(cb) {
        runSequence(
            'test',
            cb);
    });
};
