#!/usr/bin/env python
# -*- coding: utf-8 -*-

# Note: To use the 'upload' functionality of this file, you must:
#  pip install twine

import io
import os
import sys
from shutil import rmtree
from setuptools import find_packages, setup, Command

CURDIR = os.path.abspath(os.path.dirname(__file__))

EXCLUDE_FROM_PACKAGES = []
REQUIRED = [
    'Flask>=0.12.2',  # to run server
    'pygdbmi>=0.7.4.4',  # to parse gdb output
    'pypugjs>=4.2.2',  # to use .pug instead of .html
    'Flask-SocketIO>=2.9.2',  # for websockets
    'gevent>=1.2.2',  # for websockets (preferred)
    'eventlet>=0.21.0',  # for websockets (backup to gevent)
    'Pygments>=2.2.0',  # for syntax highlighting
    'Flask-Compress>=1.4.0',  # to compress flask responses
]

README = io.open(os.path.join(CURDIR, 'README.rst'), 'r', encoding="utf-8").read()
VERSION = io.open(os.path.join(CURDIR, 'gdbgui/VERSION.txt'), 'r', encoding="utf-8").read().strip()


class TestCommand (Command):
    description = 'test task'
    user_options = []

    def initialize_options(self):
        pass

    def finalize_options(self):
        pass

    def run(self):
        # import here so dependency error on Flask is not
        # raised
        from gdbgui.tests import test_app
        sys.exit(test_app.main())


class UploadCommand(Command):
    """Support setup.py upload."""

    description = 'Build and publish the package.'
    user_options = []

    @staticmethod
    def status(s):
        """Prints things in bold."""
        print('\033[1m{0}\033[0m'.format(s))

    def initialize_options(self):
        pass

    def finalize_options(self):
        pass

    def run(self):
        try:
            self.status('Removing previous builds…')
            rmtree(os.path.join(CURDIR, 'dist'))
        except OSError:
            pass

        self.status('Building Source and Wheel (universal) distribution…')
        os.system('{0} setup.py sdist bdist_wheel --universal'.format(sys.executable))

        self.status('Uploading the package to PyPi via Twine…')
        os.system('twine upload dist/*')

        sys.exit()


setup(
    name='gdbgui',
    version=VERSION,
    author='Chad Smith',
    author_email='grassfedcode@gmail.com',
    description='browser-based gdb frontend using Flask and JavaScript to visually debug C, C++, Go, or Rust',
    long_description=README,
    url='https://github.com/cs01/gdbgui',
    license='License :: GNU GPLv3',
    packages=find_packages(exclude=EXCLUDE_FROM_PACKAGES),
    include_package_data=True,
    keywords=['gdb', 'debug', 'c', 'c++', 'go', 'rust', 'python', 'machine-interface', 'parse', 'frontend', 'flask', 'browser', 'gui'],
    scripts=[],
    entry_points={
        'console_scripts': [
            # allow user to type gdbgui from terminal to automatically launch the server and a tab in a browser
            'gdbgui = gdbgui.backend:main'
        ],
    },
    extras_require={},
    zip_safe=False,
    cmdclass={
        'test': TestCommand,
        'upload': UploadCommand
    },
    install_requires=REQUIRED,
    classifiers=[
        'Intended Audience :: Developers',
        'Operating System :: OS Independent',
        'License :: OSI Approved :: GNU General Public License v3 (GPLv3)',
        'Programming Language :: Python',
        'Programming Language :: Python :: 2',
        'Programming Language :: Python :: 2.7',
        'Programming Language :: Python :: 3',
        'Programming Language :: Python :: 3.4',
        'Programming Language :: Python :: 3.5',
        'Programming Language :: Python :: 3.6',
        'Programming Language :: Python :: Implementation :: PyPy'
    ],
)
