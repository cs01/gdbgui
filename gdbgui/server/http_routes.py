import json
import logging
import os

from flask import (
    Blueprint,
    current_app,
    jsonify,
    redirect,
    render_template,
    request,
    session,
    Response,
)
from flask.helpers import send_from_directory
from pygments.lexers import get_lexer_for_filename  # type: ignore

from gdbgui import htmllistformatter, __version__

from .constants import STATIC_DIR, USING_WINDOWS, SIGNAL_NAME_TO_OBJ
from .http_util import (
    authenticate,
    client_error,
)

logger = logging.getLogger(__file__)
blueprint = Blueprint(
    "http_routes",
    __name__,
    static_folder=str(STATIC_DIR),
    static_url_path="",
)


@blueprint.route("/read_file", methods=["GET", "POST"])
def read_file():
    """Read a file and return its contents as an array"""
    data = request.get_json()
    path = data["path"]
    start_line = int(data["start_line"])
    start_line = max(1, start_line)  # make sure it's not negative
    end_line = int(data["end_line"])
    should_highlight = data["highlight"]

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

            if lexer and should_highlight:
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


@blueprint.route("/get_last_modified_unix_sec", methods=["GET"])
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


@blueprint.route("/help")
def help_route():
    return redirect("https://github.com/cs01/gdbgui/blob/master/HELP.md")


@blueprint.route("/dashboard", methods=["GET"])
@authenticate
def dashboard():
    manager = current_app.config.get("_manager")

    """display a dashboard with a list of all running gdb processes
    and ability to kill them, or open a new tab to work with that
    GdbController instance"""
    return render_template(
        "dashboard.html",
        gdbgui_sessions=manager.get_dashboard_data(),
        default_command=current_app.config["gdb_command"],
    )


@blueprint.route("/", methods=["GET"])
@authenticate
def gdbgui():
    return send_from_directory(STATIC_DIR, "index.html")


@blueprint.route("/initial_data", methods=["GET"])
@authenticate
def get_initial_data():
    return jsonify(
        {
            "gdb_command": current_app.config["gdb_command"],
            "gdbgui_version": __version__,
            "initial_binary_and_args": current_app.config["initial_binary_and_args"],
            "project_home": current_app.config["project_home"],
            "remap_sources": current_app.config["remap_sources"],
            "signals": SIGNAL_NAME_TO_OBJ,
            "using_windows": USING_WINDOWS,
        }
    )
    # return send_from_directory(STATIC_DIR, "index.html")


#     return app.send_static_file(path)


#     gdbpid = request.args.get("gdbpid", 0)
#     gdb_command = request.args.get("gdb_command", current_app.config["gdb_command"])
#     add_csrf_token_to_session()

#     THEMES = ["monokai", "light"]
#     initial_data = {
#         "csrf_token": session["csrf_token"],
#         "gdbgui_version": __version__,
#         "gdbpid": gdbpid,
#         "gdb_command": gdb_command,
# "initial_binary_and_args": current_app.config["initial_binary_and_args"],
# "project_home": current_app.config["project_home"],
# "remap_sources": current_app.config["remap_sources"],
#         "themes": THEMES,
# "signals": SIGNAL_NAME_TO_OBJ,
# "using_windows": USING_WINDOWS,
#     }

#     return render_template(
#         "gdbgui.html",
#         version=__version__,
#         debug=current_app.debug,
#         initial_data=initial_data,
#         themes=THEMES,
#     )


@blueprint.route("/dashboard_data", methods=["GET"])
@authenticate
def dashboard_data():
    manager = current_app.config.get("_manager")

    return jsonify(manager.get_dashboard_data())


@blueprint.route("/kill_session", methods=["PUT"])
@authenticate
def kill_session():
    from .app import manager

    pid = request.json.get("gdbpid")
    if pid:
        manager.remove_debug_session_by_pid(pid)
        return jsonify({"success": True})
    else:
        return Response(
            "Missing required parameter: gdbpid",
            401,
        )


@blueprint.route("/send_signal_to_pid", methods=["POST"])
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
