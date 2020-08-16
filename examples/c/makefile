ROOT:=$(shell dirname $(realpath $(firstword $(MAKEFILE_LIST))))

hello: hello.c
	gcc hello.c -o hello_c.a -std=c99 -g
	@echo Run with gdbgui: gdbgui --args $(ROOT)/hello_c.a

input: input.c
	gcc input.c -o input.a -std=c99 -g
	@echo Run with gdbgui: gdbgui --args $(ROOT)/input.a

debug_segfault: debug_segfault.c
	gcc debug_segfault.c -g -o debug_segfault.a -std=c99
	@echo Run with gdbgui: gdbgui --args $(ROOT)/debug_segfault.a

threads: threads.c
	gcc threads.c -o threads.a -std=c99 -lpthread -g
	@echo Run with gdbgui: gdbgui --args $(ROOT)/threads.a

sleeper: sleeper.c
	gcc sleeper.c -o sleeper.a -std=c99 -g
	@echo Run with gdbgui: gdbgui --args $(ROOT)/sleeper.a
