. v/bin/activate
python -m gdbgui --debug
BABEL_ENV=development ./node_modules/.bin/webpack --mode development --watch --config webpack.config.js

# todo
1. side panel scrolls annoyingly
1. hovervar action that adds expression
1. fetch disass key shortcut
1. new setting for memory width in bytes (8, but could be nicer as 16)
1. new settings to remember memory distance from selected address
1. remove awesomplete it's fucking garbage as fuck
1. theme hovervar as code
1. do tooltips the bootstrap way
1. remember collapse state of right sidebar collapse-ers
1. make understand file:/// pointers
1. tree thing needs his own window

# fixed
1. smaller icon sizes
1. smaller text
1. scrollbars show in layouts when debugging
1. module doesn't exist
1. ugly borders everywhere
1. buttons act like buttons
1. divs act like divs
1. spans act like spans
1. remove hovers from important features
1. goto line is pretty
1. remove more horrible horrible animation effects
1. themed dinky windows with disassm in them cuz ugly
1. button group was not rendered right; don't use .hidden
1. row resizer beauty
1. pretty clear debug gdb mi output btn
