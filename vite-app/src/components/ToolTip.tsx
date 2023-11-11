import _ from "lodash";
import React from "react";
import { store } from "./Store";

class ToolTip extends React.Component {
  timeout: any;
  constructor() {
    // @ts-expect-error ts-migrate(2554) FIXME: Expected 1-2 arguments, but got 0.
    super();
    store.reactComponentState(this, ["tooltip"]);
    this.timeout = null;
  }
  static hide_tooltip() {
    store.set<typeof store.data.tooltip>("tooltip", {
      hidden: true,
      show_for_n_sec: null,
      node: null,
      content: null,
    });
  }
  static show_tooltip_on_node(content: any, node: any, show_for_n_sec = null) {
    store.set<typeof store.data.tooltip>("tooltip", {
      hidden: false,
      show_for_n_sec: show_for_n_sec,
      node: node,
      content: content,
    });
  }
  static show_copied_tooltip_on_node(node: any) {
    // @ts-expect-error ts-migrate(2345) FIXME: Argument of type '1' is not assignable to paramete... Remove this comment to see the full error message
    ToolTip.show_tooltip_on_node("copied!", node, 1);
  }
  render() {
    clearTimeout(this.timeout);
    const tooltip = store.data.tooltip;
    if (!tooltip.node || tooltip.hidden) {
      return null;
    }
    const rect = tooltip.node.getBoundingClientRect();
    const assumed_width_px = 200;
    const distance_to_right_edge = window.innerWidth - rect.x;
    const horizontal_buffer =
      distance_to_right_edge < assumed_width_px
        ? assumed_width_px - distance_to_right_edge
        : 0;
    const left = rect.x - horizontal_buffer + "px";
    const top = rect.y + tooltip.node.offsetHeight + "px";
    if (_.isInteger(tooltip.show_for_n_sec)) {
      this.timeout = setTimeout(ToolTip.hide_tooltip, tooltip.show_for_n_sec * 1000);
    }
    return (
      <div
        style={{
          top: top,
          left: left,
          maxWidth: "350px",
          background: "white",
          border: "1px solid",
          position: "fixed",
          padding: "5px",
          zIndex: "121",
        }}
      >
        {tooltip.content}
      </div>
    );
  }
}

export default ToolTip;
