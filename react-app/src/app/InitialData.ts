type InitialData = {
  gdbgui_version: string;
  gdbpid: number;
  gdb_command: string;
  initial_binary_and_args: Array<string>;
  project_home: string;
  remap_sources: { [file: string]: string };
  themes: Array<string>;
  signals: Object;
  using_windows: boolean;
};
const defaultInitialData: InitialData = {
  gdbgui_version: "test",
  gdbpid: 0,
  gdb_command: "gdb test",
  initial_binary_and_args: [],
  project_home: "/dev/react",
  remap_sources: {},
  themes: ["monokai"],
  signals: {},
  using_windows: false,
};
// @ts-ignore
export const initial_data: InitialData = window.initial_data ?? defaultInitialData;

// @ts-ignore
export const debug: boolean = window.debug ?? true;
