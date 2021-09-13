/**
 * A component to render source code, assembly, and break points
 */

import { store } from "statorgfc";
import React from "react";
import FileOps from "./FileOps";
import Breakpoints from "./Breakpoints";
import Memory from "./Memory";
import MemoryLink from "./MemoryLink";
import constants from "./constants";
import Actions from "./Actions";
import $ from "jquery";

type State = any;

class SourceCode extends React.Component<{}, State> {
  static elCodeContainer = null; // todo: no jquery
  static elCodeContainerNode = null;
  static codeContainerNode = null;
  static viewMoreTopNode = null;
  static viewMoreBottomNode = null;

  constructor() {
    // @ts-expect-error ts-migrate(2554) FIXME: Expected 1-2 arguments, but got 0.
    super();
    // @ts-expect-error ts-migrate(2339) FIXME: Property 'connectComponentState' does not exist on... Remove this comment to see the full error message
    store.connectComponentState(this, [
      "fullname_to_render",
      "cached_source_files",
      "missing_files",
      "disassembly_for_missing_file",
      "line_of_source_to_flash",
      "paused_on_frame",
      "breakpoints",
      "source_code_state",
      "make_current_line_visible",
      "source_code_selection_state",
      "current_theme",
      "inferior_binary_path",
      "source_linenum_to_display_start",
      "source_linenum_to_display_end",
      "max_lines_of_code_to_fetch",
      "source_code_infinite_scrolling",
    ]);

    // bind methods
    this.getBodyAsmOnly = this.getBodyAsmOnly.bind(this);
    this._getSourceline = this._getSourceline.bind(this);
    this._getAsmRow = this._getAsmRow.bind(this);
    this.clickGutter = this.clickGutter.bind(this);
    this.isGdbPausedOnThisLine = this.isGdbPausedOnThisLine.bind(this);
  }

  render() {
    return (
      <div className={this.state.current_theme} style={{ height: "100%" }}>
        <table
          id="code_table"
          className={this.state.current_theme}
          style={{ width: "100%" }}
        >
          <tbody id="code_body">{this.get_body()}</tbody>
        </table>
      </div>
    );
  }

  componentDidUpdate() {
    const source_is_displayed =
      this.state.source_code_state === constants.source_code_states.SOURCE_CACHED ||
      this.state.source_code_state ===
        constants.source_code_states.ASSM_AND_SOURCE_CACHED;
    if (source_is_displayed) {
      if (this.state.make_current_line_visible) {
        const success = SourceCode.make_current_line_visible();
        if (success) {
          store.set("make_current_line_visible", false);
        }
      }
    }
  }

  get_body() {
    const states = constants.source_code_states;
    switch (this.state.source_code_state) {
      case states.ASSM_AND_SOURCE_CACHED: // fallthrough
      case states.SOURCE_CACHED: {
        const obj = FileOps.get_source_file_obj_from_cache(this.state.fullname_to_render);
        if (!obj) {
          console.error("expected to find source file");
          return this.get_body_empty();
        }
        const paused_addr = this.state.paused_on_frame
          ? this.state.paused_on_frame.addr
          : null;
        const start_linenum = store.get("source_linenum_to_display_start");
        const end_linenum = store.get("source_linenum_to_display_end");
        return this.get_body_source_and_assm(
          obj.fullname,
          obj.source_code_obj,
          obj.assembly,
          paused_addr,
          start_linenum,
          end_linenum,
          obj.num_lines_in_file
        );
      }
      case states.FETCHING_SOURCE: {
        return (
          <tr>
            <td>fetching source, please wait</td>
          </tr>
        );
      }
      case states.ASSM_CACHED: {
        const pausedAddr = this.state.paused_on_frame
          ? this.state.paused_on_frame.addr
          : null;
        const asmArray = this.state.disassembly_for_missing_file;
        return this.getBodyAsmOnly(asmArray, pausedAddr);
      }
      case states.FETCHING_ASSM: {
        return (
          <tr>
            <td>fetching assembly, please wait</td>
          </tr>
        );
      }
      case states.ASSM_UNAVAILABLE: {
        const paused_addr = this.state.paused_on_frame
          ? this.state.paused_on_frame.addr
          : null;
        return (
          <tr>
            <td>cannot access address {paused_addr}</td>
          </tr>
        );
      }
      case states.FILE_MISSING: {
        return (
          <tr>
            <td>file not found: {this.state.fullname_to_render}</td>
          </tr>
        );
      }
      case states.NONE_AVAILABLE: {
        return this.get_body_empty();
      }
      default: {
        console.error("developer error: unhandled state");
        return this.get_body_empty();
      }
    }
  }
  clickGutter(lineNum: any) {
    Breakpoints.addOrRemoveBreakpoint(this.state.fullname_to_render, lineNum);
  }

