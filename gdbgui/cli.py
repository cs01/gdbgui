#!/usr/bin/env python

"""
A server that provides a graphical user interface to the gnu debugger (gdb).
https://github.com/cs01/gdbgui
"""

import argparse
import json
import logging
import os
import platform
import re
import shlex
import traceback
from typing import Dict, List, Optional

from flask import Response, abort, jsonify, render_template, request, session
from flask_socketio import SocketIO, emit  # type: ignore

from gdbgui import __version__

from .server.app import app, manager
from .server.constants import (
    DEFAULT_GDB_EXECUTABLE,
    DEFAULT_HOST,
    DEFAULT_PORT,
    SIGNAL_NAME_TO_OBJ,
    USING_WINDOWS,
)
from .server.http_util import (
    add_csrf_token_to_session,
    authenticate,
    is_cross_origin,
)
from .server.server import run_server
from .server.sessionmanager import DebugSession

logger = logging.getLogger(__name__)
logger.setLevel(logging.WARNING)
logging.basicConfig(format="(%(asctime)s) %(msg)s")


socketio = SocketIO(manage_session=False)


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

    run_server(
        app=app,
        socketio=socketio,
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
