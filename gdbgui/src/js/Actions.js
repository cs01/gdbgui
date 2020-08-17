import { store } from "statorgfc";
import GdbApi from "./GdbApi.jsx";
import SourceCode from "./SourceCode.jsx";
import Locals from "./Locals.jsx";
import Memory from "./Memory.jsx";
import constants from "./constants.js";
import React from "react";
void React; // using jsx implicity uses React

const Actions = {
  clear_program_state: function() {
    store.set("line_of_source_to_flash", undefined);
    store.set("paused_on_frame", undefined);
    store.set("selected_frame_num", 0);
    store.set("current_thread_id", undefined);
    store.set("stack", []);
    store.set("threads", []);
    Memory.clear_cache();
    Locals.clear();
  },
  inferior_program_starting: function() {
    store.set("inferior_program", constants.inferior_states.running);
    Actions.clear_program_state();
  },
  inferior_program_resuming: function(proc = -1) {
    store.set("inferior_program", constants.inferior_states.running);
    // all processor are resuming
    if (proc == -1) {
      let prcs = store.get("processors_states");
      for (let i = 0; i < store.get("nproc"); i++) {
        prcs[i] = constants.inferior_states.running;
      }
      store.set("processors_states", prcs);
    }
  },
  update_view_source_code: function(frame = {}) {
    store.set("inferior_program", constants.inferior_states.paused);
    store.set(
      "source_code_selection_state",
      constants.source_code_selection_states.PAUSED_FRAME
    );
    store.set("paused_on_frame", frame);
    store.set("fullname_to_render", frame.fullname);
    store.set("line_of_source_to_flash", parseInt(frame.line));
    store.set("current_assembly_address", frame.addr);
    store.set("source_code_infinite_scrolling", false);
    SourceCode.make_current_line_visible();
  },
  inferior_program_paused: function(frame = {}, proc = -1) {
    if (
      store.get("is_mpi") == false ||
      (store.get("is_mpi") == true && proc == store.get("process_on_focus"))
    ) {
      Actions.update_view_source_code(frame);
    }
    Actions.refresh_state_for_gdb_pause(proc);
    if (proc != -1) {
      let pof_prcs = store.get("paused_on_frame_prcs");
      pof_prcs[proc] = frame;
      store.set("paused_on_frame_prcs", pof_prcs);
      let prcs = store.get("processors_states");
      prcs[proc] = constants.inferior_states.paused;
      store.set("processors_states", prcs);
      let ftr_prcs = store.get("fullname_to_render_prcs");
      ftr_prcs[proc] = frame.fullname;
      store.set("fullname_to_render_prcs", ftr_prcs);
      let lostf_prcs = store.get("line_of_source_to_flash_prcs");
      lostf_prcs[proc] = parseInt(frame.line);
      store.set("line_of_source_to_flash_prcs", lostf_prcs);
      let cac_prcs = store.get("current_assembly_address_prcs");
      cac_prcs[proc] = frame.addr;
      store.set("current_assembly_address_prcs", cac_prcs);
    }
  },
  change_process_on_focus: function(proc) {
    store.set("process_on_focus", proc);
    GdbApi.server_change_process_on_focus(proc);
    Actions.refresh_state_for_gdb_pause(proc);
    Actions.refresh_variables_for_change_on_focus(proc);
  },
  refresh_variables_for_change_on_focus: function(proc) {
    GdbApi.refresh_state_for_change_process_on_focus();
  },
  inferior_program_exited: function(proc = -1) {
    store.set("inferior_program", constants.inferior_states.exited);
    store.set("disassembly_for_missing_file", []);
    store.set("root_gdb_tree_var", null);
    store.set("previous_register_values", {});
    store.set("current_register_values", {});
    store.set("inferior_pid", null);
    if (proc != -1) {
      let ps = store.get("processors_states");
      ps[proc] = constants.inferior_states.exited;
      store.set("processors_states", ps);
    }
    Actions.clear_program_state();
  },
  /**
   * Request relevant store information from gdb to refresh UI
   */
  refresh_state_for_gdb_pause: function(proc = -1) {
    GdbApi.run_gdb_command(GdbApi._get_refresh_state_for_pause_cmds(), proc);
  },
  execute_console_command: function(command) {
    if (store.get("refresh_state_after_sending_console_command")) {
      GdbApi.run_command_and_refresh_state(command);
    } else {
      GdbApi.run_gdb_command(command);
    }
  },
  clear_console: function() {
    store.set("gdb_console_entries", []);
  },
  add_console_entries: function(entries, type) {
    if (!_.isArray(entries)) {
      entries = [entries];
    }

    const typed_entries = entries.map(entry => {
      return { type: type, value: entry };
    });

    const previous_entries = store.get("gdb_console_entries");
    const MAX_NUM_ENTRIES = 1000;
    const new_entries = previous_entries.concat(typed_entries);
    if (new_entries.length > MAX_NUM_ENTRIES) {
      new_entries.splice(0, new_entries.length - MAX_NUM_ENTRIES);
    }

    store.set("gdb_console_entries", new_entries);
  },
  add_gdb_response_to_console(mi_obj) {
    if (!mi_obj) {
      return;
    }
    // Update status
    let entries = [],
      error = false;
    if (mi_obj.message) {
      if (mi_obj.message === "error") {
        error = true;
      } else {
        entries.push(mi_obj.message);
      }
    }
    if (mi_obj.payload) {
      const interesting_keys = ["msg", "reason", "signal-name", "signal-meaning"];
      for (let k of interesting_keys) {
        if (mi_obj.payload[k]) {
          entries.push(mi_obj.payload[k]);
        }
      }

      if (mi_obj.payload.frame) {
        for (let i of ["file", "func", "line", "addr"]) {
          if (i in mi_obj.payload.frame) {
            entries.push(`${i}: ${mi_obj.payload.frame[i]}`);
          }
        }
      }
    }
    let type = error
      ? constants.console_entry_type.STD_ERR
      : constants.console_entry_type.STD_OUT;
    Actions.add_console_entries(entries, type);
  },
  toggle_modal_visibility() {
    store.set("show_modal", !store.get("show_modal"));
  },
  show_modal(header, body) {
    store.set("modal_header", header);
    store.set("modal_body", body);
    store.set("show_modal", true);
  },
  set_gdb_binary_and_arguments(binary, args) {
    // remove list of source files associated with the loaded binary since we're loading a new one
    store.set("source_file_paths", []);
    store.set("language", "c_family");
    store.set("inferior_binary_path", null);
    Actions.inferior_program_exited();
    let cmds = GdbApi.get_load_binary_and_arguments_cmds(binary, args);
    GdbApi.run_gdb_command(cmds);
    GdbApi.get_inferior_binary_last_modified_unix_sec(binary);
  },
  connect_to_gdbserver(user_input) {
    // https://sourceware.org/gdb/onlinedocs/gdb/GDB_002fMI-Target-Manipulation.html#GDB_002fMI-Target-Manipulation
    store.set("source_file_paths", []);
    store.set("language", "c_family");
    store.set("inferior_binary_path", null);
    Actions.inferior_program_exited();
    GdbApi.run_gdb_command([`-target-select remote ${user_input}`]);
  },
  connect_to_gdbserver_mpi(user_input) {
    // https://sourceware.org/gdb/onlinedocs/gdb/GDB_002fMI-Target-Manipulation.html#GDB_002fMI-Target-Manipulation
    store.set("source_file_paths", []);
    store.set("language", "c_family");
    store.set("inferior_binary_path", null);
    store.set("process_on_focus", 0);
    store.set("is_mpi", true);
    // create a bigger padding to draw processor on focus selector
    Actions.inferior_program_exited();
    // parse user input
    let user_input_arr = user_input.split(" ");
    let host_port_arr = user_input_arr[0].split(":");
    if (user_input_arr[1] != "-np") {
      // Error
      Actions.add_console_entries(
        "You must specify the number of process with the option -np x (with x number of processes)",
        constants.console_entry_type.GDBGUI_OUTPUT
      );
    }

    store.set("nproc", parseInt(user_input_arr[2]));

    // Before connection we have to create the remaining sessions
    GdbApi.open_mpi_sessions(user_input_arr[2]);

    let data_lines;
    // Check the server names from
    if (host_port_arr[0] === "*") {
      jQuery.ajax({
        url: "mpi_processes_info",
        success: function(data, status) {
          data_lines = data.split(/\r?\n/);
        },
        async: false
      });
    }
    data_lines.pop();

    for (let i = 0; i < data_lines.length; i++) {
      let rank_host = data_lines[i].split(/\s+/);
      let port = (parseInt(host_port_arr[1]) + i).toString();
      GdbApi.run_gdb_command_mpi(
        [`-target-select remote ${rank_host[1]}:${port}`],
        parseInt(rank_host[0])
      );
    }

    GdbApi.set_mpi_state(true);
  },
  remote_connected(proc) {
    Actions.inferior_program_paused();
    let prcs = store.get("processors_states");
    let cmds = [];
    if (store.get("auto_add_breakpoint_to_main")) {
      Actions.add_console_entries(
        "Connected to remote target! Adding breakpoint to main, then continuing target execution.",
        constants.console_entry_type.GDBGUI_OUTPUT
      );
      cmds.push("-break-insert main");
      cmds.push("-exec-continue");
      cmds.push(GdbApi.get_break_list_cmd());

      if (store.get("is_mpi") == true) {
        prcs[proc] = constants.inferior_states.running;
      }
    } else {
      Actions.add_console_entries(
        'Connected to remote target! Add breakpoint(s), then press "continue" button (do not press "run").',
        constants.console_entry_type.GDBGUI_OUTPUT
      );
      if (store.get("is_mpi") == true) {
        prcs[proc] = constants.inferior_states.paused;
      }
    }
    store.set("processors_states", prcs);
    GdbApi.run_gdb_command(cmds, proc);
  },
  attach_to_process(user_input) {
    // https://sourceware.org/gdb/onlinedocs/gdb/GDB_002fMI-Target-Manipulation.html#GDB_002fMI-Target-Manipulation
    GdbApi.run_gdb_command(`-target-attach ${user_input}`);
  },
  fetch_source_files() {
    store.set("source_file_paths", []);
    GdbApi.run_gdb_command("-file-list-exec-source-files", store.get("process_on_focus"));
  },
  view_file(fullname, line) {
    store.set("fullname_to_render", fullname);
    store.set("source_code_infinite_scrolling", false);
    Actions.set_line_state(line);
  },
  set_line_state(line) {
    store.set("source_code_infinite_scrolling", false);
    store.set(
      "source_code_selection_state",
      constants.source_code_selection_states.USER_SELECTION
    );
    store.set("line_of_source_to_flash", parseInt(line));
    store.set("make_current_line_visible", true);
  },
  clear_cached_assembly() {
    store.set("disassembly_for_missing_file", []);
    let cached_source_files = store.get("cached_source_files");
    for (let file of cached_source_files) {
      file.assembly = {};
    }
    store.set("cached_source_files", cached_source_files);
  },
  update_max_lines_of_code_to_fetch(new_value) {
    if (new_value <= 0) {
      new_value = constants.default_max_lines_of_code_to_fetch;
    }
    store.set("max_lines_of_code_to_fetch", new_value);
    localStorage.setItem("max_lines_of_code_to_fetch", JSON.stringify(new_value));
  },
  show_upgrade_modal() {
    const body = (
      <div>
        <span>This feature is only available in gdbgui pro.</span>
        <p />
        <a onClick={() => window.open("http://gdbgui.com")} className="btn btn-primary">
          Upgrade now
        </a>
      </div>
    );
    Actions.show_modal("upgrade to pro for this feature", body);
  },
  send_signal(signal_name, pid) {
    if (store.get("is_mpi") == true) {
      pid = -1;
    }
    $.ajax({
      beforeSend: function(xhr) {
        xhr.setRequestHeader(
          "x-csrftoken",
          initial_data.csrf_token
        ); /* global initial_data */
      },
      url: "/send_signal_to_pid",
      cache: false,
      type: "POST",
      data: { signal_name: signal_name, pid: pid },
      success: function(response) {
        Actions.add_console_entries(
          response.message,
          constants.console_entry_type.GDBGUI_OUTPUT
        );
      },
      error: function(response) {
        if (response.responseJSON && response.responseJSON.message) {
          Actions.add_console_entries(
            _.escape(response.responseJSON.message),
            constants.console_entry_type.STD_ERR
          );
        } else {
          Actions.add_console_entries(
            `${response.statusText} (${response.status} error)`,
            constants.console_entry_type.STD_ERR
          );
        }
        console.error(response);
      },
      complete: function() {}
    });
  }
};

export default Actions;
