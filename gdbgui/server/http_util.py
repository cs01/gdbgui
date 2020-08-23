from flask import request, session, Response
import binascii
import os


def add_csrf_token_to_session():
    if "csrf_token" not in session:
        session["csrf_token"] = binascii.hexlify(os.urandom(20)).decode("utf-8")
