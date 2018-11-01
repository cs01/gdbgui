from collections import defaultdict
from copy import deepcopy
from pygdbmi.gdbcontroller import GdbController
import logging
import traceback


REQUIRED_GDB_FLAGS = ["--interpreter=mi2"]
logger = logging.getLogger(__name__)


class StateManager(object):
    def __init__(self, config):
        self.controller_to_client_ids = defaultdict(
            list
        )  # key is controller, val is list of client ids
        self.gdb_reader_thread = None
        self.config = config

    def connect_client(self, client_id, desired_gdbpid):
        message = ""
        pid = 0
        error = False
        using_existing = False

        if desired_gdbpid > 0:
            controller = self.get_controller_from_pid(desired_gdbpid)

            if controller:
                self.controller_to_client_ids[controller].append(client_id)
                message = "gdbgui is using existing subprocess with pid %s, "
                "originally opened with command %s" % (
                    str(desired_gdbpid),
                    controller.get_subprocess_cmd(),
                )
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

            gdb_args = (
                deepcopy(self.config["initial_binary_and_args"])
                + deepcopy(self.config["gdb_args"])
                + REQUIRED_GDB_FLAGS
            )

            controller = GdbController(
                gdb_path=self.config["gdb_path"],
                gdb_args=gdb_args,
                rr=self.config["rr"],
            )
            self.controller_to_client_ids[controller].append(client_id)

            pid = self.get_pid_from_controller(controller)
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

    def remove_gdb_controller_by_pid(self, gdbpid):
        controller = self.get_controller_from_pid(gdbpid)
        if controller:
            orphaned_client_ids = self.remove_gdb_controller(controller)
        else:
            logger.info("could not find gdb controller with pid " + str(gdbpid))
            orphaned_client_ids = []
        return orphaned_client_ids

    def remove_gdb_controller(self, controller):
        try:
            controller.exit()
        except Exception:
            logger.error(traceback.format_exc())
        orphaned_client_ids = self.controller_to_client_ids.pop(controller, [])
        return orphaned_client_ids

    def get_client_ids_from_gdb_pid(self, pid):
        controller = self.get_controller_from_pid(pid)
        return self.controller_to_client_ids.get(controller, [])

    def get_client_ids_from_controller(self, controller):
        return self.controller_to_client_ids.get(controller, [])

    def get_pid_from_controller(self, controller):
        if controller and controller.gdb_process:
            return controller.gdb_process.pid

        return None

    def get_controller_from_pid(self, pid):
        for controller in self.controller_to_client_ids:
            this_pid = self.get_pid_from_controller(controller)
            if this_pid == pid:
                return controller

        return None

    def get_controller_from_client_id(self, client_id):
        for controller, client_ids in self.controller_to_client_ids.items():
            if client_id in client_ids:
                return controller

        return None

    def exit_all_gdb_processes(self):
        logger.info("exiting all subprocesses")
        for controller in self.controller_to_client_ids:
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

    def disconnect_client(self, client_id):
        for _, client_ids in self.controller_to_client_ids.items():
            if client_id in client_ids:
                client_ids.remove(client_id)

    def _spawn_new_gdb_controller(self):
        pass

    def _connect_to_existing_gdb_controller(self):
        pass
