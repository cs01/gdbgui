A browser-based frontend for GDB
====================================

.. figure:: https://github.com/cs01/gdbgui/raw/master/screenshots/gdbgui.png
   :alt: gdbgui

.. image:: https://travis-ci.org/cs01/gdbgui.svg?branch=master
  :target: https://travis-ci.org/cs01/gdbgui

.. image:: https://img.shields.io/badge/pypi-0.8.1.0-blue.svg
  :target: https://pypi.python.org/pypi/gdbgui/

.. image:: https://img.shields.io/badge/python-2.7,3.4,3.5,3.6,pypy-blue.svg
  :target: https://pypi.python.org/pypi/gdbgui/

A modern, browser-based frontend to gdb (gnu debugger). Add breakpoints, view stack traces, and more in C, C++, Go, and Rust! Simply run ``gdbgui`` from the terminal and a new tab will open in your browser. See `SCREENSHOTS.md <https://github.com/cs01/gdbgui/blob/master/SCREENSHOTS.md>`_, or check out the `YouTube channel <https://www.youtube.com/channel/UCUCOSclB97r9nd54NpXMV5A>`_ or `Help page <https://github.com/cs01/gdbgui/blob/master/HELP.md>`_ for demos and tutorials.

If you are using gdbgui in a commercial setting, `consider donating to the project <https://paypal.me/grassfedcode/20>`_.


Features
--------
- Debug a different program in each tab (new gdb instance is spawned for each tab)
- Set/remove breakpoints
- View stack, threads
- Switch frame on stack, switch between threads
- Intuitively explore local variables when paused
- Hover over variables in source code to view contents
- Evaluate arbitrary expressions and plot their values over time
- Explore an interactive tree view of your data structures
- Jump back into the program's state to continue debug unexpected faults (i.e. SEGFAULT)
- Inspect memory in hex/character form
- View all registers
- Dropdown of files used to compile binary, with autocomplete functionality
- Source code explorer with ability to jump to line
- Show assembly next to source code, highlighting current instruction. Can also step through instructions.
- Assembly is displayed if source code cannot be found
- Fully functional console with autocomplete functionality to fallback to if necessary
- Notifications when new gdbgui updates are available

Why gdbgui?
-----------
- Actively developed to be compatible with current gdb releases
- Does only one thing: debugs programs. No integrated build system, no project settings, nothing to make things more complicated than they need to be.
- Design influenced by the amazing Chrome debugger
- Full gdb command line utility built-in
- The only gdb frontend built with Python and JavaScript
- Open source and free
- Useful to both beginners and experienced developers

Compatibility
-------------

Python versions: 2.7, 3.4, 3.5, 3.6, 3.6-dev, 3.7-dev, pypy

Operating systems: Ubuntu 14.04+, macOS, Windows (in cygwin)

Browsers: Tested with Chrome, Firefox. Should work with any modern, standards-compliant browser.

gdb: 7.7+

Languages: C, C++, golang, rust (any language supported by gdb itself)

Install
-------
``pip install gdbgui --upgrade``

See `INSTALLATION <https://github.com/cs01/gdbgui/blob/master/INSTALLATION.md>`_ for detailed instructions.

Run
---

Running Locally
~~~~~~~~~~~~~~~~
::

    gdbgui

