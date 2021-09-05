// https://sourceware.org/gdb/onlinedocs/gdb/GDB_002fMI-Support-Commands.html#GDB_002fMI-Support-Commands

import { store } from "statorgfc";
type Feature =
  | "thread-info"
  | "reverse"
  | "async"
  | "frozen-varobjs"
  | "pending-breakpoints"
  | "data-read-memory-bytes"
  | "python"
  | "ada-task-info"
  | "language-option"
  | "info-gdb-mi-command"
  | "undefined-command-error-code"
  | "exec-run-start-option"
  | "data-disassemble-a-option"
  | "breakpoint-notification";

export function processFeatures(features: Array<Feature>) {
  if (features.indexOf("reverse") !== -1) {
    store.set("reverse_supported", true);
  }
}
