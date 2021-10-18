/**
 * A component to render "local" variables, as well as a few static methods to
 * assist in their creation and deletion.
 */

import React from "react";
import { store, useGlobalValue } from "./Store";
import { ExpressionClass, Expression } from "./Expression";
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
function LocalVariable(props: { local: GdbguiLocalVariable }) {
  const local = props.local;
  const can_be_expanded = local.can_be_expanded;

  const value = _.isString(local.value) ? Memory.textToLinks(local.value) : local.value;

  return (
    <div
      className={`flex w-full whitespace-nowrap overflow-x-hidden items-center text-xs font-mono ${
        can_be_expanded ? "cursor-pointer" : ""
      } `}
      onClick={() => {
        if (can_be_expanded) {
          ExpressionClass.createExpression(local.name, "local");
        }
      }}
    >
      <div className="w-4">
        {can_be_expanded ? (
          <button>
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

export function Locals() {
  const expressions = useGlobalValue<typeof store.data.expressions>("expressions");
  const locals = useGlobalValue<typeof store.data.locals>("locals");
  const sortedLocals = locals.sort((a: GdbguiLocalVariable, b: GdbguiLocalVariable) => {
    return a.name.localeCompare(b.name);
  });

  return (
    <div>
      {sortedLocals.map((local) => {
        const expressionObject = LocalsClass.getAutoCreatedObjFromExpr(
          expressions,
          local.name
        );
        return expressionObject == null ? (
          <LocalVariable local={local} key={local.name} />
        ) : (
          <Expression
            obj={expressionObject}
            key={expressionObject.name}
            expr_type="local"
          />
        );
      })}
    </div>
  );
}

export class LocalsClass extends React.Component {
  static getAutoCreatedObjFromExpr(
    expressions: typeof store.data.expressions,
    localName: string
  ) {
    for (const obj of expressions) {
      if (obj.exp === localName && obj.expr_type === "local") {
        return obj;
      }
    }
    return null;
  }
  static clearAutocreatedExpressions() {
    store.data.expressions
      .filter((expression) => expression.expr_type === "local")
      .forEach((expression) => ExpressionClass.deleteGdbVariable(expression.name));
  }
  static clear() {
    store.set<typeof store.data.locals>("locals", []);
    LocalsClass.clearAutocreatedExpressions();
  }
  static saveLocals(locals: Array<GdbLocalVariable>) {
    store.set<typeof store.data.locals>(
      "locals",
      locals.map((local) => ({
        ...local,
        value: local.value ?? "{...}",
        can_be_expanded: LocalsClass.canLocalBeExpanded(local),
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
