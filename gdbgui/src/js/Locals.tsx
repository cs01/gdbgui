/**
 * A component to render "local" variables, as well as a few static methods to
 * assist in their creation and deletion.
 */

import React from "react";
import { store } from "statorgfc";
import GdbVariable from "./GdbVariable";

class Locals extends React.Component {
  constructor() {
    // @ts-expect-error ts-migrate(2554) FIXME: Expected 1-2 arguments, but got 0.
    super();
    // @ts-expect-error ts-migrate(2339) FIXME: Property 'connectComponentState' does not exist on... Remove this comment to see the full error message
    store.connectComponentState(this, ["expressions", "locals"]);
  }
  render() {
    let content = [];
    // @ts-expect-error ts-migrate(2304) FIXME: Cannot find name '_'.
    let sorted_local_objs = _.sortBy(
      store.get("locals"),
      (unsorted_obj: any) => unsorted_obj.name
    );

    for (let local of sorted_local_objs) {
      let obj = this.get_autocreated_obj_from_expr(local.name);
      if (obj) {
        content.push(
          <GdbVariable
            // @ts-expect-error ts-migrate(2769) FIXME: Property 'obj' does not exist on type 'IntrinsicAt... Remove this comment to see the full error message
            obj={obj}
            key={obj.expression}
            expression={obj.expression}
            expr_type="expr"
          />
        );
      } else {
        content.push(
          <GdbVariable
            // @ts-expect-error ts-migrate(2769) FIXME: Property 'obj' does not exist on type 'IntrinsicAt... Remove this comment to see the full error message
            obj={local}
            key={local.name}
            expression={local.name}
            expr_type="local"
          />
        );
      }
    }

    if (content.length === 0) {
      return (
        <span key="empty" className="placeholder">
          no locals in this context
        </span>
      );
    } else {
      return content;
    }
  }
  get_autocreated_obj_from_expr(expr: any) {
    for (let obj of store.get("expressions")) {
      if (obj.expression === expr && obj.expr_type === "local") {
        return obj;
      }
    }
    return null;
  }
  static clear_autocreated_exprs() {
    let exprs_objs_to_remove = store
      .get("expressions")
      .filter((obj: any) => obj.expr_type === "local");
    exprs_objs_to_remove.map((obj: any) => GdbVariable.delete_gdb_variable(obj.name));
  }
  static clear() {
    store.set("locals", []);
    Locals.clear_autocreated_exprs();
  }
  static save_locals(locals: any) {
    let locals_with_meta = locals.map((local: any) => {
      // add field to local
      local.can_be_expanded = Locals.can_local_be_expanded(local) ? true : false;
      return local;
    });
    store.set("locals", locals_with_meta);
  }
  static can_local_be_expanded(local: any) {
    // gdb returns list of locals. We may want to turn that local into a GdbVariable
    // to explore its children
    if ("value" in local) {
      // local has a value associated with it. It's either a native
      // type or a pointer. It's not a complex type like a struct.
      if (local.type.indexOf("*") !== -1) {
        // make plus if value is a pointer (has asterisk)
        // and can therefore be evaluated further by gdb
        return true;
      } else {
        return false;
      }
    } else {
      // is a struct or object that can be evaluated further by gdb
      return true;
    }
  }
}

export default Locals;
