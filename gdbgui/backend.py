#!/usr/bin/env python

"""
A Flask server that manages a gdb subprocess, and
returns structured gdb output to the client
"""

import os
import argparse
import signal
import sys
import webbrowser
import datetime
from flask import Flask, request, render_template, jsonify
from flask_socketio import SocketIO, send
from pygdbmi.gdbcontroller import GdbController

BASE_PATH = os.path.dirname(os.path.realpath(__file__))
TEMPLATE_DIR = os.path.join(BASE_PATH, 'templates')
STATIC_DIR = os.path.join(BASE_PATH, 'static')
DEFAULT_HOST = '127.0.0.1'
DEFAULT_PORT = 5000

app = Flask(__name__, template_folder=TEMPLATE_DIR, static_folder=STATIC_DIR)
gdb = GdbController(gdb_args=['-nx', '--interpreter=mi2'])
thread = None
socketio = SocketIO(async_mode='eventlet')


@socketio.on('connect', namespace='/gdb_listener')
def client_connected():
    print('Client websocket connected in async mode "%s", id %s' % (socketio.async_mode, request.sid))
    global thread
    if thread is None:
        thread = socketio.start_background_task(target=gdb_background_thread)
        print('Created background thread to read gdb responses')


@socketio.on('Client disconnected')
def test_disconnect():
    print('Client websocket disconnected', request.sid)


def gdb_background_thread():
    """A task that runs on a different thread, and emits websocket messages
    of gdb responses"""

    while True:
        try:
            socketio.sleep(0.05)
            if gdb is not None:
                response = gdb.get_gdb_response(timeout_sec=0, raise_error_on_timeout=False)
                if response:
                    socketio.emit('gdb_response', response, namespace='/gdb_listener')
                else:
                    # there was no queued response from gdb, not a problem
                    pass
            else:
                # This is a problem. This thread shouldn't be running unless
                # there is a gdb process providing output
                print('Thanks for using gdbgui!')
                break

        except Exception as e:
            print(e)


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
    return render_template('gdbgui.jade', timetag_to_prevent_caching=time_sec)


@app.route('/shutdown')
def shutdown_webview():
    """Render the main gdbgui interface"""
    return render_template('shutdown.jade', timetag_to_prevent_caching=0)


@app.route('/run_gdb_command', methods=['POST'])
def run_gdb_command():
    """Run a gdb command. TODO make this a websocket endpoint"""
    if gdb is not None:
        try:
            # the command (string) or commands (list) to run
            cmd = request.form.get('cmd') or request.form.getlist('cmd[]')
            gdb.write(cmd, read_response=False)
            return jsonify([])

        except Exception as e:
            return server_error({'message': str(e)})
    else:
        return client_error({'message': 'gdb is not running'})


@app.route('/_shutdown')
def _shutdown():
    pid = os.getpid()
    print('received user request to shut down gdbgui')

    if app.debug:
        os.kill(pid, signal.SIGINT)
    else:
        socketio.stop()


@app.route('/read_file')
def read_file():
    """Read a file and return its contents as an array"""
    path = request.args.get('path')
    if path and os.path.isfile(path):
        try:
            with open(path, 'r') as f:
                return jsonify({'source_code': f.read().splitlines(),
                                'path': path})
        except Exception as e:
            return client_error({'message': '%s' % e})

    else:
        return client_error({'message': 'File not found: %s' % path})


def setup_backend(serve=True, host=DEFAULT_HOST, port=DEFAULT_PORT, debug=False, open_browser=True, testing=False):
    """Run the server of the gdb gui"""
    url = '%s:%s' % (host, port)
    url_with_prefix = 'http://' + url

    app.secret_key = 'iusahjpoijeoprkge[0irokmeoprgk890'
    # templates are writte in jade/pug, so add that capability to flask
    app.jinja_env.add_extension('pyjade.ext.jinja.PyJadeExtension')
    app.config['TEMPLATES_AUTO_RELOAD'] = True
    socketio.init_app(app)

    if open_browser is True and debug is False and testing is False:
        print('Opening gdbgui in browser (%s)' % (url_with_prefix))
        webbrowser.open(url_with_prefix)

    if testing is False:
        print('Serving at %s' % url_with_prefix)
        socketio.run(app, debug=debug, port=int(port), host=host, extra_files=get_extra_files())


def main():
    """Entry point from command line"""
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--port", help='The port on which gdbgui will be hosted', default=DEFAULT_PORT)
    parser.add_argument("--host", help='The host ip address on which gdbgui serve. ', default=DEFAULT_HOST)
    parser.add_argument("--debug", help='The debug flag of this Flask application. '
        'Pass this flag when debugging gdbgui itself to automatically reload the server when changes are detected', action='store_true')
    parser.add_argument("--no_browser", help='By default, the browser will open with gdb gui. Pass this flag so the browser does not open.', action='store_true')
    args = parser.parse_args()
    setup_backend(serve=True, host=args.host, port=int(args.port), debug=bool(args.debug), open_browser=(not args.no_browser))


if __name__ == '__main__':
    main()
