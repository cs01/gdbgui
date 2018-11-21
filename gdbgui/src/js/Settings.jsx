import { store } from "statorgfc";
import Actions from "./Actions.js";
import ToolTip from "./ToolTip.jsx";
import React from "react";

/**
 * Settings modal when clicking the gear icon
 */
class Settings extends React.Component {
  constructor() {
    super();
    store.connectComponentState(this, [
      "debug",
      "current_theme",
      "themes",
      "gdb_version",
      "gdb_pid",
      "show_settings",
      "auto_add_breakpoint_to_main",
      "pretty_print",
      "refresh_state_after_sending_console_command",
      "show_all_sent_commands_in_console",
      "highlight_source_code"
    ]);
    this.get_update_max_lines_of_code_to_fetch = this.get_update_max_lines_of_code_to_fetch.bind(
      this
    );
  }
  static toggle_key(key) {
    store.set(key, !store.get(key));
    localStorage.setItem(key, JSON.stringify(store.get(key)));
  }
  static get_checkbox_row(store_key, text) {
    return (
      <tr>
        <td>
          <div className="checkbox">
            <label>
              <input
                type="checkbox"
                checked={store.get(store_key)}
                onChange={() => Settings.toggle_key(store_key)}
              />
              {text}
            </label>
          </div>
        </td>
      </tr>
    );
  }
  get_update_max_lines_of_code_to_fetch() {
    return (
      <tr>
        <td>
          Maximum number of source file lines to display:
          <input
            style={{ width: "100px", marginLeft: "10px" }}
            defaultValue={store.get("max_lines_of_code_to_fetch")}
            ref={el => (this.max_source_file_lines_input = el)}
          />
          <button
            ref={n => (this.save_button = n)}
            onClick={() => {
              let new_value = parseInt(this.max_source_file_lines_input.value);
              Actions.update_max_lines_of_code_to_fetch(new_value);
              ToolTip.show_tooltip_on_node("saved!", this.save_button, 1);
            }}
          >
            save
          </button>
        </td>
      </tr>
    );
  }
  get_table() {
    return (
      <table className="table table-condensed">
        <tbody>
          {Settings.get_checkbox_row(
            "auto_add_breakpoint_to_main",
            "Add breakpoint to main after loading executable"
          )}
          {this.get_update_max_lines_of_code_to_fetch()}
          {Settings.get_checkbox_row(
            "pretty_print",
            "Pretty print dynamic variables (requires restart)"
          )}
          {Settings.get_checkbox_row(
            "refresh_state_after_sending_console_command",
            "Refresh all components when a command is sent from the console"
          )}
          {Settings.get_checkbox_row(
            "show_all_sent_commands_in_console",
            "Print all sent commands in console, including those sent automatically by gdbgui"
          )}
          {Settings.get_checkbox_row(
            "highlight_source_code",
            "Add syntax highlighting to source files"
          )}

          <tr>
            <td>
              Theme:{" "}
              <select
                value={store.get("current_theme")}
                onChange={function(e) {
                  store.set("current_theme", e.currentTarget.value);
                  localStorage.setItem("theme", e.currentTarget.value);
                }}
              >
                {store.get("themes").map(t => <option key={t}>{t}</option>)}
              </select>
            </td>
          </tr>
        </tbody>
      </table>
    );
  }

  render() {
    return (
      <div
        className={store.get("show_settings") ? "fullscreen_modal" : "hidden"}
        ref={el => (this.settings_node = el)}
        onClick={e => {
          if (e.target === this.settings_node) {
            Settings.toggle_key("show_settings");
          }
        }}
      >
        <div id="gdb_settings_modal">
          <button className="close" onClick={() => Settings.toggle_key("show_settings")}>
            ×
          </button>
          <h4>Settings</h4>
          {this.get_table()}
          <div className="modal-footer" style={{ marginTop: "20px" }}>
            <button
              className="btn btn-success"
              onClick={() => Settings.toggle_key("show_settings")}
              data-dismiss="modal"
            >
              Close
            </button>
          </div>
        </div>
      </div>
    );
  }
}

export default Settings;
