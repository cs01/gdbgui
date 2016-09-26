
[![Build Status](https://travis-ci.org/cs01/gdbgui.svg?branch=master)](https://travis-ci.org/cs01/gdbgui)

Still under active development, with a changing codebase/api.

# A browser-based gui for GDB
Made with a lightweight Python server (Flask), and JavaScript for the frontend. Simply run the server, then view the page. Tested on Ubuntu 16.04 with Chrome.

## Installation and Use

    git clone https://github.com/cs01/gdbgui
    pip install -r gdbgui/requirements.txt
    gdbgui/gdbgui/backend.py
    * Running on http://127.0.0.1:5000/ (Press CTRL+C to quit)

Then open `http://127.0.0.1:5000/` in a browser and enjoy!

A pip install package will be released when codebase is more stable

## Compatibility
Tested on Python versions
* 2.7
* 3.3
* 3.4
* 3.5
* pypy
