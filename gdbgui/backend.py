#!/usr/bin/env python

"""
A Flask server that manages a gdb subprocess, and
returns structured gdb output to the client
"""

from flask import Flask, render_template, jsonify
import os
import argparse
from flask import request
import signal
from pygdbmi.gdbcontroller import GdbController
import webbrowser
import datetime


BASE_PATH = os.path.dirname(os.path.realpath(__file__))
TEMPLATE_DIR = os.path.join(BASE_PATH, 'templates')
STATIC_DIR = os.path.join(BASE_PATH, 'static')
DEFAULT_HOST = '127.0.0.1'
DEFAULT_PORT = 5000


app = Flask(__name__, template_folder=TEMPLATE_DIR, static_folder=STATIC_DIR)
# templates are writte in jade/pug, so add that capability to flask
app.jinja_env.add_extension('pyjade.ext.jinja.PyJadeExtension')

gdb = None


def server_error(obj):
    return jsonify(obj), 500


def client_error(obj):
    return jsonify(obj), 400


def get_extra_files():
    """returns a list of files that should be watched by the Flask server
    when in debug mode to trigger a reload of the server

    """
    extra_dirs = [STATIC_DIR, TEMPLATE_DIR]
    extra_files = []
    for extra_dir in extra_dirs:
        for dirname, dirs, files in os.walk(extra_dir):
            for filename in files:
                filename = os.path.join(dirname, filename)
                if os.path.isfile(filename):
                    extra_files.append(filename)
    return extra_files


@app.route('/')
def gdbgui():
    """Render the main gdbgui interface"""
    time_sec = int((datetime.datetime.utcnow() - datetime.datetime(1970, 1, 1)).total_seconds())
    return render_template('gdbgui.jade', timetag_to_prevent_caching=time_sec)


@app.route('/run_gdb_command', methods=['POST'])
def run_gdb_command():
    """Run a gdb command"""
    if gdb is not None:
        try:
            cmd = request.form.get('cmd') or request.form.getlist('cmd[]')
            response = gdb.write(cmd)
            return jsonify(response)
        except Exception as e:
            return server_error({'message': str(e)})
    else:
        return client_error({'message': 'gdb is not running'})


@app.route('/get_gdb_response')
def get_gdb_response():
    """Return output from gdb.get_gdb_response"""
    if gdb is not None:
        try:
            response = gdb.get_gdb_response(timeout_sec=0, raise_error_on_timeout=False)
            return jsonify(response)
        except Exception as e:
            return server_error({'message': str(e)})
    else:
        return client_error({'message': 'gdb is not running'})


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


def signal_handler(signal, frame):
    """handle ctrl+c (SIGINT) to make sure the child gdb process is killed"""
    print("Received signal %s. Shutting down gdbgui." % signal)
    if gdb is not None:
        try:
            gdb.exit()
            print('successfully killed child gdb process before exiting')
            exit(0)
        except Exception as e:
            print('failed to kill child gdb process before exiting (%s)' % e)
            exit(1)


def quit_backend():
    """Shutdown the flask server. Used when programmitcally testing gdbgui"""
    gdb.exit()
    func = request.environ.get('werkzeug.server.shutdown')
    if func is None:
        raise RuntimeError('Not running with the Werkzeug Server')
    func()


def open_webbrowser(host, port):
    if host.startswith('http'):
        url = '%s:%s' % (host, port)
    else:
        url = 'http://%s:%s' % (host, port)
    print(" * Opening gdbgui in browser (%s)" % url)
    webbrowser.open(url)


def setup_backend(serve=True, host=DEFAULT_HOST, port=DEFAULT_PORT, debug=False, open_browser=True):
    """Run the server of the gdb gui"""
    global gdb
    signal.signal(signal.SIGINT, signal_handler)
    gdb = GdbController()
    app.secret_key = 'iusahjpoijeoprkge[0irokmeoprgk890'
    app.debug = debug
    app.config['TEMPLATES_AUTO_RELOAD'] = True

    if serve:
        if open_browser and (not debug):
            # if debug is true, this server reloads any time a file
            # is changed, which would trigger the browser to open again. We
            # don't want that, so (not debug) is part of the if statement
            open_webbrowser(host, port)
        app.run(host=host, port=port, extra_files=get_extra_files())


def main():
    """Entry point from command line"""
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--port", help='The port on which gdbgui will be hosted', default=DEFAULT_PORT)
    parser.add_argument("--host", help='The host ip address on which gdbgui serve. ', default=DEFAULT_HOST)
    parser.add_argument("--debug", help='The debug flag of this Flask application. '
        'Pass this flag when debugging gdbgui itself to automatically reload the server when changes are detected', action='store_true')
    parser.add_argument("--no_browser", help='By default, the browser will open with gdb gui. Pass this flag so the browser does not open.', action='store_true')
    args = parser.parse_args()
    setup_backend(serve=True, host=args.host, port=args.port, debug=args.debug, open_browser=(not args.no_browser))


if __name__ == '__main__':
    main()
