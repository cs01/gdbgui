/**
 * A component to render "local" variables, as well as a few static methods to
 * assist in their creation and deletion.
 */

import React from "react";
import { store } from "./Store";
import Expression from "./Expression";
import { GdbguiLocalVariable, GdbLocalVariable } from "./types";
import Memory from "./Memory";
import _ from "lodash";
import { ChevronRightIcon } from "@heroicons/react/solid";

/**
 * get unordered list for a "local" returned by gdb
 * these are special snowflakes; gdb returns a small subset of information for
 * locals. The list is useful to browse, but oftentimes needs to be expanded.
 * If the user clicks on a local that can be expanded, gdbgui will ask gdb
 * to create a full-fledged expression for the user to explore. gdbgui will then
 * render that instead of the "local".
 */
function LocalFn(props: { local: GdbguiLocalVariable }) {
  const local = props.local;
  const can_be_expanded = local.can_be_expanded;

  const value = _.isString(local.value)
    ? Memory.make_addrs_into_links_react(local.value)
    : local.value;

  return (
    <div className="flex w-full overflow-x-hidden items-center text-xs font-mono ">
      <div className="w-4">
        {can_be_expanded ? (
          <button
            onClick={() => {
              Expression.create_variable(local.name, "local");
            }}
          >
            <ChevronRightIcon className="icon" />
          </button>
        ) : null}
      </div>
      <div className="text-purple-400 mr-2">{local.name}:</div>
      <div className="mr-2">{value === "" ? "{...}" : value}</div>
      <div className="flex-grow" />
      <div className="text-gray-400 italic">{local.type.trim()}</div>
    </div>
  );
}

class Locals extends React.Component {
  constructor() {
    // @ts-expect-error ts-migrate(2554) FIXME: Expected 1-2 arguments, but got 0.
    super();
    store.reactComponentState(this, ["expressions", "locals"]);
  }
  render() {
    const sortedLocals = store.data.locals.sort(
      (a: GdbguiLocalVariable, b: GdbguiLocalVariable) => {
        return a.name.localeCompare(b.name);
      }
    );

    return sortedLocals.map((local) => {
      const expressionObject = this.getAutoCreatedObjFromExpr(local.name);
      return expressionObject == null ? (
        <LocalFn local={local} key={local.name} />
      ) : (
        <Expression
          // @ts-expect-error ts-migrate(2769) FIXME: Property 'obj' does not exist on type 'IntrinsicAt... Remove this comment to see the full error message
          obj={expressionObject}
          key={expressionObject.expression}
          expression={expressionObject.expression}
          expr_type="expr"
        />
      );
    });
  }
  getAutoCreatedObjFromExpr(localName: string) {
    for (const obj of store.data.expressions) {
      if (obj.expression === localName && obj.expr_type === "local") {
        return obj;
      }
    }
    return null;
  }
  static clearAutocreatedExprs() {
    const exprs_objs_to_remove = store.data.expressions.filter(
      (obj: any) => obj.expr_type === "local"
    );
    exprs_objs_to_remove.map((obj: any) => Expression.delete_gdb_variable(obj.name));
  }
  static clear() {
    store.set<typeof store.data.locals>("locals", []);
    Locals.clearAutocreatedExprs();
  }
  static saveLocals(locals: Array<GdbLocalVariable>) {
    store.set<typeof store.data.locals>(
      "locals",
      locals.map((local) => ({
        ...local,
        can_be_expanded: Locals.canLocalBeExpanded(local),
      }))
    );
  }
  static canLocalBeExpanded(local: GdbLocalVariable): boolean {
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
