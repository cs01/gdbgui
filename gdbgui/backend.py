#!/usr/bin/env python

"""
A server that provides a graphical user interface to the gnu debugger (gdb).
https://github.com/cs01/gdbgui
"""

import argparse
import binascii
import json
import logging
import os
import platform
import re
import shlex
import signal
import socket
import sys
import traceback
import webbrowser
from distutils.spawn import find_executable
from functools import wraps

import pygdbmi
from flask import (
    Flask,
    Response,
    abort,
    jsonify,
    redirect,
    render_template,
    request,
    session,
)
from flask_compress import Compress
from flask_socketio import SocketIO, emit
from gdbgui import __version__, htmllistformatter  # noqa
from gdbgui.statemanager import StateManager  # noqa
from pygdbmi.gdbcontroller import NoGdbProcessError
from pygments.lexers import get_lexer_for_filename


pyinstaller_env_var_base_dir = "_MEIPASS"
pyinstaller_base_dir = getattr(sys, "_MEIPASS", None)
using_pyinstaller = pyinstaller_base_dir is not None
if using_pyinstaller:
    BASE_PATH = pyinstaller_base_dir
else:
    BASE_PATH = os.path.dirname(os.path.realpath(__file__))
    PARENTDIR = os.path.dirname(BASE_PATH)
    sys.path.append(PARENTDIR)


try:
    from gdbgui.SSLify import SSLify, get_ssl_context  # noqa
except ImportError:
    print("Warning: Optional SSL support is not available")

    def get_ssl_context(private_key, certificate):  # noqa
        return None


USING_WINDOWS = os.name == "nt"
TEMPLATE_DIR = os.path.join(BASE_PATH, "templates")
STATIC_DIR = os.path.join(BASE_PATH, "static")
DEFAULT_HOST = "127.0.0.1"
DEFAULT_PORT = 5000
IS_A_TTY = sys.stdout.isatty()
DEFAULT_GDB_EXECUTABLE = "gdb"

logger = logging.getLogger(__name__)
logger.setLevel(logging.WARNING)


class ColorFormatter(logging.Formatter):
    def format(self, record):
        color = "\033[1;0m"
        if not USING_WINDOWS and sys.stdout.isatty():
            if record.levelname == "WARNING":
                color = "\33[93m"  # yellow
            elif record.levelname == "ERROR":
                color = "\033[1;41m"
        return "{color}{levelname}\033[1;0m - {msg}".format(color=color, **vars(record))


formatter = ColorFormatter()
handler = logging.StreamHandler()
handler.setFormatter(formatter)
logger.addHandler(handler)
# create dictionary of signal names
SIGNAL_NAME_TO_OBJ = {}
for n in dir(signal):
    if n.startswith("SIG") and "_" not in n:
        SIGNAL_NAME_TO_OBJ[n.upper()] = getattr(signal, n)

# Create flask application and add some configuration keys to be used in various callbacks
app = Flask(__name__, template_folder=TEMPLATE_DIR, static_folder=STATIC_DIR)
Compress(
    app
)  # add gzip compression to Flask. see https://github.com/libwilliam/flask-compress

app.config["initial_binary_and_args"] = []
app.config["gdb_path"] = DEFAULT_GDB_EXECUTABLE
app.config["gdb_cmd_file"] = None
app.config["TEMPLATES_AUTO_RELOAD"] = True
app.config["LLDB"] = False  # assume false, okay to change later
app.config["project_home"] = None
app.config["remap_sources"] = {}
app.config["rr"] = False
app.secret_key = binascii.hexlify(os.urandom(24)).decode("utf-8")


@app.before_request
def csrf_protect_all_post_and_cross_origin_requests():
    """returns None upon success"""
    success = None

    if is_cross_origin(request):
        logger.warning("Received cross origin request. Aborting")
        abort(403)
    if request.method in ["POST", "PUT"]:
        token = session.get("csrf_token")
        if token == request.form.get("csrf_token"):
            return success

        elif token == request.environ.get("HTTP_X_CSRFTOKEN"):
            return success

        else:
            logger.warning("Received invalid csrf token. Aborting")
            abort(403)


