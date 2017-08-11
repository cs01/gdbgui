GDBGUI=../../gdbgui/backend.py

hello: hello.go
	go build -o hello_go.a -gccgoflags "-w" hello.go
	$(GDBGUI) hello_go.a
