import React from "react";
import GdbApi from "./GdbApi";
import { Terminal } from "xterm";
import { FitAddon } from "xterm-addon-fit";
import { store } from "statorgfc";
import "xterm/css/xterm.css";
import constants from "./constants";
import Actions from "./Actions";
import ToolTip from "./ToolTip";

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
    if (e.ctrlKey && e.altKey) {
      const key = e.key.toLowerCase();
      if (key === "c") {
        const toCopy = config.pty.getSelection();
        try {
          await navigator.clipboard.writeText(toCopy);
          // Show toast message at cursor position
          const target = e.target as HTMLElement;
          if (target) {
            const rect = target.getBoundingClientRect();
            const node = {
              getBoundingClientRect: () => ({
                x: rect.x,
                y: rect.y,
                offsetHeight: rect.height
              })
            };
            ToolTip.show_copied_tooltip_on_node(node);
          }
        } catch (err) {
          // Fallback for browsers that don't support clipboard API
          const textarea = document.createElement('textarea');
          textarea.value = toCopy;
          document.body.appendChild(textarea);
          textarea.select();
          const success = document.execCommand('copy');
          document.body.removeChild(textarea);

          // Show toast message at cursor position
          const target = e.target as HTMLElement;
          if (target) {
            const rect = target.getBoundingClientRect();
            const node = {
              getBoundingClientRect: () => ({
                x: rect.x,
                y: rect.y,
                offsetHeight: rect.height
              })
            };
            if (success) {
              ToolTip.show_copied_tooltip_on_node(node);
            } else {
              ToolTip.show_tooltip_on_node("Failed to copy", node, null);
            }
          }
        }
        config.pty.focus();
        return false;
      } else if (key === "v") {
        if (!config.canPaste) {
          return false;
        }
        let pastedText = '';
        try {
          pastedText = await navigator.clipboard.readText();
        } catch (err) {
          // Fallback for browsers that don't support clipboard API
          const textarea = document.createElement('textarea');
          document.body.appendChild(textarea);
          textarea.focus();
          document.execCommand('paste');
          pastedText = textarea.value;
          document.body.removeChild(textarea);
        }

        if (pastedText) {
          GdbApi.getSocket().emit("pty_interaction", {
            data: { pty_name: config.pty_name, key: pastedText, action: "write" }
          });
        }
        return false;
      }
    }
    return true;
  };
}
export class Terminals extends React.Component {
  userPtyRef: React.RefObject<any>;
  programPtyRef: React.RefObject<any>;
  gdbguiPtyRef: React.RefObject<any>;
  userPty: Terminal | null = null;
  programPty: Terminal | null = null;
  gdbguiPty: Terminal | null = null;

  constructor(props: any) {
    super(props);
    this.userPtyRef = React.createRef();
    this.programPtyRef = React.createRef();
    this.gdbguiPtyRef = React.createRef();
    this.terminal = this.terminal.bind(this);
    this.handleInputSubmit = this.handleInputSubmit.bind(this);
  }

  handleInputSubmit(e: React.KeyboardEvent<HTMLInputElement>, ptyName: string) {
    if (e.key === 'Enter') {
      e.preventDefault();
      const input = e.currentTarget.value;
      if (input) {
        // Send each character to the terminal
        GdbApi.getSocket().emit("pty_interaction", {
          data: { pty_name: ptyName, key: input, action: "write" }
        });
        // Send newline to simulate Enter
        GdbApi.getSocket().emit("pty_interaction", {
          data: { pty_name: ptyName, key: "\n", action: "write" }
        });
        // Clear the input
        e.currentTarget.value = '';
      }
    }
  }

  terminal(ref: React.RefObject<any>, ptyName: string, canPaste: boolean = true) {
    return (
      <div className="relative h-full flex flex-col overflow-hidden">
        <div className={`flex-grow overflow-hidden bg-black`}>
          <div className="w-full h-full" ref={ref}></div>
        </div>
        {canPaste && (
          <div className="flex-none bg-gray-900 p-2">
            <input
              type="text"
              className="w-full h-full px-2 py-1 bg-gray-800 text-white border border-gray-700 rounded"
              placeholder="Type or paste command here..."
              onKeyDown={(e) => this.handleInputSubmit(e, ptyName)}
            />
          </div>
        )}
      </div>
    );
  }

