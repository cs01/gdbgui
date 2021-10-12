/**
 * The Memory component allows the user to view
 * data stored at memory locations. It has some
 * static methods used by other objects to turn text into a clickable
 * address. It also has methods to manage the global store of memory data.
 */

import { store } from "./Store";
import GdbApi from "./GdbApi";
import constants from "./constants";
// @ts-expect-error ts-migrate(2691) FIXME: An import path cannot end with a '.tsx' extension.... Remove this comment to see the full error message
import MemoryLink from "./MemoryLink.tsx";
import Handlers from "./EventHandlers";
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
    store.reactComponentState(this, [
      "memory_cache",
      "start_addr",
      "end_addr",
      "bytes_per_line",
    ]);
  }
  getMemoryTable(bytesPerLine: number) {
    const getRowForAddressRange = (startAddress: string, endAddress: string) => {
      // const addresses = [startAddress];
      // let curAddress = startAddress;
      const value = store.data.memory_cache[startAddress];
      const startAddrInt = parseInt(startAddress, 16);
      return (
        <div className="flex space-x-4 font-mono">
          <div>{Memory.make_addrs_into_links_react(startAddress)}</div>
          <div className="hover:bg-purple-900">{value}</div>
          <div>{String.fromCharCode(parseInt(value, 16)).replace(/\W/g, ".")}</div>
        </div>
      );
    };

    const allAddresses = Object.keys(store.data.memory_cache);
    const addressesRowStart = allAddresses.filter((address, i) => {
      return i % bytesPerLine === 0;
    });
    // const addressesRowContinue = allAddresses.filter((address, i) => {
    //   return i % bytesPerLine !== 0;
    // });
    return addressesRowStart.map((address, i) => (
      <div key={i}>{getRowForAddressRange(address, address + bytesPerLine)}</div>
    ));
    // for (const address in store.data.memory_cache) {
    //   if (!hexAddrToDisplay) {
    //     hexAddrToDisplay = address;
    //   }

    //   if (i % bytesPerLine === 0 && hex_vals_for_this_addr.length > 0) {
    //     // begin new row
    //     data.push([
    //       Memory.make_addrs_into_links_react(hexAddrToDisplay),
    //       hex_vals_for_this_addr.join(" "),
    //       char_vals_for_this_addr,
    //     ]);

    //     // update which address we're collecting values for
    //     i = 0;
    //     hexAddrToDisplay = address;
    //     hex_vals_for_this_addr = [];
    //     char_vals_for_this_addr = [];
    //   }
    //   const hex_value = store.data.memory_cache[address];
    //   hex_vals_for_this_addr.push(hex_value);
    //   const char = String.fromCharCode(parseInt(hex_value, 16)).replace(/\W/g, ".");
    //   char_vals_for_this_addr.push(
    //     <span key={i} className="hover:bg-purple-900">
    //       {char}
    //     </span>
    //   );
    //   i++;
    // }

    // if (hex_vals_for_this_addr.length > 0) {
    //   // memory range requested wasn't divisible by bytes per line
    //   // add the remaining memory
    //   data.push([
    //     Memory.make_addrs_into_links_react(hexAddrToDisplay),
    //     hex_vals_for_this_addr.join(" "),
    //     char_vals_for_this_addr,
    //   ]);
    // }

    // data.push([

    //   "",
    //   "",
    // ]);

    // return (
    //   <div className="text-sm">
    //     {data.map((row, i) => {
    //       return (
    //         <div key={i} className="flex space-x-4 font-mono">
    //           <div>{row[0]}</div>
    //           <div>{row[1]}</div>
    //           <div>{row[2]}</div>
    //           <div></div>
    //         </div>
    //       );
    //     })}
    //   </div>
    // );
  }
  render() {
    const bytesPerLine = Math.max(
      store.data.bytes_per_line ?? Memory.DEFAULT_BYTES_PER_LINE,
      1
    );
    return (
      <div>
        <div className="flex flex-wrap items-center space-x-1 space-y-1 text-sm font-mono ">
          <span className="mr-1">from</span>{" "}
          <input
            className="input"
            placeholder="start address (hex)"
            value={this.state.start_addr}
            onKeyUp={Memory.keypress_on_input}
            onChange={(e) => {
              store.set<typeof store.data.start_addr>("start_addr", e.target.value);
            }}
          />
          <span>to</span>{" "}
          <input
            id="memory_end_address"
            className="input"
            placeholder="end address (hex)"
            value={this.state.end_addr}
            onKeyUp={Memory.keypress_on_input}
            onChange={(e) => {
              store.set<typeof store.data.end_addr>("end_addr", e.target.value);
            }}
          />
          <span>with</span>{" "}
          <input
            className="input w-10 flex-shrink"
            placeholder="bytes per line (base 10)"
            title="bytes per line (base 10)"
            value={this.state.bytes_per_line}
            onKeyUp={Memory.keypress_on_input}
            onChange={(e) => {
              store.set<typeof store.data.bytes_per_line>(
                "bytes_per_line",
                parseInt(e.target.value)
              );
            }}
          />
          <span className="flex-grow">bytes per line</span>{" "}
        </div>
        {Object.keys(store.data.memory_cache).length === 0 ? null : (
          <div>
            <button
              key="moretop"
              className="font-bold text-sm"
              onClick={Memory.clickReadPrecedingMemory}
            >
              more
            </button>
            {this.getMemoryTable(bytesPerLine)}
            <button
              key="morebottom"
              className="font-bold text-sm"
              onClick={Memory.clickReadMoreMemory}
            >
              more
            </button>
          </div>
        )}
      </div>
    );
  }
  static keypress_on_input(e: any) {
    if (e.keyCode === constants.ENTER_BUTTON_NUM) {
      Memory.fetch_memory_from_state();
    }
  }
  static setInputsFromAddress(addr: any) {
    // set inputs in DOM
    store.set<typeof store.data.start_addr>(
      "start_addr",
      "0x" + parseInt(addr, 16).toString(16)
    );
    store.set(
      "end_addr",
      "0x" + (parseInt(addr, 16) + Memory.DEFAULT_ADDRESS_DELTA_BYTES).toString(16)
    );
    Memory.fetch_memory_from_state();
  }

  static getGdbCommandsFromState() {
    const startAddr = parseInt(_.trim(store.data.start_addr), 16);
    let endAddr = parseInt(_.trim(store.data.end_addr), 16);

    if (!window.isNaN(startAddr) && window.isNaN(endAddr)) {
      endAddr = startAddr + Memory.DEFAULT_ADDRESS_DELTA_BYTES;
    }

    const cmds = [];
    if (_.isInteger(startAddr) && endAddr) {
      if (startAddr > endAddr) {
        endAddr = startAddr + Memory.DEFAULT_ADDRESS_DELTA_BYTES;
        store.set<typeof store.data.end_addr>("end_addr", "0x" + endAddr.toString(16));
      } else if (endAddr - startAddr > Memory.MAX_ADDRESS_DELTA_BYTES) {
        const orig_end_addr = endAddr;
        endAddr = startAddr + Memory.MAX_ADDRESS_DELTA_BYTES;
        store.set<typeof store.data.end_addr>("end_addr", "0x" + endAddr.toString(16));
        Handlers.addGdbGuiConsoleEntries(
          `Cannot fetch ${orig_end_addr - startAddr} bytes. Changed end address to ${
            store.data.end_addr
          } since maximum bytes gdbgui allows is ${Memory.MAX_ADDRESS_DELTA_BYTES}.`,
          "STD_ERR"
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
      store.set<typeof store.data.start_addr>(
        "start_addr",
        "0x" + startAddr.toString(16)
      );
    }
    if (!window.isNaN(endAddr)) {
      store.set<typeof store.data.end_addr>("end_addr", "0x" + endAddr.toString(16));
    }

    return cmds;
  }

  static fetch_memory_from_state() {
    const cmds = Memory.getGdbCommandsFromState();
    Memory.clear_cache();
    GdbApi.runGdbCommand(cmds);
  }

  static clickReadPrecedingMemory() {
    // update starting value, then re-fetch
    const NUM_ROWS = 3;
    const startAddr = parseInt(_.trim(store.data.start_addr), 16);
    const byteOffset = store.data.bytes_per_line * NUM_ROWS;
    store.set<typeof store.data.start_addr>(
      "start_addr",
      "0x" + (startAddr - byteOffset).toString(16)
    );
    Memory.fetch_memory_from_state();
  }

  static clickReadMoreMemory() {
    // update ending value, then re-fetch
    const NUM_ROWS = 3;
    const endAddr = parseInt(_.trim(store.data.end_addr), 16);
    const byteOffset = store.data.bytes_per_line * NUM_ROWS;
    store.set<typeof store.data.end_addr>(
      "end_addr",
      "0x" + (endAddr + byteOffset).toString(16)
    );
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

  static addValueToCache(hex_str: string, hex_val: string) {
    // strip leading zeros off address provided by gdb
    // i.e. 0x000123 turns to
    // 0x123
    const hex_str_truncated = "0x" + parseInt(hex_str, 16).toString(16);
    const cache = store.data.memory_cache;
    cache[hex_str_truncated] = hex_val;
    store.set<typeof store.data.memory_cache>("memory_cache", cache);
  }

  static clear_cache() {
    store.set<typeof store.data.memory_cache>("memory_cache", {});
  }
}

export default Memory;
