/*jshint browser: true, node: true, plusplus: false, nomen: false, onevar: true, regexp: false, indent: 4*/

/**
 * Walt is a simple node.js based build tool for static web apps, Google Chrome
 * extensions etc. It parses a directory structure, runs checks and
 * compilations/minifications on JavaScript, CSS and HTML files and finally creates
 * a packaged version of the web app in an output directory while the source
 * contents stays untouched.
 *
 * Non-standard dependencies:
 *
 *   - underscore @ 1.3.1
 *   - underscore.string @ 2.0.0
 *   - uglify-js @ 1.2.5
 *
 * @author Sven Jacobs <mail@svenjacobs.com>
 * @version 0.2.0
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
     * Constructor of Walt.
     *
     * @param source The source dir
     * @param destination The destination/output dir
     * @param ignore Optionally an array of relative paths as seen from the source
     *               dir which are ignored for JavaScript/CSS validation. However
     *               these files/folders are still copied.
     *               For example: ['js/3rdparty', 'js/badcode.js']
     */
    function Walt(source, destination, ignore) {
        this.VERSION = '0.2.0'; // TODO: Read version from package.json?
        this.PLUGIN_DIR = path.join(__dirname, 'plugins');
        this.PLUGIN_TIMEOUT = 10000;
        this.source = path.normalize(source);
        this.destination = path.normalize(destination);
        this.ignore = _(ignore).isArray() ? ignore : [];
        this.plugins = [];
        this.errors = [];
        this.config = null;
        this.initialized = false;

        this.init();
    }

    // Extend from EventEmitter
    Walt.prototype = new events.EventEmitter();

    /**
     * Runs the build process.
     */
    Walt.prototype.run = function () {
        var self = this, 
            run = function () {
                self.dir(self.source);
            };

        this.emit('started', this.VERSION);

        if (this.initialized) {
            run();
        } else {
            // Begin once I'm initialized
            this.once('initialized', run);
        }
    };

    /**
     * Initializes Walt, loads config and plugins.
     *
     * @private
     */
    Walt.prototype.init = function () {
        var locations = [
            path.join(__dirname, '..', 'walt.json'),
            path.join(this.homeDir(), '.walt.json'),
            //path.join(process.cwd(), 'walt.json'),
            path.join(this.source, 'walt.json')
        ];

        this.loadConfig(locations, function (config) {
            if (config === null) {
                this.emit('error', {
                    msg: 'Couldn\'t load configuration'
                });
                this.abort();
            }

            this.config = config;
            this.ignore = this.ignore.concat(config.ignore || []);

            fs.readdir(this.PLUGIN_DIR, this.e(function (files) {
                files.forEach(function (file) {
                    var pluginPath = path.join(this.PLUGIN_DIR, file);

                    fs.stat(pluginPath, this.e(function (stats) {
                        var plugin,
                            instance,
                            config;

                        if (stats.isFile() && _(pluginPath).endsWith('.js')) {
                            try {
                                plugin = require(pluginPath);

                                if (manifest.isValid(plugin.MANIFEST)) {
                                    instance = plugin.MANIFEST.provider();
                                    config = this.pluginConfig(plugin.MANIFEST.name);

                                    instance.init(config, this.timeout(
                                        // Success
                                        function (err) {
                                            if (err) {
                                                this.emit('error', {
                                                    plugin: plugin.MANIFEST.name,
                                                    msg: 'Error during initialization: %s',
                                                    args: [err.toString()]
                                                });
                                                this.abort();
                                            } else {
                                                this.plugins.push({
                                                    manifest: plugin.MANIFEST,
                                                    config: config,
                                                    instance: instance
                                                });
                                                this.emit('info', {
                                                    msg: 'Loaded plugin %s',
                                                    args: [manifest.toString(plugin.MANIFEST)]
                                                });
                                            }
                                        },
                                        // Timeout
                                        function () {
                                            this.emit('error', {
                                                plugin: plugin.manifest.name,
                                                msg: 'Timeout during plugin initialization'
                                            });
                                            this.abort();
                                        },
                                        this.PLUGIN_TIMEOUT,
                                        this
                                    ));

                                } else {
                                    this.emit('error', {
                                        msg: 'Invalid plugin %s: Missing or invalid manifest',
                                        args: [pluginPath]
                                    });
                                    this.abort();
                                }
                            } catch (e) {
                                this.emit('error', {
                                    msg: 'Error while loading plugin %s: %s',
                                    args: [pluginPath, e.toString()]
                                });
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
    Walt.prototype.dir = function (dir) {
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
    Walt.prototype.file = function (file) {
        var self = this,
            extension = path.extname(file),
            applicablePlugins = [],
            shadowPath;

        this.plugins.forEach(function (plugin) {
            if (_.find(plugin.manifest.fileTypes, function (fileType) {
                return (fileType === extension || ('.' + fileType) === extension);
            }) !== undefined) {
                if (plugin.config.enabled && plugin.config.enabled === true) {
                    applicablePlugins.push(plugin);
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

                    self.emit('apply', plugin.manifest.name, file, shadowPath);

                    plugin.instance.onFile(data, self.timeout(
                        // Success
                        function (result) {
                            if (result.errors) {
                                self.emit('error', {
                                    plugin: plugin.manifest.name,
                                    msg: '%s: %s',
                                    args: [file, result.errors.toString()]
                                });
                                self.abort();
                                return;
                            } else if (result.warnings) {
                                self.emit('warning', {
                                    plugin: plugin.manifest.name,
                                    msg: '%s: %s',
                                    args: [file, result.warnings.toString()]
                                });
                            }

                            data = result.data;
                            apply(++pos, callback);
                        },
                        // Timeout
                        function () {
                            self.emit('error', {
                                plugin: plugin.manifest.name,
                                msg: 'TIMEOUT at %s',
                                args: [file]
                            });
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
            this.emit('copy', file, shadowPath);
            this.copyFile(file, shadowPath);
        }
    };

    /**
     * @private
     */
    Walt.prototype.e = common.e;

    /**
     * @private
     */
    Walt.prototype.separator = common.separator;

    /**
     * @private
     */
    Walt.prototype.matchIgnored = function (file) {
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
    Walt.prototype.copyFile = function (source, destination) {
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
    Walt.prototype.mkdirParents = function (dir, callback) {
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
    Walt.prototype.shadowPath = function (file) {
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
    Walt.prototype.timeout = function (callback, onTimeout, timeout, context) {
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
    Walt.prototype.abort = function () {
        process.exit(1);
    };

    /**
     * Gets config from specified paths and merges config objects if
     * several config files exists.
     *
     * For example there may be configs in
     *  - /usr/local/walt/walt.json          (the install dir of walt)
     *  - /home/walt/.walt.json              (the users home directory)
     *  - /home/walt/dev/myproject/walt.json (the current working directory)
     *
     * @param locations Array of locations for configuration files
     * @param callback A function (config)
     *
     * @private
     */
    Walt.prototype.loadConfig = function (locations, callback) {
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
                                self.emit('info', {
                                    msg: 'Loading config from %s',
                                    args: [loc]
                                });
                               
                                // remove all comments
                                data = data.replace(/(\/\*([^*]|[\r\n]|(\*+([^*\/]|[\r\n])))*\*+\/)|(\/\/.*)/g, '');
                                var other = JSON.parse(data);

                                if (config === null) {
                                    config = other;
                                } else {
                                    config = self.merge(config, other); // merge objects
                                }

                                get(++i);
                            }));
                        } catch (e) {
                            self.emit('error', {
                                msg: e.toString()
                            });
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
    Walt.prototype.pluginConfig = function (pluginName) {
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
    Walt.prototype.homeDir = function () {
        return process.env[process.platform === 'win32' ? 'USERPROFILE' : 'HOME'];
    };

    /**
     * Merges two objects where the right object overwrites properties
     * of the left object.
     *
     * Arrays are not considered as objects but as value types and are replaced
     * instead of merged.
     *
     * For example:
     *
     * Left
     * {
     *     a: 'hello',
     *     b: 'world',
     *     c: {
     *         d: [1, 2]
     *     }
     * }
     *
     * Right
     * {
     *     b: 'walt',
     *     c: {
     *         d: [3, 4]
     *     }
     * }
     *
     * Merged
     * {
     *     a: 'hello',
     *     b: 'walt',
     *     c: {
     *         d: [3, 4]
     *     }
     * }
     * 
     * @private
     */
    Walt.prototype.merge = function (left, right) {
        var merged = {},
            each;

        for (each in right) {
            if (right.hasOwnProperty(each)) {
                merged[each] = right[each];
            }
        }

        for (each in left) {
            if (left.hasOwnProperty(each) && !right.hasOwnProperty(each)) {
                merged[each] = left[each];
            } else if (typeof(left[each]) === 'object' &&
                typeof(right[each]) === 'object' &&
                !(right[each] instanceof Array)) {

                merged[each] = this.merge(left[each], right[each]);
            }
        }

        return merged;
    };

    exports.Walt = Walt;

}());
