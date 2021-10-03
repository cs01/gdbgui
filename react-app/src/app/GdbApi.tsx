/**
 * An object to manage the websocket connection to the python server that manages gdb,
 * to send various commands to gdb, to and to dispatch gdb responses to gdbgui.
 */
import { store } from "./GlobalState";
import Registers from "./Registers";
import Memory from "./Memory";
import Actions from "./Actions";
import constants from "./constants";
import { initial_data } from "./InitialData";
import _ from "lodash";
import $ from "jquery";
import { GdbWebsocket } from "./Websocket";

const GdbApi = {
  click_run_button: function () {
    Actions.onEventInferiorProgramStarting();
    GdbApi.run_gdb_command("-exec-run");
  },
  runInitialCommands: function () {
    const cmds = ["-list-features", "-list-target-features"];
    for (const src in initial_data.remap_sources) {
      const dst = initial_data.remap_sources[src];
      cmds.push(`set substitute-path "${src}" "${dst}"`);
    }
    GdbApi.run_gdb_command(cmds);
  },
  isInferiorPaused: function () {
    return (
      [constants.inferior_states.unknown, constants.inferior_states.paused].indexOf(
        store.data.inferior_program
      ) !== -1
    );
  },
  requestContinue: function (reverse = false) {
    Actions.onEventInferiorProgramResuming();
    GdbApi.run_gdb_command(
      "-exec-continue" + (store.data.debug_in_reverse || reverse ? " --reverse" : "")
    );
  },
  requestNext: function (reverse = false) {
    Actions.onEventInferiorProgramResuming();
    GdbApi.run_gdb_command(
      "-exec-next" + (store.data.debug_in_reverse || reverse ? " --reverse" : "")
    );
  },
  requestStep: function (reverse = false) {
    Actions.onEventInferiorProgramResuming();
    GdbApi.run_gdb_command(
      "-exec-step" + (store.data.debug_in_reverse || reverse ? " --reverse" : "")
    );
  },
  click_return_button: function () {
    // From gdb mi docs (https://sourceware.org/gdb/onlinedocs/gdb/GDB_002fMI-Program-Execution.html#GDB_002fMI-Program-Execution):
    // `-exec-return` Makes current function return immediately. Doesn't execute the inferior.
    // That means we do NOT dispatch the event `event_inferior_program_resuming`, because it's not, in fact, running.
    // The return also doesn't even indicate that it's paused, so we need to manually trigger the event here.
    GdbApi.run_gdb_command("-exec-return");
    Actions.onEventInferiorProgramStopped();
  },
  requestSendNextInstruction: function (reverse = false) {
    Actions.onEventInferiorProgramResuming();
    GdbApi.run_gdb_command(
      "-exec-next-instruction" +
        (store.data.debug_in_reverse || reverse ? " --reverse" : "")
    );
  },
  requestSendStepInstruction: function (reverse = false) {
    Actions.onEventInferiorProgramResuming();
    GdbApi.run_gdb_command(
      "-exec-step-instruction" +
        (store.data.debug_in_reverse || reverse ? " --reverse" : "")
    );
  },
  requestConnectToGdbserver(user_input: string) {
    // https://sourceware.org/gdb/onlinedocs/gdb/GDB_002fMI-Target-Manipulation.html#GDB_002fMI-Target-Manipulation
    store.set("source_file_paths", []);
    store.set("language", "c_family");
    store.set("inferior_binary_path", null);
    Actions.inferiorProgramExited();
    GdbApi.run_gdb_command([`-target-select remote ${user_input}`]);
  },
  requestInterrupt: function () {
    Actions.onEventInferiorProgramResuming();
    GdbApi.run_gdb_command("-exec-interrupt");
  },
  requestSelectFrame: function (framenum: any) {
    // TODO this command is deprecated (https://sourceware.org/gdb/onlinedocs/gdb/GDB_002fMI-Stack-Manipulation.html)
    // This command in deprecated in favor of passing the ‘--frame’ option to every command.
    store.set("selected_frame_num", framenum);
    store.set("line_of_source_to_flash", null);
    store.set("make_current_line_visible", true);
    GdbApi.run_command_and_refresh_state(`-stack-select-frame ${framenum}`);
  },
  requestSelectThreadId: function (thread_id: any) {
    // TODO this command is deprecated (http://www.sourceware.org/gdb/current/onlinedocs/gdb/GDB_002fMI-Thread-Commands.html)
    // This command is deprecated in favor of explicitly using the ‘--thread’ option to each command.
    GdbApi.run_command_and_refresh_state(`-thread-select ${thread_id}`);
  },
  /**
   * runs a gdb cmd (or commands) directly in gdb on the backend
   * validates command before sending, and updates the gdb console and status bar
   * @param cmd: a string or array of strings, that are directly evaluated by gdb
   * @return nothing
   */
  run_gdb_command: function (cmd: any) {
    const gdbWebsocket: Nullable<GdbWebsocket> = store.data.gdbWebsocket;
    if (gdbWebsocket) {
      gdbWebsocket.runGdbCommand(cmd);
    }
  },
  run_command_and_refresh_state: function (user_cmd: string | any[]) {
    let cmds: any[] = [];
    if (Array.isArray(user_cmd)) {
      cmds = cmds.concat(user_cmd);
    } else if (_.isString(user_cmd) && user_cmd.length > 0) {
      cmds.push(user_cmd);
    }
    cmds = cmds.concat(GdbApi._get_refresh_state_for_pause_cmds());
    GdbApi.run_gdb_command(cmds);
  },
  requestBacktrace: function () {
    let cmds = ["backtrace"];
    cmds = cmds.concat(GdbApi._get_refresh_state_for_pause_cmds());
    store.set("inferior_program", constants.inferior_states.paused);
    GdbApi.run_gdb_command(cmds);
  },
  /**
   * Get array of commands to send to gdb that refreshes everything in the
   * frontend
   */
  _get_refresh_state_for_pause_cmds: function () {
    let cmds = [
      // get info on current thread
      // TODO run -thread-list-ids to store list of thread id's and know
      // which thread is the current thread
      constants.IGNORE_ERRORS_TOKEN_STR + "-thread-info",
      // print the name, type and value for simple data types,
      // and the name and type for arrays, structures and unions.
      constants.IGNORE_ERRORS_TOKEN_STR + "-stack-list-variables --simple-values",
    ];
    // update all user-defined variables in gdb
    cmds.push(constants.IGNORE_ERRORS_TOKEN_STR + "-var-update --all-values *");

    // update registers
    cmds = cmds.concat(Registers.get_update_cmds());

    // re-fetch memory over desired range as specified by DOM inputs
    cmds = cmds.concat(Memory.getGdbCommandsFromState());

    // refresh breakpoints
    cmds.push(GdbApi.get_break_list_cmd());

    // List the frames currently on the stack.
    // avoid the "no registers" error
    cmds.push(constants.IGNORE_ERRORS_TOKEN_STR + "-stack-list-frames");
    return cmds;
  },
  requestBreakpointList: function () {
    GdbApi.run_gdb_command(["-break-list"]);
  },
  get_inferior_binary_last_modified_unix_sec(path: any) {
    $.ajax({
      url: "/get_last_modified_unix_sec",
      cache: false,
      method: "GET",
      data: { path: path },
      success: GdbApi._recieve_last_modified_unix_sec,
      error: GdbApi._error_getting_last_modified_unix_sec,
    });
  },
  requestAddBreakpoint: function (fullname: string, line: number) {
    GdbApi.run_gdb_command([`-break-insert "${fullname}:${line}"`]);
  },
  get_delete_break_cmd: function (bkpt_num: any) {
    return `-break-delete ${bkpt_num}`;
  },
  get_break_list_cmd: function () {
    return "-break-list";
  },
  get_load_binary_and_arguments_cmds(binary: string, args: string) {
    // tell gdb which arguments to use when calling the binary, before loading the binary
    const cmds = [
      `-exec-arguments ${args}`, // Set the inferior program arguments, to be used in the next `-exec-run`
      `-file-exec-and-symbols ${binary}`, // Specify the executable file to be debugged. This file is the one from which the symbol table is also read.
    ];
    // add breakpoint if we don't already have one
    if (store.data.auto_add_breakpoint_to_main) {
      cmds.push("-break-insert main");
    }
    cmds.push(GdbApi.get_break_list_cmd());
    return cmds;
  },
  set_assembly_flavor(flavor: string) {
    GdbApi.run_gdb_command(`set disassembly-flavor ${flavor}`);
  },
  _recieve_last_modified_unix_sec(data: { path: any; last_modified_unix_sec: any }) {
    if (data.path === store.data.inferior_binary_path) {
      store.set(
        "inferior_binary_path_last_modified_unix_sec",
        data.last_modified_unix_sec
      );
    }
  },
  _error_getting_last_modified_unix_sec(data: any) {
    void data;
    store.set("inferior_binary_path", null);
  },
};
export default GdbApi;
