import binascii
import logging
import os
from functools import wraps

from flask import Response, abort, current_app, jsonify, request, session

logger = logging.getLogger(__file__)


def client_error(obj):
    return jsonify(obj), 400


def authenticate(f):
    @wraps(f)
    def wrapper(*args, **kwargs):
        if current_app.config.get("gdbgui_auth_user_credentials") is not None:
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


def credentials_are_valid(username, password):
    user_credentials = current_app.config.get("gdbgui_auth_user_credentials")
    if user_credentials is None:
        return False

    elif len(user_credentials) < 2:
        return False

    return user_credentials[0] == username and user_credentials[1] == password
