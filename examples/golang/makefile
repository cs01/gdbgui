GDBGUI=../../gdbgui/backend.py

hello: hello.go
	go build -o hello_go.a -gccgoflags "-w" hello.go
	@echo Run with gdbgui: gdbgui --args hello_go.a
