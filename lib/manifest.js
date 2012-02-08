/*jslint white: true, nomen: true, indent: 4*/
/*globals require, module*/
(function() {
    'use strict';

    var _ = require('underscore'),
        util = require('util');

    function Manifest() {
    }

    Manifest.prototype.isValid = function(manifest) {
        return (
            typeof manifest === "object" &&
            _(manifest.name).isString() &&
            _(manifest.version).isString() &&
            _(manifest.fileTypes).isArray() &&
            _(manifest.provider).isFunction()
        );
    };

    Manifest.prototype.toString = function(manifest) {
        return util.format('"%s" (version %s)', manifest.name, manifest.version);
    };

    module.exports = new Manifest();

}());
