# gdbgui release history

## 0.15.2.0
- Update default python version to 3.12
- utf-8 decode error bugfix
- fix registers cannot be displayed bug

## 0.15.1.0

- Compatibility with Werkzeug 2.1. Use the eventlet server instead of
  the Werkzeug development server.
- Use pinned requirements instead of abstract requirements to ensure reproducability of pip installs

## 0.15.0.1

This release has no changes to features or usability. The only change is to include a file used by other package maintainers.

- Include all files needed to rebuild from source (#403)

## 0.15.0.0

This release is focused mostly on Python 3.9 compatibility and updating dependencies

- Support only Python 3.9 (though other Python versions may still work)
- Build gdbgui as a [pex](https://pypi.org/project/pex/) executable.
  - These are executable Python environments that are self-contained with the exception of requiring a specific Python version installed in the environment running the executable. The pex executables should have better compatibility than PyInstaller executables, which sometimes have missing shared libraries depending on the operating system.
- Use only the threading async model for flask-socketio. No longer support gevent or eventlet.
- [bugfix] Catch exception if gdb used in tty window crashes instead of gdbgui crashing along with it
- Disable pagination in gdb tty by default. It can be turned back on with `set pagination off`.
- Upgrade various dependencies for both the backend and frontend (Python and JavaScript)
- Display gdbgui version in "about" and "session information"

## 0.14.0.2

- Pinned python-socketio version
- Pinned mypy version to unbreak linting
- Fixed reverse debugging commands that were broken when `--gdb` flag was removed

## 0.14.0.1

- Fix import paths
- Pin broken dependency to avoid segfault
- Hide "No registers." message

## 0.14.0.0

**Breaking Changes**

- Removed support for Windows
- Replaced `--gdb` flag with `--gdb-cmd`. The `--gdb-cmd` argument specifies the gdb executable as well as all arguments you wish to pass to gdb at startup, for example `--gdb-cmd "gdb -nx"`. The existing `-g` argument is an alias for `--gdb-cmd`.
- Removed `--rr` flag. Use `--gdb-cmd "rr replay --"` instead.
- Removed deprecated and hidden `--hide-gdbgui-upgrades` argument. It will now raise an error.

**Additional Changes**

- Replaced single terminal on frontend with three terminals: an interactive xterm terminal running gdb, a gdbgui console for diagnostic messages, and a terminal connected to the inferior application being debugged.
- Updates to the dashboard
- Add ability to specify gdb command from the browser. This can now be accomplished from the dashboard.
- Removed gdbgui binaries from source control. They can now be downloaded as artifacts of [releases](https://github.com/cs01/gdbgui/releases).
- [documentation] Fix bug when generating md5 checksum for binary releases
- Remove "shutdown" button in UI

## 0.13.2.1

- No end user changes. This release builds the gdbgui executables with GitHub actions.

## 0.13.2.0

- Print number of times a breakpoint was hit (@MatthiasKreileder).
- Publish sdist to PyPI (this was overlooked in previous release).
- Do not notify users of gdbgui upgrades (deprecate `--hide-gdbgui-upgrades` flag)
- Drop support for Python 3.4
- [dev] Some infrastructure changes to gdbgui. End users should not be affected.
- [dev] Fix build error due to webpack bug (https://github.com/webpack/webpack/issues/8082).

## 0.13.1.2

- Exclude "tests" directory from Python package
- Remove analytics from documentation

## 0.13.1.1

- Add `__main__` entrypoint

## 0.13.1.0

- Remove automatic flushing of stdout and require newer version of pygdbmi
- Add flake8 tests to CI build

## 0.13.0.0

- Add ability to re-map source file paths. Added flags `--remap-sources` and `-m` to replace compile-time source paths to local source paths. i.e. `gdbgui --remap-sources='{"/buildmachine": "/home/chad"}'` (#158)
- Add shift keyboard shortcut to go in reverse when using rr (#201)
- Pass arbitrary gdb arguments directly to gdb: added `--gdb-args` flag
- Removed `-x` CLI option, which caused major version to change. New way to pass is `gdbgui --gdb-args='-x=FILE'` (#205)
- Add "name" to Threads (new gdb 8.1 feature) (@P4Cu)
- Fix crash/black screen from "Python Exception <class NameError> name long is not defined" #212
- Fix bug when debugging filenames with spaces (Fix Cannot create breakpoint: -break-insert: Garbage following <location> #211")
- Fix empty frame causes the ui to crash/black screen #216
- Update npm packages; update react to 16.4
- Update prettier rules
- Update tour text + fix typo in tour (@nkirkby)

## 0.12.0.0

- Add pause button
- Update command line parsing for cmd and --args, change arguments from underscore to hyphen, add option to specify browser (@fritzr)
- Add tour
- Run `set breakpoint pending on` on initial connection
- Allow signal to be sent to arbitrary PIDs
- Fix bug when sending signals in Python2
- Move signal component lower in side pane
- Update Rust documentation
- Make requirements.txt point to setup.py's dependencies

## 0.11.3.1

- Limit maximum Flask version to prevent `Session expired. Please refresh this webpage.` error
- Rename "premium" to "ad-free"
- Do smarter version checking
- Fix bug when trying to view "about"

## 0.11.3.0

- ensure expressions with hex values are parsed and updated appropriately (#182)
- improve command line arguments
- use python logging module

## 0.11.2.1

- Small bugfix for specific platforms when reading version number

## 0.11.2.0

- add option to remove fflush command (#179)
- remove react-treebeard and render filesystem w/ new component

## 0.11.1.1

- Bugfix displaying upgrade text

## 0.11.1.0

- Add csrf and cross origin protection
- Convert backslashes to forward slashes when entering windows binary paths (#167)
- Fix safari ui issue (#164)
- Update text on reload file button, and disable when no file is loaded (#165)
- When disassembly can't be fetched in mode 4, fetch in mode 3 and assume gdb version is 7.6.0 (#166)
- Add copy to clipboard icon for files and variables
- Allow SSL module import to fail and print warning (#170)
- Cleanup menu, add license info, bugfixes, etc. (#169, #136, #163, #172)

## 0.11.0.0

- Replace `--auth` cli option with `--user` and `--password`

## 0.10.3.0

- Added resizer buttons to components on right pane

## 0.10.2.1

- Add link for fix for macOS users
- Update version of React to 16.2
- Remove unused links

## 0.10.2.0

- Add folders view, rearrange layout (@martin-der)
- Add settings cog button
- Add message when sending signal to inferior process (#156)
- Change default theme to monokai, rename 'default' theme to 'light'
- Minor bugfixes

## 0.10.1.0

- Display descriptions of registers
- Do not try to fetch Registers when they cannot be read

## 0.10.0.2

- Add support for rr (--rr flag)
- Add dashboard to connect to/kill existing gdb processes
- Add option to specify SSL key and certificate to enable https
- Add option to connect to process
- Add option to connect to gdbserver
- Add infinite scrolling

## 0.9.4.1

- Remove `pypugjs` dependency

## 0.9.4.0

- Add native Windows support (no longer relies on Cygwin)

## 0.9.3.0

- Only display assembly flavor is assembly is displayed
- Add new output type to console (gdbgui output)
- Add dashboard link and dropdown for gdb server/pid attach
- Handle invalid signal choice better
- Print gdb mi log messages to console
- Remove localStorage keys when they are invalid

## 0.9.2.0

- Add signals component and allow signals to be sent to gdb (issue ##141)
- Fix bug when jumping to line of source file

## 0.9.1.1

- Fix bug when passing arguments to gdb
- Require latest version of pygdbmi for faster parsing of large gdb output

## 0.9.1.0

- Lazily load files (issue #131)
- Update setup.py to build wheels

## 0.9.0.1

- Reupload to fix setup.cfg PyPI bug

## 0.9.0.0

- Compress responses from server (massive bandwidth improvement)
- Add button to toggle assembly flavors (issue #110)
- Parse executable+args with spaces (issue #116)
- Turn modals into components
- Move everything into a single root React component
- Refresh state when clicking "return" button
- Add javascript unit tests

## 0.8.2.0

- Add optional authentication (@nickamon, issue #132)
- Support the `--args` flag (issue #126)
- Ensure code is correct and adheres to recommended Python style when running tests/building (flake8)
- Display source when running `backtrace` (fix regression, #134)

## 0.8.1.0

- Add autocomplete functionality (@bobthekingofegypt, issue #129)
- Rearranged and improved alignment of assembly
- Fixed bug when fetching variable fails
- Plot floating point values instead of casting to int

## 0.8.0.3

- modify component initialization order so that store updates are better sequenced

## 0.8.0.2

- display bracket instead of `&lt;` when exploring gdb variables

## 0.8.0.1

- fix bug when restoring old settings

## 0.8.0.0

- Add ability to change radix of variables (issue #102)
- Add component to send signals to inferior program (issues #31, #90)
- Parse gdb version from arm-non-eabi-gdb (issue #83)
- Rewrite most components to React (issue #17)
- Improve CSS in various components

## 0.7.9.5

- re-fetch registers if name/value count does not match

## 0.7.9.4

- add inputs to resize Tree view
- add menu in top right
- css updates to preserve whitespace in terminal
- add top-level html to wrap body+head elements in gdbgui.pug
- add help file
- add donate page

## 0.7.9.3

- Changes to layout
- Fix character escaping in breakpoint line display

## 0.7.9.2

- Fix firefox css bug
- Update examples
- Update readme for windows (cygwin) users (thanks tgharib)

## 0.7.9.1

- Collapse simple fields to the parent node in tree explorer
- Add button to re-enter program state when signals are received (i.e. SEGFAULT)

## 0.7.9.0

- Add interactive tree explorer of variables

## 0.7.8.3

- Remove optimization for fetching registers due to potential bug

## 0.7.8.2

- bugfix in logic when jumping to source code line
- bugfix for when variable goes from`empty -> 1 element`
- add CODE OF CONDUCT, CONTRIBUTING, and CHANGELOG files

## 0.7.8.1

- correctly display `<` and `>` in console widget

## 0.7.8.0

- show disassembly when file is unknown or missing
- show new children in expressions widget when they are dynamically added by application (@wuyihao)
- suppress nuisance errors when hover variable or fflush command is not found
- improve logic when source code line should be jumped to
- escape brackets in disassembly, and gracefully hide missing opcodes
- update socketio version for more reliable websocket connection

## 0.7.7.0

- Show variable values when hovering in source code
- gracefully handle hostname not being present in /etc/hosts when running with remote flag
- Use external state management library (`stator.js`) for client ui
