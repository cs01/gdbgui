import React from "react";
import Util from "./Util.js";
import {store} from "statorgfc";

class ToolTipTourguide extends React.Component {
  constructor(props) {
    super(props);
    if (!props.position && !(props.top && props.left)) {
      console.warn("did not receive position");
    }
    this.ref = React.createRef();
    store.connectComponentState(this, [
      "tour_guide_step",
      "num_tour_guide_steps",
      "show_tour_guide"
    ]);
  }

  componentWillMount() {
    store.set("num_tour_guide_steps", store.get("num_tour_guide_steps") + 1);
  }

  static dismiss() {
    store.set("show_tour_guide", false);
    Util.persist_value_for_key("show_tour_guide");
  }

  static next() {
    store.set("tour_guide_step", store.get("tour_guide_step") + 1);
  }

  static start_guide() {
    store.set("tour_guide_step", 0);
    store.set("show_tour_guide", true);
  }

  componentDidUpdate() {
    if (this.state.show_tour_guide && this.ref.current) {
      // need to ensure absolute position is respected  by setting parent to
      // relative
      this.ref.current.parentNode.style.position = "relative";
    }
  }

  get_position(position_name) {
    let top, left;
    switch (position_name) {
      case "left":
        top = "100%";
        left = "-50%";
        break;
      case "right":
        top = "50%";
        left = "0px";
        break;
      case "bottom":
      case "bottomcenter":
        top = "100%";
        left = "50%";
        break;
      case "bottomleft":
        top = "100%";
        left = "0";
        break;
      case "topleft":
        top = "0";
        left = "0";
        break;
      case "overlay":
        top = "50%";
        left = "50%";
        break;
      default:
        console.warn("invalid position " + this.props.position);
        top = "100%";
        left = "50%";
        break;
    }
    return [top, left];
  }

  render() {
    if (!this.state.show_tour_guide) {
      return null;
    } else if (this.props.step_num !== this.state.tour_guide_step) {
      return null;
    }

    let top
    // , left;
    if (this.props.top && this.props.left) {
      top = this.props.top;
      // left = this.props.left;
    } else {
      [top, /*left*/] = this.get_position(this.props.position);
    }

    let is_last_step = this.props.step_num + 1 === this.state.num_tour_guide_steps
    return (
      <div
        ref={this.ref}
        className='modal-content shadow-lg'
        style={{
          minWidth: "200px",
          maxWidth: "350px",
          zIndex: "1000",
          position: "absolute",
          overflow: "auto",
          whiteSpace: "normal",
          left: 0,
          top: top,
          fontSize: "small",
          pointer: "normal"
        }}
      >
        <div className="modal-body">
          {this.props.content}
          <p>
            {this.props.step_num + 1} of {this.state.num_tour_guide_steps}
          </p>
        </div>
        <div className="modal-footer">
          {!is_last_step ?
            <button onClick={ToolTipTourguide.dismiss}
                    className="btn pointer">
              Dismiss
            </button>
            /* otherwise */ : null}
          <span className="btn btn-primary pointer" onClick={ToolTipTourguide.next}>
          {is_last_step ? "Finish" : "Next"}
        </span>
        </div>
      </div>
    );
  }
}

export default ToolTipTourguide;
