# gdbgui installation


## Binary Distrubution (recommended)
There are two options to use gdbgui:
* standalone binary executable or
* the Python Package `gdbgui`.

**Standalone binary executables are the recommended way to run gdbgui, and are available at [gdbgui.com](http://gdbgui.com)**.

## Python Package
If you do not want to use the binary, `gdbgui` is also a package in the [Python Package Index (PyPI)](https://pypi.python.org/pypi) and can be installed using [pip](https://pip.pypa.io/en/stable/), the recommended tool for installing Python packages. It is installed like any other python package:

    [sudo] pip install gdbgui --upgrade

When installation is finished, type `gdbgui` from the command line to run it, or `gdbgui -h` for help.

If you are unfamiliar with `pip` or if that command did not work, see Troubleshooting below.

**Please create an issue or pull request if any of this information is out of date, incomplete, or incorrect.**

## Prerequisites if Using Python Package

* gdb (gnu debugger)
* Python 3.4+ (recommended) or 2.7
* pip version 8 or higher

### Linux Prerequisites

Note: this is for python package installation only, and not related to the standalone binary executables available at [gdbgui.com](http://gdbgui.com).

    sudo apt-get install gdb python3
    sudo python3 -m pip install pip --upgrade

### macOS Prerequisites

    brew install python3
    brew install gdb --with-python --with-all-targets

macOS users must also codesign gdb: follow [these
instructions](http://andresabino.com/2015/04/14/codesign-gdb-on-mac-os-x-yosemite-10-10-2/). This will fix the error
`please check gdb is codesigned - see taskgated(8)`.

### Windows Prerequisites

Note: this is for python package installation only, and not related to the standalone binary executables available at [gdbgui.com](http://gdbgui.com).

* [Python 3](https://www.python.org/downloads/windows/)
* gdb, make, gcc

If you do not have already have gdb/make/gcc installed, there are two options to install them on Windows: `MinGW` and `cygwin`.

##### MinGW (recommended)
Minimal GNU for Windows ([`MinGW`]([http://mingw.org/)) is the recommended Windows option. [Install MinGW](https://sourceforge.net/projects/mingw/files/Installer/mingw-get-setup.exe/download) with the "MinGW Base System" package. This is the default package which contains `make`, `gcc`, and `gdb`.

It will install to somewhere like `C:\MinGW\bin\...`. For example `C:\MinGW\bin\gdb.exe`, `C:\MinGW\bin\mingw32-make.exe`, etc.

Ensure this MinGW binary directory (i.e. `C:\MinGW\bin\`) is on your "Path" environement variable: Go to `Control Panel > System Properties > Environment Variables > System Variables > Path` and make sure `C:\MinGW\bin\` is added to that list. If it is not added to your "Path", you will have to run gdbgui with the path explicitly called out, such as `gdbgui -g C:\MinGW\bin\gdb.exe`.

##### Cygwin
Cygwin is a more UNIX-like compatibility layer on Windows, and `gdbgui` works with it as well.
* Install [cygwin](https://cygwin.com/install.html) | [homepage](https://cygwin.com/index.html))
* When installing cygwin packages, add the following:
** python3
** python3-pip
** python3-devel
** gdb
** gcc-core
** gcc-g++

Then run
`pip install gdbgui --upgrade`

## Troubleshooting

Note: this is for python package installation only, and not related to the standalone binary executables available at [gdbgui.com](http://gdbgui.com).

### Linux, macOS, Windows

If there is a conflict or error when installing via pip, use [`pipsi`](https://github.com/mitsuhiko/pipsi). pipsi is like pip, but it sandboxes everything into its own python environment, and it works on all operating systems.

* [Download the pipsi installer](https://raw.githubusercontent.com/mitsuhiko/pipsi/master/get-pipsi.py)
* Run with python: `python get-pipsi.py`
* `~/.local/bin/pipsi.exe install gdbgui`

When installation is finished, type `gdbgui` from the command line to run it, or `gdbgui -h` for help.

To upgrade gdbgui with pipsi:
* `~/.local/bin/pipsi.exe upgrade gdbgui`

### Running from source

```bash
git clone https://github.com/cs01/gdbgui
cd gdbgui
pip install -r requirements.txt  # run as sudo if this fails
gdbgui/backend.py
```

Note: Although not strictly required, you should install requirements.txt using a virtualenv to avoid changing system python packages.

A [virtualenv](https://virtualenv.pypa.io/en/stable/) sandboxes python packages, which guarantees there will be no installation
conflicts.

To use a new virtualenv:

```bash
pip install virtualenv  # run as sudo if this fails
virtualenv venv -p python3  # creates a virtual env named "venv"
source venv/bin/activate  # activates the virtualenv sandbox
pip install pip --upgrade  # make sure pip is at the latest version
```

Then run

    pip install -r requirements.txt
