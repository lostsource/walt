/*jshint browser: true, node: true, regexp: false, indent: 4*/
(function () {
    'use strict';

    var qs = require('querystring'),
        http = require('http'),
        common = require('../common.js');

    /**
     * JavaScript plugin for Walt
     *
     * @author Sven Jacobs <mail@svenjacobs.com>
     * @version 0.0.2
     */
    function Walt_JavaScript() {
        this.SHEBANG_REGEX = /^#!.*$/m;
        this.options = null;
    }

    /**
     * Is called during plugin initialization.
     *
     * The options arguments is an object with plugin options.
     * The callback needs to be called once the plugin has been initialized.
     * If there has been an error during initialization an error object needs
     * to be passed to the callback function.
     *
     * @param options Plugin options object
     * @param callback Callback function with optional error argument
     */
    Walt_JavaScript.prototype.init = function (options, callback) {
        this.options = options;
        callback();
    };

    /**
     * Will be called when a JavaScript file needs to be processed.
     *
     * Once the process is finished the callback function needs to be called
     * passing an object with the following properties:
     *
     * data (String, required)     The modified file contents
     * warnings (Object, optional) Warning messages
     * errors (Object, optional)   Error messages
     *
     * warnings and errors can be be arbitrary objects when specified
     * (for example arrays of Strings) however if you want some
     * meaningful output you should overwrite the toString() function of
     * your objects. If errors has been specified the whole build will be
     * cancelled.
     *
     * @param data The file's contents
     * @param callback Is a function (data)
     */
    Walt_JavaScript.prototype.onFile = function (data, callback) {
        // Make sure we strip a shebang for validation/compilation
        // and prepend it again later
        var self = this,
            shebang = null,
            matches = this.SHEBANG_REGEX.exec(data);

        if (matches !== null) {
            shebang = matches[0];
            data = data.replace(this.SHEBANG_REGEX, '');
        }
        
        this.closure(data, function (result) {
            callback({
                data: shebang ? shebang + '\n' + result.compiledCode : result.compiledCode,
                errors: self.mixinToString(result.serverErrors, self.serverErrorsToString) || self.mixinToString(result.errors, self.errorsToString) || null,
                warnings: self.mixinToString(result.warnings, self.warningsToString) || null
            });
        });
    };

    /**
     * @private
     */
    Walt_JavaScript.prototype.mixinToString = function (obj, func) {
        if (obj === undefined) {
            return undefined;
        }

        obj.toString = func;
        return obj;
    };

    /**
     * @private
     */
    Walt_JavaScript.prototype.serverErrorsToString = function () {
        var out = '';
        
        this.forEach(function (error) {
            out += 'Code: ' + error.code + ', Error: ' + error.error + '\n';
        });

        return out;
    };
    
    /**
     * @private
     */
    Walt_JavaScript.prototype.errorsToString = function () {
        var out = '';
        
        this.forEach(function (error) {
            out += 'Line: ' + error.lineno + ', Char: ' + error.charno + ', Error: ' + error.error + '\n';
        });

        return out;
    };

    /**
     * @private
     */
    Walt_JavaScript.prototype.warningsToString = function () {
        var out = '';
        
        this.forEach(function (warning) {
            out += 'Line: ' + warning.lineno + ', Char: ' + warning.charno + ', Warning: ' + warning.warning + '\n';
        });

        return out;
    };

    /**
     * @private
     */
    Walt_JavaScript.prototype.e = common.e;

    /**
     * Applys Google Closure Compiler on JavaScript file.
     *
     * @param callback function (closureResponse)
     *                 closureResponse is an object, see http://code.google.com/closure/compiler/docs/api-ref.html
     *
     * @private
     */
    Walt_JavaScript.prototype.closure = function (data, callback) {
        var body = qs.stringify({
                js_code: data,
                compilation_level: 'SIMPLE_OPTIMIZATIONS',
                output_format: 'json'
            }) + '&output_info=compiled_code' +
                 '&output_info=warnings' +
                 '&output_info=errors' +
                 '&output_info=statistics',

            req = http.request({
                host: 'closure-compiler.appspot.com',
                path: '/compile',
                method: 'POST',
                headers: {
                    'Content-Length': body.length,
                    'Content-Type': 'application/x-www-form-urlencoded'
                }
            }, function (res) {
                var result = '';

                res.setEncoding('utf8');

                res.on('data', function (chunk) {
                    result += chunk;
                });

                res.on('end', function () {
                    var json = JSON.parse(result);
                    callback(json);
                });
            }
        );

        req.on('error', function (err) {
            console.error(err);
        });

        req.end(body);
    };

    exports.MANIFEST = {
        name: 'JavaScript',
        version: '0.1.0',
        fileTypes: ['js'],
        provider: function () {
            return new Walt_JavaScript();
        }
    };
}());