  render() {
    return (
      <div className="w-full h-full grid grid-cols-3">
        {this.terminal(this.userPtyRef, "user_pty")}
        {this.terminal(this.gdbguiPtyRef, "unused", false)}
        {this.terminal(this.programPtyRef, "program_pty")}
      </div>
    );
  }

  componentDidMount() {
    const fitAddon = new FitAddon();
    const programFitAddon = new FitAddon();
    const gdbguiFitAddon = new FitAddon();

    const userPty = new Terminal({
      cursorBlink: true,
      macOptionIsMeta: true,
      scrollback: 9999
    });
    this.userPty = userPty;
    userPty.loadAddon(fitAddon);
    userPty.open(this.userPtyRef.current);
    userPty.writeln(`running command: ${store.get("gdb_command")}`);
    userPty.writeln("");
    userPty.attachCustomKeyEventHandler(
      // @ts-expect-error
      customKeyEventHandler({
        pty_name: "user_pty",
        pty: userPty,
        canPaste: true,
        pidStoreKey: "gdb_pid"
      })
    );
    GdbApi.getSocket().on("user_pty_response", function(data: string) {
      userPty.write(data);
    });
    userPty.onKey((data, ev) => {
      GdbApi.getSocket().emit("pty_interaction", {
        data: { pty_name: "user_pty", key: data.key, action: "write" }
      });
      if (data.domEvent.code === "Enter") {
        Actions.onConsoleCommandRun();
      }
    });

    const programPty = new Terminal({
      cursorBlink: true,
      macOptionIsMeta: true,
      scrollback: 9999
    });
    this.programPty = programPty;
    programPty.loadAddon(programFitAddon);
    programPty.open(this.programPtyRef.current);
    programPty.attachCustomKeyEventHandler(
      // @ts-expect-error
      customKeyEventHandler({
        pty_name: "program_pty",
        pty: programPty,
        canPaste: true,
        pidStoreKey: "inferior_pid"
      })
    );
    programPty.write(constants.xtermColors.grey);
    programPty.write(
      "Program output -- Programs being debugged are connected to this terminal. " +
        "You can read output and send input to the program from here."
    );
    programPty.writeln(constants.xtermColors.reset);
    GdbApi.getSocket().on("program_pty_response", function(pty_response: string) {
      programPty.write(pty_response);
    });
    programPty.onKey((data, ev) => {
      GdbApi.getSocket().emit("pty_interaction", {
        data: { pty_name: "program_pty", key: data.key, action: "write" }
      });
    });

    const gdbguiPty = new Terminal({
      cursorBlink: false,
      macOptionIsMeta: true,
      scrollback: 9999,
      disableStdin: true
      // theme: { background: "#888" }
    });
    this.gdbguiPty = gdbguiPty;
    gdbguiPty.write(constants.xtermColors.grey);
    gdbguiPty.writeln("gdbgui output (read-only)");
    gdbguiPty.writeln(
      "Copy/Paste available in all terminals with ctrl+alt+c, ctrl+alt+v"
    );
    gdbguiPty.write(constants.xtermColors.reset);

    gdbguiPty.attachCustomKeyEventHandler(
      // @ts-expect-error
      customKeyEventHandler({ pty_name: "unused", pty: gdbguiPty, canPaste: false })
    );

    gdbguiPty.loadAddon(gdbguiFitAddon);
    gdbguiPty.open(this.gdbguiPtyRef.current);
    // gdbguiPty is written to elsewhere
    store.set("gdbguiPty", gdbguiPty);

    const interval = setInterval(() => {
      fitAddon.fit();
      programFitAddon.fit();
      gdbguiFitAddon.fit();
      const socket = GdbApi.getSocket();

      if (socket.disconnected) {
        return;
      }
      socket.emit("pty_interaction", {
        data: {
          pty_name: "user_pty",
          rows: userPty.rows,
          cols: userPty.cols,
          action: "set_winsize"
        }
      });

      socket.emit("pty_interaction", {
        data: {
          pty_name: "program_pty",
          rows: programPty.rows,
          cols: programPty.cols,
          action: "set_winsize"
        }
      });
    }, 2000);

    setTimeout(() => {
      fitAddon.fit();
      programFitAddon.fit();
      gdbguiFitAddon.fit();
    }, 0);
  }
}
