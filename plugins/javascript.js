/*jslint white: true, nomen: true, regexp: true, indent: 4*/
/*globals require, console, exports*/
(function() {
    'use strict';

    var qs = require('querystring'),
        http = require('http'),
        common = require('../common.js'),
        lint = require('./javascript/jslint.js');

    /**
     * JavaScript plugin for BuildJS
     *
     * @author Sven Jacobs <mail@svenjacobs.com>
     * @version 0.0.1
     */
    function BuildJS_JavaScript() {
        this.SHEBANG_REGEX = /^#!.*$/m;
    }

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
     * @param callback Is a function(data)
     */
    BuildJS_JavaScript.prototype.onFile = function(data, callback) {
        // Make sure we strip a shebang for validation/compilation
        // and prepend it again later
        var self = this,
            shebang = null,
            matches = this.SHEBANG_REGEX.exec(data);

        if (matches !== null) {
            shebang = matches[0];
            data = data.replace(this.SHEBANG_REGEX, '');
        }
        
        this.closure(data, function(result) {
            callback({
                data: shebang ? shebang + '\n' + result.compiledCode : result.compiledCode,
                errors: self.mixinToString(result.serverErrors, self.serverErrorsToString) || self.mixinToString(result.errors, self.errorsToString) || null,
                warnings: result.warnings || null
            });
        });
    };

    /**
     * @private
     */
    BuildJS_JavaScript.prototype.mixinToString = function(obj, func) {
        if (obj === undefined) {
            return undefined;
        }

        obj.toString = func;
        return obj;
    };

    /**
     * @private
     */
    BuildJS_JavaScript.prototype.serverErrorsToString = function() {
        var out = '';
        
        this.forEach(function(error) {
            out += 'Code: ' + error.code + ', Error: ' + error.error + '\n';
        });

        return out;
    };
    
    /**
     * @private
     */
    BuildJS_JavaScript.prototype.errorsToString = function() {
        var out = '';
        
        this.forEach(function(error) {
            out += 'Line: ' + error.lineno + ', Char: ' + error.charno + ', Error: ' + error.error + '\n';
        });

        return out;
    };

    /**
     * @private
     */
    BuildJS_JavaScript.prototype.e = common.e;

    /**
     * @private
     */
    /*BuildJS_JavaScript.prototype.javascript = function(file) {
        console.log('=== Running JSLint on ' + file + ' ===\n');
        var content = fs.readFileSync(file, 'utf-8'),
            result = lint.JSLINT(content);
        //overall &= result;
        if (!result) {
            lint.JSLINT.errors.forEach(function(err) {
                console.log('    line: ' + err.line);
                console.log('    character: ' + err.character);
                console.log('    reason: ' + err.reason + '\n');
            });
        } else {
            console.log('    OK\n');
        }
    };*/

    /**
     * Applys Google Closure Compiler on JavaScript file.
     *
     * @param callback function(closureResponse)
     *                 closureResponse is an object, see http://code.google.com/closure/compiler/docs/api-ref.html
     *
     * @private
     */
    BuildJS_JavaScript.prototype.closure = function(data, callback) {
        var body = qs.stringify({
                js_code: data,
                compilation_level: 'SIMPLE_OPTIMIZATIONS',
                output_format: 'json'
            }) + '&output_info=compiled_code'
               + '&output_info=warnings'
               + '&output_info=errors'
               + '&output_info=statistics',

            req = http.request({
                host: 'closure-compiler.appspot.com',
                path: '/compile',
                method: 'POST',
                headers: {
                    'Content-Length': body.length,
                    'Content-Type': 'application/x-www-form-urlencoded'
                }
            }, function(res) {
                var result = '';

                res.setEncoding('utf8');

                res.on('data', function(chunk) {
                    result += chunk;
                });

                res.on('end', function() {
                    var json = JSON.parse(result);
                    callback(json);
                });
            }
        );

        req.on('error', function(err) {
            console.error(err);
        });

        req.end(body);
    };

    exports.MANIFEST = {
        name: 'JavaScript',
        version: '0.0.1',
        fileTypes: ['js'],
        provider: function() {
            return new BuildJS_JavaScript();
        }
    };
}());
