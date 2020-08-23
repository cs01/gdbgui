from .constants import TEMPLATE_DIR, STATIC_DIR, DEFAULT_GDB_EXECUTABLE
import binascii
import os
from flask import Flask
from flask_compress import Compress  # type: ignore

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
