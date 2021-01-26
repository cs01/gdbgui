import pytest  # type: ignore
import time
import re
import subprocess
import gdbgui.server
import os
from threading import Thread
from queue import Queue, Empty

from gdbgui.server.app import app, socketio
from gdbgui.server.constants import (
    DEFAULT_GDB_EXECUTABLE,
    DEFAULT_HOST,
    DEFAULT_PORT,
)
import gdbgui.server.server

app.config["gdb_command"] = DEFAULT_GDB_EXECUTABLE
gdbgui.server.server.run_server(
    app=app,
    socketio=socketio,
    host=DEFAULT_HOST,
    port=DEFAULT_PORT,
    debug=False,
    open_browser=False,
    browsername="ChromeHeadless",
    testing=True,
)
socketio = gdbgui.server.app.socketio


@pytest.fixture
def test_client():
    return gdbgui.server.app.app.test_client()


def check_run_and_wait_for_brakpoint(target_bkt, target_runs, test_client_socketio):
    num_breakpoint_hit = 0
    num_running = 0
    print("Checking running and breakpoint hit:")
    timeout = time.time() + 10
    while (
        num_breakpoint_hit < target_bkt or num_running < target_runs
    ) and time.time() < timeout:
        gdbgui.server.app.process_controllers_out()
        messages = test_client_socketio.get_received(namespace="/gdb_listener")

        if len(messages) != 0:
            print(messages)

        for i in range(0, len(messages)):
            for arg in messages[i]["args"][0]:
                if type(arg) is dict:
                    if arg["message"] == "running" and arg["type"] == "notify":
                        num_running += 1
                    if arg["message"] == "stopped" and (
                        arg["payload"]["reason"] == "breakpoint-hit"
                        or arg["payload"]["reason"] == "end-stepping-range"
                    ):
                        num_breakpoint_hit += 1
                    if arg["message"] is None and "exited" in arg["payload"]:
                        num_breakpoint_hit += 1
    return num_breakpoint_hit, num_running


def set_pagination_off(test_client_socketio):
    for i in range(0, 2):
        cmds = ['-interpreter-exec console "set pagination off"']
        test_client_socketio.emit(
            "run_gdb_command_mpi",
            {"processor": i, "cmd": cmds},
            namespace="/gdb_listener",
        )


def set_breakpoint(test_client_socketio, pos):
    for i in range(0, 2):
        cmds = ["-break-insert main" + pos]
        test_client_socketio.emit(
            "run_gdb_command_mpi",
            {"processor": i, "cmd": cmds},
            namespace="/gdb_listener",
        )


def check_breakpoint_set(
    test_client_socketio, line, target_bkt, no_line_check=True, process=None
):
    time.sleep(1)
    # 2 connection, 2 gdb messages
    num_break_hit = 0
    timeout = time.time() + 10

    print("Checking breakpoint set:")

    while num_break_hit < target_bkt and time.time() < timeout:
        gdbgui.server.app.process_controllers_out()
        messages = test_client_socketio.get_received(namespace="/gdb_listener")

        if len(messages) != 0:
            print(messages)

        for i in range(0, len(messages)):
            print("Analyze: " + str(messages[i]))
            for msg_pay in messages[i]["args"][0]:
                payload = msg_pay["payload"]
                if isinstance(payload,dict):
                    break_message=payload.get("bkpt")
                    if break_message is not None:
                        if "breakpoint" in break_message["type"]:
                            print("Break-set")
                            assert "gdb_response" in messages[i]["name"]
                            assert (
                                "main(int, char**)"
                                in break_message["func"]
                            )
                            if no_line_check is False:
                                assert (
                                    line in break_message["line"]
                                )

                            num_break_hit += 1

    if num_break_hit == 0 and process is not None:
        # OK we try to print the output of launching the gdbserver
        print(process.stderr.read())
        print(process.stdout.read())

    assert num_break_hit == 2


def continue_run(test_client_socketio):
    for i in range(0, 2):
        cmds = ["-exec-continue"]
        test_client_socketio.emit(
            "run_gdb_command_mpi",
            {"processor": i, "cmd": cmds},
            namespace="/gdb_listener",
        )


def enqueue_output(out, queue):
    for line in iter(out.readline, b""):
        queue.put(line)
    out.close()


