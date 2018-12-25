import React from "react";
import {store} from "statorgfc";
import Actions from "./Actions";

class Modal extends React.Component {
  constructor() {
    super();
    store.connectComponentState(this, ["modal_body", "modal_header"]);
  }

  render() {
    return (
      <div id="modal-dialog"
           className="modal modal-md"
           tabIndex="-1">
        <div className="modal-dialog">
          <div className="modal-content">
            <div className="modal-header">
              <h5 className="modal-title">{this.state.modal_header}</h5>
              <button onClick={Actions.dismiss_modal}
                      className="close">
                <span className='fa fa-close'/>
              </button>
            </div>
            <div className="modal-body">
              {this.state.modal_body}
            </div>
            <div className="modal-footer">
              <button onClick={Actions.dismiss_modal}
                      className="btn btn-secondary">Close</button>
            </div>
          </div>
        </div>
      </div>
    );
  }
}


export default Modal;
