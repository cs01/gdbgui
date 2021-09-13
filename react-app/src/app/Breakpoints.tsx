import React from "react";
import { store } from "statorgfc";
import GdbApi from "./GdbApi";
import Actions from "./Actions";
import Util from "./Util";
import FileOps from "./FileOps";
import { FileLink } from "./Links";
import constants from "./constants";
import _ from "lodash";

const BreakpointSourceLineCache = {
  _cache: {},
  get_line: function (fullname: any, linenum: any) {
    if (
      // @ts-expect-error ts-migrate(7053) FIXME: Property 'fullname' does not exist on type '{}'.
      BreakpointSourceLineCache._cache["fullname"] !== undefined &&
      // @ts-expect-error
      _.isString(BreakpointSourceLineCache._cache["fullname"][linenum])
    ) {
      // @ts-expect-error ts-migrate(7053) FIXME: Property 'fullname' does not exist on type '{}'.
      return BreakpointSourceLineCache._cache["fullname"][linenum];
    }
    return null;
  },
  add_line: function (fullname: any, linenum: any, escaped_text: any) {
    // @ts-expect-error
    if (!_.isObject(BreakpointSourceLineCache._cache["fullname"])) {
      // @ts-expect-error ts-migrate(7053) FIXME: Property 'fullname' does not exist on type '{}'.
      BreakpointSourceLineCache._cache["fullname"] = {};
    }
    // @ts-expect-error ts-migrate(7053) FIXME: Property 'fullname' does not exist on type '{}'.
    BreakpointSourceLineCache._cache["fullname"][linenum] = escaped_text;
  },
};

