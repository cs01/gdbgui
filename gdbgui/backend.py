#!/usr/bin/env python
from flask import Flask, render_template, jsonify, session
import os
import argparse
from flask import request
import signal
from ipdb import set_trace as db
from pygdbmi.gdbcontroller import GdbController

BASE_PATH = os.path.dirname(os.path.realpath(__file__))
TEMPLATE_DIR = os.path.join(BASE_PATH, 'templates')
STATIC_DIR = os.path.join(BASE_PATH, 'static')


app = Flask(__name__, template_folder=TEMPLATE_DIR, static_folder=STATIC_DIR)
app.jinja_env.add_extension('pyjade.ext.jinja.PyJadeExtension')

gdb = None

def server_error(obj):
    return jsonify(obj), 500


def client_error(obj):
    return jsonify(obj), 400


def get_extra_files():
    extra_dirs = ['.']
    extra_files = extra_dirs[:]
    for extra_dir in extra_dirs:
        for dirname, dirs, files in os.walk(extra_dir):
            for filename in files:
                filename = os.path.join(dirname, filename)
                if os.path.isfile(filename):
                    extra_files.append(filename)
    return extra_files


@app.route('/')
def gdbgui():
    return render_template('gdbgui.jade')


@app.route('/run_gdb_command', methods=['POST'])
def run_gdb_command():
    if gdb is not None:
        try:
            cmd = request.form.get('cmd') or request.form.getlist('cmd[]')
            response = gdb.write(cmd)
            return jsonify(response)
        except Exception as e:
            return server_error({'message': str(e)})
    else:
        return client_error({'message': 'gdb is not running'})


@app.route('/read_file')
def read_file():
    """Used to get contents of source files that are being debugged"""
    path = request.args.get('path')
    if os.path.isfile(path):
        try:
            with open(path, 'r') as f:
                return jsonify({'source_code': f.read().splitlines(),
                                'path': path})
        except Exception as e:
            return client_error({'message': '%s' % e})

    else:
        return client_error({'message': 'File not found: %s' % path})


def signal_handler(signal, frame):
    """handle ctrl+c (SIGINT) and make sure the child process is killed!"""
    global gdb
    if gdb is not None:
        try:
            gdb.exit()
            print('successfully killed child gdb process before exiting')
            exit(0)
        except Exception as e:
            print('failed to kill child gdb process before exiting (%s)' % e)
            exit(1)


def quit_backend():
    global app, gdb
    gdb.exit()
    func = request.environ.get('werkzeug.server.shutdown')
    if func is None:
        raise RuntimeError('Not running with the Werkzeug Server')
    func()


def setup_backend(serve=True, port=5000, debug=False):
    """Run the server of the gdb gui"""
    global app, gdb
    signal.signal(signal.SIGINT, signal_handler)
    gdb = GdbController()
    app.secret_key = 'iusahjpoijeoprkge[0irokmeoprgk890'
    app.debug = debug
    app.config['TEMPLATES_AUTO_RELOAD'] = True
    if serve:
        extra_files=[]
        for dirname, dirs, files in os.walk(TEMPLATE_DIR):
            for filename in files:
                filename = os.path.join(dirname, filename)
                if os.path.isfile(filename):
                    extra_files.append(filename)
        app.run(port=port, extra_files=extra_files)


def main():
    """Entry point from command line"""
    parser = argparse.ArgumentParser()
    parser.add_argument("--port", default=5000)
    parser.add_argument("--debug", action='store_true')
    args = parser.parse_args()
    setup_backend(port=args.port, debug=args.debug)


if __name__ == '__main__':
    main()
