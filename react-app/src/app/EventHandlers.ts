import { store } from "./Store";
import GdbApi from "./GdbApi";
import { LocalsClass } from "./Locals";
import MemoryClass from "./Memory";
import constants, { colorTypeMap } from "./constants";
import _ from "lodash";
import $ from "jquery";
import { GdbGuiConsoleEntry } from "./types";
import { DebugProtocol } from "vscode-debugprotocol";
import { ExpressionClass } from "./Expression";

const Handlers = {
  clearProgramState: function () {
    store.set<typeof store.data.line_of_source_to_flash>("line_of_source_to_flash", null);
    store.set<typeof store.data.paused_on_frame>("paused_on_frame", undefined);
    store.set<typeof store.data.selected_frame_num>("selected_frame_num", 0);
    store.set<typeof store.data.stack>("stack", null);
    store.set<typeof store.data.threads>("threads", null);
    MemoryClass.clearMemoryCache();
    LocalsClass.clear();
  },
  onEventInferiorProgramStarting: function () {
    store.set<typeof store.data.gdbguiState>("gdbguiState", "running");
    Handlers.clearProgramState();
  },
  onEventInferiorProgramResuming: function () {
    store.set<typeof store.data.gdbguiState>("gdbguiState", "running");
  },
  onProgramStopped: function (stoppedDetails: DebugProtocol.StoppedEvent) {
    store.set<typeof store.data.gdbguiState>("gdbguiState", "stopped");
    store.set<typeof store.data.stoppedDetails>("stoppedDetails", stoppedDetails);
    // store.set(
    //   "source_code_selection_state",
    //   constants.source_code_selection_states.PAUSED_FRAME
    // );
    // store.set<typeof store.data.paused_on_frame>("paused_on_frame", frame);
    // // @ts-expect-error ts-migrate(2339) FIXME: Property 'fullname' does not exist on type '{}'.
    // store.set<typeof store.data.fullname_to_render>("fullname_to_render", frame.fullname);
    // // @ts-expect-error ts-migrate(2339) FIXME: Property 'line' does not exist on type '{}'.
    // store.set<typeof store.data.line_of_source_to_flash>("line_of_source_to_flash", parseInt(frame.line));
    // // @ts-expect-error ts-migrate(2339) FIXME: Property 'addr' does not exist on type '{}'.
    // store.set<typeof store.data.current_assembly_address>("current_assembly_address", frame.addr);
    // SourceCode.make_current_line_visible();
    Handlers.refreshGdbguiState();
  },
  onDebugeeExited: function () {
    store.set<typeof store.data.gdbguiState>("gdbguiState", "exited");
    store.set<typeof store.data.disassembly_for_missing_file>(
      "disassembly_for_missing_file",
      []
    );
    store.set<typeof store.data.root_gdb_tree_var>("root_gdb_tree_var", null);
    store.set<typeof store.data.previous_register_values>("previous_register_values", {});
    store.set<typeof store.data.current_register_values>("current_register_values", {});
    store.set<typeof store.data.inferior_pid>("inferior_pid", null);
    Handlers.clearProgramState();
  },
  /**
   * Request relevant store information from gdb to refresh UI
   */
  refreshGdbguiState: function () {
    MemoryClass.clearMemoryCache();
    GdbApi.runGdbCommand(GdbApi._getRefreshStateOnStopGdbCommands());
  },
  onConsoleCommandRun: function () {
    if (store.data.refresh_state_after_sending_console_command) {
      GdbApi.runGdbCommand(GdbApi._getRefreshStateOnStopGdbCommands());
    }
  },
  addGdbGuiConsoleEntries: function (entries: any, entryType: GdbGuiConsoleEntry) {
    if (entryType === "STD_OUT") {
      // ignore
      return;
    }
    if (!Array.isArray(entries)) {
      entries = [entries];
    }

    const pty = store.data.gdbguiPty;
    if (pty) {
      entries.forEach((data: string) => {
        if (data === undefined) {
          return;
        }
        const entriesToIgnore = [
          // No registers. appears when refresh commands are run when program hasn't started.
          // TODO The real fix for this is to not refresh commands when the program is not running.
          "No registers.",
        ];
        if (entriesToIgnore.indexOf(data) > -1) {
          return;
        }
        pty.write(colorTypeMap[entryType] ?? constants.xtermColors["reset"]);
        pty.writeln(data);
        pty.write(constants.xtermColors["reset"]);
      });
    } else {
      console.error("Pty not available. New entries are:", entries);
    }
  },
  add_gdb_response_to_console(mi_obj: any) {
    if (!mi_obj) {
      return;
    }
    // Update status
    const entries = [];
    let error = false;
    if (mi_obj.message) {
      if (mi_obj.message === "error") {
        error = true;
      } else {
        entries.push(mi_obj.message);
      }
    }
    if (mi_obj.payload) {
      const interesting_keys = ["msg", "reason", "signal-name", "signal-meaning"];
      for (const k of interesting_keys) {
        if (mi_obj.payload[k]) {
          entries.push(mi_obj.payload[k]);
        }
      }

      if (mi_obj.payload.frame) {
        for (const i of ["file", "func", "line", "addr"]) {
          if (i in mi_obj.payload.frame) {
            entries.push(`${i}: ${mi_obj.payload.frame[i]}`);
          }
        }
      }
    }
    const consoleType = error ? "STD_ERR" : "STD_OUT";
    Handlers.addGdbGuiConsoleEntries(entries, consoleType);
  },
  toggle_modal_visibility() {
    store.set<typeof store.data.show_modal>("show_modal", !store.data.show_modal);
  },
  show_modal(header: any, body: any) {
    store.set<typeof store.data.modal_header>("modal_header", header);
    store.set<typeof store.data.modal_body>("modal_body", body);
    store.set<typeof store.data.show_modal>("show_modal", true);
  },
  setGdbBinaryAndArguments(binary: string, args: string) {
    // remove list of source files associated with the loaded binary since we're loading a new one
    store.set<typeof store.data.source_file_paths>("source_file_paths", []);
    store.set<typeof store.data.language>("language", "c_family");
    store.set<typeof store.data.inferior_binary_path>("inferior_binary_path", null);
    Handlers.onDebugeeExited();
    const cmds = GdbApi.getLoadBinaryAndArgumentsCmds(binary, args);
    GdbApi.runGdbCommand([
      ...cmds,
      `${constants.IGNORE_ERRORS_TOKEN_STR}-data-list-register-names`,
    ]);
    GdbApi.requestInferiorBinaryLastModifiedUnixSec(binary);
  },
  onStackTraceResponse(response: DebugProtocol.StackTraceResponse) {},
  onRemoteConnected() {
    // Handlers.onProgramStopped();
    const cmds = [];
    if (store.data.auto_add_breakpoint_to_main) {
      Handlers.addGdbGuiConsoleEntries(
        "Connected to remote target! Adding breakpoint to main, then continuing target execution.",
        "GDBGUI_OUTPUT"
      );
      cmds.push("-break-insert main");
      cmds.push("-exec-continue");
      cmds.push(GdbApi.get_break_list_cmd());
    } else {
      Handlers.addGdbGuiConsoleEntries(
        'Connected to remote target! Add breakpoint(s), then press "continue" button (do not press "run").',
        "GDBGUI_OUTPUT"
      );
    }
    GdbApi.runGdbCommand(cmds);
  },
  attachToProcess(user_input: any) {
    // https://sourceware.org/gdb/onlinedocs/gdb/GDB_002fMI-Target-Manipulation.html#GDB_002fMI-Target-Manipulation
    GdbApi.runGdbCommand(`-target-attach ${user_input}`);
  },
  fetch_source_files() {
    store.set<typeof store.data.source_file_paths>("source_file_paths", []);
    GdbApi.runGdbCommand("-file-list-exec-source-files");
  },
  viewFile(fullname: Nullable<string>, line: number): void {
    if (!fullname) {
      return;
    }
    store.set<typeof store.data.fullname_to_render>("fullname_to_render", fullname);
    Handlers.setLineState(line);
  },
  setLineState(line: number) {
    store.set(
      "source_code_selection_state",
      constants.source_code_selection_states.USER_SELECTION
    );
    store.set<typeof store.data.line_of_source_to_flash>(
      "line_of_source_to_flash",
      `${line}`
    );
    store.set<typeof store.data.make_current_line_visible>(
      "make_current_line_visible",
      true
    );
  },
  clearCachedAssembly() {
    store.set<typeof store.data.disassembly_for_missing_file>(
      "disassembly_for_missing_file",
      []
    );
    const cached_source_files = store.data.cached_source_files;
    for (const file of cached_source_files) {
      file.assembly = {};
    }
    store.set<typeof store.data.cached_source_files>(
      "cached_source_files",
      cached_source_files
    );
  },
  update_max_lines_of_code_to_fetch(new_value: any) {
    if (new_value <= 0) {
      new_value = constants.default_max_lines_of_code_to_fetch;
    }
    store.set<typeof store.data.max_lines_of_code_to_fetch>(
      "max_lines_of_code_to_fetch",
      new_value
    );
    localStorage.setItem("max_lines_of_code_to_fetch", JSON.stringify(new_value));
  },
  send_signal(signal_name: any, pid: any) {
    $.ajax({
      url: "/send_signal_to_pid",
      cache: false,
      type: "POST",
      data: { signal_name: signal_name, pid: pid },
      success: function (response) {
        Handlers.addGdbGuiConsoleEntries(response.message, "GDBGUI_OUTPUT");
      },
      error: function (response) {
        if (response.responseJSON && response.responseJSON.message) {
          Handlers.addGdbGuiConsoleEntries(
            _.escape(response.responseJSON.message),
            "STD_ERR"
          );
        } else {
          Handlers.addGdbGuiConsoleEntries(
            `${response.statusText} (${response.status} error)`,
            "STD_ERR"
          );
        }
        console.error(response);
      },
      complete: function () {},
    });
  },
};

export default Handlers;
