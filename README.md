Walt
====

Walt is a simple [node.js](http://nodejs.org/) based build tool for static web
apps, Google Chrome extensions etc. It parses a directory structure, runs checks
and compilations/minifications on JavaScript, CSS and HTML files and finally creates 
a packaged version of the web app in an output directory while the source contents
stays untouched.

Walt is configurable and extensible through plugins.

![Walt in action](http://svenjacobs.github.com/walt/walt.png "Walt in action")

Installation
------------

node.js (version 0.6.8 or greater) and [npm](http://npmjs.org/) need to be installed
on your system and the executables placed in your `PATH` environment.

Walt is availabe as a npm module which makes installing it super simple. Just run
the command

    npm install walt -g

Execute Walt with the command

    walt

Under Windows you may need to run it as `walt.cmd`.

Usage
-----

Using Walt is very simple. The application has only two required command line
options and a third optional one:

    walt SOURCE DESTINATION [IGNORE...]

**SOURCE** is the source directory of your static web application containing the
HTML, JavaScript, CSS, image files etc.

**DESTINATION** is the target directory where the processed web application will be
generated/copied. Files from SOURCE **will not** be modified.

**IGNORE** are optional arguments. Any further argument represents a relative path
(file or directory) as seen from SOURCE which should be ignored for validation/compilation.
However these files are still copied to DESTINATION. This is especially useful
for third party libraries whose code you are not responsible for ;-) Also see the
"ignore" option in the configuration file.

### Configuration files

The behaviour of Walt can be additionally tweaked with configuration files.
Walt is looking for files in the following directories and order:

* `INSTALLDIR/walt.json` where `INSTALLDIR` is the installation directory of Walt
* `HOME/.walt.json` where `HOME` is the home directory of the user
* `SRC/walt.json` where `SRC` is the source directory specified at the command line

If multiple files are found they will be merged where latter files overwrite options
of former ones.

See `INSTALLDIR/walt.json` for a sample configuration.

Development
-----------

See the [Wiki](https://github.com/svenjacobs/walt/wiki/) for some information on
how to develop plugins for Walt.

Why the name?
-------------

At first this application was called BuildJS. However a module with that name
already exists in the npm registry so I named the application after the protagonist
of my favourite TV show [Breaking Bad](http://en.wikipedia.org/wiki/Breaking_Bad) ;-)

You may also think of walt as an acronym for "website analyzing tool", "website
awesome lint tool" or whatever :-)
