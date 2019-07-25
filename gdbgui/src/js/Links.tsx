import Actions from "./Actions.js";
import * as React from "react";
import CopyToClipboard from "./CopyToClipboard";
import MemoryLink from "./MemoryLink";

type Props = {
  file?: string
  fullname?: string
  line: string
  num_lines?: number
};

export class FileLink extends React.Component<Props> {
  render() {
    let line = parseInt(this.props.line);
    let onclick = () => {},
      cls = "";
    if (!this.props.file || !line) {
      line = 0;
    }
    let sep = "";
    if (line && line !== 0) {
      sep = ":";
    }
    if (this.props.fullname) {
      onclick = () => Actions.view_file(this.props.fullname, line);
      cls = "pointer";
    }

    let clipboard_content = null;
    if (this.props.fullname || this.props.file) {
      clipboard_content = (this.props.fullname || this.props.file) + sep + line;
    }
    return (
      <div style={{ display: "inline-block", whiteSpace: "nowrap" }}>
        <span
          onClick={onclick}
          className={cls}
          title={`click to view ${this.props.fullname}`}
          style={{ display: "inline" }}
        >
          {this.props.file}
          {sep}
          {line}
        </span>

        <CopyToClipboard content={clipboard_content} />
        {this.props.num_lines ? `(${this.props.num_lines} lines total)` : ""}
      </div>
    );
  }
}

type FrameLinkProps = {
  addr: string
  file?: string
  fullname?: string
  line: string
};

export class FrameLink extends React.Component<FrameLinkProps> {
  render() {
    return (
      <div>
        <FileLink
          fullname={this.props.fullname}
          file={this.props.file}
          line={this.props.line}
        />
        <span style={{ whiteSpace: "pre" }}> </span>
        <MemoryLink addr={this.props.addr} />
      </div>
    );
  }
}
