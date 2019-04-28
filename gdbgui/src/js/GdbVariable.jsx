/**
 * A component to render gdb user variables, and
 * some library functions to interact with gdb. The library
 * functions create gdb variable objects locally, update them,
 * remove them, etc.
 */
import React from "react";
import Memory from "./Memory.jsx";
import constants from "./constants.js";
import { store } from "statorgfc";
import GdbApi from "./GdbApi.jsx";
import CopyToClipboard from "./CopyToClipboard";
import Actions from "./Actions.js";

/**
 * Simple object to manage fetching of child variables. Maintains a queue of parent expressions
 * to fetch children for, and fetches them in serial.
 */
let ChildVarFetcher = {
  expr_gdb_parent_var_currently_fetching_children: null, // parent gdb variable name (i.e. var7)
  _is_fetching: false,
  _queue: [], // objects with keys 'expr_gdb_parent_var_currently_fetching_children' and 'expr_type'
  _fetch_next_in_queue: function() {
    if (ChildVarFetcher._is_fetching) {
      return;
    }
    if (ChildVarFetcher._queue.length) {
      let obj = ChildVarFetcher._queue.shift();
      ChildVarFetcher.expr_gdb_parent_var_currently_fetching_children =
        obj.expr_of_parent;
      ChildVarFetcher._is_fetching = true;
      GdbApi.run_gdb_command(`-var-list-children --all-values "${obj.expr_of_parent}"`);
    } else {
      ChildVarFetcher.expr_gdb_parent_var_currently_fetching_children = null;
    }
  },
  fetch_children(expr_of_parent, expr_type) {
    ChildVarFetcher._queue.push({ expr_of_parent: expr_of_parent, expr_type: expr_type });
    ChildVarFetcher._fetch_next_in_queue();
  },
  fetch_complete() {
    ChildVarFetcher._is_fetching = false;
    ChildVarFetcher.expr_gdb_parent_var_currently_fetching_children = null;
    ChildVarFetcher._fetch_next_in_queue();
  }
};

/**
 * Simple object to manage fetching of variables. Maintains a queue of expressions
 * to fetch, and fetches them in serial.
 */
let VarCreator = {
  _queue: [], // list of objs with keys expr_being_created, expr_type
  _is_fetching: false,
  expr_being_created: null,
  expr_type: null,

  _fetch_next_in_queue: function() {
    if (VarCreator._is_fetching) {
      return;
    }
    if (VarCreator._queue.length) {
      let obj = VarCreator._queue.shift(),
        expression = obj.expression,
        expr_type = obj.expr_type;

      VarCreator._is_fetching = true;

      VarCreator.expr_being_created = expression;
      VarCreator.expr_type = expr_type;

      // surround in quotes if we found a quote
      if (expression.length > 0 && expression.indexOf('"') !== 0) {
        expression = '"' + expression + '"';
      }
      let cmds = [];
      if (store.get("pretty_print")) {
        cmds.push("-enable-pretty-printing");
      }

      // - means auto assign variable name in gdb
      // * means evaluate it at the current frame
      let var_create_cmd = constants.CREATE_VAR_STR + `-var-create - * ${expression}`;
      cmds.push(var_create_cmd);

      GdbApi.run_gdb_command(cmds);
    } else {
      VarCreator._clear_state();
    }
  },
  /**
   * Create a new variable in gdb. gdb automatically chooses and assigns
   * a unique variable name.
   */
  create_variable: function(expression, expr_type) {
    VarCreator._queue.push({ expression: expression, expr_type: expr_type });
    VarCreator._fetch_next_in_queue();
  },
  /**
   * After a variable is created, we need to link the gdb
   * variable name (which is automatically created by gdb),
   * and the expression the user wanted to evailuate. The
   * new variable is saved locally. The variable UI element is then re-rendered
   * @param r (object): gdb mi object
   */
  created_variable(r) {
    let expr = VarCreator.expr_being_created;
    if (expr) {
      // example payload:
      // "payload": {
      //      "has_more": "0",
      //      "name": "var2",
      //      "numchild": "0",
      //      "thread-id": "1",
      //      "type": "int",
      //      "value": "0"
      //  },
      GdbVariable.save_new_expression(expr, VarCreator.expr_type, r.payload);
      VarCreator.expr_being_created = null;
      // automatically fetch first level of children for root variables
      GdbVariable.fetch_and_show_children_for_var(r.payload.name);
    } else {
      // gdbgui did not expect a new variable to be created here
      // it's likely this tab is viewing an instance of gdb that multiple users
      // are interacting with
    }
    VarCreator._fetch_complete();
  },
  fetch_failed(r) {
    if (VarCreator.expr_type === "hover") {
      // do nothing
    } else {
      Actions.add_gdb_response_to_console(r);
    }
    VarCreator._fetch_complete();
  },
  _fetch_complete() {
    VarCreator._is_fetching = false;
    VarCreator._clear_state();
    VarCreator._fetch_next_in_queue();
  },
  _clear_state: function() {
    VarCreator._is_fetching = false;
  }
};