  _getSourceline(
    source: any,
    lineShouldFlash: any,
    isGdbPausedOnThisline: any,
    lineNumBeingRendered: any,
    hasBreakpoint: boolean,
    hasDisabledBreakpoint: any,
    hasConditionalBreakpoint: any,
    asmForLine: any,
    pausedAddr: any
  ) {
    const rowClasses = ["srccode"];

    if (isGdbPausedOnThisline) {
      rowClasses.push("paused_on_line");
    } else if (lineShouldFlash) {
      rowClasses.push("flash");
    }

    let id = "";
    if (
      this.state.source_code_selection_state ===
      constants.source_code_selection_states.PAUSED_FRAME
    ) {
      if (isGdbPausedOnThisline) {
        id = "scroll_to_line";
      }
    } else if (
      this.state.source_code_selection_state ===
      constants.source_code_selection_states.USER_SELECTION
    ) {
      if (lineShouldFlash) {
        id = "scroll_to_line";
      }
    }

    let gutterClass = "";
    if (hasDisabledBreakpoint) {
      gutterClass = "disabled_breakpoint";
    } else if (hasConditionalBreakpoint) {
      gutterClass = "conditional_breakpoint";
    } else if (hasBreakpoint) {
      gutterClass = "breakpoint";
    }

    const assembly_content = [];
    if (asmForLine) {
      let i = 0;
      for (const assm of asmForLine) {
        assembly_content.push(SourceCode._get_assm_content(i, assm, pausedAddr));
        assembly_content.push(<br key={"br" + i} />);
        i++;
      }
    }

    return (
      <tr id={id} key={lineNumBeingRendered} className={`${rowClasses.join(" ")}`}>
        {this.get_linenum_td(lineNumBeingRendered, gutterClass)}

        <td style={{ verticalAlign: "top" }} className="loc">
          <span className="wsp" dangerouslySetInnerHTML={{ __html: source }} />
        </td>

        <td className="assembly">{assembly_content}</td>
      </tr>
    );
  }
  get_linenum_td(linenum: any, gutter_cls = "") {
    return (
      <td
        style={{ verticalAlign: "top", width: "30px" }}
        className={"line_num " + gutter_cls}
        onClick={() => {
          this.clickGutter(linenum);
        }}
      >
        <div>{linenum}</div>
      </td>
    );
  }

  /**
   * example return value: mov $0x400684,%edi(00) main+8 0x0000000000400585
   */
  static _get_assm_content(key: any, assm: any, paused_addr: any) {
    const opcodes = assm.opcodes ? (
      <span className="instrContent">{`(${assm.opcodes})`}</span>
    ) : (
      ""
    );
    const instruction = Memory.make_addrs_into_links_react(assm.inst);
    const func_name = assm["func-name"];
    const offset = assm.offset;
    const addr = assm.address;
    const on_current_instruction = paused_addr === assm.address;
    const cls = on_current_instruction ? "current_assembly_command" : "";
    const asterisk = on_current_instruction ? (
      <span
        className="glyphicon glyphicon-chevron-right"
        style={{ width: "10px", display: "inline-block" }}
      />
    ) : (
      <span style={{ width: "10px", display: "inline-block" }}> </span>
    );
    return (
      <span key={key} style={{ whiteSpace: "nowrap" }} className={cls}>
        {/* @ts-expect-error ts-migrate(2769) FIXME: Property 'fontFamily' is missing in type '{ paddin... Remove this comment to see the full error message */}
        {asterisk} <MemoryLink addr={addr} style={{ paddingRight: "5px" }} />
        {opcodes /* i.e. mov */}
        <span className="instrContent">{instruction}</span>
        {func_name ? (
          <span>
            {func_name}+{offset}
          </span>
        ) : (
          ""
        )}
      </span>
    );
  }

