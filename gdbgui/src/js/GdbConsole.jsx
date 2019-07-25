// component to display output from gdb, as well as gdbgui diagnostic messages
//
import React from "react";

import GdbApi from "./GdbApi.jsx";
import constants from "./constants.js";

const pre_escape = string => {
  return string
    .replace(/\\n/g, "\n")
    .replace(/\\"/g, '"')
    .replace(/\\t/g, "  ");
};

class GdbConsole extends React.Component {
  componentDidUpdate() {
    this.scroll_to_bottom();
  }
  scroll_to_bottom() {
    this.console_end.scrollIntoView({
      block: "end",
      inline: "nearest",
      behavior: "smooth"
    });
  }
  backtrace_button_clicked = event => {
    event.preventDefault();
    GdbApi.backtrace();
  };

  render_entries(console_entries) {
    return console_entries.map((entry, index) => {
      switch (entry.type) {
        case constants.console_entry_type.STD_OUT: {
          let escaped_value = pre_escape(entry.value);
          return (
            <p key={index} className="otpt">
              {escaped_value}
            </p>
          );
        }
        case constants.console_entry_type.STD_ERR: {
          let escaped_value = pre_escape(entry.value);
          return (
            <p key={index} className="otpt stderr">
              {escaped_value}
            </p>
          );
        }
        case constants.console_entry_type.GDBGUI_OUTPUT: {
          let escaped_value = pre_escape(entry.value);
          return (
            <p key={index} className="gdbguiConsoleOutput" title="gdbgui output">
              {escaped_value}
            </p>
          );
        }
        case constants.console_entry_type.GDBGUI_OUTPUT_RAW: {
          return (
            <p key={index} className="gdbguiConsoleOutput" title="gdbgui output">
              {entry.value}
            </p>
          );
        }
        case constants.console_entry_type.SENT_COMMAND: {
          let escaped_value = pre_escape(entry.value);
          return (
            <p
              key={index}
              className="otpt sent_command pointer"
              onClick={() => this.props.on_sent_command_clicked(entry.value)}
            >
              {escaped_value}
            </p>
          );
        }
        case constants.console_entry_type.AUTOCOMPLETE_OPTION: {
          let escaped_value = pre_escape(entry.value);
          return (
            <p
              key={index}
              className="otpt autocmplt pointer"
              onClick={() => this.props.on_autocomplete_text_clicked(entry.value)}
            >
              <span>{escaped_value}</span>
              <span> </span>
              <span
                className="label label-primary"
                onClick={() => GdbApi.run_gdb_command(`help ${entry.value}`)}
              >
                help
              </span>
            </p>
          );
        }
        case constants.console_entry_type.BACKTRACE_LINK: {
          let escaped_value = pre_escape(entry.value);
          return (
            <div key={index}>
              <a
                onClick={this.backtrace_button_clicked}
                style={{ fontFamily: "arial", marginLeft: "10px" }}
                className="btn btn-success backtrace btn-xs"
              >
                {escaped_value}
              </a>
            </div>
          );
        }
      }
    });
  }
  render() {
    const { console_entries } = this.props;

    return (
      <div id="console" ref={el => (this.console = el)}>
        {this.render_entries(console_entries)}
        <div
          ref={el => {
            this.console_end = el;
          }}
        />
      </div>
    );
  }
}

export default GdbConsole;
