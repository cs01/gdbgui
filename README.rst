A browser-based frontend/gui for GDB
====================================

.. figure:: https://github.com/cs01/gdbgui/raw/master/screencast.gif
   :alt: gdbgui

.. image:: https://travis-ci.org/cs01/gdbgui.svg?branch=master
  :target: https://travis-ci.org/cs01/gdbgui

.. image:: https://img.shields.io/badge/pypi-v0.7.3.9-blue.svg
  :target: https://pypi.python.org/pypi/gdbgui/

.. image:: https://img.shields.io/badge/python-2.7, 3.3, 3.4, 3.5, pypy-blue.svg
  :target: https://pypi.python.org/pypi/gdbgui/

.. image:: https://img.shields.io/badge/development-active-green.svg
  :target: https://github.com/cs01/gdbgui

.. image:: https://img.shields.io/badge/SayThanks.io-☼-blue.svg
  :target: https://saythanks.io/to/grassfedcode

.. image:: https://img.shields.io/gratipay/cs01.svg
  :target: https://gratipay.com/cs01/


A modern, browser-based frontend to gdb (gnu debugger). Add breakpoints,
view stack traces, and more in C, C++, Go, and Rust! Simply run
``gdbgui`` from the terminal and a new tab will open in your browser.

Install
-------

::

    [sudo] pip install gdbgui --upgrade

Since gdbgui is under active development, consider running this command fairly often.

Run
---

::

    gdbgui

A new tab in your browser will open with gdbgui in it.

Options
~~~~~~~
-h, --help    show this help message and exit
--port PORT   The port on which gdbgui will be hosted
--host HOST   The host ip address on which gdbgui serve.
--gdb GDB     Path to gdb executable.
--cmd CMD     The binary and arguments to run in gdb. This is a way to
              script the intial loading of the inferior binary you wish to
              debug. For example gdbgui --cmd='./mybinary -myarg -flag1
              -flag2'
--debug       The debug flag of this Flask application. Pass this flag when
              debugging gdbgui itself to automatically reload the server
              when changes are detected
--no_browser  By default, the browser will open with gdb gui. Pass this flag
              so the browser does not open.

Features
--------
- Set/remove breakpoints
- View stack, threads
- Switch frame on stack, switch between threads
- Inspect memory in hex/character form
- View all registers
- Dropdown of all files used to compile binary, with autocomplete functionality
- Source code explorer with ability to jump to line
- Show assembly next to source code, highlighting current instruction. Can also step through instructions.

Why gdbgui?
-----------
- Actively developed and compatible with the latest version of gdb (7.12)
- Does only one thing: debugs programs. No integrated build system, no project settings, nothing to make things more complicated than they need to be. Just a lightweight frontend.
- Design influenced by the amazing Chrome debugger: source code on the left, side panel on the right with collapsable widgets, console on the bottom
- Full gdb command line utility built in
- Written in widely used languages (Python and JavaScript)
- Open source and free

Compatibility
-------------

``gdbgui`` has been tested to work in these environments. It may work in
other environments as well.

Python versions: 2.7, 3.3, 3.4, 3.5, pypy

Operating systems: Ubuntu 16.04

Browsers: Chrome, Firefox, Ubuntu Web Browser

Development
-----------
Contributions and bug fixes are welcome. Before creating an issue, make sure you are using the latest version of gdbgui
since it is under active development.

To get started with development, set up a new virtual environment, then
run

::

    git clone https://github.com/cs01/gdbgui
    cd gdbgui
    pip install -r gdbgui/requirements.txt
    python -m gdbgui/backend.py --debug

How Does it Work?
~~~~~~~~~~~~~~~~~
It uses Python to manage gdb as a subprocess. Specifically, the `pygdbmi library <https://github.com/cs01/pygdbmi>`__,  which returns key/value pairs (dictionaries) that can be used to create a frontend. To make a usable frontend, first a server must made to interface with gdb. In this case, the Flask server is used, which does three things: creates a managed gdb subprocess with pygdbmi, spawns a separate thread to constantly check for output from the gdb subprocess, and creates endpoints for the browser including http requests and websocket connections.

As output is parsed in the reader thread, it is immediately sent to the frontend through the websocket. As the browser receives these websocket messages, it maintains the state of gdb (whether it's running, paused, or exited, where breakpoints are, what the stack is, etc.) and updates the DOM as appropriate. Of course, the browser also sends commands to gdb through the Flask server, which it does as needed when various buttons are pressed, or when the user enters a command-line command. The server also has access to the filesystem, so the client can show source code of any file.

``gdbgui`` was designed to be easily hackable and extendable. There is
no build system necessary to run or develop this app.

The main components of gdbgui are

1. ``backend.py``: The backend consists of a single Python file, which
   makes use of `pygdbmi <https://github.com/cs01/pygdbmi>`__ to
   interact with a gdb subprocess, and
   `Flask <http://flask.pocoo.org/>`__ to set up url routing, websockets,
   and http responses.

2. ``gdbgui.jade``: HTML file that defines the frontend

3. ``gdbgui.js``: The majority of the application is contained in this file. If dynamically updates the page, and maintains gdb state. It sends AJAX requests and uses websockets to interact with gdb through the server, then gets the response and updates the DOM as necessary.

4. ``gdbgui.css``: css stylesheet


Testing
~~~~~~~

``python setup.py test`` runs unit tests located in
``gdbgui/tests/test_app.py``. Add new tests there as necessary.


Future Improvements
-------------------

-  Hover over a variable in source code to see its value
-  Embed plotting tools to plot a variable's value over time
-  Assign values to variables / memory addresses
-  Embed a binary/decimal/hex calculator
