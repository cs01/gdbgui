import { Terminal } from "xterm";
import { GdbWebsocket } from "./Websocket";
import React from "react";

export type SourceFile = {
  fullname: string;
  source_code_obj: any;
  assembly: { [key: number]: Nullable<GdbAsmInstruction[]> };
  sourceCode: Array<string>;
  last_modified_unix_sec: number;
  num_lines_in_file: number;
  exists: boolean;
  encoding: string;
};

export type GdbBreakpoint = {
  addr: string; //"0x0000555555555228";
  disp: string; // "keep";
  enabled: "y" | "n"; // "y";
  file: string; //"hello.c";
  fullname: string; //"/home/csmith/git/gdbgui/examples/c/hello.c";
  func: string; // "main";
  line: string; // "51";
  number: string; //"4";
  "original-location": string; // "/home/csmith/git/gdbgui/examples/c/hello.c:51";
  "thread-groups": Array<string>; // ["i1"];
  times: string; // "0";
  type: string; // "breakpoint";
  cond?: string; // i == 0
};

export type GdbGuiBreakpoint = {
  cond?: string;
  addr: string;
  disp: string;
  enabled: "y" | "n";
  file: string;
  fullname: string;
  func: string;
  line: number;
  number: number;
  "original-location": string;
  "thread-groups": Array<string>;
  times: number;
  type: string;
  isChildBreakpoint: boolean;
  isNormalBreakpoint: boolean;
  isParentBreakpoint: boolean;
  parentBreakpointNumber: Nullable<number>;
  fullNameToDisplay: Nullable<string>;
};

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

export type GdbMiMemoryEntry = { begin: string; end: string; contents: string };
export type GdbMiMemoryResponse = Array<GdbMiMemoryEntry>;
export type GdbLocalVariable = { name: string; type: string; value: string };

export type GdbRootExpressionResponse = {
  name: string;
  numchild: string; //"1"
  has_more: string;
  value: string; // "{...}"
  type: string; // "struct {...}"
  "thread-id": string; //"1"
  dynamic?: "1";
  displayhint?: string;
};

export type GdbChildExpression = GdbRootExpressionResponse & {
  exp: string | "<anonymous struct>";
};
// export type GdbguiChildExpression = {
//   name: string;
//   exp: string | "<anonymous struct>";
//   numchild: number; //"1"
//   value: string; // "{...}"
//   type: string; // "struct {...}"
//   "thread-id": string; //"1"
//   parent: string;
//   has_more: number;
//   show_children_in_ui: boolean;
//   in_scope: boolean;
// };

export type GdbMiChildrenVarResponse = {
  has_more: "0" | "1";
  numchild: string; // "2"
  children: Array<GdbChildExpression>;
};

// changelist
// {
//   name: "var3.value",
//   value: "100",
//   in_scope: "true",
//   type_changed: "false",
//   has_more: "0",
// };
// https://sourceware.org/gdb/onlinedocs/gdb/GDB_002fMI-Variable-Objects.html#GDB_002fMI-Variable-Objects
export type GdbMiChangelist = {
  // The name of the varobj.
  name: "string";
  // If values were requested for this update, then this field will be present and will hold the value of the varobj.
  value: "string";
  // The variable object no longer holds a valid value.
  // This can occur when the executable file being
  // debugged has changed, either through recompilation or by using the GDB file command. The front end should normally choose to delete these variable objects.
  in_scope: "true" | "false" | "invalid";
  // if changed, children should be auto-deleted
  type_changed?: "true" | "false";
  new_type?: string;
  has_more: "0" | "1";
  num_new_children?: string;
  displayhint?: string;
  dynamic?: "1" | "0";
  new_children?: GdbChildExpression[];
};

export type GdbguiExpressionType = "local" | "expr" | "hover";
export type GdbguiLocalVariable = GdbLocalVariable & {
  can_be_expanded: boolean;
  expr_type: "simplelocal";
  in_scope: true;
};
export type GdbguiExpressionVar = {
  children: Array<GdbguiExpressionVar>;
  expr_type: "expr" | "hover" | "local";
  exp: string;
  // expression: string;
  in_scope: true | false | "invalid";
  name: string;
  numchild: number;
  parent: Nullable<GdbguiExpressionVar>;
  has_more: number;
  "thread-id": string;
  type: string;

  value: string;
  valueHistory: number[];
};

export type GdbMiRegisterValue = { value: string; number: string };
export type GdbguiRegisterValue = {
  [registerNumber: string]: { gdbValue: string; decimalValue: Nullable<number> };
};

export type GdbAsmInstruction = {
  address: string; // "0x0005551a8"
  ["func-name"]?: string; // "main"
  offset: string;
  inst: string;
};

