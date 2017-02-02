import sys
import re
from setuptools import find_packages, setup, Command


EXCLUDE_FROM_PACKAGES = []

readme = open('README.rst', 'r').read()

with open('gdbgui/__init__.py', 'r') as fd:
    version = re.search(r'^__version__\s*=\s*[\'"]([^\'"]*)[\'"]',
                        fd.read(), re.MULTILINE).group(1)


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


setup(
    name='gdbgui',
    version=version,
    author='Chad Smith',
    author_email='grassfedcode@gmail.com',
    description=('browser-based gdb frontend using Flask and JavaScript to visually debug C, C++, Go, or Rust'),
    long_description=readme,
    url='https://github.com/cs01/gdbgui',
    license='License :: Free for non-commercial use',
    packages=find_packages(exclude=EXCLUDE_FROM_PACKAGES),
    include_package_data=True,
    keywords=['gdb', 'debug', 'c', 'c++', 'go', 'rust', 'python', 'machine-interface', 'parse', 'frontend', 'flask', 'browser', 'gui'],
    scripts=[],
    entry_points={
        'console_scripts': [
            # run gdbgui from terminal and automatically launch the server and a tab in a browser
            'gdbgui = gdbgui.backend:main'
        ],
    },
    extras_require={},
    zip_safe=False,
    cmdclass={'test': TestCommand},
    install_requires=[
        'Flask>=0.11.1',
        'pygdbmi>=0.7.2.0',
        'pyjade>=4.0.0',
        'Flask-SocketIO>=2.8.2',  # for websockets
        'eventlet>=0.20.1',  # for websockets
    ],
    classifiers=[
        'Intended Audience :: Developers',
        'Operating System :: OS Independent',
        'Programming Language :: Python',
        'Programming Language :: Python :: 2',
        'Programming Language :: Python :: 2.7',
        'Programming Language :: Python :: 3',
        'Programming Language :: Python :: 3.3',
        'Programming Language :: Python :: 3.4',
        'Programming Language :: Python :: 3.5',
        'Topic :: Internet :: WWW/HTTP :: Dynamic Content',
        'Topic :: Software Development :: Libraries :: Python Modules'
    ],
)
