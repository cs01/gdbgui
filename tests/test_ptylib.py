from gdbgui.server import ptylib

import os


def test_pty():
    pty = ptylib.Pty()
    assert pty.name
    os.write(pty.stdin, "hello".encode())
    output = os.read(pty.stdout, 1024).decode()
    assert output == "hello"
