## Bug Reports

If you think you have found a bug or aren't sure, create an issue.

## Development
Documentation, spelling fixes, bug fixes, and features are welcome.

### Workflows
It's generally recommended to create an issue before fixing a bug. When your changes are done, I will review the pull request. When everything looks good, I merge+squash. If the change is large enough, I will increment `gdbgui`'s version and deploy it to the [python package index (PyPI)](https://pypi.python.org/pypi).

### Adding features
If you want the feature to be merged into master, [create an issue on github](https://github.com/cs01/gdbgui/issues) to make sure it's something I am interested in adding to `gdbgui` before putting too much work in.

### Development Instructions

#### Step 1: Install python dependencies
To get started with development, set up a new virtual environment, then
run the Flask server with the `debug` flag.

```bash
git clone https://github.com/cs01/gdbgui
cd gdbgui
pip install -r requirements.txt
pip install -r dev_requirements.txt
```


#### Step 2: Run Python server
```bash
gdbgui/backend.py --debug
```

The `--debug` flag:
1. Automatically reloads the server when it detects changes you've made
1. Adds a new component at the bottom of the right sidebar called "gdb machine interface output" that displays the raw gdb mi output to help you debug.
1. Displays all changes to state data in the browser's developer console, such as `rendered_source_file_fullname null  ->  /home/chad/git/gdbgui/examples/hello.c`

#### Step 3: Run Webpack
**The word `webpack` sends a lot of people running, but fear not: you only need to run two commands.**

`webpack` is just a script that runs to bundle up JavaScript/jsx files into a single JavaScript file. It lets your write imports similar to the Python module system but the end result is a single JavaScript file that the browser uses. A map is also generated so that when you debug the big JavaScript file, it looks like the original files you wrote -- this all happens automatically, all you need to do is run the commands below.

These simple commands will get you up and running. Note that `yarn` can be replaced with `npm`:
```bash
yarn install
yarn watch
```

Now every JavaScript source file you change will be noticed by webpack and recompiled into `index.js`. Refresh your browser to see the changes.


#### Step 4: Make sure browser caching is turned off
If you are modifying `gdbgui.js`, make sure you have caching turned off. In Chrome, for example, this is a setting in the developer console.

#### Step 5: Make your changes
Add your super awesome bugfix/feature/whatever

#### Step 6: Run and Add tests

```bash
make test
```
runs Python unit tests and verifies `README.rst` has valid syntax.

If you have changed any python code, add new tests to `gdbgui/tests/test_app.py` as necessary.

There are currently no JavaScript tests, but there should be.

#### Step 7: Update documentation and re-build for production
* Exit the `yarn watch` command, and run `yarn build` so that the `index.js` file is build in "production" mode.
* Commit the code and push
