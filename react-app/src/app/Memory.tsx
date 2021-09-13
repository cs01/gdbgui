/**
 * The Memory component allows the user to view
 * data stored at memory locations. It has some
 * static methods used by other objects to turn text into a clickable
 * address. It also has methods to manage the global store of memory data.
 */

import { store } from "statorgfc";
import GdbApi from "./GdbApi";
import constants from "./constants";
import ReactTable from "./ReactTable";
// @ts-expect-error ts-migrate(2691) FIXME: An import path cannot end with a '.tsx' extension.... Remove this comment to see the full error message
import MemoryLink from "./MemoryLink.tsx";
import Actions from "./Actions";
import React from "react";
import _ from "lodash";

type State = any;

class Memory extends React.Component<{}, State> {
  static MAX_ADDRESS_DELTA_BYTES = 1000;
  static DEFAULT_ADDRESS_DELTA_BYTES = 31;
  static DEFAULT_BYTES_PER_LINE = 8;

  constructor() {
    // @ts-expect-error ts-migrate(2554) FIXME: Expected 1-2 arguments, but got 0.
    super();
    // @ts-expect-error ts-migrate(2339) FIXME: Property 'connectComponentState' does not exist on... Remove this comment to see the full error message
    store.connectComponentState(this, [
      "memory_cache",
      "start_addr",
      "end_addr",
      "bytes_per_line",
    ]);
  }
  get_memory_component_jsx_content() {
    if (Object.keys(store.get("memory_cache")).length === 0) {
      return (
        <span key="nothing" className="placeholder">
          no memory to display
        </span>
      );
    }

    const data = [];
    let hex_vals_for_this_addr = [];
    let char_vals_for_this_addr = [];
    let i = 0;
    let hexAddrToDisplay = null;

    let bytes_per_line =
      parseInt(store.get("bytes_per_line")) || Memory.DEFAULT_BYTES_PER_LINE;
    bytes_per_line = Math.max(bytes_per_line, 1);

    data.push([
      <span
        key="moretop"
        className="pointer"
        style={{ fontStyle: "italic", fontSize: "0.8em" }}
        onClick={Memory.clickReadPrecedingMemory}
      >
        more
      </span>,
      "",
      "",
    ]);

    for (const hex_addr in store.get("memory_cache")) {
      if (!hexAddrToDisplay) {
        hexAddrToDisplay = hex_addr;
      }

      if (i % bytes_per_line === 0 && hex_vals_for_this_addr.length > 0) {
        // begin new row
        data.push([
          Memory.make_addrs_into_links_react(hexAddrToDisplay),
          hex_vals_for_this_addr.join(" "),
          char_vals_for_this_addr,
        ]);

        // update which address we're collecting values for
        i = 0;
        hexAddrToDisplay = hex_addr;
        hex_vals_for_this_addr = [];
        char_vals_for_this_addr = [];
      }
      const hex_value = store.get("memory_cache")[hex_addr];
      hex_vals_for_this_addr.push(hex_value);
      const char = String.fromCharCode(parseInt(hex_value, 16)).replace(/\W/g, ".");
      char_vals_for_this_addr.push(
        <span key={i} className="memory_char">
          {char}
        </span>
      );
      i++;
    }

    if (hex_vals_for_this_addr.length > 0) {
      // memory range requested wasn't divisible by bytes per line
      // add the remaining memory
      data.push([
        Memory.make_addrs_into_links_react(hexAddrToDisplay),
        hex_vals_for_this_addr.join(" "),
        char_vals_for_this_addr,
      ]);
    }

    if (Object.keys(store.get("memory_cache")).length > 0) {
      data.push([
        <span
          key="morebottom"
          className="pointer"
          style={{ fontStyle: "italic", fontSize: "0.8em" }}
          onClick={Memory.clickReadMoreMemory}
        >
          more
        </span>,
        "",
        "",
      ]);
    }

    // @ts-expect-error ts-migrate(2769) FIXME: Type 'string' is not assignable to type 'never'.
    return <ReactTable data={data} header={["address", "hex", "char"]} />;
  }
  render() {
    const input_style = {
      display: "inline",
      width: "100px",
      padding: "6px 6px",
      height: "25px",
      fontSize: "1em",
    };
    const content = this.get_memory_component_jsx_content();
    return (
      <div>
        <input
          id="memory_start_address"
          className="form-control"
          placeholder="start address (hex)"
          style={input_style}
          value={this.state.start_addr}
          onKeyUp={Memory.keypress_on_input}
          onChange={(e) => {
            store.set("start_addr", e.target.value);
          }}
        />
        <input
          id="memory_end_address"
          className="form-control"
          placeholder="end address (hex)"
          style={input_style}
          value={this.state.end_addr}
          onKeyUp={Memory.keypress_on_input}
          onChange={(e) => {
            store.set("end_addr", e.target.value);
          }}
        />
        <input
          id="memory_bytes_per_line"
          className="form-control"
          placeholder="bytes per line (dec)"
          style={input_style}
          value={this.state.bytes_per_line}
          onKeyUp={Memory.keypress_on_input}
          onChange={(e) => {
            store.set("bytes_per_line", e.target.value);
          }}
        />
        {content}
      </div>
    );
  }
  static keypress_on_input(e: any) {
    if (e.keyCode === constants.ENTER_BUTTON_NUM) {
      Memory.fetch_memory_from_state();
    }
  }
  static set_inputs_from_address(addr: any) {
    // set inputs in DOM
    store.set("start_addr", "0x" + parseInt(addr, 16).toString(16));
    store.set(
      "end_addr",
      "0x" + (parseInt(addr, 16) + Memory.DEFAULT_ADDRESS_DELTA_BYTES).toString(16)
    );
    Memory.fetch_memory_from_state();
  }

