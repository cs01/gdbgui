/**
 * This is the main callback when receiving a response from gdb.
 * This callback generally updates the store, which causes components
 * to update.
 */

import React from "react";
import { store } from "./Store";
import { saveNewMiOutput } from "./GdbMiOutput";
import Breakpoints from "./Breakpoints";
import constants from "./constants";
import Threads from "./Threads";
import FileOps from "./FileOps";
import MemoryClass from "./Memory";
import GdbApi from "./GdbApi";
import { LocalsClass } from "./Locals";
import { ExpressionClass } from "./Expression";
import { Modal } from "./GdbguiModal";
import Handlers from "./EventHandlers";
import _ from "lodash";
import {
  GdbLocalVariable,
  GdbMiChildrenVarResponse,
  GdbMiMessage,
  GdbMiRegisterValue,
} from "./types";
import { RegisterClass } from "./Registers";
/**
 * Determines if response is an error and client does not want to be notified of errors for this particular response.
 * @param response: gdb mi response object
 * @return (bool): true if response should be ignored
 */
const isError = (response: any) => {
  return response.message === "error";
};
const ignoreError = (response: any) => {
  return (
    response.token === constants.IGNORE_ERRORS_TOKEN_INT ||
    response.token === constants.CREATE_VAR_INT
  );
};
const isCreatingVar = (response: any) => {
  return response.token === constants.CREATE_VAR_INT;
};