def is_cross_origin(request):
    """Compare headers HOST and ORIGIN. Remove protocol prefix from ORIGIN, then
    compare. Return true if they are not equal
    example HTTP_HOST: '127.0.0.1:5000'
    example HTTP_ORIGIN: 'http://127.0.0.1:5000'
    """
    origin = request.environ.get("HTTP_ORIGIN")
    host = request.environ.get("HTTP_HOST")
    if origin is None:
        # origin is sometimes omitted by the browser when origin and host are equal
        return False

    if origin.startswith("http://"):
        origin = origin.replace("http://", "")
    elif origin.startswith("https://"):
        origin = origin.replace("https://", "")
    return host != origin


def csrf_protect(f):
    """A decorator to add csrf protection by validing the X_CSRFTOKEN
    field in request header"""

    @wraps(f)
    def wrapper(*args, **kwargs):
        token = session.get("csrf_token", None)
        if token is None or token != request.environ.get("HTTP_X_CSRFTOKEN"):
            logger.warning("Received invalid csrf token. Aborting")
            abort(403)
        # call original request handler
        return f(*args, **kwargs)

    return wrapper


def add_csrf_token_to_session():
    if "csrf_token" not in session:
        session["csrf_token"] = binascii.hexlify(os.urandom(20)).decode("utf-8")


socketio = SocketIO()
_state = StateManager(app.config)


def setup_backend(
    serve=True,
    host=DEFAULT_HOST,
    port=DEFAULT_PORT,
    debug=False,
    open_browser=True,
    browsername=None,
    testing=False,
    private_key=None,
    certificate=None,
    LLDB=False,
):
    """Run the server of the gdb gui"""
    app.config["LLDB"] = LLDB

    kwargs = {}
    ssl_context = get_ssl_context(private_key, certificate)
    if ssl_context:
        # got valid ssl context
        # force everything through https
        SSLify(app)
        # pass ssl_context to flask
        kwargs["ssl_context"] = ssl_context

    url = "%s:%s" % (host, port)
    if kwargs.get("ssl_context"):
        protocol = "https://"
        url_with_prefix = "https://" + url
    else:
        protocol = "http://"
        url_with_prefix = "http://" + url

    if debug:
        async_mode = "eventlet"
    else:
        async_mode = "gevent"

    socketio.server_options["async_mode"] = async_mode
    try:
        socketio.init_app(app)
    except Exception:
        print(
            'failed to initialize socketio app with async mode "%s". Continuing with async mode "threading".'
            % async_mode
        )
        socketio.server_options["async_mode"] = "threading"
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
            browsertext = repr(browsername) if browsername else "default browser"
            args = (browsertext,) + url
            text = ("Opening gdbgui with %s at " + protocol + "%s:%d") % args
            print(colorize(text))
            b = webbrowser.get(browsername) if browsername else webbrowser
            b.open(url_with_prefix)
        else:
            print(colorize("View gdbgui at %s%s:%d" % (protocol, url[0], url[1])))

        print("exit gdbgui by pressing CTRL+C")

        try:
            socketio.run(
                app,
                debug=debug,
                port=int(port),
                host=host,
                extra_files=get_extra_files(),
                **kwargs
            )
        except KeyboardInterrupt:
            # Process was interrupted by ctrl+c on keyboard, show message
            pass


def verify_gdb_exists(gdb_path):
    if find_executable(gdb_path) is None:
        pygdbmi.printcolor.print_red(
            'gdb executable "%s" was not found. Verify the executable exists, or that it is a directory on your $PATH environment variable.'
            % gdb_path
        )
        if USING_WINDOWS:
            print(
                'Install gdb (package name "mingw32-gdb") using MinGW (https://sourceforge.net/projects/mingw/files/Installer/mingw-get-setup.exe/download), then ensure gdb is on your "Path" environement variable: Control Panel > System Properties > Environment Variables > System Variables > Path'
            )
        else:
            print('try "sudo apt-get install gdb" for Linux or "brew install gdb"')
        sys.exit(1)
    elif "lldb" in gdb_path.lower() and "lldb-mi" not in app.config["gdb_path"].lower():
        pygdbmi.printcolor.print_red(
            'gdbgui cannot use the standard lldb executable. You must use an executable with "lldb-mi" in its name.'
        )
        sys.exit(1)


