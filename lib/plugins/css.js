/*jshint node: true*/

(function () {
    var cssmin = require('./css/cssmin.js');

    /**
     * CSS plugin for Walt
     *
     * Uses the JavaScript port by Stoyan Stefanov of the CSS minification tool
     * distributed with YUI Compressor, see
     * https://github.com/yui/yuicompressor/blob/master/ports/js/cssmin.js
     *
     * @author Sven Jacobs <mail@svenjacobs.com>
     * @version 0.0.1
     */
    function Walt_CSS() {
        this.config = null;
    }

    Walt_CSS.prototype.init = function (config, callback) {
        this.config = config;
        callback();
    };

    Walt_CSS.prototype.onFile = function (data, callback) {
        callback({
            data: cssmin.YAHOO.compressor.cssmin(data)
        });
    };

    exports.MANIFEST = {
        name: 'CSS',
        version: '0.1.0',
        fileTypes: ['css'],
        provider: function () {
            return new Walt_CSS();
        }
    };
}());
