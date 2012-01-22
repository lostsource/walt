/*jslint white: true, nomen: true, indent: 4*/
/*globals require*/
(function() {
    'use strict';

    var qs = require('querystring'),
        http = require('http'),
        common = require('../common.js'),
        lint = require('./javascript/jslint.js');

    function BuildJS_JavaScript() {
        this.errors = [];
    }

    /**
     * @param callback Is a function(data)
     */
    BuildJS_JavaScript.prototype.onFile = function(data, callback) {
        // TODO
        callback(data);
    };

    /**
     * @private
     */
    BuildJS_JavaScript.prototype.e = common.e;

    /**
     * @private
     */
    BuildJS_JavaScript.prototype.javascript = function(file) {
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
    };

    /**
     * Applys Google Closure Compiler on JavaScript file.
     *
     * @param callback function(closureResponse)
     *                 closureResponse is an object, see http://code.google.com/closure/compiler/docs/api-ref.html
     *
     * @private
     */
    BuildJS_JavaScript.prototype.closure = function(file, callback) {
        fs.readFile(file, 'utf8', this.e(function(contents) {
            var body = qs.stringify({
                    js_code: contents,
                    compilation_level: 'SIMPLE_OPTIMIZATIONS',
                    output_format: 'json',
                    output_info: 'compiled_code'
                }),

                req = http.request({
                    host: 'closure-compiler.appspot.com',
                    path: '/compile',
                    method: 'POST',
                    headers: {
                        'Content-Length': body.length,
                        'Content-Type': 'application/x-www-form-urlencoded'
                    }
                }, function(res) {
                    var data = '';

                    res.setEncoding('utf8');

                    res.on('data', function(chunk) {
                        data += chunk;
                    });

                    res.on('end', function() {
                        var json = JSON.parse(data);
                        callback(data);
                    });
                }
            );

            req.on('error', function(err) {
                console.error(err);
            });

            req.end(body);
        }));
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
