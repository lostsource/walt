BuildJS
=======

BuildJS is a simple [node.js](http://nodejs.org/) based build tool for static web
apps, Google Chrome extensions etc. It parses a directory structure, runs checks
and compilations/minifications on JavaScript and CSS files and finally creates a
packaged version of the web app in an output directory while the source contents
stays untouched.

![BuildJS in action](http://svenjacobs.github.com/BuildJS/buildjs.png "BuildJS in action")

Installation
------------

### Prerequisites

* node.js (version 0.6.8 or greater) and [npm](http://npmjs.org/) need to be installed on your system and the executables placed in your `PATH` environment.
* git in `PATH`
* Download the latest version of BuildJS

### Linux/UNIX

Put all files from the archive in a directory, e.g. `/opt/buildjs` and add the
directory to your `PATH` environment variable. Make sure `build.js` has the
executable flag set.

Change to the installation directory and execute the command

    .\setup.js

Dependencies will now be installed. Note that currently this command
requires `git` to be installed because a dependency is not yet available in the
npm registry.

That's it! Executing `build.js` should now display the command line options.

### Windows

Put all files from the archive in a directory, e.g. `C:\Program Files\BuildJS`
and add the directory to your `PATH` environment variable.

Change to the installation directory and execute the command

    node.exe setup.js

Dependencies will now be installed. Note that currently this command
requires `git` to be installed because a dependency is not yet available in the
npm registry.

That's it! Log out and in again for the `PATH` changes to take effect. Executing
`buildjs` (or `buildjs.bat`) should now display the command line options.

Usage
-----

Using BuildJS is very simple. The application has only two required command line
options and a third optional one:

    build.js SOURCE DESTINATION [IGNORE...]

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

The behaviour of BuildJS can be additionally tweaked with configuration files.
BuildJS is looking for files in the following directories and order:

* `INSTALLDIR/buildjs.json` where `INSTALLDIR` is the installation directory of BuildJS
* `HOME/.buildjs.json` where `HOME` is the home directory of the user
* `SRC/buildjs.json` where `SRC` is the source directory specified at the command line

If multiple files are found they will be merged where latter files overwrite options
of former ones.

See `INSTALLDIR/buildjs.json` for a sample configuration.

Development
-----------

See the [Wiki](https://github.com/svenjacobs/BuildJS/wiki/) for some information on
how to develop plugins for BuildJS.
