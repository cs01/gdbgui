const xtermColors = {
  reset: "\x1B[0m",
  red: "\x1B[31m",
  grey: "\x1b[1;30m",
  green: "\x1B[0;32m",
  lgreen: "\x1B[1;32m",
  blue: "\x1B[0;34m",
  lblue: "\x1B[1;34m",
  yellow: "\x1B[0;33m",
};

export const colorTypeMap: { [key: string]: string } = {
  STD_OUT: xtermColors["reset"],
  STD_ERR: xtermColors["red"],
  SENT_COMMAND: xtermColors["lblue"],
  GDBGUI_OUTPUT: xtermColors["yellow"],
  GDBGUI_OUTPUT_RAW: xtermColors["green"],
};

export const constants = {
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
  IGNORE_ERRORS_TOKEN_INT: 1,
  DISASSEMBLY_FOR_MISSING_FILE_STR: "2",
  DISASSEMBLY_FOR_MISSING_FILE_INT: 2,
  CREATE_VAR_STR: "3",
  CREATE_VAR_INT: 3,
  INLINE_DISASSEMBLY_STR: "4",
  INLINE_DISASSEMBLY_INT: 4,

  tree_component_id: "tree",

  default_max_lines_of_code_to_fetch: 500,

  doNotLogChanges: ["gdb_mi_output"],

  xtermColors,
};

export const ptyFontSize = 14;
export default Object.freeze(constants);
