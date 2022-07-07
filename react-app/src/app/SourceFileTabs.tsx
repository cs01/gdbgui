import { store, useGlobalState, useGlobalValue } from "./Store";
import { SourceFile } from "./types";
import path from "path";
import { XIcon } from "@heroicons/react/solid";

function getSourceFileHoverString(sourceFile: SourceFile) {
  return [
    `Path: ${sourceFile.fullname}`,
    `Encoding: ${sourceFile.encoding}`,
    `Last modified unixtime: ${sourceFile.last_modified_unix_sec}`,
    `Last modified: ${new Date(
      sourceFile.last_modified_unix_sec * 1000
    ).toLocaleString()}`,
  ].join("\n");
}

function SourceFileTab(props: { sourceFile: SourceFile; currentFile: boolean }) {
  const activeColors = props.currentFile
    ? "bg-gray-800 border-indigo-500 border-t-2 "
    : "bg-gray-900 ";
  return (
    <div
      title={getSourceFileHoverString(props.sourceFile)}
      className={`${activeColors} flex h-full mx-1 p-2 items-center space-x-2 text-sm`}
    >
      <button
        className="text-white"
        onClick={() => {
          store.set("fullname_to_render", props.sourceFile.fullname);
        }}
      >
        {path.basename(props.sourceFile.fullname)}
      </button>
      <button
        className="hover:bg-red-600"
        onClick={() => {
          const filteredSourceFiles = store.data.cachedSourceFiles.filter(
            (sf) => sf.fullname !== props.sourceFile.fullname
          );
          store.set<typeof store.data.cachedSourceFiles>(
            "cachedSourceFiles",
            filteredSourceFiles
          );
          store.set<typeof store.data.fullname_to_render>(
            "fullname_to_render",
            filteredSourceFiles[0].fullname
          );
        }}
      >
        <XIcon className="icon" />
      </button>
    </div>
  );
}

export function SourceFileTabs() {
  const sourceFiles =
    useGlobalValue<typeof store.data.cachedSourceFiles>("cachedSourceFiles");

  const fullname_to_render =
    useGlobalValue<typeof store.data.fullname_to_render>("fullname_to_render");

  return (
    <div className="flex-nowrap flex h-8 w-full">
      {sourceFiles.map((sf) => (
        <SourceFileTab
          key={sf.fullname}
          sourceFile={sf}
          currentFile={sf.fullname === fullname_to_render}
        />
      ))}
    </div>
  );
}