export type GdbAsmForFile = {
  line?: string; // "33"
  file?: string; // hello.c
  fullname: string; ///home/csmith/hello.c
  line_asm_insn: Array<GdbAsmInstruction>;
};
export type GdbAsmResponse = GdbAsmInstruction[] | GdbAsmForFile[];

// when messaged is "stopped"
export type GdbProgramStopped = {
  bkptno: string; // "1"
  core: string; // "4"
  disp: "keep" | string;
  frame: {
    addr: string;
    func: string;
    arch: string; //"i386:x86-64"
    line: string;
    args: { name: string; value: string }[];
    file?: string;
    fullname?: string;
  };
  reason: "breakpoint-hit" | "signal-received" | string;
  ["stopped-threads"]: "all" | string;
  ["thread-id"]: string;
  ["signame-name"]?: "SIGINT" | "SIGSEV" | string;
};

export type GdbguiSourceCodeState =
  | "NONE_REQUESTED" // none to display
  // source code states
  | "FETCHING_SOURCE" //in the process of fetching source code
  | "SOURCE_CACHED" // display source code for paused frame, or user-selected file
  | "ASM_AND_SOURCE_CACHED" //display inline assembly with source code
  | "FILE_MISSING" // file cannot be fetched
  // assembly states
  | "ASM_CACHED" //no source file available, but we have asm
  | "FETCHING_ASSM" // in the process of fetching asm
  | "ASM_UNAVAILABLE"; // no asm available at current instruction

export type GlobalState = {
  debug: boolean;
  gdbgui_version: string;
  latest_gdbgui_version: string;
  gdb_pid: Nullable<number>;
  gdb_command: string;
  show_settings: boolean;
  gdbWebsocket: Nullable<GdbWebsocket>;
  debug_in_reverse: boolean;
  reverse_supported: boolean;
  modalData: {
    show: boolean;
    header: Nullable<string>;
    modalBody: Nullable<React.ReactNode>;
  };
  tooltip: any;
  textarea_to_copy_to_clipboard: Nullable<HTMLTextAreaElement>;
  max_lines_of_code_to_fetch: number;
  auto_add_breakpoint_to_main: boolean;
  pretty_print: boolean;

  refresh_state_after_sending_console_command: true; // If true, send commands to refresh GUI store after each command is sent from console
  show_all_sent_commands_in_console: boolean; // show all sent commands if in debug mode

  inferior_pid: Nullable<number>;

  paused_on_frame: Nullable<GdbStackFrame>;
  selected_frame_num: number;
  stack: Nullable<Array<GdbStackFrame>>;
  locals: Array<GdbguiLocalVariable>;
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
  source_file_paths: string[];
  language: string;
  files_being_fetched: string[];
  current_assembly_address: Nullable<string>;
  cachedSourceFiles: SourceFile[]; // list with keys fullname, source_code
  disassembly_for_missing_file: GdbAsmInstruction[]; // mi response object. Only fetched when there currently paused frame refers to a file that doesn't exist or is undefined
  missing_files: string[]; // files that were attempted to be fetched but did not exist on the local filesystem

  fullname_to_render: Nullable<string>;
  line_of_source_to_flash: Nullable<string>;
  source_code_state: GdbguiSourceCodeState;
  source_code_selection_state: Nullable<"paused frame" | "user selected file">;
  userSelectedFile: Nullable<{ fullname: string; line: Nullable<string> }>;
  make_current_line_visible: boolean;

  // binary selection
  inferior_binary_path: Nullable<string>;
  inferior_binary_path_last_modified_unix_sec: Nullable<number>;

  // registers
  register_names: string[];
  previous_register_values: { [registerNumber: string]: string };
  current_register_values: GdbguiRegisterValue;

  // memory
  memory_cache: GdbMiMemoryResponse;
  start_addr: string;
  end_addr: string;
  bytes_per_line: string;

  breakpoints: GdbGuiBreakpoint[];

  expressions: Array<GdbguiExpressionVar>;
  root_gdb_tree_var: Nullable<any>;

  waiting_for_response: boolean;

  gdb_mi_output: Array<GdbMiMessage>;

  // if we try to write something before the websocket is connected, store it here
  queuedGdbCommands: Array<string>;

  show_filesystem: boolean;

  gdbguiPty: Nullable<Terminal>;
  revealLine: (lineNum: number) => void;

  stoppedDetails: Nullable<GdbProgramStopped>;
  gdbguiState: UserVisibleState;
  features: Nullable<Array<GdbFeature>>;

  userTargetInput: string;
  wordWrap: boolean;
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