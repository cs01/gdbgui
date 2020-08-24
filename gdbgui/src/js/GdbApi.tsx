/**
 * An object to manage the websocket connection to the python server that manages gdb,
 * to send various commands to gdb, to and to dispatch gdb responses to gdbgui.
 */
import { store } from "statorgfc";
import Registers from "./Registers";
import Memory from "./Memory";
import Actions from "./Actions";
import GdbVariable from "./GdbVariable";
import constants from "./constants";
import process_gdb_response from "./process_gdb_response";
import React from "react";
import io from "socket.io-client";
void React; // needed when using JSX, but not marked as used
/* global debug */

// print to console if debug is true
let log: {
  (arg0: string): void;
  (...data: any[]): void;
  (message?: any, ...optionalParams: any[]): void;
  (): void;
};
// @ts-expect-error ts-migrate(2304) FIXME: Cannot find name 'debug'.
if (debug) {
  log = console.info;
} else {
  log = function() {
    // stubbed out
  };
}

/**
 * This object contains methods to interact with
 * gdb, but does not directly render anything in the DOM.
 */
// @ts-expect-error ts-migrate(2339) FIXME: Property 'initial_data' does not exist on type 'Wi... Remove this comment to see the full error message
const initial_data = window.initial_data;
let socket: SocketIOClient.Socket;
const GdbApi = {
  getSocket: function() {
    return socket;
  },
  init: function() {
    const TIMEOUT_MIN = 5;
    socket = io.connect(`/gdb_listener`, {
      timeout: TIMEOUT_MIN * 60 * 1000,
      query: {
        csrf_token: initial_data.csrf_token,
        gdbpid: initial_data.gdbpid,
        gdb_command: initial_data.gdb_command
      }
    });

    socket.on("connect", function() {
      log("connected");
      const queuedGdbCommands = store.get("queuedGdbCommands");
      if (queuedGdbCommands) {
        GdbApi.run_gdb_command(queuedGdbCommands);
        store.set("queuedGdbCommands", []);
      }
    });

    socket.on("gdb_response", function(response_array: any) {
      // @ts-expect-error ts-migrate(2769) FIXME: Argument of type 'null' is not assignable to param... Remove this comment to see the full error message
      clearTimeout(GdbApi._waiting_for_response_timeout);
      store.set("waiting_for_response", false);
      process_gdb_response(response_array);
    });
    socket.on("fatal_server_error", function(data: { message: null | string }) {
      Actions.add_console_entries(
        `Message from server: ${data.message}`,
        constants.console_entry_type.STD_ERR
      );
      socket.close();
    });
    socket.on("error_running_gdb_command", function(data: { message: any }) {
      Actions.add_console_entries(
        `Error occurred on server when running gdb command: ${data.message}`,
        constants.console_entry_type.STD_ERR
      );
      socket.close();
    });

    socket.on("server_error", function(data: { message: any }) {
      Actions.add_console_entries(
        `Server message: ${data.message}`,
        constants.console_entry_type.STD_ERR
      );
    });

    socket.on("debug_session_connection_event", function(gdb_pid_obj: {
      pid: number;
      message: string | void;
      ok: boolean;
      started_new_gdb_process: boolean;
    }) {
      const gdb_pid = gdb_pid_obj.pid;
      const message = gdb_pid_obj.message;
      const error = !gdb_pid_obj.ok;
      const started_new_gdb_process = gdb_pid_obj.started_new_gdb_process;

      if (message) {
        Actions.add_console_entries(
          message,
          error
            ? constants.console_entry_type.STD_ERR
            : constants.console_entry_type.GDBGUI_OUTPUT
        );
      }
      if (error) {
        socket.close();
        return;
      }
      store.set("gdb_pid", gdb_pid);

      if (started_new_gdb_process) {
        GdbApi.run_initial_commands();
      } else {
        Actions.refresh_state_for_gdb_pause();
      }
    });

    socket.on("disconnect", function() {
      // we no longer need to warn the user before they exit the page since the gdb process
      // on the server is already gone
      window.onbeforeunload = () => null;

      Actions.show_modal(
        "",
        <>
          <p>
            The connection to the gdb session has been closed. This tab will no longer
            function as expected.
          </p>
          <p className="font-bold">
            To start a new session or connect to a different session, go to the{" "}
            <a href="/dashboard">dashboard</a>.
          </p>
        </>
      );
      Actions.add_console_entries(
        `The connection to the gdb session has been closed. To start a new session, go to ${window.location.origin}/dashboard`,
        constants.console_entry_type.STD_ERR
      );

      // if (debug) {
      //   window.location.reload(true);
      // }
    });
  },
  _waiting_for_response_timeout: null,
  click_run_button: function() {
    Actions.inferior_program_starting();
    GdbApi.run_gdb_command("-exec-run");
  },
  run_initial_commands: function() {
    const cmds = ["-list-features", "-list-target-features"];
    for (const src in initial_data.remap_sources) {
      const dst = initial_data.remap_sources[src];
      cmds.push(`set substitute-path "${src}" "${dst}"`);
    }
    GdbApi.run_gdb_command(cmds);
  },
  inferior_is_paused: function() {
    return (
      [constants.inferior_states.unknown, constants.inferior_states.paused].indexOf(
        store.get("inferior_program")
      ) !== -1
    );
  },
  click_continue_button: function(reverse = false) {
    Actions.inferior_program_resuming();
    GdbApi.run_gdb_command(
      "-exec-continue" + (store.get("debug_in_reverse") || reverse ? " --reverse" : "")
    );
  },
  click_next_button: function(reverse = false) {
    Actions.inferior_program_resuming();
    GdbApi.run_gdb_command(
      "-exec-next" + (store.get("debug_in_reverse") || reverse ? " --reverse" : "")
    );
  },
  click_step_button: function(reverse = false) {
    Actions.inferior_program_resuming();
    GdbApi.run_gdb_command(
      "-exec-step" + (store.get("debug_in_reverse") || reverse ? " --reverse" : "")
    );
  },
  click_return_button: function() {
    // From gdb mi docs (https://sourceware.org/gdb/onlinedocs/gdb/GDB_002fMI-Program-Execution.html#GDB_002fMI-Program-Execution):
    // `-exec-return` Makes current function return immediately. Doesn't execute the inferior.
    // That means we do NOT dispatch the event `event_inferior_program_resuming`, because it's not, in fact, running.
    // The return also doesn't even indicate that it's paused, so we need to manually trigger the event here.
    GdbApi.run_gdb_command("-exec-return");
    Actions.inferior_program_paused();
  },
  click_next_instruction_button: function(reverse = false) {
    Actions.inferior_program_resuming();
    GdbApi.run_gdb_command(
      "-exec-next-instruction" +
        (store.get("debug_in_reverse") || reverse ? " --reverse" : "")
    );
  },
  click_step_instruction_button: function(reverse = false) {
    Actions.inferior_program_resuming();
    GdbApi.run_gdb_command(
      "-exec-step-instruction" +
        (store.get("debug_in_reverse") || reverse ? " --reverse" : "")
    );
  },
  click_send_interrupt_button: function() {
    Actions.inferior_program_resuming();
    GdbApi.run_gdb_command("-exec-interrupt");
  },
  send_autocomplete_command: function(command: string) {
    Actions.inferior_program_resuming();
    GdbApi.run_gdb_command("complete " + command);
  },
  click_gdb_cmd_button: function(e: {
    currentTarget: { dataset: { [x: string]: any; cmd: undefined; cmd0: undefined } };
  }) {
    if (e.currentTarget.dataset.cmd !== undefined) {
      // run single command
      // i.e. <a data-cmd='cmd' />
      GdbApi.run_gdb_command(e.currentTarget.dataset.cmd);
    } else if (e.currentTarget.dataset.cmd0 !== undefined) {
      // run multiple commands
      // i.e. <a data-cmd0='cmd 0' data-cmd1='cmd 1' data-...>
      let cmds = [];
      let i = 0;
      let cmd = e.currentTarget.dataset[`cmd${i}`];
      // extract all commands into an array, then run them
      // (max of 100 commands)
      while (cmd !== undefined && i < 100) {
        cmds.push(cmd);
        i++;
        cmd = e.currentTarget.dataset[`cmd${i}`];
      }
      GdbApi.run_gdb_command(cmds);
    } else {
      console.error(
        "expected cmd or cmd0 [cmd1, cmd2, ...] data attribute(s) on element"
      );
    }
  },
  select_frame: function(framenum: any) {
    // TODO this command is deprecated (https://sourceware.org/gdb/onlinedocs/gdb/GDB_002fMI-Stack-Manipulation.html)
    // This command in deprecated in favor of passing the ‘--frame’ option to every command.
    GdbApi.run_command_and_refresh_state(`-stack-select-frame ${framenum}`);
  },
  select_thread_id: function(thread_id: any) {
    // TODO this command is deprecated (http://www.sourceware.org/gdb/current/onlinedocs/gdb/GDB_002fMI-Thread-Commands.html)
    // This command is deprecated in favor of explicitly using the ‘--thread’ option to each command.
    GdbApi.run_command_and_refresh_state(`-thread-select ${thread_id}`);
  },
  /**
   * Before sending a command, set a timeout to notify the user that something might be wrong
   * if a response from gdb is not received
   */
  waiting_for_response: function() {
    store.set("waiting_for_response", true);
    const WAIT_TIME_SEC = 10;
    // @ts-expect-error ts-migrate(2769) FIXME: Argument of type 'null' is not assignable to param... Remove this comment to see the full error message
    clearTimeout(GdbApi._waiting_for_response_timeout);
    // @ts-expect-error ts-migrate(2322) FIXME: Type 'Timeout' is not assignable to type 'null'.
    GdbApi._waiting_for_response_timeout = setTimeout(() => {
      Actions.clear_program_state();
      store.set("waiting_for_response", false);
      if (GdbApi.getSocket().disconnected) {
        return;
      }

      Actions.add_console_entries(
        `No gdb response received after ${WAIT_TIME_SEC} seconds.`,
        constants.console_entry_type.GDBGUI_OUTPUT
      );
      Actions.add_console_entries(
        "Possible reasons include:",
        constants.console_entry_type.GDBGUI_OUTPUT
      );
      Actions.add_console_entries(
        "1) gdbgui, gdb, or the debugged process is not running.",
        constants.console_entry_type.GDBGUI_OUTPUT
      );

      Actions.add_console_entries(
        "2) gdb or the inferior process is busy running and needs to be " +
          "interrupted (press the pause button up top).",
        constants.console_entry_type.GDBGUI_OUTPUT
      );

      Actions.add_console_entries(
        "3) Something is just taking a long time to finish and respond back to " +
          "this browser window, in which case you can just keep waiting.",
        constants.console_entry_type.GDBGUI_OUTPUT
      );
    }, WAIT_TIME_SEC * 1000);
  },
  /**
   * runs a gdb cmd (or commands) directly in gdb on the backend
   * validates command before sending, and updates the gdb console and status bar
   * @param cmd: a string or array of strings, that are directly evaluated by gdb
   * @return nothing
   */
  run_gdb_command: function(cmd: any) {
    // @ts-expect-error ts-migrate(2304) FIXME: Cannot find name '_'.
    if (_.trim(cmd) === "") {
      return;
    }

    let cmds = cmd;
    // @ts-expect-error ts-migrate(2304) FIXME: Cannot find name '_'.
    if (_.isString(cmds)) {
      cmds = [cmds];
    }

    if (socket.connected) {
      socket.emit("run_gdb_command", { cmd: cmds });
      GdbApi.waiting_for_response();
      // add the send command to the console to show commands that are
      // automatically run by gdb
      if (store.get("show_all_sent_commands_in_console")) {
        Actions.add_console_entries(cmds, constants.console_entry_type.SENT_COMMAND);
      }
    } else {
      log("queuing commands");
      const queuedGdbCommands = store.get("queuedGdbCommands").concat(cmds);
      store.set("queuedGdbCommands", queuedGdbCommands);
    }
  },
  run_command_and_refresh_state: function(user_cmd: string | any[]) {
    let cmds: any[] = [];
    if (Array.isArray(user_cmd)) {
      cmds = cmds.concat(user_cmd);
      // @ts-expect-error ts-migrate(2304) FIXME: Cannot find name '_'.
    } else if (_.isString(user_cmd) && user_cmd.length > 0) {
      cmds.push(user_cmd);
    }
    cmds = cmds.concat(GdbApi._get_refresh_state_for_pause_cmds());
    GdbApi.run_gdb_command(cmds);
  },
  backtrace: function() {
    let cmds = ["backtrace"];
    cmds = cmds.concat(GdbApi._get_refresh_state_for_pause_cmds());
    store.set("inferior_program", constants.inferior_states.paused);
    GdbApi.run_gdb_command(cmds);
  },
  /**
   * Get array of commands to send to gdb that refreshes everything in the
   * frontend
   */
  _get_refresh_state_for_pause_cmds: function() {
    let cmds = [
      // get info on current thread
      // TODO run -thread-list-ids to store list of thread id's and know
      // which thread is the current thread
      constants.IGNORE_ERRORS_TOKEN_STR + "-thread-info",
      // print the name, type and value for simple data types,
      // and the name and type for arrays, structures and unions.
      constants.IGNORE_ERRORS_TOKEN_STR + "-stack-list-variables --simple-values"
    ];
    // update all user-defined variables in gdb
    cmds.push(constants.IGNORE_ERRORS_TOKEN_STR + "-var-update --all-values *");

    // update registers
    cmds = cmds.concat(Registers.get_update_cmds());

    // re-fetch memory over desired range as specified by DOM inputs
    cmds = cmds.concat(Memory.get_gdb_commands_from_state());

    // refresh breakpoints
    cmds.push(GdbApi.get_break_list_cmd());

    // List the frames currently on the stack.
    // avoid the "no registers" error
    cmds.push(constants.IGNORE_ERRORS_TOKEN_STR + "-stack-list-frames");
    return cmds;
  },
  refresh_breakpoints: function() {
    GdbApi.run_gdb_command([GdbApi.get_break_list_cmd()]);
  },
  get_inferior_binary_last_modified_unix_sec(path: any) {
    $.ajax({
      beforeSend: function(xhr: { setRequestHeader: (arg0: string, arg1: any) => void }) {
        xhr.setRequestHeader("x-csrftoken", initial_data.csrf_token);
      },
      url: "/get_last_modified_unix_sec",
      cache: false,
      method: "GET",
      data: { path: path },
      success: GdbApi._recieve_last_modified_unix_sec,
      error: GdbApi._error_getting_last_modified_unix_sec
    });
  },
  get_insert_break_cmd: function(fullname: any, line: any) {
    return [`-break-insert "${fullname}:${line}"`];
  },
  get_delete_break_cmd: function(bkpt_num: any) {
    return `-break-delete ${bkpt_num}`;
  },
  get_break_list_cmd: function() {
    return "-break-list";
  },
  get_load_binary_and_arguments_cmds(binary: any, args: any) {
    // tell gdb which arguments to use when calling the binary, before loading the binary
    let cmds = [
      `-exec-arguments ${args}`, // Set the inferior program arguments, to be used in the next `-exec-run`
      `-file-exec-and-symbols ${binary}` // Specify the executable file to be debugged. This file is the one from which the symbol table is also read.
    ];
    // add breakpoint if we don't already have one
    if (store.get("auto_add_breakpoint_to_main")) {
      cmds.push("-break-insert main");
    }
    cmds.push(GdbApi.get_break_list_cmd());
    return cmds;
  },
  set_assembly_flavor(flavor: string) {
    GdbApi.run_gdb_command(`set disassembly-flavor ${flavor}`);
  },
  _recieve_last_modified_unix_sec(data: { path: any; last_modified_unix_sec: any }) {
    if (data.path === store.get("inferior_binary_path")) {
      store.set(
        "inferior_binary_path_last_modified_unix_sec",
        data.last_modified_unix_sec
      );
    }
  },
  _error_getting_last_modified_unix_sec(data: any) {
    void data;
    store.set("inferior_binary_path", null);
  }
};
// @ts-expect-error ts-migrate(2339) FIXME: Property 'socket' does not exist on type '{ getSoc... Remove this comment to see the full error message
GdbApi.socket = socket;
export default GdbApi;
