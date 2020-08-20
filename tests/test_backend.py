from gdbgui import backend
from flask_socketio import send, SocketIO  # type: ignore
import pytest  # type: ignore
import asyncio
from threading import Thread
import time
import re

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

async def run(cmd):
    proc = await asyncio.create_subprocess_shell(
        cmd,
        stdout=asyncio.subprocess.PIPE,
        stderr=asyncio.subprocess.PIPE)

    stdout, stderr = await proc.communicate()

    print(f'[{cmd!r} exited with {proc.returncode}]')
    if stdout:
        print(f'[stdout]\n{stdout.decode()}')
    if stderr:
        print(f'[stderr]\n{stderr.decode()}')

def run_it_forever(loop):
    loop.run_forever()

def check_run_and_wait_for_brakpoint(target_bkt,target_runs,test_client_socketio):
    num_breakpoint_hit = 0
    num_running = 0
    while num_breakpoint_hit < target_bkt or num_running < target_runs:
        backend.process_controllers_out()
        messages = test_client_socketio.get_received(namespace="/gdb_listener")

        for i in range(0, len(messages)):
            for arg in messages[i]["args"][0]:
                if arg["message"] == "running" and arg["type"] == "result":
                    num_running += 1
                if arg["message"] == "stopped" and (arg["payload"]["reason"] == "breakpoint-hit" or arg["payload"]["reason"] == "end-stepping-range"):
                    num_breakpoint_hit += 1
                if arg["message"] == None and "exited" in arg["payload"]:
                    num_breakpoint_hit += 1
    return num_breakpoint_hit, num_running


