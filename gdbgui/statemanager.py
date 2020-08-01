import logging
import traceback
from collections import defaultdict
from typing import Any, Dict, Tuple, List, Optional
import copy
from pygdbmi.gdbcontroller import GdbController  # type: ignore

logger = logging.getLogger(__name__)
GDB_MI_FLAG = ["--interpreter=mi2"]


class StateManager(object):
    def __init__(self, config: Dict[str, Any]):
        self.controller_to_client_ids: Dict[GdbController, (List[str],int)] = defaultdict(
            list
        )  # key is controller, val is list of client ids
        self.gdb_reader_thread = None
        self.config = config

    def get_gdb_args(self):
        gdb_args = copy.copy(GDB_MI_FLAG)
        if self.config["gdb_args"]:
            gdb_args += self.config["gdb_args"]

        if self.config["initial_binary_and_args"]:
            gdb_args += ["--args"]
            gdb_args += self.config["initial_binary_and_args"]
        return gdb_args

    def connect_client(self, client_id: str, desired_gdbpid: int) -> Dict[str, Any]:
        message = ""
        pid: Optional[int] = 0
        error = False
        using_existing = False

        if desired_gdbpid > 0:
            controller = self.get_controller_from_pid(desired_gdbpid)

            if controller:
                self.controller_to_client_ids[controller][0].append(client_id)
                message = (
                    "gdbgui is using existing subprocess with pid %s, "
                    "originally opened with command %s"
                ) % (str(desired_gdbpid), controller.get_subprocess_cmd())
                using_existing = True
                pid = desired_gdbpid
            else:
                print("error! could not find that pid")
                message = "Could not find a gdb subprocess with pid %s. " % str(
                    desired_gdbpid
                )
                error = True

        if self.get_controller_from_client_id(client_id) is None:
            logger.info("new sid", client_id)

            gdb_args = self.get_gdb_args()

            controller = GdbController(
                gdb_path=self.config["gdb_path"],
                gdb_args=gdb_args,
                rr=self.config["rr"],
            )
            self.controller_to_client_ids[controller] = ([],-1)
            ele = self.controller_to_client_ids[controller]
            ele[0].append(client_id)

            pid = self.get_pid_from_controller(controller)
            if pid is None:
                error = True
                message = "Developer error"
            else:
                message += "gdbgui spawned subprocess with pid %s from command %s." % (
                    str(pid),
                    controller.get_subprocess_cmd(),
                )

        return {
            "pid": pid,
            "message": message,
            "error": error,
            "using_existing": using_existing,
        }

    def remove_gdb_controller_by_pid(self, gdbpid: int) -> List[str]:
        controller = self.get_controller_from_pid(gdbpid)
        if controller:
            orphaned_client_ids = self.remove_gdb_controller(controller)
        else:
            logger.info("could not find gdb controller with pid " + str(gdbpid))
            orphaned_client_ids = []
        return orphaned_client_ids

    def remove_gdb_controller(self, controller: GdbController) -> List[str]:
        try:
            controller.exit()
        except Exception:
            logger.error(traceback.format_exc())
        orphaned_client_ids = self.controller_to_client_ids.pop(controller, [])
        return orphaned_client_ids

    def get_client_ids_from_gdb_pid(self, pid: int) -> List[str]:
        controller = self.get_controller_from_pid(pid)
        return self.controller_to_client_ids.get(controller, ([],-1))

    def get_client_ids_from_controller(self, controller: GdbController):
        return self.controller_to_client_ids.get(controller, ([],-1))

    def get_pid_from_controller(self, controller: GdbController) -> Optional[int]:
        if controller and controller.gdb_process:
            return controller.gdb_process.pid

        return None

    def get_controller_from_pid(self, pid: int) -> Optional[GdbController]:
        for controller in self.controller_to_client_ids:
            this_pid = self.get_pid_from_controller(controller)
            if this_pid == pid:
                return controller

        return None

    def get_controller_from_client_id(self, client_id: str) -> Optional[GdbController]:
        for controller, client_ids in self.controller_to_client_ids.items():
            if client_id in client_ids[0]:
                return controller

        return None

    def get_controller_from_mpi_processor_id(self, mpi_processor_id: int) -> Optional[GdbController]:
        for ele in self.controller_to_client_ids.items():
            this_mpi_processor = ele[1][1]
            if this_mpi_processor == mpi_processor_id:
                return ele[0]

        return None

    def set_mpi_process_from_cotroller(self, controller: GdbController, mpi_processor_id: int):
        self.controller_to_client_ids[controller] = (self.controller_to_client_ids[controller][0],mpi_processor_id)

    def exit_all_gdb_processes(self):
        logger.info("exiting all subprocesses")
        for controller in self.controller_to_client_ids:
            controller.exit()
        self.controller_to_client_ids.clear()

    def exit_all_gdb_processes_except_client_id(self,client_id: str):
        logger.info("exiting all subprocesses except client id")
        for controller,pair in self.controller_to_client_ids.copy().items():
            if client_id not in pair[0]:
                controller.exit()
                self.controller_to_client_ids.pop(controller)

    def get_dashboard_data(self):
        data = {}
        for controller, client_ids in self.controller_to_client_ids.items():
            if controller.gdb_process:
                pid = str(controller.gdb_process.pid)
            else:
                pid = "process no longer exists"
            data[pid] = {
                "cmd": " ".join(controller.cmd),
                "abs_gdb_path": controller.abs_gdb_path,
                "number_of_connected_browser_tabs": len(client_ids),
                "client_ids": client_ids,
            }
        return data

    def disconnect_client(self, client_id: str):
        for _, client_ids in self.controller_to_client_ids.items():
            if client_id in client_ids:
                client_ids.remove(client_id)

    def get_controllers(self):
        return self.controller_to_client_ids

    def _spawn_new_gdb_controller(self):
        pass

    def _connect_to_existing_gdb_controller(self):
        pass
