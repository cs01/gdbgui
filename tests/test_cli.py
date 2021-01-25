import sys
from typing import List
from unittest import mock

import gdbgui
import pytest  # type: ignore


def run_gdbgui_cli(gdbgui_args: List[str]):
    with mock.patch.object(sys, "argv", ["gdbgui"] + gdbgui_args):
        return gdbgui.cli.main()  # type: ignore


# @pytest.mark.parametrize(
#     "argv",
#     (
#         [],
#         ["-n"],
#         ["myprogram"],
#         ["-g", "gdb -nx"],
#         ["--args", "can", "pass", "many", "args"],
#     ),
# )
# def skip_test_cli(monkeypatch, argv):
#     # TODO fix this patch
#     with mock.patch("gdbgui.server.server.run_server") as mock_run_server:
#         run_gdbgui_cli(argv)
#         mock_run_server.assert_called_once()


@mock.patch("gdbgui.server.server.run_server")
@pytest.mark.parametrize(
    "argv", (["--gdb-cmd"], ["myprogram", "cannot pass second arg"])
)
def test_cli_fails(monkeypatch, argv):
    mock_exit = mock.Mock(side_effect=ValueError("raised in test to exit early"))
    with mock.patch.object(sys, "exit", mock_exit), pytest.raises(
        ValueError, match="raised in test to exit early"
    ):
        run_gdbgui_cli(argv)
    mock_exit.assert_called_once_with(2)


@mock.patch("gdbgui.server.server.run_server")
def test_cli_help(monkeypatch):
    mock_exit = mock.Mock(side_effect=ValueError("raised in test to exit early"))
    with mock.patch.object(sys, "exit", mock_exit), pytest.raises(
        ValueError, match="raised in test to exit early"
    ):
        run_gdbgui_cli(["--help"])
    mock_exit.assert_called_once_with(0)
