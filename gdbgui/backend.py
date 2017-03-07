#!/usr/bin/env python

"""
A Flask server that manages a gdb subprocess, and
returns structured gdb output to the client

Examples:

gdbgui
gdbgui /path/to/program
gdbgui /path/to/program -arg myarg -myflag

"""

import os
import argparse
import signal
import webbrowser
import datetime
import json
import sys
import platform
import pygdbmi
import re
from distutils.spawn import find_executable
from gdbgui import __version__
from flask import Flask, request, render_template, jsonify
from flask_socketio import SocketIO, emit
from pygdbmi.gdbcontroller import GdbController

BASE_PATH = os.path.dirname(os.path.realpath(__file__))
TEMPLATE_DIR = os.path.join(BASE_PATH, 'templates')
STATIC_DIR = os.path.join(BASE_PATH, 'static')
DEFAULT_HOST = '127.0.0.1'
DEFAULT_PORT = 5000
IS_A_TTY = sys.stdout.isatty()
DEFAULT_GDB_EXECUTABLE = 'gdb'
DEFAULT_GDB_ARGS = ['-nx', '--interpreter=mi2']
DEFAULT_LLDB_ARGS = ['--interpreter=mi2']
LLDB_SERVER_PATH = 'lldb-server'  # this is required by lldb-mi

match = re.match('darwin-(\d+)\..*', platform.platform().lower())
if match is None:
    STARTUP_WITH_SHELL_OFF = False
elif int(match.groups()[0]) >= 16:
    # if mac OS version is 16 (sierra) or higher, need to set shell off due to
    # os's security requirements
    STARTUP_WITH_SHELL_OFF = True


INITIAL_BINARY_AND_ARGS = []  # global
GDB_PATH = DEFAULT_GDB_EXECUTABLE  # global
SHOW_GDBGUI_UPGRADES = True

app = Flask(__name__, template_folder=TEMPLATE_DIR, static_folder=STATIC_DIR)
# switch to gevent once https://github.com/miguelgrinberg/Flask-SocketIO/issues/413 is resolved
socketio = SocketIO(async_mode='eventlet')
_gdb = {}  # each key is websocket client id (each tab in browser gets its own id), and value is pygdbmi.GdbController instance
_gdb_reader_thread = None  # T


def setup_backend(serve=True, host=DEFAULT_HOST, port=DEFAULT_PORT, debug=False, open_browser=True, testing=False, LLDB=False):
    """Run the server of the gdb gui"""
    if LLDB is True and find_executable(LLDB_SERVER_PATH) is None:
        pygdbmi.printcolor.print_red('lldb-mi is being used, but the executable "%s" was not found. It is required by lldb-mi.' % LLDB_SERVER_PATH)
        sys.exit(1)

    url = '%s:%s' % (host, port)
    url_with_prefix = 'http://' + url

    # templates are written in pug, so add that capability to flask
    app.jinja_env.add_extension('pypugjs.ext.jinja.PyPugJSExtension')
    app.config['TEMPLATES_AUTO_RELOAD'] = True
    app.config['LLDB'] = LLDB
    socketio.init_app(app)

    if open_browser is True and debug is False and testing is False:
        text = 'Opening gdbgui in browser (%s)' % (url_with_prefix)
        print(colorize(text))
        webbrowser.open(url_with_prefix)

    if testing is False:
        print('Serving at %s' % url_with_prefix)
        socketio.run(app, debug=debug, port=int(port), host=host, extra_files=get_extra_files())


def verify_gdb_exists():
    if find_executable(GDB_PATH) is None:
        pygdbmi.printcolor.print_red('gdb executable "%s" was not found. Is gdb installed? try "sudo apt-get install gdb"' % GDB_PATH)
        sys.exit(1)
    elif 'lldb' in GDB_PATH.lower() and 'lldb-mi' not in GDB_PATH.lower():
        pygdbmi.printcolor.print_red('gdbgui cannot use the standard lldb executable. You must use an executable with "lldb-mi" in its name.')
        sys.exit(1)


def dbprint(*args):
    """print only if app.debug is truthy"""
    if app and app.debug:
        CYELLOW2 = '\33[93m'
        NORMAL = '\033[0m'
        print(CYELLOW2 + 'DEBUG: ' + ' '.join(args) + NORMAL)


