A browser-based frontend/gui for GDB
====================================

.. figure:: https://github.com/cs01/gdbgui/raw/master/screenshots/gdbgui.png
   :alt: gdbgui

.. image:: https://travis-ci.org/cs01/gdbgui.svg?branch=master
  :target: https://travis-ci.org/cs01/gdbgui

.. image:: https://img.shields.io/badge/pypi-0.7.8.2-blue.svg
  :target: https://pypi.python.org/pypi/gdbgui/

.. image:: https://img.shields.io/badge/python-2.7,3.4,3.5,3.6,pypy-blue.svg
  :target: https://pypi.python.org/pypi/gdbgui/


A modern, browser-based frontend to gdb (gnu debugger). Add breakpoints, view stack traces, and more in C, C++, Go, and Rust! Simply run ``gdbgui`` from the terminal and a new tab will open in your browser. `Screenshots <https://github.com/cs01/gdbgui#screenshots>`_ are below.


Features
--------
- Debug a different program in each tab (new gdb instance is spawned for each tab)
- Set/remove breakpoints
- View stack, threads
- Switch frame on stack, switch between threads
- Intuitively explore local variables when paused
- Hover over variables in source code to view contents
- Evaluate arbitrary expressions and plot their values over time
- Inspect memory in hex/character form
- View all registers
- Dropdown of files used to compile binary, with autocomplete functionality
- Source code explorer with ability to jump to line
- Show assembly next to source code, highlighting current instruction. Can also step through instructions.
- Assembly is displayed if source code cannot be found
- Notifications when new gdbgui updates are available

Why gdbgui?
-----------
- Actively developed to be compatible with current gdb releases
- Does only one thing: debugs programs. No integrated build system, no project settings, nothing to make things more complicated than they need to be.
- Design influenced by the amazing Chrome debugger
- Full gdb command line utility built-in
- Written in widely used languages (Python and JavaScript)
- Open source and free

Compatibility
-------------

Python versions: 2.7, 3.4, 3.5, 3.6, 3.6-dev, 3.7-dev, pypy

Operating systems: Ubuntu 14.04+, macOS, Windows (in cygwin)

Browsers: Chrome

gdb: 7.7+

Languages: C, C++, golang, rust (any language supported by gdb itself)

Prerequisites
---------------
pip version 8 or higher. Python 2.7 or 3.4+. Python 3.x is recommended.

::

    sudo apt-get install python-pip
    python -m pip install --upgrade pip

If you cannot upgrade pip due to a system-owned installation, you can run in a virtualenv, which safely sandboxes your python environment:

::

    python -m pip install virtualenv
    virtualenv venv -p python3
    source venv/bin/activate
    python -m pip install --upgrade pip

macOS users should follow `these instructions <https://gcc.gnu.org/onlinedocs/gnat_ugn/Codesigning-the-Debugger.html>`__  to codesign gdb for the error ``please check gdb is codesigned - see taskgated(8)``

You must also have gdb installed system-wide or have a gdb executable available.


Install
-------

using pip (recommended)
~~~~~~~~~~~~~~~~~~~~~~~

::

    pip install gdbgui --upgrade

Or, to install it system wide:

::

    sudo pip install gdbgui --upgrade

macOS users should run this for system wide installations:

::

    sudo pip install gdbgui --upgrade --user

Windows has been tested to work with `cygwin <https://cygwin.com/install.html>`_.

manually
~~~~~~~~

::

    git clone https://github.com/cs01/gdbgui
    cd gdbgui
    [sudo] pip install -r requirements.txt [--user]
    gdbgui/backend.py

Run
---

Running Locally
~~~~~~~~~~~~~~~~
::

    gdbgui [-h] [-p PORT] [--host HOST] [-r] [-g GDB] [--lldb] [-v]
              [--hide_gdbgui_upgrades] [--debug] [-n]
              [cmd [cmd ...]]

A new tab in your browser will open with gdbgui in it.

