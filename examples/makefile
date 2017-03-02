c: hello.c
	gcc $^ -g -o c.a -std=c99
	../gdbgui/backend.py c.a

cpp: hello.cpp
	g++ $^ -g -o cpp.a -std=c++11
	../gdbgui/backend.py cpp.a

go: hello.go
	go build -o go.a -gccgoflags "-w" hello.go
	../gdbgui/backend.py go.a

rust: hello.rs
	rustc -g hello.rs -o rust.a
	../gdbgui/backend.py rust.a

# ever wonder how cpython works?
.PHONY: python
python: cpython/python
	gdbgui cpython/python

cpython:
	git clone https://github.com/python/cpython.git

cpython/Makefile: cpython
	cd cpython && ./configure

cpython/python: cpython cpython/Makefile
	make -C cpython -j4

