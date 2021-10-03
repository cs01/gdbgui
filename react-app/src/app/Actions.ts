import { store } from "./GlobalState";
import GdbApi from "./GdbApi";
import Locals from "./Locals";
import Memory from "./Memory";
import constants from "./constants";
import _ from "lodash";
import $ from "jquery";

const Actions = {
  clear_program_state: function () {
    store.set("line_of_source_to_flash", undefined);
    store.set("paused_on_frame", undefined);
    store.set("selected_frame_num", 0);
    store.set("current_thread_id", undefined);
    store.set("stack", []);
    store.set("threads", []);
    Memory.clear_cache();
    Locals.clear();
  },
  onEventInferiorProgramStarting: function () {
    store.set("inferior_program", constants.inferior_states.running);
    Actions.clear_program_state();
  },
  onEventInferiorProgramResuming: function () {
    store.set("inferior_program", constants.inferior_states.running);
  },
  onEventInferiorProgramStopped: function (frame = {}) {
    store.set("inferior_program", constants.inferior_states.paused);
    store.set(
      "source_code_selection_state",
      constants.source_code_selection_states.PAUSED_FRAME
    );
    store.set("paused_on_frame", frame);
    // @ts-expect-error ts-migrate(2339) FIXME: Property 'fullname' does not exist on type '{}'.
    store.set("fullname_to_render", frame.fullname);
    // @ts-expect-error ts-migrate(2339) FIXME: Property 'line' does not exist on type '{}'.
    store.set("line_of_source_to_flash", parseInt(frame.line));
    // @ts-expect-error ts-migrate(2339) FIXME: Property 'addr' does not exist on type '{}'.
    store.set("current_assembly_address", frame.addr);
    // SourceCode.make_current_line_visible();
    Actions.refresh_state_for_gdb_pause();
  },
  inferiorProgramExited: function () {
    store.set("inferior_program", constants.inferior_states.exited);
    store.set("disassembly_for_missing_file", []);
    store.set("root_gdb_tree_var", null);
    store.set("previous_register_values", {});
    store.set("current_register_values", {});
    store.set("inferior_pid", null);
    Actions.clear_program_state();
  },
  /**
   * Request relevant store information from gdb to refresh UI
   */
  refresh_state_for_gdb_pause: function () {
    GdbApi.run_gdb_command(GdbApi._get_refresh_state_for_pause_cmds());
  },
  onConsoleCommandRun: function () {
    if (store.data.refresh_state_after_sending_console_command) {
      GdbApi.run_gdb_command(GdbApi._get_refresh_state_for_pause_cmds());
    }
  },
  addGdbGuiConsoleEntries: function (entries: any, type: any) {
    if (type === constants.console_entry_type.STD_OUT) {
      // ignore
      return;
    }
    if (!Array.isArray(entries)) {
      entries = [entries];
    }

    // @ts-ignore
    const pty = window.gdbguiPty;
    if (pty) {
      entries.forEach((data: string) => {
        const entriesToIgnore = [
          // No registers. appears when refresh commands are run when program hasn't started.
          // TODO The real fix for this is to not refresh commands when the program is not running.
          "No registers.",
        ];
        if (entriesToIgnore.indexOf(data) > -1) {
          return;
        }
        // @ts-expect-error ts-migrate(2339) FIXME: Property 'colorTypeMap' does not exist on type 'Re... Remove this comment to see the full error message
        pty.write(constants.colorTypeMap[type] ?? constants.xtermColors["reset"]);
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
    const type = error
      ? constants.console_entry_type.STD_ERR
      : constants.console_entry_type.STD_OUT;
    Actions.addGdbGuiConsoleEntries(entries, type);
  },
  toggle_modal_visibility() {
    store.set("show_modal", !store.data.show_modal);
  },
  show_modal(header: any, body: any) {
    store.set("modal_header", header);
    store.set("modal_body", body);
    store.set("show_modal", true);
  },
  setGdbBinaryAndArguments(binary: string, args: string) {
    // remove list of source files associated with the loaded binary since we're loading a new one
    store.set("source_file_paths", []);
    store.set("language", "c_family");
    store.set("inferior_binary_path", null);
    Actions.inferiorProgramExited();
    const cmds = GdbApi.get_load_binary_and_arguments_cmds(binary, args);
    GdbApi.run_gdb_command(cmds);
    GdbApi.get_inferior_binary_last_modified_unix_sec(binary);
  },
  remote_connected() {
    Actions.onEventInferiorProgramStopped();
    const cmds = [];
    if (store.data.auto_add_breakpoint_to_main) {
      Actions.addGdbGuiConsoleEntries(
        "Connected to remote target! Adding breakpoint to main, then continuing target execution.",
        constants.console_entry_type.GDBGUI_OUTPUT
      );
      cmds.push("-break-insert main");
      cmds.push("-exec-continue");
      cmds.push(GdbApi.get_break_list_cmd());
    } else {
      Actions.addGdbGuiConsoleEntries(
        'Connected to remote target! Add breakpoint(s), then press "continue" button (do not press "run").',
        constants.console_entry_type.GDBGUI_OUTPUT
      );
    }
    GdbApi.run_gdb_command(cmds);
  },
  attachToProcess(user_input: any) {
    // https://sourceware.org/gdb/onlinedocs/gdb/GDB_002fMI-Target-Manipulation.html#GDB_002fMI-Target-Manipulation
    GdbApi.run_gdb_command(`-target-attach ${user_input}`);
  },
  fetch_source_files() {
    store.set("source_file_paths", []);
    GdbApi.run_gdb_command("-file-list-exec-source-files");
  },
  viewFile(fullname: any, line: number) {
    store.set("fullname_to_render", fullname);
    Actions.setLineState(line);
  },
  setLineState(line: number) {
    store.set(
      "source_code_selection_state",
      constants.source_code_selection_states.USER_SELECTION
    );
    store.set("line_of_source_to_flash", line);
    store.set("make_current_line_visible", true);
  },
  clearCachedAssembly() {
    store.set("disassembly_for_missing_file", []);
    const cached_source_files = store.data.cached_source_files;
    for (const file of cached_source_files) {
      file.assembly = {};
    }
    store.set("cached_source_files", cached_source_files);
  },
  update_max_lines_of_code_to_fetch(new_value: any) {
    if (new_value <= 0) {
      new_value = constants.default_max_lines_of_code_to_fetch;
    }
    store.set("max_lines_of_code_to_fetch", new_value);
    localStorage.setItem("max_lines_of_code_to_fetch", JSON.stringify(new_value));
  },
  send_signal(signal_name: any, pid: any) {
    $.ajax({
      url: "/send_signal_to_pid",
      cache: false,
      type: "POST",
      data: { signal_name: signal_name, pid: pid },
      success: function (response) {
        Actions.addGdbGuiConsoleEntries(
          response.message,
          constants.console_entry_type.GDBGUI_OUTPUT
        );
      },
      error: function (response) {
        if (response.responseJSON && response.responseJSON.message) {
          Actions.addGdbGuiConsoleEntries(
            _.escape(response.responseJSON.message),
            constants.console_entry_type.STD_ERR
          );
        } else {
          Actions.addGdbGuiConsoleEntries(
            `${response.statusText} (${response.status} error)`,
            constants.console_entry_type.STD_ERR
          );
        }
        console.error(response);
      },
      complete: function () {},
    });
  },
};

export default Actions;
