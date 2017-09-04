 'use strict';

let constants = {
    'ENTER_BUTTON_NUM': 13,
    'LEFT_BUTTON_NUM': 37,
    'UP_BUTTON_NUM': 38,
    'RIGHT_BUTTON_NUM': 39,
    'DOWN_BUTTON_NUM': 40,
    'COMMA_BUTTON_NUM': 188,
    'DATE_FORMAT': 'dddd, MMMM Do YYYY, h:mm:ss a',
    'ANIMATED_REFRESH_ICON': "<span class='glyphicon glyphicon-refresh glyphicon-refresh-animate'></span>",
    'DISASSEMBLY_FOR_MISSING_FILE_STR': '2',
}
constants['DISASSEMBLY_FOR_MISSING_FILE_INT'] = parseInt(constants.DISASSEMBLY_FOR_MISSING_FILE_STR)

export default Object.freeze(constants)
