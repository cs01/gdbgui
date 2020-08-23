![image](https://github.com/cs01/gdbgui/raw/master/screenshots/gdbgui.png)
![image](https://github.com/cs01/gdbgui/raw/master/screenshots/gdbgui2.png)

Enter the binary and args just as you'd call them on the command line.
The binary is restored when gdbgui is opened at a later time.

![image](https://github.com/cs01/gdbgui/raw/master/screenshots/load_binary_and_args.png)

Intuitive control of your program. From left to right: Run, Continue,
Next, Step, Return, Next Instruction, Step Instruction.

![image](https://github.com/cs01/gdbgui/raw/master/screenshots/controls.png)

If the environment supports reverse debugging, such as when using an Intel CPU and running Linux and debugging with [rr](http://rr-project.org/), gdbgui allows you to debug in reverse.
![image](https://github.com/cs01/gdbgui/raw/master/screenshots/reverse_debugging.png)

## Stack/Threads

View all threads, the full stack on the active thread, the current frame
on inactive threads. Switch between frames on the stack, or threads by
pointing and clicking.

![image](https://github.com/cs01/gdbgui/raw/master/screenshots/stack_and_threads.png)

## Send Signal to Inferior (debugged) Process
Choose from any signal your OS supports to send to the inferior. For example, to mock `CTRL+C` in plain gdb, you can send `SIGINT` to interrupt the inferior process. If the inferior process is hung for some reason, you can send `SIGKILL`, etc.
![image](https://github.com/cs01/gdbgui/raw/master/screenshots/send_signal.png)


## Source Code
View source, assembly, add breakpoints. All symbols used to compile the
target are listed in a dropdown above the source code viewer, and have
autocompletion capabilities. There are two different color schemes: dark (monokai), and a light theme (default).

![image](https://github.com/cs01/gdbgui/raw/master/screenshots/source.png)

With assembly. Note the bold line is the current instruction that gdb is
stopped on.

![image](https://github.com/cs01/gdbgui/raw/master/screenshots/source_with_assembly.png)

If the source file is not found, it will display assembly, and allow you to step through it as desired.
![image](https://github.com/cs01/gdbgui/raw/master/screenshots/assembly.png)


## Variables and Expressions

All local variables are automatically displayed, and are clickable to
explore their fields.

![image](https://github.com/cs01/gdbgui/raw/master/screenshots/locals.png)

Hover over a variable and explore it, just like in the Chrome debugger.

![image](https://github.com/cs01/gdbgui/raw/master/screenshots/hover.png)

Arbitrary expressions can be evaluated as well. These expressions persist as the program is stepped through. The base/radix can be modified as desired.

![image](https://github.com/cs01/gdbgui/raw/master/screenshots/radix.gif)

![image](https://github.com/cs01/gdbgui/raw/master/screenshots/expressions.png)

Expressions record their previous values, and can be displayed in an x/y
plot.

![image](https://github.com/cs01/gdbgui/raw/master/screenshots/plots.png)

Expressions can be interactively explored in a tree view.

![image](https://github.com/cs01/gdbgui/raw/master/screenshots/tree_explorer.png)


## Memory Viewer

All hex addresses are automatically converted to clickable links to
explore memory. Length of memory is configurable. In this case 10 bytes
are displayed per row.

![image](https://github.com/cs01/gdbgui/raw/master/screenshots/memory.png)

## Registers

View all registers. If a register was updated it is highlighted in
yellow.

![image](https://github.com/cs01/gdbgui/raw/master/screenshots/registers.png)

## gdb console

* Prints gdb output
* Allows you to write directly to the underlying gdb subprocess as if you were using it in the terminal
* Tab completion works, and displays a button to view help on gdb commands
* Can be used to ease into learning gdb
* Can be used as a fallback for commands that don't have a UI widget
* History can be accessed using up/down arrows

![image](https://github.com/cs01/gdbgui/raw/master/screenshots/console.png)

## authentication
Authentication can be enabled when serving on a publicly accessible IP address. See `gdbgui --help` for instructions on how to enable authentication.

![image](https://github.com/cs01/gdbgui/raw/master/screenshots/authentication.png)


## Dashboard
A dashboard is available to let you look at all gdb instances managed by gdbgui. You can kill them, or attach to them. More than one person can attach to a managed gdb subprocess and participate in the debugging session simultaneously. i.e. if one person steps forward, all connected users see the program step forward in real time.

![image](https://github.com/cs01/gdbgui/raw/master/screenshots/dashboard.png)

## gdbgui at launch

![image](https://github.com/cs01/gdbgui/raw/master/screenshots/ready.png)
