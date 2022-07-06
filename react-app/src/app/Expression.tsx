/**
 * A component to render gdb user variables, and
 * some library functions to interact with gdb. The library
 * functions create gdb variable objects locally, update them,
 * remove them, etc.
 */
import React, { useState } from "react";
import MemoryClass from "./Memory";
import constants from "./constants";
import { store } from "./Store";
import GdbApi from "./GdbApi";
import CopyToClipboard from "./CopyToClipboard";
import Handlers from "./EventHandlers";
import _ from "lodash";
import {
  GdbguiExpressionVar,
  GdbChildExpression,
  GdbMiChildrenVarResponse,
  GdbguiExpressionType,
  GdbguiLocalVariable,
} from "./types";
import {
  ChevronDownIcon,
  ChevronRightIcon,
  EyeIcon,
  PlusSmIcon,
  RefreshIcon,
  XIcon,
} from "@heroicons/react/solid";

/**
 * Simple class to manage fetching of child variables. Maintains a queue of parent expressions
 * to fetch children for, and fetches them in serial.
 */
class ChildVarFetcher {
  private queue: Array<{
    parentGdbExpression: string;
    expressionType: string;
  }> = [];

  private isFetching: boolean = false;
  public gdbParentExprCurrentlyFetchingChildren: Nullable<string> = null;

  private fetchNextInQueue() {
    if (this.isFetching) {
      return;
    }
    const obj = this.queue.shift();
    if (!obj) {
      this.gdbParentExprCurrentlyFetchingChildren = null;
      return;
    }
    this.gdbParentExprCurrentlyFetchingChildren = obj.parentGdbExpression;
    this.isFetching = true;
    GdbApi.runGdbCommand(`-var-list-children --all-values "${obj.parentGdbExpression}"`);
  }
  public fetchChildren(parentGdbExpressionName: string, expressionType: string) {
    this.queue.push({
      parentGdbExpression: parentGdbExpressionName,
      expressionType: expressionType,
    });
    this.fetchNextInQueue();
  }

  public fetchComplete() {
    this.isFetching = false;
    this.gdbParentExprCurrentlyFetchingChildren = null;
    this.fetchNextInQueue();
  }
}
const childVarFetcher = new ChildVarFetcher();

/**
 * Simple object to manage fetching of variables. Maintains a queue of expressions
 * to fetch, and fetches them in serial.
 */
