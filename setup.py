import sys
import io
from setuptools import find_packages, setup, Command


EXCLUDE_FROM_PACKAGES = []

readme = io.open('README.rst', 'r', encoding="utf-8").read()


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
    version='0.7.6.2',
    author='Chad Smith',
    author_email='grassfedcode@gmail.com',
    description=('browser-based gdb frontend using Flask and JavaScript to visually debug C, C++, Go, or Rust'),
    long_description=readme,
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
    cmdclass={'test': TestCommand},
    install_requires=[
        'Flask>=0.12',  # to run server
        'pygdbmi>=0.7.3.3',  # to parse gdb output
        'pypugjs>=4.2.0',  # to use .pug instead of .html
        'Flask-SocketIO>=2.8.3',  # for websockets
        'gevent>=1.2.1',  # for websockets (preferred)
        'eventlet>=0.20.1',  # for websockets (backup to gevent)
        'Pygments>=2.2.0',  # for syntax highlighting
    ],
    classifiers=[
        'Intended Audience :: Developers',
        'Operating System :: OS Independent',
        'Programming Language :: Python',
        'Programming Language :: Python :: 2',
        'Programming Language :: Python :: 2.7',
        'Programming Language :: Python :: 3',
        'Programming Language :: Python :: 3.4',
        'Programming Language :: Python :: 3.5',
        'Topic :: Internet :: WWW/HTTP :: Dynamic Content',
        'Topic :: Software Development :: Libraries :: Python Modules'
    ],
)
