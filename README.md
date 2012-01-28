BuildJS
=======

BuildJS is a simple [node.js](http://nodejs.org/) based build tool for static web
apps, Google Chrome extensions etc. It parses a directory structure, runs checks
and compilations/minifications on JavaScript and CSS files and finally creates a
packaged version of the web app in an output directory while the source contents
stays untouched.

Installation
------------

### Prerequisites

* node.js (version 0.6.8 or greater) and [npm](http://npmjs.org/) need to be installed on your system and the executables placed in your `PATH` environment.
* Latest version of BuildJS.

### Linux/UNIX

Put all files from the archive in a directory, e.g. `/opt/buildjs` and add the
directory to your `PATH` environment variable. Make sure `build.js` has the
executable flag set.

You can either install BuildJS's dependencies globally or in the installation
directory (recommended). In the installation directory execute the following
commands:

    npm install underscore
    npm install underscore.string

That's it! Executing `build.js` should now display the command line options.

### Windows

Put all files from the archive in a directory, e.g. `C:\Program Files\BuildJS`
and add the directory to your `PATH` environment variable.

You can either install BuildJS's dependencies globally or in the installation
directory (recommended). In the installation directory execute the following
commands:

    npm install underscore
    npm install underscore.string

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
for third party libraries whose code you are not responsible for ;-)

Development
-----------

See the [Wiki](https://github.com/svenjacobs/BuildJS/wiki/) for some information on
how to develop plugins for BuildJS.
