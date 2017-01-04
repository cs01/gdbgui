
[![Build Status](https://travis-ci.org/cs01/gdbgui.svg?branch=master)](https://travis-ci.org/cs01/gdbgui)

# A browser-based frontend/gui for GDB.
Add breakpoints, view sourcecode, stack traces, registers, disassembly, and more. Easily hackable single page of es6 JavaScript and jquery, with python managing a gdb subprocess on the backend (see [pygdbmi](https://github.com/cs01/pygdbmi)).

Made with a lightweight Python server (Flask), and JavaScript for the frontend. Simply run the server, view the page, and start debuggin'!

![gdbgui](https://github.com/cs01/gdbgui/blob/master/gdbgui.png)

## Install

	pip install gdbgui

## Run

    python -m gdbgui.backend
    * Running on http://127.0.0.1:5000/ (Press CTRL+C to quit)

Open [http://127.0.0.1:5000/](http://127.0.0.1:5000/) in a browser and enjoy!

## Compatibility
Python versions: 2.7, 3.3, 3.4, 3.5, pypy

Operating systems: Ubuntu 16.04

Browsers: Chrome

## Development

`gdbgui` was designed to be easily hackable and extendtable.

There are only three parts to gdb:

1. `gdbgui.js`: There is only a single JavaScript file, and that file contains the majority of the app itself. It sends AJAX requests to interact with gdb, then gets the response and updates the DOM as necessary.

1. `gdbgui.jade`: HTML file that defines the frontend (Note: Jade/Pug is a more concise form of html. Also note: jade has been renamed to [pug](https://github.com/pugjs/pug), but the Python pypi package still maintains the jade name.)

1. `backend.py`: The backend consists of a single Python file, which makes use of [pygdbmi](https://github.com/cs01/pygdbmi) to interact with a gdb subprocess, and [Flask](http://flask.pocoo.org/) to set up url routing and responses.

To get started with development, set up a new virtual environment, then run

    git clone https://github.com/cs01/gdbgui
    pip install -r gdbgui/requirements.txt
    python -m gdbgui.backend --debug

### Testing
Test changes are still working with `python setup.py test`. Add to tests at gdbgui/tests/test_app.py

## Contributing

Contributions and bug fixes are welcome!


## Credits

Inspiration was drawn from the following projects

* [sirnewton01 / godbg](https://github.com/sirnewton01/godbg)
* [cyrus-and / gdb](https://github.com/cyrus-and/gdb)


## TODO

* add autocompletion and documentation of all commands
* add ability to view/inspect variables
* add ability to view/inspect memory

