### Running Locally

After downloading gdbgui, you can launch it like so:

* `gdbgui` (or whatever the binary name is, i.e. `gdbgui_0.10.0.0`)
* `gdbgui "./mybinary -myarg value -flag1 -flag2"` (note the quotes around the arguments)
* `gdbgui --args "./mybinary -myarg value -flag1 -flag2"` (note the quotes around the arguments)

See more examples when launching [here](examples.html).

A new tab in your browser will open with gdbgui in it. If a browser tab did not open, navigate to the ip/port that gdbgui is being served on (i.e. http://localhost:5000).

Now that gdbgui is open, you can interactively run a program with it.
* Type the path to the executable in the input at the top (next to "Load Binary"). The executable should already exist and have been compiled with the `-g` flag.
* Click `Load Binary`. The program and symbols will load, but will not begin running. A breakpoint will be added to main automatically. This can be changed in settings if you prefer not to do this.
* The line of source code corresponding to main will display if the program was compiled with the `-g` flag debug symbols.
* Click the Run button, which is on the top right and looks like a circular arrow.
* Step through the program by clicking the Next, Step, Continue, icons as desired. These are also on the top right.

For a list of gdbgui arguments, see the Arguments section below or type gdbgui --help.

### Debugging Rust Programs

`gdbgui` can be used to debug programs written in Rust. Assuming you use [Cargo](https://doc.rust-lang.org/stable/cargo/) to create a new program
and build it in Debug mode in the standard way:

```
cargo new myprog
cd myprog
cargo build
```

You can start debugging with a simple

`gdbgui target/debug/myprog`

There are a couple of small difficulties.

Instead of showing your `main` function the initial screen will be blank and `gdbgui` will print `File not found: main`.
You need to help `gdbgui` out by typing `main` into the file browser box:

![](https://raw.githubusercontent.com/cs01/gdbgui/master/screenshots/rust_main.png)

and selecting the `main.rs` file. The source code should then appear in the browser and you can click to set breakpoints
and run the program. Of course, if you want to break in some other file, you can find that in the file browser instead.

The second difficulty is with the GDB pretty-printing macros that Rust ships with. GDB can't find these by default,
which makes it print the message

```
warning: Missing auto-load script at offset 0 in section .debug_gdb_scripts of file /home/phil/temp/myprog/target/debug/myprog.
Use `info auto-load python-scripts [REGEXP]' to list them.
```

You can safely ignore this, but the [Rust issue](https://github.com/rust-lang/rust/issues/33159#issuecomment-384073290)
describes the workarounds necessary (create a `.gdbinit` file and paste a few lines into the Python helper script).

* On Windows Rust defaults to the MSVC toolchain, and `gdbgui` can't debug binaries compiled that way. If you want to use `gdbgui`,
  you'll have to [switch to the GNU toolchain](https://github.com/rust-lang-nursery/rustup.rs#working-with-rust-on-windows).
* If you want to debug programs compiled in Release mode, you will need to create a `profile.release` section in your
  `Cargo.toml` and add `debug = true` to it. See the [Cargo manifest](https://doc.rust-lang.org/stable/cargo/reference/manifest.html) for details.

### Running gdbgui Remotely
Because gdbgui is a server, it naturally allows you to debug programs running on other computers.

* ssh into the computer with the program that needs to be debugged.
* run `gdbgui -r` on the remote machine (this will serve publicly so beware of security here)
* on your local machine, open your browser and access the remote machine's ip and port
* debug the remote computer in your local browser


### Connecting to gdbserver
Like gdb, [`gdbserver`](https://sourceware.org/gdb/onlinedocs/gdb/Server.html) is also made by gnu, but with the following important differences:

* it is much smaller than gdb
* it is easier to port to other architectures than all of gdb

gdbserver runs on a remote machine or embedded target, which, as the name suggests, runs a server. gdb communicates with gdbserver so you can debug on your local machine. To do this, the remote machine must run the server and program:

`gdbserver 0.0.0.0:9000 mybinary.a`

Then you can launch `gdb` or `gdbgui` and connect to it. In `gdbgui`, use the dropdown to select `Connect to gdbserver`, and enter

`<remote ip address>:9000`

Read more at the [gdbserver homepage](https://sourceware.org/gdb/onlinedocs/gdb/Server.html).

### Settings
`gdbgui` settings can be accessed by clicking the gear icon in the top right of the frontend. Most of these settings persist between sessions for a given url and port.


### Keyboard Shortcuts
The following keyboard shortcuts are available when the focus is not in an input field. They have the same effect as when the button is pressed.

* Run: r
* Continue: c
* Next: n or right arrow
* Step: s or down arrow
* Up: u or up arrow
* Next Instruction: m
* Step Instruction: ,


### Debugging Faults

If your program exits unexpectedly from something like a SEGFAULT, gdbgui displays a button in the console to re-enter the state the program was in when it exited. This allows you to inspect the stack, the line on which the program exited, memory, variables, registers, etc.

![](https://raw.githubusercontent.com/cs01/gdbgui/master/screenshots/SIGSEV.png)