  static getGdbCommandsFromState() {
    const startAddr = parseInt(_.trim(store.get("start_addr")), 16);
    let endAddr = parseInt(_.trim(store.get("end_addr")), 16);

    if (!window.isNaN(startAddr) && window.isNaN(endAddr)) {
      endAddr = startAddr + Memory.DEFAULT_ADDRESS_DELTA_BYTES;
    }

    const cmds = [];
    if (_.isInteger(startAddr) && endAddr) {
      if (startAddr > endAddr) {
        endAddr = startAddr + Memory.DEFAULT_ADDRESS_DELTA_BYTES;
        store.set("end_addr", "0x" + endAddr.toString(16));
      } else if (endAddr - startAddr > Memory.MAX_ADDRESS_DELTA_BYTES) {
        const orig_end_addr = endAddr;
        endAddr = startAddr + Memory.MAX_ADDRESS_DELTA_BYTES;
        store.set("end_addr", "0x" + endAddr.toString(16));
        Actions.add_console_entries(
          `Cannot fetch ${
            orig_end_addr - startAddr
          } bytes. Changed end address to ${store.get(
            "end_addr"
          )} since maximum bytes gdbgui allows is ${Memory.MAX_ADDRESS_DELTA_BYTES}.`,
          constants.console_entry_type.STD_ERR
        );
      }

      let cur_addr = startAddr;
      while (cur_addr <= endAddr) {
        // TODO read more than 1 byte at a time?
        cmds.push(`-data-read-memory-bytes ${"0x" + cur_addr.toString(16)} 1`);
        cur_addr = cur_addr + 1;
      }
    }

    if (!window.isNaN(startAddr)) {
      store.set("start_addr", "0x" + startAddr.toString(16));
    }
    if (!window.isNaN(endAddr)) {
      store.set("end_addr", "0x" + endAddr.toString(16));
    }

    return cmds;
  }

  static fetch_memory_from_state() {
    const cmds = Memory.getGdbCommandsFromState();
    Memory.clear_cache();
    GdbApi.run_gdb_command(cmds);
  }

  static clickReadPrecedingMemory() {
    // update starting value, then re-fetch
    const NUM_ROWS = 3;
    const startAddr = parseInt(_.trim(store.get("start_addr")), 16);
    const byteOffset = store.get("bytes_per_line") * NUM_ROWS;
    store.set("start_addr", "0x" + (startAddr - byteOffset).toString(16));
    Memory.fetch_memory_from_state();
  }

  static clickReadMoreMemory() {
    // update ending value, then re-fetch
    const NUM_ROWS = 3;
    const endAddr = parseInt(_.trim(store.get("end_addr")), 16);
    const byteOffset = store.get("bytes_per_line") * NUM_ROWS;
    store.set("end_addr", "0x" + (endAddr + byteOffset).toString(16));
    Memory.fetch_memory_from_state();
  }

  /**
   * @param text: string to convert address-like text into clickable components
   * return react component
   */
  static make_addrs_into_links_react(text: any) {
    const matches = text.match(/(0x[\d\w]+)/g);
    if (text && matches && matches.length) {
      const addr = matches[0];
      const leading_text = text.slice(0, text.indexOf(addr));
      const trailing_text = text.slice(text.indexOf(addr) + addr.length, text.length);
      let suffix_component = trailing_text;
      if (trailing_text) {
        // recursive call to turn additional addressed after the first
        suffix_component = Memory.make_addrs_into_links_react(trailing_text);
      }
      return (
        <React.Fragment>
          {leading_text}
          <MemoryLink addr={addr} />
          {suffix_component}
        </React.Fragment>
      );
    } else {
      return text;
    }
  }

  static add_value_to_cache(hex_str: any, hex_val: any) {
    // strip leading zeros off address provided by gdb
    // i.e. 0x000123 turns to
    // 0x123
    const hex_str_truncated = "0x" + parseInt(hex_str, 16).toString(16);
    const cache = store.get("memory_cache");
    cache[hex_str_truncated] = hex_val;
    store.set("memory_cache", cache);
  }

  static clear_cache() {
    store.set("memory_cache", {});
  }
}

export default Memory;
