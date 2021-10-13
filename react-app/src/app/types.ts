import { Terminal } from "xterm";
import { GdbWebsocket } from "./Websocket";
import { DebugProtocol } from "vscode-debugprotocol";

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

// example stack
// {
//   "level": "0",
//   "addr": "0x0000555555555228",
//   "func": "main",
//   "file": "threads.c",
//   "fullname": "/home/csmith/git/gdbgui/examples/c/threads.c",
//   "line": "18",
//   "arch": "i386:x86-64"
// }
export type GdbStackFrame = {
  level: string;
  addr: string;
  func: string;
  args: Array<string>;
  file: string;
  fullname: string;
  line: string;
  arch: string;
};

export type GdbMiMemoryResponse = Array<{ begin: string; end: string; contents: string }>;

export type GlobalState = {
  debug: boolean;
  gdbgui_version: string;
  latest_gdbgui_version: string;
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
  stack: Nullable<Array<GdbStackFrame>>;
  locals: Array<any>;
  threads: Nullable<{
    currentThreadId: string;
    threads: Array<{
      id: string;
      "target-id": string;
      name: string;
      frame: GdbStackFrame;
      state: string;
      core: string;
    }>;
  }>;

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
  memory_cache: GdbMiMemoryResponse;
  start_addr: string;
  end_addr: string;
  bytes_per_line: string;

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

  stoppedDetails: Nullable<DebugProtocol.StoppedEvent>;
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
