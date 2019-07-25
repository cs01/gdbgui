This is the command line help output of gdbgui.

```
usage: gdbgui [-h] [-g GDB] [--gdb-args GDB_ARGS] [--rr] [-p PORT]
                   [--host HOST] [-r] [--auth-file AUTH_FILE] [--user USER]
                   [--password PASSWORD] [--key KEY] [--cert CERT]
                   [--remap-sources REMAP_SOURCES] [--project PROJECT] [-v]
                   [-n] [-b BROWSER] [--debug] [--args ...]
                   [cmd]

A server that provides a graphical user interface to the gnu debugger (gdb).
https://github.com/cs01/gdbgui

positional arguments:
  cmd                   The executable file and any arguments to pass to it.
                        To pass flags to the binary, wrap in quotes, or use
                        --args instead. Example: gdbgui ./mybinary [other-
                        gdbgui-args...] Example: gdbgui './mybinary myarg
                        -flag1 -flag2' [other gdbgui args...]

optional arguments:
  -h, --help            show this help message and exit
  --args ...            Specify the executable file and any arguments to pass
                        to it. All arguments are taken literally, so if used,
                        this must be the last argument passed to gdbgui.
                        Example: gdbgui [...] --args ./mybinary myarg -flag1
                        -flag2

gdb settings:
  -g GDB, --gdb GDB     Path to debugger. Default: gdb
  --gdb-args GDB_ARGS   Arguments passed directly to gdb when gdb is invoked.
                        For example,--gdb-args="--nx --tty=/dev/ttys002"
  --rr                  Use `rr replay` instead of gdb. Replays last recording
                        by default. Replay arbitrary recording by passing
                        recorded directory as an argument. i.e. gdbgui
                        /recorded/dir --rr. See http://rr-project.org/.

gdbgui network settings:
  -p PORT, --port PORT  The port on which gdbgui will be hosted. Default: 5000
  --host HOST           The host ip address on which gdbgui serve. Default:
                        127.0.0.1
  -r, --remote          Shortcut to set host to 0.0.0.0 and suppress browser
                        from opening. This allows remote access to gdbgui and
                        is useful when running on a remote machine that you
                        want to view/debug from your local browser, or let
                        someone else debug your application remotely.

security settings:
  --auth-file AUTH_FILE
                        Require authentication before accessing gdbgui in the
                        browser. Specify a file that contains the HTTP Basic
                        auth username and password separate by newline.
  --user USER           Username when authenticating
  --password PASSWORD   Password when authenticating
  --key KEY             SSL private key. Generate with:openssl req -newkey
                        rsa:2048 -nodes -keyout host.key -x509 -days 365 -out
                        host.cert
  --cert CERT           SSL certificate. Generate with:openssl req -newkey
                        rsa:2048 -nodes -keyout host.key -x509 -days 365 -out
                        host.cert

other settings:
  --remap-sources REMAP_SOURCES, -m REMAP_SOURCES
                        Replace compile-time source paths to local source
                        paths. Pass valid JSON key/value pairs.i.e. --remap-
                        sources='{"/buildmachine": "/home/chad"}'
  --project PROJECT     Set the project directory. When viewing the "folders"
                        pane, paths are shown relative to this directory.
  -v, --version         Print version
  -n, --no-browser      By default, the browser will open with gdbgui. Pass
                        this flag so the browser does not open.
  -b BROWSER, --browser BROWSER
                        Use the given browser executable instead of the system
                        default.
  --debug               The debug flag of this Flask application. Pass this
                        flag when debugging gdbgui itself to automatically
                        reload the server when changes are detected
```
