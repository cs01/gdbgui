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
import { GdbMiMemoryResponse } from "./types";
import {
  ArrowDownIcon,
  ArrowUpIcon,
  DotsHorizontalIcon,
  DotsVerticalIcon,
  DotsCircleHorizontalIcon,
} from "@heroicons/react/solid";

type State = any;

class Memory extends React.Component<{}, State> {
  static MAX_ADDRESS_DELTA_BYTES = 1000;
  static DEFAULT_ADDRESS_DELTA_BYTES = 32;
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
    const byteStringToByteArray = (byteString: string): Array<string> => {
      const bytes = [];
      for (let i = 0; i < byteString.length; i = i + 2) {
        bytes.push(byteString.substring(i, i + 2));
      }
      return bytes;
    };

    return (
      <div>
        {store.data.memory_cache.map((entry, i) => {
          const bytes = byteStringToByteArray(entry.contents);

          return (
            <div className="space-x-4 flex " key={i}>
              <span>{<MemoryLink addr={entry.begin} />}</span>{" "}
              <span className="font-mono ">
                {" "}
                {bytes.map((byte, i) => {
                  return (
                    <span key={i} className="mr-1 hover:bg-purple-900">
                      {byte}
                    </span>
                  );
                })}
              </span>
              <span className="font-mono ">
                {bytes.map((byte, i) => {
                  return (
                    <span key={i} className="hover:bg-purple-900">
                      {String.fromCharCode(parseInt(byte, 16)).replace(/\W/g, ".")}
                    </span>
                  );
                })}
              </span>
            </div>
          );
        })}
      </div>
    );
    // const getRowForAddressRange = (startAddress: string, endAddress: string) => {
    // const addresses = [startAddress];
    // let curAddress = startAddress;
    // return store.data.memory_cache;

    // const startAddrInt = parseInt(startAddress, 16);
    // return (
    //   <div className="flex space-x-4 font-mono">
    //     <div>{Memory.make_addrs_into_links_react(startAddress)}</div>
    //     <div className="hover:bg-purple-900">{value}</div>
    //     <div>{String.fromCharCode(parseInt(value, 16)).replace(/\W/g, ".")}</div>
    //   </div>
    // );
    // };

