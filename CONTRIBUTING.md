Thanks for your interest in contributing to gdbgui!

If your change is small, go ahead and submit a pull request. If it is substantial, create a GitHub issue to discuss it before making the change.

## Dependencies

1.) [nox](https://github.com/theacodes/nox) is used to automate various tasks. You will need it installed on your system before continuing.

You can install it with pipx (recommended):
```
> pipx install nox
```
or pip:
```
> pip install --user nox
```

2.) [yarn](https://yarnpkg.com/) is used for managing JavaScript files

## Developing
Development can be done with one simple step:
```
> nox -s develop
```
This will install all Python and JavaScript dependencies, and build and watch Python and JavaScript files for changes, automatically reloading as things are changed.

Make sure you [turn your cache off](https://www.technipages.com/google-chrome-how-to-completely-disable-cache) so that changes made locally are reflected in the page.

## Running and Adding tests
```bash
> nox
```

runs all applicable tests and linting.

Python tests are in `gdbgui/tests`. They are run as part of the above command, but can be run with
```
> nox -s python_tests
```

JavaScript tests are in `gdbgui/src/js/tests`. They are run as part of the above command, but can be run with
```
> nox -s js_tests
```

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
nox -s build_executables_current_platform
```

## Publishing a New Version
1. Make sure the version number is incremented in `VERSION.txt`.
1. The version to release must be on the master branch and have all CI tests pass and new binary executable artifacts attached to the GitHub action results
1. Publish the package to PyPI and update documentation. Both are done with this `nox -s publish`.
1. Create a "release" in GitHub and attach the gdbgui binary executable artifacts to it.

