#!/usr/bin/env python

"""
A Flask server that manages a gdb subprocess, and
returns structured gdb output to the client

Examples:

gdbgui
gdbgui "/path/to/program"
gdbgui "/path/to/program -arg myarg -myflag"
gdbgui --help

"""

import os
import argparse
import signal
import webbrowser
import traceback
import json
import sys
import platform
import pygdbmi
import socket
import re
from pygments.lexers import get_lexer_for_filename
from distutils.spawn import find_executable
from flask import Flask, request, render_template, jsonify, redirect
from flask_socketio import SocketIO, emit
from pygdbmi.gdbcontroller import GdbController
BASE_PATH = os.path.dirname(os.path.realpath(__file__))
PARENTDIR = os.path.dirname(BASE_PATH)
sys.path.append(PARENTDIR)
from gdbgui import htmllistformatter  # noqa
from gdbgui import __version__  # noqa

TEMPLATE_DIR = os.path.join(BASE_PATH, 'templates')
STATIC_DIR = os.path.join(BASE_PATH, 'static')
DEFAULT_HOST = '127.0.0.1'
DEFAULT_PORT = 5000
IS_A_TTY = sys.stdout.isatty()
DEFAULT_GDB_EXECUTABLE = 'gdb'
DEFAULT_GDB_ARGS = ['-nx', '--interpreter=mi2']
DEFAULT_LLDB_ARGS = ['--interpreter=mi2']

STARTUP_WITH_SHELL_OFF = False
match = re.match('darwin-(\d+)\..*', platform.platform().lower())
if match is not None and int(match.groups()[0]) >= 16:
    # if mac OS version is 16 (sierra) or higher, need to set shell off due to
    # os's security requirements
    STARTUP_WITH_SHELL_OFF = True


# create dictionary of signal names
SIGNAL_NAME_TO_NUM = {}
for n in dir(signal):
    if n.startswith('SIG') and '_' not in n:
        SIGNAL_NAME_TO_NUM[n.upper()] = getattr(signal, n)

# Create flask application and add some configuration keys to be used in various callbacks
app = Flask(__name__, template_folder=TEMPLATE_DIR, static_folder=STATIC_DIR)
# templates are written in pug, so add that capability to flask
app.jinja_env.add_extension('pypugjs.ext.jinja.PyPugJSExtension')
app.config['initial_binary_and_args'] = []
app.config['gdb_path'] = DEFAULT_GDB_EXECUTABLE
app.config['gdb_cmd_file'] = None
app.config['show_gdbgui_upgrades'] = True
app.config['TEMPLATES_AUTO_RELOAD'] = True
app.config['LLDB'] = False  # assume false, okay to change later

socketio = SocketIO()
_gdb_state = {
              # each key of gdb_controllers is websocket client id (each tab in browser gets its own id),
              # and value is pygdbmi.GdbController instance
              'gdb_controllers': {},
              # a socketio thread to continuously check for output from all gdb processes (cannot be set until server is running)
              'gdb_reader_thread': None,
              }


def setup_backend(serve=True, host=DEFAULT_HOST, port=DEFAULT_PORT, debug=False, open_browser=True, testing=False, LLDB=False):
    """Run the server of the gdb gui"""
    app.config['LLDB'] = LLDB
    url = '%s:%s' % (host, port)
    url_with_prefix = 'http://' + url

    if debug:
        # gevent works on linux kernels < v3.9, eventlet does not, so gevent is preferred.
        # However, in debug mode gevent monkey patches (removes) python modules used by pygdbmi,
        # so it cannot be used if debug is on
        # https://github.com/miguelgrinberg/Flask-SocketIO/issues/413 is resolved
        async_mode = 'eventlet'
    else:

        async_mode = 'gevent'
    socketio.server_options['async_mode'] = async_mode
    try:
        socketio.init_app(app)
    except Exception:
        print('failed to initialize socketio app with async mode "%s". Continuing with async mode "threading".' % async_mode)
        socketio.server_options['async_mode'] = 'threading'
        socketio.init_app(app)

    if testing is False:
        if host == DEFAULT_HOST:
            url = (DEFAULT_HOST, port)
        else:
            try:
                url = (socket.gethostbyname(socket.gethostname()), port)
            except Exception:
                url = (host, port)

        if open_browser is True and debug is False:
            text = 'Opening gdbgui in browser at http://%s:%d' % url
            print(colorize(text))
            webbrowser.open(url_with_prefix)
        else:
            print(colorize('View gdbgui at http://%s:%d' % url))

        print('exit gdbgui by pressing CTRL+C')

        try:
            socketio.run(app, debug=debug, port=int(port), host=host, extra_files=get_extra_files())
        except KeyboardInterrupt:
            # Process was interrupted by ctrl+c on keyboard, show message
            sys.stdout.write('gdbgui has exited\n')


