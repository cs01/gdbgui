c: hello.c
	gcc hello.c -o c.a -std=c99 -g
	../gdbgui/backend.py c.a

debug_segfault: debug_segfault.c
	gcc debug_segfault.c -g -o debug_segfault.a -std=c99
	../gdbgui/backend.py debug_segfault.a

cpp: hello.cpp
	g++ hello.cpp -o cpp.a -std=c++11 -g
	../gdbgui/backend.py cpp.a

go: hello.go
	go build -o go.a -gccgoflags "-w" hello.go
	../gdbgui/backend.py go.a

rust: hello.rs
	rustc hello.rs -o rust.a -g
	../gdbgui/backend.py rust.a

tree: tree.c
	gcc tree.c -o tree.a -std=c99 -g
	../gdbgui/backend.py tree.a

linked_list: linked_list.cpp
	g++ linked_list.cpp -o linked_list_cpp.a -std=c++11 -g
	../gdbgui/backend.py linked_list.a

