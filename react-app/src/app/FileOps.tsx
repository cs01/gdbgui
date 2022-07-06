import { store } from "./Store";
import GdbApi from "./GdbApi";
import constants from "./constants";
import Handlers from "./EventHandlers";
import { debug } from "./InitialData";
import _ from "lodash";
import { SourceFile } from "./types";

let debugPrint: any;
if (debug) {
  debugPrint = console.info;
} else {
  debugPrint = function () {
    // stubbed out
  };
}

const FileFetcher: {
  _isFetching: boolean;
  _queue: Array<{ fullname: string; startLine: number; endLine: number }>;
  _fetch: (fullname: string, startLine: number, endLine: number) => void;
  _fetchNext: () => void;
  fetchComplete: () => void;
  fetch: (fullname: any, startLine: any, endLine: any) => void;
} = {
  _isFetching: false,
  _queue: [],
  _fetch: async function (
    fullname: string,
    startLine: Nullable<number>,
    endLine: Nullable<number>
  ) {
    if (FileOps.is_missing_file(fullname)) {
      // file doesn't exist and we already know about it
      // don't keep trying to fetch disassembly
      console.warn(`tried to fetch a file known to be missing ${fullname}`);
      FileFetcher._isFetching = false;
      FileFetcher._fetchNext();
      return;
    }

    if (!_.isString(fullname)) {
      console.warn(`trying to fetch filename that is not a string`, fullname);
      FileOps.add_missing_file(fullname);
      FileFetcher._isFetching = false;
      FileFetcher._fetchNext();
    }

    FileFetcher._isFetching = true;

    const data = {
      // eslint-disable-next-line camelcase
      start_line: startLine,
      // eslint-disable-next-line camelcase
      end_line: endLine,
      path: fullname,
    };
    const response = await fetch("/read_file", {
      body: JSON.stringify(data),
      method: "POST",
      headers: {
        Accept: "application/json",
        "Content-Type": "application/json",
      },
    });

    async function handleError() {
      try {
        const errorMessage = (await response.json()).message;
        Handlers.addGdbGuiConsoleEntries(errorMessage, "STD_ERR");
      } catch (e) {
        Handlers.addGdbGuiConsoleEntries(
          `${response.statusText} (${response.status} error)`,
          "STD_ERR"
        );
      }
      FileOps.add_missing_file(fullname);
    }

    if (response.ok) {
      try {
        const responseJson: {
          start_line: number;
          last_modified_unix_sec: number;
          source_code_array: Array<string>;
          num_lines_in_file: number;
          encoding: string;
        } = await response.json();

        const sourceCodeObj: { [lineNum: number]: string } = {};
        let linenum = responseJson.start_line;
        for (const line of responseJson.source_code_array) {
          sourceCodeObj[linenum] = line;
          linenum++;
        }

        FileOps.addSourceFileToCache(
          fullname,
          sourceCodeObj,
          responseJson.last_modified_unix_sec,
          responseJson.num_lines_in_file,
          responseJson.source_code_array,
          responseJson.encoding
        );
      } catch (e) {
        handleError();
      }
    } else {
      handleError();
    }

    FileFetcher._isFetching = false;

    FileFetcher._queue = FileFetcher._queue.filter((o) => o.fullname !== fullname);

    FileFetcher._fetchNext();
  },
  _fetchNext: function () {
    if (FileFetcher._isFetching) {
      return;
    }
    if (FileFetcher._queue.length) {
      const obj = FileFetcher._queue.shift();
      if (!obj) {
        FileFetcher._fetchNext();
        return;
      }
      FileFetcher._fetch(obj.fullname, obj.startLine, obj.endLine);
    }
  },
  fetchComplete() {
    FileFetcher._isFetching = false;
    FileFetcher._fetchNext();
  },
  fetch: function (fullname: any, startLine: any, endLine: any) {
    if (!startLine) {
      startLine = 1;
      console.warn("expected start line");
    }
    if (!endLine) {
      endLine = startLine;
      console.warn("expected end line");
    }

    if (FileOps.lines_are_cached(fullname, startLine, endLine)) {
      debugPrint(`not fetching ${fullname}:${startLine}:${endLine} because it's cached`);
      return;
    }

    FileFetcher._queue.push({ fullname, startLine: startLine, endLine: endLine });
    FileFetcher._fetchNext();
  },
};

