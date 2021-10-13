/**
 * A component to render "local" variables, as well as a few static methods to
 * assist in their creation and deletion.
 */

import _ from "lodash";
import React from "react";
import { store } from "./Store";
import GdbVariable from "./GdbVariable";

class Locals extends React.Component {
  constructor() {
    // @ts-expect-error ts-migrate(2554) FIXME: Expected 1-2 arguments, but got 0.
    super();
    store.reactComponentState(this, ["expressions", "locals"]);
  }
  render() {
    const content = [];
    const sorted_local_objs = _.sortBy(
      store.data.locals,
      (unsorted_obj: any) => unsorted_obj.name
    );

    for (const local of sorted_local_objs) {
      const obj = this.get_autocreated_obj_from_expr(local.name);
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
      return null;
    } else {
      return content;
    }
  }
  get_autocreated_obj_from_expr(expr: any) {
    for (const obj of store.data.expressions) {
      if (obj.expression === expr && obj.expr_type === "local") {
        return obj;
      }
    }
    return null;
  }
  static clear_autocreated_exprs() {
    const exprs_objs_to_remove = store.data.expressions.filter(
      (obj: any) => obj.expr_type === "local"
    );
    exprs_objs_to_remove.map((obj: any) => GdbVariable.delete_gdb_variable(obj.name));
  }
  static clear() {
    store.set<typeof store.data.locals>("locals", []);
    Locals.clear_autocreated_exprs();
  }
  static save_locals(locals: any) {
    const locals_with_meta = locals.map((local: any) => {
      // add field to local
      local.can_be_expanded = Locals.can_local_be_expanded(local) ? true : false;
      return local;
    });
    store.set<typeof store.data.locals>("locals", locals_with_meta);
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