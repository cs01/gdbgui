import { GdbWebsocket } from "./Websocket";

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

  inferior_program: string;
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
};

export type GdbMiMessage = {
  payload: Nullable<{ [key: string]: any } | Array<any>>;
  type: "result" | "console" | "log" | "notify" | "output" | "target" | "done";
  message: Nullable<string>;
  token: Nullable<string>;
  stream: Nullable<"stderr" | "stdout">;
};
