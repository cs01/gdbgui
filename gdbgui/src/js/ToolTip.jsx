import React from "react";
import { store } from "statorgfc";

class ToolTip extends React.Component {
  constructor() {
    super();
    store.connectComponentState(this, ["tooltip"]);
    this.timeout = null;
  }
  static hide_tooltip() {
    store.set("tooltip", {
      hidden: true,
      show_for_n_sec: null,
      node: null,
      content: null
    });
  }
  static show_tooltip_on_node(content, node, show_for_n_sec = null) {
    store.set("tooltip", {
      hidden: false,
      show_for_n_sec: show_for_n_sec,
      node: node,
      content: content
    });
  }
  static show_copied_tooltip_on_node(node) {
    ToolTip.show_tooltip_on_node("copied!", node, 1);
  }
  render() {
    clearTimeout(this.timeout);
    const tooltip = store.get("tooltip");
    if (!tooltip.node || tooltip.hidden) {
      return null;
    }
    let rect = tooltip.node.getBoundingClientRect(),
      assumed_width_px = 200,
      distance_to_right_edge = window.innerWidth - rect.x,
      horizontal_buffer =
        distance_to_right_edge < assumed_width_px
          ? assumed_width_px - distance_to_right_edge
          : 0,
      left = rect.x - horizontal_buffer + "px",
      top = rect.y + tooltip.node.offsetHeight + "px";
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
          zIndex: "121"
        }}
      >
        {tooltip.content}
      </div>
    );
  }
}

export default ToolTip;
