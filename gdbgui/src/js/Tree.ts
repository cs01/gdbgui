// a widget to visualize a tree view of a variable with children
// utilizes the amazing http://visjs.org library

/* global vis */
import { store } from "statorgfc";
import GdbVariable from "./GdbVariable";
import constants from "./constants";

const Tree = {
  el: null, // tree id must be available in DOM before calling `init`
  width_input: null,
  height_input: null,
  init: function() {
    // @ts-expect-error ts-migrate(2339) FIXME: Property 'subscribeToKeys' does not exist on type ... Remove this comment to see the full error message
    store.subscribeToKeys(
      ["root_gdb_tree_var", "expressions", "root_gdb_tree_var"],
      Tree._render
    );
    let render_on_enter = (e: any) => {
      if (e.keyCode === 13) {
        Tree._render();
      }
    };
    // @ts-expect-error ts-migrate(2322) FIXME: Type 'HTMLElement' is not assignable to type 'null... Remove this comment to see the full error message
    Tree.el = document.getElementById(constants.tree_component_id);
    // @ts-expect-error ts-migrate(2322) FIXME: Type 'HTMLElement' is not assignable to type 'null... Remove this comment to see the full error message
    Tree.width_input = document.getElementById("tree_width");
    // @ts-expect-error ts-migrate(2322) FIXME: Type 'HTMLElement' is not assignable to type 'null... Remove this comment to see the full error message
    Tree.height_input = document.getElementById("tree_height");

    // @ts-expect-error ts-migrate(2531) FIXME: Object is possibly 'null'.
    Tree.width_input.onkeyup = render_on_enter;
    // @ts-expect-error ts-migrate(2531) FIXME: Object is possibly 'null'.
    Tree.height_input.onkeyup = render_on_enter;
  },
  network: null, // initialize to null
  rendered_gdb_var_tree_root: null,
  gdb_var_being_updated: null, // if user clicks deep in a tree, only rerender that subtree, don't start from root again

  _render: function() {
    let gdbvar = store.get("root_gdb_tree_var");
    if (!gdbvar) {
      // @ts-expect-error ts-migrate(2531) FIXME: Object is possibly 'null'.
      Tree.el.innerHTML = `
            <span class=placeholder>
                create an Expression, then click <span class='glyphicon glyphicon-tree-deciduous'></span>
                when viewing a variable with children to interactively explore a tree view. You can click nodes to
                expand/collapse them.
            </span>`;
      return;
    }

    let expressions = store.get("expressions"),
      gdb_root_var_to_update = Tree.gdb_var_being_updated
        ? Tree.gdb_var_being_updated
        : gdbvar,
      gdb_var_obj = GdbVariable.get_obj_from_gdb_var_name(
        expressions,
        gdb_root_var_to_update
      );

    if (!gdb_var_obj) {
      // couldn't find this variable name in our list of variables. Probably was a local variable the
      // user graphed, then hit continue, and the variable was erased by gdb. This is expected.
      // "GdbVariable" that users enter persist between stepping through the program though,
      // so it's not expected that this line will be executed for an expression
      store.set("root_gdb_tree_var", "");
      return;
    }

    if (gdbvar === Tree.rendered_gdb_var_tree_root) {
      // nodes is an Object with keys corresponding to node id's (which are gdb_var_names)
      Tree._add_nodes_and_edges(
        gdb_var_obj,
        undefined,
        // @ts-expect-error ts-migrate(2531) FIXME: Object is possibly 'null'.
        Tree.network.body.nodes,
        // @ts-expect-error ts-migrate(2531) FIXME: Object is possibly 'null'.
        Tree.network.body.edges
      );
    } else {
      Tree.render_new_network(gdb_var_obj);
    }
    Tree._update_canvas_size();
    Tree.rendered_gdb_var_tree_root = gdbvar;
    Tree.gdb_var_being_updated = null;
  },
  _update_canvas_size: function() {
    // @ts-expect-error ts-migrate(2531) FIXME: Object is possibly 'null'.
    if (Tree.network && Tree.network.canvas && Tree.network.canvas.options) {
      // @ts-expect-error ts-migrate(2531) FIXME: Object is possibly 'null'.
      if (parseInt(Tree.width_input.value)) {
        // @ts-expect-error ts-migrate(2531) FIXME: Object is possibly 'null'.
        Tree.network.canvas.options["width"] = parseInt(Tree.width_input.value) + "px";
      } else {
        // @ts-expect-error ts-migrate(2531) FIXME: Object is possibly 'null'.
        Tree.network.canvas.options["width"] = "100%";
      }
      // @ts-expect-error ts-migrate(2531) FIXME: Object is possibly 'null'.
      if (Tree.height_input.value) {
        // @ts-expect-error ts-migrate(2531) FIXME: Object is possibly 'null'.
        Tree.network.canvas.options["height"] = parseInt(Tree.height_input.value) + "px";
      } else {
        // @ts-expect-error ts-migrate(2531) FIXME: Object is possibly 'null'.
        Tree.network.canvas.options["height"] = "100%";
      }
    }
  },
  // @param node: gdb variable object
  // @return string for node label in the tree
  _get_node_label: function(node: any) {
    let label = [];
    if (node.value) {
      label.push(node.value);
    }
    if (node.type) {
      label.push(node.type);
    }

    if (node.children.some((c: any) => c.numchild === 0)) {
      label.push("field(s):");
    }
    // children field is only populated when user expands a data structure
    // numchild is always present
    // if children have been fetched and are simple values (i.e. don't have children of their own),
    // show them in the same node. If the child has children of its own, show it as a "hidden child" of this node
    let hidden_children = 0;
    for (let child of node.children) {
      if (child.numchild === 0) {
        label.push(`${child.exp}: ${child.value} (${child.type})`);
      } else {
        hidden_children++;
      }
    }

    if (node.show_children_in_ui === false && hidden_children > 0) {
      // children have previously been fetched but are now hidden since user toggled visibility
      let child_text = hidden_children === 1 ? "child" : "children";
      label.push(`+ ${hidden_children} ${child_text}`);
    } else if (node.numchild !== node.children.length) {
      // children have not yet been fetched, but gdb told us this node has children. We don't know if they
      // are "simple" values, or complex with children of their own. We just know they exist.
      let child_text = node.numchild === 1 ? "child" : "children";
      label.push(`+ ${node.numchild} ${child_text}`);
    }
    return label.join("\n");
  },
  // mutates Tree.nodes and Tree.edges  to (recursively) reflect node and its children
  // by either adding new nodes, modifying existing nodes, or deleting nodes that should be hidden
  // depending on the store of the existing nodes.
  // If updating a node, the background is highlighted yellow if the value changed
  // @param node: gdb variable object that should be added to Tree.nodes
  // @param parent: parent node of node. undefined when node is root.
  // @return nothing
  _add_nodes_and_edges: function(node: any, parent: any) {
    // add/update this node
    let node_label = Tree._get_node_label(node);
    // @ts-expect-error ts-migrate(2339) FIXME: Property 'nodes' does not exist on type '{ el: nul... Remove this comment to see the full error message
    if (node.name in Tree.nodes._data) {
      // compare old value and new value
      // if value changed, make it yellow!
      // @ts-expect-error ts-migrate(2339) FIXME: Property 'nodes' does not exist on type '{ el: nul... Remove this comment to see the full error message
      let old_label = Tree.nodes._data[node.name].label,
        bgcolor = node_label === old_label ? "white" : "yellow";
      // @ts-expect-error ts-migrate(2339) FIXME: Property 'nodes' does not exist on type '{ el: nul... Remove this comment to see the full error message
      Tree.nodes.update({
        id: node.name,
        label: Tree._get_node_label(node),
        color: { background: bgcolor }
      });
    } else {
      // @ts-expect-error ts-migrate(2339) FIXME: Property 'nodes' does not exist on type '{ el: nul... Remove this comment to see the full error message
      Tree.nodes.add({ id: node.name, label: Tree._get_node_label(node) });
    }

    // add edge from this node to parent if it's not there
    // @ts-expect-error ts-migrate(2339) FIXME: Property 'edges' does not exist on type '{ el: nul... Remove this comment to see the full error message
    if (parent && !(node.name in Tree.edges._data)) {
      // @ts-expect-error ts-migrate(2339) FIXME: Property 'edges' does not exist on type '{ el: nul... Remove this comment to see the full error message
      Tree.edges.add({
        id: node.name,
        from: parent.name,
        to: node.name,
        label: node.exp
      });
    }

    // add/update/delete child nodes
    if (node.show_children_in_ui) {
      // add/update child nodes
      for (let child of node.children) {
        if (child.numchild > 0) {
          Tree._add_nodes_and_edges(child, node);
        }
      }
    } else {
      // recursively delete to make invisible
      for (let child of node.children) {
        Tree._dfs(child, function(node: any) {
          // @ts-expect-error ts-migrate(2339) FIXME: Property 'nodes' does not exist on type '{ el: nul... Remove this comment to see the full error message
          Tree.nodes.remove({ id: node.name });
          // @ts-expect-error ts-migrate(2339) FIXME: Property 'edges' does not exist on type '{ el: nul... Remove this comment to see the full error message
          Tree.edges.remove({ id: node.name });
        });
      }
    }
  },
  // depth-first search of node and its children. `callback` is run on each node as it is visited by
  // this function
  _dfs: function(node: any, callback: any) {
    callback(node);
    for (let child of node.children) {
      Tree._dfs(child, callback);
    }
  },
  // sets Tree.network to be a visjs network consisting of root_gdb_var_obj and all its children
  // @param root_gdb_var_obj root gdb variable object for which a network should be rendered
  // @return nothing
  render_new_network: function(root_gdb_var_obj: any) {
    // @ts-expect-error ts-migrate(2339) FIXME: Property 'nodes' does not exist on type '{ el: nul... Remove this comment to see the full error message
    Tree.nodes = new vis.DataSet();
    // @ts-expect-error ts-migrate(2339) FIXME: Property 'edges' does not exist on type '{ el: nul... Remove this comment to see the full error message
    Tree.edges = new vis.DataSet();
    // @ts-expect-error ts-migrate(2554) FIXME: Expected 2 arguments, but got 1.
    Tree._add_nodes_and_edges(root_gdb_var_obj);

    // create the network
    var data = {
      // @ts-expect-error ts-migrate(2339) FIXME: Property 'nodes' does not exist on type '{ el: nul... Remove this comment to see the full error message
      nodes: Tree.nodes,
      // @ts-expect-error ts-migrate(2339) FIXME: Property 'edges' does not exist on type '{ el: nul... Remove this comment to see the full error message
      edges: Tree.edges
    };

    // options found by browsing through examples here:
    // http://visjs.org/network_examples.html
    const options = {
      nodes: {
        shape: "box",
        color: { background: "white" }
      },
      layout: {
        randomSeed: 0,
        hierarchical: {
          direction: "UD",
          sortMethod: "directed"
        }
      },
      interaction: { dragNodes: true },
      physics: {
        enabled: false
      }
    };

    // @ts-expect-error ts-migrate(2304) FIXME: Cannot find name 'vis'.
    Tree.network = new vis.Network(Tree.el, data, options);

    // http://visjs.org/examples/network/events/interactionEvents.html
    // @ts-expect-error ts-migrate(2531) FIXME: Object is possibly 'null'.
    Tree.network.on("click", function(params: any) {
      // left click toggles child visibility
      // @ts-expect-error ts-migrate(2683) FIXME: 'this' implicitly has type 'any' because it does n... Remove this comment to see the full error message
      let gdb_var_name = this.getNodeAt(params.pointer.DOM);
      Tree.gdb_var_being_updated = gdb_var_name;
      if (!gdb_var_name) {
        return;
      }
      if (gdb_var_name) {
        GdbVariable._toggle_children_visibility(gdb_var_name);
      }
    });
  }
};

export default Tree;
