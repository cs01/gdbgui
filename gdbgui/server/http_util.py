from flask import request, session, Response
import binascii
import os
import logging
from functools import wraps

logger = logging.getLogger(__file__)


def add_csrf_token_to_session():
    if "csrf_token" not in session:
        session["csrf_token"] = binascii.hexlify(os.urandom(20)).decode("utf-8")


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
