## Bug Reports

If you think you have found a bug or aren't sure, create an issue.

When filing a bug report please include

* output of `pip freeze`
* operating system and version
* gdbgui version (`gdbgui -v`)
* gdb version (`gdb -v`)
* browser being used

## Development
Documentation, spelling fixes, bug fixes, and features are welcome.

### Workflows
It's generally recommended to create an issue before fixing a bug. When your changes are done, I will review the pull request. When everything looks good, I merge+squash. If the change is large enough, I will increment `gdbgui`'s version and deploy it to the [python package index (pyPI)](https://pypi.python.org/pypi).

### Adding features
If you want the feature to be merged into master, [create an issue on github](https://github.com/cs01/gdbgui/issues) to make sure it's something I am interested in adding to `gdbgui` before putting too much work in.

### Instructions
To get started with development, set up a new virtual environment, then
run the Flask server with the `debug` flag.
```
git clone https://github.com/cs01/gdbgui

cd gdbgui
pip install -r requirements.txt
pip install -r dev_requirements.txt
gdbgui/backend.py --debug
```

In another terminal, have `webpack` watch source JavaScript files for changes by running `yarn watch`:
```
yarn install
yarn watch
[yarn](https://yarnpkg.com/lang/en/docs/install/) must be installed.```


The `--debug` flag does two things:
1. adds a new component at the bottom of the right sidebar called "gdb machine interface output" that displays the raw gdb mi output to help you debug.
1. displays all changes to state data in the browser's developer console, such as `rendered_source_file_fullname null  ->  /home/chad/git/gdbgui/examples/hello.c`

Note:
* If you are modifying `gdbgui.js`, make sure you have the developer console open so the browser doesn't cache the file and miss your changes.
* Update the `dev` section in `CHANGELOG.md` for release notes. It will be moved to the appropriate version during the next release.


### Testing
There are two types of tests: unit tests of the python code, and a test of the `README.rst` formatting.

```
make test
```
runs unit tests and verifies `README.rst` is properly formatted.

If you have changed any python code, add new tests to `gdbgui/tests/test_app.py` as necessary.
