import {store} from "statorgfc";
import constants from "./constants.js";
import Actions from "./Actions.js";
import Util from "./Util.js";
import FileOps from "./FileOps.jsx";
import React from "react";

/**
 * The autocomplete dropdown of source files is complicated enough
 * to have its own component. It uses the GARBAGE awesom(sic)-plete library,
 * which is really a piece of shit: https://leaverou.github.io/awesomplete/
 */

const help_text = "Enter file path to view, press enter";

class SourceFileAutocomplete extends React.Component {
  constructor() {
    super();
    this.state = {
      source_file_paths: [],
      user_input: ''
    };
    store.subscribeToKeys(["source_file_paths"],
      this.store_change_callback.bind(this));
  }

  store_change_callback() {
    // if (!_.isEqual(this.awesomplete_input._list, store.get("source_file_paths"))) {
    //   this.awesomplete_input.list = store.get("source_file_paths");
    // }
    this.setState({ source_file_paths: store.get("source_file_paths") })
  }


  render() {

    return ([
      <select

        onKeyUp={this.keyup_source_file_input.bind(this)}
        onChange={this.onchange_user_input.bind(this)}
        value={this.state.user_input}

        onClick={this.onclick_dropdown.bind(this)}
        className="custom-select combobox-select">
        {
          this.state.source_file_paths.map((b, i) =>
            <option key={i} value={b}>{b}</option>)
        }
      </select>,
      <input
        onKeyUp={this.keyup_source_file_input.bind(this)}
        onChange={this.onchange_user_input.bind(this)}
        value={this.state.user_input}

        key={'multi-render-1'}
        id="source_file_input"
        autoComplete="off"
        placeholder={help_text}
        title={help_text}
        role="combobox"
        ref={el => (this.html_input = el)}
        className="form-control"/>
    ]);
    /*
      <div
        key={'multi-render-2'}
        className="input-group-append">
        <button
          id="source_file_dropdown_button"
          type="button"
          className="btn btn-outline-secondary dropdown-toggle">
        </button>
      </div>*/
  }

  keyup_source_file_input(e) {
    if (e.keyCode === constants.ENTER_BUTTON_NUM) {
      let user_input = _.trim(e.currentTarget.value);

      if (user_input.length === 0) {
        return;
      }

      let fullname,
        default_line = 0,
        line;
      [fullname, line] = Util.parse_fullname_and_line(user_input, default_line);
      FileOps.user_select_file_to_view(fullname, line);
    } else if (store.get("source_file_paths").length === 0) {
      // source file list has not been fetched yet, so fetch it
      Actions.fetch_source_files();
    }
  }

  onchange_user_input(e) {
    if (initial_data.using_windows) {
      // replace backslashes with forward slashes when using windows
      this.setState({ user_input: e.target.value.replace(/\\/g, "/") });
    } else {
      this.setState({ user_input: e.target.value });
    }
  }

  onclick_dropdown() {
    if (store.get("source_file_paths").length === 0) {
      // we have not asked gdb to get the list of source paths yet, or it just doesn't have any.
      // request that gdb populate this list.
      Actions.fetch_source_files();
    } else {
      // if (this.awesomplete_input.ul.childNodes.length === 0) {
      //   this.awesomplete_input.evaluate();
      // } else if (this.awesomplete_input.ul.hasAttribute("hidden")) {
      //   this.awesomplete_input.open();
      // } else {
      //   this.awesomplete_input.close();
      // }
    }
  }

  componentDidMount() {
    // initialize list of source files
    // eslint-disable-next-line
    // this.awesomplete_input = new Garbage_plete("#source_file_input", {
    //   minChars: 0,
    //   maxItems: 10000,
    //   list: [],
    //   sort: (a, b) => {
    //     return a < b ? -1 : 1;
    //   }
    // });
    //
    // perform action when an item is selected
    // this.html_input.addEventListener("awesomplete-selectcomplete", function (e) {
    //   let fullname = e.currentTarget.value;
    //   FileOps.user_select_file_to_view(fullname, 1);
    // });
    // $('.awesomplete').addClass('input-group input-group-sm').css('width','60%')
  }
}

export default SourceFileAutocomplete;
