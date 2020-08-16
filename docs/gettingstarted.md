Before running `gdbgui`, you should compile your program with debug symbols and a lower level of optimization, so code isn't optimized out before runtime. To include debug symbols with `gcc` use `-ggdb`, with `rustc` use `-g`. To disable most optimizations in `gcc` use the `-O0` flag, with `rustc` use `-O`.

For more details, consult your compiler's documentation or a search engine.

Now that you have `gdbgui` installed and your program compiled with debug symbols, all you need to do is run
```
gdbgui
```

This will start gdbgui's server and open a new tab in your browser. That tab contains a fully functional frontend running `gdb`!

You can see gdbgui in action on [YouTube](https://www.youtube.com/channel/UCUCOSclB97r9nd54NpXMV5A).

To see the full list of options gdbgui offers, you can view command line options by running
```
gdbgui --help
```

If you have a question about something

* Read documentation on the [homepage](https://github.com/cs01/gdbgui/)
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
