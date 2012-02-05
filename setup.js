#!/usr/bin/env node
/*jshint node: true*/

(function () {
    var npm = require('npm');
        
    npm.on('log', function (msg) {
        //console.log(msg);
    });

    npm.load(function (err) {
        if (err) {
            console.error(err);
            return;
        }

        var e = function (err, output) {
            if (err) {
                if (output) {
                    console.error(err);
                }
                console.error('Setup was NOT successful. Check output.');
                process.exit(1);
            }
        };

        npm.commands.install(['underscore@1.3.1', 'underscore.string@2.0.0'], function (err, data) {
            e(err); 

            // This is just temporary until cloneextend is in npm registry

            require('child_process').exec('git clone git://github.com/shimondoodkin/nodejs-clone-extend.git node_modules/cloneextend', function (err, stdout, stderr) {
                e(err, true);

                console.log(stdout);
                console.log('Setup completed!');
            });
        });
    });
}());