def dbprint(*args):
    """print only if app.debug is truthy"""
    if app and app.debug:
        if USING_WINDOWS:
            print("DEBUG: " + " ".join(args))

        else:
            CYELLOW2 = "\33[93m"
            NORMAL = "\033[0m"
            print(CYELLOW2 + "DEBUG: " + " ".join(args) + NORMAL)


def colorize(text):
    if IS_A_TTY and not USING_WINDOWS:
        return "\033[1;32m" + text + "\x1b[0m"

    else:
        return text


@socketio.on("connect", namespace="/gdb_listener")
def client_connected():
    if is_cross_origin(request):
        logger.warning("Received cross origin request. Aborting")
        abort(403)

    csrf_token = request.args.get("csrf_token")
    if csrf_token is None:
        logger.warning("Recieved invalid csrf token")
        emit("server_error", {"message": "Recieved invalid csrf token"})
        return

    elif csrf_token != session.get("csrf_token"):
        # this can happen fairly often, so log debug message, not warning
        logger.debug(
            "Recieved invalid csrf token %s (expected %s)"
            % (csrf_token, str(session.get("csrf_token")))
        )
        emit(
            "server_error", {"message": "Session expired. Please refresh this webpage."}
        )
        return

    # see if user wants to connect to existing gdb pid
    desired_gdbpid = int(request.args.get("gdbpid", 0))

    payload = _state.connect_client(request.sid, desired_gdbpid)
    logger.info(
        'Client websocket connected in async mode "%s", id %s'
        % (socketio.async_mode, request.sid)
    )

    # tell the client browser tab which gdb pid is a dedicated to it
    emit("gdb_pid", payload)

    # Make sure there is a reader thread reading. One thread reads all instances.
    if _state.gdb_reader_thread is None:
        _state.gdb_reader_thread = socketio.start_background_task(
            target=read_and_forward_gdb_output
        )
        logger.info("Created background thread to read gdb responses")


@socketio.on("run_gdb_command", namespace="/gdb_listener")
def run_gdb_command(message):
    """
    Endpoint for a websocket route.
    Runs a gdb command.
    Responds only if an error occurs when trying to write the command to
    gdb
    """
    controller = _state.get_controller_from_client_id(request.sid)
    if controller is not None:
        try:
            # the command (string) or commands (list) to run
            cmd = message["cmd"]
            controller.write(cmd, read_response=False)

        except Exception:
            err = traceback.format_exc()
            logger.error(err)
            emit("error_running_gdb_command", {"message": err})
    else:
        emit("error_running_gdb_command", {"message": "gdb is not running"})


def send_msg_to_clients(client_ids, msg, error=False):
    """Send message to all clients"""
    if error:
        stream = "stderr"
    else:
        stream = "stdout"

    response = [{"message": None, "type": "console", "payload": msg, "stream": stream}]

    for client_id in client_ids:
        logger.info("emiting message to websocket client id " + client_id)
        socketio.emit(
            "gdb_response", response, namespace="/gdb_listener", room=client_id
        )


@app.route("/remove_gdb_controller", methods=["POST"])
def remove_gdb_controller():
    gdbpid = int(request.form.get("gdbpid"))

    orphaned_client_ids = _state.remove_gdb_controller_by_pid(gdbpid)
    num_removed = len(orphaned_client_ids)

    send_msg_to_clients(
        orphaned_client_ids,
        "The underlying gdb process has been killed. This tab will no longer function as expected.",
        error=True,
    )

    msg = "removed %d gdb controller(s) with pid %d" % (num_removed, gdbpid)
    if num_removed:
        return jsonify({"message": msg})

    else:
        return jsonify({"message": msg}), 500


@socketio.on("disconnect", namespace="/gdb_listener")
def client_disconnected():
    """do nothing if client disconnects"""
    _state.disconnect_client(request.sid)
    logger.info("Client websocket disconnected, id %s" % (request.sid))


@socketio.on("Client disconnected")
def test_disconnect():
    print("Client websocket disconnected", request.sid)


