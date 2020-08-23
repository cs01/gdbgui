from flask import Blueprint, render_template, request, session, jsonify, abort
from .constants import TEMPLATE_DIR, SIGNAL_NAME_TO_OBJ, USING_WINDOWS
from gdbgui import __version__
from .http_util import is_cross_origin
import logging

logger = logging.getLogger(__file__)
blueprint = Blueprint("http_routes", __name__, template_folder=TEMPLATE_DIR)
