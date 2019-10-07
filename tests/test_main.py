import gdbgui
import pytest  # type: ignore
import sys


@pytest.mark.parametrize(
    "test_argv, init_bin_args, gdb_args",
    [
        (["gdbgui"], [], []),
        (["gdbgui", "--gdb-args", "mybin -myargs"], [], ["mybin", "-myargs"]),
        (["gdbgui", "--args", "mybin", "-myargs"], ["mybin", "-myargs"], []),
    ],
)
def test_argument_parsing(monkeypatch, test_argv, init_bin_args, gdb_args):
    def mock_setup_backend(*args, **kwargs):
        pass

    monkeypatch.setattr(gdbgui.backend, "setup_backend", mock_setup_backend)
    monkeypatch.setattr(sys, "argv", test_argv)
    gdbgui.backend.main()
    assert gdbgui.backend.app.config.get("initial_binary_and_args") == init_bin_args
    assert gdbgui.backend.app.config.get("gdb_args") == gdb_args
