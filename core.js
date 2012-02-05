/*jshint browser: true, node: true, plusplus: false, nomen: false, onevar: true, regexp: false, indent: 4*/

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
 * @version 0.0.2
 */
(function () {
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
        this.VERSION = '0.0.2';
        this.PLUGIN_DIR = path.join(__dirname, 'plugins');
        this.PLUGIN_TIMEOUT = 10000;
        this.source = path.normalize(source);
        this.destination = path.normalize(destination);
        this.ignore = _(ignore).isArray() ? ignore : [];
        this.pluginManifests = [];
        this.errors = [];
        this.config = null;
        this.initialized = false;

        this.init();
    }

    // Extend from EventEmitter
    BuildJS.prototype = new events.EventEmitter();

    /**
     * Runs the build process.
     */
    BuildJS.prototype.run = function () {
        var self = this, 
            run = function () {
                self.dir(self.source);
            };

        console.log(this.logline('INFO', 'BuildJS version %s started'), this.VERSION);

        if (this.initialized) {
            run();
        } else {
            // Begin once I'm initialized
            this.once('initialized', run);
        }
    };

    /**
     * Initializes BuildJS, loads config and plugins.
     *
     * @private
     */
    BuildJS.prototype.init = function () {
        var locations = [
            path.join(__dirname, 'buildjs.json'),
            path.join(this.homeDir(), '.buildjs.json'),
            //path.join(process.cwd(), 'buildjs.json'),
            path.join(this.source, 'buildjs.json')
        ];

        this.loadConfig(locations, function (config) {
            if (config === null) {
                console.error(this.logline('ERROR', 'Couldn\'t load configuarion'));
                this.abort();
            }

            this.config = config;
            this.ignore = this.ignore.concat(config.ignore || []);

            fs.readdir(this.PLUGIN_DIR, this.e(function (files) {
                files.forEach(function (file) {
                    var pluginPath = path.join(this.PLUGIN_DIR, file);

                    fs.stat(pluginPath, this.e(function (stats) {
                        var plugin;

                        if (stats.isFile() && _(pluginPath).endsWith('.js')) {
                            try {
                                plugin = require(pluginPath);

                                if (manifest.isValid(plugin.MANIFEST)) {
                                    this.pluginManifests.push(plugin.MANIFEST);
                                    console.log(this.logline('INFO', 'Loaded plugin %s'), manifest.toString(plugin.MANIFEST));
                                } else {
                                    console.error(this.logline('!ERROR', 'Invalid plugin %s: Missing or invalid manifest'), pluginPath);
                                    this.abort();
                                }
                            } catch (e) {
                                console.error(this.logline('!ERROR', 'Error while loading plugin %s: %s'), pluginPath, e.toString());
                                this.abort();
                            }
                        }
                    }));
                }, this);

                this.initialized = true;
                this.emit('initialized');
            }));
        });
    };

    /**
     * Iterates over directory structure.
     *
     * @private
     */
    BuildJS.prototype.dir = function (dir) {
        fs.readdir(dir, this.e(function (files) {
            files.forEach(function (file) {
                // Ignore files/directories starting with a dot
                if (_(file).startsWith('.')) {
                    return;
                }

                var joined = path.join(dir, file);

                fs.stat(joined, this.e(function (stats) {
                    // Dive into directory unless it's the output directory
                    if (stats.isDirectory() && joined !== this.destination) {
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
    BuildJS.prototype.file = function (file) {
        var self = this,
            extension = path.extname(file),
            applicablePlugins = [],
            shadowPath;

        this.pluginManifests.forEach(function (manifest) {
            if (_.find(manifest.fileTypes, function (fileType) {
                return (fileType === extension || ('.' + fileType) === extension);
            }) !== undefined) {
                if (self.pluginConfig(manifest.name).enabled === true) {
                    try {
                        applicablePlugins.push({
                            manifest: manifest,
                            instance: manifest.provider()
                        });
                    } catch (e) {
                        console.error(self.logline('!ERROR', 'Error while instantiating plugin %s: %s'), manifest.toString(manifest), e.toString());
                    }
                }
            }
        });

        shadowPath = this.shadowPath(file);

        if (!this.matchIgnored(file) && applicablePlugins.length > 0) {
            // apply the applicable plugins on file data
            fs.readFile(file, 'utf8', this.e(function (data) {
                var apply = function (pos, callback) {
                        var plugin;

                        if (pos === applicablePlugins.length) {
                            callback();
                            return;
                        }

                        plugin = applicablePlugins[pos];

                        console.log(self.logline('APPLY', plugin.manifest.name, '%s -> %s'), file, shadowPath);

                        plugin.instance.init(self.pluginConfig(plugin.manifest.name), self.timeout(
                            // Success
                            function (err) {
                                if (err) {
                                    console.error(self.logline('!ERROR', plugin.manifest.name, 'Error during initialization: %s'), err.toString());
                                } else {
                                    plugin.instance.onFile(data, self.timeout(
                                        // Success
                                        function (result) {
                                            if (result.errors) {
                                                console.error(self.logline('!ERROR', plugin.manifest.name, '%s: %s'), file, result.errors.toString());
                                                self.abort();
                                                return;
                                            } else if (result.warnings) {
                                                console.log(self.logline('WARNING', plugin.manifest.name, '%s: %s'), file, result.warnings.toString());
                                            }

                                            data = result.data;
                                            apply(++pos, callback);
                                        },
                                        // Timeout
                                        function () {
                                            console.error(self.logline('!TIMEOUT', plugin.manifest.name, file));
                                            self.abort();
                                        },
                                        self.PLUGIN_TIMEOUT,
                                        self
                                    ));
                                }
                            },
                            // Timeout
                            function () {
                                console.error(self.logline('!TIMEOUT', plugin.manifest.name, 'Timeout during plugin initialization'));
                                self.abort();
                            },
                            self.PLUGIN_TIMEOUT,
                            self
                        ));
                    };

                apply(0, function () {
                    self.mkdirParents(path.dirname(shadowPath), function () {
                        fs.writeFile(shadowPath, data, self.e());
                    });
                });
            }));
        } else {
            // just copy file to destination dir
            console.log(this.logline('COPY', '%s -> %s'), file, shadowPath);
            this.copyFile(file, shadowPath);
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
    BuildJS.prototype.matchIgnored = function (file) {
        var self = this;
        return _.find(this.ignore, function (item) {
            return _(file).startsWith(path.normalize(item)) ||
                   _(file).startsWith(path.join(self.source, item));
        }) !== undefined;
    };

    /**
     * @param source Source file name
     * @param destination Destination file name
     *
     * @private
     */
    BuildJS.prototype.copyFile = function (source, destination) {
        this.mkdirParents(path.dirname(destination), function () {
            fs.stat(source, this.e(function (stats) {
                var read = fs.createReadStream(source),
                    write = fs.createWriteStream(destination, {mode: stats.mode});
                
                write.once('open', function () {
                    read.on('data', function (buffer) {
                        write.write(buffer);
                    });

                    read.on('end', function () {
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
    BuildJS.prototype.mkdirParents = function (dir, callback) {
        var self = this,
            parts = path.normalize(dir).split(this.separator()),
            mkdir = function (pos) {
                var curr;

                if (pos === parts.length) {
                    callback.call(self);
                    return;
                }

                curr = parts.slice(0, pos + 1).join(self.separator());

                path.exists(curr, function (exists) {
                    if (!exists) {
                        fs.mkdir(curr, function () {
                            mkdir(++pos);
                        });
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
    BuildJS.prototype.shadowPath = function (file) {
        return path.join(this.destination, path.normalize(file).substring(this.source.length));
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
    BuildJS.prototype.timeout = function (callback, onTimeout, timeout, context) {
        var called = false,
            timer = setTimeout(function () {
                if (!called) {
                    called = true;
                    onTimeout.call(context || this);
                }
            }, timeout);

        return function () {
            if (!called) {
                called = true;
                clearTimeout(timer);
                callback.apply(context || this, arguments);
            }
        };
    };

    /**
     * @private
     */
    BuildJS.prototype.abort = function () {
        process.exit(1);
    };

    /**
     * @private
     */
    BuildJS.prototype.logline = function () {
        if (arguments.length === 2) {
            return '[' + arguments[0].toUpperCase() + '] ' + arguments[1];
        } else if (arguments.length === 3) {
            return '[' + arguments[0].toUpperCase() + ' ' + arguments[1] + '] ' + arguments[2];
        } else {
            throw 'Illegal argument count';
        }
    };

    /**
     * Gets config from specified paths and merges config objects if
     * several config files exists.
     *
     * For example there may be configs in
     *  - /usr/local/buildjs/buildjs.json       (the install dir of buildjs)
     *  - /home/walt/.buildjs.json              (the users home directory)
     *  - /home/walt/dev/myproject/buildjs.json (the current working directory)
     *
     * @param locations Array of locations for configuration files
     * @param callback A function (config)
     *
     * @private
     */
    BuildJS.prototype.loadConfig = function (locations, callback) {
        var get,
            config = null,
            self = this;

        if (!_(locations).isArray()) {
            callback(null);
            return;
        }

        get = function (i) {
            var loc;

            if (i === locations.length) {
                callback.call(self, config);
                return;
            }

            loc = path.normalize(locations[i]);

            path.exists(loc, function (exists) {
                if (!exists) {
                    get(++i);
                    return;
                }

                fs.stat(loc, self.e(function (stats) {
                    if (stats.isFile()) {
                        try {
                            fs.readFile(loc, 'utf8', self.e(function (data) {
                                console.log(self.logline('INFO', 'Loading config from %s'), loc);
                               
                                // remove all comments
                                data = data.replace(/(\/\*([^*]|[\r\n]|(\*+([^*\/]|[\r\n])))*\*+\/)|(\/\/.*)/g, '');
                                var other = JSON.parse(data);

                                if (config === null) {
                                    config = other;
                                } else {
                                    config = require('cloneextend').extend(config, other); // merge objects
                                }

                                get(++i);
                            }));
                        } catch (e) {
                            console.error(self.logline('ERROR', e.toString()));
                            get(++i);
                        }
                    } else {
                        get(++i);
                    }
                }));
            });
        };

        get(0);
    };

    /**
     * @private
     */
    BuildJS.prototype.pluginConfig = function (pluginName) {
        pluginName = pluginName.toLowerCase();

        if (this.config.plugins && this.config.plugins[pluginName]) {
            return this.config.plugins[pluginName];
        } else {
            return null;
        }
    };

    /**
     * @private
     */
    BuildJS.prototype.homeDir = function () {
        return process.env[process.platform === 'win32' ? 'USERPROFILE' : 'HOME'];
    };

    exports.BuildJS = BuildJS;

}());
