# to get this thing to work
. v/bin/activate
python -m gdbgui --debug
BABEL_ENV=development ./node_modules/.bin/webpack --mode development --watch --config webpack.config.js

# todo
1. re-layout the whole gui top-to-bottom, bootstrap it!
1. side panel scrolls annoyingly during use
1. hovervar action that adds expression
1. fetch disass key shortcut or do it automatically and as setting
1. new setting for memory width in bytes (8, but could be nicer as 16)
1. new settings to remember memory distance from selected address
1. theme hovervar as code
1. do tooltips the bootstrap way
1. remember collapse state of right sidebar collapse-ers
1. make load binary understand file:/// scheme uris
1. tree thing needs his own window he's annoying as shit to work with
1. register_table_data is 10000 lines long; allow filtering
1. add that stupid splitter thing back in (console, file explorer, code window, program stats)
1. the dashboard template is busted
1. / keymaps to focus load binary input
1. ; keymaps to focus gdb command input 
1. pretty scrollbars
1. stylize white input backgrounds 
1. asm doesn't switch from at&t to intel until you click twice

# fixed
1. filesystem style with icons to match mime-types
1. l keymaps to load binary
1. nav bars stick on the top
1. footer (nav bar) sticks to the bottom
1. beautiful text (source code pro)
1. fix icons
1. theme bootstrap using bootswatch
1. use node modules to build webpack dependencies
1. smaller icon sizes
1. smaller text
1. scrollbars show in layouts when debugging
1. module doesn't exist error in python not sure why
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
1. filesystem picker collapses when text is clicked
1. moved settings into menu
1. load last binary shortcut
