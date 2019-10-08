from gdbgui import backend
from flask_socketio import send, SocketIO  # type: ignore
import pytest  # type: ignore


backend.setup_backend(testing=True)
socketio = backend.socketio


def test_connect():
    app = backend.app
    socketio = SocketIO()

    @socketio.on("connect")
    def on_connect():
        send({"connected": "foo"}, json=True)

    socketio.init_app(app, cookie="foo")
    client = socketio.test_client(app)
    received = client.get_received()
    assert len(received) == 1
    assert received[0]["args"] == {"connected": "foo"}


@pytest.fixture
def test_client():
    return backend.app.test_client()


def test_load_main_page(test_client):
    response = test_client.get("/")
    assert response.status_code == 200
    assert "<!DOCTYPE html>" in response.data.decode()


def test_same_port():
    backend.setup_backend(testing=True)
