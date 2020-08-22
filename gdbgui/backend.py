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
import signal
import socket
import shlex
import sys
import traceback
import webbrowser
from functools import wraps
from typing import Dict, List, Optional
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
from flask_compress import Compress  # type: ignore
from flask_socketio import SocketIO, emit  # type: ignore
from pygments.lexers import get_lexer_for_filename  # type: ignore

from gdbgui import __version__, htmllistformatter
from gdbgui.sessionmanager import SessionManager, DebugSession

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
logging.basicConfig(format="(%(asctime)s) %(msg)s")


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
app.config["gdb_command"] = None
app.config["TEMPLATES_AUTO_RELOAD"] = True
app.config["project_home"] = None
app.config["remap_sources"] = {}
app.secret_key = binascii.hexlify(os.urandom(24)).decode("utf-8")


@app.before_request
def csrf_protect_all_post_and_cross_origin_requests():
    """returns None upon success"""
    success = None

    if is_cross_origin(request):
        logger.warning("Received cross origin request. Aborting")
        abort(403)
    if request.method in ["POST", "PUT"]:
        server_token = session.get("csrf_token")
        if server_token == request.form.get("csrf_token"):
            return success
        elif server_token == request.environ.get("HTTP_X_CSRFTOKEN"):
            return success
        elif request.json and server_token == request.json.get("csrf_token"):
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


socketio = SocketIO(manage_session=False)
manager = SessionManager(app.config)


def setup_backend(
    *,
    host=DEFAULT_HOST,
    port=DEFAULT_PORT,
    debug=False,
    open_browser=True,
    browsername=None,
    testing=False,
    private_key=None,
    certificate=None,
):
    """Run the server of the gdb gui"""

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
            print(colorize(f"View gdbgui at {protocol}{url[0]}:{url[1]}"))
        print(
            colorize(f"View gdbgui dashboard at {protocol}{url[0]}:{url[1]}/dashboard")
        )

        print("exit gdbgui by pressing CTRL+C")

        try:
            socketio.run(
                app,
                debug=debug,
                port=int(port),
                host=host,
                extra_files=get_extra_files(),
                **kwargs,
            )
        except KeyboardInterrupt:
            # Process was interrupted by ctrl+c on keyboard, show message
            pass


def colorize(text):
    if IS_A_TTY and not USING_WINDOWS:
        return "\033[1;32m" + text + "\x1b[0m"

    else:
        return text


@socketio.on("connect", namespace="/gdb_listener")
def client_connected():
    """Connect a websocket client to a debug session

    This is the main intial connection.

    Depending on the arguments passed, the client will connect
    to an existing debug session, or create a new one.
    A message is a emitted back to the client with details on
    the debug session that was created or connected to.
    """
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

    desired_gdbpid = int(request.args.get("gdbpid", 0))
    try:
        if desired_gdbpid:
            # connect to exiting debug session
            debug_session = manager.connect_client_to_debug_session(
                desired_gdbpid=desired_gdbpid, client_id=request.sid
            )
            emit(
                "debug_session_connection_event",
                {
                    "ok": True,
                    "started_new_gdb_process": False,
                    "pid": debug_session.pid,
                    "message": f"Connected to existing gdb process {desired_gdbpid}",
                },
            )
        else:
            # start new debug session
            gdb_command = request.args.get("gdb_command", app.config["gdb_command"])
            mi_version = request.args.get("mi_version", "mi2")
            debug_session = manager.add_new_debug_session(
                gdb_command=gdb_command, mi_version=mi_version, client_id=request.sid
            )
            emit(
                "debug_session_connection_event",
                {
                    "ok": True,
                    "started_new_gdb_process": True,
                    "message": f"Started new gdb process, pid {debug_session.pid}",
                    "pid": debug_session.pid,
                },
            )
    except Exception as e:
        emit(
            "debug_session_connection_event",
            {"message": f"Failed to establish gdb session: {e}", "ok": False},
        )

    # Make sure there is a reader thread reading. One thread reads all instances.
    if manager.gdb_reader_thread is None:
        manager.gdb_reader_thread = socketio.start_background_task(
            target=read_and_forward_gdb_and_pty_output
        )
        logger.info("Created background thread to read gdb responses")


@socketio.on("pty_interaction", namespace="/gdb_listener")
def pty_interaction(message):
    """Write a character to the user facing pty"""
    debug_session = manager.debug_session_from_client_id(request.sid)
    if not debug_session:
        emit(
            "error_running_gdb_command",
            {"message": f"no gdb session available for client id {request.sid}"},
        )
        return

    try:
        data = message.get("data")
        pty_name = data.get("pty_name")
        if pty_name == "user_pty":
            pty = debug_session.pty_for_gdb
        elif pty_name == "program_pty":
            pty = debug_session.pty_for_debugged_program
        else:
            raise ValueError(f"Unknown pty: {pty_name}")

        action = data.get("action")
        if action == "write":
            key = data["key"]
            pty.write(key)
        elif action == "set_winsize":
            pty.set_winsize(data["rows"], data["cols"])
        else:
            raise ValueError(f"Unknown action {action}")
    except Exception:
        err = traceback.format_exc()
        logger.error(err)
        emit("error_running_gdb_command", {"message": err})


