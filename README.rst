A browser-based frontend/gui for GDB
====================================

.. figure:: https://github.com/cs01/gdbgui/raw/master/screencast.gif
   :alt: gdbgui

.. image:: https://travis-ci.org/cs01/gdbgui.svg?branch=master
  :target: https://travis-ci.org/cs01/gdbgui

.. image:: https://img.shields.io/badge/pypi-v0.7.3.7-blue.svg
  :target: https://pypi.python.org/pypi/gdbgui/

.. image:: https://img.shields.io/badge/python-2.7, 3.3, 3.4, 3.5, pypy-blue.svg
  :target: https://pypi.python.org/pypi/gdbgui/

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

    pip install gdbgui --upgrade

Run
---

::

    gdbgui

A new tab in your browser will open with gdbgui in it.

To immediately set the inferior binary and arguments and have them load when the page is loaded

::

    gdbgui --cmd '/path/to/binary -arg myaarg -flag'

Help
~~~~

``gdbgui -h`` displays command line options, such as changing the port
or host ip.

Compatibility
-------------

``gdbgui`` has been tested to work in these environments. It may work in
other environments as well.

Python versions: 2.7, 3.3, 3.4, 3.5, pypy

Operating systems: Ubuntu 16.04

Browsers: Chrome, Firefox, Ubuntu Web Browser

Development
-----------
Contributions and bug fixes are welcome!

``gdbgui`` was designed to be easily hackable and extendable. There is
no build system necessary to run or develop this app.

There are three parts to gdb:

1. ``gdbgui.js``: There is just one JavaScript file, and that file
   contains the majority of the app itself. It sends AJAX requests to
   interact with gdb, then gets the response and updates the DOM as
   necessary.

2. ``gdbgui.jade``: HTML file that defines the frontend (Note: Jade/Pug
   is a more concise form of html. Also note: jade has been renamed to
   `pug <https://github.com/pugjs/pug>`__, but the Python pypi package
   still maintains the jade name. See demo
   `here <http://html2jade.org/>`__.)

3. ``backend.py``: The backend consists of a single Python file, which
   makes use of `pygdbmi <https://github.com/cs01/pygdbmi>`__ to
   interact with a gdb subprocess, and
   `Flask <http://flask.pocoo.org/>`__ to set up url routing and
   responses.

To get started with development, set up a new virtual environment, then
run

::

    git clone https://github.com/cs01/gdbgui
    cd gdbgui
    pip install -r gdbgui/requirements.txt
    python -m gdbgui/backend.py --debug

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
