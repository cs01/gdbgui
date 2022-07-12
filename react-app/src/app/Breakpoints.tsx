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

export const breakpointEnabledClass = "bg-red-400 rounded-xl border-gray-800 border-4";
export const breakpointDisabledClass = "bg-blue-400 rounded-xl border-gray-800 border-4";

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
  const breakpoint = props.breakpoint;
  const checked = breakpoint.enabled === "y";

  let breakpointNumberToDelete;
  if (breakpoint.isChildBreakpoint) {
    breakpointNumberToDelete = breakpoint.parentBreakpointNumber;
  } else if (breakpoint.isParentBreakpoint) {
    breakpointNumberToDelete = breakpoint.number;
  } else {
    breakpointNumberToDelete = breakpoint.number;
  }

  // if (breakpoint.isParentBreakpoint) {
  //   functionJsx = (
  //     <span className="placeholder">
  //       <ViewListIcon className="icon" /> parent breakpoint on inline, template, or
  //       ambiguous location
  //     </span>
  //   );
  // } else {
  const func = breakpoint.func === undefined ? "(unknown function)" : breakpoint.func;

  // TODO add -break-commands
  // https://sourceware.org/gdb/onlinedocs/gdb/GDB_002fMI-Breakpoint-Commands.html
  const breakCondition = (
    <div className="flex flex-nowrap">
      {editingBreakpointCondition ? (
        <input
          className="input w-full"
          placeholder={"x == 1"}
          onChange={(e: any) => {
            setBreakpointCondition(e.target.value);
            setEditingBreakpointCondition(true);
          }}
          onKeyUp={(e) => {
            if (e.code === "Enter") {
              setEditingBreakpointCondition(false);
              Breakpoints.setBreakpointCondition(
                breakpointCondition,
                props.breakpoint.number
              );
            } else if (e.code === "Escape") {
              setEditingBreakpointCondition(false);
            }
          }}
          value={breakpointCondition}
        />
      ) : null}
      <button
        onClick={() => {
          setEditingBreakpointCondition(!editingBreakpointCondition);
        }}
        title={
          breakpoint.cond
            ? `Current condition: ${breakpoint.cond}. Click to modify or remove breakpoint condition. `
            : "Only break if a certain logical condition is true"
        }
      >
        <PencilAltIcon className={`icon ${breakpoint.cond ? "text-purple-600" : null}`} />
      </button>
    </div>
  );

  return (
    <div className="flex flex-nowrap justify-between text-sm">
      <div className="flex flex-nowrap">
        <input
          title="enable/disable breakpoint"
          className="mx-1"
          type="checkbox"
          checked={checked}
          onChange={() => Breakpoints.toggleEnableBreakpoint(checked, breakpoint.number)}
        />
        {breakpoint.file ? (
          <button
            className="mr-1"
            title={`${breakpoint.func}\n${breakpoint.fullname}:${breakpoint.line}\n${breakpoint.addr}\nHit ${breakpoint.times} time(s)`}
            onClick={() => Handlers.viewFile(breakpoint.fullname, breakpoint.line)}
          >
            {breakpoint.file}
          </button>
        ) : (
          <MemoryLink addr={breakpoint.addr} />
        )}
      </div>
      <div className="mr-1 flex align-middle">
        {breakCondition}

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
          }}
        >
          <XIcon className="icon" />
        </button>
      </div>
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
