import React from "react";
import Handlers from "./EventHandlers";
import { store } from "./Store";

type State = any;

class Modal extends React.Component<{}, State> {
  fullscreen_node: any;
  constructor() {
    // @ts-expect-error ts-migrate(2554) FIXME: Expected 1-2 arguments, but got 0.
    super();
    store.reactComponentState(this, ["show_modal", "modal_body", "modal_header"]);
  }

  render() {
    return (
      <div
        style={{ zIndex: this.state.show_modal ? 9999 : -100 }}
        className={
          (this.state.show_modal ? "bg-opacity-80 " : "bg-opacity-0 ") +
          "w-screen h-screen bg-black absolute left-0 top-0 z-40 flex justify-center items-center"
        }
        ref={(el) => (this.fullscreen_node = el)}
        onClick={(e) => {
          if (e.target === this.fullscreen_node) {
            store.set<typeof store.data.show_modal>("show_modal", false);
          }
        }}
      >
        <div
          className={
            this.state.show_modal
              ? "p-10 border-2 border-purple-800 bg-gray-800 rounded-lg max-w-2xl "
              : "  hidden"
          }
        >
          <h4>{this.state.modal_header}</h4>

          <div className="py-10">{this.state.modal_body}</div>

          <div className="flex flex-col items-end">
            <button
              type="button"
              className="btn btn-purple"
              onClick={Handlers.toggle_modal_visibility}
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