function handleGdbMessage(r: GdbMiMessage) {
  // gdb mi output
  saveNewMiOutput(r);

  if (isError(r)) {
    if (isCreatingVar(r)) {
      ExpressionClass.gdb_variable_fetch_failed(r);
      return;
    } else if (ignoreError(r)) {
      return;
    } else if (r.token === constants.DISASSEMBLY_FOR_MISSING_FILE_INT) {
      FileOps.fetch_disassembly_for_missing_file_failed();
    } else if (r.payload && !Array.isArray(r.payload) && r.payload.msg) {
      if (r.payload.msg.startsWith("Unable to find Mach task port")) {
        Handlers.addGdbResponseToConsole(r);
        Handlers.addGdbGuiConsoleEntries(
          <React.Fragment>
            <span>Follow </span>
            <a href="https://github.com/cs01/gdbgui/issues/55#issuecomment-288209648">
              these instructions
            </a>
            <span> to fix this error</span>
          </React.Fragment>,
          "GDBGUI_OUTPUT_RAW"
        );
        return;
      } else if (r.payload.msg === "The program is not being run.") {
        store.set<typeof store.data.gdbguiState>("gdbguiState", "ready");
      } else if (
        r.payload &&
        (r.payload.msg as string).includes("No executable file specified")
      ) {
        store.set<typeof store.data.gdbguiState>("gdbguiState", "ready");
      }
    }
  }

  if (r.type === "result" && r.message === "done" && r.payload) {
    // This is special GDB Machine Interface structured data that we
    // can render in the frontend
    if ("bkpt" in r.payload) {
      const new_bkpt = r.payload.bkpt;

      // remove duplicate breakpoints
      store.data.breakpoints
        .filter(
          (b: any) =>
            new_bkpt.fullname === b.fullname &&
            new_bkpt.func === b.func &&
            new_bkpt.line === b.line
        )
        .forEach((b: any) => GdbApi.requestDeleteBreakpoint(b.number));

      // save this breakpoint
      const bkpt = Breakpoints.saveBreakpoint(r.payload.bkpt);

      // if executable does not have debug symbols (i.e. not compiled with -g flag)
      // gdb will not return a path, but rather the function name. The function name is
      // not a file, and therefore it cannot be displayed. Make sure the path is known before
      // trying to render the file of the newly created breakpoint.
      if (_.isString(bkpt.fullNameToDisplay)) {
        // a normal breakpoint or child breakpoint
        Handlers.viewFile(bkpt.fullNameToDisplay, bkpt.line);
      }
      GdbApi.requestBreakpointList();
    }
    if ("BreakpointTable" in r.payload) {
      Breakpoints.saveBreakpoints(r.payload);
    }
    if ("stack" in r.payload) {
      Threads.update_stack(r.payload.stack);
    }
    if ("threads" in r.payload) {
      store.set<typeof store.data.threads>("threads", {
        currentThreadId: r.payload["current-thread-id"],
        threads: r.payload.threads,
      });
    }
    if ("register-names" in r.payload) {
      RegisterClass.saveRegisterNames(r.payload["register-names"] as string[]);
    }
    if ("register-values" in r.payload) {
      RegisterClass.saveRegisterValues(
        r.payload["register-values"] as GdbMiRegisterValue[]
      );
    }
    if ("asm_insns" in r.payload) {
      FileOps.saveNewAssembly(r.payload.asm_insns, r.token);
    }
    if ("files" in r.payload) {
      if (r.payload.files.length > 0) {
        const sourceFilePaths = _.uniq(
          r.payload.files.map((f: any) => f.fullname)
        ).sort();
        store.set<typeof store.data.source_file_paths>(
          "source_file_paths",
          sourceFilePaths
        );

        let language = "c_family";
        if (sourceFilePaths.some((p: any) => p.endsWith(".rs"))) {
          language = "rust";
          // const gdb_version_array = store.data.gdb_version_array;
          // // rust cannot view registers with gdb 7.12.x
          // if (gdb_version_array[0] == 7 && gdb_version_array[1] == 12) {
          //   Actions.add_console_entries(
          //     `Warning: Due to a bug in gdb version ${store.get(
          //       "gdb_version"
          //     )}, gdbgui cannot show register values with rust executables. See https://github.com/cs01/gdbgui/issues/64 for details.`,
          //     "STD_ERR"
          //   );
          //   store.set<typeof store.data.can_fetch_register_values>("can_fetch_register_values", false);
          // }
        } else if (sourceFilePaths.some((p: any) => p.endsWith(".go"))) {
          language = "go";
        }
        store.set<typeof store.data.language>("language", language);
      } else {
        store.set<typeof store.data.source_file_paths>("source_file_paths", [
          "Either no executable is loaded or the executable was compiled without debug symbols.",
        ]);

        if (store.data.inferior_binary_path) {
          store.set<typeof store.data.modalData>("modalData", {
            show: true,
            header: "Warning",
            modalBody: (
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
            ),
          });
        }
      }
    }
    if ("memory" in r.payload) {
      // example
      // {
      //   "type": "result",
      //   "message": "done",
      //   "payload": {
      //     "memory": [
      //       {
      //         "begin": "0x0000555555555244",
      //         "offset": "0x0000000000000000",
      //         "end": "0x0000555555555245",
      //         "contents": "00"
      MemoryClass.addValueToCache(r.payload.memory);
    }
    // gdb returns local variables as "variables" which is confusing, because you can also create expressions
    // in gdb with '-var-create'. *Those* types of variables are referred to as "expressions" in gdbgui, and
    // are returned by gdbgui as "changelist", or have the keys "has_more", "numchild", "children", or "name".
    if ("variables" in r.payload) {
      LocalsClass.saveLocals(r.payload.variables as Array<GdbLocalVariable>);
    }
    // gdbgui expression (aka a gdb variable was changed)
    if ("changelist" in r.payload) {
      ExpressionClass.handle_changelist(r.payload.changelist);
    }
    // gdbgui expression was evaluated for the first time for a child variable
    if ("has_more" in r.payload && "numchild" in r.payload && "children" in r.payload) {
      ExpressionClass.gdb_created_children_variables(
        r.payload as GdbMiChildrenVarResponse
      );
    }
    // gdbgui expression was evaluated for the first time for a root variable
    if ("name" in r.payload) {
      ExpressionClass.createdRootExpression(r);
    }
    // features list
    if ("features" in r.payload) {
      store.set<typeof store.data.features>("features", r.payload.features);
      if (r.payload.features.indexOf("reverse") !== -1) {
        store.set<typeof store.data.reverse_supported>("reverse_supported", true);
      }
    }
    // features list
    if ("target_features" in r.payload) {
      // @ts-expect-error ts-migrate(2304) FIXME: Cannot find name 'processTargetFeatures'.
      processTargetFeatures(r.payload.target_features);
    }
  } else if (r.type === "result" && r.message === "error") {
    // render it in the status bar, and don't render the last response in the array as it does by default
    Handlers.addGdbResponseToConsole(r);

    // we tried to load a binary, but gdb couldn't find it
    if (
      r.payload &&
      !Array.isArray(r.payload) &&
      r.payload.msg === `${store.data.inferior_binary_path}: No such file or directory.`
    ) {
      Handlers.onDebugeeExited();
    }
  } else if (r.type === "console") {
    Handlers.addGdbGuiConsoleEntries(
      r.payload,
      r.stream === "stderr" ? "STD_ERR" : "STD_OUT"
    );
  } else if (r.type === "output" || r.type === "target" || r.type === "log") {
    // output of program
    Handlers.addGdbGuiConsoleEntries(
      r.payload,
      r.stream === "stderr" ? "STD_ERR" : "STD_OUT"
    );
  } else if (r.type === "notify") {
    if (r.message === "thread-group-started") {
      if (r.payload && !Array.isArray(r.payload))
        store.set<typeof store.data.inferior_pid>(
          "inferior_pid",
          parseInt(r.payload.pid)
        );
    }
  }

  if (r.message && r.message === "stopped" && r.type === "notify") {
    if (r.payload && !Array.isArray(r.payload) && r.payload.reason) {
      if (r.payload.reason.includes("exited")) {
        Handlers.onDebugeeExited();
      } else {
        Handlers.onProgramStopped({
          seq: 0,
          event: "program stopped",
          type: "event",
          body: {
            reason: r.payload.reason,
            threadId: r.payload["thread-id"],
            allThreadsStopped: r.payload["stopped-threads"] === "all",
          },
        });
        if (
          r.payload.reason === "signal-received" &&
          r.payload["signal-name"] !== "SIGINT"
        ) {
          Handlers.addGdbGuiConsoleEntries(
            `Signal received: (${r.payload["signal-meaning"]}, ${r.payload["signal-name"]}).`,
            "GDBGUI_OUTPUT"
          );
          Handlers.addGdbGuiConsoleEntries(
            "If the program exited due to a fault, you can attempt to re-enter " +
              "the state of the program when the fault occurred by running the " +
              "command 'backtrace' in the gdb terminal.",
            "GDBGUI_OUTPUT"
          );
        }
      }
    }
  } else if (r.message && r.message === "connected") {
    Handlers.onRemoteConnected();
  }
}

export function handleGdbResponseArray(responseArray: Array<GdbMiMessage>) {
  responseArray.forEach((message) => handleGdbMessage(message));
}
