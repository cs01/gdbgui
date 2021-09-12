import React, { useLayoutEffect } from "react";
import GdbApi from "./GdbApi";
import { Terminal } from "xterm";
import { FitAddon } from "xterm-addon-fit";
import { ptyFontSize } from "./constants";

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
        GdbApi.getSocket().emit("pty_interaction", {
          data: { pty_name: "program_pty", key: data.key, action: "write" },
        });
      }
    );
    GdbApi.getSocket().on("program_pty_response", function (pty_response: string) {
      terminal.write(pty_response);
    });
    terminal.loadAddon(fitAddon);
    setInterval(() => {
      fitAddon.fit();
    }, 2000);
    fitAddon.fit();
  }, []);
  return <div className="bg-gray-800 h-full w-full" ref={terminalRef} />;
}
