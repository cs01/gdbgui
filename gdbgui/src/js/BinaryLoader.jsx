import React from "react";
import constants from "./constants.js";
import Actions from "./Actions.js";
import Util from "./Util.js";
import ToolTipTourguide from "./ToolTipTourguide.jsx";

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
      initial_set_target_app: props.initial_user_input.length, // if user supplied initial binary, load it immediately
      target_type: TARGET_TYPES.file
    };
    try {
      this.state.past_binaries = _.uniq(
        JSON.parse(localStorage.getItem("past_binaries"))
      );
      if (!this.state.user_input) {
        let most_recent_binary = this.state.past_binaries[0];
        this.state.user_input = most_recent_binary;
      }
    } catch (err) {
      this.state.past_binaries = [];
    }
  }
  render() {
    let button_text, title, placeholder;

    if (this.state.target_type === TARGET_TYPES.file) {
      button_text = "Load Binary";
      title =
        "Loads the binary and any arguments present in the input to the right. Backslashes are treated as escape characters. Windows users can either use two backslashes in paths, or forward slashes.";
      placeholder = "/path/to/target/executable -and -flags";
    } else if (this.state.target_type === TARGET_TYPES.server) {
      // https://sourceware.org/gdb/onlinedocs/gdb/GDB_002fMI-Target-Manipulation.html#GDB_002fMI-Target-Manipulation
      // -target-select
      button_text = "Connect to gdbserver";
      title = "Connect GDB to the remote target.";
      placeholder = "examples: 127.0.0.1:9999 | /dev/ttya";
    } else if (this.state.target_type === TARGET_TYPES.process) {
      // -target-attach
      button_text = "Attach to Process";
      title =
        "Attach to a process pid or a file file outside of GDB, or a thread group gid. If attaching to a thread group, the id previously returned by ‘-list-thread-groups --available’ must be used. Note: to do this, you usually need to run gdbgui as sudo.";
      placeholder = "pid | gid | file";
    }

    return (
      <form style={{ marginBottom: 1, flex: "2 0 0" }}>
        <div className="input-group input-group-sm">
          <div className="dropdown input-group-btn">
            <button
              className="btn btn-primary dropdown-toggle"
              type="button"
              data-toggle="dropdown"
            >
              <span className="caret" />
            </button>

            <ul className="dropdown-menu">
              <li>
                <a
                  className="pointer"
                  onClick={() => this.setState({ target_type: TARGET_TYPES.file })}
                >
                  Load Binary
                </a>
              </li>
              <li>
                <a
                  className="pointer"
                  onClick={() => this.setState({ target_type: TARGET_TYPES.server })}
                >
                  Connect to gdbserver
                </a>
              </li>
              <li>
                <a
                  className="pointer"
                  onClick={() => this.setState({ target_type: TARGET_TYPES.process })}
                >
                  Attach to Process
                </a>
              </li>
            </ul>

            <button
              type="button"
              title={title}
              onClick={this.click_set_target_app.bind(this)}
              className="btn btn-primary"
            >
              {button_text}
            </button>
          </div>

          <input
            type="text"
            placeholder={placeholder}
            list="past_binaries"
            style={{ fontFamily: "courier" }}
            className="form-control"
            onKeyUp={this.onkeyup_user_input.bind(this)}
            onChange={this.onchange_user_inpu.bind(this)}
            value={this.state.user_input}
          />
        </div>
        <ToolTipTourguide
          step_num={1}
          position={"bottomcenter"}
          content={
            <div>
              <h5>Enter the path to the binary you wish to debug here.</h5>
              <p>This is the first thing you should do.</p>
              <p>
                The path can be absolute, or relative to where gdbgui was launched from.
              </p>
            </div>
          }
        />
        <ToolTipTourguide
          step_num={2}
          position={"bottomleft"}
          content={
            <div>
              <h5>Press this button to load the executable specified in the input.</h5>
              <p>This is the second thing you should do.</p>

              <p>
                Debugging won't start, but you will be able to set breakpoints. If
                present,{" "}
                <a href="https://en.wikipedia.org/wiki/Debug_symbol">debugging symbols</a>{" "}
                in the binary are also loaded.
              </p>
              <p>
                If you don't want to debug a binary, click the dropdown to choose a
                different target type.
              </p>
            </div>
          }
        />
        <datalist id="past_binaries">
          {this.state.past_binaries.map((b, i) => <option key={i}>{b}</option>)}
        </datalist>
      </form>
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
  /**
   * parse tokens with awareness of double quotes
   *
   * @param      {string}  user_input raw input from user
   * @return     {Object}  { the binary (string) and arguments (array) parsed from user input }
   */
  _parse_binary_and_args_from_user_input(user_input) {
    let list_of_params = Util.string_to_array_safe_quotes(user_input),
      binary = "",
      args = [],
      len = list_of_params.length;
    if (len === 1) {
      binary = list_of_params[0];
    } else if (len > 1) {
      binary = list_of_params[0];
      args = list_of_params.slice(1, len);
    }
    return { binary: binary, args: args.join(" ") };
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
      const { binary, args } = this._parse_binary_and_args_from_user_input(user_input);
      Actions.set_gdb_binary_and_arguments(binary, args);
    } else if (this.state.target_type === TARGET_TYPES.server) {
      Actions.connect_to_gdbserver(user_input);
    } else if (this.state.target_type === TARGET_TYPES.process) {
      Actions.attach_to_process(user_input);
    }
  }
}

export default BinaryLoader;
