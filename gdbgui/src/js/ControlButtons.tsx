import React from "react";

import Actions from "./Actions";
import GdbApi from "./GdbApi";
import { store } from "statorgfc";

type State = any;

class ControlButtons extends React.Component<{}, State> {
  constructor() {
    // @ts-expect-error ts-migrate(2554) FIXME: Expected 1-2 arguments, but got 0.
    super();
    // @ts-expect-error ts-migrate(2339) FIXME: Property 'connectComponentState' does not exist on... Remove this comment to see the full error message
    store.connectComponentState(this, ["gdb_pid", "reverse_supported"]);
  }
  render() {
    let btn_class = "btn btn-default btn-sm";

    return (
      <React.Fragment>
        <button
          id="run_button"
          onClick={() => GdbApi.click_run_button()}
          type="button"
          title="Start inferior program from the beginning keyboard shortcut: r"
          className={btn_class}
        >
          <span className="glyphicon glyphicon-repeat" />
        </button>

        <button
          id="continue_button"
          onClick={() => GdbApi.click_continue_button()}
          type="button"
          title={
            "Continue until breakpoint is hit or inferior program exits keyboard shortcut: c" +
            (this.state.reverse_supported ? ". shift + c for reverse." : "")
          }
          className={btn_class}
        >
          <span className="glyphicon glyphicon-play" />
        </button>

        <button
          onClick={() => Actions.send_signal("SIGINT", this.state.gdb_pid)}
          type="button"
          title="Send Interrupt signal (SIGINT) to gdb process to pause it (if it's running)"
          className={btn_class}
        >
          <span className="glyphicon glyphicon-pause" />
        </button>

        <button
          id="next_button"
          onClick={() => GdbApi.click_next_button()}
          type="button"
          title={
            "Step over next function call keyboard shortcut: n or right arrow" +
            (this.state.reverse_supported ? ". shift + n for reverse." : "")
          }
          className={btn_class}
        >
          <span className="glyphicon glyphicon-step-forward" />
        </button>

        <button
          id="step_button"
          onClick={() => GdbApi.click_step_button()}
          type="button"
          title={
            "Step into next function call keyboard shortcut: s or down arrow" +
            (this.state.reverse_supported ? ". shift + s for reverse." : "")
          }
          className={btn_class}
        >
          <span className="glyphicon glyphicon-arrow-down" />
        </button>

        <button
          id="return_button"
          onClick={() => GdbApi.click_return_button()}
          type="button"
          title="Step out of current function keyboard shortcut: u or up arrow"
          className={btn_class}
        >
          <span className="glyphicon glyphicon-arrow-up" />
        </button>
        <div role="group" className="btn-group btn-group-xs">
          <button
            id="next_instruction_button"
            onClick={() => GdbApi.click_next_instruction_button()}
            type="button"
            title={
              "Next Instruction: Execute one machine instruction, stepping over function calls keyboard shortcut: m" +
              (this.state.reverse_supported ? ". shift + m for reverse." : "")
            }
            className="btn btn-default"
          >
            NI
          </button>
          <button
            id="step_instruction_button"
            onClick={() => GdbApi.click_step_instruction_button()}
            type="button"
            title={
              "Step Instruction: Execute one machine instruction, stepping into function calls keyboard shortcut: ','" +
              (this.state.reverse_supported ? ". shift + , for reverse." : "")
            }
            className="btn btn-default"
          >
            SI
          </button>
        </div>
      </React.Fragment>
    );
  }
}

export default ControlButtons;
