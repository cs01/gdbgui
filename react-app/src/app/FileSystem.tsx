import {
  BeakerIcon,
  DocumentIcon,
  FolderIcon,
  FolderOpenIcon,
} from "@heroicons/react/solid";
import path from "path/posix";
import React, { useEffect, useState } from "react";
import FileOps from "./FileOps";
import { fileSystemService, FsDirEntry } from "./FileSystemService";
import { store } from "./Store";

const hiddenColor = "text-gray-600";
const normalColor = "text-gray-200";

function File(props: { fullPath: string; fileName: string; isExecutable: boolean }) {
  const isHidden = props.fileName.startsWith(".");
  return (
    <div className="flex items-center text-sm align-middle">
      <div className="flex flex-grow  hover:bg-gray-900 cursor-pointer items-center whitespace-nowrap overflow-x-hidden">
        <DocumentIcon
          className="icon "
          onClick={() => {
            FileOps.userSelectFileToView(props.fullPath, null);
          }}
        />
        {props.isExecutable ? (
          <button
            title={`Debug this file ${props.fullPath}`}
            onClick={() => {
              store.set("userTargetInput", props.fullPath);
            }}
            className="bg-purple-900 hover:bg-purple-600 rounded-md mr-2"
          >
            debug this file
          </button>
        ) : null}
        <div
          className={`${isHidden ? hiddenColor : normalColor} w-full`}
          onClick={() => {
            FileOps.userSelectFileToView(props.fullPath, null);
          }}
        >
          {props.fileName}
        </div>
      </div>
    </div>
  );
}

function Folder(props: { path: string; name: string; depth?: number; expand?: boolean }) {
  const [expanded, setExpanded] = useState(props.expand ?? false);
  const [fsDir, setFsDir] = useState<Nullable<FsDirEntry>>(
    fileSystemService.cachedDirs.get(props.path) ?? null
  );
  const depth = props.depth ?? 0;

  if (expanded === true && fsDir === null) {
    fileSystemService.readDir(props.path).then((fsDir) => {
      setFsDir(fsDir);
    });
  }
  const getChildren = () => {
    if (!expanded) {
      return null;
    }
    if (fsDir) {
      return fsDir.children.map((child) => {
        const childPath = props.path + "/" + child.name;
        if (child.type === "dir") {
          return (
            <Folder
              key={childPath}
              name={child.name}
              path={childPath}
              depth={depth + 1}
            />
          );
        } else {
          return (
            <File
              key={childPath}
              fullPath={childPath}
              fileName={child.name}
              isExecutable={child.is_executable}
            />
          );
        }
      });
    } else {
      return null;
    }
  };
  const isHidden = props.name.startsWith(".");
  return (
    <div>
      <div
        className="cursor-pointer flex items-center hover:bg-gray-900"
        onClick={async () => {
          setExpanded(!expanded);
        }}
      >
        <div className="w-5 text-purple-500">
          {expanded ? (
            <FolderOpenIcon className="icon " />
          ) : (
            <FolderIcon className="icon" />
          )}
        </div>
        <div className={`${isHidden ? hiddenColor : normalColor}`}>{props.name}</div>
      </div>
      <div>{/* indentation whitespace to grow */}</div>
      <div style={{ marginLeft: `${14}px` }}>{getChildren()}</div>
    </div>
  );
}

export function Filesystem(props: { initialDir: string }) {
  const [startDir, setStartDir] = useState(props.initialDir);
  const shouldShowMoreButton = startDir !== "/";
  const showMoreButton = (
    <div
      className="w-full cursor-pointer"
      onClick={() => {
        const folders = startDir.split("/");
        const parentOfRoot = folders.slice(0, folders.length - 1).join("/");
        setStartDir(parentOfRoot === "" ? "/" : parentOfRoot);
      }}
    >
      ..
    </div>
  );
  return (
    <div className="max-h-96 overflow-y-scroll text-sm">
      {shouldShowMoreButton ? showMoreButton : null}
      <Folder key={startDir} name={startDir} path={startDir} />
    </div>
  );
}

// class FileSystem extends React.Component {
//   nodecount: any;
//   get_node_jsx(node: any, depth = 0) {
//     if (!node) {
//       return null;
//     }
//     this.nodecount++;

//     let get_child_jsx_for_node = (node: any) => {
//       if (!(node.children && node.toggled)) {
//         return null;
//       }
//       return (
//         <ul>{node.children.map((child: any) => this.get_node_jsx(child, depth + 1))}</ul>
//       );
//     };
//     let indent = "\u00A0\u00A0\u00A0".repeat(depth),
//       glyph = null;
//     let is_file = !node.children,
//       is_dir = !is_file;
//     if (is_dir) {
//       glyph = node.toggled ? "glyphicon-chevron-down" : "glyphicon-chevron-right";
//     }

//     let onClickName = null;
//     if (is_file) {
//       onClickName = () => {
//         // @ts-expect-error ts-migrate(2339) FIXME: Property 'onClickName' does not exist on type 'Rea... Remove this comment to see the full error message
//         this.props.onClickName(node);
//       };
//     }

//     return (
//       <React.Fragment key={this.nodecount}>
//         <li className="pointer">
//           {indent}
//           <span
//             className={"glyphicon  " + glyph}
//             onClick={() => {
//               // @ts-expect-error ts-migrate(2339) FIXME: Property 'onToggle' does not exist on type 'Readon... Remove this comment to see the full error message
//               this.props.onToggle(node);
//             }}
//           />
//           {/* @ts-expect-error ts-migrate(2322) FIXME: Type 'null' is not assignable to type '((event: Mo... Remove this comment to see the full error message */}
//           <span onClick={onClickName}>{node.name}</span>
//         </li>
//         {get_child_jsx_for_node(node)}
//       </React.Fragment>
//     );
//   }

//   render() {
//     this.nodecount = -1;
//     return (
//       <div id="filesystem">
//         {/* @ts-expect-error ts-migrate(2339) FIXME: Property 'rootnode' does not exist on type 'Readon... Remove this comment to see the full error message */}
//         <ul style={{ color: "#ccc" }}>{this.get_node_jsx(this.props.rootnode)}</ul>
//       </div>
//     );
//   }
// }

// export default FileSystem;
