# gdbgui installation

There are a few ways to install gdbgui on your machine. There is even a way to run gdbgui without installing it. Read on to to find the one that's right for you.

## Method 1: Using `pipx` (recommended)

gdbgui recommends using [pipx](https://github.com/pipxproject/pipx), a program to run Python CLI binaries in isolated environments.

You can install pipx like this:

```
python3 -m pip install --user pipx
python3 -m userpath append ~/.local/bin
```

Restart/re-source your console to make sure the userpath is up to date.

Then, install gdbgui with pipx:

```
pipx install gdbgui
```

To upgrade run

```
pipx upgrade gdbgui
```

When installation is finished, type `gdbgui` from the command line to run it, or `gdbgui -h` for help.

To uninstall, run

```
pipx uninstall gdbgui
```

### Try Without Installing

By using [pipx](https://github.com/pipxproject/pipx), you can run Python CLI programs in ephemeral one-time virtual environments.

```
pipx run gdbgui
```

A new tab running the latest version of gdbgui will open in your browser. Press CTRL+C to end the process, and your system will remain untouched.

## Method 2: Using `pip`

`pip` is a popular installer for Python packages. gdbgui is a Python package and as such can be installed with pip, though we recommend using `pipx` rather than `pip` if possible.

If you prefer to use Virtual Environments, you can activate one and then run

```
pip install gdbgui
```

You can get upgrades with

```
pip install --upgrade gdbgui
```

To uninstall, run

```
pip uninstall gdbgui
```

## Method 3: Download and Run Binary Executable

Download and run the binary executable for your system from [GitHub Releases](https://github.com/cs01/gdbgui/releases).

## System Dependencies for Python Package

Note that this only applies if you are installing the Python package, and not using the binary executable.

- gdb (gnu debugger)
- Python 3.4+ (recommended) or 2.7
- pip version 8 or higher

### Linux Dependencies

    sudo apt install gdb python3

### macOS Dependencies

    brew install python3
    brew install gdb --with-python --with-all-targets

macOS users must also codesign gdb: follow [these
instructions](http://andresabino.com/2015/04/14/codesign-gdb-on-mac-os-x-yosemite-10-10-2/). This will fix the error
`please check gdb is codesigned - see taskgated(8)`.

### Windows Dependencies

Note that windows is only supported for gdbgui versions less than 0.14.

- [Python 3](https://www.python.org/downloads/windows/)
- gdb, make, gcc

If you do not have already have gdb/make/gcc installed, there are two options to install them on Windows: `MinGW` and `cygwin`.

##### MinGW (recommended)

Minimal GNU for Windows ([`MinGW`]([http://mingw.org/)) is the recommended Windows option. [Install MinGW](https://sourceforge.net/projects/mingw/files/Installer/mingw-get-setup.exe/download) with the "MinGW Base System" package. This is the default package which contains `make`, `gcc`, and `gdb`.

It will install to somewhere like `C:\MinGW\bin\...`. For example `C:\MinGW\bin\gdb.exe`, `C:\MinGW\bin\mingw32-make.exe`, etc.

Ensure this MinGW binary directory (i.e. `C:\MinGW\bin\`) is on your "Path" environment variable: Go to `Control Panel > System Properties > Environment Variables > System Variables > Path` and make sure `C:\MinGW\bin\` is added to that list. If it is not added to your "Path", you will have to run gdbgui with the path explicitly called out, such as `gdbgui -g C:\MinGW\bin\gdb.exe`.

##### Cygwin

Cygwin is a more UNIX-like compatibility layer on Windows, and `gdbgui` works with it as well.

- Install [cygwin](https://cygwin.com/install.html)

When installing cygwin packages, add the following:

- python3
- python3-pip
- python3-devel
- gdb
- gcc-core
- gcc-g++

### Running from Source

See the [contributing](/contributing) section.
