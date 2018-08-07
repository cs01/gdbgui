#!/usr/bin/env python
# -*- coding: utf-8 -*-

# Note: To use the 'upload' functionality of this file, you must:
#  pip install twine

import io
import os
import sys
from setuptools import find_packages, setup, Command

CURDIR = os.path.abspath(os.path.dirname(__file__))

EXCLUDE_FROM_PACKAGES = []
REQUIRED = [
    "Flask>=0.12.2, <1.0",  # http server
    "Flask-Compress>=1.4.0, <2.0",  # to compress flask responses
    "Flask-SocketIO>=2.9, <3.0",  # websocket server
    "gevent>=1.2.2, <2.0",  # websocket handling
    "pygdbmi>=0.8.2.0, <0.9",  # parse gdb output
    "Pygments>=2.2.0, <3.0",  # syntax highlighting
]

README = io.open(os.path.join(CURDIR, "README.md"), "r", encoding="utf-8").read()
VERSION = (
    io.open(os.path.join(CURDIR, "gdbgui/VERSION.txt"), "r", encoding="utf-8")
    .read()
    .strip()
)


class TestCommand(Command):
    description = "test task"
    user_options = []

    def initialize_options(self):
        pass

    def finalize_options(self):
        pass

    def run(self):
        # import here so dependency error on Flask is not
        # raised
        from tests import test_app

        sys.exit(test_app.main())


setup(
    name="gdbgui",
    version=VERSION,
    author="Chad Smith",
    author_email="grassfedcode@gmail.com",
    description="Browser-based frontend to gdb. Debug C, C++, Go, or Rust.",
    long_description=README,
    long_description_content_type="text/markdown",
    url="https://github.com/cs01/gdbgui",
    license="License :: GNU GPLv3",
    packages=find_packages(exclude=EXCLUDE_FROM_PACKAGES),
    include_package_data=True,
    keywords=[
        "gdb",
        "debug",
        "c",
        "c++",
        "go",
        "rust",
        "python",
        "machine-interface",
        "parse",
        "frontend",
        "flask",
        "browser",
        "gui",
    ],
    scripts=[],
    entry_points={
        "console_scripts": [
            # allow user to type gdbgui from terminal to automatically launch
            # the server and a tab in a browser
            "gdbgui = gdbgui.backend:main"
        ]
    },
    extras_require={},
    zip_safe=False,
    cmdclass={"test": TestCommand},
    install_requires=REQUIRED,
    classifiers=[
        "Intended Audience :: Developers",
        "Operating System :: OS Independent",
        "License :: OSI Approved :: GNU General Public License v3 (GPLv3)",
        "Programming Language :: Python",
        "Programming Language :: Python :: 2",
        "Programming Language :: Python :: 2.7",
        "Programming Language :: Python :: 3",
        "Programming Language :: Python :: 3.4",
        "Programming Language :: Python :: 3.5",
        "Programming Language :: Python :: 3.6",
        "Programming Language :: Python :: Implementation :: PyPy",
    ],
)
