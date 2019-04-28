import * as React from "react";
import Memory from "./Memory.jsx";

type Props = {
  addr: string
  style?: React.CSSProperties
};

class MemoryLink extends React.Component<Props> {
  render() {
    // turn 0x00000000000000 into 0x0
    const address_no_leading_zeros = "0x" + parseInt(this.props.addr, 16).toString(16);
    return (
      <span
        className="pointer memadr_react"
        onClick={() => Memory.set_inputs_from_address(address_no_leading_zeros)}
        title={`click to explore memory at ${address_no_leading_zeros}`}
        style={this.props.style}
      >
        {address_no_leading_zeros}
      </span>
    );
  }
  static defaultProps = { style: { fontFamily: "monospace" } };
}

export default MemoryLink;