def test_load_mpi_program(test_client):
    response = test_client.get("/")
    assert response.status_code == 200
    assert "<!DOCTYPE html>" in response.data.decode()

    # extract the csrf_token
    p = re.findall(".*initial_data.*", response.data.decode(), flags=re.MULTILINE)
    csrf_ext = re.compile('.*csrf_token": "([0-9|a|b|c|d|e|f]+)".*')
    csrf_token_extract = csrf_ext.match(p[0]).group(1)

    gdbpid_ext = re.compile('.*gdbpid": ([0-9]+).*')
    gdbpid_extract = gdbpid_ext.match(p[0]).group(1)

    test_client_socketio = socketio.test_client(
        gdbgui.server.app.app,
        namespace="/gdb_listener",
        query_string="csrf_token=" + csrf_token_extract + "&gdbpid=" + gdbpid_extract,
        flask_test_client=test_client,
    )
    # Run the gdbserver with MPI

    assert test_client_socketio.is_connected(namespace="/gdb_listener")

    my_env = os.environ
    process = subprocess.Popen(
        [
            "bash",
            "-c",
            "ls ./gdbgui-mpi && ./gdbgui-mpi/launch_mpi_debugger 2 gdbgui-mpi/print_nodes",
        ],
        stdout=subprocess.PIPE,
        stderr=subprocess.PIPE,
        env=my_env,
    )

    q = Queue()
    to = Thread(target=enqueue_output, args=(process.stdout, q))
    to.daemon = True  # thread dies with the program
    to.start()

    q2 = Queue()
    te = Thread(target=enqueue_output, args=(process.stderr, q2))
    te.daemon = True  # thread dies with the program
    te.start()

    time.sleep(5)

    while True:
        try:
            line = q.get_nowait()
        except Empty:
            break
        else:  # got line
            print(line)

    while True:
        try:
            line = q2.get_nowait()
        except Empty:
            break
        else:  # got line
            print(line)

    response = test_client.get("/mpi_processes_info")

    assert response.status_code == 200

    test_client_socketio.emit(
        "open_mpi_sessions", {"processors": 2}, namespace="/gdb_listener"
    )
    time.sleep(1)
    controllers = gdbgui.server.app.manager.get_controllers()

    # check we have 2 sessions
    assert len(controllers) == 2

    # process the names and connect to gdb_servers
    lines = response.data.decode().split("\n")
    lines.pop()
    assert len(lines) == 2
    for line in lines:
        proc_name = line.split()

        cmd = (
            "-target-select remote "
            + proc_name[1]
            + ":"
            + str(60000 + int(proc_name[0]))
        )
        test_client_socketio.emit(
            "run_gdb_command_mpi",
            {"processor": int(proc_name[0]), "cmd": [cmd]},
            namespace="/gdb_listener",
        )

    time.sleep(2)

    messages = test_client_socketio.get_received(namespace="/gdb_listener")
    gdbgui.server.app.process_controllers_out()

    # 2 connection, 4 gdb messages
    messages = test_client_socketio.get_received(namespace="/gdb_listener")
    assert len(messages) == 4

    set_pagination_off(test_client_socketio)

    set_breakpoint(test_client_socketio, "")
    gdbgui.server.app.process_controllers_out()
    check_breakpoint_set(test_client_socketio, "8", 2, True, process)
    continue_run(test_client_socketio)

    # At this point I am expexting to receive a lot of notification messages about reading information on libraries and so on in reality we are interested
    # in receiving the breakpoint hit
    num_breakpoint_hit, num_running = check_run_and_wait_for_brakpoint(
        2, 2, test_client_socketio
    )

    assert num_running == 2
    assert num_breakpoint_hit == 2

    # now we set a breakpoint in a particular point of main.cpp and check we hit that breakpoint

    set_breakpoint(test_client_socketio, ".cpp:40")
    gdbgui.server.app.process_controllers_out()
    check_breakpoint_set(test_client_socketio, "40", 2)

    # run and check for breakpoint
    continue_run(test_client_socketio)

    num_breakpoint_hit, num_running = check_run_and_wait_for_brakpoint(
        2, 2, test_client_socketio
    )

    assert num_running == 2
    assert num_breakpoint_hit == 2

    # we try step
    for i in range(0, 2):
        cmds = ["-exec-next"]
        test_client_socketio.emit(
            "run_gdb_command_mpi",
            {"processor": i, "cmd": cmds},
            namespace="/gdb_listener",
        )

    gdbgui.server.app.process_controllers_out()

    num_breakpoint_hit, num_running = check_run_and_wait_for_brakpoint(
        2, 2, test_client_socketio
    )

    assert num_running == 2
    assert num_breakpoint_hit == 2

    # create a breakpoint only valid fir processor 0

    set_breakpoint(test_client_socketio, ".cpp:50")
    gdbgui.server.app.process_controllers_out()
    check_breakpoint_set(test_client_socketio, "50", 2)

    # run and check for breakpoint
    continue_run(test_client_socketio)

    num_breakpoint_hit, num_running = check_run_and_wait_for_brakpoint(
        1, 2, test_client_socketio
    )

    assert num_breakpoint_hit == 1
    assert num_running == 2

    cmds = ["-exec-continue"]
    test_client_socketio.emit(
        "run_gdb_command_mpi", {"processor": 0, "cmd": cmds}, namespace="/gdb_listener"
    )

    num_breakpoint_hit, num_running = check_run_and_wait_for_brakpoint(
        2, 1, test_client_socketio
    )

    assert num_breakpoint_hit == 2
    assert num_running == 1

    process.terminate()

    time.sleep(3)

    while True:
        try:
            line = q.get_nowait()
        except Empty:
            break
        else:  # got line
            print(line)

    while True:
        try:
            line = q2.get_nowait()
        except Empty:
            break
        else:  # got line
            print(line)

    process.wait()
