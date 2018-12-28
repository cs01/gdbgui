/**
 * An object to manage the websocket connection to the python server that manages gdb,
 * to send various commands to gdb, to and to dispatch gdb responses to gdbgui.
 */
import { store } from "statorgfc";
import Registers from "./Registers.jsx";
import Memory from "./Memory.jsx";
import Actions from "./Actions.js";
import GdbVariable from "./GdbVariable.jsx";
import constants from "./constants.js";
import process_gdb_response from "./process_gdb_response.js";
import React from "react";
void React; // needed when using JSX, but not marked as used

/* global debug */

// print to console if debug is true
let debug_print;
if (debug) {
  debug_print = console.info;
} else {
  debug_print = function() {
    // stubbed out
  };
}

/**
 * This object contains methods to interact with
 * gdb, but does not directly render anything in the DOM.
 */
const GdbApi = {
  init: function() {
    const TIMEOUT_MIN = 5;
    /* global io */
    /* global initial_data */
    GdbApi.socket = io.connect(
      `/gdb_listener`,
      {
        timeout: TIMEOUT_MIN * 60 * 1000,
        query: `csrf_token=${initial_data.csrf_token}&gdbpid=${initial_data.gdbpid}`
      }
    );

    GdbApi.socket.on("connect", function() {
      debug_print("connected");
    });

    GdbApi.socket.on("gdb_response", function(response_array) {
      clearTimeout(GdbApi._waiting_for_response_timeout);
      store.set("waiting_for_response", false);
      process_gdb_response(response_array);
    });

    GdbApi.socket.on("error_running_gdb_command", function(data) {
      Actions.add_console_entries(
        `Error occurred on server when running gdb command: ${data.message}`,
        constants.console_entry_type.STD_ERR
      );
    });

    GdbApi.socket.on("server_error", function(data) {
      Actions.add_console_entries(
        `Server message: ${data.message}`,
        constants.console_entry_type.STD_ERR
      );
    });

    GdbApi.socket.on("gdb_pid", function(gdb_pid_obj) {
      let gdb_pid = gdb_pid_obj.pid,
        message = gdb_pid_obj.message,
        error = gdb_pid_obj.error,
        using_existing = gdb_pid_obj.using_existing;

      Actions.add_console_entries(
        message,
        error
          ? constants.console_entry_type.STD_ERR
          : constants.console_entry_type.GDBGUI_OUTPUT
      );

      store.set("gdb_pid", gdb_pid);
      Actions.add_console_entries(
        `${store.get("interpreter")} process ${gdb_pid} is running for this tab`,
        constants.console_entry_type.GDBGUI_OUTPUT
      );
      if (using_existing) {
        Actions.refresh_state_for_gdb_pause();
      } else {
        GdbApi.run_initial_commands();
      }
    });

    GdbApi.socket.on("disconnect", function() {
      // we no longer need to warn the user before they exit the page since the gdb process
      // on the server is already gone
      window.onbeforeunload = () => null;

      // show modal
      Actions.show_modal(
        "",
        <span>
          The gdbgui server has shutdown. This tab will no longer function as expected.
        </span>
      );
      debug_print("disconnected");
      if (debug) {
        window.location.reload(true);
      }
    });
  },
  _waiting_for_response_timeout: null,
  click_run_button: function() {
    Actions.inferior_program_starting();
    GdbApi.run_gdb_command("-exec-run");
  },
  run_initial_commands: function() {
    const cmds = ["set breakpoint pending on"];
    for (const src in initial_data.remap_sources) {
      const dst = initial_data.remap_sources[src];
      cmds.push(`set substitute-path "${src}" "${dst}"`);
    }
    if (initial_data.initial_gdb_user_command) {
      cmds.push(initial_data.initial_gdb_user_command);
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
  send_autocomplete_command: function(command) {
    Actions.inferior_program_resuming();
    GdbApi.run_gdb_command("complete " + command);
  },
  click_gdb_cmd_button: function(e) {
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
  select_frame: function(framenum) {
    // TODO this command is deprecated (https://sourceware.org/gdb/onlinedocs/gdb/GDB_002fMI-Stack-Manipulation.html)
    // This command in deprecated in favor of passing the ‘--frame’ option to every command.
    GdbApi.run_command_and_refresh_state(`-stack-select-frame ${framenum}`);
  },
  select_thread_id: function(thread_id) {
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
    clearTimeout(GdbApi._waiting_for_response_timeout);
    GdbApi._waiting_for_response_timeout = setTimeout(() => {
      Actions.clear_program_state();
      store.set("waiting_for_response", false);

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
  run_gdb_command: function(cmd) {
    if (_.trim(cmd) === "") {
      return;
    }

    let cmds = cmd;
    if (_.isString(cmds)) {
      cmds = [cmds];
    }

    // add the send command to the console to show commands that are
    // automatically run by gdb
    if (store.get("show_all_sent_commands_in_console")) {
      Actions.add_console_entries(cmds, constants.console_entry_type.SENT_COMMAND);
    }

    GdbApi.waiting_for_response();
    GdbApi.socket.emit("run_gdb_command", { cmd: cmds });
  },
  /**
   * Run a user-defined command, then refresh the store
   * @param user_cmd (str or array): command or commands to run before refreshing store
   */
  run_command_and_refresh_state: function(user_cmd) {
    // if(!user_cmd){
    //     console.error('missing required argument')
    //     return
    // }
    let cmds = [];
    if (_.isArray(user_cmd)) {
      cmds = cmds.concat(user_cmd);
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
    if (store.get("interpreter") === "gdb") {
      // update all user-defined variables in gdb
      cmds.push(constants.IGNORE_ERRORS_TOKEN_STR + "-var-update --all-values *");
    } else if (store.get("interpreter") === "lldb") {
      // the * arg doesn't work, so loop over all
      // names and push commands for each
      cmds = cmds.concat(GdbVariable.get_update_cmds());
    }

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
  get_inferior_binary_last_modified_unix_sec(path) {
    $.ajax({
      beforeSend: function(xhr) {
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
  get_insert_break_cmd: function(fullname, line) {
    if (store.get("interpreter") === "gdb") {
      return [`-break-insert "${fullname}:${line}"`];
    } else {
      console.log("TODOLLDB - find mi-friendly command");
      return [`breakpoint set --file ${fullname} --line ${line}`];
    }
  },
  get_delete_break_cmd: function(bkpt_num) {
    if (store.get("interpreter") === "gdb") {
      return `-break-delete ${bkpt_num}`;
    } else {
      console.log("TODOLLDB - find mi-friendly command");
      return `breakpoint delete ${bkpt_num}`;
    }
  },
  get_break_list_cmd: function() {
    if (store.get("interpreter") === "gdb") {
      return "-break-list";
    } else if (store.get("interpreter") === "lldb") {
      console.log("TODOLLDB - find mi-friendly command");
      return "breakpoint list";
    }
  },
  get_load_binary_and_arguments_cmds(binary, args) {
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
  set_assembly_flavor(flavor) {
    GdbApi.run_gdb_command("set disassembly-flavor " + flavor);
  },
  _recieve_last_modified_unix_sec(data) {
    if (data.path === store.get("inferior_binary_path")) {
      store.set(
        "inferior_binary_path_last_modified_unix_sec",
        data.last_modified_unix_sec
      );
    }
  },
  _error_getting_last_modified_unix_sec(data) {
    void data;
    store.set("inferior_binary_path", null);
  }
};

export default GdbApi;
