<p align="center">
<a href="http://gdbgui.com"><img src="https://github.com/cs01/gdbgui/raw/master/images/gdbgui_banner.png"></a>
</p>

<h2 align="center">
A modern, browser-based frontend to gdb (gnu debugger)
</h2>

<p align="center">
<a href="https://github.com/cs01/gdbgui/raw/master/screenshots/gdbgui_animation.gif">
<img src="https://github.com/cs01/gdbgui/raw/master/screenshots/gdbgui_animation.gif">
</a>

</p>

<p align="center">
<a href="https://travis-ci.org/cs01/gdbgui">
<img src="https://travis-ci.org/cs01/gdbgui.svg?branch=master" alt="image" /></a>

<a href="https://pypi.python.org/pypi/gdbgui/">
<img src="https://img.shields.io/badge/pypi-0.13.1.1-blue.svg" alt="image" />
</a>

[![Downloads](https://pepy.tech/badge/gdbgui)](https://pepy.tech/project/gdbgui)
</p>


Add breakpoints, view stack traces, and more in C, C++, Go, and Rust! Perfect for beginners and experts. Simply run `gdbgui` from the terminal and a new tab will open in your browser.


## [gdbgui.com](https://gdbgui.com)
Visit [gdbgui.com](https://gdbgui.com) for documentation, screenshots, and downloads


## Try Without Installing
By using [pipx](https://github.com/cs01/pipx), you can run Python CLI programs in ephemeral one-time virtual environments.
```
pipx gdbgui
```
A new tab running the latest version of gdbgui will open in your browser. Press CTRL+C to end the process, and your system will remain untouched.

You can install pipx like this:
```
curl https://raw.githubusercontent.com/cs01/pipx/master/get-pipx.py | python3
```

## Install
### Global
This option relies on [pipx](https://github.com/cs01/pipx), the Python CLI binary runner and installer. It installs Python CLI programs in isolated virtual environments. `pipx` can run any Python CLI program, including gdbgui. This is the recommended installation method.
```
pipx install gdbgui
```
Then type `gdbgui` at the command prompt.

To upgrade, run
```
pipx upgrade gdbgui
```

### In a Virtual Environment
Alternatively, if you have already activated a virtual environment, you can install gdbgui with pip.
```
pip install gdbgui
```
Then type `gdbgui`.

### Download a binary executable for your platform
or a binary executable can be downloaded from [gdbgui.com](https://gdbgui.com).

## License
GNU GPLv3, which means you can use it for free at work or for personal use.

gdbgui is distributed through [gdbgui.com](https://gdbgui.com), [https://github.com/cs01/gdbgui](https://github.com/cs01/gdbgui), and [PyPI](https://pypi.python.org/pypi/gdbgui/).

## FAQ
[click here](https://github.com/cs01/gdbgui/blob/master/docs/FAQ.md)

## Donate
[Paypal](https://www.paypal.me/grassfedcode/20)

## Contributing
To add a feature or fix a bug, see [CONTRIBUTING](https://github.com/cs01/gdbgui/blob/master/CONTRIBUTING.md).

## Authors
`gdbgui` is primarily authored by Chad Smith, with [help from the community](https://github.com/cs01/gdbgui/graphs/contributors). Large contributions were made by @bobthekingofegypt, who added initial autocomplete functionality for the gdb terminal.

## Contact
grassfedcode@gmail.com
