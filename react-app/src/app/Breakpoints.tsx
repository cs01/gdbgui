import React from "react";
import { store } from "./GlobalState";
import GdbApi from "./GdbApi";
import Actions from "./Actions";
import { Util } from "./Util";
import FileOps from "./FileOps";
import { FileLink } from "./Links";
import constants from "./constants";
import _ from "lodash";

const BreakpointSourceLineCache = {
  _cache: {},
  getLine: function (fullname: any, linenum: any) {
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
  addLine: function (fullname: any, linenum: any, escapedText: any) {
    // @ts-expect-error
    if (!_.isObject(BreakpointSourceLineCache._cache["fullname"])) {
      // @ts-expect-error ts-migrate(7053) FIXME: Property 'fullname' does not exist on type '{}'.
      BreakpointSourceLineCache._cache["fullname"] = {};
    }
    // @ts-expect-error ts-migrate(7053) FIXME: Property 'fullname' does not exist on type '{}'.
    BreakpointSourceLineCache._cache["fullname"][linenum] = escapedText;
  },
};

type BreakpointState = {
  breakpointCondition: string;
  editingBreakpointCondition: boolean;
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
      breakpointCondition: "",
      editingBreakpointCondition: false,
    };
  }
  getSourceLine(fullname: any, linenum: any) {
    // if we have the source file cached, we can display the line of text
    const MAX_CHARS_TO_SHOW_FROM_SOURCE = 40;
    let line = null;
    if (BreakpointSourceLineCache.getLine(fullname, linenum)) {
      line = BreakpointSourceLineCache.getLine(fullname, linenum);
    } else if (FileOps.lineIsCached(fullname, linenum)) {
      const syntaxHighlightedLine = FileOps.get_line_from_file(fullname, linenum);
      line = _.trim(Util.get_text_from_html(syntaxHighlightedLine));

      if (line.length > MAX_CHARS_TO_SHOW_FROM_SOURCE) {
        line = line.slice(0, MAX_CHARS_TO_SHOW_FROM_SOURCE) + "...";
      }
      BreakpointSourceLineCache.addLine(fullname, linenum, line);
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
  getDeleteJsx(bkptNumToDelete: any) {
    return (
      <div
        style={{ width: "10px", display: "inline" }}
        className="pointer breakpoint_trashcan"
        onClick={(e) => {
          e.stopPropagation();
          Breakpoints.deleteBreakpoint(bkptNumToDelete);
        }}
        title={`Delete breakpoint ${bkptNumToDelete}`}
      >
        <span className="glyphicon glyphicon-trash"> </span>
      </div>
    );
  }
  getNumTimesHit(bkpt: any) {
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
  onChangeBkptCond(e: any) {
    this.setState({
      breakpointCondition: e.target.value,
      editingBreakpointCondition: true,
    });
  }
  onKeyUpBreakpointCondition(number: any, e: any) {
    if (e.keyCode === constants.ENTER_BUTTON_NUM) {
      this.setState({ editingBreakpointCondition: false });
      Breakpoints.setBreakpointCondition(e.target.value, number);
    }
  }
  onClickBreakpointCondition(e: any) {
    this.setState({
      editingBreakpointCondition: true,
    });
  }
  render() {
    const b = this.props.bkpt;
    const checked = b.enabled === "y";
    const sourceLine = this.getSourceLine(b.fullNameToDisplay, b.line);

    let infoGlyph;
    let functionJsx;
    let breakpointNumberToDelete;
    if (b.isChildBreakpoint) {
      breakpointNumberToDelete = b.parentBreakpointNumber;
      infoGlyph = (
        <span
          className="glyphicon glyphicon-th-list"
          title="Child breakpoint automatically created from parent. If parent or any child of this tree is deleted, all related breakpoints will be deleted."
        />
      );
    } else if (b.isParentBreakpoint) {
      infoGlyph = (
        <span
          className="glyphicon glyphicon-th-list"
          title="Parent breakpoint with one or more child breakpoints. If parent or any child of this tree is deleted, all related breakpoints will be deleted."
        />
      );
      breakpointNumberToDelete = b.number;
    } else {
      breakpointNumberToDelete = b.number;
      infoGlyph = "";
    }

    const deleteJsx = this.getDeleteJsx(breakpointNumberToDelete);
    const locationJsx = (
      <FileLink fullname={b.fullNameToDisplay} file={b.fullNameToDisplay} line={b.line} />
    );

    if (b.isParentBreakpoint) {
      functionJsx = (
        <span className="placeholder">
          {infoGlyph} parent breakpoint on inline, template, or ambiguous location
        </span>
      );
    } else {
      const func = b.func === undefined ? "(unknown function)" : b.func;
      let breakCondition = (
        <div
          onClick={this.onClickBreakpointCondition.bind(this)}
          className="inline"
          title={`${
            this.state.breakpointCondition ? "Modify or remove" : "Add"
          } breakpoint condition`}
        >
          <span className="glyphicon glyphicon-edit"></span>
          <span className={`italic ${this.state.breakpointCondition ? "bold" : ""}`}>
            condition
          </span>
        </div>
      );
      if (this.state.editingBreakpointCondition) {
        breakCondition = (
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
            onKeyUp={this.onKeyUpBreakpointCondition.bind(this, b.number)}
            onChange={this.onChangeBkptCond.bind(this)}
            value={this.state.breakpointCondition}
          />
        );
      }

      const timesHit = this.getNumTimesHit(b);
      functionJsx = (
        <div style={{ display: "inline" }}>
          <span className="monospace" style={{ paddingRight: "5px" }}>
            {infoGlyph} {func}
          </span>
          <span className="italic">thread groups: {b["thread-groups"]}</span>
          <span>{breakCondition}</span>
          <span
            style={{
              color: "#bbbbbb",
              fontStyle: "italic",
              paddingLeft: "5px",
            }}
          >
            {timesHit}
          </span>
        </div>
      );
    }

    return (
      <div onClick={() => Actions.viewFile(b.fullNameToDisplay, b.line)}>
        <table className="text-sm">
          <tbody>
            <tr>
              <td>
                <input
                  type="checkbox"
                  checked={checked}
                  onChange={() =>
                    Breakpoints.enableOrDisableBreakpoint(checked, b.number)
                  }
                />
                {functionJsx} {deleteJsx}
              </td>
            </tr>

            <tr>
              <td>{locationJsx}</td>
            </tr>

            <tr>
              <td>{sourceLine}</td>
            </tr>
          </tbody>
        </table>
      </div>
    );
  } // render function
}

export function BreakpointsFn(props: {}) {
  const breakpoints = store.data.breakpoints;
  if (breakpoints.length === 0) {
    return <div>No breakpoints</div>;
  }
  return (
    <div className="py-10">
      <div className="text-lg">Breakpoints</div>
      {breakpoints.map((breakpoint, i) => {
        return <Breakpoint bkpt={breakpoint} key={i} />;
      })}
    </div>
  );
}

class Breakpoints extends React.Component {
  constructor() {
    // @ts-expect-error ts-migrate(2554) FIXME: Expected 1-2 arguments, but got 0.
    super();
    store.reactComponentState(this, ["breakpoints"]);
  }
  render() {
    const breakpointsJsx = [];
    for (const b of store.data.breakpoints) {
      breakpointsJsx.push(<Breakpoint bkpt={b} key={b.number} />);
    }

    if (breakpointsJsx.length) {
      return breakpointsJsx;
    } else {
      return <span className="placeholder">no breakpoints</span>;
    }
  }
  static enableOrDisableBreakpoint(checked: boolean, breakpointNumber: number) {
    if (checked) {
      GdbApi.runGdbCommand([
        `-break-disable ${breakpointNumber}`,
        GdbApi.get_break_list_cmd(),
      ]);
    } else {
      GdbApi.runGdbCommand([
        `-break-enable ${breakpointNumber}`,
        GdbApi.get_break_list_cmd(),
      ]);
    }
  }
  static setBreakpointCondition(condition: string, breakpointNumber: number) {
    GdbApi.runGdbCommand([
      `-break-condition ${breakpointNumber} ${condition}`,
      GdbApi.get_break_list_cmd(),
    ]);
  }
  static removeBreakpointIfPresent(fullname: string, line: number) {
    if (Breakpoints.hasBreakpoint(fullname, line)) {
      const number = Breakpoints.getBreakpointNumber(fullname, line);
      const cmd = [GdbApi.requestDeleteBreakpoint(number), GdbApi.get_break_list_cmd()];
      GdbApi.runGdbCommand(cmd);
    }
  }
  static toggleBreakpoint(fullname: string, line: number) {
    if (Breakpoints.hasBreakpoint(fullname, line)) {
      Breakpoints.removeBreakpointIfPresent(fullname, line);
    } else {
      Breakpoints.addBreakpoint(fullname, line);
    }
  }
  static addBreakpoint(fullname: string, line: number) {
    GdbApi.requestAddBreakpoint(fullname, line);
  }
  static hasBreakpoint(fullname: any, line: any) {
    const bkpts = store.data.breakpoints;
    for (const b of bkpts) {
      if (b.fullname === fullname && b.line === line) {
        return true;
      }
    }
    return false;
  }
  static getBreakpointNumber(fullname: string, line: number) {
    const bkpts = store.data.breakpoints;
    for (const b of bkpts) {
      if (b.fullname === fullname && b.line === line) {
        return b.number;
      }
    }
    console.error(`could not find breakpoint for ${fullname}:${line}`);
  }
  static deleteBreakpoint(breakpointNumber: number) {
    GdbApi.runGdbCommand([
      GdbApi.requestDeleteBreakpoint(breakpointNumber),
      GdbApi.get_break_list_cmd(),
    ]);
  }
  static getBreakpointLinesForFile(fullname: any) {
    return store.data.breakpoints
      .filter((b: any) => b.fullNameToDisplay === fullname && b.enabled === "y")
      .map((b: any) => parseInt(b.line));
  }
  static getDisabledBreakpointLinesForFile(fullname: any) {
    return store.data.breakpoints
      .filter((b: any) => b.fullNameToDisplay === fullname && b.enabled !== "y")
      .map((b: any) => parseInt(b.line));
  }
  static getConditionalBreakpointLinesForFile(fullname: any) {
    return store.data.breakpoints
      .filter((b: any) => b.fullNameToDisplay === fullname && b.cond !== undefined)
      .map((b: any) => parseInt(b.line));
  }
  static saveBreakpoints(payload: any) {
    store.set("breakpoints", []);
    if (payload && payload.BreakpointTable && payload.BreakpointTable.body) {
      for (const breakpoint of payload.BreakpointTable.body) {
        Breakpoints.saveBreakpoint(breakpoint);
      }
    }
  }
  static saveBreakpoint(bkpt: GdbBreakpoint): GdbGuiBreakpoint {
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
    const bkpts = store.data.breakpoints;
    if (bkpts.indexOf(gdbguiBreakpoint) === -1) {
      bkpts.push(gdbguiBreakpoint);
      store.set("breakpoints", bkpts);
    }
    return gdbguiBreakpoint;
  }
}

export default Breakpoints;
