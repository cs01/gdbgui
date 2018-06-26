import React from "react";

import Actions from "./Actions.js";
import { store } from "statorgfc";

class InferiorProgramInfo extends React.Component {
  constructor() {
    super();
    this.get_li_for_signal = this.get_li_for_signal.bind(this);
    this.get_dropdown = this.get_dropdown.bind(this);
    this.state = {
      selected_signal: "SIGINT",
      other_pid: ""
    };
    store.connectComponentState(this, ["inferior_pid", "gdb_pid"]);
  }
  get_li_for_signal(s, signal_key) {
    let onclick = function() {
      let obj = {};
      obj[signal_key] = s;
      this.setState(obj);
    }.bind(this);

    return (
      <li key={s} className="pointer" value={s} onClick={onclick}>
        <a>{`${s} (${this.props.signals[s]})`}</a>
      </li>
    );
  }
  get_signal_choices(signal_key) {
    let signals = [];
    // push SIGINT and SIGKILL to top
    for (let s in this.props.signals) {
      if (s === "SIGKILL" || s === "SIGINT") {
        signals.push(this.get_li_for_signal(s, signal_key));
      }
    }
    for (let s in this.props.signals) {
      if (s !== "SIGKILL" && s !== "SIGINT") {
        signals.push(this.get_li_for_signal(s, signal_key));
      }
    }
    return signals;
  }
  get_dropdown() {
    return (
      <div className="dropdown btn-group">
        <button
          className="btn btn-default btn-xs dropdown-toggle"
          type="button"
          data-toggle="dropdown"
        >
          {this.state.selected_signal}
          <span className="caret" style={{ marginLeft: "5px" }}>
            {" "}
          </span>
        </button>
        <ul className="dropdown-menu" style={{ maxHeight: "300px", overflow: "auto" }}>
          {this.get_signal_choices("selected_signal")}
        </ul>
      </div>
    );
  }
  render() {
    let gdb_button = (
      <button
        className="btn btn-default btn-xs"
        // id="step_instruction_button"
        // style={{marginLeft: '5px'}}
        type="button"
        title={`Send signal to gdb`}
        onClick={() =>
          Actions.send_signal(this.state.selected_signal, this.state.gdb_pid)
        }
      >
        {`gdb (pid ${this.state.gdb_pid})`}
      </button>
    );

    let inferior_button = null;
    if (this.state.inferior_pid) {
      inferior_button = (
        <button
          className="btn btn-default btn-xs"
          type="button"
          title={`Send signal to program being debugged`}
          onClick={() =>
            Actions.send_signal(this.state.selected_signal, this.state.inferior_pid)
          }
        >
          {`debug program (pid ${this.state.inferior_pid})`}
        </button>
      );
    }

    let other_input_and_button = (
      <button
        disabled={!this.state.other_pid}
        className="btn btn-default btn-xs"
        type="button"
        title={`Send signal to custom PID. Enter PID to enable this button.`}
        onClick={() =>
          Actions.send_signal(this.state.selected_signal, this.state.other_pid)
        }
      >
        {`other pid ${this.state.other_pid}`}
      </button>
    );
    return (
      <div>
        send&nbsp;
        {this.get_dropdown()}
        &nbsp;to&nbsp;
        <div className="btn-group" role="group">
          {gdb_button}
          {inferior_button}
        </div>
        <p>
          {other_input_and_button}
          <input
            placeholder="pid"
            style={{
              display: "inline",
              height: "25px",
              width: "75px",
              border: "1px solid #ccc",
              borderRadius: "4px"
            }}
            onChange={e => {
              this.setState({ other_pid: e.currentTarget.value });
            }}
            value={this.state.other_pid}
          />
        </p>
      </div>
    ); // return
  } // render
} // component

export default InferiorProgramInfo;
