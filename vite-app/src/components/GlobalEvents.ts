/**
 * Setup global DOM events
 */

import constants from "./constants";
import GdbApi from "./GdbApi";
import { store } from "./Store";

const GlobalEvents = {
  init: function () {
    window.onkeydown = function (e: any) {
      if (e.keyCode === constants.ENTER_BUTTON_NUM) {
        // when pressing enter in an input, don't redirect entire page!
        e.preventDefault();
      }
    };
    document.body.addEventListener("keydown", GlobalEvents.bodyKeydown);

    window.onbeforeunload = () =>
      "text here makes dialog appear when exiting. Set function to back to null for nomal behavior.";
  },
  /**
   * keyboard shortcuts to interact with gdb.
   * enabled only when key is depressed on a target that is NOT an input.
   */
  bodyKeydown: function (e: any) {
    const modifier = e.altKey || e.ctrlKey || e.metaKey;

    if (e.target.nodeName !== "INPUT" && !modifier) {
      const char = String.fromCharCode(e.keyCode).toLowerCase();
      if (e.keyCode === constants.DOWN_BUTTON_NUM || char === "s") {
        GdbApi.requestStep();
      } else if (e.keyCode === constants.RIGHT_BUTTON_NUM) {
        GdbApi.requestNext();
      } else if (char === "n") {
        GdbApi.requestNext(e.shiftKey);
      } else if (char === "c") {
        GdbApi.requestContinue(e.shiftKey);
      } else if (e.keyCode === constants.UP_BUTTON_NUM || char === "u") {
        GdbApi.click_return_button();
      } else if (char === "r") {
        GdbApi.clickRunButton();
      } else if (char === "m") {
        GdbApi.requestSendNextInstruction(e.shiftKey);
      } else if (e.keyCode === constants.COMMA_BUTTON_NUM) {
        GdbApi.requestSendStepInstruction(e.shiftKey);
      } else if (
        e.keyCode === constants.LEFT_BUTTON_NUM &&
        store.data.reverse_supported
      ) {
        GdbApi.requestNext(true);
      }
    }
  },
};

export default GlobalEvents;