/**
 * This is the entrypoint to the frontend applicaiton.
 *
 * store (global state) is managed in a single location, and each time the store
 * changes, components are notified and update accordingly.
 *
 */

import React, { useEffect, useState } from "react";
import { store } from "./GlobalState";
// import constants from "./constants";
import GdbApi from "./GdbApi";
import FileOps from "./FileOps";
// import FoldersView from "./FoldersView";
import GlobalEvents from "./GlobalEvents";
import HoverVar from "./HoverVar";
// import initialGlobalState from "./InitialGlobalState";
// import MiddleLeft from "./MiddleLeft";
import Modal from "./GdbguiModal";
import RightSidebar from "./RightSidebar";
import Settings from "./Settings";
import ToolTip from "./ToolTip";
// import ToolTipTourguide from "./ToolTipTourguide";
import { debug, InitialData } from "./InitialData";
import { ReflexContainer, ReflexSplitter, ReflexElement } from "react-reflex";
// import { atom, selector, useRecoilState, useRecoilValue } from "recoil";

import "react-reflex/styles.css";
import { GdbTerminal } from "./GdbTerminal";
import { InferiorTerminal } from "./InferiorTerminal";
import { GdbGuiTerminal } from "./GdbGuiTerminal";
import { Nav } from "./Nav";
import { TargetSelector } from "./TargetSelector";
import { GdbguiEditor } from "./GdbguiEditor";
import { Footer } from "./Footer";

export function Gdbgui() {
  const [initialData, setInitialData] = useState<Nullable<InitialData>>(null);
  useEffect(() => {
    async function initialize() {
      const initialData: InitialData = await (await fetch("/initial_data")).json();

      GdbApi.init(initialData.gdb_command, initialData.gdbpid);
      GlobalEvents.init();
      FileOps.init();
      setInitialData(initialData);
    }
    initialize();
  }, []);

  if (!initialData) {
    return <div className="h-full w-full">Loading...</div>;
  }
  return (
    <div className="h-screen text-gray-300 bg-black">
      <Settings />
      <HoverVar />
      <Modal />
      <ToolTip />
      <textarea
        style={{
          width: "0px",
          height: "0px",
          position: "absolute",
          top: "0",
          left: "-1000px",
        }}
        ref={(node) => {
          store.set("textarea_to_copy_to_clipboard", node);
        }}
      />
      <ReflexContainer orientation="horizontal">
        <ReflexElement flex={0.85} minSize={100} className="bg-gray-800 ">
          <div className="fixed bg-gray-800 w-full z-10">
            <Nav />
            <TargetSelector initial_user_input={initialData.initial_binary_and_args} />
          </div>
          <ReflexContainer
            orientation="vertical"
            className="h-full"
            style={{ paddingTop: "92px" }}
          >
            <ReflexElement className="left-pane" flex={0.6} minSize={100}>
              <GdbguiEditor />
            </ReflexElement>

            <ReflexSplitter className="" />

            <ReflexElement minSize={100}>
              <div className="pane-content">
                <RightSidebar signals={initialData.signals} debug={debug} />
              </div>
            </ReflexElement>
          </ReflexContainer>
        </ReflexElement>

        <ReflexSplitter className="" />

        <ReflexElement minSize={10} className="pb-10">
          <ReflexContainer orientation="vertical">
            <ReflexElement minSize={20} flex={0.5}>
              <GdbTerminal />
            </ReflexElement>

            <ReflexSplitter className="" />

            <ReflexElement minSize={20}>
              <GdbGuiTerminal />
            </ReflexElement>

            <ReflexSplitter className="" />

            <ReflexElement minSize={20}>
              <InferiorTerminal />
            </ReflexElement>
          </ReflexContainer>
        </ReflexElement>
      </ReflexContainer>
      <Footer />{" "}
    </div>
  );
}

// export class Gdbgui2 extends React.Component {
//   render() {
//     return (
//       <ReflexContainer orientation="vertical">
//         <ReflexElement className="left-pane">
//           <div className="pane-content">
//             <label>Left Pane (resizable)</label>
//           </div>
//         </ReflexElement>

//         <ReflexSplitter />

//         <ReflexElement className="right-pane" minSize={200} maxSize={800}>
//           <div className="pane-content">
//             <RightSidebar signals={initial_data.signals} debug={debug} />
//           </div>
//         </ReflexElement>
//       </ReflexContainer>
//     );
//   }
// }

// export class Gdbgui extends React.PureComponent {
//   componentWillMount() {
//   }
//   render() {
//     return (
//       <div className="splitjs_container">
//         <TopBar initial_user_input={initial_data.initial_binary_and_args} />

//         <div id="middle" style={{ paddingTop: "60px" }}>
//           <div id="folders_view" className="content" style={{ backgroundColor: "#333" }}>
//             <FoldersView />
//           </div>

//           <div id="source_code_view" className="content">
//             <MiddleLeft />
//           </div>

//           <div id="controls_sidebar" className="content" style={{ overflowX: "visible" }}>
//             {/* @ts-expect-error ts-migrate(2769) FIXME: Property 'signals' does not exist on type 'Intrins... Remove this comment to see the full error message */}
//             <RightSidebar signals={initial_data.signals} debug={debug} />
//           </div>
//         </div>

//         <div
//           id="bottom"
//           className="split split-horizontal"
//           style={{ width: "100%", height: "100%" }}
//         >
//           <div id="bottom_content" className="split content">
//             <Terminals />
//           </div>
//         </div>

//         {/* below are elements that are only displayed under certain conditions */}
//         <Modal />
//         <HoverVar />
// <Settings />
//         <ToolTip />
// <textarea
//   style={{
//     width: "0px",
//     height: "0px",
//     position: "absolute",
//     top: "0",
//     left: "-1000px",
//   }}
//   ref={(node) => {
//     store.set("textarea_to_copy_to_clipboard", node);
//   }}
// />
//       </div>
//     );
// }
// componentDidMount() {
//   // Split the body into different panes using splitjs (https://github.com/nathancahill/Split.js)
//   let middle_panes_split_obj = Split(
//     ["#folders_view", "#source_code_view", "#controls_sidebar"],
//     {
//       gutterSize: 8,
//       minSize: 100,
//       cursor: "col-resize",
//       direction: "horizontal", // horizontal makes a left/right pane, and a divider running vertically
//       sizes: store.get("show_filesystem") ? [30, 40, 29] : [0, 70, 29], // adding to exactly 100% is a little buggy due to splitjs, so keep it to 99
//     }
//   );

//   Split(["#middle", "#bottom"], {
//     gutterSize: 8,
//     cursor: "row-resize",
//     direction: "vertical", // vertical makes a top and bottom pane, and a divider running horizontally
//     sizes: [70, 30],
//   });

//   store.set("middle_panes_split_obj", middle_panes_split_obj);

// // Fetch the latest version only if using in normal mode. If debugging, we tend to
// // refresh quite a bit, which might make too many requests to github and cause them
// // to block our ip? Either way it just seems weird to make so many ajax requests.
// if (!store.get("debug")) {
//   // fetch version
//   $.ajax({
//     url: "https://raw.githubusercontent.com/cs01/gdbgui/master/gdbgui/VERSION.txt",
//     cache: false,
//     method: "GET",
//     success: (data) => {
//       store.set("latest_gdbgui_version", _.trim(data));
//     },
//     error: (data) => {
//       void data;
//       store.set("latest_gdbgui_version", "(could not contact server)");
//     },
//   });
// }
// }
// }
