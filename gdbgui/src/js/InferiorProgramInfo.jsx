import React from 'react';

import Actions from './Actions.js';
import {store} from 'statorgfc';

class InferiorProgramInfo extends React.Component {
  constructor() {
    super();
    this.get_choice = this.get_choice.bind(this);
    this.state = {
      selected_inferior_signal: 'SIGINT',
      selected_gdb_signal: 'SIGINT',
    };
    store.connectComponentState(this, ['inferior_pid', 'gdb_pid']);
  }
  get_choice(s, signal_key) {
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
    for (let s in this.props.signals) {
      if (s === 'SIGKILL' || s === 'SIGINT') {
        signals.push(this.get_choice(s, signal_key));
      }
    }
    for (let s in this.props.signals) {
      if (s !== 'SIGKILL' && s !== 'SIGINT') {
        signals.push(this.get_choice(s, signal_key));
      }
    }
    return signals;
  }
  render() {
    return (
      <div>
        <span>gdb pid: {this.state.gdb_pid}</span>
        <br />
        <div className="dropdown btn-group">
          <button
            className="btn btn-default btn-xs dropdown-toggle"
            type="button"
            data-toggle="dropdown">
            {this.state.selected_gdb_signal}
            <span className="caret" style={{marginLeft: '5px'}}>
              {' '}
            </span>
          </button>
          <ul className="dropdown-menu" style={{maxHeight: '300px', overflow: 'auto'}}>
            {this.get_signal_choices('selected_gdb_signal')}
          </ul>

          <button
            className="btn btn-default btn-xs"
            id="step_instruction_button"
            style={{marginLeft: '5px'}}
            type="button"
            title={`Send signal to pid ${this.state.gdb_pid}`}
            onClick={() =>
              Actions.send_signal(this.state.selected_gdb_signal, this.state.gdb_pid)
            }>
            send to gdb
          </button>
        </div>

        <p />

        <span>
          inferior program pid:{' '}
          {this.state.inferior_pid ? this.state.inferior_pid : 'n/a'}
        </span>
        <br />
        <div className="dropdown btn-group">
          <button
            className="btn btn-default btn-xs dropdown-toggle"
            type="button"
            data-toggle="dropdown">
            {this.state.selected_inferior_signal}
            <span className="caret" style={{marginLeft: '5px'}}>
              {' '}
            </span>
          </button>
          <ul className="dropdown-menu" style={{maxHeight: '300px', overflow: 'auto'}}>
            {this.get_signal_choices('selected_inferior_signal')}
          </ul>

          <button
            className="btn btn-default btn-xs"
            id="step_instruction_button"
            style={{marginLeft: '5px'}}
            type="button"
            title={`Send signal to pid ${
              this.state.inferior_pid
            }. Note: signal is sent to machine running the gdbgui, so if running gdbserver remotely this will not work.`}
            onClick={() =>
              Actions.send_signal(
                this.state.selected_inferior_signal,
                this.state.inferior_pid
              )
            }>
            send to inferior
          </button>
        </div>
      </div>
    );
  }
}

export default InferiorProgramInfo;