const VarCreator = {
  _queue: [], // list of objs with keys expr_being_created, expr_type
  _is_fetching: false,
  expressionBeingCreated: null,
  expr_type: null,

  _fetch_next_in_queue: function () {
    if (VarCreator._is_fetching) {
      return;
    }
    if (VarCreator._queue.length) {
      const obj = VarCreator._queue.shift();
      // @ts-expect-error ts-migrate(2532) FIXME: Object is possibly 'undefined'.
      let expression = obj.expression;
      // @ts-expect-error ts-migrate(2532) FIXME: Object is possibly 'undefined'.
      const expr_type = obj.expr_type;

      VarCreator._is_fetching = true;

      VarCreator.expressionBeingCreated = expression;
      VarCreator.expr_type = expr_type;

      // surround in quotes if we found a quote
      if (expression.length > 0 && expression.indexOf('"') !== 0) {
        expression = '"' + expression + '"';
      }
      const cmds = [];
      if (store.data.pretty_print) {
        cmds.push("-enable-pretty-printing");
      }

      // - means auto assign variable name in gdb
      // * means evaluate it at the current frame
      const var_create_cmd = constants.CREATE_VAR_STR + `-var-create - * ${expression}`;
      cmds.push(var_create_cmd);

      GdbApi.runGdbCommand(cmds);
    } else {
      VarCreator._clear_state();
    }
  },
  /**
   * Create a new variable in gdb. gdb automatically chooses and assigns
   * a unique variable name.
   */
  createExpression: function (expression: string, expr_type: GdbguiExpressionType) {
    // @ts-expect-error ts-migrate(2322) FIXME: Type 'any' is not assignable to type 'never'.
    VarCreator._queue.push({ expression: expression, expr_type: expr_type });
    VarCreator._fetch_next_in_queue();
  },
  /**
   * After a variable is created, we need to link the gdb
   * variable name (which is automatically created by gdb),
   * and the expression the user wanted to evaluate. The
   * new variable is saved locally. The variable UI element is then re-rendered
   * @param r (object): gdb mi object
   */
  onExpressionCreated(r: any) {
    const exp = VarCreator.expressionBeingCreated;
    if (exp) {
      // example payload:
      // "payload": {
      //      "has_more": "0",
      //      "name": "var2",
      //      "numchild": "0",
      //      "thread-id": "1",
      //      "type": "int",
      //      "value": "0"
      //  },
      ExpressionClass.saveNewExpression(exp, VarCreator.expr_type ?? "expr", r.payload);
      VarCreator.expressionBeingCreated = null;
      // automatically fetch first level of children for root variables
      ExpressionClass.fetchAndShowChildrenForVar(r.payload.name);
    } else {
      // gdbgui did not expect a new variable to be created here
      // it's likely this tab is viewing an instance of gdb that multiple users
      // are interacting with
    }
    VarCreator._fetch_complete();
  },
  fetch_failed(r: any) {
    if (VarCreator.expr_type === "hover") {
      // do nothing
    } else {
      Handlers.addGdbResponseToConsole(r);
    }
    VarCreator._fetch_complete();
  },
  _fetch_complete() {
    VarCreator._is_fetching = false;
    VarCreator._clear_state();
    VarCreator._fetch_next_in_queue();
  },
  _clear_state: function () {
    VarCreator._is_fetching = false;
  },
};

