## How can I see what commands are being sent to gdb?
Go to Settings and check the box that says `Print all sent commands in console, including those sent automatically by gdbgui`

## How can I see gdb's raw output?
Launch gdbgui with the debug flag, `gdbgui --debug`, then a new component will appear on the bottom right side of UI.

## Can I use a different gdb executable?
Yes, use `gdbgui -g <gdb executable>`

## Does this work with LLDB?
No, only gdb.

## Can this debug Python?
No. It uses gdb on the backend which does not debug Python code.

## How do I make program output appear in a different terminal?
On linux terminals are named. You can get a terminal's name by running `tty` which will print something like `/dev/ttys3`. Tell gdb to use the terminal gdbgui was launched from with

```bash
gdbgui --gdb-args="--tty=$(tty)"
```

or if you want to set it from the UI after gdbgui has been opened, run

```bash
set inferior-tty /dev/ttys3  # replace /dev/ttys3 with desired tty name
```

## Help! There isn't a button for something I want to do. What should I do?
The vast majority of common use cases are handled in the UI, and to keep the UI somewhat simple I do not intend on making UI support for every single gdb command. You can search gdb documentation and use any gdb command you want in the console at the bottom of the window. If you think there should be a UI element for a command or function, create an issue on GitHub and I will consider it.
