import React from "react";
import Util from "./Util";
import { store } from "statorgfc";

type State = any;

class ToolTipTourguide extends React.Component<{}, State> {
  constructor(props: {}) {
    super(props);
    // @ts-expect-error ts-migrate(2339) FIXME: Property 'position' does not exist on type '{}'.
    if (!props.position && !(props.top && props.left)) {
      console.warn("did not receive position");
    }
    // @ts-expect-error ts-migrate(2551) FIXME: Property 'ref' does not exist on type 'ToolTipTour... Remove this comment to see the full error message
    this.ref = React.createRef();
    // @ts-expect-error ts-migrate(2339) FIXME: Property 'connectComponentState' does not exist on... Remove this comment to see the full error message
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
    store.set("tour_guide_step", 0);
    Util.persist_value_for_key("show_tour_guide");
  }
  static next() {
    store.set("tour_guide_step", store.get("tour_guide_step") + 1);
  }
  guide_finshed() {
    store.set("tour_guide_step", 0);
  }
  static start_guide() {
    store.set("tour_guide_step", 0);
    store.set("show_tour_guide", true);
    Util.persist_value_for_key("show_tour_guide");
  }
  componentDidUpdate() {
    // @ts-expect-error ts-migrate(2551) FIXME: Property 'ref' does not exist on type 'ToolTipTour... Remove this comment to see the full error message
    if (this.state.show_tour_guide && this.ref.current) {
      // need to ensure absolute position is respected  by setting parent to
      // relative
      // @ts-expect-error ts-migrate(2551) FIXME: Property 'ref' does not exist on type 'ToolTipTour... Remove this comment to see the full error message
      this.ref.current.parentNode.style.position = "relative";
    }
  }
  get_position(position_name: any) {
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
        // @ts-expect-error ts-migrate(2339) FIXME: Property 'position' does not exist on type 'Readon... Remove this comment to see the full error message
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
      // @ts-expect-error ts-migrate(2339) FIXME: Property 'step_num' does not exist on type 'Readon... Remove this comment to see the full error message
    } else if (this.props.step_num !== this.state.tour_guide_step) {
      return null;
    }

    let top, left;
    // @ts-expect-error ts-migrate(2339) FIXME: Property 'top' does not exist on type 'Readonly<{}... Remove this comment to see the full error message
    if (this.props.top && this.props.left) {
      // @ts-expect-error ts-migrate(2339) FIXME: Property 'top' does not exist on type 'Readonly<{}... Remove this comment to see the full error message
      top = this.props.top;
      // @ts-expect-error ts-migrate(2339) FIXME: Property 'left' does not exist on type 'Readonly<{... Remove this comment to see the full error message
      left = this.props.left;
    } else {
      // @ts-expect-error ts-migrate(2339) FIXME: Property 'position' does not exist on type 'Readon... Remove this comment to see the full error message
      [top, left] = this.get_position(this.props.position);
    }

    // @ts-expect-error ts-migrate(2339) FIXME: Property 'step_num' does not exist on type 'Readon... Remove this comment to see the full error message
    let is_last_step = this.props.step_num + 1 === this.state.num_tour_guide_steps,
      dismiss = is_last_step ? null : (
        <span className="btn btn-default pointer" onClick={ToolTipTourguide.dismiss}>
          Dismiss
        </span>
      );
    return (
      <div
        // @ts-expect-error ts-migrate(2551) FIXME: Property 'ref' does not exist on type 'ToolTipTour... Remove this comment to see the full error message
        ref={this.ref}
        style={{
          minWidth: "200px",
          maxWidth: "350px",
          background: "white",
          border: "1px solid",
          padding: "5px",
          zIndex: "1000",
          position: "absolute",
          overflow: "auto",
          whiteSpace: "normal",
          left: left,
          top: top,
          fontSize: "small"
        }}
      >
        {/* @ts-expect-error ts-migrate(2339) FIXME: Property 'content' does not exist on type 'Readonl... Remove this comment to see the full error message */}
        {this.props.content}
        <p />
        {/* @ts-expect-error ts-migrate(2339) FIXME: Property 'step_num' does not exist on type 'Readon... Remove this comment to see the full error message */}
        {this.props.step_num + 1} of {this.state.num_tour_guide_steps}
        <p />
        {dismiss}
        <span className="btn btn-primary pointer" onClick={ToolTipTourguide.next}>
          {is_last_step ? "Finish" : "Next"}
        </span>
      </div>
    );
  }
}

export default ToolTipTourguide;
