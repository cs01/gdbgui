import React, { useState } from "react";
import { store, useGlobalValue } from "./Store";
import GdbApi from "./GdbApi";
import Handlers from "./EventHandlers";
import { Util } from "./Util";
import FileOps from "./FileOps";
import { FileLink } from "./Links";
import constants from "./constants";
import _ from "lodash";
import {
  ChevronDownIcon,
  ChevronRightIcon,
  ViewListIcon,
  PencilAltIcon,
  TrashIcon,
  XIcon,
} from "@heroicons/react/solid";
import MemoryLink from "./MemoryLink";
import { GdbBreakpoint as GdbMiBreakpoint, GdbGuiBreakpoint } from "./types";

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

function Breakpoint(props: { breakpoint: GdbGuiBreakpoint }) {
  const [breakpointCondition, setBreakpointCondition] = useState("");
  const [editingBreakpointCondition, setEditingBreakpointCondition] = useState(false);

  // const getSourceLine = (fullname: any, linenum: any) => {
  //   // if we have the source file cached, we can display the line of text
  //   const MAX_CHARS_TO_SHOW_FROM_SOURCE = 40;
  //   let line = null;
  //   if (BreakpointSourceLineCache.getLine(fullname, linenum)) {
  //     line = BreakpointSourceLineCache.getLine(fullname, linenum);
  //   } else if (FileOps.lineIsCached(fullname, linenum)) {
  //     const syntaxHighlightedLine = FileOps.get_line_from_file(fullname, linenum);
  //     line = _.trim(Util.get_text_from_html(syntaxHighlightedLine));

  //     if (line.length > MAX_CHARS_TO_SHOW_FROM_SOURCE) {
  //       line = line.slice(0, MAX_CHARS_TO_SHOW_FROM_SOURCE) + "...";
  //     }
  //     BreakpointSourceLineCache.addLine(fullname, linenum, line);
  //   }

  //   if (line) {
  //     return (
  //       <span className="monospace" style={{ whiteSpace: "nowrap", fontSize: "0.9em" }}>
  //         {line || <br />}
  //       </span>
  //     );
  //   }
  //   return "(file not cached)";

  const getNumTimesHit = () => {
    if (
      props.breakpoint.times === undefined || // E.g. 'bkpt' is a child breakpoint
      props.breakpoint.times === 0
    ) {
      return "";
    } else if (props.breakpoint.times === 1) {
      return "1 hit";
    } else {
      return `${props.breakpoint.times} hits`;
    }
  };
  const onChangeBkptCond = (e: any) => {
    setBreakpointCondition(e.target.value);
    setEditingBreakpointCondition(true);
  };
  const onKeyUpBreakpointCondition = (e: any) => {
    if (e.keyCode === constants.ENTER_BUTTON_NUM) {
      setEditingBreakpointCondition(false);
      Breakpoints.setBreakpointCondition(e.target.value, props.breakpoint.number);
    }
  };
  const onClickBreakpointCondition = (e: any) => {
    setEditingBreakpointCondition(true);
  };

  const breakpoint = props.breakpoint;
  const checked = breakpoint.enabled === "y";
  // const sourceLine = getSourceLine(breakpoint.fullNameToDisplay, breakpoint.line);

  let functionJsx;
  let breakpointNumberToDelete;
  if (breakpoint.isChildBreakpoint) {
    breakpointNumberToDelete = breakpoint.parentBreakpointNumber;
  } else if (breakpoint.isParentBreakpoint) {
    breakpointNumberToDelete = breakpoint.number;
  } else {
    breakpointNumberToDelete = breakpoint.number;
  }

  const locationJsx = (
    <FileLink
      fullname={breakpoint.fullNameToDisplay}
      file={breakpoint.fullNameToDisplay}
      line={breakpoint.line}
    />
  );

  if (breakpoint.isParentBreakpoint) {
    functionJsx = (
      <span className="placeholder">
        <ViewListIcon className="icon" /> parent breakpoint on inline, template, or
        ambiguous location
      </span>
    );
  } else {
    const func = breakpoint.func === undefined ? "(unknown function)" : breakpoint.func;

    const breakCondition = editingBreakpointCondition ? (
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
        onKeyUp={onKeyUpBreakpointCondition}
        onChange={onChangeBkptCond}
        value={breakpointCondition}
      />
    ) : (
      <div
        onClick={onClickBreakpointCondition}
        className="inline"
        title={`${breakpointCondition ? "Modify or remove" : "Add"} breakpoint condition`}
      >
        <button>
          <PencilAltIcon className="icon" />
        </button>
        <span className={`font-italic ${breakpointCondition ? "font-bold" : ""}`}>
          condition
        </span>
      </div>
    );

    functionJsx = (
      <div className="flex hover:bg-red-500">
        <span className="">
          {/* {func} */}
          {breakpoint.file}
        </span>
        {/* <span className="italic">thread groups: {breakpoint["thread-groups"]}</span> */}
        {/* <span>{breakCondition}</span> */}
        <span className="font-italic">{getNumTimesHit()}</span>
      </div>
    );
  }

  return (
    <div
      className="my-1 "
      onClick={() => Handlers.viewFile(breakpoint.fullNameToDisplay, breakpoint.line)}
    >
      <div className="flex justify-between text-sm">
        <div>
          <input
            className="mx-1"
            type="checkbox"
            checked={checked}
            onChange={() =>
              Breakpoints.toggleEnableBreakpoint(checked, breakpoint.number)
            }
          />
          {breakpoint.file ? (
            <button
              title={`${breakpoint.func}()\n${breakpoint.fullname}:${breakpoint.line}\n${breakpoint.addr}\nHit ${breakpoint.times} time(s)`}
              onClick={() => Handlers.viewFile(breakpoint.fullname, breakpoint.line)}
            >
              {breakpoint.file}
            </button>
          ) : (
            <MemoryLink addr={breakpoint.addr} />
          )}
        </div>
        <div className="mr-1 flex align-middle">
          {breakpoint.line ? (
            <span title="line number" className="text-xs bg-gray-600 rounded-lg mx-1 p-1">
              {breakpoint.line}
            </span>
          ) : null}
          <button
            title="Remove Breakpoint"
            className=" "
            onClick={() => {
              Breakpoints.deleteBreakpoint(
                breakpoint.isChildBreakpoint && breakpoint.parentBreakpointNumber
                  ? breakpoint.parentBreakpointNumber
                  : breakpoint.number
              );

              //   <div
              //   style={{ width: "10px", display: "inline" }}
              //   className="pointer"
              //   onClick={(e) => {
              //     e.stopPropagation();
              //     Breakpoints.deleteBreakpoint(bkptNumToDelete);
              //   }}
              //   title={`Delete breakpoint ${bkptNumToDelete}`}
              // >
              //   <span className="glyphicon glyphicon-trash"> </span>
              // </div>
            }}
          >
            <XIcon className="icon" />
          </button>
        </div>
      </div>
      {/* <div>{locationJsx}</div> */}
      {/* <div>{sourceLine}</div> */}
    </div>
  );
}

