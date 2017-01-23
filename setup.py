from setuptools import find_packages, setup, Command
import sys

EXCLUDE_FROM_PACKAGES = []
version = '0.7'


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
    author_email='chadsmith27@gmail.com',
    description=('browser-based gdb frontend using Flask and JavaScript to visually debug C, C++, Go, or Rust'),
    url='https://github.com/cs01/gdbgui',
    license='BSD',
    packages=find_packages(exclude=EXCLUDE_FROM_PACKAGES),
    include_package_data=True,
    keywords=['gdb', 'python', 'machine-interface', 'parse', 'frontend', 'flask', 'browser', 'gui', 'c', 'c++', 'go', 'rust'],
    scripts=[],
    entry_points={
        'console_scripts': [
            'gdbgui = gdbgui.backend:main'
        ],
    },
    extras_require={},
    zip_safe=False,
    cmdclass={'test': TestCommand},
    install_requires=[
        'Flask>=0.11.1',
        'pygdbmi>=0.7',
        'pyjade>=4.0.0',
        'Flask-SocketIO>=2.8.2',  # for websockets
        'eventlet>=0.20.1',  # for websockets
    ],
    classifiers=[
        'Intended Audience :: Developers',
        'License :: OSI Approved :: BSD License',
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
