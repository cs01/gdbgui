Thank you for your interest developing `gdbgui`.

## Bug Reports

If you think you have found a bug or aren't sure, create an issue or email grassfedcode@gmail.com.

When filing a bug report please include

* output of `pip freeze`
* operating system and version
* gdbgui version (`gdbgui -v`)
* gdb version (`gdb -v`)
* browser being used

## Development
Documentation, spelling fixes, bug fixes, and features are welcome. To get started with development, set up a new virtual environment, then
run

```
git clone https://github.com/cs01/gdbgui
cd gdbgui
pip install -r requirements.txt
pip install -r dev_requirements.txt
gdbgui/backend.py --debug
```

If you are modifying `gdbgui.js`, make sure you have the developer console open so the browser doesn't cache the file and miss your changes.

The `--debug` flag does two things:
1. adds a new component at the bottom of the right sidebar called "gdb machine interface output" that displays the raw gdb mi output to help you debug.
1. displays all changes to state data in the browser's developer console, such as `rendered_source_file_fullname null  ->  /home/chad/git/gdbgui/examples/hello.c`

## Testing
There are two types of tests: unit tests of the python code, and a test of the README.rst formatting.

```
make test
```
runs unit tests and verifies `README.rst` is properly formatted.

If you have changed any python code, add new tests to `gdbgui/tests/test_app.py` as necessary.
