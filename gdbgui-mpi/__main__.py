from gdbgui import backend
from mpi4py import MPI
import sys

comm = MPI.COMM_WORLD
rank = comm.Get_rank()

DEFAULT_PORT = 5000
DEFAULT_GDB_PORT = 60000

# start gdb-servers with mpi


# Change the port for each mpi process
sys.argv.append('-p ' + str(DEFAULT_PORT + rank))
sys.argv.append('-n')
#sys.argv.append('--gdb-args="-ex \'target remote localhost:' + str(DEFAULT_GDB_PORT + rank) + '\'"')

print(sys.argv)

backend.main()
