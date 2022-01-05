This is the command line help output of gdbgui.

```
usage: gdbgui [-h] [-g GDB_CMD] [-p PORT] [--host HOST] [-r]
              [--auth-file AUTH_FILE] [--user USER] [--password PASSWORD]
              [--key KEY] [--cert CERT] [--remap-sources REMAP_SOURCES]
              [--project PROJECT] [-v] [-n] [-b BROWSER] [--debug]
              [--args ...]
              [debug_program]

A server that provides a graphical user interface to the gnu debugger (gdb).
https://github.com/cs01/gdbgui

positional arguments:
  debug_program         The executable file you wish to debug, and any
                        arguments to pass to it. To pass flags to the
                        binary, wrap in quotes, or use --args instead.
                        Example: gdbgui ./mybinary [other-gdbgui-args...]
                        Example: gdbgui './mybinary myarg -flag1 -flag2'
                        [other gdbgui args...] (default: None)

optional arguments:
  -h, --help            show this help message and exit
  --args ...            Specify the executable file you wish to debug and
                        any arguments to pass to it. All arguments are taken
                        literally, so if used, this must be the last
                        argument. This can also be specified later in the
                        frontend. passed to gdbgui. Example: gdbgui [...]
                        --args ./mybinary myarg -flag1 -flag2 (default: [])

gdb settings:
  -g GDB_CMD, --gdb-cmd GDB_CMD
                        gdb binary and arguments to run. If passing
                        arguments, enclose in quotes. If using rr, it should
                        be specified here with 'rr replay'. Examples: gdb,
                        /path/to/gdb, 'gdb --command=FILE -ix', 'rr replay'
                        (default: gdb)

gdbgui network settings:
  -p PORT, --port PORT  The port on which gdbgui will be hosted (default:
                        5000)
  --host HOST           The host ip address on which gdbgui serve (default:
                        127.0.0.1)
  -r, --remote          Shortcut to set host to 0.0.0.0 and suppress browser
                        from opening. This allows remote access to gdbgui
                        and is useful when running on a remote machine that
                        you want to view/debug from your local browser, or
                        let someone else debug your application remotely.
                        (default: False)

security settings:
  --auth-file AUTH_FILE
                        Require authentication before accessing gdbgui in
                        the browser. Specify a file that contains the HTTP
                        Basic auth username and password separate by
                        newline. (default: None)
  --user USER           Username when authenticating (default: None)
  --password PASSWORD   Password when authenticating (default: None)
  --key KEY             SSL private key. Generate with:openssl req -newkey
                        rsa:2048 -nodes -keyout host.key -x509 -days 365
                        -out host.cert (default: None)
  --cert CERT           SSL certificate. Generate with:openssl req -newkey
                        rsa:2048 -nodes -keyout host.key -x509 -days 365
                        -out host.cert (default: None)

other settings:
  --remap-sources REMAP_SOURCES, -m REMAP_SOURCES
                        Replace compile-time source paths to local source
                        paths. Pass valid JSON key/value pairs.i.e. --remap-
                        sources='{"/buildmachine": "/current/machine"}'
                        (default: None)
  --project PROJECT     Set the project directory. When viewing the
                        "folders" pane, paths are shown relative to this
                        directory. (default: None)
  -v, --version         Print version (default: False)
  -n, --no-browser      By default, the browser will open with gdbgui. Pass
                        this flag so the browser does not open. (default:
                        False)
  -b BROWSER, --browser BROWSER
                        Use the given browser executable instead of the
                        system default. (default: None)
  --debug               The debug flag of this Flask application. Pass this
                        flag when debugging gdbgui itself to automatically
                        reload the server when changes are detected
                        (default: False)
```
