// import { atom } from "recoil";

// const gdbCommand = atom({
//   key: "initialData",
//   default: 32,
// });

export type InitialData = {
  gdbgui_version: string;
  gdbpid: Nullable<number>;
  gdb_command: string;
  initial_binary_and_args: Array<string>;
  project_home: string;
  remap_sources: { [file: string]: string };
  signals: Object;
  using_windows: boolean;
  working_directory: string;
};
const defaultInitialData: InitialData = {
  gdbgui_version: "test",
  gdbpid: 0,
  gdb_command: "gdb test",
  initial_binary_and_args: [],
  project_home: "/dev/react",
  remap_sources: {},
  signals: {},
  using_windows: false,
  working_directory: "/home",
};
// @ts-ignore
export const initial_data: InitialData = window.initial_data ?? defaultInitialData;

// @ts-ignore
export const debug: boolean = process.env.NODE_ENV === "development";
