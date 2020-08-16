let constants = {
  ENTER_BUTTON_NUM: 13,
  TAB_BUTTON_NUM: 9,
  LEFT_BUTTON_NUM: 37,
  UP_BUTTON_NUM: 38,
  RIGHT_BUTTON_NUM: 39,
  DOWN_BUTTON_NUM: 40,
  Y_BUTTON_NUM: 89,
  N_BUTTON_NUM: 78,
  COMMA_BUTTON_NUM: 188,
  DATE_FORMAT: "dddd, MMMM Do YYYY, h:mm:ss a",
  IGNORE_ERRORS_TOKEN_STR: "1",
  DISASSEMBLY_FOR_MISSING_FILE_STR: "2",
  CREATE_VAR_STR: "3",
  INLINE_DISASSEMBLY_STR: "4",

  console_entry_type: {
    SENT_COMMAND: "SENT_COMMAND",
    STD_ERR: "STD_ERR",
    STD_OUT: "STD_OUT",
    GDBGUI_OUTPUT: "GDBGUI_OUTPUT",
    GDBGUI_OUTPUT_RAW: "GDBGUI_OUTPUT_RAW",
    AUTOCOMPLETE_OPTION: "AUTOCOMPLETE_OPTION"
  },

  source_code_selection_states: {
    USER_SELECTION: "USER_SELECTION",
    PAUSED_FRAME: "PAUSED_FRAME"
  },

  source_code_states: {
    ASSM_AND_SOURCE_CACHED: "ASSM_AND_SOURCE_CACHED",
    SOURCE_CACHED: "SOURCE_CACHED",
    FETCHING_SOURCE: "FETCHING_SOURCE",
    ASSM_CACHED: "ASSM_CACHED",
    FETCHING_ASSM: "FETCHING_ASSM",
    ASSM_UNAVAILABLE: "ASSM_UNAVAILABLE",
    FILE_MISSING: "FILE_MISSING",
    NONE_AVAILABLE: "NONE_AVAILABLE"
  },

  inferior_states: {
    unknown: "unknown",
    running: "running",
    paused: "paused",
    exited: "exited"
  },

  tree_component_id: "tree",

  default_max_lines_of_code_to_fetch: 500,

  keys_to_not_log_changes_in_console: ["gdb_mi_output"],
  xtermColors: {
    reset: "\x1B[0m",
    red: "\x1B[31m",
    grey: "\x1b[1;30m",
    green: "\x1B[0;32m",
    lgreen: "\x1B[1;32m",
    blue: "\x1B[0;34m",
    lblue: "\x1B[1;34m",
    yellow: "\x1B[0;33m"
  }
};

const colorTypeMap = {};
colorTypeMap[constants.console_entry_type.STD_OUT] = constants.xtermColors["reset"];
colorTypeMap[constants.console_entry_type.STD_ERR] = constants.xtermColors["red"];
colorTypeMap[constants.console_entry_type.SENT_COMMAND] = constants.xtermColors["lblue"];
colorTypeMap[constants.console_entry_type.GDBGUI_OUTPUT] =
  constants.xtermColors["yellow"];
colorTypeMap[constants.console_entry_type.GDBGUI_OUTPUT_RAW] =
  constants.xtermColors["green"];

constants["colorTypeMap"] = colorTypeMap;

constants["IGNORE_ERRORS_TOKEN_INT"] = parseInt(constants.IGNORE_ERRORS_TOKEN_STR);
constants["DISASSEMBLY_FOR_MISSING_FILE_INT"] = parseInt(
  constants.DISASSEMBLY_FOR_MISSING_FILE_STR
);
constants["CREATE_VAR_INT"] = parseInt(constants.CREATE_VAR_STR);
constants["INLINE_DISASSEMBLY_INT"] = parseInt(constants.INLINE_DISASSEMBLY_STR);

export default Object.freeze(constants);
