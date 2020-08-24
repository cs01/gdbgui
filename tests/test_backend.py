from flask_socketio import send, SocketIO  # type: ignore
import pytest  # type: ignore

from gdbgui.server.server import run_server
from gdbgui.server.app import app, socketio
from gdbgui import cli

run_server(testing=True, app=app, socketio=socketio)


def test_connect():
    test_ws = SocketIO()

    @test_ws.on("connect")
    def on_connect():
        send({"connected": "foo"}, json=True)

    test_ws.init_app(app, cookie="foo")
    client = test_ws.test_client(app)
    received = client.get_received()
    assert len(received) == 1
    assert received[0]["args"] == {"connected": "foo"}


@pytest.fixture
def test_client():
    return app.test_client()


def test_load_main_page(test_client):
    response = test_client.get("/")
    assert response.status_code == 200
    assert "<!DOCTYPE html>" in response.data.decode()


def test_load_dashboard(test_client):
    response = test_client.get("/dashboard")
    assert response.status_code == 200
    assert "<!DOCTYPE html>" in response.data.decode()


def test_cant_load_bad_url(test_client):
    response = test_client.get("/asdf")
    assert response.status_code == 404
    assert "404 Not Found" in response.data.decode()


def test_same_port():
    run_server(testing=True, app=app, socketio=socketio)


def test_get_initial_binary_and_args():
    assert cli.get_initial_binary_and_args([], "./program --args") == [
        "./program",
        "--args",
    ]
    assert cli.get_initial_binary_and_args(["./program", "--args",], None) == [
        "./program",
        "--args",
    ]
