"""
Unit tests

Run from top level directory: ./tests/test_app.py

See more on testing Flask apps: http://flask.pocoo.org/docs/0.11/testing/
"""

import unittest
from gdbgui import backend
import json
import sys
from flask import Flask, session, request
from flask_socketio import SocketIO, send


PYTHON3 = sys.version_info.major == 3

backend.setup_backend(testing=True)
socketio = backend.socketio

@socketio.on('connect')
def on_connect():
    send('connected')


class TestWebsockets(unittest.TestCase):
    @classmethod
    def setUp(self):
        pass

    def tearDown(self):
        pass

    def test_connect(self):
        client = socketio.test_client(backend.app)
        received = client.get_received()
        self.assertEqual(len(received), 1)
        self.assertEqual(received[0]['args'], 'connected')
        client.disconnect()


class Test(unittest.TestCase):

    def setUp(self):
        """Built-in to unittest.TestCase"""
        self.app = backend.app.test_client()

    def tearDown(self):
        """Built-in to unittest.TestCase"""
        pass

    def test_run_gui(self):
        response = self.app.get('/')
        assert response.status_code == 200
        data = response.data.decode() if PYTHON3 else response.data
        assert '<html>' in data

    def test_run_gdb_command_string(self):
        response = self.app.post('/run_gdb_command', data={'cmd': 'file no-such-file'})
        self.assert_successful_response(response)

    def test_run_gdb_command_list(self):
        response = self.app.post('/run_gdb_command', data={'cmd': ['file no-such-file', 'file no-such-file']})
        self.assert_successful_response(response)

    def assert_successful_response(self, response, expected_type=list, expected_val=None):
        data = response.data.decode() if PYTHON3 else response.data
        json_response = json.loads(data)
        assert response.status_code == 200, json_response
        assert type(json_response) == expected_type, json_response


def main():
    loader = unittest.TestLoader()
    suite = unittest.TestSuite()

    suite.addTests(loader.loadTestsFromTestCase(TestWebsockets))
    suite.addTests(loader.loadTestsFromTestCase(Test))

    runner = unittest.TextTestRunner(verbosity=1)
    result = runner.run(suite)
    return len(result.errors) + len(result.failures)


if __name__ == '__main__':
    main()
