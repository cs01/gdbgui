import React from "react";

class FileSystem extends React.Component {
  get_node_jsx(node, depth = 0) {
    if (!node) {
      return null;
    }
    this.nodecount++;

    let get_child_jsx_for_node = node => {
      if (!(node.children && node.toggled)) {
        return null;
      }
      return <ul>{node.children.map(child => this.get_node_jsx(child, depth + 1))}</ul>;
    };
    let indent = "\u00A0\u00A0\u00A0".repeat(depth),
      glyph = null;
    let is_file = !node.children,
      is_dir = !is_file;
    if (is_dir) {
      glyph = node.toggled ? "glyphicon-chevron-down" : "glyphicon-chevron-right";
    }

    let onClickName = null;
    if (is_file) {
      onClickName = () => {
        this.props.onClickName(node);
      };
    }

    return (
      <React.Fragment key={this.nodecount}>
        <li className="pointer">
          {indent}
          <span
            className={"glyphicon  " + glyph}
            onClick={() => {
              this.props.onToggle(node);
            }}
          />
          <span onClick={onClickName}>{node.name}</span>
        </li>
        {get_child_jsx_for_node(node)}
      </React.Fragment>
    );
  }

  render() {
    this.nodecount = -1;
    return (
      <div id="filesystem">
        <ul style={{ color: "#ccc" }}>{this.get_node_jsx(this.props.rootnode)}</ul>
      </div>
    );
  }
}

export default FileSystem;
