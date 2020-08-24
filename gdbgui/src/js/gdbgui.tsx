/**
 * This is the entrypoint to the frontend applicaiton.
 *
 * store (global state) is managed in a single location, and each time the store
 * changes, components are notified and update accordingly.
 *
 */

/* global Split */
/* global initial_data */
/* global debug */

import ReactDOM from "react-dom";
import React from "react";
// @ts-expect-error ts-migrate(2305) FIXME: Module '"statorgfc"' has no exported member 'middl... Remove this comment to see the full error message
import { store, middleware } from "statorgfc";

import constants from "./constants";
import GdbApi from "./GdbApi";
import FileOps from "./FileOps";
import FoldersView from "./FoldersView";
import GlobalEvents from "./GlobalEvents";
import HoverVar from "./HoverVar";
import initial_store_data from "./InitialStoreData";
import MiddleLeft from "./MiddleLeft";
import Modal from "./GdbguiModal";
import RightSidebar from "./RightSidebar";
import Settings from "./Settings";
import ToolTip from "./ToolTip";
import TopBar from "./TopBar";
import ToolTipTourguide from "./ToolTipTourguide";

import "../../static/css/gdbgui.css";
import "../../static/css/splitjs-gdbgui.css";
import { Terminals } from "./Terminals";

const store_options = {
  immutable: false,
  debounce_ms: 10
};
// @ts-expect-error ts-migrate(2339) FIXME: Property 'initialize' does not exist on type '{ ge... Remove this comment to see the full error message
store.initialize(initial_store_data, store_options);
// @ts-expect-error ts-migrate(2304) FIXME: Cannot find name 'debug'.
if (debug) {
  // log call store changes in console except if changed key was in
  // constants.keys_to_not_log_changes_in_console
  // @ts-expect-error ts-migrate(2339) FIXME: Property 'use' does not exist on type '{ get(key: ... Remove this comment to see the full error message
  store.use(function(key: any, oldval: any, newval: any) {
    if (constants.keys_to_not_log_changes_in_console.indexOf(key) === -1) {
      middleware.logChanges(key, oldval, newval);
    }
    return true;
  });
}
// make this visible in the console
// @ts-expect-error ts-migrate(2339) FIXME: Property 'store' does not exist on type 'Window & ... Remove this comment to see the full error message
window.store = store;

class Gdbgui extends React.PureComponent {
  componentWillMount() {
    GdbApi.init();
    GlobalEvents.init();
    FileOps.init(); // this should be initialized before components that use store key 'source_code_state'
  }
  render() {
    return (
      <div className="splitjs_container">
        {/* @ts-expect-error ts-migrate(2322) FIXME: Property 'initial_user_input' does not exist on ty... Remove this comment to see the full error message */}
        <TopBar initial_user_input={initial_data.initial_binary_and_args} />

        <div id="middle" style={{ paddingTop: "60px" }}>
          <div id="folders_view" className="content" style={{ backgroundColor: "#333" }}>
            <FoldersView />
          </div>

          <div id="source_code_view" className="content">
            <MiddleLeft />
          </div>

          <div id="controls_sidebar" className="content" style={{ overflowX: "visible" }}>
            {/* @ts-expect-error ts-migrate(2769) FIXME: Property 'signals' does not exist on type 'Intrins... Remove this comment to see the full error message */}
            <RightSidebar signals={initial_data.signals} debug={debug} />
          </div>
        </div>

        <div
          id="bottom"
          className="split split-horizontal"
          style={{ width: "100%", height: "100%" }}
        >
          <ToolTipTourguide
            // @ts-expect-error ts-migrate(2322) FIXME: Property 'step_num' does not exist on type 'Intrin... Remove this comment to see the full error message
            step_num={4}
            position={"topleft"}
            content={
              <div>
                <h5>You can view gdb's output here.</h5>
                You usually don't need to enter commands here, but you have the option to
                if there is something you can't do in the UI.
              </div>
            }
          />

          <div id="bottom_content" className="split content">
            <Terminals />
          </div>
        </div>

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
  componentDidMount() {
    // @ts-expect-error ts-migrate(2304) FIXME: Cannot find name 'debug'.
    if (debug) {
      // @ts-expect-error ts-migrate(2339) FIXME: Property 'getUnwatchedKeys' does not exist on type... Remove this comment to see the full error message
      console.warn(store.getUnwatchedKeys());
    }
    // Split the body into different panes using splitjs (https://github.com/nathancahill/Split.js)
    // @ts-expect-error ts-migrate(2304) FIXME: Cannot find name 'Split'.
    let middle_panes_split_obj = Split(
      ["#folders_view", "#source_code_view", "#controls_sidebar"],
      {
        gutterSize: 8,
        minSize: 100,
        cursor: "col-resize",
        direction: "horizontal", // horizontal makes a left/right pane, and a divider running vertically
        sizes: store.get("show_filesystem") ? [30, 40, 29] : [0, 70, 29] // adding to exactly 100% is a little buggy due to splitjs, so keep it to 99
      }
    );

    // @ts-expect-error ts-migrate(2304) FIXME: Cannot find name 'Split'.
    Split(["#middle", "#bottom"], {
      gutterSize: 8,
      cursor: "row-resize",
      direction: "vertical", // vertical makes a top and bottom pane, and a divider running horizontally
      sizes: [70, 30]
    });

    store.set("middle_panes_split_obj", middle_panes_split_obj);

    // Fetch the latest version only if using in normal mode. If debugging, we tend to
    // refresh quite a bit, which might make too many requests to github and cause them
    // to block our ip? Either way it just seems weird to make so many ajax requests.
    if (!store.get("debug")) {
      // fetch version
      $.ajax({
        url: "https://raw.githubusercontent.com/cs01/gdbgui/master/gdbgui/VERSION.txt",
        cache: false,
        method: "GET",
        success: data => {
          // @ts-expect-error ts-migrate(2304) FIXME: Cannot find name '_'.
          store.set("latest_gdbgui_version", _.trim(data));
        },
        error: data => {
          void data;
          store.set("latest_gdbgui_version", "(could not contact server)");
        }
      });
    }
  }
}

ReactDOM.render(<Gdbgui />, document.getElementById("gdbgui"));
