# gdbgui installation

`gdbgui` is a package in the [Python Package Index (pyPI)](https://pypi.python.org/pypi) and can be installed using [pip](https://pip.pypa.io/en/stable/), the recommended tool for installing Python packages. It is installed like any other python package.

**Please create an issue or pull request if any of this information is out of date, incomplete, or incorrect.**

## Prerequisites

* gdb (gnu debugger)
* Python 3.4+ (recommended) or 2.7
* pip version 8 or higher

### Linux

```bash
sudo apt-get install gdb python3
sudo python3 -m pip install pip --upgrade
```

### macOS

    brew install python3
    brew install gdb --with-python --with-all-targets

macOS users must also codesign gdb: follow [these
instructions](http://andresabino.com/2015/04/14/codesign-gdb-on-mac-os-x-yosemite-10-10-2/). This will fix the error
`please check gdb is codesigned - see taskgated(8)`.

### Windows

Windows only works with [cygwin](https://cygwin.com/install.html). When
installing cygwin, add the following cygwin packages: python3,
python3-pip, python3-devel, gdb, gcc-core, and gcc-g++ cygwin. Then run
`pip install gdbgui --upgrade`

## Install

### Linux, macOS, and Windows - virtualenv (recommended)

A [virtualenv](https://virtualenv.pypa.io/en/stable/) sandboxes python packages, which guarantees there will be no installation
conflicts.

Setup a new virtualenv:

```bash
pip install virtualenv  # run as sudo if this fails
virtualenv venv -p python3  # creates a virtual env named "venv"
source venv/bin/activate  # activates the virtualenv sandbox
pip install pip --upgrade  # make sure pip is at the latest version
```
then install gdbgui:
```bash
pip install gdbgui --upgrade
```


### Linux

```
python3 -m pip install gdbgui --upgrade  # run as sudo if this fails
```

### macOS

    pip3 install gdbgui --upgrade

### Windows

    pip3 install gdbgui --upgrade

### Running from source

```bash
git clone https://github.com/cs01/gdbgui
cd gdbgui
python3 -m pip install -r requirements.txt  # run as sudo if this fails
python3 gdbgui/backend.py
```

## Post-Install
When installation is finished, type `gdbgui` from the command line to run it. See the [homepage](https://github.com/cs01/gdbgui/) for more details, or run `gdbgui -h`.
