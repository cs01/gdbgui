import React, { useLayoutEffect } from "react";
import { Terminal } from "xterm";
import { FitAddon } from "xterm-addon-fit";
import "xterm/css/xterm.css";
import { ptyFontSize } from "./constants";
import Handlers from "./EventHandlers";
import { store } from "./Store";

function customKeyEventHandler(config: {
  pty_name: string;
  pty: Terminal;
  canPaste: boolean;
}) {
  return async (e: KeyboardEvent): Promise<boolean> => {
    if (!(e.type === "keydown")) {
      return true;
    }
    if (e.shiftKey && e.ctrlKey) {
      const key = e.key.toLowerCase();
      if (key === "c") {
        const toCopy = config.pty.getSelection();
        navigator.clipboard.writeText(toCopy);
        config.pty.focus();
        return false;
      } else if (key === "v") {
        if (!config.canPaste) {
          return false;
        }
        const toPaste = await navigator.clipboard.readText();

        const data = { pty_name: config.pty_name, key: toPaste, action: "write" };
        store.data.gdbWebsocket?.publishPtyData(data);
        return false;
      }
    }
    return true;
  };
}

const terminal = new Terminal({
  cursorBlink: true,
  macOptionIsMeta: true,
  scrollback: 9999,
  fontSize: ptyFontSize,
});
const fitAddon = new FitAddon();

const terminalRef = React.createRef<any>();
export function GdbTerminal(props: {}) {
  useLayoutEffect(() => {
    terminal.open(terminalRef.current);

    terminal.attachCustomKeyEventHandler(
      // @ts-expect-error
      customKeyEventHandler({
        pty_name: "user_pty",
        pty: terminal,
        canPaste: true,
      })
    );

    store.data.gdbWebsocket?.addWebsocketEventHandler(
      "user_pty_response",
      (data: string) => {
        terminal.write(data);
      }
    );

    terminal.onKey(
      (
        data: {
          key: string;
          domEvent: KeyboardEvent;
        },
        ev
      ) => {
        store.data.gdbWebsocket?.publishPtyData({
          pty_name: "user_pty",
          key: data.key,
          action: "write",
        });

        if (data.domEvent.code === "Enter") {
          Handlers.onConsoleCommandRun();
        }
      }
    );
    terminal.loadAddon(fitAddon);
    setInterval(() => {
      try {
        fitAddon.fit();
      } catch (e) {
        //
      }
    }, 2000);
    fitAddon.fit();
  }, []);
  return <div className="bg-black h-full w-full" ref={terminalRef} />;
}
