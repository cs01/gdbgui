/**
 * A component to render source code, assembly, and break points
 */

import { store } from "statorgfc";
import React from "react";
import FileOps from "./FileOps.jsx";
import Breakpoints from "./Breakpoints.jsx";
import Memory from "./Memory.jsx";
import MemoryLink from "./MemoryLink";
import constants from "./constants.js";
import Actions from "./Actions.js";

class SourceCode extends React.Component {
  static el_code_container = null; // todo: no jquery
  static el_code_container_node = null;
  static code_container_node = null;
  static view_more_top_node = null;
  static view_more_bottom_node = null;

  constructor() {
    super();
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
      "source_code_infinite_scrolling"
    ]);

    // bind methods
    this.get_body_assembly_only = this.get_body_assembly_only.bind(this);
    this._get_source_line = this._get_source_line.bind(this);
    this._get_assm_row = this._get_assm_row.bind(this);
    this.click_gutter = this.click_gutter.bind(this);
    this.is_gdb_paused_on_this_line = this.is_gdb_paused_on_this_line.bind(this);
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
    let source_is_displayed =
      this.state.source_code_state === constants.source_code_states.SOURCE_CACHED ||
      this.state.source_code_state ===
        constants.source_code_states.ASSM_AND_SOURCE_CACHED;
    if (source_is_displayed) {
      if (this.state.make_current_line_visible) {
        let success = SourceCode.make_current_line_visible();
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
        let obj = FileOps.get_source_file_obj_from_cache(this.state.fullname_to_render);
        if (!obj) {
          console.error("expected to find source file");
          return this.get_body_empty();
        }
        let paused_addr = this.state.paused_on_frame
            ? this.state.paused_on_frame.addr
            : null,
          start_linenum = store.get("source_linenum_to_display_start"),
          end_linenum = store.get("source_linenum_to_display_end");
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
        let paused_addr = this.state.paused_on_frame
            ? this.state.paused_on_frame.addr
            : null,
          assm_array = this.state.disassembly_for_missing_file;
        return this.get_body_assembly_only(assm_array, paused_addr);
      }
      case states.FETCHING_ASSM: {
        return (
          <tr>
            <td>fetching assembly, please wait</td>
          </tr>
        );
      }
      case states.ASSM_UNAVAILABLE: {
        let paused_addr = this.state.paused_on_frame
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
  click_gutter(line_num) {
    Breakpoints.add_or_remove_breakpoint(this.state.fullname_to_render, line_num);
  }

  _get_source_line(
    source,
    line_should_flash,
    is_gdb_paused_on_this_line,
    line_num_being_rendered,
    has_bkpt,
    has_disabled_bkpt,
    assembly_for_line,
    paused_addr
  ) {
    let row_class = ["srccode"];

    if (is_gdb_paused_on_this_line) {
      row_class.push("paused_on_line");
    } else if (line_should_flash) {
      row_class.push("flash");
    }

    let id = "";
    if (
      this.state.source_code_selection_state ===
      constants.source_code_selection_states.PAUSED_FRAME
    ) {
      if (is_gdb_paused_on_this_line) {
        id = "scroll_to_line";
      }
    } else if (
      this.state.source_code_selection_state ===
      constants.source_code_selection_states.USER_SELECTION
    ) {
      if (line_should_flash) {
        id = "scroll_to_line";
      }
    }

    let gutter_cls = "";
    if (has_bkpt) {
      gutter_cls = "breakpoint";
    } else if (has_disabled_bkpt) {
      gutter_cls = "disabled_breakpoint";
    }

    let assembly_content = [];
    if (assembly_for_line) {
      let i = 0;
      for (let assm of assembly_for_line) {
        assembly_content.push(SourceCode._get_assm_content(i, assm, paused_addr));
        assembly_content.push(<br key={"br" + i} />);
        i++;
      }
    }

    return (
      <tr id={id} key={line_num_being_rendered} className={`${row_class.join(" ")}`}>
        {this.get_linenum_td(line_num_being_rendered, gutter_cls)}

        <td style={{ verticalAlign: "top" }} className="loc">
          <span className="wsp" dangerouslySetInnerHTML={{ __html: source }} />
        </td>

        <td className="assembly">{assembly_content}</td>
      </tr>
    );
  }
  get_linenum_td(linenum, gutter_cls = "") {
    return (
      <td
        style={{ verticalAlign: "top", width: "30px" }}
        className={"line_num " + gutter_cls}
        onClick={() => {
          this.click_gutter(linenum);
        }}
      >
        <div>{linenum}</div>
      </td>
    );
  }

  /**
   * example return value: mov $0x400684,%edi(00) main+8 0x0000000000400585
   */
  static _get_assm_content(key, assm, paused_addr) {
    let opcodes = assm.opcodes ? (
        <span className="instrContent">{`(${assm.opcodes})`}</span>
      ) : (
        ""
      ),
      instruction = Memory.make_addrs_into_links_react(assm.inst),
      func_name = assm["func-name"],
      offset = assm.offset,
      addr = assm.address,
      on_current_instruction = paused_addr === assm.address,
      cls = on_current_instruction ? "current_assembly_command" : "",
      asterisk = on_current_instruction ? (
        <span
          className="glyphicon glyphicon-chevron-right"
          style={{ width: "10px", display: "inline-block" }}
        />
      ) : (
        <span style={{ width: "10px", display: "inline-block" }}> </span>
      );
    return (
      <span key={key} style={{ whiteSpace: "nowrap" }} className={cls}>
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

  _get_assm_row(key, assm, paused_addr) {
    return (
      <tr key={key} className="srccode">
        <td className="assembly loc">
          {SourceCode._get_assm_content(key, assm, paused_addr)}
        </td>
      </tr>
    );
  }

  is_gdb_paused_on_this_line(line_num_being_rendered, line_gdb_is_paused_on) {
    if (this.state.paused_on_frame) {
      return (
        line_num_being_rendered === line_gdb_is_paused_on &&
        this.state.paused_on_frame.fullname === this.state.fullname_to_render
      );
    } else {
      return false;
    }
  }
  get_view_more_tr(fullname, linenum, node_key) {
    return (
      <tr key={linenum} className="srccode" ref={el => (SourceCode[node_key] = el)}>
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
  get_end_of_file_tr(linenum) {
    return (
      <tr key={linenum}>
        <td />
        <td style={{ fontStyle: "italic", paddingLeft: "10px", fontSize: "0.8em" }}>
          (end of file)
        </td>
      </tr>
    );
  }
  get_line_nums_to_render(source_code_obj, start_linenum, line_to_flash, end_linenum) {
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
    fullname,
    source_code_obj,
    assembly,
    paused_addr,
    start_linenum,
    end_linenum,
    num_lines_in_file
  ) {
    let body = [];

    let bkpt_lines = Breakpoints.get_breakpoint_lines_for_file(
        this.state.fullname_to_render
      ),
      disabled_breakpoint_lines = Breakpoints.get_disabled_breakpoint_lines_for_file(
        this.state.fullname_to_render
      ),
      line_gdb_is_paused_on = this.state.paused_on_frame
        ? parseInt(this.state.paused_on_frame.line)
        : 0;

    const line_of_source_to_flash = this.state.line_of_source_to_flash;
    const {
      start_linenum_to_render,
      end_linenum_to_render
    } = this.get_line_nums_to_render(
      source_code_obj,
      start_linenum,
      line_of_source_to_flash,
      end_linenum
    );

    let line_num_being_rendered = start_linenum_to_render;
    while (line_num_being_rendered <= end_linenum_to_render) {
      let cur_line_of_code = source_code_obj[line_num_being_rendered];
      let has_bkpt = bkpt_lines.indexOf(line_num_being_rendered) !== -1,
        has_disabled_bkpt =
          disabled_breakpoint_lines.indexOf(line_num_being_rendered) !== -1,
        is_gdb_paused_on_this_line = this.is_gdb_paused_on_this_line(
          line_num_being_rendered,
          line_gdb_is_paused_on
        ),
        assembly_for_line = assembly[line_num_being_rendered];

      body.push(
        this._get_source_line(
          cur_line_of_code,
          line_of_source_to_flash === line_num_being_rendered,
          is_gdb_paused_on_this_line,
          line_num_being_rendered,
          has_bkpt,
          has_disabled_bkpt,
          assembly_for_line,
          paused_addr
        )
      );
      line_num_being_rendered++;
    }

    SourceCode.view_more_top_node = null;
    SourceCode.view_more_bottom_node = null;

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

  get_body_assembly_only(assm_array, paused_addr) {
    let body = [],
      i = 0;
    for (let assm of assm_array) {
      body.push(this._get_assm_row(i, assm, paused_addr));
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
    return SourceCode._make_jq_selector_visible($("#scroll_to_line"));
  }
  static is_source_line_visible(jq_selector) {
    if (jq_selector.length !== 1) {
      // make sure something is selected before trying to scroll to it
      throw "Unexpected jquery selector";
    }

    let top_of_container = SourceCode.el_code_container.position().top,
      height_of_container = SourceCode.el_code_container.height(),
      bottom_of_container = top_of_container + height_of_container,
      top_of_line = jq_selector.position().top,
      bottom_of_line = top_of_line + jq_selector.height(),
      top_of_table = jq_selector.closest("table").position().top,
      is_visible =
        top_of_line >= top_of_container && bottom_of_line <= bottom_of_container;

    if (is_visible) {
      return { is_visible: true, top_of_line, top_of_table, height_of_container };
    } else {
      return { is_visible: false, top_of_line, top_of_table, height_of_container };
    }
  }
  /**
   * Scroll to a jQuery selection in the source code table
   * Used to jump around to various lines
   * returns true on success
   */
  static _make_jq_selector_visible(jq_selector) {
    if (jq_selector.length === 1) {
      // make sure something is selected before trying to scroll to it
      const {
        is_visible,
        top_of_line,
        top_of_table,
        height_of_container
      } = SourceCode.is_source_line_visible(jq_selector);

      if (!is_visible) {
        // line is out of view, scroll so it's in the middle of the table
        const time_to_scroll = 0;
        let scroll_top = top_of_line - (top_of_table + height_of_container / 2);
        SourceCode.el_code_container.animate({ scrollTop: scroll_top }, time_to_scroll);
      }
      return true;
    } else {
      return false;
    }
  }
}

export default SourceCode;
