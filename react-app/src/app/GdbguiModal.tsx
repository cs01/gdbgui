import React from "react";
import Actions from "./Actions";
import { store } from "statorgfc";

type State = any;

class Modal extends React.Component<{}, State> {
  fullscreen_node: any;
  constructor() {
    // @ts-expect-error ts-migrate(2554) FIXME: Expected 1-2 arguments, but got 0.
    super();
    // @ts-expect-error ts-migrate(2339) FIXME: Property 'connectComponentState' does not exist on... Remove this comment to see the full error message
    store.connectComponentState(this, ["show_modal", "modal_body", "modal_header"]);
  }

  // padding: 10px;
  // width: 100%;
  // height: 100%;
  // position: fixed;
  // left: 0;
  // top: 0;
  // z-index: 120;
  // background: rgba(0, 0, 0, 0.8);
  // overflow: auto;

  render() {
    return (
      <div
        className={
          this.state.show_modal
            ? "fixed m-auto align-middle items-center max-w-xl z-50 overflow-auto p-10  bg-gray-200"
            : "  hidden"
        }
        ref={(el) => (this.fullscreen_node = el)}
        onClick={(e) => {
          if (e.target === this.fullscreen_node) {
            Actions.toggle_modal_visibility();
          }
        }}
      >
        <div>
          <h4>{this.state.modal_header}</h4>

          <div className="py-10">{this.state.modal_body}</div>

          <div className="absolute right-0">
            <button
              type="button"
              className="btn btn-blue"
              onClick={Actions.toggle_modal_visibility}
            >
              Close
            </button>
          </div>
        </div>
      </div>
    );
  }
}

export default Modal;
