/**
 * The Memory component allows the user to view
 * data stored at memory locations. It has some
 * static methods used by other objects to turn text into a clickable
 * address. It also has methods to manage the global store of memory data.
 */

import { store, useGlobalValue } from "./Store";
import GdbApi from "./GdbApi";
import MemoryLink from "./MemoryLink";
import Handlers from "./EventHandlers";
import React, { useState } from "react";
import _ from "lodash";
import { GdbMiMemoryEntry, GdbMiMemoryResponse } from "./types";
import { DotsHorizontalIcon } from "@heroicons/react/solid";

function MemoryRow(props: { entry: GdbMiMemoryEntry; bytes: string[] }) {
  const [editingValue, setEditingValue] = useState(false);
  const [editedValue, setEditedValue] = useState(props.entry.contents);
  const [hoverEntry, setHoverEntry] = useState<Nullable<number>>(null);
  const { entry, bytes } = props;
  const chars = bytes.map((byte) =>
    String.fromCharCode(parseInt(byte, 16)).replace(/\W/g, ".")
  );
  const hoverBgColor = "bg-blue-900";
  const characterColor = "text-blue-600";
  return (
    <div className="flex">
      <span className="mr-2">{<MemoryLink addr={entry.begin} />}</span>
      <span
        className="font-mono mr-3"
        onDoubleClick={(e) => {
          setEditingValue(!editingValue);
          setHoverEntry(null);
        }}
      >
        {editingValue ? (
          <input
            value={editedValue}
            autoFocus={true}
            className="input flex-grow font-mono"
            style={{ width: "333px", letterSpacing: "0.11em" }}
            onChange={(e) => {
              setEditedValue(e.target.value);
            }}
            onKeyUp={(e) => {
              if (e.code?.toLocaleLowerCase() === "enter") {
                GdbApi.runCommandAndRefreshState(
                  `-data-write-memory-bytes ${entry.begin} ${editedValue}`
                );
                setEditingValue(false);
              } else if (e.code?.toLocaleLowerCase() === "escape") {
                setEditingValue(false);
              }
            }}
          />
        ) : (
          bytes.map((byte, i) => {
            const color = chars[i] === "." ? "text-gray-500" : characterColor;
            const hoverColor = hoverEntry === i ? hoverBgColor : "";
            return (
              <span
                key={i}
                className={`mr-2 ${hoverColor} ${color}`}
                onMouseEnter={() => {
                  setHoverEntry(i);
                }}
                onMouseLeave={() => {
                  setHoverEntry(null);
                }}
              >
                {byte}
              </span>
            );
          })
        )}
      </span>
      <span className="font-mono ">
        {chars.map((char, i) => {
          const color = chars[i] === "." ? "text-gray-500" : characterColor;
          const hoverColor = hoverEntry === i ? hoverBgColor : "";
          return (
            <span
              key={i}
              onMouseEnter={() => {
                setHoverEntry(i);
              }}
              onMouseLeave={() => {
                setHoverEntry(null);
              }}
              className={` ${hoverColor} ${color}`}
            >
              {char}
            </span>
          );
        })}
      </span>
    </div>
  );
}

const byteStringToByteArray = (byteString: string): Array<string> => {
  const bytes = [];
  for (let i = 0; i < byteString.length; i = i + 2) {
    bytes.push(byteString.substring(i, i + 2));
  }
  return bytes;
};

function MoreButton(props: { direction: "preceding" | "following" }) {
  return (
    <button
      className="w-full  my-1"
      onClick={
        props.direction === "preceding"
          ? MemoryClass.clickReadPrecedingMemory
          : MemoryClass.clickReadMoreMemory
      }
      title="Read more memory"
    >
      <DotsHorizontalIcon className="icon m-auto" />
    </button>
  );
}

