Thanks for your interest in contributing to gdbgui!

If your change is small, go ahead and submit a pull request. If it is substantial, create a GitHub issue to discuss it before making the change.

## Development Instructions

gdbgui uses [nox](https://github.com/theacodes/nox) to automate various tasks. You will need it installed on your system before continuing.

You can install it with pipx (recommended):
```
> pipx install nox
```
or pip:
```
> pip install --user nox
```

### Step 1: Compile JavaScript Code

gdbgui compiles JavaScript source code into a single .js file.

Note that `yarn` can be replaced with `npm`:

First install JavaScript dependencies:
```bash
yarn install
```

To watch JavaScript files for changes and build non-optimized code for each change, use
```
yarn start
```

This is useful for iterating on changes.

To build once for production-optimized code, you can run
```
yarn build
```

### Step 2: Run Server

```bash
git clone https://github.com/cs01/gdbgui
cd gdbgui
nox -s develop-3.7  # replace with desired Python version
source .nox/develop-3-7/bin/activate  # replace with desired Python version
```

You are now in a virtual environment with gdbgui's dependencies installed. When finished, type `deactivate` to leave the virtual environment.

```bash
python -m gdbgui --debug
```

The `--debug` flag:

1.  Automatically reloads the server when it detects changes you've made
1.  Adds a new component at the bottom of the right sidebar called "gdb machine interface output" that displays the raw gdb mi output to help you debug.
1.  Displays all changes to state data in the browser's developer console, such as `rendered_source_file_fullname null -> /home/chad/git/gdbgui/examples/hello.c`


### Step 3: Make your changes

Open the browser to view gdbgui. Refresh the page as you make changes to JavaScript code.

!!! Note

    Make sure you have caching turned off in your browser. In Chrome, for example, this is a setting in the developer console.

### Step 4: Run and Add tests

To continue, you must have nox installed.

```bash
nox
```

runs gdbgui unit tests.

If you have changed any Python code, add new tests to `gdbgui/tests/test_app.py` as necessary.

JavaScript tests are minimal, so you will have to manually excercise any code paths that may be affected.

## Documentation

### Modifying Documentation
Documentation is made with `mkdocs`. Then make changes to `mkdocs.yml` or md files in the `docs` directory.

To build docs, run
```
nox -s docs
```

To see a live preview of current documentation, run
```
nox -s watch_docs
```

### Publishing Documentation
The generated documentation is published to the `gh-pages` branch.
```
nox -s publish_docs
```

### Building Binary Executables

These are automatically built on CI, but can be built locally with corresponding `nox` commands, such as:

```
nox -s build_executable_current_platform
```

## Publishing a New Version
1. Make sure the version number is incremented in `VERSION.txt`.
1. The version to release must be on the master branch and have all CI tests pass and new binary executable artifacts attached to the GitHub action results
1. Publish the package to PyPI and update documentation. Both are done with this `nox -s publish`.
1. Create a "release" in GitHub and attach the gdbgui binary executable artifacts to it.

