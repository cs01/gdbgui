import React from "react";
import { store } from "./Store";
import { ExpressionClass, Expression } from "./Expression";
import constants from "./constants";
import _ from "lodash";

class Expressions extends React.Component {
  objsToDelete: any;
  objsToRender: any;
  constructor() {
    // @ts-expect-error ts-migrate(2554) FIXME: Expected 1-2 arguments, but got 0.
    super();
    store.reactComponentState(this, ["expressions"]);
  }

  render() {
    const sortedExpressionObjs = _.sortBy(
      store.data.expressions,
      (unsortedObj: any) => unsortedObj.expression
    );
    // only render variables in scope that were not created for the Locals component
    this.objsToRender = sortedExpressionObjs.filter(
      (obj: any) => obj.in_scope === "true" && obj.expr_type === "expr"
    );
    this.objsToDelete = sortedExpressionObjs.filter(
      (obj: any) => obj.in_scope === "invalid"
    );

    // delete invalid objects
    this.objsToDelete.map((obj: any) => ExpressionClass.deleteGdbVariable(obj.name));

    const content = this.objsToRender.map((obj: any) => (
      <Expression obj={obj} key={obj.name} expr_type="expr" />
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
            marginTop: "5px",
          }}
          onKeyUp={Expressions.keydownOnInput}
        />

        <p />

        {content}
      </div>
    );
  }
  componentDidUpdate() {
    for (const obj of this.objsToRender) {
      ExpressionClass.plot_var_and_children(obj);
    }
  }

  static keydownOnInput(e: any) {
    if (e.keyCode === constants.ENTER_BUTTON_NUM) {
      const expr = e.currentTarget.value;
      const trimmedExpr = _.trim(expr);

      if (trimmedExpr !== "") {
        ExpressionClass.createExpression(trimmedExpr, "expr");
      }
    }
  }
}

export default Expressions;