export function Memory(props: {}) {
  const memoryCache = useGlobalValue<typeof store.data.memory_cache>("memory_cache");
  if (memoryCache.length === 0) {
    return null;
  }
  return (
    <div className=" font-mono text-sm">
      <MoreButton direction="preceding" />
      <div
        style={{
          paddingLeft: `${memoryCache[0].begin.length * 7}px`,
          letterSpacing: "1.30em",
        }}
      >
        0123456789ABCDE
      </div>
      {memoryCache.map((entry, i) => {
        const bytes = byteStringToByteArray(entry.contents);
        return <MemoryRow entry={entry} bytes={bytes} key={entry.begin} />;
      })}
      <MoreButton direction="following" />
    </div>
  );
}

class MemoryClass {
  static MAX_ADDRESS_DELTA_BYTES = 1000;
  static DEFAULT_ADDRESS_DELTA_BYTES = 112;
  static BYTES_PER_LINE = 16;

  static setInputsFromAddress(address: string) {
    // set inputs in DOM
    store.set<typeof store.data.start_addr>(
      "start_addr",
      "0x" + parseInt(address, 16).toString(16)
    );
    store.set(
      "end_addr",
      "0x" +
        (parseInt(address, 16) + MemoryClass.DEFAULT_ADDRESS_DELTA_BYTES).toString(16)
    );
    MemoryClass.requestReadMemory(true);
  }

  static getStartAddress(): number {
    return parseInt(_.trim(store.data.start_addr), 16);
  }
  static getEndAddress(startAddr: number): number {
    const defaultEndAddr = startAddr + MemoryClass.DEFAULT_ADDRESS_DELTA_BYTES;
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
    } else if (userEndAddr - startAddr > MemoryClass.MAX_ADDRESS_DELTA_BYTES) {
      // requesting too much memory, truncate for performance reasons
      Handlers.addGdbGuiConsoleEntries(
        `Cannot fetch ${userEndAddr - startAddr} bytes. Changed end address to ${
          store.data.end_addr
        } since maximum bytes gdbgui allows is ${MemoryClass.MAX_ADDRESS_DELTA_BYTES}.`,
        "STD_ERR"
      );
      store.set<typeof store.data.end_addr>("end_addr", `0x${defaultEndAddr}`);
      return defaultEndAddr;
    }
    return userEndAddr;
  }
  static getRequestReadMemoryCommmands(clearCache: boolean) {
    if (clearCache) {
      MemoryClass.clearMemoryCache();
    }

    const startAddr = MemoryClass.getStartAddress();
    if (isNaN(startAddr)) {
      return [];
    }
    const endAddr = MemoryClass.getEndAddress(startAddr);

    let i = 0;
    let currentAddress = startAddr;
    const bytesPerRow = 16;
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

  static requestReadMemory(clearCache: boolean) {
    if (clearCache) {
      MemoryClass.clearMemoryCache();
    }
    const requestMemoryCommands = MemoryClass.getRequestReadMemoryCommmands(clearCache);
    if (requestMemoryCommands.length === 0) {
      return;
    }
    GdbApi.runGdbCommand(requestMemoryCommands);
  }
  static clickReadPrecedingMemory() {
    // update starting value, then re-fetch
    const NUM_ROWS = 3;
    const startAddr = parseInt(_.trim(store.data.start_addr), 16);
    const byteOffset = MemoryClass.BYTES_PER_LINE * NUM_ROWS;
    store.set<typeof store.data.start_addr>(
      "start_addr",
      "0x" + (startAddr - byteOffset).toString(16)
    );
    MemoryClass.requestReadMemory(false);
  }

  static clickReadMoreMemory() {
    // update ending value, then re-fetch
    const NUM_ROWS = 5;
    const endAddr = parseInt(_.trim(store.data.end_addr), 16);
    const byteOffset = MemoryClass.BYTES_PER_LINE * NUM_ROWS;
    store.set<typeof store.data.end_addr>(
      "end_addr",
      "0x" + (endAddr + byteOffset).toString(16)
    );
    MemoryClass.requestReadMemory(false);
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
        suffix_component = MemoryClass.textToLinks(trailing_text);
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

export default MemoryClass;