def read_and_forward_gdb_output():
    """A task that runs on a different thread, and emits websocket messages
    of gdb responses"""

    while True:
        socketio.sleep(0.05)
        controllers_to_remove = []
        controller_items = _state.controller_to_client_ids.items()
        for controller, client_ids in controller_items:
            try:
                try:
                    response = controller.get_gdb_response(
                        timeout_sec=0, raise_error_on_timeout=False
                    )
                except NoGdbProcessError:
                    response = None
                    send_msg_to_clients(
                        client_ids,
                        "The underlying gdb process has been killed. This tab will no longer function as expected.",
                        error=True,
                    )
                    controllers_to_remove.append(controller)

                if response:
                    for client_id in client_ids:
                        logger.info(
                            "emiting message to websocket client id " + client_id
                        )
                        socketio.emit(
                            "gdb_response",
                            response,
                            namespace="/gdb_listener",
                            room=client_id,
                        )
                else:
                    # there was no queued response from gdb, not a problem
                    pass

            except Exception:
                logger.error(traceback.format_exc())

        for controller in controllers_to_remove:
            _state.remove_gdb_controller(controller)


def server_error(obj):
    return jsonify(obj), 500


def client_error(obj):
    return jsonify(obj), 400


def get_extra_files():
    """returns a list of files that should be watched by the Flask server
    when in debug mode to trigger a reload of the server
    """
    FILES_TO_SKIP = ["src/gdbgui.js"]
    THIS_DIR = os.path.dirname(os.path.abspath(__file__))
    extra_dirs = [THIS_DIR]
    extra_files = []
    for extra_dir in extra_dirs:
        for dirname, _, files in os.walk(extra_dir):
            for filename in files:
                filepath = os.path.join(dirname, filename)
                if os.path.isfile(filepath) and filepath not in extra_files:
                    for skipfile in FILES_TO_SKIP:
                        if skipfile not in filepath:
                            extra_files.append(filepath)
    return extra_files


def credentials_are_valid(username, password):
    user_credentials = app.config.get("gdbgui_auth_user_credentials")
    if user_credentials is None:
        return False

    elif len(user_credentials) < 2:
        return False

    return user_credentials[0] == username and user_credentials[1] == password


def authenticate(f):
    @wraps(f)
    def wrapper(*args, **kwargs):
        if app.config.get("gdbgui_auth_user_credentials") is not None:
            auth = request.authorization
            if (
                not auth
                or not auth.username
                or not auth.password
                or not credentials_are_valid(auth.username, auth.password)
            ):
                return Response(
                    "You must log in to continue.",
                    401,
                    {"WWW-Authenticate": 'Basic realm="gdbgui_login"'},
                )

        return f(*args, **kwargs)

    return wrapper


@app.route("/", methods=["GET"])
@authenticate
def gdbgui():
    """Render the main gdbgui interface"""
    interpreter = "lldb" if app.config["LLDB"] else "gdb"
    gdbpid = request.args.get("gdbpid", 0)
    initial_gdb_user_command = request.args.get("initial_gdb_user_command", "")

    add_csrf_token_to_session()

    THEMES = ["monokai", "light"]
    # fmt: off
    initial_data = {
        "csrf_token": session["csrf_token"],
        "gdbgui_version": __version__,
        "gdbpid": gdbpid,
        "initial_gdb_user_command": initial_gdb_user_command,
        "interpreter": interpreter,
        "initial_binary_and_args": app.config["initial_binary_and_args"],
        "project_home": app.config["project_home"],
        "remap_sources": app.config["remap_sources"],
        "rr": app.config["rr"],
        "themes": THEMES,
        "signals": SIGNAL_NAME_TO_OBJ,
        "using_windows": USING_WINDOWS,
    }
    # fmt: on

    return render_template(
        "gdbgui.html",
        version=__version__,
        debug=app.debug,
        interpreter=interpreter,
        initial_data=initial_data,
        themes=THEMES,
    )


@app.route("/send_signal_to_pid", methods=["POST"])
def send_signal_to_pid():
    signal_name = request.form.get("signal_name", "").upper()
    pid_str = str(request.form.get("pid"))
    try:
        pid_int = int(pid_str)
    except ValueError:
        return (
            jsonify(
                {
                    "message": "The pid %s cannot be converted to an integer. Signal %s was not sent."
                    % (pid_str, signal_name)
                }
            ),
            400,
        )

    if signal_name not in SIGNAL_NAME_TO_OBJ:
        raise ValueError("no such signal %s" % signal_name)
    signal_value = int(SIGNAL_NAME_TO_OBJ[signal_name])

    try:
        os.kill(pid_int, signal_value)
    except Exception:
        return (
            jsonify(
                {
                    "message": "Process could not be killed. Is %s an active PID?"
                    % pid_int
                }
            ),
            400,
        )
    return jsonify(
        {
            "message": "sent signal %s (%s) to process id %s"
            % (signal_name, signal_value, pid_str)
        }
    )


