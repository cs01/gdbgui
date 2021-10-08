import { Terminal } from "xterm";
import { GdbWebsocket } from "./Websocket";

export type GdbFeature =
  | "thread-info"
  | "reverse"
  | "async"
  | "frozen-varobjs"
  | "pending-breakpoints"
  | "data-read-memory-bytes"
  | "python"
  | "ada-task-info"
  | "language-option"
  | "info-gdb-mi-command"
  | "undefined-command-error-code"
  | "exec-run-start-option"
  | "data-disassemble-a-option"
  | "breakpoint-notification";

export type UserVisibleState = "ready" | "stopped" | "running" | "exited";
export type StoppedDetails = {
  /**
   * The reason for the event.
   * For backward compatibility this string is shown in the UI if the
   * 'description' attribute is missing (but it must not be translated).
   * Values: 'step', 'breakpoint', 'exception', 'pause', 'entry', 'goto',
   * 'function breakpoint', 'data breakpoint', 'instruction breakpoint', etc.
   */
  reason:
    | "step"
    | "breakpoint"
    | "exception"
    | "pause"
    | "entry"
    | "goto"
    | "function breakpoint"
    | "data breakpoint"
    | "instruction breakpoint"
    | string;

  /**
   * The full reason for the event, e.g. 'Paused on exception'. This string is
   * shown in the UI as is and must be translated.
   */
  description?: string;

  /**
   * The thread which was stopped.
   */
  threadId?: number;

  /**
   * A value of true hints to the frontend that this event should not change
   * the focus.
   */
  preserveFocusHint?: boolean;

  /**
   * Additional information. E.g. if reason is 'exception', text contains the
   * exception name. This string is shown in the UI.
   */
  text?: string;

  /**
   * If 'allThreadsStopped' is true, a debug adapter can announce that all
   * threads have stopped.
   * - The client should use this information to enable that all threads can
   * be expanded to access their stacktraces.
   * - If the attribute is missing or false, only the thread with the given
   * threadId can be expanded.
   */
  allThreadsStopped?: boolean;

  /**
   * Ids of the breakpoints that triggered the event. In most cases there will
   * be only a single breakpoint but here are some examples for multiple
   * breakpoints:
   * - Different types of breakpoints map to the same location.
   * - Multiple source breakpoints get collapsed to the same instruction by
   * the compiler/runtime.
   * - Multiple function breakpoints with different function names map to the
   * same location.
   */
  hitBreakpointIds?: number[];
};

export type GlobalState = {
  debug: boolean;
  gdbgui_version: string;
  latest_gdbgui_version: string;
  gdb_version: string;
  gdb_version_array: string[];
  gdb_pid: Nullable<number>;
  gdb_command: string;
  can_fetch_register_values: boolean;
  show_settings: boolean;
  gdbWebsocket: Nullable<GdbWebsocket>;
  debug_in_reverse: boolean;
  reverse_supported: boolean;
  show_modal: boolean;
  modal_header: any;
  modal_body: any;
  tooltip: any;
  textarea_to_copy_to_clipboard: any;
  max_lines_of_code_to_fetch: number;
  auto_add_breakpoint_to_main: boolean;
  pretty_print: boolean;

  refresh_state_after_sending_console_command: true; // If true, send commands to refresh GUI store after each command is sent from console
  show_all_sent_commands_in_console: boolean; // show all sent commands if in debug mode

  inferior_pid: Nullable<number>;

  paused_on_frame: Nullable<any>;
  selected_frame_num: number;
  current_thread_id: Nullable<number>;
  stack: Array<any>;
  locals: Array<any>;
  threads: Array<any>;

  // source files
  source_file_paths: any[];
  language: string;
  files_being_fetched: any[];
  fullname_to_render: Nullable<string>;
  line_of_source_to_flash: Nullable<string>;
  current_assembly_address: Nullable<string>;
  make_current_line_visible: boolean;
  cached_source_files: any[]; // list with keys fullname, source_code
  disassembly_for_missing_file: any[]; // mi response object. Only fetched when there currently paused frame refers to a file that doesn't exist or is undefined
  missing_files: string[]; // files that were attempted to be fetched but did not exist on the local filesystem
  source_code_state: string;
  source_code_selection_state: string;

  // binary selection
  inferior_binary_path: Nullable<string>;
  inferior_binary_path_last_modified_unix_sec: Nullable<number>;

  // registers
  register_names: any[];
  previous_register_values: any;
  current_register_values: any;

  // memory
  memory_cache: any;
  start_addr: string;
  end_addr: string;
  bytes_per_line: number;

  // breakpoints
  breakpoints: any[];

  // expressions
  expressions: Array<{ [expression: string]: any }>;
  root_gdb_tree_var: Nullable<any>;

  waiting_for_response: boolean;

  gdb_mi_output: Array<GdbMiMessage>;

  // if we try to write something before the websocket is connected, store it here
  queuedGdbCommands: Array<string>;

  show_filesystem: boolean;

  gdbguiPty: Nullable<Terminal>;
  revealLine: (lineNum: number) => void;

  stoppedDetails: Nullable<StoppedDetails>;
  gdbguiState: UserVisibleState;
  features: Nullable<Array<GdbFeature>>;
};

export type GdbMiMessage = {
  payload: Nullable<{ [key: string]: any } | Array<any>>;
  type: "result" | "console" | "log" | "notify" | "output" | "target" | "done";
  message: Nullable<string>;
  token: Nullable<number>;
  stream: Nullable<"stderr" | "stdout">;
};

export type GdbGuiConsoleEntry =
  | "SENT_COMMAND"
  | "STD_ERR"
  | "STD_OUT"
  | "GDBGUI_OUTPUT"
  | "GDBGUI_OUTPUT_RAW"
  | "AUTOCOMPLETE_OPTION";
