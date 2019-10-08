import gdbgui
import pytest  # type: ignore
import sys
from gdbgui.statemanager import StateManager, GDB_MI_FLAG


@pytest.mark.parametrize(
    "test_argv, expected_gdb_args",
    [
        (["gdbgui"], GDB_MI_FLAG),
        (["gdbgui", "mybin -myargs"], GDB_MI_FLAG + ["mybin", "-myargs"]),
        (
            ["gdbgui", "--gdb-args", "--nx --tty=/dev/ttys002 mybin -myargs"],
            GDB_MI_FLAG + ["--nx", "--tty=/dev/ttys002", "mybin", "-myargs"],
        ),
        (
            ["gdbgui", "-n", "--args", "mybin", "-myargs"],
            GDB_MI_FLAG + ["--args", "mybin", "-myargs"],
        ),
    ],
)
def test_arguments_passed_to_gdb(monkeypatch, test_argv, expected_gdb_args):
    def mock_setup_backend(*args, **kwargs):
        pass

    monkeypatch.setattr(gdbgui.backend, "setup_backend", mock_setup_backend)
    monkeypatch.setattr(sys, "argv", test_argv)
    gdbgui.backend.main()

    state = StateManager(gdbgui.backend.app.config)
    assert len(state.get_gdb_args()) == len(expected_gdb_args)
