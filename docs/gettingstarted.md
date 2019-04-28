Now that you have `gdbgui` installed, all you need to do is run
```
gdbgui
```

which will start gdbgui's server and open a new tab in your browser. That tab contains a fully functional frontend running `gdb`!

You can see gdbgui in action on [YouTube](https://www.youtube.com/channel/UCUCOSclB97r9nd54NpXMV5A).

To see the full list of options gdbgui offers, you can view command line options by running
```
gdbgui --help
```

If you need help:

* Read documentation on the [homepage](https://github.com/cs01/gdbgui/)
* Ask a question in the [gdbgui chat room](https://gitter.im/gdbgui/Lobby)
* [Ask question in an issue on github](https://github.com/cs01/gdbgui/issues)


## Settings
`gdbgui` settings can be accessed by clicking the gear icon in the top right of the frontend. Most of these settings persist between sessions for a given url and port.


## Keyboard Shortcuts
The following keyboard shortcuts are available when the focus is not in an input field. They have the same effect as when the button is pressed.

* Run: r
* Continue: c
* Next: n or right arrow
* Step: s or down arrow
* Up: u or up arrow
* Next Instruction: m
* Step Instruction: ,


## Debugging Faults

If your program exits unexpectedly from something like a SEGFAULT, gdbgui displays a button in the console to re-enter the state the program was in when it exited. This allows you to inspect the stack, the line on which the program exited, memory, variables, registers, etc.

![](https://raw.githubusercontent.com/cs01/gdbgui/master/screenshots/SIGSEV.png)
