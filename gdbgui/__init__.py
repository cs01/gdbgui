import io
import os
import sys

_base_dir = getattr(sys, "_MEIPASS", os.path.dirname(os.path.realpath(__file__)))
_version = (
    io.open(os.path.join(_base_dir, "VERSION.txt"), "r", encoding="utf-8")
    .read()
    .strip()
)

__title__ = "gdbgui"
__version__ = _version
__author__ = "Chad Smith"
__copyright__ = "Copyright Chad Smith"
