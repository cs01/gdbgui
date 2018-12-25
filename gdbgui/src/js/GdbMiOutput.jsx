/**
 * A component to display, in gory detail, what is
 * returned from gdb's machine interface. This displays the
 * data source that is fed to all components and UI elements
 * in gdb gui, and is useful when debugging gdbgui, or
 * a command that failed but didn't have a useful failure
 * message in gdbgui.
 */
import React from "react";
import {store} from "statorgfc";

class GdbMiOutput extends React.Component {
  static MAX_OUTPUT_ENTRIES = 500;

  constructor() {
    super();
    store.connectComponentState(this, ["gdb_mi_output"]);
    // this._debounced_scroll_to_bottom = _.debounce(  // note this is annoying
    //   this._scroll_to_bottom.bind(this),
    //   300,
    //   {
    //     leading: true
    //   }
    // );
  }

  render() {
    return (
      <React.Fragment>
        <ul className="nav my-1 px-1">
          <li className="nav-item">
            <div className='input-group input-group-sm'>
              <button
                title="clear all mi output"
                className="btn btn-outline-primary btn-sm"
                onClick={() => store.set("gdb_mi_output", [])}>
                <span className="fa fa-ban"/>
              </button>
            </div>
          </li>
        </ul>
        <div className="card card-body m-2">
          <GeminiScrollbar id="gdb_mi_output"
               className='small'>
            {this.state.gdb_mi_output}
          </GeminiScrollbar>
        </div>
      </React.Fragment>
    );
  }

  componentDidMount() {
    this.el = document.getElementById("gdb_mi_output");
  }

  componentDidUpdate() {
    // this._debounced_scroll_to_bottom(); // note this is annoying
  }

  _scroll_to_bottom() {
    // this.el.scrollTop = this.el.scrollHeight;
  }

  static add_mi_output(mi_obj) {
    let new_str = JSON.stringify(mi_obj, null, 4)
        .replace(/[^(\\)]\\n/g)
        .replace("<", "&lt;")
        .replace(">", "&gt;"),
      gdb_mi_output = store.get("gdb_mi_output");

    while (gdb_mi_output.length > GdbMiOutput.MAX_OUTPUT_ENTRIES) {
      gdb_mi_output.shift();
    }
    gdb_mi_output.push(new_str);

    store.set("gdb_mi_output", gdb_mi_output);
  }
}

export default GdbMiOutput;