A new tab in your browser will open with gdbgui in it. If a browser tab did not open, navigate to the ip/port that gdbgui is being served on (i.e. ``http://localhost:5000``).

For a list of ``gdbgui`` arguments, see the ``Arguments`` section below or type ``gdbgui --help``.

Running Remotely
~~~~~~~~~~~~~~~~
Because gdbgui is a server, it naturally allows you to debug programs running on other computers.

- ``ssh`` into the computer with the program that needs to be debugged.
- run ``gdbgui -r`` on the remote machine (this will serve publicly so beware of security here)
- on your local machine, open your browser and access the remote machine's ip and port
- debug the remote computer in your local browser

Step-By-Step Instructions
~~~~~~~~~~~~~~~~~~~~~~~~~
After opening the webpage in a supported browser:

- Type the path to the executable in the input at the top (next to "Load the Binary and Args"). The executable should already exist and have been compiled with the ``-g`` flag.
- Click ``Load the Binary and Args``. The program and symbols will load, but will not begin running. A breakpoint will be added to main automatically (this can be changed in settings).
- The line of source code corresponding to ``main`` will display if the program was compiled with debug symbols (i.e. ``-g``).
- Click the ``Run`` button, which is on the top right and looks like a circular arrow.
- Step through the program by clicking the ``Next``, ``Step``, ``Continue``, etc. as desired. These are also on the top right.

Arguments
~~~~~~~~~
Positional arguments:
  ``command``: (Optional) The quote-enclosed executable and arguments to run in gdb. This is a way to script the intial loading of the inferior program you wish to debug. For example ``gdbgui "./mybinary -myarg value -flag1 -flag2"`` (note the quotes around the executable and arguments!). Executables and arguments can also be input through the browser interface after launching (no quotes required there).

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
``gdbgui`` settings can be accessed by clicking the gear icon in the top right of the frontend. Most of these settings persist between sessions for a given url and port.

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

Debugging Faults
----------------
If your program exits unexpectedly from something like a SEGFAULT, ``gdbgui`` displays a button in the console to re-enter the state the program was in when it exited. This allows you to inspect the stack, the line on which the program exited, memory, variables, registers, etc.

.. image:: https://github.com/cs01/gdbgui/raw/master/screenshots/SIGSEGV.png
  :target: https://github.com/cs01/gdbgui/raw/master/screenshots/SIGSEGV.png

Screenshots
-----------

See `SCREENSHOTS.md <https://github.com/cs01/gdbgui/blob/master/SCREENSHOTS.md>`_ for more.

.. image:: https://raw.githubusercontent.com/cs01/gdbgui/master/screenshots/gdbgui2.png
  :target: https://raw.githubusercontent.com/cs01/gdbgui/master/screenshots/gdbgui2.png


License
-------
GNU GPLv3

PyPI and this github page are the only official sources of gdbgui.

How Does it Work?
-----------------
1. The `pygdbmi library <https://github.com/cs01/pygdbmi>`_ manages gdb as a subprocess, and returns structured data to the frontend.
2. The `Flask-SocketIO <https://flask-socketio.readthedocs.io/en/latest/>`_ server (Flask+websockets) serves the webpage and provides realtime interactivity.  http/websocket endpoints are available for the browser. Each websocket connection (browser tab) runs a pygdbmi-managed instance of gdb. A separate coroutine/thread continuously parses and forwards gdb's output to the browser.
3. The browser manages its ui with JavaScript, React, and various libraries.

The main components of gdbgui are

1. `backend.py <https://github.com/cs01/gdbgui/blob/master/gdbgui/backend.py>`__: The backend consists of a single Python file, which
   makes use of `pygdbmi <https://github.com/cs01/pygdbmi>`__ to
   interact with a gdb subprocess, and
   `Flask <http://flask.pocoo.org/>`__ to set up url routing, websockets,
   and http responses.

2. `gdbgui.pug <https://github.com/cs01/gdbgui/blob/master/gdbgui/templates/gdbgui.pug>`__: HTML file that defines the frontend

3. `gdbgui.js <https://github.com/cs01/gdbgui/blob/master/gdbgui/src/js/gdbgui.js>`__: Communicate with gdb via websockets and dynamically update the page.

4. `gdbgui.css <https://github.com/cs01/gdbgui/blob/master/gdbgui/static/css/gdbgui.css>`__: css stylesheet


Contributing
------------

See `CONTRIBUTING <https://github.com/cs01/gdbgui/blob/master/CONTRIBUTING.md>`_

Authors
-------
``gdbgui`` would not be possible without the work of several amazing open source libraries

JavaScript

- React
- splitjs: https://github.com/nathancahill/Split.js
- awesomplete: https://github.com/LeaVerou/awesomplete
- vis.js: http://visjs.org/
- moment.js
- lodash
- bootstrap
- jquery

Python

- flask: http://flask.pocoo.org/
- socket.io: https://socket.io/
- flask-socket-io: https://flask-socketio.readthedocs.io/en/latest/
- pypugjs: https://github.com/matannoam/pypugjs
- Pygments: http://pygments.org/
- gevent: http://www.gevent.org/
- pygdbmi: https://github.com/cs01/pygdbmi

and `contributions from the community <https://github.com/cs01/gdbgui/graphs/contributors>`_. Thank you!

Users of gdbgui
--------------------------------

- `Arch Linux <https://www.archlinux.org/>`_
- `BlackArch Linux <https://www.blackarch.org/>`_
- `FreeBSD <https://www.freebsd.org/>`_
- Create a PR and add your company, name, school, project, etc. here

Contact
-------
grassfedcode@gmail.com