  _getAsmRow(key: any, assm: any, paused_addr: any) {
    return (
      <tr key={key} className="srccode">
        <td className="assembly loc">
          {SourceCode._get_assm_content(key, assm, paused_addr)}
        </td>
      </tr>
    );
  }

  isGdbPausedOnThisLine(line_num_being_rendered: any, line_gdb_is_paused_on: any) {
    if (this.state.paused_on_frame) {
      return (
        line_num_being_rendered === line_gdb_is_paused_on &&
        this.state.paused_on_frame.fullname === this.state.fullname_to_render
      );
    } else {
      return false;
    }
  }
  get_view_more_tr(fullname: any, linenum: any, node_key: any) {
    return (
      // @ts-expect-error ts-migrate(7053) FIXME: Element implicitly has an 'any' type because expre... Remove this comment to see the full error message
      <tr key={linenum} className="srccode" ref={(el) => (SourceCode[node_key] = el)}>
        <td />
        <td
          onClick={() => {
            Actions.view_file(fullname, linenum);
          }}
          style={{ fontStyle: "italic", paddingLeft: "10px" }}
          className="pointer"
        >
          view more
        </td>
      </tr>
    );
  }
  get_end_of_file_tr(linenum: any) {
    return (
      <tr key={linenum}>
        <td />
        <td style={{ fontStyle: "italic", paddingLeft: "10px", fontSize: "0.8em" }}>
          (end of file)
        </td>
      </tr>
    );
  }
  get_line_nums_to_render(
    source_code_obj: any,
    start_linenum: any,
    line_to_flash: any,
    end_linenum: any
  ) {
    let start_linenum_to_render = start_linenum;
    let end_linenum_to_render = end_linenum;
    let linenum = start_linenum;

    // go backwards from center until missing element is found
    // linenum >= start_linenum &&
    while (linenum < end_linenum) {
      if (source_code_obj.hasOwnProperty(linenum)) {
        start_linenum_to_render = linenum;
        break;
      } else {
        linenum++;
      }
    }

    linenum = end_linenum;
    while (linenum > start_linenum) {
      if (source_code_obj.hasOwnProperty(linenum)) {
        end_linenum_to_render = linenum;
        break;
      } else {
        linenum--;
      }
    }
    return { start_linenum_to_render, end_linenum_to_render };
  }
  get_body_source_and_assm(
    fullname: any,
    source_code_obj: any,
    assembly: any,
    paused_addr: any,
    start_linenum: any,
    end_linenum: any,
    num_lines_in_file: any
  ) {
    const body = [];

    const breakpointLines = Breakpoints.getBreakpointLinesForFile(
      this.state.fullname_to_render
    );
    const disabledBreakpointLines = Breakpoints.getDisabledBreakpointLinesForFile(
      this.state.fullname_to_render
    );
    const conditionalBreakpointLines = Breakpoints.getConditionalBreakpointLinesForFile(
      this.state.fullname_to_render
    );
    const gdbPausedOnLine = this.state.paused_on_frame
      ? parseInt(this.state.paused_on_frame.line)
      : 0;

    const line_of_source_to_flash = this.state.line_of_source_to_flash;
    const { start_linenum_to_render, end_linenum_to_render } =
      this.get_line_nums_to_render(
        source_code_obj,
        start_linenum,
        line_of_source_to_flash,
        end_linenum
      );

    let line_num_being_rendered = start_linenum_to_render;
    while (line_num_being_rendered <= end_linenum_to_render) {
      const currentLineOfCode = source_code_obj[line_num_being_rendered];
      const hasBreakpoint = breakpointLines.indexOf(line_num_being_rendered) !== -1;
      const hasDisabledBreakpoint =
        disabledBreakpointLines.indexOf(line_num_being_rendered) !== -1;
      const hasConditionalBreakpoint =
        conditionalBreakpointLines.indexOf(line_num_being_rendered) !== -1;
      const isGdbPausedOnThisLine = this.isGdbPausedOnThisLine(
        line_num_being_rendered,
        gdbPausedOnLine
      );
      const asmForLine = assembly[line_num_being_rendered];

      body.push(
        this._getSourceline(
          currentLineOfCode,
          line_of_source_to_flash === line_num_being_rendered,
          isGdbPausedOnThisLine,
          line_num_being_rendered,
          hasBreakpoint,
          hasDisabledBreakpoint,
          hasConditionalBreakpoint,
          asmForLine,
          paused_addr
        )
      );
      line_num_being_rendered++;
    }

    SourceCode.viewMoreTopNode = null;
    SourceCode.viewMoreBottomNode = null;

    // add "view more" buttons if necessary
    if (start_linenum_to_render > start_linenum) {
      body.unshift(
        this.get_view_more_tr(fullname, start_linenum_to_render - 1, "view_more_top_node")
      );
    } else if (start_linenum !== 1) {
      body.unshift(
        this.get_view_more_tr(fullname, start_linenum - 1, "view_more_top_node")
      );
    }

    if (end_linenum_to_render < end_linenum) {
      body.push(
        this.get_view_more_tr(
          fullname,
          end_linenum_to_render + 1,
          "view_more_bottom_node"
        )
      );
    } else if (end_linenum < num_lines_in_file) {
      body.push(
        this.get_view_more_tr(fullname, line_num_being_rendered, "view_more_bottom_node")
      );
    }

    if (end_linenum_to_render === num_lines_in_file) {
      body.push(this.get_end_of_file_tr(num_lines_in_file + 1));
    }
    return body;
  }

