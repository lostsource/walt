#!/usr/bin/env node
/*jshint browser: true, node: true, plusplus: false*/

(function () {
    var walt = require('../lib/walt.js'),
        ignore = [],
        i,
        w;

    function logline(level, args) {
        if (args.plugin) {
            return '[' + level.toUpperCase() + ' ' + args.plugin + '] ' + args.msg;
        } else {
            return '[' + level.toUpperCase() + '] ' + args.msg;
        }
    }

    if (process.argv.length < 4) {
        console.log('Usage: walt SOURCE DESTINATION [IGNORE...]\n');
        console.log('SOURCE      Source directory.');
        console.log('DESTINATION Destination directory.');
        console.log('IGNORE      Any further argument is a relative path (file or directory)');
        console.log('            as seen from SOURCE which should be ignored for validation/compilation.');
        console.log('            However these files are still copied to DESTINATION.');
        process.exit(1);
    }

    for (i = 4; i < process.argv.length; i++) {
        ignore.push(process.argv[i]);
    }

    w = new walt.Walt(process.argv[2], process.argv[3], ignore);

    w.on('started', function (version) {
        console.log(logline('INFO', {msg: 'Walt version %s started'}), version);
    });

    w.on('info', function (args) {
        console.log(logline('INFO', args), args.args ? args.args : undefined);
    });

    w.on('warning', function (args) {
        console.log(logline('WARNING', args), args.args ? args.args : undefined);
    });

    w.on('error', function (args) {
        console.error(logline('ERROR', args), args.args ? args.args : undefined);
    });

    w.on('copy', function (from, to) {
        console.log(logline('COPY', {msg: '%s -> %s'}), from, to);
    });

    w.on('apply', function (plugin, from, to) {
        console.log(logline('APPLY', {
            plugin: plugin,
            msg: '%s -> %s'
        }), from, to);
    });

    w.run();
}());
