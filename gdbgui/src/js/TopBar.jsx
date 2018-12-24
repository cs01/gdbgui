import React from "react";

import {store} from "statorgfc";
import BinaryLoader from "./BinaryLoader.jsx";
import ControlButtons from "./ControlButtons.jsx";
import SourceCodeHeading from "./SourceCodeHeading.jsx";
import ToolTipTourguide from "./ToolTipTourguide.jsx";
import FileOps from "./FileOps.jsx";
import GdbApi from "./GdbApi.jsx";
import Actions from "./Actions.js";
import constants from "./constants.js";
import {step0, step3} from "./TourGuide.jsx";

let onkeyup_jump_to_line = e => {
  if (e.keyCode === constants.ENTER_BUTTON_NUM) {
    Actions.set_line_state(e.currentTarget.value);
  }
};

let click_shutdown_button = function () {
  // no need to show confirmation before leaving, because we're about to prompt the user
  window.onbeforeunload = () => null;
  // prompt user
  if (
    window.confirm(
      "This will terminate the gdbgui for all browser tabs running gdbgui (and their gdb processes). Continue?"
    ) === true
  ) {
    // user wants to shutdown, redirect them to the shutdown page
    window.location = "/shutdown";
  } else {
    // re-add confirmation before leaving page (when user actually leaves at a later time)
    window.onbeforeunload = () => "some text";
  }
};

let show_license = function () {
  Actions.show_modal(
    "gdbgui license",
    <React.Fragment>
      <a href="https://github.com/cs01/gdbgui/blob/master/LICENSE">
        GNU General Public License v3.0
      </a>
      <p>Copyright © Chad Smith</p>
      <p>This software can be used personally or commercially for free.</p>
      <p>
        Permissions of this strong copyleft license are conditioned on making available
        complete source code of licensed works and modifications, which include larger
        works using a licensed work, under the same license. Copyright and license notices
        must be preserved. Contributors provide an express grant of patent rights.
      </p>
      <p>
        If you wish to redistribute gdbgui as part of a closed source product, you can do
        so for a fee. Contact grassfedcode@gmail.com for details.
      </p>
    </React.Fragment>
  );
};

let About = {
  show_about: function () {
    Actions.show_modal(
      "About gdbgui",
      <React.Fragment>
        A <a href="http://grassfedcode.com">grassfedcode</a> project to make the easiest
        to use and most accessible gdb frontend.
        <p/>
        Copyright © Chad Smith
      </React.Fragment>
    );
  }
};

let show_session_info = function () {
  Actions.show_modal(
    "session information",
    <React.Fragment>
      <table>
        <tbody>
        <tr>
          <td>gdb version: {store.get("gdb_version")}</td>
        </tr>
        <tr>
          <td>gdb pid for this tab: {store.get("gdb_pid")}</td>
        </tr>
        </tbody>
      </table>
    </React.Fragment>
  );
};

const menu = (
  <div className="dropdown">
    <button
      className="btn btn-sm btn-secondary dropdown-toggle"
      type="button"
      id="dropdownMenuButton"
      data-toggle="dropdown"
      aria-haspopup="true" aria-expanded="false">
      <span className='fa fa-tools'/>
    </button>
    <div className="dropdown-menu">
      <li><a
        className="dropdown-item"
        title="dashboard"
        href="/dashboard">
        Dashboard
      </a></li>
      <li><a
        className="dropdown-item"
        title="show guide"
        onClick={ToolTipTourguide.start_guide}>
        Show Guide
      </a></li>
      <li><a
        className="dropdown-item"
        onClick={show_session_info}>
        Session Information
      </a></li>

      <div className="dropdown-divider"/>
      <li><a
        className="dropdown-item"
        href={constants.gdbgui_donate_url}>
        Donate
      </a></li>
      <li><a
        className="dropdown-item"
        href="https://gitter.im/gdbgui/Lobby">
        Chat room
      </a></li>
      <li><a
        className="dropdown-item"
        href="https://github.com/cs01/gdbgui">
        GitHub
      </a></li>
      <li><a
        className="dropdown-item"
        href="http://gdbgui.com">
        Homepage
      </a></li>
      <li><a
        className="dropdown-item"
        href="https://www.youtube.com/channel/UCUCOSclB97r9nd54NpXMV5A">
        YouTube Channel
      </a></li>

      <div className="dropdown-divider"/>
      <li><a
        className="dropdown-item"
        onClick={show_license}>
        License
      </a></li>
      <li><a
        className="dropdown-item"
        onClick={About.show_about}>
        About gdbgui
      </a></li>
      <li><a
        className="dropdown-item menu-item-has-icon"
        title="shutdown" onClick={click_shutdown_button}>
        <span className='fa fa-skull menu-item-icon'/> Shutdown `gdbgui` server
      </a></li>
    </div>
    <ToolTipTourguide
      top={"100%"}
      left={"-300px"}
      step_num={0}
      content={step0}/>
  </div>
);

class TopBar extends React.Component {
  constructor() {
    super();
    // state local to the component
    this.state = {
      assembly_flavor: "intel", // default to intel (choices are 'att' or 'intel')
      show_spinner: false
    };
    // global state attached to this component
    store.connectComponentState(
      this,
      [
        "debug_in_reverse",
        "source_code_state",
        "waiting_for_response",
        "show_filesystem",
        "latest_gdbgui_version",
        "gdbgui_version"
      ],
      this.store_update_callback.bind(this)
    );

    this.spinner_timeout = null;
    this.spinner_timeout_msec = 5000;
  }

  store_update_callback(keys) {
    if (keys.indexOf("waiting_for_response") !== -1) {
      this._clear_spinner_timeout();
      this.setState({ show_spinner: false });
      if (this.state.waiting_for_response === true) {
        // false to true
        this._set_spinner_timeout();
      }
    }
  }

