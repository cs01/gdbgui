import binascii
import logging
import os

from flask import Flask, abort, request, session
from flask_compress import Compress  # type: ignore

from .constants import DEFAULT_GDB_EXECUTABLE, STATIC_DIR, TEMPLATE_DIR
from .http_routes import blueprint
from .http_util import is_cross_origin
from .sessionmanager import SessionManager

logger = logging.getLogger(__file__)
# Create flask application and add some configuration keys to be used in various callbacks
app = Flask(__name__, template_folder=TEMPLATE_DIR, static_folder=STATIC_DIR)
# app.register_blueprint(blueprint)
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
app.register_blueprint(blueprint)

manager = SessionManager(app.config)


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
