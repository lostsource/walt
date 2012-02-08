#!/usr/bin/env node
/*jshint browser: true, node: true, plusplus: false*/

(function () {
    var buildjs = require('../lib/build.js'),
        ignore = [],
        i;

    if (process.argv.length < 4) {
        console.log('Usage: build.js SOURCE DESTINATION [IGNORE...]\n');
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

    new buildjs.BuildJS(process.argv[2], process.argv[3], ignore).run();
}());
