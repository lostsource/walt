/*jshint node: true*/

(function () {
    var assert = require('assert'),
        walt = require('../lib/walt.js'),

        foo = {
            a: {
                b: 'test',
                c: 'test2'
            },
            d: [0, 1],
            test: 'hello'
        },

        bar = {
            a: {
                b: 'test3',
                e: 'test4'
            },
            d: [2, 3],
            test2: 'world'
        },

        Test = function () {};

    Test.prototype.merge = walt.Walt.prototype.merge;

    assert.deepEqual(new Test().merge(foo, bar), {
        a: {
            b: 'test3',
            c: 'test2',
            e: 'test4'
        },
        d: [2, 3],
        test: 'hello',
        test2: 'world'
    });

}());