@app.route("/dashboard", methods=["GET"])
@authenticate
def dashboard():
    add_csrf_token_to_session()

    """display a dashboard with a list of all running gdb processes
    and ability to kill them, or open a new tab to work with that
    GdbController instance"""
    return render_template(
        "dashboard.html",
        processes=_state.get_dashboard_data(),
        csrf_token=session["csrf_token"],
    )


@app.route("/shutdown", methods=["GET"])
@authenticate
def shutdown_webview():
    add_csrf_token_to_session()
    return render_template(
        "shutdown.html", debug=app.debug, csrf_token=session["csrf_token"]
    )


@app.route("/help")
def help():
    return redirect("https://github.com/cs01/gdbgui/blob/master/HELP.md")


@app.route("/_shutdown", methods=["POST"])
def _shutdown():
    try:
        _state.exit_all_gdb_processes()
    except Exception:
        logger.error("failed to exit gdb subprocces")
        logger.error(traceback.format_exc())

    pid = os.getpid()
    if app.debug:
        os.kill(pid, signal.SIGINT)
    else:
        socketio.stop()

    return jsonify({})


@app.route("/get_last_modified_unix_sec", methods=["GET"])
@csrf_protect
def get_last_modified_unix_sec():
    """Get last modified unix time for a given file"""
    path = request.args.get("path")
    if path and os.path.isfile(path):
        try:
            last_modified = os.path.getmtime(path)
            return jsonify({"path": path, "last_modified_unix_sec": last_modified})

        except Exception as e:
            return client_error({"message": "%s" % e, "path": path})

    else:
        return client_error({"message": "File not found: %s" % path, "path": path})


@app.route("/read_file", methods=["GET"])
@csrf_protect
def read_file():
    """Read a file and return its contents as an array"""
    path = request.args.get("path")
    start_line = int(request.args.get("start_line"))
    end_line = int(request.args.get("end_line"))

    start_line = max(1, start_line)  # make sure it's not negative

    try:
        highlight = json.loads(request.args.get("highlight", "true"))
    except Exception as e:
        if app.debug:
            print("Raising exception since debug is on")
            raise e

        else:
            highlight = (
                True
            )  # highlight argument was invalid for some reason, default to true

    if path and os.path.isfile(path):
        try:
            last_modified = os.path.getmtime(path)
            with open(path, "r") as f:
                raw_source_code_list = f.read().split("\n")
                num_lines_in_file = len(raw_source_code_list)
                end_line = min(
                    num_lines_in_file, end_line
                )  # make sure we don't try to go too far

                # if leading lines are '', then the lexer will strip them out, but we want
                # to preserve blank lines. Insert a space whenever we find a blank line.
                for i in range((start_line - 1), (end_line)):
                    if raw_source_code_list[i] == "":
                        raw_source_code_list[i] = " "
                raw_source_code_lines_of_interest = raw_source_code_list[
                    (start_line - 1) : (end_line)
                ]
            try:
                lexer = get_lexer_for_filename(path)
            except Exception:
                lexer = None

            if lexer and highlight:
                highlighted = True
                # convert string into tokens
                tokens = lexer.get_tokens("\n".join(raw_source_code_lines_of_interest))
                # format tokens into nice, marked up list of html
                formatter = (
                    htmllistformatter.HtmlListFormatter()
                )  # Don't add newlines after each line
                source_code = formatter.get_marked_up_list(tokens)
            else:
                highlighted = False
                source_code = raw_source_code_lines_of_interest

            return jsonify(
                {
                    "source_code_array": source_code,
                    "path": path,
                    "last_modified_unix_sec": last_modified,
                    "highlighted": highlighted,
                    "start_line": start_line,
                    "end_line": end_line,
                    "num_lines_in_file": num_lines_in_file,
                }
            )

        except Exception as e:
            return client_error({"message": "%s" % e})

    else:
        return client_error({"message": "File not found: %s" % path})


