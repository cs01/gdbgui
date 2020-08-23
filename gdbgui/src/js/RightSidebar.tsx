/**
 * A component to show/hide variable exploration when hovering over a variable
 * in the source code
 */

import React from "react";

import Breakpoints from "./Breakpoints";
import constants from "./constants";
import Expressions from "./Expressions";
import GdbMiOutput from "./GdbMiOutput";
import InferiorProgramInfo from "./InferiorProgramInfo";
import Locals from "./Locals";
import Memory from "./Memory";
import Registers from "./Registers";
import Tree from "./Tree";
import Threads from "./Threads";
import ToolTipTourguide from "./ToolTipTourguide";

let onmouseup_in_parent_callbacks: any = [],
  onmousemove_in_parent_callbacks: any = [];

let onmouseup_in_parent_callback = function() {
  // @ts-expect-error ts-migrate(7006) FIXME: Parameter 'fn' implicitly has an 'any' type.
  onmouseup_in_parent_callbacks.map(fn => fn());
};
let onmousemove_in_parent_callback = function(e: any) {
  // @ts-expect-error ts-migrate(7006) FIXME: Parameter 'fn' implicitly has an 'any' type.
  onmousemove_in_parent_callbacks.map(fn => {
    fn(e);
  });
};

type OwnCollapserState = any;

type CollapserState = OwnCollapserState & typeof Collapser.defaultProps;

class Collapser extends React.Component<{}, CollapserState> {
  static defaultProps = { collapsed: false, id: "" };
  _height_when_clicked: any;
  _page_y_orig: any;
  _resizing: any;
  collapser_box_node: any;
  constructor(props: {}) {
    // @ts-expect-error ts-migrate(2554) FIXME: Expected 1-2 arguments, but got 0.
    super();
    this.state = {
      // @ts-expect-error ts-migrate(2339) FIXME: Property 'collapsed' does not exist on type '{}'.
      collapsed: props.collapsed,
      autosize: true,
      height_px: null, // if an integer, force height to this value
      _mouse_y_click_pos_px: null,
      _height_when_clicked: null
    };
    this.onmousedown_resizer = this.onmousedown_resizer.bind(this);
    this.onmouseup_resizer = this.onmouseup_resizer.bind(this);
    this.onmousemove_resizer = this.onmousemove_resizer.bind(this);
    this.onclick_restore_autosize = this.onclick_restore_autosize.bind(this);

    onmouseup_in_parent_callbacks.push(this.onmouseup_resizer.bind(this));
    onmousemove_in_parent_callbacks.push(this.onmousemove_resizer.bind(this));
  }
  toggle_visibility() {
    this.setState({ collapsed: !this.state.collapsed });
  }
  onmousedown_resizer(e: any) {
    this._resizing = true;
    this._page_y_orig = e.pageY;
    this._height_when_clicked = this.collapser_box_node.clientHeight;
  }
  onmouseup_resizer() {
    this._resizing = false;
  }
  onmousemove_resizer(e: any) {
    if (this._resizing) {
      let dh = e.pageY - this._page_y_orig;
      this.setState({
        height_px: this._height_when_clicked + dh,
        autosize: false
      });
    }
  }
  onclick_restore_autosize() {
    this.setState({ autosize: true });
  }
  render() {
    let style = {
      height: this.state.autosize ? "auto" : this.state.height_px + "px",
      overflow: this.state.autosize ? "visible" : "auto"
    };

    let reset_size_button = "";
    if (!this.state.autosize) {
      // @ts-expect-error ts-migrate(2322) FIXME: Type 'Element' is not assignable to type 'string'.
      reset_size_button = (
        <span
          onClick={this.onclick_restore_autosize}
          className="placeholder"
          title={
            "Height frozen at " + this.state.height_px + "px. Click to restore autosize."
          }
          style={{
            // @ts-expect-error ts-migrate(2322) FIXME: Object literal may only specify known properties, ... Remove this comment to see the full error message
            align: "right",
            position: "relative",
            top: "-10px",
            cursor: "pointer"
          }}
        >
          reset height
        </span>
      );
    }

    let resizer = "";
    if (!this.state.collapsed) {
      // @ts-expect-error ts-migrate(2322) FIXME: Type 'Element' is not assignable to type 'string'.
      resizer = (
        <React.Fragment>
          <div
            className="rowresizer"
            onMouseDown={this.onmousedown_resizer}
            style={{ textAlign: "right" }}
            title="Click and drag to resize height"
          >
            {" "}
            {reset_size_button}
          </div>
        </React.Fragment>
      );
    }

    return (
      <div className="collapser">
        <div className="pointer titlebar" onClick={this.toggle_visibility.bind(this)}>
          <span
            className={`glyphicon glyphicon-chevron-${
              this.state.collapsed ? "right" : "down"
            }`}
            style={{ marginRight: "6px" }}
          />
          {/* @ts-expect-error ts-migrate(2339) FIXME: Property 'title' does not exist on type 'Readonly<... Remove this comment to see the full error message */}
          <span className="lighttext">{this.props.title}</span>
        </div>

        <div
          className={this.state.collapsed ? "hidden" : ""}
          // @ts-expect-error ts-migrate(2339) FIXME: Property 'id' does not exist on type 'Readonly<{}>... Remove this comment to see the full error message
          id={this.props.id}
          style={style}
          ref={n => (this.collapser_box_node = n)}
        >
          {/* @ts-expect-error ts-migrate(2339) FIXME: Property 'content' does not exist on type 'Readonl... Remove this comment to see the full error message */}
          {this.props.content}
        </div>

        {resizer}
      </div>
    );
  }
}