class GdbVariable extends React.Component {
  render() {
    const is_root = true;

    if (this.props.expr_type === "local") {
      return this.get_ul_for_local(this.props.obj);
    } else {
      if (this.props.obj.numchild > 0) {
        return this.get_ul_for_var_with_children(
          this.props.expression,
          this.props.obj,
          this.props.expr_type,
          is_root
        );
      } else {
        return this.get_ul_for_var_without_children(
          this.props.expression,
          this.props.obj,
          this.props.expr_type,
          is_root
        );
      }
    }
  }
  /**
   * get unordered list for a "local" returned by gdb
   * these are special snowflakes; gdb returns a small subset of information for
   * locals. The list is useful to browse, but oftentimes needs to be expanded.
   * If the user clicks on a local that can be expanded, gdbgui will ask gdb
   * to create a full-fledged variable for the user to explore. gdbgui will then
   * render that instead of the "local".
   */
  get_ul_for_local(local) {
    let can_be_expanded = local.can_be_expanded,
      value = _.isString(local.value)
        ? Memory.make_addrs_into_links_react(local.value)
        : local.value,
      onclick = can_be_expanded
        ? () => GdbVariable.create_variable(local.name, "local")
        : () => {};

    return (
      <div>
        <span onClick={onclick} className={can_be_expanded ? "pointer" : ""}>
          {can_be_expanded ? "+" : ""} {local.name}&nbsp;
        </span>
        {value}

        <span className="var_type">{_.trim(local.type)}</span>
      </div>
    );
  }
  /**
   * get unordered list for a variable that has children
   * @return unordered list, expanded or collapsed based on the key "show_children_in_ui"
   */
  get_ul_for_var_with_children(expression, mi_obj, expr_type, is_root = false) {
    let child_tree;
    if (mi_obj.show_children_in_ui) {
      let content = [];
      if (mi_obj.children.length > 0) {
        for (let child of mi_obj.children) {
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

    let plus_or_minus = mi_obj.show_children_in_ui ? "-" : "+";
    return this._get_ul_for_var(
      expression,
      mi_obj,
      expr_type,
      is_root,
      plus_or_minus,
      child_tree,
      mi_obj.numchild
    );
  }
  get_ul_for_var_without_children(expression, mi_obj, expr_type, is_root = false) {
    return this._get_ul_for_var(expression, mi_obj, expr_type, is_root);
  }
  static _get_value_jsx(obj) {
    let val;
    if (obj.is_int) {
      val = (
        <div className="inline">
          <span className="gdbVarValue">
            {Memory.make_addrs_into_links_react(obj._int_value_to_str_in_radix)}
            <button
              className="btn btn-default btn-xs btn-radix"
              onClick={() => {
                GdbVariable.change_radix(obj);
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
      val = _.isString(obj.value)
        ? Memory.make_addrs_into_links_react(obj.value)
        : obj.value;
    }
    return val;
  }
  static change_radix(obj) {
    if (obj._radix === 16) {
      obj._radix = 2;
    } else {
      obj._radix += 2;
    }
    GdbVariable._update_radix_values(obj);
    store.set("expressions", store.get("expressions"));
  }
  /**
   * Get ul for a variable with or without children
   */
  _get_ul_for_var(
    expression,
    mi_obj,
    expr_type,
    is_root,
    plus_or_minus = "",
    child_tree = "",
    numchild = 0
  ) {
    let glyph_style = { fontSize: "0.8em", paddingLeft: "5px" },
      delete_button =
        is_root && expr_type === "expr" ? (
          <span
            style={glyph_style}
            className="glyphicon glyphicon-trash pointer"
            onClick={() => GdbVariable.delete_gdb_variable(mi_obj.name)}
          />
        ) : (
          ""
        ),
      has_children = numchild > 0,
      can_draw_tree = has_children && (expr_type === "expr" || expr_type === "local"), // hover var can't draw tree
      tree = can_draw_tree ? (
        <span
          style={glyph_style}
          className="glyphicon glyphicon-tree-deciduous pointer"
          onClick={() => GdbVariable.click_draw_tree_gdb_variable(mi_obj.name)}
        />
      ) : (
        ""
      ),
      toggle_classes = has_children ? "pointer" : "",
      plot_content = "",
      plot_button = "",
      plusminus_click_callback = has_children
        ? () => GdbVariable.click_toggle_children_visibility(mi_obj.name)
        : () => {};
    if (mi_obj.can_plot && mi_obj.show_plot) {
      // dots are not allowed in the dom as id's. replace with '-'.
      let id = mi_obj.dom_id_for_plot;
      plot_button = (
        <span
          style={glyph_style}
          className="pointer glyphicon glyphicon-ban-circle"
          onClick={() => GdbVariable.click_toggle_plot(mi_obj.name)}
          title="remove x/y plot"
        />
      );
      plot_content = <div id={id} className="plot" />;
    } else if (mi_obj.can_plot && !mi_obj.show_plot) {
      plot_button = (
        <span
          style={glyph_style}
          className="glyphicon glyphicon glyphicon-equalizer pointer"
          onClick={() => GdbVariable.click_toggle_plot(mi_obj.name)}
          title="show x/y plot"
        />
      );
    }

    return (
      <ul key={expression} className="varUL">
        <li className="varLI">
          <span className={toggle_classes} onClick={plusminus_click_callback}>
            {plus_or_minus} {expression}&nbsp;
          </span>

          {GdbVariable._get_value_jsx(mi_obj)}

          <span className="var_type">{_.trim(mi_obj.type) || ""}</span>

          <div className="right_help_icon_show_on_hover">
            <CopyToClipboard content={GdbVariable._get_full_path(mi_obj)} />:
            {tree}
            {plot_button}
            {delete_button}
          </div>

          {plot_content}
        </li>
        {child_tree}
      </ul>
    );
  }
  static _get_full_path(obj) {
    if (!obj) {
      return "";
    }

    function update_path(path, obj) {
      let potential_addition = obj.expression || obj.exp;
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
  static create_variable(expression, expr_type) {
    VarCreator.create_variable(expression, expr_type);
  }
  static gdb_created_root_variable(r) {
    VarCreator.created_variable(r);
  }
  static gdb_variable_fetch_failed(r) {
    VarCreator.fetch_failed(r);
  }
  /**
   * Got data regarding children of a gdb variable. It could be an immediate child, or grandchild, etc.
   * This method stores this child array data to the appropriate locally stored
   * object
   * @param r (object): gdb mi object
   */
  static gdb_created_children_variables(r) {
    // example reponse payload:
    // "payload": {
    //         "has_more": "0",
    //         "numchild": "2",
    //         "children": [
    //             {
    //                 "name": "var9.a",
    //                 "thread-id": "1",
    //                 "numchild": "0",
    //                 "value": "4195840",
    //                 "exp": "a",
    //                 "type": "int"
    //             }
    //             {
    //                 "name": "var9.b",
    //                 "thread-id": "1",
    //                 "numchild": "0",
    //                 "value": "0",
    //                 "exp": "b",
    //                 "type": "float"
    //             }
    //         ]
    //     }

    let parent_name = ChildVarFetcher.expr_gdb_parent_var_currently_fetching_children;
    if (!parent_name) {
      // gdb created child variable, but the parent variable is unknown
      // it's likely another tab interacting w/ the same gdb instance created this
    }
    ChildVarFetcher.fetch_complete();

    // get the parent object of these children
    let expressions = store.get("expressions");
    let parent_obj = GdbVariable.get_obj_from_gdb_var_name(expressions, parent_name);
    if (parent_obj) {
      // prepare all the child objects we received for local storage
      let children = r.payload.children.map(child_obj =>
        GdbVariable.prepare_gdb_obj_for_storage(child_obj, parent_obj)
      );
      // save these children as a field to their parent
      parent_obj.children = children;
      parent_obj.numchild = children.length;
      store.set("expressions", expressions);

      // if this field is an anonymous struct, the user will want to
      // see this expanded by default
      for (let child of parent_obj.children) {
        if (child.exp.includes("<anonymous")) {
          GdbVariable.fetch_and_show_children_for_var(child.name);
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
   * @param obj (object): mi object returned from gdb
   * @param expr_type (str): type of expression being created (see store creation for documentation)
   */
  static prepare_gdb_obj_for_storage(obj, parent) {
    let new_obj = Object.assign({}, obj);
    // obj was copied, now add some additional fields used by gdbgui

    new_obj.parent = parent;
    // A varobj's contents may be provided by a Python-based pretty-printer.
    // In this case the varobj is known as a dynamic varobj.
    // Dynamic varobjs have slightly different semantics in some cases.
    // https://sourceware.org/gdb/onlinedocs/gdb/GDB_002fMI-Variable-Objects.html#GDB_002fMI-Variable-Objects
    new_obj.numchild = obj.dynamic ? parseInt(obj.has_more) : parseInt(obj.numchild);
    new_obj.children = []; // actual child objects are fetched dynamically when the user requests them
    new_obj.show_children_in_ui = false;

    // this field is not returned when the variable is created, but
    // it is returned when the variables are updated
    // it is returned by gdb mi as a string, and we assume it starts out in scope
    new_obj.in_scope = "true";
    new_obj.expr_type = VarCreator.expr_type;

    GdbVariable._update_numeric_properties(new_obj);

    new_obj.dom_id_for_plot = new_obj.name
      .replace(/\./g, "-") // replace '.' with '-'
      .replace(/\$/g, "_") // replace '$' with '-'
      .replace(/\[/g, "_") // replace '[' with '_'
      .replace(/\]/g, "_"); // replace ']' with '_'
    new_obj.show_plot = false; // used when rendering to decide whether to show plot or not
    // push to this array each time a new value is assigned if value is numeric.
    // Plots use this data
    if (new_obj.value.indexOf("0x") === 0) {
      new_obj.values = [parseInt(new_obj.value, 16)];
      new_obj._radix = 16;
    } else if (!window.isNaN(parseFloat(new_obj.value))) {
      new_obj.values = [parseFloat(new_obj.value)];
      if (new_obj.is_int) {
        new_obj._radix = 10;
      } else {
        new_obj._radix = 0;
      }
    } else {
      new_obj.values = [];
      new_obj._radix = 0;
    }
    GdbVariable._update_radix_values(new_obj); // mutates new_obj
    return new_obj;
  }
  static _update_numeric_properties(obj) {
    let value = obj.value;
    if (obj.value.startsWith("0x")) {
      value = parseInt(obj.value, 16);
    }
    obj._float_value = parseFloat(value);
    obj.is_numeric = !window.isNaN(obj._float_value);
    obj.can_plot = obj.is_numeric && obj.expr_type === "expr";
    obj.is_int = obj.is_numeric ? obj._float_value % 1 === 0 : false;
  }
  static _update_radix_values(obj) {
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
  static _make_plot(obj) {
    let id = "#" + obj.dom_id_for_plot, // this div should have been created already
      jq = $(id),
      data = [],
      i = 0;

    // collect data
    for (let val of obj.values) {
      data.push([i, val]);
      i++;
    }

    // make the plot
    $.plot(
      jq,
      [
        {
          data: data,
          shadowSize: 0,
          color: "#33cdff"
        }
      ],
      {
        series: {
          lines: { show: true },
          points: { show: true }
        },
        grid: { hoverable: true, clickable: false }
      }
    );

    // add hover event to show tooltip
    jq.bind("plothover", function(event, pos, item) {
      if (item) {
        let x = item.datapoint[0],
          y = item.datapoint[1];

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
  static plot_var_and_children(obj) {
    if (obj.show_plot) {
      GdbVariable._make_plot(obj);
    }
    for (let child of obj.children) {
      GdbVariable.plot_var_and_children(child);
    }
  }
  static fetch_and_show_children_for_var(gdb_var_name) {
    let expressions = store.get("expressions");
    let obj = GdbVariable.get_obj_from_gdb_var_name(expressions, gdb_var_name);
    // mutate object by reference
    obj.show_children_in_ui = true;
    // update store
    store.set("expressions", expressions);
    if (obj.numchild && obj.children.length === 0) {
      // need to fetch child data
      ChildVarFetcher.fetch_children(gdb_var_name, obj.expr_type);
    } else {
      // already have child data, re-render will occur from event dispatch
    }
  }
  static hide_children_in_ui(gdb_var_name) {
    let expressions = store.get("expressions"),
      obj = GdbVariable.get_obj_from_gdb_var_name(expressions, gdb_var_name);
    if (obj) {
      obj.show_children_in_ui = false;
      store.set("expressions", expressions);
    }
  }
  static click_toggle_children_visibility(gdb_variable_name) {
    GdbVariable._toggle_children_visibility(gdb_variable_name);
  }
  static _toggle_children_visibility(gdb_var_name) {
    // get data object, which has field that says whether its expanded or not
    let obj = GdbVariable.get_obj_from_gdb_var_name(
      store.get("expressions"),
      gdb_var_name
    );
    if (obj) {
      let showing_children_in_ui = obj.show_children_in_ui;

      if (showing_children_in_ui) {
        // collapse
        GdbVariable.hide_children_in_ui(gdb_var_name);
      } else {
        // expand
        GdbVariable.fetch_and_show_children_for_var(gdb_var_name);
      }
    } else {
      console.error("developer error - expected to find gdb variable object");
    }
  }
  static click_toggle_plot(gdb_var_name) {
    let expressions = store.get("expressions"),
      // get data object, which has field that says whether its expanded or not
      obj = GdbVariable.get_obj_from_gdb_var_name(expressions, gdb_var_name);
    if (obj) {
      obj.show_plot = !obj.show_plot;
      store.set("expressions", expressions);
    }
  }
  static get_update_cmds() {
    function _get_cmds_for_obj(obj) {
      let cmds = [`-var-update --all-values ${obj.name}`];
      for (let child of obj.children) {
        cmds = cmds.concat(_get_cmds_for_obj(child));
      }
      return cmds;
    }

    let cmds = [];
    for (let obj of store.get("expressions")) {
      cmds = cmds.concat(_get_cmds_for_obj(obj));
    }
    return cmds;
  }
  static handle_changelist(changelist_array) {
    for (let changelist of changelist_array) {
      let expressions = store.get("expressions"),
        obj = GdbVariable.get_obj_from_gdb_var_name(expressions, changelist.name);
      if (obj) {
        if (parseInt(changelist["has_more"]) === 1 && "name" in changelist) {
          // already retrieved children of obj, but more fields were added.
          // Re-fetch the object from gdb
          ChildVarFetcher.fetch_children(changelist["name"], obj.expr_type);
        }
        if ("new_children" in changelist) {
          let new_children = changelist.new_children.map(child_obj =>
            GdbVariable.prepare_gdb_obj_for_storage(child_obj, obj)
          );
          obj.children = obj.children.concat(new_children);
        }
        // overwrite fields of obj with fields from changelist
        obj = Object.assign(obj, changelist);
        GdbVariable._update_numeric_properties(obj);
        GdbVariable._update_radix_values(obj);
        if (obj.can_plot) {
          obj.values.push(obj._float_value);
        }
        store.set("expressions", expressions);
      } else {
        // error
      }
    }
  }
  static click_draw_tree_gdb_variable(gdb_variable) {
    store.set("root_gdb_tree_var", gdb_variable);
  }
  static delete_gdb_variable(gdbvar) {
    // delete locally
    GdbVariable._delete_local_gdb_var_data(gdbvar);
    // delete in gdb too
    GdbApi.run_gdb_command(`-var-delete ${gdbvar}`);
  }
  /**
   * Delete local copy of gdb variable (all its children are deleted too
   * since they are stored as fields in the object)
   */
  static _delete_local_gdb_var_data(gdb_var_name) {
    let expressions = store.get("expressions");
    _.remove(expressions, v => v.name === gdb_var_name);
    store.set("expressions", expressions);
  }
  /**
   * Locally save the variable to our cached variables
   */
  static save_new_expression(expression, expr_type, obj) {
    let new_obj = GdbVariable.prepare_gdb_obj_for_storage(obj, null);
    new_obj.expression = expression;
    let expressions = store.get("expressions");
    expressions.push(new_obj);
    store.set("expressions", expressions);
  }
  /**
   * Get child variable with a particular name
   */
  static get_child_with_name(children, name) {
    for (let child of children) {
      if (child.name === name) {
        return child;
      }
    }
    return undefined;
  }
  static get_root_name_from_gdbvar_name(gdb_var_name) {
    if (_.isString(gdb_var_name)) {
      return gdb_var_name.split(".")[0];
    } else {
      return "";
    }
  }
  static get_child_names_from_gdbvar_name(gdb_var_name) {
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
  static get_obj_from_gdb_var_name(expressions, gdb_var_name) {
    // gdb provides names in dot notation
    // let gdb_var_names = gdb_var_name.split('.'),
    let top_level_var_name = GdbVariable.get_root_name_from_gdbvar_name(gdb_var_name),
      children_names = GdbVariable.get_child_names_from_gdbvar_name(gdb_var_name);

    let objs = expressions.filter(v => v.name === top_level_var_name);

    if (objs.length === 1) {
      // we found our top level object
      let obj = objs[0];
      let name_to_find = top_level_var_name;
      for (let i = 0; i < children_names.length; i++) {
        // append the '.' and field name to find as a child of the object we're looking at
        name_to_find += `.${children_names[i]}`;

        let child_obj = GdbVariable.get_child_with_name(obj.children, name_to_find);

        if (child_obj) {
          // our new object to search is this child
          obj = child_obj;
        } else {
          console.error(`could not find ${name_to_find}`);
          return undefined;
        }
      }
      return obj;
    } else if (objs.length === 0) {
      return undefined;
    } else {
      console.error(
        `Somehow found multiple local gdb variables with the name ${top_level_var_name}. Not using any of them. File a bug report with the developer.`
      );
      return undefined;
    }
  }
}

export default GdbVariable;
