import React from "react";
import { store } from "statorgfc";
import GdbVariable from "./GdbVariable";
import constants from "./constants";

class Expressions extends React.Component {
  objs_to_delete: any;
  objs_to_render: any;
  constructor() {
    // @ts-expect-error ts-migrate(2554) FIXME: Expected 1-2 arguments, but got 0.
    super();
    // @ts-expect-error ts-migrate(2339) FIXME: Property 'connectComponentState' does not exist on... Remove this comment to see the full error message
    store.connectComponentState(this, ["expressions"]);
  }

  render() {
    // @ts-expect-error ts-migrate(2304) FIXME: Cannot find name '_'.
    let sorted_expression_objs = _.sortBy(
      store.get("expressions"),
      (unsorted_obj: any) => unsorted_obj.expression
    );
    // only render variables in scope that were not created for the Locals component
    this.objs_to_render = sorted_expression_objs.filter(
      (obj: any) => obj.in_scope === "true" && obj.expr_type === "expr"
    );
    this.objs_to_delete = sorted_expression_objs.filter(
      (obj: any) => obj.in_scope === "invalid"
    );

    // delete invalid objects
    this.objs_to_delete.map((obj: any) => GdbVariable.delete_gdb_variable(obj.name));

    let content = this.objs_to_render.map((obj: any) => (
      <GdbVariable
        // @ts-expect-error ts-migrate(2769) FIXME: Property 'obj' does not exist on type 'IntrinsicAt... Remove this comment to see the full error message
        obj={obj}
        key={obj.expression}
        expression={obj.expression}
        expr_type="expr"
      />
    ));
    if (content.length === 0) {
      content.push(
        <span key="empty" className="placeholder">
          no expressions in this context
        </span>
      );
    }
    content.push(
      <div key="tt" id="plot_coordinate_tooltip" style={{ display: "hidden" }} />
    );

    return (
      <div>
        <input
          id="expressions_input"
          className="form-control"
          placeholder="expression or variable"
          style={{
            display: "inline",
            padding: "6px 6px",
            height: "25px",
            fontSize: "1em",
            marginTop: "5px"
          }}
          onKeyUp={Expressions.keydown_on_input}
        />

        <p />

        {content}
      </div>
    );
  }
  componentDidUpdate() {
    for (let obj of this.objs_to_render) {
      GdbVariable.plot_var_and_children(obj);
    }
  }

  static keydown_on_input(e: any) {
    if (e.keyCode === constants.ENTER_BUTTON_NUM) {
      let expr = e.currentTarget.value,
        // @ts-expect-error ts-migrate(2304) FIXME: Cannot find name '_'.
        trimmed_expr = _.trim(expr);

      if (trimmed_expr !== "") {
        GdbVariable.create_variable(trimmed_expr, "expr");
      }
    }
  }
}

export default Expressions;