class RightSidebar extends React.Component {
  render() {
    let input_style = {
        display: "inline",
        width: "100px",
        padding: "6px 6px",
        height: "25px",
        fontSize: "1em"
      },
      mi_output = "";
    // @ts-expect-error ts-migrate(2339) FIXME: Property 'debug' does not exist on type 'Readonly<... Remove this comment to see the full error message
    if (this.props.debug) {
      // @ts-expect-error ts-migrate(2322) FIXME: Type 'Element' is not assignable to type 'string'.
      mi_output = (
        // @ts-expect-error ts-migrate(2322) FIXME: Property 'title' does not exist on type 'Intrinsic... Remove this comment to see the full error message
        <Collapser title="gdb mi output" content={<GdbMiOutput id="gdb_mi_output" />} />
      );
    }

    return (
      <div
        className="content"
        onMouseUp={onmouseup_in_parent_callback}
        onMouseMove={onmousemove_in_parent_callback}
      >
        <ToolTipTourguide
          // @ts-expect-error ts-migrate(2322) FIXME: Property 'position' does not exist on type 'Intrin... Remove this comment to see the full error message
          position={"topleft"}
          content={
            <div>
              <h5>
                This sidebar contains a visual, interactive representation of the state of
                your program
              </h5>
              <p>
                You can see which function the process is stopped in, explore variables,
                and much more.
              </p>
              <p>
                There is more to discover, but this should be enough to get you started.
              </p>
              <p>
                Something missing? Found a bug?{" "}
                <a href="https://github.com/cs01/gdbgui/issues/">Create an issue</a> on
                github.
              </p>

              <p>Happy debugging!</p>
            </div>
          }
          step_num={5}
        />

        {/* @ts-expect-error ts-migrate(2322) FIXME: Property 'title' does not exist on type 'Intrinsic... Remove this comment to see the full error message */}
        <Collapser title="threads" content={<Threads />} />

        {/* @ts-expect-error ts-migrate(2322) FIXME: Property 'title' does not exist on type 'Intrinsic... Remove this comment to see the full error message */}
        <Collapser id="locals" title="local variables" content={<Locals />} />
        {/* @ts-expect-error ts-migrate(2322) FIXME: Property 'title' does not exist on type 'Intrinsic... Remove this comment to see the full error message */}
        <Collapser id="expressions" title="expressions" content={<Expressions />} />
        <Collapser
          // @ts-expect-error ts-migrate(2322) FIXME: Property 'title' does not exist on type 'Intrinsic... Remove this comment to see the full error message
          title="Tree"
          content={
            <div>
              <input
                id="tree_width"
                className="form-control"
                placeholder="width (px)"
                style={input_style}
              />
              <input
                id="tree_height"
                className="form-control"
                placeholder="height (px)"
                style={input_style}
              />
              <div id={constants.tree_component_id} />
            </div>
          }
        />
        {/* @ts-expect-error ts-migrate(2322) FIXME: Property 'title' does not exist on type 'Intrinsic... Remove this comment to see the full error message */}
        <Collapser id="memory" title="memory" content={<Memory />} />
        {/* @ts-expect-error ts-migrate(2322) FIXME: Property 'title' does not exist on type 'Intrinsic... Remove this comment to see the full error message */}
        <Collapser title="breakpoints" content={<Breakpoints />} />
        <Collapser
          // @ts-expect-error ts-migrate(2322) FIXME: Property 'title' does not exist on type 'Intrinsic... Remove this comment to see the full error message
          title="signals"
          // @ts-expect-error ts-migrate(2322) FIXME: Property 'signals' does not exist on type 'Intrins... Remove this comment to see the full error message
          content={<InferiorProgramInfo signals={this.props.signals} />}
        />
        {/* @ts-expect-error ts-migrate(2322) FIXME: Property 'title' does not exist on type 'Intrinsic... Remove this comment to see the full error message */}
        <Collapser title="registers" collapsed={true} content={<Registers />} />

        {mi_output}
      </div>
    );
  }
  componentDidMount() {
    Tree.init();
  }
}
export default RightSidebar;