def get_gdbgui_auth_user_credentials(auth_file, user, password):
    if auth_file and (user or password):
        print("Cannot supply auth file and username/password")
        exit(1)
    if auth_file:
        if os.path.isfile(auth_file):
            with open(auth_file, "r") as authFile:
                data = authFile.read()
                split_file_contents = data.split("\n")
                if len(split_file_contents) < 2:
                    print(
                        'Auth file "%s" requires username on first line and password on second line'
                        % auth_file
                    )
                    exit(1)
                return split_file_contents

        else:
            print('Auth file "%s" for HTTP Basic auth not found' % auth_file)
            exit(1)
    elif user and password:
        return [user, password]

    else:
        return None


def get_parser():
    parser = argparse.ArgumentParser(description=__doc__)

    gdb_group = parser.add_argument_group(title="gdb settings")
    args_group = parser.add_mutually_exclusive_group()
    network = parser.add_argument_group(title="gdbgui network settings")
    security = parser.add_argument_group(title="security settings")
    other = parser.add_argument_group(title="other settings")

    gdb_group.add_argument(
        "-g",
        "--gdb",
        help="Path to debugger. Default: %s" % DEFAULT_GDB_EXECUTABLE,
        default=DEFAULT_GDB_EXECUTABLE,
    )
    gdb_group.add_argument(
        "--gdb-args",
        help=(
            "Arguments passed directly to gdb when gdb is invoked. "
            'For example,--gdb-args="--nx --tty=/dev/ttys002"'
        ),
        default="",
    )
    gdb_group.add_argument(
        "--rr",
        action="store_true",
        help=(
            "Use `rr replay` instead of gdb. Replays last recording by default. "
            "Replay arbitrary recording by passing recorded directory as an argument. "
            "i.e. gdbgui /recorded/dir --rr. See http://rr-project.org/."
        ),
    )
    network.add_argument(
        "-p",
        "--port",
        help="The port on which gdbgui will be hosted. Default: %s" % DEFAULT_PORT,
        default=DEFAULT_PORT,
    )
    network.add_argument(
        "--host",
        help="The host ip address on which gdbgui serve. Default: %s" % DEFAULT_HOST,
        default=DEFAULT_HOST,
    )
    network.add_argument(
        "-r",
        "--remote",
        help="Shortcut to set host to 0.0.0.0 and suppress browser from opening. This allows remote access "
        "to gdbgui and is useful when running on a remote machine that you want to view/debug from your local "
        "browser, or let someone else debug your application remotely.",
        action="store_true",
    )

    security.add_argument(
        "--auth-file",
        help="Require authentication before accessing gdbgui in the browser. "
        "Specify a file that contains the HTTP Basic auth username and password separate by newline. ",
    )

    security.add_argument("--user", help="Username when authenticating")
    security.add_argument("--password", help="Password when authenticating")
    security.add_argument(
        "--key",
        default=None,
        help="SSL private key. "
        "Generate with:"
        "openssl req -newkey rsa:2048 -nodes -keyout host.key -x509 -days 365 -out host.cert",
    )
    # https://www.digitalocean.com/community/tutorials/openssl-essentials-working-with-ssl-certificates-private-keys-and-csrs
    security.add_argument(
        "--cert",
        default=None,
        help="SSL certificate. "
        "Generate with:"
        "openssl req -newkey rsa:2048 -nodes -keyout host.key -x509 -days 365 -out host.cert",
    )
    # https://www.digitalocean.com/community/tutorials/openssl-essentials-working-with-ssl-certificates-private-keys-and-csrs

    other.add_argument(
        "--remap-sources",
        "-m",
        help=(
            "Replace compile-time source paths to local source paths. "
            "Pass valid JSON key/value pairs."
            'i.e. --remap-sources=\'{"/buildmachine": "/home/chad"}\''
        ),
    )
    other.add_argument(
        "--project",
        help='Set the project directory. When viewing the "folders" pane, paths are shown relative to this directory.',
    )
    other.add_argument("-v", "--version", help="Print version", action="store_true")

    other.add_argument(
        "--hide-gdbgui-upgrades",
        help=argparse.SUPPRESS,  # deprecated. left so calls to gdbgui don't break
        action="store_true",
    )
    other.add_argument(
        "-n",
        "--no-browser",
        help="By default, the browser will open with gdbgui. Pass this flag so the browser does not open.",
        action="store_true",
    )
    other.add_argument(
        "-b",
        "--browser",
        help="Use the given browser executable instead of the system default.",
        default=None,
    )
    other.add_argument(
        "--debug",
        help="The debug flag of this Flask application. "
        "Pass this flag when debugging gdbgui itself to automatically reload the server when changes are detected",
        action="store_true",
    )

    args_group.add_argument(
        "cmd",
        nargs="?",
        type=lambda prog: [prog],
        help="The executable file and any arguments to pass to it."
        " To pass flags to the binary, wrap in quotes, or use --args instead."
        " Example: gdbgui ./mybinary [other-gdbgui-args...]"
        " Example: gdbgui './mybinary myarg -flag1 -flag2' [other gdbgui args...]",
        default=[],
    )
    args_group.add_argument(
        "--args",
        nargs=argparse.REMAINDER,
        help="Specify the executable file and any arguments to pass to it. All arguments are"
        " taken literally, so if used, this must be the last argument"
        " passed to gdbgui."
        " Example: gdbgui [...] --args ./mybinary myarg -flag1 -flag2",
        default=[],
    )
    return parser