type BreakpointState = {
  breakpoint_condition: string;
  editing_breakpoint_condition: boolean;
};
type GdbBreakpoint = {
  addr: string; //"0x0000555555555228";
  disp: string; // "keep";
  enabled: "y" | "n"; // "y";
  file: string; //"hello.c";
  fullname: string; //"/home/csmith/git/gdbgui/examples/c/hello.c";
  func: string; // "main";
  line: string; // "51";
  number: string; //"4";
  "original-location": string; // "/home/csmith/git/gdbgui/examples/c/hello.c:51";
  "thread-groups": Array<string>; // ["i1"];
  times: string; // "0";
  type: string; // "breakpoint";
};
type GdbGuiBreakpoint = {
  addr: string;
  disp: string;
  enabled: "y" | "n";
  file: string;
  fullname: string;
  func: string;
  line: number;
  number: number;
  "original-location": string;
  "thread-groups": Array<string>;
  times: number;
  type: string;
  isChildBreakpoint: boolean;
  isNormalBreakpoint: boolean;
  isParentBreakpoint: boolean;
  parentBreakpointNumber: Nullable<number>;
  fullNameToDisplay: Nullable<string>;
};
class Breakpoint extends React.Component<{ bkpt: GdbGuiBreakpoint }, BreakpointState> {
  constructor(props: { bkpt: GdbGuiBreakpoint }) {
    super(props);
    this.state = {
      breakpoint_condition: "",
      editing_breakpoint_condition: false,
    };
  }
  get_source_line(fullname: any, linenum: any) {
    // if we have the source file cached, we can display the line of text
    const MAX_CHARS_TO_SHOW_FROM_SOURCE = 40;
    let line = null;
    if (BreakpointSourceLineCache.get_line(fullname, linenum)) {
      line = BreakpointSourceLineCache.get_line(fullname, linenum);
      // @ts-expect-error ts-migrate(2554) FIXME: Expected 3 arguments, but got 2.
    } else if (FileOps.line_is_cached(fullname, linenum)) {
      const syntax_highlighted_line = FileOps.get_line_from_file(fullname, linenum);
      line = _.trim(Util.get_text_from_html(syntax_highlighted_line));

      if (line.length > MAX_CHARS_TO_SHOW_FROM_SOURCE) {
        line = line.slice(0, MAX_CHARS_TO_SHOW_FROM_SOURCE) + "...";
      }
      BreakpointSourceLineCache.add_line(fullname, linenum, line);
    }

    if (line) {
      return (
        <span className="monospace" style={{ whiteSpace: "nowrap", fontSize: "0.9em" }}>
          {line || <br />}
        </span>
      );
    }
    return "(file not cached)";
  }
  get_delete_jsx(bkpt_num_to_delete: any) {
    return (
      <div
        style={{ width: "10px", display: "inline" }}
        className="pointer breakpoint_trashcan"
        onClick={(e) => {
          e.stopPropagation();
          Breakpoints.delete_breakpoint(bkpt_num_to_delete);
        }}
        title={`Delete breakpoint ${bkpt_num_to_delete}`}
      >
        <span className="glyphicon glyphicon-trash"> </span>
      </div>
    );
  }
  get_num_times_hit(bkpt: any) {
    if (
      bkpt.times === undefined || // E.g. 'bkpt' is a child breakpoint
      bkpt.times === 0
    ) {
      return "";
    } else if (bkpt.times === 1) {
      return "1 hit";
    } else {
      return `${bkpt.times} hits`;
    }
  }
  on_change_bkpt_cond(e: any) {
    this.setState({
      breakpoint_condition: e.target.value,
      editing_breakpoint_condition: true,
    });
  }
  on_key_up_bktp_cond(number: any, e: any) {
    if (e.keyCode === constants.ENTER_BUTTON_NUM) {
      this.setState({ editing_breakpoint_condition: false });
      Breakpoints.set_breakpoint_condition(e.target.value, number);
    }
  }
  on_break_cond_click(e: any) {
    this.setState({
      editing_breakpoint_condition: true,
    });
  }
  render() {
    const b = this.props.bkpt;
    const checked = b.enabled === "y" ? "checked" : "";
    const source_line = this.get_source_line(b.fullNameToDisplay, b.line);

    let info_glyph;
    let function_jsx;
    let bkpt_num_to_delete;
    if (b.isChildBreakpoint) {
      bkpt_num_to_delete = b.parentBreakpointNumber;
      info_glyph = (
        <span
          className="glyphicon glyphicon-th-list"
          title="Child breakpoint automatically created from parent. If parent or any child of this tree is deleted, all related breakpoints will be deleted."
        />
      );
    } else if (b.isParentBreakpoint) {
      info_glyph = (
        <span
          className="glyphicon glyphicon-th-list"
          title="Parent breakpoint with one or more child breakpoints. If parent or any child of this tree is deleted, all related breakpoints will be deleted."
        />
      );
      bkpt_num_to_delete = b.number;
    } else {
      bkpt_num_to_delete = b.number;
      info_glyph = "";
    }

    const delete_jsx = this.get_delete_jsx(bkpt_num_to_delete);
    const location_jsx = (
      <FileLink fullname={b.fullNameToDisplay} file={b.fullNameToDisplay} line={b.line} />
    );

    if (b.isParentBreakpoint) {
      function_jsx = (
        <span className="placeholder">
          {info_glyph} parent breakpoint on inline, template, or ambiguous location
        </span>
      );
    } else {
      const func = b.func === undefined ? "(unknown function)" : b.func;
      let break_condition = (
        <div
          onClick={this.on_break_cond_click.bind(this)}
          className="inline"
          title={`${
            this.state.breakpoint_condition ? "Modify or remove" : "Add"
          } breakpoint condition`}
        >
          <span className="glyphicon glyphicon-edit"></span>
          <span className={`italic ${this.state.breakpoint_condition ? "bold" : ""}`}>
            condition
          </span>
        </div>
      );
      if (this.state.editing_breakpoint_condition) {
        break_condition = (
          <input
            type="text"
            style={{
              display: "inline",
              width: "110px",
              padding: "10px 10px",
              height: "25px",
              fontSize: "1em",
            }}
            placeholder="Break condition"
            className="form-control"
            onKeyUp={this.on_key_up_bktp_cond.bind(this, b.number)}
            onChange={this.on_change_bkpt_cond.bind(this)}
            value={this.state.breakpoint_condition}
          />
        );
      }

      const times_hit = this.get_num_times_hit(b);
      function_jsx = (
        <div style={{ display: "inline" }}>
          <span className="monospace" style={{ paddingRight: "5px" }}>
            {info_glyph} {func}
          </span>
          <span
            style={{
              color: "#bbbbbb",
              fontStyle: "italic",
              paddingRight: "5px",
            }}
          >
            thread groups: {b["thread-groups"]}
          </span>
          <span>{break_condition}</span>
          <span
            style={{
              color: "#bbbbbb",
              fontStyle: "italic",
              paddingLeft: "5px",
            }}
          >
            {times_hit}
          </span>
        </div>
      );
    }

    return (
      <div
        className="breakpoint"
        onClick={() => Actions.view_file(b.fullNameToDisplay, b.line)}
      >
        <table
          style={{
            width: "100%",
            fontSize: "0.9em",
            borderWidth: "0px",
          }}
          className="lighttext table-condensed"
        >
          <tbody>
            <tr>
              <td>
                <input
                  type="checkbox"
                  // @ts-expect-error ts-migrate(2322) FIXME: Type 'string' is not assignable to type 'boolean |... Remove this comment to see the full error message
                  checked={checked}
                  onChange={() => Breakpoints.enable_or_disable_bkpt(checked, b.number)}
                />
                {function_jsx} {delete_jsx}
              </td>
            </tr>

            <tr>
              <td>{location_jsx}</td>
            </tr>

            <tr>
              <td>{source_line}</td>
            </tr>
          </tbody>
        </table>
      </div>
    );
  } // render function
}