def colorize(text):
    if IS_A_TTY:
        return '\x1b[6;30;42m' + text + '\x1b[0m'
    else:
        return text


@socketio.on('connect', namespace='/gdb_listener')
def client_connected():
    global _gdb_reader_thread
    global _gdb

    dbprint('Client websocket connected in async mode "%s", id %s' % (socketio.async_mode, request.sid))

    # give each client their own gdb instance
    if request.sid not in _gdb.keys():
        dbprint('new sid', request.sid)
        if app.config['LLDB'] is True:
            gdb_args = DEFAULT_LLDB_ARGS
        else:
            gdb_args = DEFAULT_GDB_ARGS

        if STARTUP_WITH_SHELL_OFF:
            # macOS Sierra (and later) may have issues with gdb. This should fix it, but there might be other issues
            # as well. Please create an issue if you encounter one since I do not own a mac.
            # http://stackoverflow.com/questions/39702871/gdb-kind-of-doesnt-work-on-macos-sierra
            gdb_args.append('--init-eval-command=set startup-with-shell off')

        _gdb[request.sid] = GdbController(gdb_path=GDB_PATH, gdb_args=gdb_args)

    # tell the client browser tab which gdb pid is a dedicated to it
    emit('gdb_pid', _gdb[request.sid].gdb_process.pid)

    # Make sure there is a reader thread reading. One thread reads all instances.
    if _gdb_reader_thread is None:
        _gdb_reader_thread = socketio.start_background_task(target=read_and_forward_gdb_output)
        dbprint('Created background thread to read gdb responses')


@socketio.on('run_gdb_command', namespace='/gdb_listener')
def run_gdb_command(message):
    """
    Endpoint for a websocket route.
    Runs a gdb command.
    Responds only if an error occurs when trying to write the command to
    gdb
    """
    if _gdb.get(request.sid) is not None:
        try:
            # the command (string) or commands (list) to run
            cmd = message['cmd']
            _gdb.get(request.sid).write(cmd, read_response=False)

        except Exception as e:
            emit('error_running_gdb_command', {'message': str(e)})
    else:
        emit('error_running_gdb_command', {'message': 'gdb is not running'})


@socketio.on('disconnect', namespace='/gdb_listener')
def client_disconnected():
    """if client disconnects, kill the gdb process connected to the browser tab"""
    dbprint('Client websocket disconnected, id %s' % (request.sid))
    if request.sid in _gdb.keys():
        dbprint('Exiting gdb subprocess pid %s' % _gdb[request.sid].gdb_process.pid)
        _gdb[request.sid].exit()
        _gdb.pop(request.sid)


@socketio.on('Client disconnected')
def test_disconnect():
    print('Client websocket disconnected', request.sid)


def read_and_forward_gdb_output():
    """A task that runs on a different thread, and emits websocket messages
    of gdb responses"""

    while True:
        socketio.sleep(0.05)
        for client_id, gdb in _gdb.items():
            try:
                if gdb is not None:
                    response = gdb.get_gdb_response(timeout_sec=0, raise_error_on_timeout=False)
                    if response:
                        dbprint('emiting message to websocket client id ' + client_id)
                        socketio.emit('gdb_response', response, namespace='/gdb_listener', room=client_id)
                    else:
                        # there was no queued response from gdb, not a problem
                        pass
                else:
                    # gdb process was likely killed by user. Stop trying to read from it
                    dbprint('thread to read gdb vars is exiting since gdb controller object was not found')
                    break

            except Exception as e:
                dbprint(e)


def server_error(obj):
    return jsonify(obj), 500


def client_error(obj):
    return jsonify(obj), 400


def get_extra_files():
    """returns a list of files that should be watched by the Flask server
    when in debug mode to trigger a reload of the server
    """
    THIS_DIR = os.path.dirname(os.path.abspath(__file__))
    extra_dirs = [THIS_DIR]
    extra_files = []
    for extra_dir in extra_dirs:
        for dirname, dirs, files in os.walk(extra_dir):
            for filename in files:
                filename = os.path.join(dirname, filename)
                if os.path.isfile(filename) and filename not in extra_files:
                    extra_files.append(filename)
    return extra_files


