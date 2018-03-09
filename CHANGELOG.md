# gdbgui release history

## 0.11.2.0
* add option to remove fflush command (#179)
* remove react-treebeard and render filesystem w/ new component

## 0.11.1.1
* Bugfix displaying upgrade text

## 0.11.1.0
* Add csrf and cross origin protection
* Convert backslashes to forward slashes when entering windows binary paths (#167)
* Fix safari ui issue (#164)
* Update text on reload file button, and disable when no file is loaded (#165)
* When disassembly can't be fetched in mode 4, fetch in mode 3 and assume gdb version is 7.6.0 (#166)
* Add copy to clipboard icon for files and variables
* Allow SSL module import to fail and print warning (#170)
* Cleanup menu, add license info, bugfixes, etc. (#169, #136, #163, #172)

## 0.11.0.0
* Replace `--auth` cli option with `--user` and `--password`

## 0.10.3.0
* Added resizer buttons to components on right pane

## 0.10.2.1
* Add link for fix for macOS users
* Update version of React to 16.2
* Remove unused links

## 0.10.2.0
* Add folders view, rearrange layout (@martin-der)
* Add settings cog button
* Add message when sending signal to inferior process (#156)
* Change default theme to monokai, rename 'default' theme to 'light'
* Minor bugfixes

## 0.10.1.0
* Display descriptions of registers
* Do not try to fetch Registers when they cannot be read

## 0.10.0.2
* Add support for rr (--rr flag)
* Add dashboard to connect to/kill existing gdb processes
* Add option to specify SSL key and certificate to enable https
* Add option to connect to process
* Add option to connect to gdbserver
* Add infinite scrolling

## 0.9.4.1
* Remove `pypugjs` dependency

## 0.9.4.0
* Add native Windows support (no longer relies on Cygwin)

## 0.9.3.0
* Only display assembly flavor is assembly is displayed
* Add new output type to console (gdbgui output)
* Add dashboard link and dropdown for gdb server/pid attach
* Handle invalid signal choice better
* Print gdb mi log messages to console
* Remove localStorage keys when they are invalid

## 0.9.2.0
* Add signals component and allow signals to be sent to gdb (issue ##141)
* Fix bug when jumping to line of source file

## 0.9.1.1
* Fix bug when passing arguments to gdb
* Require latest version of pygdbmi for faster parsing of large gdb output

## 0.9.1.0
* Lazily load files (issue #131)
* Update setup.py to build wheels

## 0.9.0.1
* Reupload to fix setup.cfg PyPI bug

## 0.9.0.0
* Compress responses from server (massive bandwidth improvement)
* Add button to toggle assembly flavors (issue #110)
* Parse executable+args with spaces (issue #116)
* Turn modals into components
* Move everything into a single root React component
* Refresh state when clicking "return" button
* Add javascript unit tests

## 0.8.2.0
* Add optional authentication (@nickamon, issue #132)
* Support the `--args` flag (issue #126)
* Ensure code is correct and adheres to recommended Python style when running tests/building (flake8)
* Display source when running `backtrace` (fix regression, #134)


## 0.8.1.0
* Add autocomplete functionality (@bobthekingofegypt, issue #129)
* Rearranged and improved alignment of assembly
* Fixed bug when fetching variable fails
* Plot floating point values instead of casting to int

## 0.8.0.3
* modify component initialization order so that store updates are better sequenced

## 0.8.0.2
* display bracket instead of `&lt;` when exploring gdb variables

## 0.8.0.1
* fix bug when restoring old settings

## 0.8.0.0
* Add ability to change radix of variables (issue #102)
* Add component to send signals to inferior program (issues #31, #90)
* Parse gdb version from arm-non-eabi-gdb (issue #83)
* Rewrite most components to React (issue #17)
* Improve CSS in various components

## 0.7.9.5
* re-fetch registers if name/value count does not match

## 0.7.9.4
* add inputs to resize Tree view
* add menu in top right
* css updates to preserve whitespace in terminal
* add top-level html to wrap body+head elements in gdbgui.pug
* add help file
* add donate page

## 0.7.9.3
* Changes to layout
* Fix character escaping in breakpoint line display

## 0.7.9.2
* Fix firefox css bug
* Update examples
* Update readme for windows (cygwin) users (thanks tgharib)

## 0.7.9.1
* Collapse simple fields to the parent node in tree explorer
* Add button to re-enter program state when signals are received (i.e. SEGFAULT)

## 0.7.9.0
* Add interactive tree explorer of variables

## 0.7.8.3
* Remove optimization for fetching registers due to potential bug

## 0.7.8.2
* bugfix in logic when jumping to source code line
* bugfix for when variable goes from`empty -> 1 element`
* add CODE OF CONDUCT, CONTRIBUTING, and CHANGELOG files

## 0.7.8.1
* correctly display `<` and `>` in console widget

## 0.7.8.0
* show disassembly when file is unknown or missing
* show new children in expressions widget when they are dynamically added by application (@wuyihao)
* suppress nuisance errors when hover variable or fflush command is not found
* improve logic when source code line should be jumped to
* escape brackets in disassembly, and gracefully hide missing opcodes
* update socketio version for more reliable websocket connection

## 0.7.7.0
* Show variable values when hovering in source code
* gracefully handle hostname not being present in /etc/hosts when running with remote flag
* Use external state management library (`stator.js`) for client ui
