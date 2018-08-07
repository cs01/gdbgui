// gdb console (input/output)

import React from "react";

import { store } from "statorgfc";
import constants from "./constants.js";
import GdbApi from "./GdbApi.jsx";
import GdbCommandInput from "./GdbCommandInput.jsx";
import GdbConsole from "./GdbConsole.jsx";
import Actions from "./Actions.js";

let initial_sent_cmds = [];
try {
  initial_sent_cmds = JSON.parse(localStorage.getItem("sent_cmds")) || [];
} catch (err) {
  initial_sent_cmds = [];
}

if (!_.isArray(initial_sent_cmds)) {
  initial_sent_cmds = [];
}

// object to store array of sent commands, as well as ability
// to scroll through old commands by maintaining state
const CommandHistory = {
  index: null,
  sent_cmds: initial_sent_cmds,
  is_history_being_used: false,
  COMMAND_HISTORY_LIMIT: 500,

  // up arrow in console triggers this - go to end of array and move toward index 0
  get_previous_command: function() {
    // start at the end if history is not being cycled through
    CH.index = CH.is_history_being_used ? CH.index - 1 : CH.sent_cmds.length - 1;
    CH.is_history_being_used = true;
    if (CH.index < 0) {
      CH.index = 0;
      return null;
    }

    return CH.sent_cmds[CH.index];
  },

  // down arrow in console triggers this - go to beginning of array and move toward last index
  get_next_command: function() {
    // start at the beginning if history is not being cycled through
    CH.index = CH.is_history_being_used ? CH.index + 1 : 0;
    if (CH.index > CH.sent_cmds.length) {
      CH.index = CH.sent_cmds.length;
      return null;
    }

    CH.is_history_being_used = true;
    if (CH.index >= CH.sent_cmds.length) {
      return null;
    }

    return CH.sent_cmds[CH.index];
  },
  add_command: function(command) {
    CH.reset();
    if (CH.sent_cmds.indexOf(command) !== -1) {
      // don't add duplicate commands
      return;
    }
    if (CH.sent_cmds.length > CH.COMMAND_HISTORY_LIMIT) {
      // remove a command so we stay under the limit
      CH.sent_cmds.shift();
    }

    CH.sent_cmds.push(command);
    localStorage.setItem("sent_cmds", JSON.stringify(CH.sent_cmds));
  },

  reset: function() {
    CH.is_history_being_used = false;
    CH.index = 0;
  }
};
const CH = CommandHistory;

// component that combines the gdb console output component and input component
class GdbConsoleContainer extends React.Component {
  constructor() {
    super();

    this.state = {
      current_command_input: ""
    };
    store.connectComponentState(
      this,
      ["gdb_console_entries", "gdb_autocomplete_options"],
      this._store_change_callback.bind(this)
    );
  }
  _store_change_callback = () => {
    const autocomplete_options = store.get("gdb_autocomplete_options");
    if (autocomplete_options.length === 1) {
      this.setState({
        current_command_input: `${autocomplete_options[0]} ` // just use the autocomplete value
      });
      store.set("gdb_autocomplete_options", []);
    } else if (autocomplete_options.length > 1) {
      Actions.add_console_entries(
        autocomplete_options,
        constants.console_entry_type.AUTOCOMPLETE_OPTION
      );
      store.set("gdb_autocomplete_options", []);
    }
  };

  on_current_command_input_change = value => {
    this.setState({
      current_command_input: value
    });
  };

  on_sent_command_clicked = command => {
    CommandHistory.reset();
    this.setState({
      current_command_input: command
    });
  };

  on_autocomplete_text_clicked = command => {
    CommandHistory.reset();
    this.setState({
      current_command_input: command + " "
    });
  };

  get_previous_command_from_history = () => {
    this.setState({
      current_command_input:
        CommandHistory.get_previous_command(this.state.current_command_input) ||
        this.state.current_command_input
    });
  };

  get_next_command_from_history = () => {
    this.setState({
      current_command_input:
        CommandHistory.get_next_command(this.state.current_command_input) ||
        this.state.current_command_input
    });
  };

  run_command = () => {
    const command = this.state.current_command_input;
    CommandHistory.add_command(command);
    Actions.add_console_entries(command, constants.console_entry_type.SENT_COMMAND);
    Actions.execute_console_command(command);

    this.setState({ current_command_input: "" });
  };

  send_autocomplete_command = () => {
    const user_command = this.state.current_command_input;
    GdbApi.send_autocomplete_command(user_command);
  };

  render() {
    const {
      gdb_console_entries,
      current_command_input,
      gdb_autocomplete_options
    } = this.state;

    return (
      <div id="console_container">
        <GdbConsole
          console_entries={gdb_console_entries}
          on_sent_command_clicked={this.on_sent_command_clicked}
          on_autocomplete_text_clicked={this.on_autocomplete_text_clicked}
        />
        <GdbCommandInput
          current_command_input={current_command_input}
          on_current_command_input_change={this.on_current_command_input_change}
          autocomplete_options_count={gdb_autocomplete_options.length}
          get_previous_command_from_history={this.get_previous_command_from_history}
          get_next_command_from_history={this.get_next_command_from_history}
          clear_console={() => Actions.clear_console()}
          run_command={this.run_command}
          send_autocomplete_command={this.send_autocomplete_command}
        />
      </div>
    );
  }
}

export default GdbConsoleContainer;
