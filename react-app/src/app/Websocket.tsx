import Actions from "./Actions";
import constants from "./constants";
import GdbApi from "./GdbApi";
import { store } from "./GlobalState";
import { debug } from "./InitialData";
import { handleGdbResponseArray } from "./processGdbResponse";
import io from "socket.io-client";
import { GdbMiMessage } from "./types";

// print to console if debug is true
let log: {
  (arg0: string): void;
  (...data: any[]): void;
  (message?: any, ...optionalParams: any[]): void;
  (): void;
};
if (debug) {
  log = console.info;
} else {
  log = function () {
    // stubbed out
  };
}

export class GdbWebsocket {
  private socket: SocketIOClient.Socket;
  public timeoutMin = 5;
  private waitForResponseTimeout: Nullable<NodeJS.Timeout> = null;
  private reponseTimeoutSec = 3;
  public runGdbCommand(cmd: Array<string>) {
    const commandArray = Array.isArray(cmd) ? cmd : [cmd];
    if (this.socket.connected) {
      // add the send command to the console to show commands that are
      // automatically run by gdb
      if (store.data.show_all_sent_commands_in_console) {
        Actions.addGdbGuiConsoleEntries(
          commandArray,
          constants.console_entry_type.SENT_COMMAND
        );
      }
      this.socket.emit("run_gdb_command", { cmd: commandArray });
      this.startResponseTimer();
    } else {
      log("queuing commands");
      const queuedGdbCommands = store.data.queuedGdbCommands.concat(commandArray);
      store.set("queuedGdbCommands", queuedGdbCommands);
    }
  }
  public publishPtyData(data: { pty_name: string; key: string; action: string }) {
    this.socket.emit("pty_interaction", {
      data,
    });
  }
  public addWebsocketEventHandler(eventName: string, callback: (data: string) => void) {
    this.socket.on(eventName, callback);
  }
  private startResponseTimer() {
    this.clearResponseTimeout();
    this.waitForResponseTimeout = setTimeout(() => {
      this.responseTimedOut();
    }, this.reponseTimeoutSec * 1000);
  }
  private clearResponseTimeout() {
    if (this.waitForResponseTimeout) {
      clearTimeout(this.waitForResponseTimeout);
    }
  }
  private responseTimedOut() {
    Actions.clear_program_state();
    store.set("waiting_for_response", false);
    if (this.socket.disconnected) {
      return;
    }

    Actions.addGdbGuiConsoleEntries(
      `No gdb response received after ${this.reponseTimeoutSec} seconds.`,
      constants.console_entry_type.GDBGUI_OUTPUT
    );
    Actions.addGdbGuiConsoleEntries(
      "Possible reasons include:",
      constants.console_entry_type.GDBGUI_OUTPUT
    );
    Actions.addGdbGuiConsoleEntries(
      "1) gdbgui, gdb, or the debugged process is not running.",
      constants.console_entry_type.GDBGUI_OUTPUT
    );

    Actions.addGdbGuiConsoleEntries(
      "2) gdb or the inferior process is busy running and needs to be " +
        "interrupted (press the pause button up top).",
      constants.console_entry_type.GDBGUI_OUTPUT
    );

    Actions.addGdbGuiConsoleEntries(
      "3) Something is just taking a long time to finish and respond back to " +
        "this browser window, in which case you can just keep waiting.",
      constants.console_entry_type.GDBGUI_OUTPUT
    );
  }
  constructor(gdbCommand: string, gdbPid: Nullable<number>) {
    const opts: SocketIOClient.ConnectOpts = {
      timeout: this.timeoutMin * 60 * 1000,
      reconnection: false,
      query: {
        gdbpid: gdbPid ?? 0,
        gdb_command: gdbCommand,
      },
    };

    this.socket =
      process.env.NODE_ENV === "development"
        ? io.connect("http://127.0.0.1:5000/gdb_listener", opts)
        : io.connect("/gdb_listener", opts);

    this.socket.on("connect", () => {
      log("connected");
      const queuedGdbCommands = store.data.queuedGdbCommands;
      if (queuedGdbCommands) {
        this.runGdbCommand(queuedGdbCommands);
        store.set("queuedGdbCommands", []);
      }
    });

    this.socket.on("gdb_response", (responseArray: Array<GdbMiMessage>) => {
      this.clearResponseTimeout();
      store.set("waiting_for_response", false);
      handleGdbResponseArray(responseArray);
    });
    this.socket.on("fatal_server_error", (data: { message: null | string }) => {
      Actions.addGdbGuiConsoleEntries(
        `Message from server: ${data.message}`,
        constants.console_entry_type.STD_ERR
      );
      this.socket?.close();
    });
    this.socket.on("error_running_gdb_command", (data: { message: any }) => {
      Actions.addGdbGuiConsoleEntries(
        `Error occurred on server when running gdb command: ${data.message}`,
        constants.console_entry_type.STD_ERR
      );
      this.socket?.close();
    });

    this.socket.on("server_error", function (data: { message: any }) {
      Actions.addGdbGuiConsoleEntries(
        `Server message: ${data.message}`,
        constants.console_entry_type.STD_ERR
      );
    });

    this.socket.on(
      "debug_session_connection_event",
      (connectionResponse: {
        pid: number;
        message: string | void;
        ok: boolean;
        started_new_gdb_process: boolean;
      }) => {
        const gdbPid = connectionResponse.pid;
        const message = connectionResponse.message;
        const error = !connectionResponse.ok;
        const newGdbProcessStarted = connectionResponse.started_new_gdb_process;

        if (message) {
          Actions.addGdbGuiConsoleEntries(
            message,
            error
              ? constants.console_entry_type.STD_ERR
              : constants.console_entry_type.GDBGUI_OUTPUT
          );
        }
        if (error) {
          this.socket?.close();
          return;
        }
        store.set("gdb_pid", gdbPid);

        if (newGdbProcessStarted) {
          GdbApi.runInitialCommands();
        } else {
          Actions.refresh_state_for_gdb_pause();
        }
      }
    );

    this.socket.on("disconnect", function () {
      // we no longer need to warn the user before they exit the page since the gdb process
      // on the server is already gone
      window.onbeforeunload = () => null;

      Actions.show_modal(
        "",
        <>
          <p>
            The connection to the gdb session has been closed. This tab will no longer
            function as expected.
          </p>
          <p className="font-bold">
            To start a new session or connect to a different session, go to the{" "}
            <a href="/dashboard">dashboard</a>.
          </p>
        </>
      );
      Actions.addGdbGuiConsoleEntries(
        `The connection to the gdb session has been closed. To start a new session, go to ${window.location.origin}/dashboard`,
        constants.console_entry_type.STD_ERR
      );

      // if (debug) {
      //   window.location.reload(true);
      // }
    });
  }
}
