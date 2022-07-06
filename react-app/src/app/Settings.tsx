import { store, useGlobalState } from "./Store";
import Handlers from "./EventHandlers";
import ToolTip from "./ToolTip";
import React from "react";
import { GlobalState } from "./types";
import { GlobalBooleanToggle } from "./BooleanToggle";

export function Settings() {
  const [maxLinesToFetch, setMaxLinesToFetch] = useGlobalState<
    typeof store.data.max_lines_of_code_to_fetch
  >("max_lines_of_code_to_fetch");

  return (
    <div className="flex flex-col space-y-5">
      <div className="flex">
        {/* // /             ref={(n) => (this.save_button = n)}
      //             onClick={() => {
      //               const newValue = parseInt(this.max_source_file_lines_input.value);
      //               Handlers.update_max_lines_of_code_to_fetch(newValue);
      //               // @ts-expect-error ts-migrate(2345) FIXME: Argument of type '1' is not assignable to paramete... Remove this comment to see the full error message
      //               ToolTip.show_tooltip_on_node("saved!", this.save_button, 1); */}
        Maximum number of source file lines to display:{" "}
        <input
          value={maxLinesToFetch}
          onChange={(e) => {
            const newValue = parseInt(e.target.value);
            if (Number.isInteger(newValue)) {
              setMaxLinesToFetch(newValue);
            } else {
              setMaxLinesToFetch(500);
            }
          }}
          className="input"
        />
      </div>
      <GlobalBooleanToggle
        label="Refresh all components when a command is sent from the console"
        storeKey={"refresh_state_after_sending_console_command"}
      />
      <GlobalBooleanToggle
        label="Add breakpoint to main() after loading executable"
        storeKey={"auto_add_breakpoint_to_main"}
      />
      <GlobalBooleanToggle
        label="Print all sent commands in console, including those sent automatically by gdbgui"
        storeKey={"show_all_sent_commands_in_console"}
      />
      <GlobalBooleanToggle
        label="Pretty print dynamic variables (requires restart)"
        storeKey={"pretty_print"}
      />
    </div>
  );
}
