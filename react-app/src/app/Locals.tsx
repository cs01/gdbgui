/**
 * A component to render "local" variables, as well as a few static methods to
 * assist in their creation and deletion.
 */

import React from "react";
import { store, useGlobalValue } from "./Store";
import { ExpressionClass, Expression } from "./Expression";
import { GdbguiExpressionVar, GdbguiLocalVariable, GdbLocalVariable } from "./types";
import MemoryClass from "./Memory";
import _ from "lodash";
import { ChevronRightIcon } from "@heroicons/react/solid";

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
          <Expression obj={local} key={local.name} expr_type="local" />
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
        expr_type: "simplelocal",
        in_scope: true,
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