@socketio.on("run_gdb_command", namespace="/gdb_listener")
def run_gdb_command(message: Dict[str, str]):
    """Write commands to gdbgui's gdb mi pty"""
    client_id = request.sid  # type: ignore
    debug_session = manager.debug_session_from_client_id(client_id)
    if not debug_session:
        emit("error_running_gdb_command", {"message": "no session"})
        return
    pty_mi = debug_session.pygdbmi_controller
    if pty_mi is not None:
        try:
            # the command (string) or commands (list) to run
            cmds = message["cmd"]
            for cmd in cmds:
                pty_mi.write(
                    cmd + "\n",
                    timeout_sec=0,
                    raise_error_on_timeout=False,
                    read_response=False,
                )

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

    orphaned_client_ids = manager.remove_debug_session_by_pid(gdbpid)
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
    manager.disconnect_client(request.sid)
    logger.info("Client websocket disconnected, id %s" % (request.sid))


@socketio.on("Client disconnected")
def test_disconnect():
    print("Client websocket disconnected", request.sid)


def read_and_forward_gdb_and_pty_output():
    """A task that runs on a different thread, and emits websocket messages
    of gdb responses"""

    while True:
        socketio.sleep(0.05)
        debug_sessions_to_remove = []
        for debug_session, client_ids in manager.debug_session_to_client_ids.items():
            try:
                try:
                    response = debug_session.pygdbmi_controller.get_gdb_response(
                        timeout_sec=0, raise_error_on_timeout=False
                    )

                except Exception:
                    response = None
                    send_msg_to_clients(
                        client_ids,
                        "The underlying gdb process has been killed. This tab will no longer function as expected.",
                        error=True,
                    )
                    debug_sessions_to_remove.append(debug_session)

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

        debug_sessions_to_remove += check_and_forward_pty_output()
        for debug_session in set(debug_sessions_to_remove):
            manager.remove_debug_session(debug_session)


def check_and_forward_pty_output() -> List[DebugSession]:
    debug_sessions_to_remove = []
    for debug_session, client_ids in manager.debug_session_to_client_ids.items():
        try:
            response = debug_session.pty_for_gdb.read()
            if response is not None:
                for client_id in client_ids:
                    socketio.emit(
                        "user_pty_response",
                        response,
                        namespace="/gdb_listener",
                        room=client_id,
                    )

            response = debug_session.pty_for_debugged_program.read()
            if response is not None:
                for client_id in client_ids:
                    socketio.emit(
                        "program_pty_response",
                        response,
                        namespace="/gdb_listener",
                        room=client_id,
                    )
        except Exception as e:
            debug_sessions_to_remove.append(debug_session)
            for client_id in client_ids:
                socketio.emit(
                    "fatal_server_error",
                    {"message": str(e)},
                    namespace="/gdb_listener",
                    room=client_id,
                )
            logger.error(e, exc_info=True)
    return debug_sessions_to_remove


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
    gdbpid = request.args.get("gdbpid", 0)
    gdb_command = request.args.get("gdb_command", app.config["gdb_command"])
    add_csrf_token_to_session()

    THEMES = ["monokai", "light"]
    initial_data = {
        "csrf_token": session["csrf_token"],
        "gdbgui_version": __version__,
        "gdbpid": gdbpid,
        "gdb_command": gdb_command,
        "initial_binary_and_args": app.config["initial_binary_and_args"],
        "project_home": app.config["project_home"],
        "remap_sources": app.config["remap_sources"],
        "themes": THEMES,
        "signals": SIGNAL_NAME_TO_OBJ,
        "using_windows": USING_WINDOWS,
    }

    return render_template(
        "gdbgui.html",
        version=__version__,
        debug=app.debug,
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
        gdbgui_sessions=manager.get_dashboard_data(),
        csrf_token=session["csrf_token"],
        default_command=app.config["gdb_command"],
    )


@app.route("/dashboard_data", methods=["GET"])
@authenticate
def dashboard_data():
    return jsonify(manager.get_dashboard_data())


@app.route("/kill_session", methods=["PUT"])
@authenticate
def kill_session():
    pid = request.json.get("gdbpid")
    if pid:
        manager.remove_debug_session_by_pid(pid)
        return jsonify({"success": True})
    else:
        return Response("Missing required parameter: gdbpid", 401,)


