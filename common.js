/*jslint white: true, nomen: true, indent: 4*/
/*globals require, module*/
(function() {

    var _ = require('underscore');
     
    /**
     * Creates a generic callback function that handles errors.
     *
     * Returned function assumes that first argument is the error object
     * as is the case with fs.readdir() for example.
     *
     * If the calling object (the context) contains an array named "errors"
     * the error will be appened to that array.
     */
    module.exports.e = function(callback) {
        var self = this;
        return function() {
            var args = [],
                err = arguments['0'],
                i;

            if (err) {
                console.error(err);
                if (_(self.errors).isArray()) {
                    self.errors.push(err);
                }
            } else {
                // arguments is an object not an array so we need to convert it
                for (i = 1; i < arguments.length; i++) {
                    args.push(arguments[i]);
                }

                callback.apply(self, args);
            }
        };
    };

}());
