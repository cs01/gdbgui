import * as React from "react";
import MemoryClass from "./Memory";

type OwnProps = {
  addr: string;
  style?: React.CSSProperties;
};

type Props = OwnProps & typeof MemoryLink.defaultProps;

class MemoryLink extends React.Component<Props> {
  render() {
    // turn 0x00000000000000 into 0x0
    const addressNoLeadingZeros = "0x" + parseInt(this.props.addr, 16).toString(16);
    return (
      <button
        className="hover:bg-purple-900 font-mono"
        onClick={() => MemoryClass.setInputsFromAddress(addressNoLeadingZeros)}
        title={`click to explore memory at ${addressNoLeadingZeros}`}
      >
        {addressNoLeadingZeros}
      </button>
    );
  }
  static defaultProps = { style: { fontFamily: "monospace" } };
}

export default MemoryLink;
