import React from "react";

import Actions from "./Actions.js";
import GdbApi from "./GdbApi.jsx";
import {store} from "statorgfc";

class ControlButtons extends React.Component {
  constructor() {
    super();
    store.connectComponentState(this, ["gdb_pid"]);
  }

  render() {
    let btn_class = "btn btn-default";

    return (
      <div className='btn-group btn-group-sm'>
        <button
          id="run_button"
          onClick={() => GdbApi.click_run_button()}
          type="button"
          title="Restart inferior program (r)"
          className={btn_class}>
          <span className="fa fa-redo-alt"/>
        </button>

        <button
          id="continue_button"
          onClick={() => GdbApi.click_continue_button()}
          type="button"
          title={
            "Continue (c)" +
            (initial_data.rr ? ". shift + c for reverse." : "")
          }
          className={btn_class}>
          <span className="fa fa-fighter-jet"/>
        </button>

        <button
          onClick={() => Actions.send_signal("SIGINT", this.state.gdb_pid)}
          type="button"
          title="Pause gdb"
          className={btn_class}>
          <span className="fa fa-pause"/>
        </button>

        <button
          id="next_button"
          onClick={() => GdbApi.click_next_button()}
          type="button"
          title={
            "Step over next function call (n or right arrow)" +
            (initial_data.rr ? ". shift + n for reverse." : "")
          }
          className={btn_class}>
          <span className="fa fa-step-forward"/>
        </button>

        <button
          id="step_button"
          onClick={() => GdbApi.click_step_button()}
          type="button"
          title={
            "Step into function call (s or down arrow)" +
            (initial_data.rr ? ". shift + s for reverse." : "")
          }
          className={btn_class}>
          <span className="fa fa-sign-in-alt fa-rotate-90"/>
        </button>

        <button
          id="return_button"
          onClick={() => GdbApi.click_return_button()}
          type="button"
          title="Up one function stack frame (u or up arrow)"
          className={btn_class}>
          <span className="fa fa-sign-out-alt fa-rotate-270"/>
        </button>

        <div role="group" className="btn-group btn-group-sm">
          <button
            id="next_instruction_button"
            onClick={() => GdbApi.click_next_instruction_button()}
            type="button"
            title={
              "Next machine instruction over function calls spa(m)" +
              (initial_data.rr ? ". shift + m for reverse." : "")
            }
            className={btn_class}>
            ni
          </button>
          <button
            id="step_instruction_button"
            onClick={() => GdbApi.click_step_instruction_button()}
            type="button"
            title={
              "Step one machine instruction; steps into function calls (,)" +
              (initial_data.rr ? ". shift + , for reverse." : "")
            }
            className={btn_class}>
            <span className='fa fa-shoe-prints'/>
          </button>
        </div>
      </div>
    );
  }
}

export default ControlButtons;
