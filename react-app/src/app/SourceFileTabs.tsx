import { store, useGlobalState, useGlobalValue } from "./Store";
import { SourceFile } from "./types";
import path from "path";
import { XIcon } from "@heroicons/react/solid";

function SourceFileTab(props: { sourceFile: SourceFile; currentFile: boolean }) {
  const bgColor = props.currentFile ? "bg-gray-800" : "bg-gray-900 ";
  return (
    <div
      title={props.sourceFile.fullname}
      className={`${bgColor} flex h-full mx-1 p-2 items-center space-x-2 text-sm`}
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
          store.set("cachedSourceFiles", filteredSourceFiles);
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
