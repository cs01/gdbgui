# Examples

## Overview
`gdbgui` can debug executables generated from various languages. This folder contains example source code and makefiles to build and automatically launch `gdbgui`.

## Clone
To get started, first clone this repository:
```
git clone https://github.com/cs01/gdbgui.git
```

## Install Dependencies
If you already installed `gdbgui` with `pip`, you have all dependencies installed. If not, you need to install them manually:
```bash
pip install -r gdbgui/requirements.txt  # run as sudo if this fails
```

## Build Executables and Debug with gdbgui
Enter the directory with the language of your choice in `gdbgui/examples/*` (`c`, `cpp`, `rust`, `golang`, `fortran`), then type `make` and hit the `tab` to see the make targets.

For example, in `gdbgui/examples/c`, running `make hello` will:

* build the binary (assuming you have the right compilers and libraries installed)
* open a new tab in your browser
* load the executable for the make target you just built
* insert a breakpoint at main (Rust and Go users may see machine code displayed rather than source code. This is a `gdb` limitation.)
* **Note: Although the program has loaded, you still must click the run icon to actually begin running the program.**
