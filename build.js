#!/usr/bin/env node
/*jslint white: true, plusplus: true, nomen: true, indent: 4*/
/*global require, console, __dirname*/

/**
 * node.js based build script for static web pages, Google Chrome extensions etc.
 * which parses a directory structure, runs checks and compilations/minifications
 * on JavaScript and CSS files and finally creates a packaged version of the web
 * app in an output directory.
 *
 * Non-standard dependencies:
 *   - underscore (1.3.0)
 *   - underscore.string (2.0.0)
 *
 * @author Sven Jacobs <mail@svenjacobs.com>
 * @version 0.0.1
 */
(function() {
    'use strict';

    // These steps were totally unintentional :)
    var _ = require('underscore'),
        fs = require('fs'),
        path = require('path'),
        common = require('./common.js'),
        manifest = require('./manifest.js');

    _.str = require('underscore.string');
    _.mixin(_.str.exports());

    /**
     * Constructor of BuildJS.
     *
     * @param source The source dir
     * @param destination The destination/output dir
     * @param ignore Optionally an array of relative paths as seen from the source
     *               dir which are ignored for JavaScript/CSS validation. However
     *               these files/folders are still copied.
     *               For example: ['js/3rdparty', 'js/badcode.js']
     */
    function BuildJS(source, destination, ignore) {
        this.PLUGIN_DIR = path.join(__dirname, "plugins");
        this.source = source;
        this.destination = destination;
        this.ignore = ignore !== undefined ? ignore : [];
        this.pluginManifests = [];
        this.errors = [];

        this.init();
    }

    /**
     * Runs the build process.
     */
    BuildJS.prototype.run = function() {
        this.dir(this.source);
    };

    /**
     * Initializes BuildJS and loads plugins.
     * 
     * @private
     */
    BuildJS.prototype.init = function() {
        console.log(this.PLUGIN_DIR);

        fs.readdir(this.PLUGIN_DIR, this.e(function(files) {
            files.forEach(function(file) {
                var pluginPath = path.join(this.PLUGIN_DIR, file);

                fs.stat(pluginPath, this.e(function(stats) {
                    var plugin;

                    if (stats.isFile() && _(pluginPath).endsWith('.js')) {
                        try {
                            plugin = require(pluginPath);

                            if (manifest.isValid(plugin.MANIFEST)) {
                                this.pluginManifests.push(plugin.MANIFEST);
                                console.log('Loaded plugin ' + manifest.toString(plugin.MANIFEST));
                            } else {
                                console.error('Invalid plugin ' + pluginPath + ': Missing or invalid manifest');
                            }
                        } catch (e) {
                            console.error('Error while loading plugin ' + pluginPath + ':\n' + e);
                        }
                    }
                }));
            }, this);
        }));
    };

    /**
     * Iterates over directory structure.
     *
     * @private
     */
    BuildJS.prototype.dir = function(dir) {
        fs.readdir(dir, this.e(function(files) {
            files.forEach(function(file) {
                // Ignore files/directories starting with a dot
                if (_(file).startsWith('.')) {
                    return;
                }

                var joined = path.join(dir, file);

                fs.stat(joined, this.e(function(stats) {
                    if (stats.isDirectory()) {
                        this.dir(joined);
                    } else if (stats.isFile()) {
                        this.file(joined);
                    }
                }));
            }, this);
        }));
    };

    /**
     * @private
     */
    BuildJS.prototype.file = function(file) {
        var extension = path.extname(file),
            applicablePlugins = [];

        if (this.matchIgnored(file)) {
            return;
        }

        this.pluginManifests.forEach(function(manifest) {
            if (_.find(manifest.fileTypes, function(fileType) {
                return (fileType === extension || ('.' + fileType) === extension);
            }) !== undefined) {
                try {
                    applicablePlugins.push(manifest.provider());
                } catch (e) {
                    console.error('Error while instantiating plugin ' + manifest.toString(manifest) + ': ' + e);
                }
            }
        });

        if (applicablePlugins.length > 0) {
            fs.readFile(file, 'utf8', this.e(function(data) {
                applicablePlugins.forEach(function(plugin) {
                    data = plugin.onFile(data);
                });
            }));
        }
    };

    /**
     * @private
     */
    BuildJS.prototype.e = common.e;

    /**
     * @private
     */
    BuildJS.prototype.matchIgnored = function(file) {
        var self = this;
        return _.find(this.ignore, function(item) {
            return _(file).startsWith(path.normalize(item))
                || _(file).startsWith(path.join(self.source, item));
        }) !== undefined;
    };

    var build = new BuildJS('src', 'out', ['js/lib']);
    //build.run();

    //build.closure('src/js/background.js');

    /*var fs = require('fs'),
        lint = require('./build/jslint.js'),
        DIR = 'src/js';

    fs.readdir(DIR, function (err, files) {
        if (err) {
            console.error(err);
        } else {
            var overall = true;
            files.forEach(function (file) {
                var path = DIR + '/' + file;
                var stats = fs.statSync(path);
                if (stats.isFile() && /\.js$/.test(file)) {
                    console.log('=== Running JSLint on ' + path + ' ===\n');
                    var content = fs.readFileSync(path, 'utf-8');
                    var result = lint.JSLINT(content);
                    overall &= result;
                    if (!result) {
                        lint.JSLINT.errors.forEach(function (err) {
                            console.log('    line: ' + err.line);
                            console.log('    character: ' + err.character);
                            console.log('    reason: ' + err.reason + '\n');
                        });
                    } else {
                        console.log('    OK\n');
                    }
                }
            });

            if (overall) {
                console.log('All OK. You rock!');
            }
        }
    });*/
}());
