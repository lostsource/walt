/*jshint node: true*/

(function () {
    
    /**
     * HTML plugin for Walt
     *
     * Removes whitespaces between HTML tags.
     *
     * @author Sven Jacobs <mail@svenjacobs.com>
     * @version 0.0.1
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
            data: data.replace(/\/?>(\s*)<\/?/g, function ($0, $1) {
                return $0.replace($1, '');
            })
        });
    };

    exports.MANIFEST = {
        name: 'HTML',
        version: '0.1.0',
        fileTypes: ['html', 'htm'],
        provider: function () {
            return new Walt_HTML();
        }
    };
}());