def test_load_mpi_program(test_client):
    response = test_client.get("/")
    assert response.status_code == 200
    assert "<!DOCTYPE html>" in response.data.decode()

    # extract the csrf_token
    p = re.findall(".*initial_data.*",response.data.decode(), flags=re.MULTILINE);
    csrf_ext = re.compile(".*csrf_token\": \"([0-9|a|b|c|d|e|f]+)\".*")
    csrf_token_extract = csrf_ext.match(p[0]).group(1);

    gdbpid_ext = re.compile(".*gdbpid\": ([0-9]+).*")
    gdbpid_extract = gdbpid_ext.match(p[0]).group(1);

    test_client_socketio = socketio.test_client(backend.app, namespace="/gdb_listener",query_string="csrf_token=" + csrf_token_extract + "&gdbpid=" + gdbpid_extract, flask_test_client=test_client)
    # Run the gdbserver with MPI

    assert test_client_socketio.is_connected(namespace="/gdb_listener")

    loop = asyncio.get_event_loop()
    loop.create_task(run("source /home/i-bird/openfpm_vars_3.0.0 && ./gdbgui-mpi/launch_mpi_debugger 6 gdbgui-mpi/print_nodes"))

    thread = Thread(target=run_it_forever, args=(loop,))
    thread.start()

    time.sleep(1)

    response = test_client.get("/mpi_processes_info")

    assert "0         localhost.localdomain\n" in response.data.decode()

    test_client_socketio.emit("open_mpi_sessions", {"processors": "6"}, namespace="/gdb_listener");

    time.sleep(1)

    controllers = backend._state.get_controllers()

    # check we have 6 sessions
    assert len(controllers) == 6

    # connect to the gdb_servers
    for i in range(0,6):
        cmd = "-target-select remote localhost.localdomain:" + str(60000 + i)
        test_client_socketio.emit("run_gdb_command_mpi",{ "processor": i, "cmd": [cmd] },namespace="/gdb_listener")

    time.sleep(1)

    messages = test_client_socketio.get_received(namespace="/gdb_listener")
    backend.process_controllers_out()

    # 6 connection, 6 gdb messages
    messages = test_client_socketio.get_received(namespace="/gdb_listener")
    assert len(messages) == 6

    for i in range(0, 6):
        cmds = ["-break-insert main"]
        test_client_socketio.emit("run_gdb_command_mpi", {"processor": i, "cmd": cmds}, namespace="/gdb_listener")

    backend.process_controllers_out()

    # 6 connection, 6 gdb messages
    messages = test_client_socketio.get_received(namespace="/gdb_listener")
    assert len(messages) == 6
    for i in range(0,6):
        assert "gdb_response" in messages[i]["name"]
        assert "main(int, char**)" in messages[i]["args"][0][0]["payload"]["bkpt"]["func"]
        assert "breakpoint" in messages[i]["args"][0][0]["payload"]['bkpt']["type"]

    for i in range(0, 6):
        cmds = ["-exec-continue"]
        test_client_socketio.emit("run_gdb_command_mpi", {"processor": i, "cmd": cmds}, namespace="/gdb_listener")

    # At this point I am expexting to receive a lot of notification messages about reading information on libraries and so on in reality we are interested
    # in receiving the breakpoint hit
    num_breakpoint_hit, num_running = check_run_and_wait_for_brakpoint(6,6,test_client_socketio)

    assert num_running == 6
    assert num_breakpoint_hit == 6

    # now we set a breakpoint in a particular point of main.cpp

    for i in range(0, 6):
        cmds = ["-break-insert main.cpp:40"]
        test_client_socketio.emit("run_gdb_command_mpi", {"processor": i, "cmd": cmds}, namespace="/gdb_listener")

    backend.process_controllers_out()

    # 6 connection, 6 gdb messages
    messages = test_client_socketio.get_received(namespace="/gdb_listener")
    assert len(messages) == 6
    for i in range(0,6):
        assert "gdb_response" in messages[i]["name"]
        assert "main(int, char**)" in messages[i]["args"][0][0]["payload"]["bkpt"]["func"]
        assert "40" in messages[i]["args"][0][0]["payload"]["bkpt"]["line"]
        assert "breakpoint" in messages[i]["args"][0][0]["payload"]['bkpt']["type"]

    # run and check for breakpoint
    for i in range(0, 6):
        cmds = ["-exec-continue"]
        test_client_socketio.emit("run_gdb_command_mpi", {"processor": i, "cmd": cmds}, namespace="/gdb_listener")

    num_breakpoint_hit, num_running = check_run_and_wait_for_brakpoint(6,6,test_client_socketio)

    assert num_running == 6
    assert num_breakpoint_hit == 6

    # we try step
    for i in range(0, 6):
        cmds = ["-exec-next"]
        test_client_socketio.emit("run_gdb_command_mpi", {"processor": i, "cmd": cmds}, namespace="/gdb_listener")

    backend.process_controllers_out()

    num_breakpoint_hit, num_running = check_run_and_wait_for_brakpoint(6,6,test_client_socketio)

    assert num_running == 6
    assert num_breakpoint_hit == 6

    # create a breakpoint only valid fir processor 0

    for i in range(0, 6):
        cmds = ["-break-insert main.cpp:47"]
        test_client_socketio.emit("run_gdb_command_mpi", {"processor": i, "cmd": cmds}, namespace="/gdb_listener")

    backend.process_controllers_out()

    # 6 connection, 6 gdb messages
    messages = test_client_socketio.get_received(namespace="/gdb_listener")
    assert len(messages) == 6
    for i in range(0,6):
        assert "gdb_response" in messages[i]["name"]
        assert "main(int, char**)" in messages[i]["args"][0][0]["payload"]["bkpt"]["func"]
        assert "47" in messages[i]["args"][0][0]["payload"]["bkpt"]["line"]
        assert "breakpoint" in messages[i]["args"][0][0]["payload"]['bkpt']["type"]

    # run and check for breakpoint
    for i in range(0, 6):
        cmds = ["-exec-continue"]
        test_client_socketio.emit("run_gdb_command_mpi", {"processor": i, "cmd": cmds}, namespace="/gdb_listener")

    num_breakpoint_hit, num_running = check_run_and_wait_for_brakpoint(1,6,test_client_socketio)

    assert num_breakpoint_hit == 1
    assert num_running == 6

    cmds = ["-exec-continue"]
    test_client_socketio.emit("run_gdb_command_mpi", {"processor": 0, "cmd": cmds}, namespace="/gdb_listener")

    num_breakpoint_hit, num_running = check_run_and_wait_for_brakpoint(6, 1, test_client_socketio)

    assert num_breakpoint_hit == 6
    assert num_running == 1

    loop.stop()


def test_same_port():
    backend.setup_backend(testing=True)
