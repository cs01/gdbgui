import React, { useLayoutEffect } from "react";
import GdbApi from "./GdbApi";
import { Terminal } from "xterm";
import { FitAddon } from "xterm-addon-fit";
import "xterm/css/xterm.css";
import { ptyFontSize } from "./constants";
import Actions from "./Actions";

function customKeyEventHandler(config: {
  pty_name: string;
  pty: Terminal;
  canPaste: boolean;
  pidStoreKey: string;
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

        GdbApi.getSocket().emit("pty_interaction", {
          data: { pty_name: config.pty_name, key: toPaste, action: "write" },
        });
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
    terminal.writeln(`Welcome to gdbgui!`);

    terminal.attachCustomKeyEventHandler(
      // @ts-expect-error
      customKeyEventHandler({
        pty_name: "user_pty",
        pty: terminal,
        canPaste: true,
        pidStoreKey: "gdb_pid",
      })
    );
    GdbApi.getSocket().on("user_pty_response", function (data: string) {
      terminal.write(data);
    });
    terminal.onKey(
      (
        data: {
          key: string;
          domEvent: KeyboardEvent;
        },
        ev
      ) => {
        GdbApi.getSocket().emit("pty_interaction", {
          data: { pty_name: "user_pty", key: data.key, action: "write" },
        });

        if (data.domEvent.code === "Enter") {
          Actions.onConsoleCommandRun();
        }
      }
    );
    terminal.loadAddon(fitAddon);
    setInterval(() => {
      fitAddon.fit();
    }, 2000);
    fitAddon.fit();
  }, []);
  return <div className="bg-gray-800 h-full w-full" ref={terminalRef} />;
}
