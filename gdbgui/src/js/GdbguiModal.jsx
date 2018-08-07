import React from "react";
import Actions from "./Actions.js";
import { store } from "statorgfc";

class Modal extends React.Component {
  constructor() {
    super();
    store.connectComponentState(this, ["show_modal", "modal_body", "modal_header"]);
  }
  render() {
    return (
      <div
        className={this.state.show_modal ? "fullscreen_modal" : "hidden"}
        ref={el => (this.fullscreen_node = el)}
        onClick={e => {
          if (e.target === this.fullscreen_node) {
            Actions.toggle_modal_visibility();
          }
        }}
      >
        <div className="modal_content">
          <div>
            <button
              type="button"
              className="close"
              onClick={Actions.toggle_modal_visibility}
            >
              ×
            </button>
          </div>

          <h4>{this.state.modal_header}</h4>

          <div style={{ paddingBottom: "20px" }}>{this.state.modal_body}</div>

          <button
            style={{ float: "right" }}
            type="button"
            className="btn btn-success"
            onClick={Actions.toggle_modal_visibility}
          >
            Close
          </button>
          <div style={{ paddingBottom: "30px" }} />
        </div>
      </div>
    );
  }
}

export default Modal;