export function Expression(props: {
  obj: GdbguiExpressionVar | GdbguiLocalVariable;
  expr_type: GdbguiExpressionType;
  depth?: number;
}) {
  const { obj } = props;
  const isRoot = obj.expr_type === "simplelocal" ? true : obj.parent === null;
  const [expanded, setExpanded] = useState(
    obj.expr_type === "local" && isRoot ? true : false
  );

  const hasChildren =
    obj.expr_type === "simplelocal" ? obj.can_be_expanded : obj.numchild;
  const [editing, setEditing] = useState(false);
  const [editedValue, setEditedValue] = useState(obj.value);
  const depth = props?.depth ?? 0;
  const indentStyle = { marginLeft: depth * 10 + "px" };
  const childIndentStyle = { marginLeft: (depth + 1) * 10 + "px" };
  const getChevron = () => {
    return expanded ? (
      <button>
        <ChevronDownIcon className="icon" />
      </button>
    ) : (
      <button>
        <ChevronRightIcon className="icon" />
      </button>
    );
  };

  const getChildrenNodes = () => {
    if (obj.expr_type === "simplelocal") {
      return null;
    } else if (expanded) {
      if (obj.numchild > 0) {
        if (obj.children.length === 0) {
          return (
            <div className="text-xs" style={childIndentStyle}>
              <RefreshIcon className="icon animate-spin-slow" />
            </div>
          );
        } else {
          return obj.children.map((child) => (
            <Expression
              key={child.name}
              depth={depth + 1}
              obj={child}
              expr_type={props.expr_type}
            />
          ));
        }
      }
    }
    return null;
  };
  return (
    <div style={indentStyle}>
      <div
        className={`flex w-full whitespace-nowrap overflow-x-hidden items-center text-xs font-mono hover:bg-gray-900 ${
          hasChildren ? "cursor-pointer" : ""
        }`}
        onClick={() => {
          setExpanded(!expanded);
          if (obj.expr_type === "simplelocal") {
            if (obj.can_be_expanded) {
              ExpressionClass.createExpression(obj.name, "local");
            }
          } else {
            const childrenNeedToBeFetched = obj.numchild > 0 && obj.children.length === 0;
            if (childrenNeedToBeFetched) {
              ExpressionClass.fetchAndShowChildrenForVar(obj.name);
            }
          }
        }}
        onDoubleClick={(e) => {
          //double click === 2
          if (e.detail === 2) {
            setEditing(true);
          }
        }}
      >
        <div className="w-4 items-center">
          {hasChildren ? getChevron() : <div className="h-5" />}
        </div>
        <div className="text-purple-400 mr-2">
          {obj.expr_type === "simplelocal" ? obj.name : obj.exp}:
        </div>
        <div className="mr-2">
          {editing ? (
            <input
              className="input h-4 w-full grow"
              value={editedValue}
              autoFocus={true}
              placeholder="New value"
              onChange={(e) => {
                setEditedValue(e.target.value);
              }}
              onKeyUp={(e) => {
                if (e.code?.toLocaleLowerCase() === "enter") {
                  if (obj.expr_type === "simplelocal") {
                    GdbApi.runCommandAndRefreshState(
                      `-gdb-set ${obj.name}=${editedValue}`
                    );
                  } else {
                    GdbApi.runCommandAndRefreshState([
                      `-gdb-set ${fullyResolvedPath(obj)}=${editedValue}`,
                      `-var-update ${getRootParentGdbName(obj)}`,
                    ]);
                  }
                  setEditing(false);
                } else if (e.code?.toLocaleLowerCase() === "escape") {
                  setEditing(false);
                }
              }}
            />
          ) : (
            <div>{MemoryClass.textToLinks(obj.value)}</div>
          )}
        </div>
        <div className="flex-grow" />
        <div className="invisible hover:visible text-gray-400 italic">
          {obj.type.trim()}
        </div>
        {depth === 0 && props.expr_type === "expr" ? (
          <div
            className="text-gray-200"
            onClick={() => {
              ExpressionClass.deleteGdbVariable(obj.name);
            }}
          >
            <XIcon className="icon" />
          </div>
        ) : null}
      </div>
      {getChildrenNodes()}
    </div>
  );
}
function getRootParentGdbName(expression: GdbguiExpressionVar): string {
  if (expression.parent) {
    return getRootParentGdbName(expression.parent);
  }
  return expression.name;
}

