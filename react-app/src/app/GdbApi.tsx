/**
 * An object to manage the websocket connection to the python server that manages gdb,
 * to send various commands to gdb, to and to dispatch gdb responses to gdbgui.
 */
import { store } from "./Store";
import { RegisterClass } from "./Registers";
import MemoryClass from "./Memory";
import Handlers from "./EventHandlers";
import constants from "./constants";
import { initial_data } from "./InitialData";
import _ from "lodash";
import $ from "jquery";
import { GdbWebsocket } from "./Websocket";

const GdbApi = {
  clickRunButton: function () {
    Handlers.onEventInferiorProgramStarting();
    GdbApi.runGdbCommand("-exec-run");
  },
  runInitialCommands: function () {
    const cmds = ["-list-features", "-list-target-features"];
    for (const src in initial_data.remap_sources) {
      const dst = initial_data.remap_sources[src];
      cmds.push(`set substitute-path "${src}" "${dst}"`);
    }
    GdbApi.runGdbCommand(cmds);
  },
  requestContinue: function (reverse = false) {
    Handlers.onEventInferiorProgramResuming();
    GdbApi.runGdbCommand(
      "-exec-continue" + (store.data.debug_in_reverse || reverse ? " --reverse" : "")
    );
  },
  requestNext: function (reverse = false) {
    Handlers.onEventInferiorProgramResuming();
    GdbApi.runGdbCommand(
      "-exec-next" + (store.data.debug_in_reverse || reverse ? " --reverse" : "")
    );
  },
  requestStep: function (reverse = false) {
    Handlers.onEventInferiorProgramResuming();
    GdbApi.runGdbCommand(
      "-exec-step" + (store.data.debug_in_reverse || reverse ? " --reverse" : "")
    );
  },
  click_return_button: function () {
    // From gdb mi docs (https://sourceware.org/gdb/onlinedocs/gdb/GDB_002fMI-Program-Execution.html#GDB_002fMI-Program-Execution):
    // `-exec-return` Makes current function return immediately. Doesn't execute the inferior.
    // That means we do NOT dispatch the event `event_inferior_program_resuming`, because it's not, in fact, running.
    // The return also doesn't even indicate that it's paused, so we need to manually trigger the event here.
    GdbApi.runGdbCommand("-exec-return");
    Handlers.refreshGdbguiState();
  },
  requestSendNextInstruction: function (reverse = false) {
    Handlers.onEventInferiorProgramResuming();
    GdbApi.runGdbCommand(
      "-exec-next-instruction" +
        (store.data.debug_in_reverse || reverse ? " --reverse" : "")
    );
  },
  requestSendStepInstruction: function (reverse = false) {
    Handlers.onEventInferiorProgramResuming();
    GdbApi.runGdbCommand(
      "-exec-step-instruction" +
        (store.data.debug_in_reverse || reverse ? " --reverse" : "")
    );
  },
  requestConnectToGdbserver(user_input: string) {
    // https://sourceware.org/gdb/onlinedocs/gdb/GDB_002fMI-Target-Manipulation.html#GDB_002fMI-Target-Manipulation
    store.set<typeof store.data.source_file_paths>("source_file_paths", []);
    store.set<typeof store.data.language>("language", "c_family");
    store.set<typeof store.data.inferior_binary_path>("inferior_binary_path", null);
    Handlers.onDebugeeExited();
    GdbApi.runGdbCommand([`-target-select remote ${user_input}`]);
  },
  requestInterrupt: function () {
    Handlers.onEventInferiorProgramResuming();
    GdbApi.runGdbCommand("-exec-interrupt");
  },
  requestSelectFrame: function (framenum: string) {
    // TODO this command is deprecated (https://sourceware.org/gdb/onlinedocs/gdb/GDB_002fMI-Stack-Manipulation.html)
    // This command in deprecated in favor of passing the ‘--frame’ option to every command.
    store.set<typeof store.data.selected_frame_num>(
      "selected_frame_num",
      parseInt(framenum)
    );
    store.set<typeof store.data.line_of_source_to_flash>("line_of_source_to_flash", null);
    store.set<typeof store.data.make_current_line_visible>(
      "make_current_line_visible",
      true
    );
    GdbApi.runCommandAndRefreshState(`-stack-select-frame ${framenum}`);
  },
  requestSelectThreadId: function (thread_id: any) {
    // TODO this command is deprecated (http://www.sourceware.org/gdb/current/onlinedocs/gdb/GDB_002fMI-Thread-Commands.html)
    // This command is deprecated in favor of explicitly using the ‘--thread’ option to each command.
    GdbApi.runCommandAndRefreshState(`-thread-select ${thread_id}`);
  },
  /**
   * runs a gdb cmd (or commands) directly in gdb on the backend
   * validates command before sending, and updates the gdb console and status bar
   * @param cmd: a string or array of strings, that are directly evaluated by gdb
   * @return nothing
   */
  runGdbCommand: function (gdbCommand: Array<string> | string): void {
    const gdbWebsocket: Nullable<GdbWebsocket> = store.data.gdbWebsocket;
    if (gdbWebsocket) {
      gdbWebsocket.runGdbCommand(Array.isArray(gdbCommand) ? gdbCommand : [gdbCommand]);
    }
  },
  runCommandAndRefreshState: function (user_cmd: string | any[]) {
    let cmds: any[] = [];
    if (Array.isArray(user_cmd)) {
      cmds = cmds.concat(user_cmd);
    } else if (_.isString(user_cmd) && user_cmd.length > 0) {
      cmds.push(user_cmd);
    }
    cmds = cmds.concat(GdbApi._getRefreshStateOnStopGdbCommands());
    GdbApi.runGdbCommand(cmds);
  },
  requestBacktrace: function () {
    let cmds = ["backtrace"];
    cmds = cmds.concat(GdbApi._getRefreshStateOnStopGdbCommands());
    store.set<typeof store.data.gdbguiState>("gdbguiState", "stopped");
    GdbApi.runGdbCommand(cmds);
  },
  /**
   * Get array of commands to send to gdb that refreshes everything in the
   * frontend
   */
  _getRefreshStateOnStopGdbCommands: function () {
    let cmds = [
      // Reports information about either a specific thread,
      // if the thread-id parameter is present, or about all threads.
      // thread-id is the thread’s global thread ID.
      // When printing information about all threads, also reports the global
      // ID of the current thread.
      constants.IGNORE_ERRORS_TOKEN_STR + "-thread-info",

      // print the name, type and value for simple data types,
      // and the name and type for arrays, structures and unions.
      constants.IGNORE_ERRORS_TOKEN_STR + "-stack-list-variables --simple-values",
    ];
    // update all user-defined variables in gdb
    cmds.push(constants.IGNORE_ERRORS_TOKEN_STR + "-var-update --all-values *");

    // update registers
    cmds = cmds.concat(RegisterClass.get_update_cmds());

    // re-fetch memory over desired range as specified by DOM inputs
    cmds = cmds.concat(MemoryClass.getRequestReadMemoryCommmands(true));

    // refresh breakpoints
    cmds.push(GdbApi.get_break_list_cmd());

    // List the frames currently on the stack.
    // avoid the "no registers" error
    cmds.push(constants.IGNORE_ERRORS_TOKEN_STR + "-stack-list-frames");
    return cmds;
  },
  requestBreakpointList: function () {
    GdbApi.runGdbCommand(["-break-list"]);
  },
  requestInferiorBinaryLastModifiedUnixSec(path: any) {
    $.ajax({
      url: "/get_last_modified_unix_sec",
      cache: false,
      method: "GET",
      data: { path: path },
      success: GdbApi._recieve_last_modified_unix_sec,
      error: GdbApi._error_getting_last_modified_unix_sec,
    });
  },
  requestAddBreakpoint: function (fullname: string, line: number): void {
    GdbApi.runGdbCommand([`-break-insert "${fullname}:${line}"`]);
    GdbApi.requestBreakpointList();
  },
  requestDeleteBreakpoint: function (breakpointNumber: number): void {
    GdbApi.runGdbCommand([`-break-delete ${breakpointNumber}`]);
    GdbApi.requestBreakpointList();
  },
  get_break_list_cmd: function () {
    return "-break-list";
  },
  getLoadBinaryAndArgumentsCmds(binary: string, args: string) {
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
    GdbApi.runGdbCommand(`set disassembly-flavor ${flavor}`);
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
    store.set<typeof store.data.inferior_binary_path>("inferior_binary_path", null);
  },
};
export default GdbApi;