def main():
    """Entry point from command line"""
    parser = get_parser()
    args = parser.parse_args()

    if args.debug:
        logger.setLevel(logging.NOTSET)

    if args.version:
        print(__version__)
        return

    cmd = args.cmd or args.args

    if args.no_browser and args.browser:
        print("Cannot specify no-browser and browser. Must specify one or the other.")
        exit(1)

    app.config["initial_binary_and_args"] = cmd
    app.config["gdb_args"] = shlex.split(args.gdb_args)
    app.config["rr"] = args.rr
    app.config["gdb_path"] = args.gdb
    app.config["gdbgui_auth_user_credentials"] = get_gdbgui_auth_user_credentials(
        args.auth_file, args.user, args.password
    )
    app.config["project_home"] = args.project
    if args.remap_sources:
        try:
            app.config["remap_sources"] = json.loads(args.remap_sources)
        except json.decoder.JSONDecodeError as e:
            print(
                "The '--remap-sources' argument must be valid JSON. See gdbgui --help."
            )
            print(e)
            exit(1)

    verify_gdb_exists(app.config["gdb_path"])
    if args.remote:
        args.host = "0.0.0.0"
        args.no_browser = True
        if app.config["gdbgui_auth_user_credentials"] is None:
            print(
                "Warning: authentication is recommended when serving on a publicly "
                "accessible IP address. See gdbgui --help."
            )

    if warn_startup_with_shell_off(platform.platform().lower(), args.gdb_args):
        logger.warning(
            "You may need to set startup-with-shell off when running on a mac. i.e.\n"
            "  gdbgui --gdb-args='--init-eval-command=\"set startup-with-shell off\"'\n"
            "see http://stackoverflow.com/questions/39702871/gdb-kind-of-doesnt-work-on-macos-sierra\n"
            "and https://sourceware.org/gdb/onlinedocs/gdb/Starting.html"
        )

    setup_backend(
        serve=True,
        host=args.host,
        port=int(args.port),
        debug=bool(args.debug),
        open_browser=(not args.no_browser),
        browsername=args.browser,
        private_key=args.key,
        certificate=args.cert,
    )


def warn_startup_with_shell_off(platform, gdb_args):
    """return True if user may need to turn shell off
    if mac OS version is 16 (sierra) or higher, may need to set shell off due
    to os's security requirements
    http://stackoverflow.com/questions/39702871/gdb-kind-of-doesnt-work-on-macos-sierra
    """
    darwin_match = re.match("darwin-(\d+)\..*", platform)
    on_darwin = darwin_match is not None and int(darwin_match.groups()[0]) >= 16
    if on_darwin:
        shell_is_off = "startup-with-shell off" in gdb_args
        return not shell_is_off
    return False


if __name__ == "__main__":
    main()