  _set_spinner_timeout() {
    this.spinner_timeout = setTimeout(() => {
      if (this.state.waiting_for_response) {
        this.setState({ show_spinner: true });
      }
    }, this.spinner_timeout_msec);
  }

  _clear_spinner_timeout() {
    clearTimeout(this.spinner_timeout);
  }

  toggle_assembly_flavor() {
    const flavor = this.state.assembly_flavor === "att" ? "intel" : "att";
    this.setState({ assembly_flavor: flavor });
    GdbApi.set_assembly_flavor(flavor);
    Actions.clear_cached_assembly();
    FileOps.fetch_assembly_cur_line();
  }

  get_controls() {
    return (
      <div>
        <ControlButtons/>
        <ToolTipTourguide
          step_num={3}
          position={"bottomleft"}
          onClick={e => e.stopPropagation()}
          content={step3}/>
      </div>
    );
  }

  toggle_file_explorer() {
    // let middle_pane_sizes = store.get("middle_panes_split_obj").getSizes(),
    //   file_explorer_size = middle_pane_sizes[0],
    //   source_size = middle_pane_sizes[1],
    //   sidebar_size = middle_pane_sizes[2],
    //   new_file_explorer_size,
    //   new_source_size,
    //   new_sidebar_size;

    if (store.get("show_filesystem")) {
      // hide it since it's shown right now
      // new_file_explorer_size = 0;
      // new_source_size = source_size + file_explorer_size / 2;
      // new_sidebar_size = sidebar_size + file_explorer_size / 2;
    } else {
      // new_file_explorer_size = 30;
      // new_source_size = Math.max(
      //   30,
      //   source_size - new_file_explorer_size / 2
      // );
      // new_sidebar_size = 99 - new_file_explorer_size - new_source_size;
    }

    store.set("show_filesystem", !store.get("show_filesystem"));
    localStorage.setItem(
      "show_filesystem",
      JSON.stringify(store.get("show_filesystem"))
    ); // save this for next session
    store
      .get("middle_panes_split_obj")
      // .setSizes([new_file_explorer_size, new_source_size, new_sidebar_size]);
  }

  render() {
    let toggle_assm_button = "";
    if (
      this.state.source_code_state ===
      constants.source_code_states.ASSM_AND_SOURCE_CACHED ||
      this.state.source_code_state === constants.source_code_states.ASSM_CACHED
    ) {
      toggle_assm_button = (
        <button
          onClick={this.toggle_assembly_flavor.bind(this)}
          type="button"
          title={"Toggle between assembly flavors"}
          className='btn btn-primary'>
          <span title={`Currently displaying ${this.state.assembly_flavor}. Click to toggle.`}>
            {this.state.assembly_flavor === "att" ? "AT&T" : "Intel"}
          </span>
        </button>
      );
    }

    let reload_button_disabled = "disabled";
    if (
      this.state.source_code_state ===
      constants.source_code_states.ASSM_AND_SOURCE_CACHED ||
      this.state.source_code_state === constants.source_code_states.SOURCE_CACHED
    ) {
      reload_button_disabled = "";
    }
    let reload_button = (
      <button
        onClick={FileOps.refresh_cached_source_files}
        type="button"
        title="Erase file from local cache and re-fetch it"
        className={"btn btn-primary " + reload_button_disabled}>
        <span>Reload file</span>
      </button>
    );

    let reverse_checkbox = (
      <div className="input-group input-group-sm"
           title={"when checked, always attempt to send --reverse to gdb commands (shift)"}>
        <div className="input-group-prepend">
          <span className="input-group-text">Reverse</span>
        </div>
        <div className="input-group-append">
          <div className="input-group-text">
            <input type="checkbox"
                   checked={store.get("debug_in_reverse")}
                   onChange={e => {
                     store.set("debug_in_reverse", e.target.checked);
                   }}/>
          </div>
        </div>
      </div>
    );

    return (
      <div className="sticky-top navbar-light bg-light py-1">

        <div className="container-fluid m-1">
          <div className="row">
            <div className="col-sm-auto">
              {menu}
            </div>
            <div className="col-sm">
              <BinaryLoader initial_user_input={this.props.initial_user_input}/>
            </div>
            <div className="col-sm-auto">
              {this.state.show_spinner ? <span className="fa fa-sync-alt fa-spin"/> : null}
            </div>
            <div className="col-sm-auto">
              {initial_data.rr ? reverse_checkbox : null}
            </div>
            <div className="col-sm-auto">
              {this.get_controls()}
            </div>
          </div>
        </div>


        <div className="container-fluid m-1">
          <div className="row">
            <div className="col-auto">
              <div className="btn-group btn-group-sm">
                <button
                  className="btn btn-primary"
                  title="Toggle file explorer visibility"
                  onClick={this.toggle_file_explorer}>
                  {store.get("show_filesystem") ? "Hide filesystem" : "Show filesystem"}
                </button>

                <button
                  onClick={() => FileOps.fetch_assembly_cur_line()}
                  type="button"
                  title="fetch disassembly"
                  className="btn btn-primary">
                  <span>Fetch disassembly</span>
                </button>

                {reload_button}
                {toggle_assm_button}
              </div>
            </div>

            <div className="col-auto">
              <div className="input-group input-group-sm">
                <div className="input-group-prepend">
                  <span className="input-group-text">Go to line</span>
                </div>
                <input
                  onKeyUp={onkeyup_jump_to_line}
                  autoComplete="on"
                  title="Enter line number, then press enter"
                  className="form-control goto-line"/>
              </div>
            </div>

            <div className="col-auto">
              <SourceCodeHeading/>
            </div>
          </div>
        </div>
      </div>
    );
  }
}

export default TopBar;
