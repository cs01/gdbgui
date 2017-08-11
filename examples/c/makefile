GDBGUI=../../gdbgui/backend.py

hello: hello.c
	gcc hello.c -o hello_c.a -std=c99 -g
	$(GDBGUI) hello_c.a

debug_segfault: debug_segfault.c
	gcc debug_segfault.c -g -o debug_segfault.a -std=c99
	$(GDBGUI) debug_segfault.a