class Breakpoints extends React.Component {
  constructor() {
    // @ts-expect-error ts-migrate(2554) FIXME: Expected 1-2 arguments, but got 0.
    super();
    // @ts-expect-error ts-migrate(2339) FIXME: Property 'connectComponentState' does not exist on... Remove this comment to see the full error message
    store.connectComponentState(this, ["breakpoints"]);
  }
  render() {
    const breakpoints_jsx = [];
    for (const b of store.get("breakpoints")) {
      breakpoints_jsx.push(<Breakpoint bkpt={b} key={b.number} />);
    }

    if (breakpoints_jsx.length) {
      return breakpoints_jsx;
    } else {
      return <span className="placeholder">no breakpoints</span>;
    }
  }
  static enable_or_disable_bkpt(checked: any, bkpt_num: any) {
    if (checked) {
      GdbApi.run_gdb_command([`-break-disable ${bkpt_num}`, GdbApi.get_break_list_cmd()]);
    } else {
      GdbApi.run_gdb_command([`-break-enable ${bkpt_num}`, GdbApi.get_break_list_cmd()]);
    }
  }
  static set_breakpoint_condition(condition: any, bkpt_num: any) {
    GdbApi.run_gdb_command([
      `-break-condition ${bkpt_num} ${condition}`,
      GdbApi.get_break_list_cmd(),
    ]);
  }
  static remove_breakpoint_if_present(fullname: string, line: number) {
    if (Breakpoints.has_breakpoint(fullname, line)) {
      const number = Breakpoints.get_breakpoint_number(fullname, line);
      const cmd = [GdbApi.get_delete_break_cmd(number), GdbApi.get_break_list_cmd()];
      GdbApi.run_gdb_command(cmd);
    }
  }
  static add_or_remove_breakpoint(fullname: string, line: number) {
    if (Breakpoints.has_breakpoint(fullname, line)) {
      Breakpoints.remove_breakpoint_if_present(fullname, line);
    } else {
      Breakpoints.add_breakpoint(fullname, line);
    }
  }
  static add_breakpoint(fullname: any, line: any) {
    GdbApi.run_gdb_command(GdbApi.get_insert_break_cmd(fullname, line));
  }
  static has_breakpoint(fullname: any, line: any) {
    const bkpts = store.get("breakpoints");
    for (const b of bkpts) {
      if (b.fullname === fullname && b.line === line) {
        return true;
      }
    }
    return false;
  }
  static get_breakpoint_number(fullname: string, line: number) {
    const bkpts = store.get("breakpoints");
    for (const b of bkpts) {
      if (b.fullname === fullname && b.line === line) {
        return b.number;
      }
    }
    console.error(`could not find breakpoint for ${fullname}:${line}`);
  }
  static delete_breakpoint(breakpoint_number: any) {
    GdbApi.run_gdb_command([
      GdbApi.get_delete_break_cmd(breakpoint_number),
      GdbApi.get_break_list_cmd(),
    ]);
  }
  static get_breakpoint_lines_for_file(fullname: any) {
    return store
      .get("breakpoints")
      .filter((b: any) => b.fullNameToDisplay === fullname && b.enabled === "y")
      .map((b: any) => parseInt(b.line));
  }
  static get_disabled_breakpoint_lines_for_file(fullname: any) {
    return store
      .get("breakpoints")
      .filter((b: any) => b.fullNameToDisplay === fullname && b.enabled !== "y")
      .map((b: any) => parseInt(b.line));
  }
  static get_conditional_breakpoint_lines_for_file(fullname: any) {
    return store
      .get("breakpoints")
      .filter((b: any) => b.fullNameToDisplay === fullname && b.cond !== undefined)
      .map((b: any) => parseInt(b.line));
  }
  static save_breakpoints(payload: any) {
    store.set("breakpoints", []);
    if (payload && payload.BreakpointTable && payload.BreakpointTable.body) {
      for (const breakpoint of payload.BreakpointTable.body) {
        Breakpoints.save_breakpoint(breakpoint);
      }
    }
  }
  static save_breakpoint(bkpt: GdbBreakpoint): GdbGuiBreakpoint {
    // parent breakpoints have numbers like "5.6", whereas normal
    // breakpoints and parent breakpoints have numbers like "5"
    const isParentBreakpoint = bkpt.addr === "(MULTIPLE)";
    const isChildBreakpoint = parseInt(bkpt.number) !== parseFloat(bkpt.number);
    const isNormalBreakpoint = !isParentBreakpoint && !isChildBreakpoint;
    const parentBreakpointNumber = isChildBreakpoint ? parseInt(bkpt.number) : null;

    let fullNameToDisplay: Nullable<string>;
    let line = parseInt(bkpt.line);
    if (bkpt.fullname) {
      // this is a normal/child breakpoint; gdb gives it the fullname
      fullNameToDisplay = bkpt.fullname;
    } else if ("original-location" in bkpt && bkpt["original-location"]) {
      // this breakpoint is the parent breakpoint of multiple other breakpoints. gdb does not give it
      // the fullname field, but rather the "original-location" field.
      // example breakpoint['original-location']: /home/file.h:19
      // so we need to parse out the line number, and store it
      [fullNameToDisplay, line] = Util.parse_fullname_and_line(bkpt["original-location"]);
    } else {
      fullNameToDisplay = null;
    }

    const gdbguiBreakpoint = {
      ...bkpt,
      number: parseInt(bkpt.number),
      times: parseInt(bkpt.times),
      line,
      isParentBreakpoint: isParentBreakpoint,
      isChildBreakpoint: isChildBreakpoint,
      isNormalBreakpoint: isNormalBreakpoint,
      parentBreakpointNumber,
      fullNameToDisplay,
    };
    // add the breakpoint if it's not stored already
    const bkpts = store.get("breakpoints");
    if (bkpts.indexOf(gdbguiBreakpoint) === -1) {
      bkpts.push(gdbguiBreakpoint);
      store.set("breakpoints", bkpts);
    }
    return gdbguiBreakpoint;
  }
}

export default Breakpoints;
