import Handlers from "./EventHandlers";

export type SourceFile = {
  path: string;
  sourceCode: Array<string>;
  lastModifiedUnixSec: number;
  linesInFile: number;
};

type DirEntry = { name: string; type: "dir" };
type FileEntry = { name: string; type: "file"; is_executable: boolean };
export type FsDirEntry = {
  path: string;
  children: Array<DirEntry | FileEntry>;
};

export class FileSystemService {
  missing: Map<string, true> = new Map();
  cachedFiles: Map<string, SourceFile> = new Map();
  cachedDirs: Map<string, FsDirEntry> = new Map();

  async readDir(path: string): Promise<Nullable<FsDirEntry>> {
    const data = { path };
    const response = await fetch("/read_dir", {
      body: JSON.stringify(data),
      method: "POST",
      headers: {
        Accept: "application/json",
        "Content-Type": "application/json",
      },
    });
    const sortFs = (a: FileEntry | DirEntry, b: FileEntry | DirEntry) => {
      return a.name.localeCompare(b.name);
    };
    if (response.ok) {
      const fsDir = (await response.json()) as FsDirEntry;
      const processedFsDir = {
        path: fsDir.path,
        children: [
          ...fsDir.children.filter((child) => child.type === "dir").sort(sortFs),
          ...fsDir.children.filter((child) => child.type === "file").sort(sortFs),
        ],
      };
      this.cachedDirs.set(path, processedFsDir);
      return processedFsDir;
    }
    this.missing.set(path, true);
    return null;
  }

  async readFile(
    path: string,
    startLine?: number,
    endLine?: number
  ): Promise<Nullable<SourceFile>> {
    if (this.missing.get(path) === true) {
      return null;
    }
    const data = {
      // eslint-disable-next-line camelcase
      start_line: startLine,
      // eslint-disable-next-line camelcase
      end_line: endLine,
      path,
    };
    const response = await fetch("/read_file", {
      body: JSON.stringify(data),
      method: "POST",
      headers: {
        Accept: "application/json",
        "Content-Type": "application/json",
      },
    });

    const handleError = async () => {
      this.missing.set(path, true);
      try {
        const errorMessage = (await response.json()).message;
        Handlers.addGdbGuiConsoleEntries(errorMessage, "STD_ERR");
      } catch (e) {
        Handlers.addGdbGuiConsoleEntries(
          `${response.statusText} (${response.status} error)`,
          "STD_ERR"
        );
      }
    };

    if (response.ok) {
      try {
        const responseJson: {
          start_line: number;
          last_modified_unix_sec: number;
          source_code_array: Array<string>;
          num_lines_in_file: number;
          path: string;
        } = await response.json();

        const sourceObject = {
          path: responseJson.path,
          sourceCode: responseJson.source_code_array,
          lastModifiedUnixSec: responseJson.last_modified_unix_sec,
          linesInFile: responseJson.num_lines_in_file,
        };
        this.cachedFiles.set(path, sourceObject);
        return sourceObject;
        // const sourceCodeObj: { [lineNum: number]: string } = {};
        // let linenum = responseJson.start_line;
        // for (const line of responseJson.source_code_array) {
        //   sourceCodeObj[linenum] = line;
        //   linenum++;
        // }

        // this.cache.set(path,(
        //   fullname,
        //   sourceCodeObj,
        //   responseJson.last_modified_unix_sec,
        //   responseJson.num_lines_in_file,
        //   responseJson.source_code_array
        // );
      } catch (e) {
        handleError();
      }
    } else {
      handleError();
    }
    return null;
  }
}

export const fileSystemService = new FileSystemService();
