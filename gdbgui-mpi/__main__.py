from gdbgui import backend
import sys

DEFAULT_PORT = 5000
DEFAULT_GDB_PORT = 60000

# start gdb-servers with mpi


# Change the port for each mpi process
sys.argv.append('-n')

print(sys.argv)

backend.main()
