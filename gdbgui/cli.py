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
from typing import List, Optional

from gdbgui import __version__
from gdbgui.server.app import app, socketio
from gdbgui.server.constants import DEFAULT_GDB_EXECUTABLE, DEFAULT_HOST, DEFAULT_PORT
from gdbgui.server.server import run_server


logger = logging.getLogger(__name__)
logging.getLogger("werkzeug").setLevel(logging.ERROR)


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


def get_parser():
    parser = argparse.ArgumentParser(
        description=__doc__, formatter_class=argparse.ArgumentDefaultsHelpFormatter
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
        "--host", help="The host ip address on which gdbgui serve", default=DEFAULT_HOST
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
            "  gdbgui --gdb-cmd='gdb --init-eval-command=\"set startup-with-shell off\"'\n"
            "see http://stackoverflow.com/questions/39702871/gdb-kind-of-doesnt-work-on-macos-sierra\n"
            "and https://sourceware.org/gdb/onlinedocs/gdb/Starting.html"
        )

    logger.setLevel(logging.DEBUG if args.debug else logging.INFO)

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


if __name__ == "__main__":
    main()