@app.route('/')
def gdbgui():
    """Render the main gdbgui interface"""
    if app.debug:
        # do not give unique timestamp to files because it wipes out
        # breakpoints in chrome's debugger
        time_sec = 0
    else:
        time_sec = int((datetime.datetime.utcnow() - datetime.datetime(1970, 1, 1)).total_seconds())
    interpreter = 'lldb' if app.config['LLDB'] else 'gdb'
    initial_data = {
            'gdbgui_version': __version__,
            'interpreter': interpreter,
            'initial_binary_and_args': INITIAL_BINARY_AND_ARGS,
            'show_gdbgui_upgrades': SHOW_GDBGUI_UPGRADES,
        }

    return render_template('gdbgui.pug',
        timetag_to_prevent_caching=time_sec,
        debug=json.dumps(app.debug),
        interpreter=interpreter,
        initial_data=json.dumps(initial_data))


@app.route('/shutdown')
def shutdown_webview():
    """Render the main gdbgui interface"""
    return render_template('shutdown.pug', timetag_to_prevent_caching=0)


@app.route('/_shutdown')
def _shutdown():
    pid = os.getpid()

    if app.debug:
        os.kill(pid, signal.SIGINT)
    else:
        socketio.stop()

    dbprint('received user request to shut down gdbgui')


@app.route('/get_last_modified_unix_sec')
def get_last_modified_unix_sec():
    """Get last modified unix time for a given file"""
    path = request.args.get('path')
    if path and os.path.isfile(path):
        try:
            last_modified = os.path.getmtime(path)
            return jsonify({'path': path,
                            'last_modified_unix_sec': last_modified})
        except Exception as e:
            return client_error({'message': '%s' % e, 'path': path})

    else:
        return client_error({'message': 'File not found: %s' % path, 'path': path})


@app.route('/read_file')
def read_file():
    """Read a file and return its contents as an array"""
    path = request.args.get('path')
    if path and os.path.isfile(path):
        try:
            last_modified = os.path.getmtime(path)
            with open(path, 'r') as f:
                return jsonify({'source_code': f.read().splitlines(),
                                'path': path,
                                'last_modified_unix_sec': last_modified})
        except Exception as e:
            return client_error({'message': '%s' % e})

    else:
        return client_error({'message': 'File not found: %s' % path})


def main():
    """Entry point from command line"""
    global INITIAL_BINARY_AND_ARGS
    global GDB_PATH
    global SHOW_GDBGUI_UPGRADES
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("cmd", nargs='*', help='(Optional) The binary and arguments to run in gdb. This is a way to script the intial loading of the inferior'
        " binary  you wish to debug. For example gdbgui './mybinary myarg -flag1 -flag2'", default=INITIAL_BINARY_AND_ARGS)

    parser.add_argument('-p', "--port", help='The port on which gdbgui will be hosted. Defaults to %s' % DEFAULT_PORT, default=DEFAULT_PORT)
    parser.add_argument('--host', help='The host ip address on which gdbgui serve. Defaults to %s' % DEFAULT_HOST, default=DEFAULT_HOST)
    parser.add_argument('-g', '--gdb', help='Path to gdb or lldb executable. Defaults to %s. lldb support is experimental.' % DEFAULT_GDB_EXECUTABLE, default=DEFAULT_GDB_EXECUTABLE)
    parser.add_argument('--lldb', help='Use lldb commands (experimental)', action='store_true')
    parser.add_argument('-v', '--version', help='Print version', action='store_true')
    parser.add_argument('--hide_gdbgui_upgrades', help='Hide messages regarding newer version of gdbgui. Defaults to False.', action='store_true')
    parser.add_argument('--debug', help='The debug flag of this Flask application. '
        'Pass this flag when debugging gdbgui itself to automatically reload the server when changes are detected', action='store_true')
    parser.add_argument('-n', '--no_browser', help='By default, the browser will open with gdb gui. Pass this flag so the browser does not open.', action='store_true')
    args = parser.parse_args()

    if args.version:
        print(__version__)
        return

    INITIAL_BINARY_AND_ARGS = ' '.join(args.cmd)
    GDB_PATH = args.gdb
    SHOW_GDBGUI_UPGRADES = not args.hide_gdbgui_upgrades
    verify_gdb_exists()
    setup_backend(serve=True, host=args.host, port=int(args.port), debug=bool(args.debug), open_browser=(not args.no_browser), LLDB=(args.lldb or 'lldb-mi' in args.gdb.lower()))


if __name__ == '__main__':
    main()
