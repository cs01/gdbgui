import React from "react";

import Actions from "./Actions";
import GdbApi from "./GdbApi";
import { store } from "statorgfc";
import constants from "./constants";

class ProcessorsButtons extends React.Component {
  constructor() {
    // @ts-expect-error ts-migrate(2554) FIXME: Expected 1-2 arguments, but got 0.
    super();
    // @ts-expect-error ts-migrate(2339) FIXME: Property 'connectComponentState' does not exist on... Remove this comment to see the full error message
    store.connectComponentState(this, ["processors_states"]);
  }
  render() {
    let btn_class = "btn btn-default btn-sm";

    let button_elements_mpi_processors = [];
    let mpi_processors = null;

    if (store.get("is_mpi") == true) {
      let nproc = store.get("nproc");
      let proc_states = store.get("processors_states");
      for (let i = 0; i < nproc; i++) {
        let proc_i = "rect_proc_" + i;
        let style_button;
        if (proc_states.lenght == 0) {
          style_button = { backgroundColor: "rgb(150,150,150)" };
        } else {
          if (proc_states[i] == constants.inferior_states.paused) {
            style_button = { backgroundColor: "rgb(255,150,150)" };
          } else if (proc_states[i] == constants.inferior_states.running) {
            style_button = { backgroundColor: "rgb(150,255,150)" };
          } else if (proc_states[i] == constants.inferior_states.exited) {
            style_button = { backgroundColor: "rgb(150,150,150)" };
          } else {
            style_button = { backgroundColor: "rgb(150,150,150)" };
          }
        }
        button_elements_mpi_processors.push(
          <button
            className="proc_styled"
            onClick={() => Actions.change_process_on_focus(i)}
            key={proc_i}
            id={proc_i}
            style={style_button}
          >
            {i}
          </button>
        );
      }
      mpi_processors = (
        <div style={{ margin: 5, whiteSpace: "nowrap" }} className="flexrow">
          {button_elements_mpi_processors}
        </div>
      );
    }

    return <React.Fragment>{mpi_processors}</React.Fragment>;
  }
}

export default ProcessorsButtons;