export function BreakpointsFn(props: {}) {
  const breakpoints = useGlobalValue<typeof store.data.breakpoints>("breakpoints");
  if (breakpoints.length === 0) {
    return null;
  }
  return (
    <div>
      {breakpoints.length ? (
        <button
          className="flex items-center mb-2 hover:bg-gray-800"
          onClick={() => {
            Breakpoints.deleteAllBreakpoints();
          }}
        >
          <TrashIcon className="icon " />
          <span className="text-xs">Delete all</span>
        </button>
      ) : null}
      {breakpoints.map((breakpoint, i) => {
        return <Breakpoint breakpoint={breakpoint} key={i} />;
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
      breakpointsJsx.push(<Breakpoint breakpoint={b} key={b.number} />);
    }

    if (breakpointsJsx.length) {
      return breakpointsJsx;
    } else {
      return <span className="placeholder">no breakpoints</span>;
    }
  }
  static toggleEnableBreakpoint(checked: boolean, breakpointNumber: number) {
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
      const breakpointNumber = Breakpoints.getBreakpointNumber(fullname, line);
      if (breakpointNumber) {
        GdbApi.requestDeleteBreakpoint(breakpointNumber);
      }
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
  static getBreakpointNumber(fullname: string, line: number): Nullable<number> {
    const bkpts = store.data.breakpoints;
    for (const b of bkpts) {
      if (b.fullname === fullname && b.line === line) {
        return b.number;
      }
    }
    console.error(`could not find breakpoint for ${fullname}:${line}`);
    return null;
  }
  static deleteBreakpoint(breakpointNumber: number) {
    GdbApi.requestDeleteBreakpoint(breakpointNumber);
  }
  static deleteAllBreakpoints() {
    GdbApi.runGdbCommand([`-break-delete`]);
    GdbApi.requestBreakpointList();
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
  static saveBreakpoint(bkpt: GdbMiBreakpoint): GdbGuiBreakpoint {
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

    const gdbguiBreakpoint: GdbGuiBreakpoint = {
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
    if (!bkpts.includes(gdbguiBreakpoint)) {
      bkpts.push(gdbguiBreakpoint);
      store.set("breakpoints", bkpts);
    }
    return gdbguiBreakpoint;
  }
}

export default Breakpoints;
