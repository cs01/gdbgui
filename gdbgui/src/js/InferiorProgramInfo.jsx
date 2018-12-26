import React from "react";

import Actions from "./Actions.js";
import {store} from "statorgfc";

class InferiorProgramInfo extends React.Component {
  constructor() {
    super();
    this.get_signal_item = this.get_signal_item.bind(this);
    this.state = {
      selected_signal: "SIGINT",
      other_pid: ""
    };
    store.connectComponentState(this, ["inferior_pid", "gdb_pid"]);
  }

  get_signal_item(s, signal_key) {
    let onclick = function (xignal) {
      let obj = {};
      obj[signal_key] = xignal;
      this.setState(obj);
    }.bind(this);

    return (
      <a className="dropdown-item"
         key={s}
         onClick={() => onclick(s)}>{`${s} (${this.props.signals[s]})`}</a>
    );
  }

  get_signal_choices(signal_key) {
    let signals = [];
    // push SIGINT and SIGKILL to top
    for (let s in this.props.signals) {
      if (s === "SIGKILL" || s === "SIGINT") {
        signals.push(this.get_signal_item(s, signal_key));
      }
    }
    for (let s in this.props.signals) {
      if (s !== "SIGKILL" && s !== "SIGINT") {
        signals.push(this.get_signal_item(s, signal_key));
      }
    }
    return signals;
  }

  render() {
    return (
      <div className="input-group input-group-sm">
        <div className="input-group-prepend">

          <div className="input-group-text">
            Send
          </div>
          <button className="btn btn-outline-secondary dropdown-toggle"
                  data-toggle="dropdown">
            {this.state.selected_signal}
          </button>
          <div className="dropdown-menu dropdown-menu-sm">
            {this.get_signal_choices("selected_signal")}
          </div>

          <div className="input-group-text">
            to
          </div>
          <button
            className="btn btn-primary"
            title={`Send ${this.state.selected_signal} to ${this.state.gdb_pid}`}
            onClick={() =>
              Actions.send_signal(this.state.selected_signal, this.state.gdb_pid)
            }>
            gdb
          </button>

          {this.state.inferior_pid ?
            <button className="btn btn-primary"
                    title={`Send ${this.state.selected_signal} to ${this.state.inferior_pid}`}
                    onClick={() =>
                      Actions.send_signal(this.state.selected_signal, this.state.inferior_pid)
                    }>
              this program
            </button>
            /* otherwise */ : null}
        </div>

        <input
          placeholder="pid"
          className="form-control md-grow"
          onChange={e => {
            this.setState({ other_pid: e.currentTarget.value });
          }}
          value={this.state.other_pid}/>
        <div className="input-group-append">
          <button
            disabled={!this.state.other_pid}
            className="btn btn-primary"
            title={`Send ${this.state.selected_signal} to pid ${this.state.other_pid}`}
            onClick={() => Actions.send_signal(this.state.selected_signal, this.state.other_pid)}>
            pid
          </button>
        </div>
      </div>
    );
  }
}

export default InferiorProgramInfo;
