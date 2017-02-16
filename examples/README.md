# Examples

Clone gdbgui:

	git clone https://github.com/cs01/gdbgui.git
	cd gdbgui

Running the following commands will:

* open a new tab in your browser
* load the inferior binary
* insert a breakpoint at main

You must click the run icon to begin running the program.

## C

	make -C examples hello_c_binary
	gdbgui/backend.py examples/hello_c_binary


## C++

	make -C examples hello_cpp
	gdbgui/backend.py examples/hello_cpp_binary