function fullyResolvedPath(expression: GdbguiExpressionVar): string {
  if (expression.parent) {
    return `(${fullyResolvedPath(expression.parent)}).${expression.exp}`;
  }
  return expression.exp;
}
export class ExpressionClass {
  /**
   * get unordered list for a variable that has children
   * @return unordered list, expanded or collapsed based on the key "show_children_in_ui"
   */
  get_ul_for_var_with_children(
    expression: any,
    mi_obj: any,
    expr_type: any,
    is_root = false
  ) {
    let child_tree;
    if (mi_obj.show_children_in_ui) {
      const content = [];
      if (mi_obj.children.length > 0) {
        for (const child of mi_obj.children) {
          if (child.numchild > 0) {
            content.push(
              <li key={child.exp}>
                {this.get_ul_for_var_with_children(child.exp, child, expr_type)}
              </li>
            );
          } else {
            content.push(
              <li key={child.exp}>
                {this.get_ul_for_var_without_children(child.exp, child, expr_type)}
              </li>
            );
          }
        }
      }

      child_tree = <ul key={mi_obj.exp}>{content}</ul>;
    } else {
      child_tree = "";
    }

    const plus_or_minus = mi_obj.show_children_in_ui ? "-" : "+";
    return this._get_ul_for_var(
      expression,
      mi_obj,
      expr_type,
      is_root,
      plus_or_minus,
      // @ts-expect-error ts-migrate(2345) FIXME: Type 'Element' is not assignable to type 'string'.
      child_tree,
      mi_obj.numchild
    );
  }
  get_ul_for_var_without_children(
    expression: any,
    mi_obj: any,
    expr_type: any,
    is_root = false
  ) {
    return this._get_ul_for_var(expression, mi_obj, expr_type, is_root);
  }
  static _get_value_jsx(obj: any) {
    let val;
    if (obj.is_int) {
      val = (
        <div className="inline">
          <span className="gdbVarValue">
            {MemoryClass.textToLinks(obj._int_value_to_str_in_radix)}
            <button
              className="btn btn-default btn-xs btn-radix"
              onClick={() => {
                ExpressionClass.change_radix(obj);
              }}
              title="click to change radix"
              style={{ fontSize: "60%" }}
            >
              base {obj._radix}
            </button>
          </span>
        </div>
      );
    } else {
      val = _.isString(obj.value) ? MemoryClass.textToLinks(obj.value) : obj.value;
    }
    return val;
  }
  static change_radix(obj: any) {
    if (obj._radix === 16) {
      obj._radix = 2;
    } else {
      obj._radix += 2;
    }
    ExpressionClass._update_radix_values(obj);
    store.set<typeof store.data.expressions>("expressions", [...store.data.expressions]);
  }
  /**
   * Get ul for a variable with or without children
   */
  _get_ul_for_var(
    expression: any,
    mi_obj: any,
    expr_type: any,
    is_root: any,
    plus_or_minus = "",
    child_tree = "",
    numchild = 0
  ) {
    const glyph_style = { fontSize: "0.8em", paddingLeft: "5px" };
    const delete_button =
      is_root && expr_type === "expr" ? (
        <span
          style={glyph_style}
          className="glyphicon glyphicon-trash pointer"
          onClick={() => ExpressionClass.deleteGdbVariable(mi_obj.name)}
        />
      ) : (
        ""
      );
    const has_children = numchild > 0;
    const can_draw_tree = has_children && (expr_type === "expr" || expr_type === "local"); // hover var can't draw tree
    const tree = can_draw_tree ? (
      <span
        style={glyph_style}
        className="glyphicon glyphicon-tree-deciduous pointer"
        onClick={() => ExpressionClass.click_draw_tree_gdb_variable(mi_obj.name)}
      />
    ) : (
      ""
    );
    const toggle_classes = has_children ? "pointer" : "";
    let plot_content = "";
    let plot_button = "";
    const plusminusClickCallback = has_children
      ? () => ExpressionClass.click_toggle_children_visibility(mi_obj.name)
      : () => {};
    if (mi_obj.can_plot && mi_obj.show_plot) {
      // dots are not allowed in the dom as id's. replace with '-'.
      const id = mi_obj.dom_id_for_plot;
      // @ts-expect-error ts-migrate(2322) FIXME: Type 'Element' is not assignable to type 'string'.
      plot_button = (
        <span
          style={glyph_style}
          className="pointer glyphicon glyphicon-ban-circle"
          onClick={() => ExpressionClass.click_toggle_plot(mi_obj.name)}
          title="remove x/y plot"
        />
      );
      // @ts-expect-error ts-migrate(2322) FIXME: Type 'Element' is not assignable to type 'string'.
      plot_content = <div id={id} className="plot" />;
    } else if (mi_obj.can_plot && !mi_obj.show_plot) {
      // @ts-expect-error ts-migrate(2322) FIXME: Type 'Element' is not assignable to type 'string'.
      plot_button = (
        <span
          style={glyph_style}
          className="glyphicon glyphicon glyphicon-equalizer pointer"
          onClick={() => ExpressionClass.click_toggle_plot(mi_obj.name)}
          title="show x/y plot"
        />
      );
    }

    return (
      <ul key={expression} className="varUL">
        <li className="varLI">
          <span className={toggle_classes} onClick={plusminusClickCallback}>
            {plus_or_minus} {expression}&nbsp;
          </span>

          {ExpressionClass._get_value_jsx(mi_obj)}

          <span className="var_type">{_.trim(mi_obj.type) || ""}</span>

          <div className="right_help_icon_show_on_hover">
            <CopyToClipboard content={ExpressionClass._get_full_path(mi_obj)} />:{tree}
            {plot_button}
            {delete_button}
          </div>

          {plot_content}
        </li>
        {child_tree}
      </ul>
    );
  }
  static _get_full_path(obj: any) {
    if (!obj) {
      return "";
    }

    function update_path(path: any, obj: any) {
      const potential_addition = obj.expression || obj.exp;
      if (
        potential_addition === "public" ||
        potential_addition === "private" ||
        potential_addition === "protected"
      ) {
        // these are inserted by gdb, and arent actually field names!
        return path;
      } else if (path) {
        return potential_addition + "." + path;
      } else {
        return potential_addition;
      }
    }

    let path = update_path("", obj);
    let cur_obj = obj.parent;
    let depth = 0;
    while (cur_obj) {
      path = update_path(path, cur_obj);
      cur_obj = cur_obj.parent;

      depth += 1;
      if (depth > 100) {
        console.warn("exceeded maximum depth, breaking while loop");
        break;
      }
    }
    return path;
  }
  static createExpression(expression: string, exprType: GdbguiExpressionType) {
    VarCreator.createExpression(expression, exprType);
  }
  static createdRootExpression(r: any) {
    VarCreator.onExpressionCreated(r);
  }
  static gdb_variable_fetch_failed(r: any) {
    VarCreator.fetch_failed(r);
  }
  /**
   * Got data regarding children of a gdb variable. It could be an immediate child, or grandchild, etc.
   * This method stores this child array data to the appropriate locally stored
   * object
   * @param r (object): gdb mi object
   */
  static gdb_created_children_variables(response: GdbMiChildrenVarResponse) {
    const parentGdbName = childVarFetcher.gdbParentExprCurrentlyFetchingChildren;
    childVarFetcher.fetchComplete();
    if (!parentGdbName) {
      return;
    }

    // get the parent object of these children
    const expressions = store.data.expressions;
    const parent = ExpressionClass.getObjectFromGdbVarName(expressions, parentGdbName);
    if (parent) {
      // prepare all the child objects we received for local storage
      const gdbguiChildren = response.children.map((child) =>
        ExpressionClass.gdbExpressionToGdbguiExpression(
          child,
          parent,
          VarCreator.expr_type
        )
      );
      // save these children as a field to their parent
      parent.children = gdbguiChildren;
      parent.numchild = gdbguiChildren.length;
      store.set<typeof store.data.expressions>("expressions", [...expressions]);

      // if this field is an anonymous struct, the user will want to
      // see this expanded by default
      for (const child of parent.children) {
        if (child.exp.includes("<anonymous")) {
          ExpressionClass.fetchAndShowChildrenForVar(child.name);
        }
      }
    } else {
      // gdbgui did not expect this.
      // another browser tab interacting w/ the same gdb instance likely created this
    }
  }
  /**
   * gdb returns objects for its variables,, but before we save that
   * data locally, we will add more fields to make it more useful for gdbgui
   * @param child (object): mi object returned from gdb
   * @param expr_type "local" | "expr" | "hover"
   */
  static gdbExpressionToGdbguiExpression(
    child: GdbChildExpression,
    parent: Nullable<GdbguiExpressionVar>,
    expr_type: Nullable<GdbguiExpressionType>,
    exp?: Nullable<string>
  ): GdbguiExpressionVar {
    return {
      ...child,
      parent,
      numchild: parseInt(child.numchild),
      has_more: parseInt(child.has_more),
      show_children_in_ui: false,
      children: [],
      can_plot: false,
      show_plot: false,
      // expression: "",
      // do we need this?
      // new_obj.children = []; // actual child objects are fetched dynamically when the user requests them

      // this field is not returned when the variable is created, but
      // it is returned when the variables are updated
      // it is returned by gdb mi as a string, and we assume it starts out in scope
      in_scope: true,
      is_int: false,
      is_numeric: false,
      values: [],
      // TODO ensure this isn't null
      expr_type: expr_type ?? "expr",
      // root objects don't have this field
      // child objects do. This is the human readable variable name.
      exp: exp ?? child.exp,
    };

    // new_obj.expr_type = VarCreator.expr_type;

    // Expression._update_numeric_properties(new_obj);

    // new_obj.dom_id_for_plot = new_obj.name
    //   .replace(/\./g, "-") // replace '.' with '-'
    //   .replace(/\$/g, "_") // replace '$' with '-'
    //   .replace(/\[/g, "_") // replace '[' with '_'
    //   .replace(/\]/g, "_"); // replace ']' with '_'
    // new_obj.show_plot = false; // used when rendering to decide whether to show plot or not
    // push to this array each time a new value is assigned if value is numeric.
    // Plots use this data
    // if (new_obj.value.indexOf("0x") === 0) {
    //   new_obj.values = [parseInt(new_obj.value, 16)];
    //   new_obj._radix = 16;
    // } else if (!window.isNaN(parseFloat(new_obj.value))) {
    //   new_obj.values = [parseFloat(new_obj.value)];
    //   if (new_obj.is_int) {
    //     new_obj._radix = 10;
    //   } else {
    //     new_obj._radix = 0;
    //   }
    // } else {
    //   new_obj.values = [];
    //   new_obj._radix = 0;
    // }
    // Expression._update_radix_values(new_obj); // mutates new_obj
    // return new_obj;
  }
  static _update_numeric_properties(obj: any) {
    let value = obj.value;
    if (obj.value.startsWith("0x")) {
      value = parseInt(obj.value, 16);
    }
    obj._float_value = parseFloat(value);
    obj.is_numeric = !window.isNaN(obj._float_value);
    obj.can_plot = obj.is_numeric && obj.expr_type === "expr";
    obj.is_int = obj.is_numeric ? obj._float_value % 1 === 0 : false;
  }
  static _update_radix_values(obj: any) {
    if (obj.is_int) {
      obj._int_value_decimal = parseInt(obj.value);
      if (obj._radix < 2 || obj._radix > 36) {
        // defensive programming
        console.warn("Got invalid radix. Setting to 10.");
        obj._radix = 10;
      }
      obj._int_value_to_str_in_radix = obj._int_value_decimal.toString(obj._radix);
      if (obj._radix === 16) {
        obj._int_value_to_str_in_radix = "0x" + obj._int_value_to_str_in_radix;
      }
    }
  }
  /**
   * function render a plot on an existing element
   * @param obj: object to make a plot for
   */
  static _make_plot(obj: any) {
    const id = "#" + obj.dom_id_for_plot; // this div should have been created already
    const jq = $(id);
    const data = [];
    let i = 0;

    // collect data
    for (const val of obj.values) {
      data.push([i, val]);
      i++;
    }

    // make the plot
    // @ts-expect-error ts-migrate(2339) FIXME: Property 'plot' does not exist on type 'JQueryStat... Remove this comment to see the full error message
    $.plot(
      jq,
      [
        {
          data: data,
          shadowSize: 0,
          color: "#33cdff",
        },
      ],
      {
        series: {
          lines: { show: true },
          points: { show: true },
        },
        grid: { hoverable: true, clickable: false },
      }
    );

    // add hover event to show tooltip
    jq.bind("plothover", function (event, pos, item) {
      if (item) {
        const x = item.datapoint[0];
        const y = item.datapoint[1];

        $("#plot_coordinate_tooltip")
          .html(`(${x}, ${y})`)
          .css({ top: item.pageY + 5, left: item.pageX + 5 })
          .show();
      } else {
        $("#plot_coordinate_tooltip").hide();
      }
    });
  }
  /**
   * look through all expression objects and see if they are supposed to show their plot.
   * If so, update the dom accordingly
   * @param obj: expression object to plot (may have children to plot too)
   */
  static plot_var_and_children(obj: any) {
    if (obj.show_plot) {
      ExpressionClass._make_plot(obj);
    }
    for (const child of obj.children) {
      ExpressionClass.plot_var_and_children(child);
    }
  }
  static fetchAndShowChildrenForVar(gdbVarName: string) {
    const expressions = store.data.expressions;
    const obj = ExpressionClass.getObjectFromGdbVarName(expressions, gdbVarName);
    if (!obj) {
      return;
    }
    // mutate object by reference
    obj.show_children_in_ui = true;
    // update store
    store.set<typeof store.data.expressions>("expressions", [...expressions]);
    if (obj.numchild && obj.children.length === 0) {
      // need to fetch child data
      childVarFetcher.fetchChildren(gdbVarName, obj.expr_type);
    } else {
      // already have child data, re-render will occur from event dispatch
    }
  }
  static hide_children_in_ui(gdbVarName: string) {
    const expressions = store.data.expressions;
    const obj = ExpressionClass.getObjectFromGdbVarName(expressions, gdbVarName);
    if (obj) {
      obj.show_children_in_ui = false;
      store.set<typeof store.data.expressions>("expressions", [...expressions]);
    }
  }
  static click_toggle_children_visibility(gdb_variable_name: any) {
    ExpressionClass.toggleChildren(gdb_variable_name);
  }
  static toggleChildren(gdb_var_name: string) {
    // get data object, which has field that says whether its expanded or not
    const obj = ExpressionClass.getObjectFromGdbVarName(
      store.data.expressions,
      gdb_var_name
    );
    if (obj) {
      const showing_children_in_ui = obj.show_children_in_ui;

      if (showing_children_in_ui) {
        // collapse
        ExpressionClass.hide_children_in_ui(gdb_var_name);
      } else {
        // expand
        ExpressionClass.fetchAndShowChildrenForVar(gdb_var_name);
      }
    } else {
      console.error("developer error - expected to find gdb variable object");
    }
  }
  static click_toggle_plot(gdb_var_name: any) {
    const expressions = store.data.expressions;
    // get data object, which has field that says whether its expanded or not
    const obj = ExpressionClass.getObjectFromGdbVarName(expressions, gdb_var_name);
    if (obj) {
      obj.show_plot = !obj.show_plot;
      store.set<typeof store.data.expressions>("expressions", [...expressions]);
    }
  }
  static get_update_cmds() {
    function _get_cmds_for_obj(obj: any) {
      let cmds = [`-var-update --all-values ${obj.name}`];
      for (const child of obj.children) {
        cmds = cmds.concat(_get_cmds_for_obj(child));
      }
      return cmds;
    }

    let cmds: any = [];
    for (const obj of store.data.expressions) {
      cmds = cmds.concat(_get_cmds_for_obj(obj));
    }
    return cmds;
  }
  static handle_changelist(changelistArray: any) {
    for (const changelist of changelistArray) {
      const expressions = store.data.expressions;
      const obj = ExpressionClass.getObjectFromGdbVarName(expressions, changelist.name);
      if (obj) {
        if (parseInt(changelist["has_more"]) === 1 && "name" in changelist) {
          // already retrieved children of obj, but more fields were added.
          // Re-fetch the object from gdb
          childVarFetcher.fetchChildren(changelist["name"], obj.expr_type);
        }
        if ("new_children" in changelist) {
          const new_children = changelist.new_children.map((child_obj: any) =>
            ExpressionClass.gdbExpressionToGdbguiExpression(
              child_obj,
              obj,
              VarCreator.expr_type
            )
          );
          obj.children = obj.children.concat(new_children);
        }
        // overwrite fields of obj with fields from changelist
        const changedObj = Object.assign(obj, changelist);
        ExpressionClass._update_numeric_properties(changedObj);
        ExpressionClass._update_radix_values(changedObj);
        if (changedObj.can_plot) {
          changedObj.values.push(changedObj._float_value);
        }
        store.set<typeof store.data.expressions>("expressions", [...expressions]);
      } else {
        // error
      }
    }
  }
  static click_draw_tree_gdb_variable(gdb_variable: any) {
    store.set<typeof store.data.root_gdb_tree_var>("root_gdb_tree_var", gdb_variable);
  }
  static deleteGdbVariable(gdbvar: string) {
    // delete locally
    ExpressionClass._delete_local_gdb_var_data(gdbvar);
    // delete in gdb too
    GdbApi.runGdbCommand(`-var-delete ${gdbvar}`);
  }
  /**
   * Delete local copy of gdb variable (all its children are deleted too
   * since they are stored as fields in the object)
   */
  static _delete_local_gdb_var_data(gdb_var_name: string) {
    const expressions = store.data.expressions;
    _.remove(expressions, (v: any) => v.name === gdb_var_name);
    store.set<typeof store.data.expressions>("expressions", [...expressions]);
  }
  /**
   * Locally save the variable to our cached variables
   */
  static saveNewExpression(exp: string, exprType: GdbguiExpressionType, obj: any) {
    const newExpression = ExpressionClass.gdbExpressionToGdbguiExpression(
      obj,
      null,
      VarCreator.expr_type,
      exp
    );
    store.set<typeof store.data.expressions>("expressions", [
      ...store.data.expressions,
      newExpression,
    ]);
  }
  /**
   * Get child variable with a particular name
   */
  static get_child_with_name(children: any, name: any) {
    for (const child of children) {
      if (child.name === name) {
        return child;
      }
    }
    return undefined;
  }
  static get_root_name_from_gdbvar_name(gdb_var_name: any) {
    if (_.isString(gdb_var_name)) {
      return gdb_var_name.split(".")[0];
    } else {
      return "";
    }
  }
  static get_child_names_from_gdbvar_name(gdb_var_name: any) {
    if (_.isString(gdb_var_name)) {
      return gdb_var_name.split(".").slice(1, gdb_var_name.length);
    } else {
      return "";
    }
  }
  /**
   * Get object from gdb variable name. gdb variable names are unique, and don't match
   * the expression being evaluated. If drilling down into fields of structures, the
   * gdb variable name has dot notation, such as 'var.field1.field2'.
   * @param gdb_var_name: gdb variable name to find corresponding cached object. Can have dot notation
   * @return: object if found, or undefined if not found
   */
  static getObjectFromGdbVarName(
    expressions: GdbguiExpressionVar[],
    gdb_var_name: string
  ): Nullable<GdbguiExpressionVar> {
    // gdb provides names in dot notation
    // let gdb_var_names = gdb_var_name.split('.'),
    const topLevelVarName = ExpressionClass.get_root_name_from_gdbvar_name(gdb_var_name);
    const childrenNames = ExpressionClass.get_child_names_from_gdbvar_name(gdb_var_name);

    const objs = expressions.filter((v) => v.name === topLevelVarName);

    if (objs.length === 1) {
      // we found our top level object
      let obj = objs[0];
      let nameToFind = topLevelVarName;
      for (let i = 0; i < childrenNames.length; i++) {
        // append the '.' and field name to find as a child of the object we're looking at
        nameToFind += `.${childrenNames[i]}`;

        const child_obj = ExpressionClass.get_child_with_name(obj.children, nameToFind);

        if (child_obj) {
          // our new object to search is this child
          obj = child_obj;
        } else {
          console.error(`could not find ${nameToFind}`);
          return null;
        }
      }
      return obj;
    } else if (objs.length === 0) {
      return null;
    } else {
      console.error(
        `Somehow found multiple local gdb variables with the name ${topLevelVarName}. Not using any of them. File a bug report with the developer.`
      );
      return null;
    }
  }
}
