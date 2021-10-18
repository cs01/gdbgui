/**
 * A component to show/hide variable exploration when hovering over a variable
 * in the source code
 */

import React from "react";
import { store } from "./Store";
import constants from "./constants";
import { ExpressionClass, Expression } from "./Expression";
import $ from "jquery";
class HoverVar extends React.Component {
  static enter_timeout = undefined; // debounce fetching the expression
  static exit_timeout = undefined; // debounce removing the box
  static left = 0;
  static top = 0;

  obj: any;

  constructor() {
    // @ts-expect-error ts-migrate(2554) FIXME: Expected 1-2 arguments, but got 0.
    super();

    // when hovering over a potential variable
    $("body").on("mouseover", "#code_table span.n", HoverVar.mouseover_variable);
    $("body").on("mouseleave", "#code_table span.n", HoverVar.mouseout_variable);

    $("body").on("mouseover", "#code_table span.nx", HoverVar.mouseover_variable);
    $("body").on("mouseleave", "#code_table span.nx", HoverVar.mouseout_variable);

    // when hovering over the hover var "tooltip"-like window
    $("body").on("mouseenter", "#hovervar", HoverVar.mouseover_hover_window);
    $("body").on("mouseleave", "#hovervar", HoverVar.mouseout_hover_window);

    store.reactComponentState(this, ["expressions"]);
  }
  render() {
    const hover_objs = store.data.expressions.filter((o: any) => o.expr_type === "hover");
    let obj;
    if (Array.isArray(hover_objs) && hover_objs.length === 1) {
      obj = hover_objs[0];
    }
    this.obj = obj;
    if (obj) {
      const style = {
        position: "absolute",
        left: HoverVar.left + "px",
        top: HoverVar.top + "px",
        backgroundColor: "white",
      };
      return (
        // @ts-expect-error ts-migrate(2322) FIXME: Type 'string' is not assignable to type '"absolute... Remove this comment to see the full error message
        <div style={style} id="hovervar">
          <Expression obj={obj} key={obj.name} expr_type="hover" />
        </div>
      );
    } else {
      return <div className="hidden">no variable hovered</div>;
    }
  }
  static mouseover_variable(e: any) {
    HoverVar.clear_hover_state();

    const rect = e.target.getBoundingClientRect();
    const varName = e.target.textContent;

    // store coordinates of where the box should be displayed
    HoverVar.left = rect.left;
    HoverVar.top = rect.bottom;

    const WAIT_TIME_SEC = 0.5;
    // @ts-expect-error ts-migrate(2322) FIXME: Type 'Timeout' is not assignable to type 'undefine... Remove this comment to see the full error message
    HoverVar.enter_timeout = setTimeout(() => {
      if (store.data.gdbguiState === "stopped") {
        const ignore_errors = true;
        // @ts-expect-error ts-migrate(2554) FIXME: Expected 2 arguments, but got 3.
        ExpressionClass.createExpression(varName, "hover", ignore_errors);
      }
    }, WAIT_TIME_SEC * 1000);
  }
  static mouseout_variable(e: any) {
    void e;
    const WAIT_TIME_SEC = 0.1;
    // @ts-expect-error ts-migrate(2322) FIXME: Type 'Timeout' is not assignable to type 'undefine... Remove this comment to see the full error message
    HoverVar.exit_timeout = setTimeout(() => {
      HoverVar.clear_hover_state();
    }, WAIT_TIME_SEC * 1000);
  }
  static mouseover_hover_window(e: any) {
    void e;
    // Mouse went from hovering over variable name in source code to
    // hovering over the window showing the contents of the variable.
    // Don't remove the window in this case.
    clearTimeout(HoverVar.exit_timeout);
  }
  static mouseout_hover_window(e: any) {
    void e;
    HoverVar.clear_hover_state();
  }
  static clear_hover_state() {
    clearTimeout(HoverVar.enter_timeout);
    clearTimeout(HoverVar.exit_timeout);
    const exprs_objs_to_remove = store.data.expressions.filter(
      (obj: any) => obj.expr_type === "hover"
    );
    exprs_objs_to_remove.map((obj: any) => ExpressionClass.deleteGdbVariable(obj.name));
  }
}

export default HoverVar;
