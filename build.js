#!/usr/bin/env node
/*jslint white: true, plusplus: true, nomen: true, indent: 4*/
/*global require, console, __dirname*/

/**
 * BuildJS is a simple node.js based build tool for static web apps, Google Chrome
 * extensions etc. It parses a directory structure, runs checks and
 * compilations/minifications on JavaScript and CSS files and finally creates a
 * packaged version of the web app in an output directory while the source contents
 * stays untouched.
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

    var _ = require('underscore'),
        fs = require('fs'),
        path = require('path'),
        events = require('events'),
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
        this.ignore = _(ignore).isArray() ? ignore : [];
        this.pluginManifests = [];
        this.errors = [];
        this.initialized = false;
        this.aborted = false;

        this.init();
    }

    // Extend from EventEmitter
    BuildJS.prototype = new events.EventEmitter;

    /**
     * Runs the build process.
     */
    BuildJS.prototype.run = function() {
        var self = this, 
            run = function() {
                self.dir(self.source);
            };

        if (this.initialized) {
            run();
        } else {
            // Begin once I'm initialized
            this.once('initialized', run);
        }
    };

    /**
     * Initializes BuildJS and loads plugins.
     *
     * @private
     */
    BuildJS.prototype.init = function() {
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

            this.initialized = true;
            this.emit('initialized');
        }));
    };

    /**
     * Iterates over directory structure.
     *
     * @private
     */
    BuildJS.prototype.dir = function(dir) {
        fs.readdir(dir, this.e(function(files) {
            var i,
                file,
                joined;

            for (i = 0; i < files.length; i++) {
                if (this.aborted) {
                    break;
                }

                file = files[i];

                // Ignore files/directories starting with a dot
                if (_(file).startsWith('.')) {
                    continue;
                }

                joined = path.join(dir, file);

                fs.stat(joined, this.e((function(joined) {
                    // We're using a self-invoking function here
                    // because we want to retain the state of "joined"
                    // from the outer context
                    return function(stats) {
                        if (stats.isDirectory()) {
                            this.dir(joined);
                        } else if (stats.isFile()) {
                            this.file(joined);
                        }
                    }
                }(joined))));
            }
        }));
    };

    /**
     * @private
     */
    BuildJS.prototype.file = function(file) {
        var extension = path.extname(file),
            applicablePlugins = [],
            shadowPath;

        if (this.matchIgnored(file)) {
            return;
        }

        this.pluginManifests.forEach(function(manifest) {
            if (_.find(manifest.fileTypes, function(fileType) {
                return (fileType === extension || ('.' + fileType) === extension);
            }) !== undefined) {
                try {
                    applicablePlugins.push({
                        manifest: manifest,
                        instance: manifest.provider()
                    });
                } catch (e) {
                    console.error('Error while instantiating plugin ' + manifest.toString(manifest) + ': ' + e);
                }
            }
        });

        shadowPath = this.shadowPath(file);

        if (applicablePlugins.length > 0) {
            // apply the applicable plugins on file data
            fs.readFile(file, 'utf8', this.e(function(data) {
                var self = this,
                    apply = function(pos, callback) {
                        var plugin;

                        if (pos === applicablePlugins.length) {
                            callback();
                            return;
                        }

                        plugin = applicablePlugins[pos];

                        console.log("[APPLY " + plugin.manifest.name + "] " + file);

                        plugin.instance.onFile(data, self.timeout(
                            // Success
                            function(newData) {
                                data = newData;
                                apply(++pos, callback);
                            },
                            // Timeout
                            function() {
                                console.error('[!TIMEOUT ' + plugin.manifest.name + '] ' + file);
                                self.abort();
                            },
                            10000,
                            self
                        ));
                    };

                apply(0, function() {
                    self.mkdirParents(path.dirname(shadowPath), function() {
                        fs.writeFile(shadowPath, data, self.e());
                    });
                });
            }));
        } else {
            // just copy file to destination dir
            console.log("[COPY] " + file);
            this.copyFile(file, this.shadowPath(file));
        }
    };

    /**
     * @private
     */
    BuildJS.prototype.e = common.e;

    /**
     * @private
     */
    BuildJS.prototype.separator = common.separator;

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

    /**
     * @param source Source file name
     * @param destination Destination file name
     *
     * @private
     */
    BuildJS.prototype.copyFile = function(source, destination) {
        this.mkdirParents(path.dirname(destination), function() {
            fs.stat(source, this.e(function(stats) {
                var read = fs.createReadStream(source),
                    write = fs.createWriteStream(destination, {mode: stats.mode});
                
                write.once('open', function() {
                    read.on('data', function(buffer) {
                        write.write(buffer);
                    });

                    read.on('end', function() {
                        write.end();
                    });
                });
            }));
        });
    };

    /**
     * Creates a directory including its parents if they don't exist
     * like the UNIX command mkdir -p
     *
     * @private
     */
    BuildJS.prototype.mkdirParents = function(dir, callback) {
        var self = this,
            parts = path.normalize(dir).split(this.separator()),
            mkdir = function(pos) {
                var curr;

                if (pos === parts.length) {
                    callback.call(self);
                    return;
                }

                curr = parts.slice(0, pos + 1).join(self.separator());

                path.exists(curr, function(exists) {
                    if (!exists) {
                        fs.mkdir(curr, self.e(function() {
                            mkdir(++pos);
                        }));
                    } else {
                        mkdir(++pos);
                    }
                });
            };

        mkdir(0);
    };

    /**
     * Returns the equivalent path of the source file
     * in the destination directory.
     *
     * src/somefolder/somefile.js -> dst/somefolder/somefile.js
     *
     * @private
     */
    BuildJS.prototype.shadowPath = function(file) {
        return path.join(this.destination, file.substring(this.source.length));
    };

    /**
     * Provides a safe way of handling callback functions and timeouts.
     * If the given timeout is hit the onTimeout function will be called.
     *
     * @param callback The original callback function
     * @param onTimeout Function which will be called on timeout
     * @param timeout Milliseconds after onTimeout will be called
     * @param context Optional context of callback functions
     *
     * @private
     */
    BuildJS.prototype.timeout = function(callback, onTimeout, timeout, context) {
        var called = false,
            timer = setTimeout(function() {
                if (!called) {
                    called = true;
                    onTimeout.call(context !== undefined ? context : this);
                }
            }, timeout);

        return function() {
            if (!called) {
                called = true;
                clearTimeout(timer);
                callback.apply(context !== undefined ? context : this, arguments);
            }
        };
    };

    BuildJS.prototype.abort = function() {
        this.aborted = true;
        this.emit('aborted');
    };

    // TODO: Parse command line

    var build = new BuildJS('test', 'out', []);
    build.run();

}());