def verify_gdb_exists():
    if find_executable(app.config['gdb_path']) is None:
        pygdbmi.printcolor.print_red('gdb executable "%s" was not found. Is gdb installed? try "sudo apt-get install gdb"' % app.config['gdb_path'])
        sys.exit(1)
    elif 'lldb' in app.config['gdb_path'].lower() and 'lldb-mi' not in app.config['gdb_path'].lower():
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
        return '\033[1;32m' + text + '\x1b[0m'
    else:
        return text


@socketio.on('connect', namespace='/gdb_listener')
def client_connected():
    dbprint('Client websocket connected in async mode "%s", id %s' % (socketio.async_mode, request.sid))

    # give each client their own gdb instance
    if request.sid not in _gdb_state['gdb_controllers'].keys():
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

        if app.config['gdb_cmd_file']:
            gdb_args.append('-x=%s' % app.config['gdb_cmd_file'])

        _gdb_state['gdb_controllers'][request.sid] = GdbController(gdb_path=app.config['gdb_path'], gdb_args=gdb_args)

    # tell the client browser tab which gdb pid is a dedicated to it
    emit('gdb_pid', _gdb_state['gdb_controllers'][request.sid].gdb_process.pid)

    # Make sure there is a reader thread reading. One thread reads all instances.
    if _gdb_state['gdb_reader_thread'] is None:
        _gdb_state['gdb_reader_thread'] = socketio.start_background_task(target=read_and_forward_gdb_output)
        dbprint('Created background thread to read gdb responses')


@socketio.on('run_gdb_command', namespace='/gdb_listener')
def run_gdb_command(message):
    """
    Endpoint for a websocket route.
    Runs a gdb command.
    Responds only if an error occurs when trying to write the command to
    gdb
    """
    if _gdb_state['gdb_controllers'].get(request.sid) is not None:
        try:
            # the command (string) or commands (list) to run
            cmd = message['cmd']
            _gdb_state['gdb_controllers'].get(request.sid).write(cmd, read_response=False)

        except Exception as e:
            print(e)
            err = traceback.format_exc()
            dbprint(traceback.format_exc())
            emit('error_running_gdb_command', {'message': err})
    else:
        emit('error_running_gdb_command', {'message': 'gdb is not running'})


@socketio.on('disconnect', namespace='/gdb_listener')
def client_disconnected():
    """if client disconnects, kill the gdb process connected to the browser tab"""
    dbprint('Client websocket disconnected, id %s' % (request.sid))
    if request.sid in _gdb_state['gdb_controllers'].keys():
        dbprint('Exiting gdb subprocess pid %s' % _gdb_state['gdb_controllers'][request.sid].gdb_process.pid)
        _gdb_state['gdb_controllers'][request.sid].exit()
        _gdb_state['gdb_controllers'].pop(request.sid)


@socketio.on('Client disconnected')
def test_disconnect():
    print('Client websocket disconnected', request.sid)


def read_and_forward_gdb_output():
    """A task that runs on a different thread, and emits websocket messages
    of gdb responses"""

    while True:
        socketio.sleep(0.05)
        for client_id, gdb in _gdb_state['gdb_controllers'].items():
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
                dbprint(traceback.format_exc())


def server_error(obj):
    return jsonify(obj), 500


def client_error(obj):
    return jsonify(obj), 400


def get_extra_files():
    """returns a list of files that should be watched by the Flask server
    when in debug mode to trigger a reload of the server
    """
    FILES_TO_SKIP = ['src/gdbgui.js']
    THIS_DIR = os.path.dirname(os.path.abspath(__file__))
    extra_dirs = [THIS_DIR]
    extra_files = []
    for extra_dir in extra_dirs:
        for dirname, dirs, files in os.walk(extra_dir):
            for filename in files:
                filepath = os.path.join(dirname, filename)
                if os.path.isfile(filepath) and filepath not in extra_files:
                    for skipfile in FILES_TO_SKIP:
                        if skipfile not in filepath:
                            extra_files.append(filepath)
    return extra_files


@app.route('/')
def gdbgui():
    """Render the main gdbgui interface"""
    interpreter = 'lldb' if app.config['LLDB'] else 'gdb'

    THEMES = ['default', 'monokai']
    initial_data = {
            'gdbgui_version': __version__,
            'interpreter': interpreter,
            'initial_binary_and_args': app.config['initial_binary_and_args'],
            'show_gdbgui_upgrades': app.config['show_gdbgui_upgrades'],
            'themes': THEMES,
            'signals': SIGNAL_NAME_TO_NUM
        }

    return render_template('gdbgui.pug',
        version=__version__,
        debug=json.dumps(app.debug),
        interpreter=interpreter,
        initial_data=json.dumps(initial_data),
        themes=THEMES)


