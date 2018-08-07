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
    const message = `enter ${interpreter} command. To interrupt inferior, send SIGINT.`;
    let input_value = current_command_input;

    return (
      <div id="gdb_command_input">
        <table>
          <tbody>
            <tr>
              <td>({interpreter})</td>
              <td>
                <input
                  ref={el => {
                    this.command_input_element = el;
                  }}
                  onKeyDown={this.on_command_input_key_down}
                  onChange={event => on_current_command_input_change(event.target.value)}
                  className="form-control dropdown-input gdb_command_input"
                  type="text"
                  autoComplete="on"
                  placeholder={message}
                  value={input_value}
                />
              </td>
              <td>
                <span
                  onClick={clear_console}
                  className="glyphicon glyphicon-ban-circle clear_console"
                  title="clear console"
                />
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    );
  }
}

export default GdbCommandInput;
