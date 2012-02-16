/*jshint node: true, regexp: false */

(function () {
    
    /**
     * HTML plugin for Walt
     *
     * Removes whitespaces between HTML tags.
     *
     * @author Sven Jacobs <mail@svenjacobs.com>
     * @version 0.2.0
     */
    function Walt_HTML() {
        this.config = null;
    }

    Walt_HTML.prototype.init = function (config, callback) {
        this.config = config;
        callback();
    };

    Walt_HTML.prototype.onFile = function (data, callback) {
        callback({
            data: data/*.replace(/<![ \r\n\t]*(--([^\-]|[\r\n]|-[^\-])*--[ \r\n\t]*)>/g, '')*/ // HTML comments
                      .replace(/\/?>(\s*)<\/?/g, function ($0, $1) {                       // Spaces between tags
                return $0.replace($1, '');
            })
        });
    };

    exports.MANIFEST = {
        name: 'HTML',
        version: '0.2.0',
        fileTypes: ['html', 'htm'],
        provider: function () {
            return new Walt_HTML();
        }
    };
}());
