A browser-based frontend/gui for GDB
====================================


.. figure:: https://github.com/cs01/gdbgui/raw/master/screenshots/gdbgui.png
   :alt: gdbgui

.. image:: https://travis-ci.org/cs01/gdbgui.svg?branch=master
  :target: https://travis-ci.org/cs01/gdbgui

.. image:: https://img.shields.io/badge/pyPI-v0.7.4.5-blue.svg
  :target: https://pypi.python.org/pypi/gdbgui/

.. image:: https://img.shields.io/badge/python-2.7, 3.4, 3.5, pypy-blue.svg
  :target: https://pypi.python.org/pypi/gdbgui/

.. image:: https://img.shields.io/badge/development-active-green.svg
  :target: https://github.com/cs01/gdbgui

.. image:: https://badges.gitter.im/gdbgui/Lobby.svg
   :alt: Join the chat at https://gitter.im/gdbgui/Lobby
   :target: https://gitter.im/gdbgui/Lobby?utm_source=badge&utm_medium=badge&utm_campaign=pr-badge&utm_content=badge

.. image:: https://img.shields.io/badge/SayThanks.io-☼-blue.svg
  :target: https://saythanks.io/to/grassfedcode

.. image:: https://img.shields.io/gratipay/cs01.svg
  :target: https://gratipay.com/cs01/


A modern, browser-based frontend to gdb (gnu debugger). Add breakpoints,
view stack traces, and more in C, C++, Go, and Rust! Simply run
``gdbgui`` from the terminal and a new tab will open in your browser. `Screenshots <https://github.com/cs01/gdbgui#screenshots>`_ are below.

Install
------------------------------

**Linux**

::

    sudo pip install gdbgui --upgrade

**macOS**

::

    sudo pip install gdbgui --upgrade --user

**Windows**

    pip install gdbgui --upgrade

    Tested with `cygwin <https://cygwin.com/install.html>`_.


Since gdbgui is under active development, consider running this command fairly often.

virtualenv users do not need the ``sudo`` prefix.


**Alternatively, you can clone and run directly**

::

    git clone https://github.com/cs01/gdbgui
    cd gdbgui
    pip install -r requirements.txt
    gdbgui/backend.py

Run
---

::

    gdbgui [binary to debug]

A new tab in your browser will open with gdbgui in it.

Features
--------
- Debug a different program in each tab (new gdb instance is spawned for each tab)
- Set/remove breakpoints
- View stack, threads
- Switch frame on stack, switch between threads
- Intuitively explore local variables when paused
- Evaluate arbitrary expressions and plot their values over time
- Inspect memory in hex/character form
- View all registers
- Dropdown of all files used to compile binary, with autocomplete functionality
- Source code explorer with ability to jump to line
- Show assembly next to source code, highlighting current instruction. Can also step through instructions.

Why gdbgui?
-----------
- Actively developed and compatible with the latest version of gdb (7.12)
- Does only one thing: debugs programs. No integrated build system, no project settings, nothing to make things more complicated than they need to be. Just a lightweight frontend.
- Design influenced by the amazing Chrome debugger
- Full gdb command line utility built-in
- Written in widely used languages (Python and JavaScript)
- Open source and free for personal use, `affordable <http://grassfedcode.com/gdbguicommercial>`_ for commercial use.

Examples
--------
See `https://github.com/cs01/gdbgui/tree/master/examples <https://github.com/cs01/gdbgui/tree/master/examples>`_

Arguments
~~~~~~~~~
Positional arguments:
  ``command``: (Optional) The binary and arguments to run in gdb. This is a way to script the intial loading of the inferior binary you wish to debug. For example ``gdbgui ./mybinary -myarg -flag1 -flag2``. Binaries and arguments can also be input through the browser interface after launching.

Flags (all are optional):
  -h, --help            show this help message and exit
  -p PORT, --port PORT  The port on which gdbgui will be hosted
  --host HOST           The host ip address on which gdbgui serve.
  -g GDB, --gdb GDB     Path to gdb executable or lldb-mi executable. Defaults is 'gdb'. lldb
                        support is experimental and not fully functional at this time.
  -v, --version         Print version
  --debug               The debug flag of this Flask application. Pass this
                        flag when debugging gdbgui itself to automatically
                        reload the server when changes are detected
  -n, --no_browser          By default, the browser will open with gdb gui. Pass
                        this flag so the browser does not open.

Compatibility
-------------

Python versions: 2.7, 3.4, 3.5, pypy

Operating systems: Ubuntu 14.04, Ubuntu 16.04, OSX

Browsers: Chrome, Firefox, Ubuntu Web Browser

Gdb: 7.7.1 (tested), 7.12 (tested), likely works with intermediate versions

Contributing
------------
Help the gdbgui project grow by spreading the word. The more people who use it, the better it gets.

.. image:: twitter.png
  :target: https://twitter.com/intent/tweet?text=check+out+%23gdbgui%2C+a+modern+browser-based+frontend+to+gdb+https%3A%2F%2Fgithub.com%2Fcs01%2Fgdbgui

Creating and voting on issues in github will help me prioritize what to work on.

Documentation, spelling fixes, bug fixes, features, etc. are of course welcome too. To get started with development, set up a new virtual environment, then
run

::

    git clone https://github.com/cs01/gdbgui
    cd gdbgui
    pip install -r requirements.txt
    gdbgui/backend.py --debug

If you are modifying gdbgui.js, make sure you have the developer console open so the browser doesn't cache the file and miss your changes. When ``--debug`` is passed, there is a new component at the bottom of the right sidebar that displays the raw gdb mi output to help you debug.


Testing
~~~~~~~

