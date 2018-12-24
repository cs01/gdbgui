import React from "react";
import constants from "./constants.js";
import Actions from "./Actions.js";
import ToolTipTourguide from "./ToolTipTourguide.jsx";
import {step1, step2} from "./TourGuide.jsx";

const TARGET_TYPES = {
  file: "file",
  server: "server",
  process: "process",
  target_download: "target_download"
};

/**
 * The BinaryLoader component allows the user to select their binary
 * and specify inputs
 */
class BinaryLoader extends React.Component {
  constructor(props) {
    super();

    this.state = {
      past_binaries: [],
      user_input: props.initial_user_input.join(" "),
      // if user supplied initial binary, load it immediately
      initial_set_target_app: props.initial_user_input.length,
      target_type: TARGET_TYPES.file
    };
    try {
      this.state.past_binaries = _.uniq(
        JSON.parse(localStorage.getItem("past_binaries"))
      );
      if (!this.state.user_input) {
        this.state.user_input = this.state.past_binaries[0];
      }
    } catch (err) {
      this.state.past_binaries = [];
    }
  }

  render() {
    let button_text, title, placeholder;

    if (this.state.target_type === TARGET_TYPES.file) {
      button_text = "Load binary";
      title =
        "Loads the binary as executed with the arguments. Backslashes are treated as " +
        "escape characters. Windows users can either use two backslashes in paths, or " +
        "forward slashes. (l)"
      placeholder = "/path/to/target/executable -and -flags";
    } else if (this.state.target_type === TARGET_TYPES.server) {
      // https://sourceware.org/gdb/onlinedocs/gdb/GDB_002fMI-Target-Manipulation.html#GDB_002fMI-Target-Manipulation
      // -target-select
      button_text = "Connect to gdbserver";
      title = "Connect GDB to the remote target.";
      placeholder = "examples: 127.0.0.1:9999 | /dev/ttya";
    } else if (this.state.target_type === TARGET_TYPES.process) {
      // -target-attach
      button_text = "Attach process";
      title =
        "Attach to a process pid or a file file outside of GDB, or a thread group gid. If " +
        "attaching to a thread group, the id previously returned by ‘-list-thread-groups " +
        "--available’ must be used. Note: to do this, you usually need to run gdbgui as sudo.";
      placeholder = "pid | gid | file";
    }

    return (
      <div>
        <div className="input-group input-group-sm">
          <div className="input-group-prepend">
            <button
              type="button"
              className="btn btn-primary dropdown-toggle dropdown-toggle-split"
              data-toggle="dropdown">
            </button>
            <div className="dropdown-menu">
              <a className="dropdown-item"
                 onClick={() => this.setState({ target_type: TARGET_TYPES.file })}>
                Load binary
              </a>
              <a className="dropdown-item"
                 onClick={() => this.setState({ target_type: TARGET_TYPES.server })}>
                Connect gdbserver
              </a>
              <a className="dropdown-item"
                 onClick={() => this.setState({ target_type: TARGET_TYPES.process })}>
                Attach process
              </a>
            </div>
            <button
              type="button"
              className="btn btn-primary"
              onClick={this.click_set_target_app.bind(this)}
              title={title}>
              {button_text}
            </button>
          </div>

          <select className="custom-select combobox-select"
                  onKeyUp={this.onkeyup_user_input.bind(this)}
                  onChange={this.onchange_user_inpu.bind(this)}
                  value={this.state.user_input}>
            {
              this.state.past_binaries.map((b, i) =>
                <option key={i} value={b}>{b}</option>)
            }
          </select>
          <input
            type="text"
            className="form-control"
            placeholder={placeholder}
            list="past_binaries"
            onKeyUp={this.onkeyup_user_input.bind(this)}
            onChange={this.onchange_user_inpu.bind(this)}
            value={this.state.user_input}/>

          <div className="input-group-append ">
            <button onClick={this.onclick_clear.bind(this)}
                    className='btn btn-outline-primary'>
              <span className='fa fa-ban'/>
            </button>
          </div>
        </div>

        <ToolTipTourguide
          step_num={1}
          position={"bottomcenter"}
          content={step1}/>
        <ToolTipTourguide
          step_num={2}
          position={"bottomleft"}
          content={step2}/>
      </div>
    );
  }

  componentDidMount() {
    if (this.state.initial_set_target_app) {
      this.setState({ initial_set_target_app: false });
      this.set_target_app();
    }
  }

  onkeyup_user_input(e) {
    if (e.keyCode === constants.ENTER_BUTTON_NUM) {
      this.set_target_app();
    }
  }

  onclick_clear() {
    this.state.past_binaries = [];
    this.setState({ past_binaries: this.state.past_binaries });
    localStorage.setItem("past_binaries", JSON.stringify(this.state.past_binaries));
  }

  onchange_user_inpu(e) {
    if (initial_data.using_windows) {
      // replace backslashes with forward slashes when using windows
      this.setState({ user_input: e.target.value.replace(/\\/g, "/") });
    } else {
      this.setState({ user_input: e.target.value });
    }
  }

  click_set_target_app() {
    this.set_target_app();
  }

  // save to list of binaries used that autopopulates the input dropdown
  _add_user_input_to_history(binary_and_args) {
    _.remove(this.state.past_binaries, i => i === binary_and_args);
    this.state.past_binaries.unshift(binary_and_args); // add to beginning
    this.setState({ past_binaries: this.state.past_binaries });
    localStorage.setItem("past_binaries", JSON.stringify(this.state.past_binaries) || []);

    let num_gdbgui_sessions = parseInt(localStorage.getItem("num_gdbgui_sessions"));
    if (isNaN(num_gdbgui_sessions)) {
      num_gdbgui_sessions = 0;
    }
  }

  set_target_app() {
    let user_input = _.trim(this.state.user_input);

    if (_.trim(user_input) === "") {
      Actions.add_console_entries(
        "input cannot be empty",
        constants.console_entry_type.GDBGUI_OUTPUT
      );
      return;
    }

    this._add_user_input_to_history(user_input);

    if (this.state.target_type === TARGET_TYPES.file) {
      Actions.set_gdb_binary_and_arguments(user_input);
    } else if (this.state.target_type === TARGET_TYPES.server) {
      Actions.connect_to_gdbserver(user_input);
    } else if (this.state.target_type === TARGET_TYPES.process) {
      Actions.attach_to_process(user_input);
    }
  }
}

export default BinaryLoader;
