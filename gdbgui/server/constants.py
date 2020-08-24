import os
import signal
import sys
from pathlib import Path

DEFAULT_GDB_EXECUTABLE = "gdb"
DEFAULT_HOST = "127.0.0.1"
DEFAULT_PORT = 5000
USING_WINDOWS = os.name == "nt"
IS_A_TTY = sys.stdout.isatty()
pyinstaller_base_dir = getattr(sys, "_MEIPASS", None)
using_pyinstaller = pyinstaller_base_dir is not None
if using_pyinstaller:
    BASE_PATH = Path(pyinstaller_base_dir)
else:
    BASE_PATH = Path(os.path.realpath(__file__)).parent.parent
    PARENTDIR = BASE_PATH.parent
    sys.path.append(str(PARENTDIR))

TEMPLATE_DIR = BASE_PATH / "templates"
STATIC_DIR = BASE_PATH / "static"


def colorize(text):
    if IS_A_TTY and not USING_WINDOWS:
        return "\033[1;32m" + text + "\x1b[0m"

    else:
        return text


# create dictionary of signal names
SIGNAL_NAME_TO_OBJ = {}
for n in dir(signal):
    if n.startswith("SIG") and "_" not in n:
        SIGNAL_NAME_TO_OBJ[n.upper()] = getattr(signal, n)
