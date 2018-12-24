import React from "react";

import { store } from "statorgfc";
import constants from "./constants.js";

class GdbCommandInput extends React.Component {
  componentDidUpdate(prevProps) {
    if (prevProps.current_command_input !== this.props.current_command_input) {
      // command input changed, so put focus on the input
      this.command_input_element.focus();
    }
  }

  on_command_input_key_down = event => {
    switch (event.keyCode) {
      case constants.UP_BUTTON_NUM: {
        this.props.get_previous_command_from_history();
        break;
      }
      case constants.DOWN_BUTTON_NUM: {
        this.props.get_next_command_from_history();
        break;
      }
      case constants.TAB_BUTTON_NUM: {
        event.preventDefault();
        this.props.send_autocomplete_command(event.target.value);
        break;
      }
      case constants.ENTER_BUTTON_NUM: {
        this.props.run_command();
        break;
      }
    }
  };

  render() {
    const {
      on_current_command_input_change,
      current_command_input,
      clear_console
    } = this.props;
    const interpreter = store.get("interpreter");
    const message = `enter ${interpreter} command e.g., \`signal SIGINT\``;
    let input_value = current_command_input;

    return (
      <div className="input-group input-group-sm">
        <div className="input-group-prepend">
            <span className="input-group-text" id="inputGroup-sizing-sm">
              {store.get("gdb_pid")} ({interpreter})
            </span>
        </div>
        <input
          ref={el => {
            this.command_input_element = el;
          }}
          onKeyDown={this.on_command_input_key_down}
          onChange={event => on_current_command_input_change(event.target.value)}
          autoComplete="on"
          placeholder={message}
          value={input_value}
          className="form-control dropdown-input"/>
        <div className="input-group-prepend">
          <button
            className='btn btn-danger'
            onClick={clear_console}>
            <span className='fa fa-ban'/>
          </button>
        </div>
      </div>
    );
  }
}

export default GdbCommandInput;
