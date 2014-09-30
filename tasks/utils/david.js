
/**
 * David build utilities
 * @exports utils/david
 * @returns {Object}
 */
module.exports = function()  {
    "use strict";
    var npm = require('npm');
    var david = require('david');
    var _ = require('underscore');
    var fs = require('fs');
    return {

        /**
         * Record the result of dependency checks against all provided dependencies of a particular type in the report object.
         * The david.isUpdated() function.
         * @param {Object} manifest Parsed package.json file contents
         * @param {Object} [opts] Options
         * @param {String} [opts.type]  - the dependency type string description
         * @param {Boolean} [opts.stable] Consider only stable packages
         * @param {Boolean} [opts.dev] Consider devDependencies
         * @param {Boolean} [opts.optional] Consider optionalDependencies
         * @param {Boolean} [opts.peer] Consider peerDependencies
         * @param {Boolean} [opts.loose] Use loose option when querying semver
         * @param {Object} [opts.npm] npm configuration options
         * @param {Boolean} [opts.warn.E404] Collect 404s but don't abort
         * @param {Object} rpt - report object to record results to
         * @param {Function} cb Function that receives the results
         */
        recordDependencies: function(manifest, opts, rpt, cb){
            david.getDependencies(manifest, opts, function(err, pkgs) {
                rpt.stats.suites = rpt.stats.suites + 1;
                Object.keys(pkgs).forEach(function (pkg) {
                    rpt.stats.tests = rpt.stats.tests + 1;
                    if(david.isUpdated(pkgs[pkg])){
                        rpt.stats.failures = rpt.stats.failures + 1;
                        rpt.failures.push({
                            "title": pkg,
                            "fullTitle": opts.type + ': ' + pkg,
                            "duration": 0,
                            "error": pkg + " | Required: " + pkgs[pkg].required + " Stable: " + pkgs[pkg].stable
                        });
                    } else {
                        rpt.stats.passes = rpt.stats.passes + 1;
                        rpt.passes.push({
                            "title": pkg,
                            "fullTitle": opts.type + ': ' +  pkg,
                            "duration": 0
                        });
                    }
                });
                cb(err, rpt);
            });
        },
        /**
         * Add updated dependencies to package.json
         * @param {Object} pathToManifest path to the package.json file
         * @param {Object} [opts] Options
         * @param {Boolean} [opts.stable] Consider only stable packages
         * @param {Boolean} [opts.dev] Provided dependencies are dev dependencies
         * @param {Boolean} [opts.optional] Provided dependencies are optional dependencies
         * @param {Boolean} [opts.peer] Consider peerDependencies
         * @param {Boolean} [opts.loose] Use loose option when querying semver
         * @param {Object} [opts.npm] npm configuration options
         * @param {Boolean} [opts.warn.E404] Collect 404s but don't abort
         * @param {Function} cb Callback
         */
        addUpdatedDeps: function(pathToManifest, opts, cb){
            var manifest = JSON.parse(fs.readFileSync(pathToManifest));
            var type = 'dependencies';
            if(opts.dev){
                type = 'devDependencies';
            } else if(opts.optional){
                type = 'optionalDependencies';
            }
            david.getUpdatedDependencies(manifest, opts, function (er, pkgs) {
                manifest[type] = manifest[type] || {};
                Object.keys(pkgs).forEach(function (pkg) {
                    manifest[type][pkg] = '^' + pkgs[pkg].stable;
                    console.log('Updated: ' + pkg + ' to ' + pkgs[pkg].stable);
                });
                fs.writeFileSync(pathToManifest, JSON.stringify(manifest, null, 2));
                cb();
            });
        },
        /**
         * Install the passed dependencies
         *
         * @param {Object} deps Dependencies to install (result from david)
         * @param {Object} opts Install options
         * @param {Boolean} [opts.global] Install globally
         * @param {Boolean} [opts.save] Save installed dependencies to dependencies/devDependencies/optionalDependencies
         * @param {Boolean} [opts.dev] Provided dependencies are dev dependencies
         * @param {Boolean} [opts.optional] Provided dependencies are optional dependencies
         * @param {String} [opts.registry='https://registry.npmjs.org/'] The npm registry URL to use
         * @param {Function} cb Callback
         */
        installDeps: function(deps, opts, cb) {
            opts = opts || {};
            _.defaults(opts, {
                registry: 'https://registry.npmjs.org/'
            });
            var depNames = Object.keys(deps);

            // Nothing to install!
            if (!depNames.length) {
                return cb(null);
            }

            depNames = depNames.filter(function (depName) {
                return !deps[depName].warn;
            });

            npm.load({
                registry: opts.registry,
                global: opts.global
            }, function (er) {
                if (er) {
                    return cb(er);
                }

                if (opts.save) {
                    npm.config.set("save" + (opts.dev ? "-dev" : opts.optional ? "-optional" : ""), true);
                    npm.config.set("production", true);
                    npm.config.set("msvs_version", "2013");
                }

                var installArgs = depNames.map(function (depName) {
                    return depName + "@" + deps[depName].stable;
                });

                npm.commands.install(installArgs, function (er) {
                    npm.config.set("save" + (opts.dev ? "-dev" : opts.optional ? "-optional" : ""), false);
                    npm.config.set("production", false);
                    npm.config.delete("msvs_version");
                    cb(er);
                });
            });
        }
    };
};

