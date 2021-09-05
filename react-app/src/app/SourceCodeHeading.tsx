import React from "react";
import constants from "./constants";
import { store } from "statorgfc";
import { FileLink } from "./Links";
import FileOps from "./FileOps";

type State = any;

class SourceCodeHeading extends React.Component<{}, State> {
  constructor() {
    // @ts-expect-error ts-migrate(2554) FIXME: Expected 1-2 arguments, but got 0.
    super();
    // @ts-expect-error ts-migrate(2339) FIXME: Property 'connectComponentState' does not exist on... Remove this comment to see the full error message
    store.connectComponentState(this, [
      "fullname_to_render",
      "paused_on_frame",
      "line_of_source_to_flash",
      "source_code_selection_state"
    ]);
  }
  render() {
    let line;
    if (
      this.state.source_code_selection_state ===
        constants.source_code_selection_states.PAUSED_FRAME &&
      this.state.paused_on_frame
    ) {
      line = this.state.paused_on_frame.line;
    } else {
      line = this.state.line_of_source_to_flash;
    }

    let num_lines = 0;
    if (
      this.state.fullname_to_render &&
      FileOps.get_source_file_obj_from_cache(this.state.fullname_to_render)
    ) {
      // @ts-expect-error ts-migrate(2554) FIXME: Expected 2 arguments, but got 1.
      num_lines = FileOps.get_num_lines_in_file(this.state.fullname_to_render);
    }
    return (
      <FileLink
        fullname={this.state.fullname_to_render}
        file={this.state.fullname_to_render}
        line={line}
        num_lines={num_lines}
      />
    );
  }
}

export default SourceCodeHeading;
