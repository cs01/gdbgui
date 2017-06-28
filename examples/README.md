# Examples

	git clone https://github.com/cs01/gdbgui.git
	cd gdbgui/examples
	make [ c | cpp | go | rust ]

Running `make` in the above commands will

* build the binary (assuming you have the right compilers and libraries installed)
* open a new tab in your browser
* load the inferior binary
* insert a breakpoint at main (Rust and Go users, see note)

Note: go and rust programs will show an error trying to load file "main" because gdb does not know how to determine source files from function names for go/rust. Choose a file from the dropdown, then add a breakpoint and hit run. It will then hit the "main" breakpoint, so you must press the continue button to hit your breakpoint. To avoid this, turn off the `Auto add breakpoint to main` option in Settings.

Note: Although the program has loaded, you still must click the run icon to actually begin running the program.
