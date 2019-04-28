import * as React from "react";
import ToolTip from "./ToolTip.jsx";
import { store } from "statorgfc";

type Props = {
  content: string | null
};

class CopyToClipboard extends React.Component<Props> {
  node: HTMLSpanElement | null = null;
  render() {
    if (!this.props.content) {
      return null;
    }
    return (
      <span
        className={"pointer glyphicon glyphicon-book"}
        style={{ color: "#ccc", display: "inline" }}
        ref={node => (this.node = node)}
        onMouseOver={() => {
          ToolTip.show_tooltip_on_node("copy to clipboard", this.node);
        }}
        onMouseLeave={ToolTip.hide_tooltip}
        onClick={() => {
          try {
            let textarea = store.get("textarea_to_copy_to_clipboard");
            textarea.value = this.props.content;
            textarea.select();
            if (document.execCommand("copy") === true) {
              ToolTip.show_copied_tooltip_on_node(this.node);
            } else {
              ToolTip.show_tooltip_on_node("unable to copy", this.node);
            }
          } catch (err) {
            ToolTip.show_tooltip_on_node("unable to copy", this.node);
          }
        }}
      />
    );
  }
}

export default CopyToClipboard;