const FileOps = {
  warningShownForOldBinary: false,
  unfetchableDisassemblyAddresses: {},
  disassemblyAddrBeingFetched: null,
  init: function () {
    store.subscribeToKeys(
      [
        "gdbguiState",
        "source_code_selection_state",
        "paused_on_frame",
        "current_assembly_address",
        "disassembly_for_missing_file",
        "missing_files",
        "files_being_fetched",
        "fullname_to_render",
        "line_of_source_to_flash",
        "cachedSourceFiles",
        "max_lines_of_code_to_fetch",
      ],
      FileOps._storeChangeCallback
    );
  },
  userSelectFileToView: function (fullname: string, line: Nullable<number>) {
    store.set(
      "source_code_selection_state",
      constants.source_code_selection_states.USER_SELECTION
    );
    store.set<typeof store.data.fullname_to_render>("fullname_to_render", fullname);
    store.set<typeof store.data.line_of_source_to_flash>(
      "line_of_source_to_flash",
      `${line}`
    );
    store.set<typeof store.data.make_current_line_visible>(
      "make_current_line_visible",
      true
    );
  },
  _storeChangeCallback: function () {
    if (store.data.gdbguiState === "running") {
      return;
    }

    const sourceCodeSelectionState = store.data.source_code_selection_state;
    let fullname = null;
    let isPaused = false;
    let pausedAddr = null;
    const pausedFrame = store.data.paused_on_frame;
    const pausedFrameFullname = pausedFrame ? pausedFrame.fullname : null;
    let requireCachedLineNum;
    if (
      sourceCodeSelectionState === constants.source_code_selection_states.USER_SELECTION
    ) {
      fullname = store.data.fullname_to_render;
      isPaused = false;
      pausedAddr = null;
      requireCachedLineNum = parseInt(store.data.line_of_source_to_flash ?? "");
    } else if (
      sourceCodeSelectionState === constants.source_code_selection_states.PAUSED_FRAME
    ) {
      isPaused = store.data.gdbguiState === "stopped";
      pausedAddr = store.data.current_assembly_address;
      fullname = pausedFrameFullname;
      requireCachedLineNum = parseInt(store.data.line_of_source_to_flash ?? "");
    }

    const asmIsCached = FileOps.assembly_is_cached(fullname);
    const fileIsMissing = FileOps.is_missing_file(fullname);
    const obj = FileOps.getStartAndEndLines(fullname, requireCachedLineNum);

    FileOps.updateSourceCodeState(
      fullname,
      obj.start_line,
      obj.require_cached_line_num,
      obj.end_line,
      asmIsCached,
      fileIsMissing,
      isPaused,
      pausedAddr
    );
  },
  getStartAndEndLines(fullname: string, requireCachedLineNum: number | undefined) {
    let startLine;
    let endLine;
    const sourceFileObj = FileOps.getSourceFileFromFullname(fullname);
    if (!requireCachedLineNum) {
      requireCachedLineNum = 1;
    }

    startLine = Math.max(
      Math.floor(requireCachedLineNum - store.data.max_lines_of_code_to_fetch / 2),
      1
    );
    endLine = Math.ceil(startLine + store.data.max_lines_of_code_to_fetch);

    if (sourceFileObj) {
      // @ts-expect-error ts-migrate(2554) FIXME: Expected 2 arguments, but got 1.
      endLine = Math.ceil(Math.min(endLine, FileOps.get_num_lines_in_file(fullname))); // don't go past the end of the line
    }
    if (startLine > endLine) {
      startLine = Math.floor(
        Math.max(1, endLine - store.data.max_lines_of_code_to_fetch)
      );
    }
    requireCachedLineNum = Math.min(requireCachedLineNum, endLine);

    return {
      start_line: startLine,
      end_line: endLine,
      require_cached_line_num: requireCachedLineNum,
    };
  },
  updateSourceCodeState(
    fullname: string,
    start_line: number,
    require_cached_line_num: any,
    end_line: any,
    assembly_is_cached: any,
    file_is_missing: any,
    is_paused: any,
    paused_addr: any
  ) {
    const states = constants.source_code_states;
    const lineIsCached = FileOps.lineIsCached(fullname, require_cached_line_num);

    if (fullname && lineIsCached) {
      // we have file cached. We may have assembly cached too.
      store.set(
        "source_code_state",
        assembly_is_cached ? states.ASSM_AND_SOURCE_CACHED : states.SOURCE_CACHED
      );
    } else if (fullname && !file_is_missing) {
      // we don't have file cached, and it is not known to be missing on the file system, so try to get it
      store.set<typeof store.data.source_code_state>(
        "source_code_state",
        states.FETCHING_SOURCE
      );

      FileFetcher.fetch(fullname, start_line, end_line);
    } else if (
      is_paused &&
      paused_addr &&
      store.data.disassembly_for_missing_file.some(
        (obj: any) => parseInt(obj.address, 16) === parseInt(paused_addr, 16)
      )
    ) {
      store.set<typeof store.data.source_code_state>(
        "source_code_state",
        states.ASSM_CACHED
      );
    } else if (is_paused && paused_addr) {
      if (paused_addr in FileOps.unfetchableDisassemblyAddresses) {
        store.set<typeof store.data.source_code_state>(
          "source_code_state",
          states.ASSM_UNAVAILABLE
        );
      } else {
        // get disassembly
        store.set<typeof store.data.source_code_state>(
          "source_code_state",
          states.FETCHING_ASSM
        );
        FileOps.fetch_disassembly_for_missing_file(paused_addr);
      }
    } else if (file_is_missing) {
      store.set<typeof store.data.source_code_state>(
        "source_code_state",
        states.FILE_MISSING
      );
    } else {
      store.set<typeof store.data.source_code_state>(
        "source_code_state",
        states.NONE_AVAILABLE
      );
    }
  },
  get_num_lines_in_file: function (fullname: any, source_file_obj: any) {
    if (!source_file_obj) {
      source_file_obj = FileOps.getSourceFileFromFullname(fullname);
    }
    if (!source_file_obj) {
      console.error("Developer error: expected to find file object for " + fullname);
      return;
    }
    if (!source_file_obj.num_lines_in_file) {
      console.error('Developer error: expected key "num_lines_in_file"');
      return Infinity;
    }
    return source_file_obj.num_lines_in_file;
  },
  lines_are_cached: function (fullname: any, start_line: any, end_line: any) {
    const source_file_obj = FileOps.getSourceFileFromFullname(fullname);
    if (!source_file_obj) {
      return false;
    }

    const num_lines_in_file = FileOps.get_num_lines_in_file(fullname, source_file_obj);
    if (start_line > num_lines_in_file) {
      return false;
    }

    const safe_end_line = Math.min(end_line, num_lines_in_file);

    let linenum = start_line;
    while (linenum <= safe_end_line) {
      if (!FileOps.lineIsCached(fullname, linenum, source_file_obj)) {
        return false;
      }
      linenum++;
    }
    return true;
  },
  lineIsCached: function (fullname: any, linenum: any, source_file_obj?: any) {
    if (!source_file_obj) {
      source_file_obj = FileOps.getSourceFileFromFullname(fullname);
    }
    return (
      source_file_obj &&
      source_file_obj.source_code_obj &&
      source_file_obj.source_code_obj[linenum] !== undefined
    );
  },
  get_line_from_file: function (fullname: any, linenum: any) {
    const source_file_obj = FileOps.getSourceFileFromFullname(fullname);
    if (!source_file_obj) {
      return null;
    }
    return source_file_obj.source_code_obj[linenum];
  },
  assembly_is_cached: function (fullname: any) {
    const source_file_obj = FileOps.getSourceFileFromFullname(fullname);
    return (
      source_file_obj &&
      source_file_obj.assembly &&
      Object.keys(source_file_obj.assembly).length
    );
  },
  getSourceFileFromFullname: function (fullname: Nullable<string>): Nullable<SourceFile> {
    const cached_files = store.data.cachedSourceFiles;
    for (const sf of cached_files) {
      if (sf.fullname === fullname) {
        return sf;
      }
    }
    return null;
  },
  addSourceFileToCache: function (
    fullname: string,
    source_code_obj: any,
    last_modified_unix_sec: number,
    num_lines_in_file: number,
    sourceCode: Array<string>,
    encoding: string
  ) {
    const cached_file_obj = FileOps.getSourceFileFromFullname(fullname);
    if (cached_file_obj === null) {
      // nothing cached in the front end, add a new entry
      const newSourceFile: SourceFile = {
        fullname: fullname,
        source_code_obj: source_code_obj,
        sourceCode,
        assembly: {},
        last_modified_unix_sec: last_modified_unix_sec,
        num_lines_in_file: num_lines_in_file,
        exists: true,
        encoding,
      };
      const cachedSourceFiles = store.data.cachedSourceFiles;

      cachedSourceFiles.push(newSourceFile);
      store.set<typeof store.data.cachedSourceFiles>("cachedSourceFiles", [
        ...cachedSourceFiles,
      ]);
      FileOps.warningShownForOldBinary = false;
      FileOps.show_modal_if_file_modified_after_binary(
        fullname,
        newSourceFile.last_modified_unix_sec
      );
    } else {
      // mutate existing source code object by adding keys (lines) of the new source code object
      Object.assign(cached_file_obj.source_code_obj, source_code_obj);
      store.set<typeof store.data.cachedSourceFiles>(
        "cachedSourceFiles",
        store.data.cachedSourceFiles
      );
    }
  },
  /**
   * Show modal warning if user is trying to show a file that was modified after the binary was compiled
   */
  show_modal_if_file_modified_after_binary(
    fullname: any,
    src_last_modified_unix_sec: any
  ) {
    if (store.data.inferior_binary_path) {
      if (
        src_last_modified_unix_sec >
          (store.data.inferior_binary_path_last_modified_unix_sec ?? 0) &&
        FileOps.warningShownForOldBinary === false
      ) {
        Handlers.showModal(
          "Warning",
          <div>
            This source file was modified <span className="bold">after</span> the binary
            was compiled. Recompile the binary, then try again. Otherwise the source code
            may not match the binary.
            <p />
            {/* @ts-expect-error ts-migrate(2304) FIXME: Cannot find name 'moment'. */}
            <p>{`Source file: ${fullname}, modified ${moment(
              src_last_modified_unix_sec * 1000
            ).format(constants.DATE_FORMAT)}`}</p>
            <p>
              {/* @ts-expect-error ts-migrate(2304) FIXME: Cannot find name 'moment'. */}
              {`Binary: ${store.data.inferior_binary_path}, modified ${moment(
                (store.data.inferior_binary_path_last_modified_unix_sec ?? 0) * 1000
              ).format(constants.DATE_FORMAT)}`}
              )
            </p>
          </div>
        );
        FileOps.warningShownForOldBinary = true;
      }
    }
  },
  getCachedAssemblyForFile: function (fullname: string) {
    for (const file of store.data.cachedSourceFiles) {
      if (file.fullname === fullname) {
        return file.assembly;
      }
    }
    return [];
  },
  refresh_cachedSourceFiles: function () {
    FileOps.clear_cachedSourceFiles();
  },
  clear_cachedSourceFiles: function () {
    store.set<typeof store.data.cachedSourceFiles>("cachedSourceFiles", []);
  },
  is_missing_file: function (fullname: string) {
    return store.data.missing_files.indexOf(fullname) !== -1;
  },
  add_missing_file: function (fullname: string) {
    const missing_files = store.data.missing_files;
    missing_files.push(fullname);
    store.set<typeof store.data.missing_files>("missing_files", missing_files);
  },
  /**
   * gdb changed its api for the data-disassemble command
   * see https://www.sourceware.org/gdb/onlinedocs/gdb/GDB_002fMI-Data-Manipulation.html
   * TODO not sure which version this change occured in. I know in 7.7 it needs the '3' option,
   * and in 7.11 it needs the '4' option. I should test the various version at some point.
   */
  get_dissasembly_format_num: function (gdb_version_array: any) {
    if (gdb_version_array.length === 0) {
      // assuming new version, but we shouldn't ever not know the version...
      return 4;
    } else if (
      gdb_version_array[0] < 7 ||
      (parseInt(gdb_version_array[0]) === 7 && gdb_version_array[1] <= 7)
    ) {
      // this option has been deprecated in newer versions, but is required in older ones
      return 3;
    } else {
      return 4;
    }
  },
  getFetchDisassemblyCommand: function (
    fullname: string,
    start_line: any,
    mi_response_format: any
  ) {
    if (_.isString(fullname)) {
      return (
        constants.INLINE_DISASSEMBLY_STR +
        `-data-disassemble -f ${fullname} -l ${start_line} -n 1000 -- ${mi_response_format}`
      );
    } else {
      console.warn("not fetching undefined file");
    }
  },
  /**
   * Fetch disassembly for current file/line.
   */
  fetch_assembly_cur_line: function (mi_response_format = null) {
    const fullname = store.data.fullname_to_render;
    if (!fullname) {
      return;
    }
    let line = parseInt(store.data.line_of_source_to_flash ?? "");
    if (!line) {
      line = 1;
    }
    FileOps.requestDisassembly(fullname, line, "4");
  },
  requestDisassembly: function (
    fullname: string,
    start_line: any,
    mi_response_format: any
  ) {
    const cmd = FileOps.getFetchDisassemblyCommand(
      fullname,
      start_line,
      mi_response_format
    );
    if (cmd) {
      GdbApi.runGdbCommand(cmd);
    }
  },
  fetch_disassembly_for_missing_file: function (hex_addr: any) {
    // https://sourceware.org/gdb/onlinedocs/gdb/GDB_002fMI-Data-Manipulation.html
    if (window.isNaN(hex_addr)) {
      return;
    }
    Handlers.addGdbGuiConsoleEntries(
      "Fetching assembly since file is missing",
      "GDBGUI_OUTPUT"
    );
    const start = parseInt(hex_addr, 16);
    const end = start + 100;
    FileOps.disassemblyAddrBeingFetched = hex_addr;
    GdbApi.runGdbCommand(
      constants.DISASSEMBLY_FOR_MISSING_FILE_STR +
        `-data-disassemble -s 0x${start.toString(16)} -e 0x${end.toString(16)} -- 0`
    );
  },
  fetch_disassembly_for_missing_file_failed: function () {
    const addr_being_fetched = FileOps.disassemblyAddrBeingFetched;
    // @ts-expect-error ts-migrate(2538) FIXME: Type 'null' cannot be used as an index type.
    FileOps.unfetchableDisassemblyAddresses[addr_being_fetched] = true;
    FileOps.disassemblyAddrBeingFetched = null;
    Handlers.addGdbGuiConsoleEntries(
      "Failed to retrieve assembly for missing file",
      "GDBGUI_OUTPUT"
    );
  },
  /**
   * Save assembly and render source code if desired
   * @param mi_assembly: array of assembly instructions
   * @param mi_token (int): corresponds to either null (when src file is known and exists),
   *  constants.DISASSEMBLY_FOR_MISSING_FILE_INT when source file is undefined or does not exist on filesystem
   */
  saveNewAssembly: function (mi_assembly: any, mi_token: any) {
    FileOps.disassemblyAddrBeingFetched = null;

    if (!Array.isArray(mi_assembly) || mi_assembly.length === 0) {
      console.error("Attempted to save unexpected assembly", mi_assembly);
    }

    const fullname = mi_assembly[0].fullname;
    if (mi_token === constants.DISASSEMBLY_FOR_MISSING_FILE_STR) {
      store.set<typeof store.data.disassembly_for_missing_file>(
        "disassembly_for_missing_file",
        mi_assembly
      );
      return;
    }

    // convert assembly to an object, with key corresponding to line numbers
    // and values corresponding to asm instructions for that line
    const assembly_to_save = {};
    for (const obj of mi_assembly) {
      // @ts-expect-error ts-migrate(7053) FIXME: No index signature with a parameter of type 'numbe... Remove this comment to see the full error message
      assembly_to_save[parseInt(obj.line)] = obj.line_asm_insn;
    }

    const cachedSourceFiles = store.data.cachedSourceFiles;
    for (const cached_file of cachedSourceFiles) {
      if (cached_file.fullname === fullname) {
        cached_file.assembly = Object.assign(cached_file.assembly, assembly_to_save);

        // @ts-expect-error ts-migrate(2345) FIXME: Argument of type 'string[]' is not assignable to p... Remove this comment to see the full error message
        const maxAssmLine = Math.max(Object.keys(cached_file.assembly));
        // @ts-expect-error ts-migrate(2345) FIXME: Argument of type 'string[]' is not assignable to p... Remove this comment to see the full error message
        const maxSourceLine = Math.max(Object.keys(cached_file.source_code_obj));
        if (maxAssmLine > maxSourceLine) {
          cached_file.source_code_obj[maxAssmLine] = "";
          for (let i = 0; i < maxAssmLine; i++) {
            if (!cached_file.source_code_obj[i]) {
              cached_file.source_code_obj[i] = "";
            }
          }
        }
        store.set<typeof store.data.cachedSourceFiles>(
          "cachedSourceFiles",
          cachedSourceFiles
        );
        break;
      }
    }
  },
};
export default FileOps;
