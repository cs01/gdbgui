import React from "react";

import Actions from "./Actions.js";
import {store} from "statorgfc";

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
    let onclick = function () {
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
    return (<span className="input-group-btn">
          <button
            className="btn btn-default dropdown-toggle"
            type="button"
            data-toggle="dropdown">
            {this.state.selected_signal}
            <span className="caret">
                &nbsp;
            </span>
          </button>
          <ul className="dropdown-menu">
            {this.get_signal_choices("selected_signal")}
          </ul>
      </span>);
  }

  render() {
    let gdb_button = (
      <button
        className="btn btn-default"
        // id="step_instruction_button"
        // style={{marginLeft: '5px'}}
        type="button"
        title={`send ${this.state.selected_signal} to ${this.state.gdb_pid}`}
        onClick={() =>
          Actions.send_signal(this.state.selected_signal, this.state.gdb_pid)
        }>
        gdb
      </button>
    );

    let inferior_button = null;
    if (this.state.inferior_pid) {
      inferior_button = (
        <button
          className="btn btn-default"
          type="button"
          title={`send ${this.state.selected_signal} to ${this.state.inferior_pid}`}
          onClick={() =>
            Actions.send_signal(this.state.selected_signal, this.state.inferior_pid)
          }>
          this
        </button>
      );
    }

    let pid_button = (
      <button
        disabled={!this.state.other_pid}
        className="btn btn-default btn-xs"
        type="button"
        title={`send ${this.state.selected_signal} to ${this.state.other_pid}`}
        onClick={() => Actions.send_signal(this.state.selected_signal, this.state.other_pid)}>
        pid
      </button>
    );

    return (<div>
        <div className="input-group input-group-sm">
          <span className="input-group-addon">send</span>
          {this.get_dropdown()}
          <span className="input-group-addon">to</span>
          <span className="input-group-btn">
            {gdb_button}
            {inferior_button}
          </span>
          <input
            placeholder="pid"
            className="form-control"
            onChange={e => {
              this.setState({ other_pid: e.currentTarget.value });
            }}
            value={this.state.other_pid}/>
          <span className="input-group-btn">
            {pid_button}
          </span>
        </div>
      </div>
    );
  }
}

export default InferiorProgramInfo;