``make test`` runs unit tests and verifies README.rst is properly formatted.
``gdbgui/tests/test_app.py``. Add new tests there as necessary.


License
-------
This software licensed under Creative Commons Attribution-NonCommercial 3.0 for personal use. `Click here <http://grassfedcode.com/gdbguicommercial>`_ for commercial license.

pyPI and this github page are the only official sources of gdbgui. Any other sites serving gdbgui in any way should be avoided not only due to licensing issues, but due to security concerns as well.

How Does it Work?
-----------------
It uses Python to manage gdb as a subprocess. Specifically, the `pygdbmi library <https://github.com/cs01/pygdbmi>`__,  which returns key/value pairs (dictionaries) that can be used to create a frontend. To make a usable frontend, first a server must made to interface with gdb. In this case, the Flask server is used, which does three things: creates a managed gdb subprocess with pygdbmi, spawns a separate thread to constantly check for output from the gdb subprocess, and creates endpoints for the browser including http requests and websocket connections.

As output is parsed in the reader thread, it is immediately sent to the frontend through the websocket. As the browser receives these websocket messages, it maintains the state of gdb (whether it's running, paused, or exited, where breakpoints are, what the stack is, etc.) and updates the DOM as appropriate. The browser also sends commands to gdb through a websocket to Flask server, which then passes the command to gdb. Gdb writes new output, which is picked up by the reader thread.

``gdbgui`` was designed to be easily hackable and extendable. There is
no build system necessary to run or develop this app.

The main components of gdbgui are

1. ``backend.py``: The backend consists of a single Python file, which
   makes use of `pygdbmi <https://github.com/cs01/pygdbmi>`__ to
   interact with a gdb subprocess, and
   `Flask <http://flask.pocoo.org/>`__ to set up url routing, websockets,
   and http responses.

2. ``gdbgui.pug``: HTML file that defines the frontend

3. ``gdbgui.js``: The majority of the application is contained in this file. It dynamically updates the page, and maintains gdb state. It sends AJAX requests and uses websockets to interact with gdb through the server, then gets the response and updates the DOM as necessary.

4. ``gdbgui.css``: css stylesheet


Screenshots
-----------
Enter the binary and args just as you'd call them on the command line. Binary is restored when gdbgui is opened at a later time.

.. image:: https://github.com/cs01/gdbgui/raw/master/screenshots/load_binary_and_args.png
  :target: https://github.com/cs01/gdbgui/raw/master/screenshots/load_binary_and_args.png

Intuitive control of your program. From left to right: Run, Continue, Next, Step, Return, Next Instruction, Step Instruction, send interrupt signal (SIGINT) to inferior process.

.. image:: https://github.com/cs01/gdbgui/raw/master/screenshots/controls.png
  :target: https://github.com/cs01/gdbgui/raw/master/screenshots/controls.png

Stack/Threads
-------------------------
View all threads, the full stack on the active thread, the current frame on inactive threads. Switch between frames on the stack, or threads by pointing and clicking.

.. image:: https://github.com/cs01/gdbgui/raw/master/screenshots/stack_and_threads.png
  :target: https://github.com/cs01/gdbgui/raw/master/screenshots/stack_and_threads.png

Source Code
-----------
View source, assembly, add breakpoints. All symbols used to compile the target are listed in a dropdown above the source code viewer, and have autocompletion capabilities.

.. image:: https://github.com/cs01/gdbgui/raw/master/screenshots/source.png
  :target: https://github.com/cs01/gdbgui/raw/master/screenshots/source.png

With assembly. Note the bold line is the current instruction that gdb is stopped on.

.. image:: https://github.com/cs01/gdbgui/raw/master/screenshots/source_with_assembly.png
  :target: https://github.com/cs01/gdbgui/raw/master/screenshots/source_with_assembly.png


Variables and Expressions
-------------------------

All local variables are automatically displayed, and are clickable to explore their fields.

.. image:: https://github.com/cs01/gdbgui/raw/master/screenshots/locals.png
  :target: https://github.com/cs01/gdbgui/raw/master/screenshots/locals.png

Arbitrary expressions can be evaluated as well.

.. image:: https://github.com/cs01/gdbgui/raw/master/screenshots/expressions.png
  :target: https://github.com/cs01/gdbgui/raw/master/screenshots/expressions.png

Expressions record their previous values, and can be displayed in an x/y plot.

.. image:: https://github.com/cs01/gdbgui/raw/master/screenshots/plots.png
  :target: https://github.com/cs01/gdbgui/raw/master/screenshots/plots.png



Memory Viewer
-------------
All hex addresses are automatically converted to clickable links to explore memory. Length of memory is configurable. In this case 16 bytes are displayed per row.

.. image:: https://github.com/cs01/gdbgui/raw/master/screenshots/memory.png
  :target: https://github.com/cs01/gdbgui/raw/master/screenshots/memory.png


Registers
---------
View all registers. If a register was updated it is highlighted in yellow.

.. image:: https://github.com/cs01/gdbgui/raw/master/screenshots/registers.png
  :target: https://github.com/cs01/gdbgui/raw/master/screenshots/registers.png


gdb console
-----------
Read gdb output, and write to the gdb subprocess as desired. Don't let any gdb commandline skills you've developed go to waste.

.. image:: https://github.com/cs01/gdbgui/raw/master/screenshots/console.png
  :target: https://github.com/cs01/gdbgui/raw/master/screenshots/console.png


gdbgui at launch:

.. image:: https://github.com/cs01/gdbgui/raw/master/screenshots/ready.png
  :target: https://github.com/cs01/gdbgui/raw/master/screenshots/ready.png
