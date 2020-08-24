import React from "react";
import { store } from "statorgfc";
import FileOps from "./FileOps";
import constants from "./constants";
import SourceFileAutocomplete from "./SourceFileAutocomplete";
import FileSystem from "./FileSystem";
import Actions from "./Actions";

const default_rootnode = {
  name: 'Load inferior program, then click "Fetch source files" to populate this window',
  children: [],
  toggled: false
};

function get_child_node_with_name(name: any, curnode: any) {
  if (!curnode.children) {
    return null;
  }
  for (let node of curnode.children) {
    if (node.name === name) {
      return node;
    }
  }
  return null;
}

type State = any;

class FoldersView extends React.Component<{}, State> {
  max_filesystem_entries: any;
  project_home: any;
  constructor(props: {}) {
    super(props);
    this.state = {
      rootnode: default_rootnode
    };
    // @ts-expect-error ts-migrate(2339) FIXME: Property 'connectComponentState' does not exist on... Remove this comment to see the full error message
    store.connectComponentState(
      this,
      ["source_code_state", "source_file_paths"],
      this.update_filesystem_data.bind(this)
    );

    this.max_filesystem_entries = 300;
    // @ts-expect-error ts-migrate(2304) FIXME: Cannot find name 'initial_data'.
    this.project_home = initial_data.project_home; /* global initial_data */
    this.onToggle = this.onToggle.bind(this);
    this.onClickName = this.onClickName.bind(this);
    this.reveal_path = this.reveal_path.bind(this);
    this.expand_all = this.expand_all.bind(this);
    this.collapse_all = this.collapse_all.bind(this);
  }

  render() {
    let source_code_state = this.state.source_code_state,
      file_is_rendered =
        source_code_state === constants.source_code_states.SOURCE_CACHED ||
        source_code_state === constants.source_code_states.ASSM_AND_SOURCE_CACHED,
      can_reveal = file_is_rendered && this.state.source_file_paths.length,
      hiding_entries = this.state.source_file_paths.length > this.max_filesystem_entries;

    return (
      <div>
        <button
          className="btn btn-xs btn-primary"
          onClick={Actions.fetch_source_files}
          style={{ marginLeft: "5px", marginTop: "5px" }}
        >
          Fetch source files
        </button>

        <div style={{ width: "100%" }}>
          <SourceFileAutocomplete />
        </div>
        <div role="group" className="btn-group btn-group" style={{ padding: "4px" }}>
          <button className="btn btn-xs btn-default" onClick={this.expand_all}>
            Expand all
          </button>

          <button className="btn btn-xs btn-default" onClick={this.collapse_all}>
            Collapse all
          </button>

          <button
            className={"btn btn-xs btn-default " + (can_reveal ? "" : "hidden")}
            onClick={() => this.reveal_path(store.get("fullname_to_render"))}
          >
            Reveal current file
          </button>
        </div>

        {store.get("source_file_paths").length ? (
          <p style={{ color: "white", padding: "4px" }}>
            {store.get("source_file_paths").length} known files used to compile the
            inferior program
          </p>
        ) : (
          ""
        )}

        {hiding_entries ? (
          <p style={{ color: "black", background: "orange", padding: "4px" }}>
            Maximum entries in tree below is {this.max_filesystem_entries} (hiding{" "}
            {store.get("source_file_paths").length - this.max_filesystem_entries}). All
            files can still be searched for in the input above.
          </p>
        ) : (
          ""
        )}

        <FileSystem
          // @ts-expect-error ts-migrate(2769) FIXME: Property 'rootnode' does not exist on type 'Intrin... Remove this comment to see the full error message
          rootnode={this.state.rootnode}
          onToggle={this.onToggle}
          onClickName={this.onClickName}
        />
      </div>
    );
  }
  onClickName(node: any) {
    let curnode = node,
      path = [];
    while (curnode) {
      if (curnode.name === "root") {
        path.unshift("");
        break;
      }
      // prepend this file/directory to the path
      path.unshift(curnode.name);
      // try to prepend the parent
      curnode = curnode.parent;
    }
    if (path.length) {
      FileOps.user_select_file_to_view(path.join("/"), 1);
    }
  }
  reveal_path(path: any) {
    if (!path) {
      return;
    }

    if (this.state.cursor) {
      this.state.cursor.active = false;
    }

    if (this.project_home) {
      path = path.replace(this.project_home, "");
    }

    let names = path.split("/").filter((n: any) => n !== ""),
      curnode = this.state.rootnode;

    curnode.toggled = true; // expand the root
    for (let name of names) {
      curnode = get_child_node_with_name(name, curnode);
      if (curnode) {
        curnode.toggled = true;
      } else {
        break;
      }
    }

    if (curnode) {
      curnode.active = true;
    }
    this.setState({ rootnode: this.state.rootnode, cursor: curnode });
  }
  update_filesystem_data(keys: any) {
    if (keys.indexOf("source_file_paths") === -1) {
      return;
    }

    let source_paths = this.state.source_file_paths;
    if (!Array.isArray(source_paths) || !source_paths.length) {
      this.setState({
        rootnode: default_rootnode
      });
      return;
    }

    let rootnode = {
      name: this.project_home || "root",
      toggled: true,
      children: []
    };

    let relative_source_paths = source_paths;

    if (this.project_home) {
      let project_home = this.project_home;
      relative_source_paths = source_paths
        .filter(p => p.startsWith(project_home))
        .map(p => {
          p = p.replace(project_home, "");
          return p;
        });
    }
    for (let path of relative_source_paths) {
      let new_node,
        names = path.split("/").filter((n: any) => n !== ""),
        curnode = rootnode,
        // @ts-expect-error ts-migrate(2448) FIXME: Block-scoped variable 'depth' used before its decl... Remove this comment to see the full error message
        toggled = depth === 0;
      let depth = 0;
      for (let name of names) {
        let child = get_child_node_with_name(name, curnode);
        if (child) {
          // found an existing child node, use it
          curnode = child;
        } else {
          // add child and set it to cur node
          // @ts-expect-error ts-migrate(2322) FIXME: Object literal may only specify known properties, ... Remove this comment to see the full error message
          new_node = { name: name, toggled: toggled, parent: curnode };
          if (curnode.children) {
            // @ts-expect-error ts-migrate(2345) FIXME: Argument of type '{ name: any; toggled: boolean; p... Remove this comment to see the full error message
            curnode.children.push(new_node);
          } else {
            // @ts-expect-error ts-migrate(2322) FIXME: Type '{ name: any; toggled: boolean; parent: { nam... Remove this comment to see the full error message
            curnode.children = [new_node];
          }
          curnode = new_node;
        }

        depth++;
      }
    }
    this.setState({ rootnode: rootnode });
  }

  onToggle(node: any) {
    node.toggled = !node.toggled;
    this.setState({ rootnode: this.state.rootnode });
  }
  expand_all() {
    let callback = (node: any) => {
      node.toggled = true;
    };
    for (let top_level_child of this.state.rootnode.children) {
      this._dfs(top_level_child, callback);
    }
    this.setState({ rootnode: this.state.rootnode });
  }
  collapse_all() {
    let callback = (node: any) => {
      node.toggled = false;
    };
    for (let top_level_child of this.state.rootnode.children) {
      this._dfs(top_level_child, callback);
    }
    this.setState({ rootnode: this.state.rootnode });
  }
  _dfs(node: any, callback: any) {
    callback(node);
    if (node.children) {
      for (let child of node.children) {
        this._dfs(child, callback);
      }
    }
  }
}

export default FoldersView;
