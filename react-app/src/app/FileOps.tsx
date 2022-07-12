import { store } from "./Store";
import GdbApi from "./GdbApi";
import constants from "./constants";
import Handlers from "./EventHandlers";
import { debug } from "./InitialData";
import { GdbAsmForFile, GdbAsmInstruction, GdbAsmResponse, SourceFile } from "./types";
import { showModal } from "./GdbguiModal";
import { fetchDisassemblyAtAddress } from "./Assembly";

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
    if (FileOps.isMissingFile(fullname)) {
      // file doesn't exist and we already know about it
      // don't keep trying to fetch disassembly
      console.warn(`tried to fetch a file known to be missing ${fullname}`);
      FileFetcher._isFetching = false;
      FileFetcher._fetchNext();
      return;
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
      FileOps.addMissingFile(fullname);
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

let disassemblyAddrBeingFetched: Nullable<number> = null;
const unfetchableDisassemblyAddresses = new Set<number>();
const FileOps = {
  warningShownForOldBinary: false,
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
        "stoppedDetails",
      ],
      FileOps.handleStoreChange
    );
  },
  userSelectFileToView: function (fullname: string, line: Nullable<number>) {
    store.set<typeof store.data.source_code_selection_state>(
      "source_code_selection_state",
      "user selected file"
    );
    store.set<typeof store.data.fullname_to_render>("fullname_to_render", fullname);
    store.set<typeof store.data.line_of_source_to_flash>(
      "line_of_source_to_flash",
      `${line}`
    );
    store.set<typeof store.data.make_current_line_visible>(
      "make_current_line_visible",
      line != null
    );
  },
  handleStoreChange: function () {
    if (store.data.gdbguiState === "running") {
      return;
    }
    const stoppedDetails = store.data.stoppedDetails;
    const sourceCodeSelectionState = store.data.source_code_selection_state;
    let fullname = null;
    let isPaused = false;
    let pausedAddr = null;
    const pausedFrame = stoppedDetails?.frame;
    const pausedFrameFullname = pausedFrame?.fullname ?? null;
    let sourceLineNumber;
    if (sourceCodeSelectionState === "user selected file") {
      fullname = store.data.fullname_to_render;
      isPaused = false;
      pausedAddr = null;
      sourceLineNumber = parseInt(store.data.line_of_source_to_flash ?? "");
    } else if (sourceCodeSelectionState === "paused frame") {
      isPaused = store.data.gdbguiState === "stopped";
      pausedAddr = store.data.current_assembly_address
        ? parseInt(store.data.current_assembly_address, 16)
        : null;
      fullname = pausedFrameFullname;
      sourceLineNumber = parseInt(store.data.line_of_source_to_flash ?? "");
    }

    const asmIsCached = fullname ? FileOps.assemblyIsCached(fullname) : false;
    const fileIsMissing = fullname ? FileOps.isMissingFile(fullname) : true;
    const obj = fullname ? FileOps.getStartAndEndLines(fullname, sourceLineNumber) : null;

    FileOps.updateSourceCodeState(
      fullname,
      obj ? obj.start_line : null,
      obj ? obj.require_cached_line_num : null,
      obj ? obj.end_line : null,
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
    fullname: Nullable<string>,
    startLine: Nullable<number>,
    requireCachedLineNum: Nullable<number>,
    endLine: Nullable<number>,
    assemblyIsCached: boolean,
    fileIsMissing: boolean,
    isPaused: boolean,
    pausedAddress: Nullable<number>
  ) {
    const lineIsCached = FileOps.lineIsCached(fullname, requireCachedLineNum);

    if (fullname && lineIsCached) {
      // we have file cached. We may have assembly cached too.
      store.set<typeof store.data.source_code_state>(
        "source_code_state",
        assemblyIsCached ? "ASM_AND_SOURCE_CACHED" : "SOURCE_CACHED"
      );
    } else if (fullname && !fileIsMissing) {
      // we don't have file cached, and it is not known to be missing on the file system, so try to get it
      store.set<typeof store.data.source_code_state>(
        "source_code_state",
        "FETCHING_SOURCE"
      );

      FileFetcher.fetch(fullname, startLine, endLine);
    } else if (
      isPaused &&
      pausedAddress &&
      store.data.disassembly_for_missing_file.some(
        (obj: any) => parseInt(obj.address, 16) === pausedAddress
      )
    ) {
      store.set<typeof store.data.source_code_state>("source_code_state", "ASM_CACHED");
    } else if (isPaused && pausedAddress) {
      if (pausedAddress in unfetchableDisassemblyAddresses) {
        store.set<typeof store.data.source_code_state>(
          "source_code_state",
          "ASM_UNAVAILABLE"
        );
      } else {
        // get disassembly
        store.set<typeof store.data.source_code_state>(
          "source_code_state",
          "FETCHING_ASSM"
        );
        if (disassemblyAddrBeingFetched != null) {
          console.error(`Already fetching disassembly at ${disassemblyAddrBeingFetched}`);
        }
        disassemblyAddrBeingFetched = pausedAddress;
        fetchDisassemblyAtAddress(pausedAddress);
      }
    } else if (fileIsMissing) {
      store.set<typeof store.data.source_code_state>("source_code_state", "FILE_MISSING");
    } else {
      store.set<typeof store.data.source_code_state>(
        "source_code_state",
        "NONE_REQUESTED"
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
  getLineFromFile: function (fullname: string, linenum: number) {
    const source_file_obj = FileOps.getSourceFileFromFullname(fullname);
    if (!source_file_obj) {
      return null;
    }
    return source_file_obj.source_code_obj[linenum];
  },
  assemblyIsCached: function (fullname: string): boolean {
    const sourceFile = FileOps.getSourceFileFromFullname(fullname);
    return Boolean(
      sourceFile && sourceFile.assembly && Object.keys(sourceFile.assembly).length > 0
    );
  },
  clearCachedAssemblyForFile: function (fullname: string) {
    const sourceFile = FileOps.getSourceFileFromFullname(fullname);
    if (!sourceFile) {
      return;
    }
    sourceFile.assembly = {};
    store.set<typeof store.data.source_code_state>("source_code_state", "SOURCE_CACHED");
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
        showModal(
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
  refreshCachedSourceFiles: function () {
    FileOps.clearCachedSourceFiles();
  },
  clearCachedSourceFiles: function () {
    store.set<typeof store.data.cachedSourceFiles>("cachedSourceFiles", []);
  },
  isMissingFile: function (fullname: string) {
    return store.data.missing_files.indexOf(fullname) !== -1;
  },
  addMissingFile: function (fullname: string) {
    const missing_files = store.data.missing_files;
    missing_files.push(fullname);
    store.set<typeof store.data.missing_files>("missing_files", missing_files);
  },
  getFetchDisassemblyCommand: function (
    fullname: string,
    startLine: number
  ): Nullable<string> {
    return (
      constants.INLINE_DISASSEMBLY_STR +
      `-data-disassemble -f ${fullname} -l ${startLine} -n 1000 -- 4`
    );
  },

  fetchDisassemblyForMissingFileFailed: function () {
    if (disassemblyAddrBeingFetched) {
      unfetchableDisassemblyAddresses.add(disassemblyAddrBeingFetched);
    } else {
      console.error("expected an address being fetched");
    }
    disassemblyAddrBeingFetched = null;
    Handlers.addGdbGuiConsoleEntries(
      "Failed to retrieve assembly for missing file",
      "GDBGUI_OUTPUT"
    );
  },
  /**
   * Save assembly and render source code if desired
   * @param asmInstructions: array of assembly instructions
   * @param miToken (int): corresponds to either null (when src file is known and exists),
   *  constants.DISASSEMBLY_FOR_MISSING_FILE_INT when source file is undefined or does not exist on filesystem
   */
  saveNewAssembly: function (asmInstructions: GdbAsmResponse, miToken: any) {
    disassemblyAddrBeingFetched = null;
    if (miToken === constants.DISASSEMBLY_FOR_MISSING_FILE_INT) {
      store.set<typeof store.data.disassembly_for_missing_file>(
        "disassembly_for_missing_file",
        asmInstructions as GdbAsmInstruction[]
      );
      return;
    }

    const asmForFile: GdbAsmForFile[] = asmInstructions as GdbAsmForFile[];
    const fullname = asmForFile[0].fullname;

    // convert assembly to an object, with key corresponding to line numbers
    // and values corresponding to asm instructions for that line
    const assembly_to_save = {};
    for (const obj of asmForFile) {
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
