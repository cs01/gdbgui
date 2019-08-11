"""
Unit tests

Run from top level directory: ./tests/test_app.py

See more on testing Flask apps: http://flask.pocoo.org/docs/0.11/testing/
"""

import unittest
from gdbgui import backend
import sys
from flask_socketio import send, SocketIO  # type: ignore


PYTHON3 = sys.version_info.major == 3

backend.setup_backend(testing=True)
socketio = backend.socketio


class TestWebsockets(unittest.TestCase):
    @classmethod
    def setUp(self):
        pass

    def tearDown(self):
        pass

    def test_connect(self):
        app = backend.app
        socketio = SocketIO()

        @socketio.on("connect")
        def on_connect():
            send({"connected": "foo"}, json=True)

        socketio.init_app(app, cookie="foo")
        client = socketio.test_client(app)
        received = client.get_received()
        self.assertEqual(len(received), 1)
        self.assertEqual(received[0]["args"], {"connected": "foo"})


class Test(unittest.TestCase):
    def setUp(self):
        """Built-in to unittest.TestCase"""
        self.app = backend.app.test_client()

    def tearDown(self):
        """Built-in to unittest.TestCase"""
        pass

    def test_load_main_page(self):
        response = self.app.get("/")
        assert response.status_code == 200
        data = response.data.decode() if PYTHON3 else response.data
        assert "<!DOCTYPE html>" in data


class TestSocketError(unittest.TestCase):
    def test_same_port(self):
        backend.setup_backend(testing=True)


def main():
    loader = unittest.TestLoader()
    suite = unittest.TestSuite()

    # commented out for now, seems to be a flask_socketio issue
    # https://github.com/miguelgrinberg/Flask-SocketIO/issues/405
    suite.addTests(loader.loadTestsFromTestCase(TestWebsockets))
    suite.addTests(loader.loadTestsFromTestCase(Test))
    suite.addTests(loader.loadTestsFromTestCase(TestSocketError))

    runner = unittest.TextTestRunner(verbosity=1)
    result = runner.run(suite)
    return len(result.errors) + len(result.failures)


if __name__ == "__main__":
    main()