    // const allAddresses = Object.keys(store.data.memory_cache);
    // const addressesRowStart = allAddresses.filter((address, i) => {
    //   return i % bytesPerLine === 0;
    // });
    // const addressesRowContinue = allAddresses.filter((address, i) => {
    //   return i % bytesPerLine !== 0;
    // });
    // return addressesRowStart.map((address, i) => (
    //   <div key={i}>{getRowForAddressRange(address, address + bytesPerLine)}</div>
    // ));
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
      parseInt(store.data.bytes_per_line) ?? Memory.DEFAULT_BYTES_PER_LINE,
      1
    );
    return (
      <div className="space-y-1">
        <div className="flex flex-wrap items-center space-x-1 space-y-1 text-sm ">
          <span className="mr-1">from</span>{" "}
          <div>
            <input
              className="input text-center"
              placeholder="start address (hex)"
              value={this.state.start_addr}
              onKeyUp={Memory.keypress_on_input}
              onChange={(e) => {
                store.set<typeof store.data.start_addr>("start_addr", e.target.value);
              }}
            />
          </div>
          <span>to</span>{" "}
          <div>
            <input
              id="memory_end_address"
              className="input text-center"
              placeholder="end address (hex)"
              value={this.state.end_addr}
              onKeyUp={Memory.keypress_on_input}
              onChange={(e) => {
                store.set<typeof store.data.end_addr>("end_addr", e.target.value);
              }}
            />
          </div>
          <span>with</span>{" "}
          <div>
            <input
              className="input w-10 flex-shrink mr-auto text-center"
              placeholder="bytes per line (base 10)"
              title="bytes per line (base 10)"
              value={this.state.bytes_per_line}
              onKeyUp={Memory.keypress_on_input}
              onChange={(e) => {
                store.set<typeof store.data.bytes_per_line>(
                  "bytes_per_line",
                  e.target.value
                );
              }}
            />
          </div>
          <span className="flex-grow">bytes per line</span>{" "}
        </div>
        {Object.keys(store.data.memory_cache).length === 0 ? null : (
          <div>
            <button
              key="moretop"
              className="w-full hover:bg-gray-800 my-1"
              onClick={Memory.clickReadPrecedingMemory}
              title="Read more memory"
            >
              <DotsHorizontalIcon className="icon m-auto" />
            </button>
            {this.getMemoryTable(bytesPerLine)}
            <button
              key="morebottom"
              className="w-full hover:bg-gray-800 my-1"
              onClick={Memory.clickReadMoreMemory}
              title="Read more memory"
            >
              <DotsHorizontalIcon className="icon m-auto" />
            </button>
          </div>
        )}
      </div>
    );
  }
  static keypress_on_input(e: any) {
    if (e.keyCode === constants.ENTER_BUTTON_NUM) {
      Memory.requestReadMemory();
    }
  }
  static setInputsFromAddress(address: string) {
    // set inputs in DOM
    store.set<typeof store.data.start_addr>(
      "start_addr",
      "0x" + parseInt(address, 16).toString(16)
    );
    store.set(
      "end_addr",
      "0x" + (parseInt(address, 16) + Memory.DEFAULT_ADDRESS_DELTA_BYTES).toString(16)
    );
    Memory.requestReadMemory();
  }

  static getStartAddress(): number {
    return parseInt(_.trim(store.data.start_addr), 16);
  }
  static getEndAddress(startAddr: number): number {
    const defaultEndAddr = startAddr + Memory.DEFAULT_ADDRESS_DELTA_BYTES;
    const userEndAddr = parseInt(_.trim(store.data.end_addr), 16);
    if (isNaN(userEndAddr)) {
      store.set<typeof store.data.end_addr>("end_addr", `0x${defaultEndAddr}`);
      return defaultEndAddr;
    }

    if (startAddr > userEndAddr) {
      // start address can't be larger than end address,
      // replace end address with default value
      store.set<typeof store.data.end_addr>("end_addr", `0x${defaultEndAddr}`);
      return defaultEndAddr;
    } else if (userEndAddr - startAddr > Memory.MAX_ADDRESS_DELTA_BYTES) {
      // requesting too much memory, truncate for performance reasons
      Handlers.addGdbGuiConsoleEntries(
        `Cannot fetch ${userEndAddr - startAddr} bytes. Changed end address to ${
          store.data.end_addr
        } since maximum bytes gdbgui allows is ${Memory.MAX_ADDRESS_DELTA_BYTES}.`,
        "STD_ERR"
      );
      store.set<typeof store.data.end_addr>("end_addr", `0x${defaultEndAddr}`);
      return defaultEndAddr;
    }
    return userEndAddr;
  }
  static getRequestReadMemoryCommmands() {
    Memory.clearMemoryCache();

    const startAddr = Memory.getStartAddress();
    if (isNaN(startAddr)) {
      return [];
    }
    const endAddr = Memory.getEndAddress(startAddr);

    let i = 0;
    let currentAddress = startAddr;
    const bytesPerRow =
      parseInt(store.data.bytes_per_line) ?? Memory.DEFAULT_BYTES_PER_LINE;
    const cmds = [];
    while (currentAddress <= endAddr) {
      const offset = i * bytesPerRow;
      cmds.push(
        `-data-read-memory-bytes -o 0x${parseInt(`${offset}`, 16)} ${
          "0x" + currentAddress.toString(16)
        } ${bytesPerRow}`
      );
      currentAddress = currentAddress + bytesPerRow;
      i++;
    }

    return cmds;
  }

  static requestReadMemory() {
    Memory.clearMemoryCache();
    const requestMemoryCommands = Memory.getRequestReadMemoryCommmands();
    if (requestMemoryCommands.length === 0) {
      return;
    }
    GdbApi.runGdbCommand(requestMemoryCommands);
  }
  static getBytesPerLine() {
    return parseInt(store.data.bytes_per_line) ?? Memory.DEFAULT_BYTES_PER_LINE;
  }
  static clickReadPrecedingMemory() {
    // update starting value, then re-fetch
    const NUM_ROWS = 3;
    const startAddr = parseInt(_.trim(store.data.start_addr), 16);
    const byteOffset = Memory.getBytesPerLine() * NUM_ROWS;
    store.set<typeof store.data.start_addr>(
      "start_addr",
      "0x" + (startAddr - byteOffset).toString(16)
    );
    Memory.requestReadMemory();
  }

  static clickReadMoreMemory() {
    // update ending value, then re-fetch
    const NUM_ROWS = 5;
    const endAddr = parseInt(_.trim(store.data.end_addr), 16);
    const byteOffset = Memory.getBytesPerLine() * NUM_ROWS;
    store.set<typeof store.data.end_addr>(
      "end_addr",
      "0x" + (endAddr + byteOffset).toString(16)
    );
    Memory.requestReadMemory();
  }

  /**
   * @param text: string to convert address-like text into clickable components
   * return react component
   */
  static textToLinks(text: string): React.ReactNode | string {
    const matches = text.match(/(0x[\d\w]+)/g);
    if (text && matches && matches.length) {
      const addr = matches[0];
      const leading_text = text.slice(0, text.indexOf(addr));
      const trailing_text = text.slice(text.indexOf(addr) + addr.length, text.length);
      let suffix_component: React.ReactNode | string = trailing_text;
      if (trailing_text) {
        // recursive call to turn additional addressed after the first
        suffix_component = Memory.textToLinks(trailing_text);
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

  static addValueToCache(gdbMemoryResponse: GdbMiMemoryResponse) {
    store.set<typeof store.data.memory_cache>("memory_cache", [
      ...store.data.memory_cache,
      ...gdbMemoryResponse,
    ]);
  }

  static clearMemoryCache() {
    store.set<typeof store.data.memory_cache>("memory_cache", []);
  }
}

export default Memory;
