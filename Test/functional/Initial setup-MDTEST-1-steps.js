/* jslint node: true */

/* Feature: Initial setup */
module.exports = (function() {
    "use strict";
    var English = require('yadda').localisation.English;
    var assert = require('assert');
    return English.library()
        /*Scenario: Initial setup */
        .define("Given A", function(done) {
            var result = require('../..')();
            assert(result);
            done();
        })
        .define("When B", function(done) {
            assert(true);
            done();
        })
        .define("Then C", function(done) {
            assert(true);
            done();
        });
})();