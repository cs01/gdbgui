#!/usr/bin/env python

import io
import os
from setuptools import find_packages, setup  # type: ignore

CURDIR = os.path.abspath(os.path.dirname(__file__))

EXCLUDE_FROM_PACKAGES = ["tests"]
REQUIREMENTS = io.open(os.path.join(CURDIR, "requirements.txt"), "r", encoding="utf-8").readlines()
README = io.open(os.path.join(CURDIR, "README.md"), "r", encoding="utf-8").read()
VERSION = (
    io.open(os.path.join(CURDIR, "gdbgui/VERSION.txt"), "r", encoding="utf-8")
    .read()
    .strip()
)

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
    zip_safe=False,
    install_requires=REQUIREMENTS,
    classifiers=[
        "Intended Audience :: Developers",
        "Operating System :: OS Independent",
        "License :: OSI Approved :: GNU General Public License v3 (GPLv3)",
        "Programming Language :: Python",
        "Programming Language :: Python :: 3",
        "Programming Language :: Python :: 3.6",
        "Programming Language :: Python :: 3.7",
        "Programming Language :: Python :: 3.8",
    ],
    python_requires=">=3.6",
    project_urls={
        "Documentation": "https://cs01.github.io/gdbgui/",
        "Source Code": "https://github.com/cs01/gdbgui",
        "Bug Tracker": "https://github.com/cs01/gdbgui/issues",
    },
)