@app.route('/send_signal_to_pid')
def send_signal_to_pid():
    signal_name = request.args.get('signal_name', '')
    signal_num = SIGNAL_NAME_TO_NUM.get(signal_name.upper())
    if signal is None:
        raise ValueError('no such signal %s' % signal_name)

    pid = int(request.args.get('pid'))
    os.kill(pid, signal_num)
    return jsonify({'message': 'sent signal %s (%s) to process id %s' % (signal_name, signal_num, str(pid))})


@app.route('/shutdown')
def shutdown_webview():
    return render_template('donate.pug', debug=json.dumps(app.debug))


@app.route('/donate')
def donate():
    return render_template('donate.pug')


@app.route('/help')
def help():
    return redirect('https://github.com/cs01/gdbgui/blob/master/HELP.md')


@app.route('/_shutdown')
def _shutdown():
    sys.stdout.write('\ngdbgui has exited\n')
    pid = os.getpid()
    if app.debug:
        os.kill(pid, signal.SIGINT)
    else:
        socketio.stop()

    return jsonify({})


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
    try:
        highlight = json.loads(request.args.get('highlight', 'true'))
    except Exception as e:
        if app.debug:
            print('Raising exception since debug is on')
            raise e
        else:
            highlight = True  # highlight argument was invalid for some reason, default to true

    if path and os.path.isfile(path):
        try:
            last_modified = os.path.getmtime(path)
            with open(path, 'r') as f:
                code = f.read()

            formatter = htmllistformatter.HtmlListFormatter(lineseparator='')  # Don't add newlines after each line
            try:
                lexer = get_lexer_for_filename(path)
            except Exception:
                lexer = None

            if lexer and highlight:
                highlighted = True
                tokens = lexer.get_tokens(code)  # convert string into tokens
                # format tokens into nice, marked up list of html
                source_code = formatter.get_marked_up_list(tokens)
            else:
                highlighted = False
                source_code = code.split('\n')  # turn long string into a list

            return jsonify({'source_code': source_code,
                            'path': path,
                            'last_modified_unix_sec': last_modified,
                            'highlighted': highlighted})
        except Exception as e:
            return client_error({'message': '%s' % e})

    else:
        return client_error({'message': 'File not found: %s' % path})


def main():
    """Entry point from command line"""
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("cmd", nargs='*', help='(Optional) The binary and arguments to run in gdb. This is a way to script the intial loading of the inferior'
        " binary  you wish to debug. For example gdbgui './mybinary myarg -flag1 -flag2'", default=app.config['initial_binary_and_args'])

    parser.add_argument('-p', '--port', help='The port on which gdbgui will be hosted. Defaults to %s' % DEFAULT_PORT, default=DEFAULT_PORT)
    parser.add_argument('--host', help='The host ip address on which gdbgui serve. Defaults to %s' % DEFAULT_HOST, default=DEFAULT_HOST)
    parser.add_argument('-r', '--remote', help='Shortcut to sets host to 0.0.0.0 and suppress browser from opening. This allows remote access '
                        'to gdbgui and is useful when running on a remote machine that you want to view/debug from your local '
                        'browser, or let someone else debug your application remotely.', action='store_true', )
    parser.add_argument('-g', '--gdb', help='Path to gdb or lldb executable. Defaults to %s. lldb support is experimental.' % DEFAULT_GDB_EXECUTABLE, default=DEFAULT_GDB_EXECUTABLE)
    parser.add_argument('--lldb', help='Use lldb commands (experimental)', action='store_true')
    parser.add_argument('-v', '--version', help='Print version', action='store_true')
    parser.add_argument('--hide_gdbgui_upgrades', help='Hide messages regarding newer version of gdbgui. Defaults to False.', action='store_true')
    parser.add_argument('--debug', help='The debug flag of this Flask application. '
        'Pass this flag when debugging gdbgui itself to automatically reload the server when changes are detected', action='store_true')
    parser.add_argument('-n', '--no_browser', help='By default, the browser will open with gdb gui. Pass this flag so the browser does not open.', action='store_true')
    parser.add_argument('-x', '--gdb_cmd_file', help='Execute GDB commands from file.')
    args = parser.parse_args()

    if args.version:
        print(__version__)
        return

    app.config['initial_binary_and_args'] = ' '.join(args.cmd)
    app.config['gdb_path'] = args.gdb
    app.config['gdb_cmd_file'] = args.gdb_cmd_file
    app.config['show_gdbgui_upgrades'] = not args.hide_gdbgui_upgrades
    verify_gdb_exists()
    if args.remote:
        args.host = '0.0.0.0'
        args.no_browser = True
    setup_backend(serve=True, host=args.host, port=int(args.port), debug=bool(args.debug), open_browser=(not args.no_browser), LLDB=(args.lldb or 'lldb-mi' in args.gdb.lower()))


if __name__ == '__main__':
    main()