  getBodyAsmOnly(assm_array: any, paused_addr: any) {
    const body = [];
    let i = 0;
    for (const assm of assm_array) {
      body.push(this._getAsmRow(i, assm, paused_addr));
      i++;
    }
    return body;
  }

  get_body_empty() {
    return (
      <tr>
        <td>no source code or assembly to display</td>
      </tr>
    );
  }
  static make_current_line_visible() {
    return SourceCode._makeJqSelectorVisible($("#scroll_to_line"));
  }
  static is_source_line_visible(jq_selector: any) {
    if (jq_selector.length !== 1) {
      // make sure something is selected before trying to scroll to it
      throw new Error("Unexpected jquery selector");
    }

    // @ts-expect-error ts-migrate(2531) FIXME: Object is possibly 'null'.
    const top_of_container = SourceCode.elCodeContainer.position().top;
    // @ts-expect-error ts-migrate(2531) FIXME: Object is possibly 'null'.
    const containerHeight = SourceCode.elCodeContainer.height();
    const containerBottom = top_of_container + containerHeight;
    const lineTop = jq_selector.position().top;
    const lineBottom = lineTop + jq_selector.height();
    const tableTop = jq_selector.closest("table").position().top;
    const isVisible = lineTop >= top_of_container && lineBottom <= containerBottom;

    if (isVisible) {
      return {
        isVisible: true,
        topOfLine: lineTop,
        topOfTable: tableTop,
        heightOfContainer: containerHeight,
      };
    } else {
      return {
        isVisible: false,
        topOfLine: lineTop,
        topOfTable: tableTop,
        heightOfContainer: containerHeight,
      };
    }
  }
  /**
   * Scroll to a jQuery selection in the source code table
   * Used to jump around to various lines
   * returns true on success
   */
  static _makeJqSelectorVisible(jqSelector: any) {
    if (jqSelector.length === 1) {
      // make sure something is selected before trying to scroll to it
      const {
        isVisible: is_visible,
        topOfLine: top_of_line,
        topOfTable: top_of_table,
        heightOfContainer: height_of_container,
      } = SourceCode.is_source_line_visible(jqSelector);

      if (!is_visible) {
        // line is out of view, scroll so it's in the middle of the table
        const time_to_scroll = 0;
        const scroll_top = top_of_line - (top_of_table + height_of_container / 2);
        // @ts-expect-error ts-migrate(2531) FIXME: Object is possibly 'null'.
        SourceCode.elCodeContainer.animate({ scrollTop: scroll_top }, time_to_scroll);
      }
      return true;
    } else {
      return false;
    }
  }
}

export default SourceCode;