- If the browser did not open: open it and navigate to the ip/port that gdbgui is being served on (i.e. ``localhost:5000``)
- Type the path to the executable in the input at the top (next to "Load the Binary and Args"). The executable should already exist and have been compiled with the ``-g`` flag.
- Click ``Load the Binary and Args``. The program and symbols will load, but will not begin running. A breakpoint will be added to main automatically (this can be changed in settings)
- The source code will display if the program was compiled with debug symbols. If it's not, make sure you compiled your program with the ``-g`` flag.
- Click the ``Run`` button, which is on the top right and looks like a circular arrow.
- Step through the program by clicking the ``Next``, ``Step``, ``Continue``, etc. as desired. These are also on the top right.

Running Remotely
~~~~~~~~~~~~~~~~
Because gdbgui is a server, it naturally allows you to debug programs running on other computers.

- ``ssh`` into the computer with the program that needs to be debugged.
- run ``gdbgui -r`` on the remote machine (this will serve publicly so beware of security here)
- on your local machine, open your browser and access the remote machine's ip and port
- debug the remote computer in your local browser

Arguments
~~~~~~~~~
Positional arguments:
  ``command``: (Optional) The executable and arguments to run in gdb. This is a way to script the intial loading of the inferior program you wish to debug. For example ``gdbgui "./mybinary -myarg -flag1 -flag2"`` (note the quotes around the executable and arguments). Executables and arguments can also be input through the browser interface after launching (no quotes required there).

Flags (all are optional):
  -h, --help            show this help message and exit
  -p PORT, --port PORT  The port on which gdbgui will be hosted. Defaults to
                        5000
  --host HOST           The host ip address on which gdbgui serve. Defaults to
                        127.0.0.1
  -r, --remote          Shortcut to sets host to 0.0.0.0 and suppress browser
                        from opening. This allows remote access to gdbgui and
                        is useful when running on a remote machine that you
                        want to view/debug from your local browser, or let
                        someone else debug your application remotely.
  -g GDB, --gdb GDB     Path to gdb or lldb executable. Defaults to gdb. lldb
                        support is experimental.
  --lldb                Use lldb commands (experimental)
  -v, --version         Print version
  --hide_gdbgui_upgrades
                        Hide messages regarding newer version of gdbgui.
                        Defaults to False.
  --debug               The debug flag of this Flask application. Pass this
                        flag when debugging gdbgui itself to automatically
                        reload the server when changes are detected
  -n, --no_browser      By default, the browser will open with gdb gui. Pass
                        this flag so the browser does not open.
  -x GDB_CMD_FILE, --gdb_cmd_file GDB_CMD_FILE
                        Execute GDB commands from file.

Examples
--------
Example code and makefiles for C, C++, go, and rust, that build and launch gdb.

See the `examples folder <https://github.com/cs01/gdbgui/tree/master/examples>`_.

Settings
--------
gdbgui settings can be accessed by clicking the gear icon in the top right of the frontend. Most of these settings persist between sessions for the url and port.

Keyboard Shortcuts
------------------
The following keyboard shortcuts are available when the focus is not in an input field. They have the same effect as when the button is pressed.

- Run: r
- Continue: c
- Next: n or right arrow
- Step: s or down arrow
- Up: u or up arrow
- Next Instruction: m
- Step Instruction: ,

License
-------
GNU GPLv3

pyPI and this github page are the only official sources of gdbgui.

How Does it Work?
-----------------
1. The `pygdbmi library <https://github.com/cs01/pygdbmi>`__ manages gdb as a subprocess, and returns key/value pairs (dictionaries).
2. The `Flask-SocketIO <https://flask-socketio.readthedocs.io/en/latest/>`__ server (Flask+websockets) serves the webpage and provides realtime interactivity.  http/websocket endpoints are available for the browser. Each websocket connection (browser tab) runs a pygdbmi-managed instance of gdb. A thread is spawned constantly read and forward output from gdb to the browser.
3. The `pypugjs <https://github.com/matannoam/pypugjs>`__ template engine is used to reduce html LOC
4. The browser manages its ui and state with the plain JavaScript library `stator <https://github.com/cs01/stator>`__

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

Hover over a variable and explore it, just like in the Chrome debugger.

.. image:: https://github.com/cs01/gdbgui/raw/master/screenshots/hover.png
  :target: https://github.com/cs01/gdbgui/raw/master/screenshots/hover.png


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

Contributing
------------

See `CONTRIBUTING <https://github.com/cs01/gdbgui/blob/master/CONTRIBUTING.md>`_

Contact
-------
grassfedcode@gmail.com
