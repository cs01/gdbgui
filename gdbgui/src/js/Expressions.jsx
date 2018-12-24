import React from "react";
import { store } from "statorgfc";
import GdbVariable from "./GdbVariable.jsx";
import constants from "./constants.js";

class Expressions extends React.Component {
  constructor() {
    super();
    store.connectComponentState(this, ["expressions"]);
  }

  render() {
    let sorted_expression_objs = _.sortBy(
      store.get("expressions"),
      unsorted_obj => unsorted_obj.expression
    );
    // only render variables in scope that were not created for the Locals component
    this.objs_to_render = sorted_expression_objs.filter(
      obj => obj.in_scope === "true" && obj.expr_type === "expr"
    );
    this.objs_to_delete = sorted_expression_objs.filter(
      obj => obj.in_scope === "invalid"
    );

    // delete invalid objects
    this.objs_to_delete.map(obj => GdbVariable.delete_gdb_variable(obj.name));

    let content = this.objs_to_render.map(obj => (
      <GdbVariable
        obj={obj}
        key={obj.expression}
        expression={obj.expression}
        expr_type="expr"
      />
    ));
    if (content.length === 0) {
      content.push(
        <span key="empty"
              className="small text-info">
          No expressions
        </span>
      );
    }
    content.push(
      <div key="tt" id="plot_coordinate_tooltip" style={{ display: "hidden" }} />
    );

    return (
      <React.Fragment>
        <ul className="nav my-1 px-1">
          <li className="nav-item">
            <div className='input-group input-group-sm'>
              <div className='input-group-prepend'>
                <button className='btn btn-success'>
                  Create
                </button>
              </div>
              <input
                className="form-control"
                placeholder='variable or expression'
                onKeyUp={Expressions.keydown_on_input}
              />
            </div>
          </li>
        </ul>
        <div className="card card-body">
          {content}
        </div>
      </React.Fragment>
    );
  }
  componentDidUpdate() {
    for (let obj of this.objs_to_render) {
      GdbVariable.plot_var_and_children(obj);
    }
  }

  static keydown_on_input(e) {
    if (e.keyCode === constants.ENTER_BUTTON_NUM) {
      let expr = e.currentTarget.value,
        trimmed_expr = _.trim(expr);

      if (trimmed_expr !== "") {
        GdbVariable.create_variable(trimmed_expr, "expr");
      }
    }
  }
}

export default Expressions;
