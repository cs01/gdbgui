import {store} from "statorgfc";
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
      <div className="custom-control custom-checkbox">
        <input className="custom-control-input" id={`check_for_${store_key}`}
               type="checkbox"
               checked={store.get(store_key)}
               onChange={() => Settings.toggle_key(store_key)}/>
        <label className="custom-control-label" htmlFor={`check_for_${store_key}`}>
          {text}
        </label>
      </div>
    );
  }

  get_update_max_lines_of_code_to_fetch() {
    return (
      <div className="form-inline">
        <label htmlFor="max-lines-input" className='mr-1'>Maximum displayed number of source</label>
        <div className="input-group input-group-sm">
          <div className="input-group-prepend">
            <div className="input-group-text">lines</div>
          </div>
          <input type="text" className="form-control md-grow"
                 id="max-lines-input"
                 placeholder="Username"
                 defaultValue={store.get("max_lines_of_code_to_fetch")}
                 ref={el => (this.max_source_file_lines_input = el)}/>
          <div className="input-group-append">
            <button
              className="btn btn-success"
              ref={n => (this.save_button = n)}
              onClick={() => {
                let new_value = parseInt(this.max_source_file_lines_input.value);
                Actions.update_max_lines_of_code_to_fetch(new_value);
                ToolTip.show_tooltip_on_node("saved!", this.save_button, 1);
              }}>
              save
            </button>
          </div>
        </div>

      </div>);
  }

  render() {
    return (
      <div>

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

        <form className="form-inline">
          <label htmlFor="settings-theme-input"
                 className='mr-1'>Theme</label>
          <div className="input-group input-group-sm">
            <select
              id='settings-theme-input'
              className='form-control'
              value={store.get("current_theme")}
              onChange={function (e) {
                store.set("current_theme", e.currentTarget.value);
                localStorage.setItem("theme", e.currentTarget.value);
              }}>
              {store.get("themes").map(t => <option key={t}>{t}</option>)}
            </select>
          </div>
        </form>
      </div>
    );
  }
}

export default Settings;
