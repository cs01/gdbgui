/**
 * A component to display, in gory detail, what is
 * returned from gdb's machine interface. This displays the
 * data source that is fed to all components and UI elements
 * in gdbgui, and is useful when debugging gdbgui, or
 * a command that failed but didn't have a useful failure
 * message in gdbgui.
 */
import { useState } from "react";
import { store, useGlobalValue } from "./Store";
import { GdbMiMessage } from "./types";
import { ChevronDownIcon, ChevronRightIcon } from "@heroicons/react/solid";

export function GdbMiOutput() {
  const gdbMiOutput = useGlobalValue<typeof store.data["gdb_mi_output"]>("gdb_mi_output");
  const [collapsed, setCollapsed] = useState<{ [key: number]: Nullable<boolean> }>({});

  return (
    <div className="overflow-scroll">
      <h2>Gdb MI Output</h2>
      <div className="text-sm">{gdbMiOutput.length} entries (newest at top)</div>
      {gdbMiOutput
        .map((miMessage: GdbMiMessage, i: number) => {
          return (
            <div key={i}>
              <div
                className={`whitespace-pre text-xs  ${
                  i % 2 === 0 ? "bg-black" : "bg-gray-900"
                }`}
              >
                {collapsed[i] === true ? (
                  <div
                    className="w-full space-x-3 py-2 flex items-center cursor-pointer hover:bg-purple-900"
                    onClick={() => {
                      const newCollapsed = { ...collapsed };
                      newCollapsed[i] = !collapsed[i];
                      setCollapsed(newCollapsed);
                    }}
                  >
                    <button className="">
                      <ChevronRightIcon className="mr-1 inline  h-5 w-5" />
                    </button>
                    <div>Entry {i}</div>
                    <div>{JSON.stringify(miMessage).length} characters collapsed</div>
                  </div>
                ) : (
                  <div className="w-full">
                    <div
                      className="flex items-center cursor-pointer"
                      onClick={() => {
                        const newCollapsed = { ...collapsed };
                        newCollapsed[i] = !collapsed[i];
                        setCollapsed(newCollapsed);
                        console.log("hi");
                      }}
                    >
                      <button className=" text-left py-2">
                        <ChevronDownIcon className="mr-1 inline  h-5 w-5" />
                      </button>
                      <div>Entry {i}</div>
                    </div>
                    <pre key={i}>{JSON.stringify(miMessage, null, 2)}</pre>
                  </div>
                )}
              </div>
            </div>
          );
        })
        .reverse()}
      <div className="text-sm">{gdbMiOutput.length} entries</div>
    </div>
  );
}

export function saveNewMiOutput(gdbMiMessage: GdbMiMessage) {
  const gdbMiMessages = store.data.gdb_mi_output;

  while (gdbMiMessages.length > 500) {
    gdbMiMessages.pop();
  }
  gdbMiMessages.push(gdbMiMessage);

  store.set<typeof store.data.gdb_mi_output>("gdb_mi_output", [...gdbMiMessages]);
}

// class GdbMiOutput_OLD extends React.Component<{}, State> {
//   static MAX_OUTPUT_ENTRIES = 500;
//   _debounced_scroll_to_bottom: any;
//   el: any;
//   constructor() {
//     // @ts-expect-error ts-migrate(2554) FIXME: Expected 1-2 arguments, but got 0.
//     super();
//     store.reactComponentState(this, ["gdb_mi_output"]);
//     this._debounced_scroll_to_bottom = _.debounce(
//       this._scroll_to_bottom.bind(this),
//       300,
//       {
//         leading: true,
//       }
//     );
//   }
//   render() {
//     return (
//       <div>
//         <button
//           title="clear all mi output"
//           className="pointer btn btn-default btn-xs"
//           onClick={() => store.set<typeof store.data.gdb_mi_output>("gdb_mi_output", [])}
//         >
//           clear output
//           <span className="glyphicon glyphicon-ban-circle pointer" />
//         </button>
//         <div id="gdb_mi_output" className="otpt" style={{ fontSize: "0.8em" }}>
//           {this.state.gdb_mi_output}
//         </div>
//       </div>
//     );
//   }
//   componentDidMount() {
//     this.el = document.getElementById("gdb_mi_output");
//   }
//   componentDidUpdate() {
//     this._debounced_scroll_to_bottom();
//   }
//   _scroll_to_bottom() {
//     this.el.scrollTop = this.el.scrollHeight;
//   }
//   static add_mi_output(mi_obj: any) {
//     const newStr = JSON.stringify(mi_obj, null, 4)
//       // @ts-expect-error ts-migrate(2554) FIXME: Expected 2 arguments, but got 1.
//       .replace(/[^(\\)]\\n/g)
//       .replace("<", "&lt;")
//       .replace(">", "&gt;");
//     const gdbMiOutput = store.data.gdb_mi_output;

//     while (gdbMiOutput.length > GdbMiOutput.MAX_OUTPUT_ENTRIES) {
//       gdbMiOutput.shift();
//     }
//     gdbMiOutput.push(newStr);

//     store.set<typeof store.data.gdb_mi_output>("gdb_mi_output", gdbMiOutput);
//   }
// }
