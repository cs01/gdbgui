
# Examples
## Code Examples
View code examples on [GitHub](https://github.com/cs01/gdbgui/tree/master/examples).

## gdbgui Invocation Examples

launch gdbgui

```
gdbgui
```

set the inferior program, pass argument, set a breakpoint at main

```
gdbgui "./myprogram myarg -myflag"
```

alternate way to do the same thing (note the lack of quotes)

```
gdbgui --args ./myprogram myarg  command -myflag
```

use gdb binary not on your $PATH

```
gdbgui -g build/mygdb
```

run on port 8080 instead of the default port

```
gdbgui --port 8080
```

Pass arbitrary arguments directly to gdb when it is launched

```
gdbgui --gdb-args="-x gdbcmds.txt"
```

run on a server and host on 0.0.0.0. Accessible to the outside world as long as port 80 is not blocked.

```
gdbgui -r
```

Same as previous but will prompt for a username and password

```
gdbgui -r --auth
```

Same as previous but with encrypted https connection.
```
openssl req -newkey rsa:2048 -nodes -keyout private.key -x509 -days 365 -out host.cert
```
```
gdbgui -r --auth --key private.key --cert host.cert
```

Use Mozilla's [record and replay](https://rr-project.org) (rr) debugging supplement to gdb. rr lets your record a program (usually with a hard-to-reproduce bug in it), then deterministically replay it as many times as you want. You can even step forwards and backwards.
```
gdbgui --rr
```

Use recording other than the most recent one

```
gdbgui --rr RECORDED_DIRECTORY
```

Don't automatically open the browser when launching

```
gdbgui -n
```
