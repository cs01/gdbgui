import _ from "lodash";
import constants from "./constants";
import { initial_data, debug } from "./InitialData";
import { GlobalState } from "./types";

/**
 * The initial store data. Keys cannot be added after initialization.
 * All fields in here should be shared by > 1 component, otherwise they should
 * exist as local state for that component.
 */
const initialGlobalState: GlobalState = {
  // environment
  debug, // if gdbgui is run in debug mode
  gdbgui_version: initial_data.gdbgui_version,
  latest_gdbgui_version: "(not fetched)",
  gdb_pid: null,
  gdb_command: initial_data.gdb_command,
  can_fetch_register_values: true, // set to false if using Rust and gdb v7.12.x (see https://github.com/cs01/gdbgui/issues/64)
  show_settings: false,

  gdbWebsocket: null,

  debug_in_reverse: false,
  reverse_supported: false,
  show_modal: false,
  modal_header: null,
  modal_body: null,

  tooltip: { hidden: false, content: "placeholder", node: null, show_for_n_sec: null },
  textarea_to_copy_to_clipboard: {}, // will be replaced with textarea dom node

  // preferences
  max_lines_of_code_to_fetch: constants.default_max_lines_of_code_to_fetch,
  auto_add_breakpoint_to_main: true,

  pretty_print: true, // whether gdb should "pretty print" variables. There is an option for this in Settings
  refresh_state_after_sending_console_command: true, // If true, send commands to refresh GUI store after each command is sent from console
  show_all_sent_commands_in_console: debug, // show all sent commands if in debug mode

  gdbguiState: "ready",
  inferior_pid: null,

  paused_on_frame: null,
  selected_frame_num: 0,
  stack: null,
  locals: [],
  threads: null,

  // source files
  source_file_paths: [], // all the paths gdb says were used to compile the target binary
  language: "c_family", // assume langage of program is c or c++. Language is determined by source file paths. Used to turn on/off certain features/warnings.
  files_being_fetched: [],
  fullname_to_render: null,
  line_of_source_to_flash: null,
  current_assembly_address: null,
  // rendered_source: {},
  make_current_line_visible: false, // set to true when source code window should jump to current line
  cached_source_files: [], // list with keys fullname, source_code
  disassembly_for_missing_file: [], // mi response object. Only fetched when there currently paused frame refers to a file that doesn't exist or is undefined
  missing_files: [], // files that were attempted to be fetched but did not exist on the local filesystem
  source_code_state: constants.source_code_states.NONE_AVAILABLE,
  source_code_selection_state: constants.source_code_selection_states.PAUSED_FRAME,

  // binary selection
  inferior_binary_path: null,
  inferior_binary_path_last_modified_unix_sec: null,

  // registers
  register_names: [],
  previous_register_values: {},
  current_register_values: {},

  // memory
  memory_cache: [],
  start_addr: "",
  end_addr: "",
  bytes_per_line: "8",

  // breakpoints
  breakpoints: [],

  // expressions
  expressions: [], // array of dicts. Key is expression, value has various keys. See Expressions component.
  root_gdb_tree_var: null, // draw tree for this variable

  waiting_for_response: false,

  gdb_mi_output: [],

  // if we try to write something before the websocket is connected, store it here
  queuedGdbCommands: [],

  show_filesystem: false,

  gdbguiPty: null,
  revealLine: (lineNumber: number) => {},
  stoppedDetails: null,
  features: null,
};

function get_stored(key: any, default_val: any) {
  try {
    if (localStorage.hasOwnProperty(key)) {
      // @ts-expect-error ts-migrate(2345) FIXME: Type 'null' is not assignable to type 'string'.
      const cached = JSON.parse(localStorage.getItem(key));
      if (typeof cached === typeof default_val) {
        return cached;
      }
      return default_val;
    }
  } catch (err) {
    console.error(err);
  }
  localStorage.removeItem(key);
  return default_val;
}

// restore saved localStorage data
for (const key in initialGlobalState) {
  // @ts-expect-error ts-migrate(7053) FIXME: No index signature with a parameter of type 'strin... Remove this comment to see the full error message
  const default_val = initialGlobalState[key];
  // @ts-expect-error ts-migrate(7053) FIXME: No index signature with a parameter of type 'strin... Remove this comment to see the full error message
  initialGlobalState[key] = get_stored(key, default_val);
}

if (localStorage.hasOwnProperty("max_lines_of_code_to_fetch")) {
  // @ts-expect-error ts-migrate(2345) FIXME: Type 'null' is not assignable to type 'string'.
  const savedval = JSON.parse(localStorage.getItem("max_lines_of_code_to_fetch"));
  if (_.isInteger(savedval) && savedval > 0) {
    initialGlobalState["max_lines_of_code_to_fetch"] = savedval;
  }
}

export default initialGlobalState;