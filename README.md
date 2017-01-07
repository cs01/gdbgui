
[![Build Status](https://travis-ci.org/cs01/gdbgui.svg?branch=master)](https://travis-ci.org/cs01/gdbgui)

# A browser-based frontend/gui for GDB.
Add breakpoints, view sourcecode, stack traces, registers, disassembly, and more. Easily hackable single page of es6 JavaScript and jQuery, with python managing a gdb subprocess on the backend (see [pygdbmi](https://github.com/cs01/pygdbmi)).

Made with a lightweight Python server (Flask), and JavaScript for the frontend. Simply run the server, view the page, and start debuggin'!

![gdbgui](gdbgui.png)

## Install

	pip install gdbgui --upgrade

## Run

    gdbgui
    * Running on http://127.0.0.1:5000/ (Press CTRL+C to quit)

Open [http://127.0.0.1:5000/](http://127.0.0.1:5000/) in a browser and enjoy!


### Help

`gdbgui -h` displays command line options, such as changing the port or host ip. For any other questions feel free to email me or create an issue in github.

## Compatibility
Python versions: 2.7, 3.3, 3.4, 3.5, pypy

Operating systems: Ubuntu 16.04

Browsers: Chrome, Firefox, Ubuntu Web Browser

## Development

`gdbgui` was designed to be easily hackable and extendable. There is no build system necessary to run or develop this app.

There are only three parts to gdb:

1. `gdbgui.js`: There is just one JavaScript file, and that file contains the majority of the app itself. It sends AJAX requests to interact with gdb, then gets the response and updates the DOM as necessary.

1. `gdbgui.jade`: HTML file that defines the frontend (Note: Jade/Pug is a more concise form of html. Also note: jade has been renamed to [pug](https://github.com/pugjs/pug), but the Python pypi package still maintains the jade name.)

1. `backend.py`: The backend consists of a single Python file, which makes use of [pygdbmi](https://github.com/cs01/pygdbmi) to interact with a gdb subprocess, and [Flask](http://flask.pocoo.org/) to set up url routing and responses.

To get started with development, set up a new virtual environment, then run

    git clone https://github.com/cs01/gdbgui
    cd gdbgui
    pip install -r gdbgui/requirements.txt
    python -m gdbgui.backend --debug

### Testing
`python setup.py test` runs unit tests located in `gdbgui/tests/test_app.py`. Add new tests there as necessary.

## Contributing

Contributions and bug fixes are welcome!

Since this lives in a browser, it's really extendable. Some ideas:

* Embed a binary/decimal/hex calculator
* Embed plotting tools to plot a variable's value over time
* Add syntax highlighting
* Semantic source code -- i.e. hover over a variable and immediately see its value.
* Assign values to variables / memory addresses
* Link to educational tools about register names/meanings, instruction names/meanings, how gdb works in general (https://jvns.ca/blog/2016/08/10/how-does-gdb-work/), etc
* Warn you if you are using an old version of gdb and there is a new one available
* Debug a program on a smartphone since gdbgui has a responsive UI!

If you use this at your company or for your job, I would love to hear from you -- send me an email and let me know.


## Credits

Inspiration was drawn from the following projects, as well as my own frustration while using gdb in the terminal =).

* [sirnewton01 / godbg](https://github.com/sirnewton01/godbg)
* [cyrus-and / gdb](https://github.com/cyrus-and/gdb)


## TODO

Despite this list, gdbgui is quite usable in its current form

* ~~allow argument passing to the inferior process being debugged~~
* ~~add links back to github, etc~~
* ~~escape brackets on system <includes> so they don't disappear~~
* ~~only make gutter create/delete breakpoints, not anywhere in source file~~
* ~~add ability to view/inspect variables~~
* ~~add ability to view/inspect memory~~
* add tabs for all open source files
* add button to adjust window width
* improve toolbar styling, change color when error occurs
* add preference ui elements (auto-refresh various windows after command is sent; show/hide windows as desired)
* make flash of color fade out when snapping to source code lines or restoring old history
* add autocompletion and documentation of all commands
* make panels movable and hidable
* display hex and decimals for registers instead of just hex
