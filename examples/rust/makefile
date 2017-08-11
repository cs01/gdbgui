GDBGUI=../../gdbgui/backend.py

hello: hello.rs
	rustc hello.rs -o hello_rs.a -g
	$(GDBGUI) hello_rs.a
