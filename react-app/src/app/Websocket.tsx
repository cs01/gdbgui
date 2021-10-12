import Handlers from "./EventHandlers";
import GdbApi from "./GdbApi";
import { store } from "./Store";
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
    if (debug && commandArray.some((command) => command === undefined)) {
      throw new Error("Developer error: Attempting to send invalid, empty command");
    }
    if (this.socket.connected) {
      // add the send command to the console to show commands that are
      // automatically run by gdb
      if (store.data.show_all_sent_commands_in_console) {
        Handlers.addGdbGuiConsoleEntries(commandArray, "SENT_COMMAND");
      }
      this.socket.emit("run_gdb_command", { cmd: commandArray });
      this.startResponseTimer();
    } else {
      log("queuing commands");
      const queuedGdbCommands = store.data.queuedGdbCommands.concat(commandArray);
      store.set<typeof store.data.queuedGdbCommands>(
        "queuedGdbCommands",
        queuedGdbCommands
      );
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
    Handlers.clearProgramState();
    store.set<typeof store.data.waiting_for_response>("waiting_for_response", false);
    if (this.socket.disconnected) {
      return;
    }

    Handlers.addGdbGuiConsoleEntries(
      `No gdb response received after ${this.reponseTimeoutSec} seconds.`,
      "GDBGUI_OUTPUT"
    );
    Handlers.addGdbGuiConsoleEntries("Possible reasons include:", "GDBGUI_OUTPUT");
    Handlers.addGdbGuiConsoleEntries(
      "1) gdbgui, gdb, or the debugged process is not running.",
      "GDBGUI_OUTPUT"
    );

    Handlers.addGdbGuiConsoleEntries(
      "2) gdb or the inferior process is busy running and needs to be " +
        "interrupted (press the pause button up top).",
      "GDBGUI_OUTPUT"
    );

    Handlers.addGdbGuiConsoleEntries(
      "3) Something is just taking a long time to finish and respond back to " +
        "this browser window, in which case you can just keep waiting.",
      "GDBGUI_OUTPUT"
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
        store.set<typeof store.data.queuedGdbCommands>("queuedGdbCommands", []);
      }
    });

    this.socket.on("gdb_response", (responseArray: Array<GdbMiMessage>) => {
      this.clearResponseTimeout();
      store.set<typeof store.data.waiting_for_response>("waiting_for_response", false);
      handleGdbResponseArray(responseArray);
    });
    this.socket.on("fatal_server_error", (data: { message: null | string }) => {
      Handlers.addGdbGuiConsoleEntries(`Message from server: ${data.message}`, "STD_ERR");
      this.socket?.close();
    });
    this.socket.on("error_running_gdb_command", (data: { message: any }) => {
      Handlers.addGdbGuiConsoleEntries(
        `Error occurred on server when running gdb command: ${data.message}`,
        "STD_ERR"
      );
      this.socket?.close();
    });

    this.socket.on("server_error", function (data: { message: any }) {
      Handlers.addGdbGuiConsoleEntries(`Server message: ${data.message}`, "STD_ERR");
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
          Handlers.addGdbGuiConsoleEntries(message, error ? "STD_ERR" : "GDBGUI_OUTPUT");
        }
        if (error) {
          this.socket?.close();
          return;
        }
        store.set<typeof store.data.gdb_pid>("gdb_pid", gdbPid);

        if (newGdbProcessStarted) {
          GdbApi.runInitialCommands();
        } else {
          Handlers.refreshGdbguiState();
        }
      }
    );

    this.socket.on("disconnect", function () {
      // we no longer need to warn the user before they exit the page since the gdb process
      // on the server is already gone
      window.onbeforeunload = () => null;

      Handlers.show_modal(
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
      Handlers.addGdbGuiConsoleEntries(
        `The connection to the gdb session has been closed. To start a new session, go to ${window.location.origin}/dashboard`,
        "STD_ERR"
      );

      // if (debug) {
      //   window.location.reload(true);
      // }
    });
  }
}
