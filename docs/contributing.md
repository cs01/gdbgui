Thanks for your interest in contributing to gdbgui!

If your change is small, go ahead and submit a pull request. If it is substantial, create a GitHub issue to discuss it before making the change.

## Development Instructions

### Step 1: Install python dependencies

To get started with development, set up a new virtual environment, then
run the Flask server with the `debug` flag.

```bash
git clone https://github.com/cs01/gdbgui
cd gdbgui
python3 -m venv venv
. venv/bin/activate
pip install -e .
pip install -r dev_requirements.txt
```

### Step 2: Run Python server

```bash
python -m gdbgui --debug
```

The `--debug` flag:

1.  Automatically reloads the server when it detects changes you've made
1.  Adds a new component at the bottom of the right sidebar called "gdb machine interface output" that displays the raw gdb mi output to help you debug.
1.  Displays all changes to state data in the browser's developer console, such as `rendered_source_file_fullname null -> /home/chad/git/gdbgui/examples/hello.c`

### Step 3: Run Webpack

gdbgui compiles JavaScript source code into a single .js file.

Note that `yarn` can be replaced with `npm`:

```bash
yarn install
yarn watch
```

Now every JavaScript source file you change will trigger a recompilation. Refresh your browser to see the changes. **Make sure you have caching turned off in your browser. In Chrome, for example, this is a setting in the developer console.**

### Step 5: Make your changes

### Step 6: Run and Add tests

```bash
make test
```

runs gdbgui unit tests.

If you have changed any Python code, add new tests to `gdbgui/tests/test_app.py` as necessary.

There are currently no JavaScript tests.

## Documentation

### Modifying Documentation
Documentation is made with `mkdocs`. Create and activate a virtual environment then run
```
pip install -e .[dev]
mkdocs serve
```
Then make changes to `mkdocs.yml` or md files in the `docs` directory.

### Publishing Documentation
The generated documentation is published to the `gh-pages` branch.
```
mkdocs gh-deploy
```

## Publishing a New Version to PyPI

Each time a new version of gdbgui is created, a package needs to be published to PyPI and executables need to be built.

From the root of gdbgui, run:

```
make publish
```

Make sure the version number is incremented in VERSION.txt and in applicable READMEs.

### Building Binary Executables

To build Ubuntu and Windows executables, run from any operating system:

```
make docker_executables
```

To build macOS executable, run the following on a mac:

```
make executable
```

Ensure the files are places in the correct `downloads` directory, the commit and push (TODO: automate this).
