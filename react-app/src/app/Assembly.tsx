import constants from "./constants";
import Handlers from "./EventHandlers";
import FileOps from "./FileOps";
import GdbApi from "./GdbApi";
import { store } from "./Store";

export function fetchAssemblyForFileAtLine(fullname: string, line: Nullable<number>) {
  requestDisassembly(fullname, line ?? 1);
}

function requestDisassembly(fullname: string, startLine: number) {
  const cmd = FileOps.getFetchDisassemblyCommand(fullname, startLine);
  if (cmd) {
    GdbApi.runGdbCommand(cmd);
  }
}

export function fetchDisassemblyAtAddress(address: number) {
  // https://sourceware.org/gdb/onlinedocs/gdb/GDB_002fMI-Data-Manipulation.html
  if (window.isNaN(address)) {
    return;
  }
  Handlers.addGdbGuiConsoleEntries(
    "Fetching assembly since file is missing",
    "GDBGUI_OUTPUT"
  );
  const end = address + 100;
  GdbApi.runGdbCommand(
    constants.DISASSEMBLY_FOR_MISSING_FILE_STR +
      `-data-disassemble -s 0x${address.toString(16)} -e 0x${end.toString(16)} -- 0`
  );
}
