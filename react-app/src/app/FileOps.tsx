import { store } from "statorgfc";
import GdbApi from "./GdbApi";
import constants from "./constants";
import Actions from "./Actions";
import { debug } from "./InitialData";
import _ from "lodash";
import $ from "jquery";

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
  _fetch: function (fullname: string, startLine: number, endLine: number) {
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
      highlight: store.get("highlight_source_code"),
    };

    $.ajax({
      url: "/read_file",
      cache: false,
      type: "GET",
      data: data,
      success: function (response) {
        const sourceCodeObj = {};
        let linenum = response.start_line;
        for (const line of response.source_code_array) {
          // @ts-expect-error ts-migrate(7053) FIXME: Element implicitly has an 'any' type because expre... Remove this comment to see the full error message
          sourceCodeObj[linenum] = line;
          linenum++;
        }

        FileOps.add_source_file_to_cache(
          fullname,
          sourceCodeObj,
          response.last_modified_unix_sec,
          response.num_lines_in_file
        );
      },
      error: function (response) {
        if (response.responseJSON && response.responseJSON.message) {
          Actions.add_console_entries(
            _.escape(response.responseJSON.message),
            constants.console_entry_type.STD_ERR
          );
        } else {
          Actions.add_console_entries(
            `${response.statusText} (${response.status} error)`,
            constants.console_entry_type.STD_ERR
          );
        }
        FileOps.add_missing_file(fullname);
      },
      complete: function () {
        FileFetcher._isFetching = false;
        FileFetcher._queue = FileFetcher._queue.filter((o) => o.fullname !== fullname);
        FileFetcher._fetchNext();
      },
    });
  },
  _fetchNext: function () {
    if (FileFetcher._isFetching) {
      return;
    }
    if (FileFetcher._queue.length) {
      const obj = FileFetcher._queue.shift();
      // @ts-expect-error ts-migrate(2532) FIXME: Object is possibly 'undefined'.
      FileFetcher._fetch(obj.fullname, obj.start_line, obj.end_line);
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
    // @ts-expect-error ts-migrate(2339) FIXME: Property 'subscribeToKeys' does not exist on type ... Remove this comment to see the full error message
    store.subscribeToKeys(
      [
        "inferior_program",
        "source_code_selection_state",
        "paused_on_frame",
        "current_assembly_address",
        "disassembly_for_missing_file",
        "highlight_source_code",
        "missing_files",
        "files_being_fetched",
        "gdb_version_array",
        "fullname_to_render",
        "line_of_source_to_flash",
        "cached_source_files",
        "max_lines_of_code_to_fetch",
      ],
      FileOps._storeChangeCallback
    );
  },
  userSelectFileToView: function (fullname: any, line: any) {
    store.set(
      "source_code_selection_state",
      constants.source_code_selection_states.USER_SELECTION
    );
    store.set("fullname_to_render", fullname);
    store.set("line_of_source_to_flash", line);
    store.set("make_current_line_visible", true);
    store.set("source_code_infinite_scrolling", false);
  },
  _storeChangeCallback: function () {
    if (store.get("inferior_program") === constants.inferior_states.running) {
      return;
    }

    const sourceCodeSelectionState = store.get("source_code_selection_state");
    let fullname = null;
    let isPaused = false;
    let pausedAddr = null;
    const pausedFrame = store.get("paused_on_frame");
    const pausedFrameFullname = pausedFrame ? pausedFrame.fullname : null;
    let requireCachedLineNum;
    if (
      sourceCodeSelectionState === constants.source_code_selection_states.USER_SELECTION
    ) {
      fullname = store.get("fullname_to_render");
      isPaused = false;
      pausedAddr = null;
      requireCachedLineNum = parseInt(store.get("line_of_source_to_flash"));
    } else if (
      sourceCodeSelectionState === constants.source_code_selection_states.PAUSED_FRAME
    ) {
      isPaused = store.get("inferior_program") === constants.inferior_states.paused;
      pausedAddr = store.get("current_assembly_address");
      fullname = pausedFrameFullname;
      requireCachedLineNum = parseInt(store.get("line_of_source_to_flash"));
    }

    const sourceCodeInfiniteScrolling = store.get("source_code_infinite_scrolling");
    const asmIsCached = FileOps.assembly_is_cached(fullname);
    const fileIsMissing = FileOps.is_missing_file(fullname);
    const obj = FileOps.getStartAndEndLines(
      fullname,
      requireCachedLineNum,
      sourceCodeInfiniteScrolling
    );

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
  getStartAndEndLines(
    fullname: any,
    requireCachedLineNum: any,
    sourceCodeInfiniteScrolling: any
  ) {
    let startLine;
    let endLine;
    if (sourceCodeInfiniteScrolling) {
      startLine = store.get("source_linenum_to_display_start");
      endLine = store.get("source_linenum_to_display_end");
      requireCachedLineNum = startLine;
    } else {
      const sourceFileObj = FileOps.get_source_file_obj_from_cache(fullname);
      if (!requireCachedLineNum) {
        requireCachedLineNum = 1;
      }

      startLine = Math.max(
        Math.floor(requireCachedLineNum - store.get("max_lines_of_code_to_fetch") / 2),
        1
      );
      endLine = Math.ceil(startLine + store.get("max_lines_of_code_to_fetch"));

      if (sourceFileObj) {
        // @ts-expect-error ts-migrate(2554) FIXME: Expected 2 arguments, but got 1.
        endLine = Math.ceil(Math.min(endLine, FileOps.get_num_lines_in_file(fullname))); // don't go past the end of the line
      }
      if (startLine > endLine) {
        startLine = Math.floor(
          Math.max(1, endLine - store.get("max_lines_of_code_to_fetch"))
        );
      }
      requireCachedLineNum = Math.min(requireCachedLineNum, endLine);
    }

    return {
      start_line: startLine,
      end_line: endLine,
      require_cached_line_num: requireCachedLineNum,
    };
  },
  updateSourceCodeState(
    fullname: any,
    start_line: any,
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
      store.set("source_linenum_to_display_start", start_line);
      // @ts-expect-error ts-migrate(2554) FIXME: Expected 2 arguments, but got 1.
      end_line = Math.min(end_line, FileOps.get_num_lines_in_file(fullname));
      store.set("source_linenum_to_display_end", end_line);
    } else if (fullname && !file_is_missing) {
      // we don't have file cached, and it is not known to be missing on the file system, so try to get it
      store.set("source_code_state", states.FETCHING_SOURCE);

      FileFetcher.fetch(fullname, start_line, end_line);
    } else if (
      is_paused &&
      paused_addr &&
      store
        .get("disassembly_for_missing_file")
        .some((obj: any) => parseInt(obj.address, 16) === parseInt(paused_addr, 16))
    ) {
      store.set("source_code_state", states.ASSM_CACHED);
    } else if (is_paused && paused_addr) {
      if (paused_addr in FileOps.unfetchableDisassemblyAddresses) {
        store.set("source_code_state", states.ASSM_UNAVAILABLE);
      } else {
        // get disassembly
        store.set("source_code_state", states.FETCHING_ASSM);
        FileOps.fetch_disassembly_for_missing_file(paused_addr);
      }
    } else if (file_is_missing) {
      store.set("source_code_state", states.FILE_MISSING);
    } else {
      store.set("source_code_state", states.NONE_AVAILABLE);
    }
  },
  get_num_lines_in_file: function (fullname: any, source_file_obj: any) {
    if (!source_file_obj) {
      source_file_obj = FileOps.get_source_file_obj_from_cache(fullname);
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
    const source_file_obj = FileOps.get_source_file_obj_from_cache(fullname);
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
      source_file_obj = FileOps.get_source_file_obj_from_cache(fullname);
    }
    return (
      source_file_obj &&
      source_file_obj.source_code_obj &&
      source_file_obj.source_code_obj[linenum] !== undefined
    );
  },
  get_line_from_file: function (fullname: any, linenum: any) {
    const source_file_obj = FileOps.get_source_file_obj_from_cache(fullname);
    if (!source_file_obj) {
      return null;
    }
    return source_file_obj.source_code_obj[linenum];
  },
  assembly_is_cached: function (fullname: any) {
    const source_file_obj = FileOps.get_source_file_obj_from_cache(fullname);
    return (
      source_file_obj &&
      source_file_obj.assembly &&
      Object.keys(source_file_obj.assembly).length
    );
  },
  get_source_file_obj_from_cache: function (fullname: any) {
    const cached_files = store.get("cached_source_files");
    for (const sf of cached_files) {
      if (sf.fullname === fullname) {
        return sf;
      }
    }
    return null;
  },
  add_source_file_to_cache: function (
    fullname: any,
    source_code_obj: any,
    last_modified_unix_sec: any,
    num_lines_in_file: any
  ) {
    const cached_file_obj = FileOps.get_source_file_obj_from_cache(fullname);
    if (cached_file_obj === null) {
      // nothing cached in the front end, add a new entry
      const new_source_file = {
        fullname: fullname,
        source_code_obj: source_code_obj,
        assembly: {},
        last_modified_unix_sec: last_modified_unix_sec,
        num_lines_in_file: num_lines_in_file,
        exists: true,
      };
      const cachedSourceFiles = store.get("cached_source_files");

      cachedSourceFiles.push(new_source_file);
      store.set("cached_source_files", cachedSourceFiles);
      FileOps.warningShownForOldBinary = false;
      FileOps.show_modal_if_file_modified_after_binary(
        fullname,
        new_source_file.last_modified_unix_sec
      );
    } else {
      // mutate existing source code object by adding keys (lines) of the new source code object
      Object.assign(cached_file_obj.source_code_obj, source_code_obj);
      store.set("cached_source_files", store.get("cached_source_files"));
    }
  },
  /**
   * Show modal warning if user is trying to show a file that was modified after the binary was compiled
   */
  show_modal_if_file_modified_after_binary(
    fullname: any,
    src_last_modified_unix_sec: any
  ) {
    if (store.get("inferior_binary_path")) {
      if (
        src_last_modified_unix_sec >
          store.get("inferior_binary_path_last_modified_unix_sec") &&
        FileOps.warningShownForOldBinary === false
      ) {
        Actions.show_modal(
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
              {`Binary: ${store.get("inferior_binary_path")}, modified ${moment(
                store.get("inferior_binary_path_last_modified_unix_sec") * 1000
              ).format(constants.DATE_FORMAT)}`}
              )
            </p>
          </div>
        );
        FileOps.warningShownForOldBinary = true;
      }
    }
  },
  get_cached_assembly_for_file: function (fullname: any) {
    for (const file of store.get("cached_source_files")) {
      if (file.fullname === fullname) {
        return file.assembly;
      }
    }
    return [];
  },
  refresh_cached_source_files: function () {
    FileOps.clear_cached_source_files();
  },
  clear_cached_source_files: function () {
    store.set("cached_source_files", []);
  },
  fetch_more_source_at_beginning() {
    const fullname = store.get("fullname_to_render");
    const center_on_line = store.get("source_linenum_to_display_start") - 1;
    // store.set('source_code_infinite_scrolling', true)
    store.set(
      "source_linenum_to_display_start",
      Math.max(
        store.get("source_linenum_to_display_start") -
          Math.floor(store.get("max_lines_of_code_to_fetch") / 2),
        1
      )
    );
    store.set(
      "source_linenum_to_display_end",
      Math.ceil(
        store.get("source_linenum_to_display_start") +
          store.get("max_lines_of_code_to_fetch")
      )
    );
    Actions.view_file(fullname, center_on_line);
    FileFetcher.fetch(
      fullname,
      store.get("source_linenum_to_display_start"),
      store.get("source_linenum_to_display_end")
    );
  },
  fetch_more_source_at_end() {
    store.set("source_code_infinite_scrolling", true);

    const fullname = store.get("fullname_to_render");
    let end_line =
      store.get("source_linenum_to_display_end") +
      Math.ceil(store.get("max_lines_of_code_to_fetch") / 2);

    const source_file_obj = FileOps.get_source_file_obj_from_cache(fullname);
    if (source_file_obj) {
      // @ts-expect-error ts-migrate(2554) FIXME: Expected 2 arguments, but got 1.
      end_line = Math.min(end_line, FileOps.get_num_lines_in_file(fullname)); // don't go past the end of the line
    }

    let start_line = end_line - store.get("max_lines_of_code_to_fetch");
    start_line = Math.max(1, start_line);
    store.set("source_linenum_to_display_end", end_line);
    store.set("source_linenum_to_display_start", start_line);

    FileFetcher.fetch(
      fullname,
      store.get("source_linenum_to_display_start"),
      store.get("source_linenum_to_display_end")
    );
  },
  is_missing_file: function (fullname: any) {
    return store.get("missing_files").indexOf(fullname) !== -1;
  },
  add_missing_file: function (fullname: any) {
    const missing_files = store.get("missing_files");
    missing_files.push(fullname);
    store.set("missing_files", missing_files);
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
  get_fetch_disassembly_command: function (
    fullname: any,
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
    if (mi_response_format === null || !_.isNumber(mi_response_format)) {
      // try to determine response format based on our guess of the gdb version being used
      // @ts-expect-error ts-migrate(2322) FIXME: Type '4' is not assignable to type 'null'.
      mi_response_format = FileOps.get_dissasembly_format_num(
        store.get("gdb_version_array")
      );
    }

    const fullname = store.get("fullname_to_render");
    let line = parseInt(store.get("line_of_source_to_flash"));
    if (!line) {
      line = 1;
    }
    FileOps.fetch_disassembly(fullname, line, mi_response_format);
  },
  fetch_disassembly: function (fullname: any, start_line: any, mi_response_format: any) {
    const cmd = FileOps.get_fetch_disassembly_command(
      fullname,
      start_line,
      mi_response_format
    );
    if (cmd) {
      GdbApi.run_gdb_command(cmd);
    }
  },
  fetch_disassembly_for_missing_file: function (hex_addr: any) {
    // https://sourceware.org/gdb/onlinedocs/gdb/GDB_002fMI-Data-Manipulation.html
    if (window.isNaN(hex_addr)) {
      return;
    }
    Actions.add_console_entries(
      "Fetching assembly since file is missing",
      constants.console_entry_type.GDBGUI_OUTPUT
    );
    const start = parseInt(hex_addr, 16);
    const end = start + 100;
    FileOps.disassemblyAddrBeingFetched = hex_addr;
    GdbApi.run_gdb_command(
      constants.DISASSEMBLY_FOR_MISSING_FILE_STR +
        `-data-disassemble -s 0x${start.toString(16)} -e 0x${end.toString(16)} -- 0`
    );
  },
  fetch_disassembly_for_missing_file_failed: function () {
    const addr_being_fetched = FileOps.disassemblyAddrBeingFetched;
    // @ts-expect-error ts-migrate(2538) FIXME: Type 'null' cannot be used as an index type.
    FileOps.unfetchableDisassemblyAddresses[addr_being_fetched] = true;
    FileOps.disassemblyAddrBeingFetched = null;
    Actions.add_console_entries(
      "Failed to retrieve assembly for missing file",
      constants.console_entry_type.GDBGUI_OUTPUT
    );
  },
  /**
   * Save assembly and render source code if desired
   * @param mi_assembly: array of assembly instructions
   * @param mi_token (int): corresponds to either null (when src file is known and exists),
   *  constants.DISASSEMBLY_FOR_MISSING_FILE_INT when source file is undefined or does not exist on filesystem
   */
  save_new_assembly: function (mi_assembly: any, mi_token: any) {
    FileOps.disassemblyAddrBeingFetched = null;

    if (!Array.isArray(mi_assembly) || mi_assembly.length === 0) {
      console.error("Attempted to save unexpected assembly", mi_assembly);
    }

    const fullname = mi_assembly[0].fullname;
    // @ts-expect-error ts-migrate(2551) FIXME: Property 'DISASSEMBLY_FOR_MISSING_FILE_INT' does n... Remove this comment to see the full error message
    if (mi_token === constants.DISASSEMBLY_FOR_MISSING_FILE_INT) {
      store.set("disassembly_for_missing_file", mi_assembly);
      return;
    }

    // convert assembly to an object, with key corresponding to line numbers
    // and values corresponding to asm instructions for that line
    const assembly_to_save = {};
    for (const obj of mi_assembly) {
      // @ts-expect-error ts-migrate(7053) FIXME: No index signature with a parameter of type 'numbe... Remove this comment to see the full error message
      assembly_to_save[parseInt(obj.line)] = obj.line_asm_insn;
    }

    const cached_source_files = store.get("cached_source_files");
    for (const cached_file of cached_source_files) {
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
        store.set("cached_source_files", cached_source_files);
        break;
      }
    }
  },
};
export default FileOps;
