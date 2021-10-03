import React, { useLayoutEffect } from "react";
import { Terminal } from "xterm";
import { FitAddon } from "xterm-addon-fit";
import { ptyFontSize } from "./constants";
import { store } from "./GlobalState";

const terminal = new Terminal({
  cursorBlink: true,
  macOptionIsMeta: true,
  scrollback: 9999,
  fontSize: ptyFontSize,
});
const fitAddon = new FitAddon();

const terminalRef = React.createRef<any>();
export function InferiorTerminal(props: {}) {
  useLayoutEffect(() => {
    terminal.open(terminalRef.current);
    terminal.writeln(`This terminal is connected to the program being debugged`);

    terminal.onKey(
      (
        data: {
          key: string;
          domEvent: KeyboardEvent;
        },
        ev
      ) => {
        store.data.gdbWebsocket?.publishPtyData({
          pty_name: "program_pty",
          key: data.key,
          action: "write",
        });
      }
    );

    store.data.gdbWebsocket?.addWebsocketEventHandler(
      "program_pty_response",
      (pty_response: string) => {
        terminal.write(pty_response);
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