@app.route("/help")
def help_route():
    return redirect("https://github.com/cs01/gdbgui/blob/master/HELP.md")


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
                True  # highlight argument was invalid for some reason, default to true
            )

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
    parser = argparse.ArgumentParser(
        description=__doc__, formatter_class=argparse.ArgumentDefaultsHelpFormatter,
    )

    gdb_group = parser.add_argument_group(title="gdb settings")
    args_group = parser.add_mutually_exclusive_group()
    network = parser.add_argument_group(title="gdbgui network settings")
    security = parser.add_argument_group(title="security settings")
    other = parser.add_argument_group(title="other settings")

    gdb_group.add_argument(
        "-g",
        "--gdb-cmd",
        help="""
        gdb binary and arguments to run. If passing arguments,
        enclose in quotes.
        If using rr, it should be specified here with
        'rr replay'.
        Examples: gdb, /path/to/gdb, 'gdb --command=FILE -ix', 'rr replay'

        """,
        default=DEFAULT_GDB_EXECUTABLE,
    )
    network.add_argument(
        "-p",
        "--port",
        help="The port on which gdbgui will be hosted",
        default=DEFAULT_PORT,
    )
    network.add_argument(
        "--host",
        help="The host ip address on which gdbgui serve",
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
            'i.e. --remap-sources=\'{"/buildmachine": "/current/machine"}\''
        ),
    )
    other.add_argument(
        "--project",
        help='Set the project directory. When viewing the "folders" pane, paths are shown relative to this directory.',
    )
    other.add_argument("-v", "--version", help="Print version", action="store_true")

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
        "debug_program",
        nargs="?",
        help="The executable file you wish to debug, and any arguments to pass to it."
        " To pass flags to the binary, wrap in quotes, or use --args instead."
        " Example: gdbgui ./mybinary [other-gdbgui-args...]"
        " Example: gdbgui './mybinary myarg -flag1 -flag2' [other gdbgui args...]",
        default=None,
    )
    args_group.add_argument(
        "--args",
        nargs=argparse.REMAINDER,
        help="Specify the executable file you wish to debug and any arguments to pass to it. All arguments are"
        " taken literally, so if used, this must be the last argument. This can also be specified later in the frontend."
        " passed to gdbgui."
        " Example: gdbgui [...] --args ./mybinary myarg -flag1 -flag2",
        default=[],
    )
    return parser


def get_initial_binary_and_args(
    user_supplied_args: List[str], debug_program_and_args: Optional[str]
) -> List[str]:
    if debug_program_and_args:
        # passed via positional
        return shlex.split(debug_program_and_args)
    else:
        # passed via --args
        return user_supplied_args


def main():
    """Entry point from command line"""
    parser = get_parser()
    args = parser.parse_args()
    if args.version:
        print(__version__)
        return

    if args.no_browser and args.browser:
        print("Cannot specify no-browser and browser. Must specify one or the other.")
        exit(1)

    app.config["gdb_command"] = args.gdb_cmd
    app.config["initial_binary_and_args"] = get_initial_binary_and_args(
        args.args, args.debug_program
    )
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

    if args.remote:
        args.host = "0.0.0.0"
        args.no_browser = True
        if app.config["gdbgui_auth_user_credentials"] is None:
            print(
                "Warning: authentication is recommended when serving on a publicly "
                "accessible IP address. See gdbgui --help."
            )

    if warn_startup_with_shell_off(platform.platform().lower(), args.gdb_cmd):
        logger.warning(
            "You may need to set startup-with-shell off when running on a mac. i.e.\n"
            "  gdbgui --gdb-args='--init-eval-command=\"set startup-with-shell off\"'\n"
            "see http://stackoverflow.com/questions/39702871/gdb-kind-of-doesnt-work-on-macos-sierra\n"
            "and https://sourceware.org/gdb/onlinedocs/gdb/Starting.html"
        )

    setup_backend(
        host=args.host,
        port=int(args.port),
        debug=bool(args.debug),
        open_browser=(not args.no_browser),
        browsername=args.browser,
        private_key=args.key,
        certificate=args.cert,
    )


def warn_startup_with_shell_off(platform: str, gdb_args: str):
    """return True if user may need to turn shell off
    if mac OS version is 16 (sierra) or higher, may need to set shell off due
    to os's security requirements
    http://stackoverflow.com/questions/39702871/gdb-kind-of-doesnt-work-on-macos-sierra
    """
    darwin_match = re.match(r"darwin-(\d+)\..*", platform)
    on_darwin = darwin_match is not None and int(darwin_match.groups()[0]) >= 16
    if on_darwin:
        shell_is_off = "startup-with-shell off" in gdb_args
        return not shell_is_off
    return False


if __name__ == "__main__":
    main()
