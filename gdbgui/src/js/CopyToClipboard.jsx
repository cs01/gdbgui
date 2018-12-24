import React from "react";
import { store } from "statorgfc";

class CopyToClipboard extends React.Component {
  render() {
    if (!this.props.content) {
      return null;
    }
    return (
      <button
        className='btn btn-secondary btn-sm'
        ref={node => (this.node = node)}
        data-toggle="tooltip"
        data-placement="top"
        title="Tooltip on top"
        onClick={() => {
          let textarea = store.get("textarea_to_copy_to_clipboard");
          textarea.value = this.props.content;
          textarea.select();
          document.execCommand("copy") || console.error('failed to copy');
        }}>
        <span className=' fa fa-copy'/>
      </button>
    );
  }
}

export default CopyToClipboard;
