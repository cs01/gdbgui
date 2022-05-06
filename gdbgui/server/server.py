import os
import socket
import webbrowser

from .constants import DEFAULT_HOST, DEFAULT_PORT, colorize

try:
    from gdbgui.SSLify import SSLify, get_ssl_context  # noqa
except ImportError:
    print("Warning: Optional SSL support is not available")

    def get_ssl_context(private_key, certificate):  # noqa
        return None


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


def run_server(
    *,
    app=None,
    socketio=None,
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

    socketio.server_options["allow_upgrades"] = False
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
