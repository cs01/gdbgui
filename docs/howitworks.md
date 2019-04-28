gdbgui consists of two main parts: the frontend and the backend

## Backend

The backend is written in Python and consists of a Flask server with websocket capability thanks to the `python-socketio` package.

When a new websocket connection from a browser is established, the server starts a new gdb subprocess and associates it with this websocket. This gdb process is told to use gdb's [machine interface](https://sourceware.org/gdb/onlinedocs/gdb/GDB_002fMI.html) interpreter, which enables gdb's input and output to be programatically parsed so you can write code to do further processing with it, such as build a user interface.

The [pygdbmi library](https://github.com/cs01/pygdbmi) is used to manage the gdb subprocess and parse its output. It returns key/value pairs (dictionaries) that can be used to create a frontend. I wrote pygdbmi as a building block for gdbgui, but it is useful for any type of programmatic control over gdb.

In summary, the backend is used to:

- create endpoints for the browser, including http and websocket.
  - The server can access the operating system and do things like read source files or send signals to processes.
- create a managed gdb subprocess and parse output with pygdbmi
- spawn a separate thread to constantly check for output from the gdb subprocess
- forward output to the client through a websocket as it is parsed in the reader thread

## Frontend

The frontend is written in JavaScript and uses React. It establishes a websocket connection to the server, at which time the server starts a new gdb subprocess for that particular websocket connection as mentioned above. Commands can be sent from the browser through the websocket to the server which writes to gdb, and output from gdb is forwarded from the server through the websocket to the browser.

As the browser receives websocket messages from the server, it maintains the state of gdb, such as whether it's running, paused, or exited, where breakpoints are, what the stack is, etc. As this state changes, React performs the necessary DOM updates.

In summary, the frontend is used to:

* Convert key/value pairs of gdb's machine interface output into a user interface
* Maintain the state of gdb
* Provide UI elements that can send gdb machine interface commands to gdb