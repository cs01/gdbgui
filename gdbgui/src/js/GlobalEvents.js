/**
 * Setup global DOM events
 */

import constants from "./constants.js";
import GdbApi from "./GdbApi.jsx";

const GlobalEvents = {
  init: function() {
    window.onkeydown = function(e) {
      if (e.keyCode === constants.ENTER_BUTTON_NUM) {
        // when pressing enter in an input, don't redirect entire page!
        e.preventDefault();
      }
    };
    $("body").on("keydown", GlobalEvents.body_keydown);
    $('[data-toggle="tooltip"]').tooltip();

    window.onbeforeunload = () =>
      "text here makes dialog appear when exiting. Set function to back to null for nomal behavior.";
  },
  /**
   * keyboard shortcuts to interact with gdb.
   * enabled only when key is depressed on a target that is NOT an input.
   */
  body_keydown: function(e) {
    let modifier = e.altKey || e.ctrlKey || e.metaKey;

    if (e.target.nodeName !== "INPUT" && !modifier) {
      let char = String.fromCharCode(e.keyCode).toLowerCase();
      if (e.keyCode === constants.DOWN_BUTTON_NUM || char === "s") {
        GdbApi.click_step_button();
      } else if (e.keyCode === constants.RIGHT_BUTTON_NUM) {
        GdbApi.click_next_button();
      } else if (char === "n") {
        GdbApi.click_next_button(e.shiftKey);
      } else if (char === "c") {
        GdbApi.click_continue_button(e.shiftKey);
      } else if (e.keyCode === constants.UP_BUTTON_NUM || char === "u") {
        GdbApi.click_return_button();
      } else if (char === "r") {
        GdbApi.click_run_button();
      } else if (char === "m") {
        GdbApi.click_next_instruction_button(e.shiftKey);
      } else if (e.keyCode === constants.COMMA_BUTTON_NUM) {
        GdbApi.click_step_instruction_button(e.shiftKey);
      } else if (initial_data.rr && e.keyCode === constants.LEFT_BUTTON_NUM) {
        // reverse
        GdbApi.click_next_button(true);
      }
    }
  }
};

export default GlobalEvents;
