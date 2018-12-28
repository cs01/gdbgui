/**
 * This is the main callback when receiving a response from gdb.
 * This callback generally updates the store, which causes components
 * to update.
 */

import React from "react";
import { store } from "statorgfc";
import GdbMiOutput from "./GdbMiOutput.jsx";
import Breakpoints from "./Breakpoints.jsx";
import constants from "./constants.js";
import Threads from "./Threads.jsx";
import FileOps from "./FileOps.jsx";
import Memory from "./Memory.jsx";
import GdbApi from "./GdbApi.jsx";
import Locals from "./Locals.jsx";
import GdbVariable from "./GdbVariable.jsx";
import Modal from "./GdbguiModal.jsx";
import Actions from "./Actions.js";

const process_gdb_response = function(response_array) {
  /**
   * Determines if response is an error and client does not want to be notified of errors for this particular response.
   * @param response: gdb mi response object
   * @return (bool): true if response should be ignored
   */
  let is_error = response => {
      return response.message === "error";
    },
    ignore_error = response => {
      return (
        response.token === constants.IGNORE_ERRORS_TOKEN_INT ||
        response.token === constants.CREATE_VAR_INT
      );
    },
    is_creating_var = response => {
      return response.token === constants.CREATE_VAR_INT;
    },
    is_autocomplete_response = response_array => {
      let num_responses = response_array.length;
      if (num_responses < 2) {
        return false;
      }

      let first_element = response_array[0],
        last_element = response_array[num_responses - 1];
      if (
        first_element.type === "log" &&
        first_element.payload &&
        first_element.payload.startsWith("complete ") &&
        last_element.message === "done" &&
        last_element.stream === "stdout" &&
        last_element.type === "result"
      ) {
        // don't do this unless other checks are true to avoid a potentially expensive slice (copy) of the array
        let gdb_completion_output = response_array.slice(1, num_responses - 1);
        return gdb_completion_output.every(
          c => c.type === "console" && c.stream === "stdout" && c.message === null
        );
      } else {
        return false;
      }
    };
  // if this is an autocomplete response, we will process it here and not
  if (is_autocomplete_response(response_array)) {
    let gdb_completion_output = response_array.slice(1, response_array.length - 1),
      options = gdb_completion_output.map(o => o.payload.replace(/\\n/g, ""));
    store.set("gdb_autocomplete_options", options);
    return;
  }

  for (let r of response_array) {
    // gdb mi output
    GdbMiOutput.add_mi_output(r);

    if (is_error(r)) {
      if (is_creating_var(r)) {
        GdbVariable.gdb_variable_fetch_failed(r);
        continue;
      } else if (ignore_error(r)) {
        continue;
      } else if (r.token === constants.DISASSEMBLY_FOR_MISSING_FILE_INT) {
        FileOps.fetch_disassembly_for_missing_file_failed();
      } else if (
        r.token === constants.INLINE_DISASSEMBLY_INT &&
        r.payload &&
        r.payload.msg.indexOf("Mode argument must be 0, 1, 2, or 3.") !== -1
      ) {
        // we tried to fetch disassembly for a newer version of gdb, but it didn't work
        // try again with mode 3, for older gdb api's
        store.set("gdb_version", ["7", "6", "0"]);
        FileOps.fetch_assembly_cur_line(3);
      } else if (
        r.payload &&
        r.payload.msg &&
        r.payload.msg.startsWith("Unable to find Mach task port")
      ) {
        Actions.add_gdb_response_to_console(r);
        Actions.add_console_entries(
          <React.Fragment>
            <span>Follow </span>
            <a href="https://github.com/cs01/gdbgui/issues/55#issuecomment-288209648">
              these instructions
            </a>
            <span> to fix this error</span>
          </React.Fragment>,
          constants.console_entry_type.GDBGUI_OUTPUT_RAW
        );
        continue;
      }
    }

    if (r.type === "result" && r.message === "done" && r.payload) {
      // This is special GDB Machine Interface structured data that we
      // can render in the frontend
      if ("bkpt" in r.payload) {
        let new_bkpt = r.payload.bkpt;

        // remove duplicate breakpoints
        let cmds = store
          .get("breakpoints")
          .filter(
            b =>
              new_bkpt.fullname === b.fullname &&
              new_bkpt.func === b.func &&
              new_bkpt.line === b.line
          )
          .map(b => GdbApi.get_delete_break_cmd(b.number));
        GdbApi.run_gdb_command(cmds);

        // save this breakpoint
        let bkpt = Breakpoints.save_breakpoint(r.payload.bkpt);

        // if executable does not have debug symbols (i.e. not compiled with -g flag)
        // gdb will not return a path, but rather the function name. The function name is
        // not a file, and therefore it cannot be displayed. Make sure the path is known before
        // trying to render the file of the newly created breakpoint.
        if (_.isString(bkpt.fullname_to_display)) {
          // a normal breakpoint or child breakpoint
          Actions.view_file(bkpt.fullname_to_display, parseInt(bkpt.line));
        }

        // refresh all breakpoints
        GdbApi.refresh_breakpoints();
      }
      if ("BreakpointTable" in r.payload) {
        Breakpoints.save_breakpoints(r.payload);
      }
      if ("stack" in r.payload) {
        Threads.update_stack(r.payload.stack);
      }
      if ("threads" in r.payload) {
        store.set("threads", r.payload.threads);
        if (store.get("interpreter") === "gdb") {
          store.set("current_thread_id", parseInt(r.payload["current-thread-id"]));
        } else if (store.get("interpreter") === "lldb") {
          // lldb does not provide this
        }
      }
      if ("register-names" in r.payload) {
        let names = r.payload["register-names"];
        // filter out empty names
        store.set("register_names", names.filter(name => name !== ""));
      }
      if ("register-values" in r.payload) {
        store.set("previous_register_values", store.get("current_register_values"));
        store.set("current_register_values", r.payload["register-values"]);
      }
      if ("asm_insns" in r.payload) {
        FileOps.save_new_assembly(r.payload.asm_insns, r.token);
      }
      if ("files" in r.payload) {
        if (r.payload.files.length > 0) {
          let source_file_paths = _.uniq(r.payload.files.map(f => f.fullname)).sort();
          store.set("source_file_paths", source_file_paths);

          let language = "c_family";
          if (source_file_paths.some(p => p.endsWith(".rs"))) {
            language = "rust";
            let gdb_version_array = store.get("gdb_version_array");
            // rust cannot view registers with gdb 7.12.x
            if (gdb_version_array[0] == 7 && gdb_version_array[1] == 12) {
              Actions.add_console_entries(
                `Warning: Due to a bug in gdb version ${store.get(
                  "gdb_version"
                )}, gdbgui cannot show register values with rust executables. See https://github.com/cs01/gdbgui/issues/64 for details.`,
                constants.console_entry_type.STD_ERR
              );
              store.set("can_fetch_register_values", false);
            }
          } else if (source_file_paths.some(p => p.endsWith(".go"))) {
            language = "go";
          }
          store.set("language", language);
        } else {
          store.set("source_file_paths", [
            "Either no executable is loaded or the executable was compiled without debug symbols."
          ]);

          if (store.get("inferior_binary_path")) {
            Modal.render(
              "Warning",
              <div>
                This binary was not compiled with debug symbols. Recompile with the -g
                flag for a better debugging experience.
                <p />
                <p />
                Read more:{" "}
                <a href="http://www.delorie.com/gnu/docs/gdb/gdb_17.html">
                  http://www.delorie.com/gnu/docs/gdb/gdb_17.html
                </a>
              </div>
            );
          }
        }
      }
      if ("memory" in r.payload) {
        Memory.add_value_to_cache(
          r.payload.memory[0].begin,
          r.payload.memory[0].contents
        );
      }
      // gdb returns local variables as "variables" which is confusing, because you can also create variables
      // in gdb with '-var-create'. *Those* types of variables are referred to as "expressions" in gdbgui, and
      // are returned by gdbgui as "changelist", or have the keys "has_more", "numchild", "children", or "name".
      if ("variables" in r.payload) {
        Locals.save_locals(r.payload.variables);
      }
      // gdbgui expression (aka a gdb variable was changed)
      if ("changelist" in r.payload) {
        GdbVariable.handle_changelist(r.payload.changelist);
      }
      // gdbgui expression was evaluated for the first time for a child variable
      if ("has_more" in r.payload && "numchild" in r.payload && "children" in r.payload) {
        GdbVariable.gdb_created_children_variables(r);
      }
      // gdbgui expression was evaluated for the first time for a root variable
      if ("name" in r.payload) {
        GdbVariable.gdb_created_root_variable(r);
      }
    } else if (r.type === "result" && r.message === "error") {
      // render it in the status bar, and don't render the last response in the array as it does by default
      Actions.add_gdb_response_to_console(r);

      // we tried to load a binary, but gdb couldn't find it
      if (
        r.payload.msg ===
        `${store.get("inferior_binary_path")}: No such file or directory.`
      ) {
        Actions.inferior_program_exited();
      }
    } else if (r.type === "console") {
      Actions.add_console_entries(
        r.payload,
        r.stream === "stderr"
          ? constants.console_entry_type.STD_ERR
          : constants.console_entry_type.STD_OUT
      );
      if (store.get("gdb_version") === undefined) {
        // parse gdb version from string such as
        // GNU gdb (Ubuntu 7.7.1-0ubuntu5~14.04.2) 7.7.1
        let m = /GNU gdb \(.*\)\s+([0-9|.]*)\\n/g;
        let a = m.exec(r.payload);
        if (_.isArray(a) && a.length === 2) {
          store.set("gdb_version", a[1]);
          store.set("gdb_version_array", a[1].split("."));
        }
      }
    } else if (r.type === "output" || r.type === "target" || r.type === "log") {
      // output of program
      Actions.add_console_entries(
        r.payload,
        r.stream === "stderr"
          ? constants.console_entry_type.STD_ERR
          : constants.console_entry_type.STD_OUT
      );
    } else if (r.type === "notify") {
      if (r.message === "thread-group-started") {
        store.set("inferior_pid", parseInt(r.payload.pid));
      }
    }

    if (r.message && r.message === "stopped") {
      if (r.payload && r.payload.reason) {
        if (r.payload.reason.includes("exited")) {
          Actions.inferior_program_exited();
        } else if (
          r.payload.reason.includes("breakpoint-hit") ||
          r.payload.reason.includes("end-stepping-range")
        ) {
          if (r.payload["new-thread-id"]) {
            Threads.set_thread_id(r.payload["new-thread-id"]);
          }
          Actions.inferior_program_paused(r.payload.frame);
        } else if (r.payload.reason === "signal-received") {
          Actions.inferior_program_paused(r.payload.frame);

          if (r.payload["signal-name"] !== "SIGINT") {
            Actions.add_console_entries(
              `gdbgui noticed a signal was received (${r.payload["signal-meaning"]}, ${
                r.payload["signal-name"]
              }).`,
              constants.console_entry_type.GDBGUI_OUTPUT
            );
            Actions.add_console_entries(
              "If the program exited due to a fault, you can attempt to re-enter the state of the program when the fault ",
              constants.console_entry_type.GDBGUI_OUTPUT
            );
            Actions.add_console_entries(
              "occurred by clicking the below button.",
              constants.console_entry_type.GDBGUI_OUTPUT
            );

            Actions.add_console_entries(
              "Re-Enter Program (backtrace)",
              constants.console_entry_type.BACKTRACE_LINK
            );
          }
        } else {
          console.warn("TODO handle new reason for stopping. Notify developer of this.");
          console.warn(r);
        }
      } else {
        Actions.inferior_program_paused(r.payload.frame);
      }
    } else if (r.message && r.message === "connected") {
      Actions.remote_connected();
    }
  }
};

export default process_gdb_response;
