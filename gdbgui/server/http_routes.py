from flask import (
    Blueprint,
    current_app,
    render_template,
    request,
    session,
    jsonify,
    abort,
)
from .constants import TEMPLATE_DIR, SIGNAL_NAME_TO_OBJ, USING_WINDOWS
from gdbgui import __version__
from .http_util import is_cross_origin, csrf_protect, client_error
import logging
import json
import os
from pygments.lexers import get_lexer_for_filename  # type: ignore
from gdbgui import __version__, htmllistformatter

logger = logging.getLogger(__file__)
blueprint = Blueprint("http_routes", __name__, template_folder=TEMPLATE_DIR)


@blueprint.route("/read_file", methods=["GET"])
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
        if current_app.debug:
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

