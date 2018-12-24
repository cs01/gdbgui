/**
 * This is the entrypoint to the frontend application.
 *
 * store (global state) is managed in a single location, and each time the store
 * changes, components are notified and update accordingly.
 *
 */

/* global initial_data */
/* global debug */

import 'bootstrap';
import 'jquery.flot'
// import Split from 'split.js'

import '../../static/scss/main.scss'

import ReactDOM from "react-dom";
import React from "react";
import { store, middleware } from "statorgfc";

import constants from "./constants.js";
import GdbApi from "./GdbApi.jsx";
import FileOps from "./FileOps.jsx";
import FoldersView from "./FoldersView.jsx";
import GdbConsoleContainer from "./GdbConsoleContainer.jsx";
import GlobalEvents from "./GlobalEvents.js";
import HoverVar from "./HoverVar.jsx";
import initial_store_data from "./InitialStoreData.js";
import MiddleLeft from "./MiddleLeft.jsx";
import Modal from "./GdbguiModal.jsx";
import RightSidebar from "./RightSidebar.jsx";
import Settings from "./Settings.jsx";
import ToolTip from "./ToolTip.jsx";
import TopBar from "./TopBar.jsx";
import ToolTipTourguide from "./ToolTipTourguide.jsx";
import {step4} from "./TourGuide.jsx";

const store_options = {
  immutable: false,
  debounce_ms: 10
};
store.initialize(initial_store_data, store_options);
if (debug) {
  // log call store changes in console except if changed key was in
  // constants.keys_to_not_log_changes_in_console
  store.use(function(key, oldval, newval) {
    if (constants.keys_to_not_log_changes_in_console.indexOf(key) === -1) {
      middleware.logChanges(key, oldval, newval);
    }
    return true;
  });
}
// make this visible in the console
window.store = store;

class Gdbgui extends React.PureComponent {

  componentWillMount() {
    GdbApi.init();
    GlobalEvents.init();
    FileOps.init(); // this should be initialized before components that use store key 'source_code_state'
  }

  componentDidMount() {
    if (debug) {
      console.warn(store.getUnwatchedKeys());
    }

    // // Split the body into different panes using split.js (https://github.com/nathancahill/Split.js)
    // let middle_panes_split_obj = Split(
    //   ["#folders_view", "#source_code_view", "#controls_sidebar"],
    //   {
    //     gutterSize: 4,
    //     minSize: 100,
    //     cursor: "col-resize",
    //     direction: "horizontal", // horizontal makes a left/right pane, and a divider running vertically
    //     sizes: store.get("show_filesystem") ? [30, 40, 29] : [0, 60, 39] // must add to 99
    //   }
    // );
    //
    // Split(["#middle", "#bottom"], {
    //   gutterSize: 4,
    //   cursor: "row-resize",
    //   direction: "vertical", // vertical makes a top and bottom pane, and a divider running horizontally
    //   sizes: [70, 30]
    // });

    // store.set("middle_panes_split_obj", middle_panes_split_obj);
  }

  render() {
    return (
      <div>
        <TopBar initial_user_input={initial_data.initial_binary_and_args} />

        <div id="middle">
          <div id="folders_view" className="content">
            <FoldersView />
          </div>

          <div id="source_code_view" className="content">
            <MiddleLeft />
          </div>

          <div id="controls_sidebar" className="content" style={{ overflowX: "visible" }}>
            <RightSidebar signals={initial_data.signals} debug={debug} />
          </div>
        </div>

        <nav className="fixed-bottom bg-light">
          <ToolTipTourguide
            step_num={4}
            position={"topleft"}
            content={step4}/>
          <GdbConsoleContainer />
        </nav>

        {/* below are elements that are only displayed under certain conditions */}
        <Modal />
        <HoverVar />
        <Settings />
        <ToolTip />
        <textarea
          style={{
            width: "0px",
            height: "0px",
            position: "absolute",
            top: "0",
            left: "-1000px"
          }}
          ref={node => {
            store.set("textarea_to_copy_to_clipboard", node);
          }}
        />
      </div>
    );
  }
}

ReactDOM.render(<Gdbgui />, document.getElementById("gdbgui-application"));
