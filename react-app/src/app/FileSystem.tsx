import { DocumentIcon, FolderIcon, FolderOpenIcon } from "@heroicons/react/solid";
import path from "path/posix";
import React, { useEffect, useState } from "react";
import FileOps from "./FileOps";
import { fileSystemService, FsDir } from "./FileSystemService";

function Folder(props: { path: string; name: string; depth?: number; expand?: boolean }) {
  const [expanded, setExpanded] = useState(props.expand ?? false);
  const [fsDir, setFsDir] = useState<Nullable<FsDir>>(null);
  const depth = props.depth ?? 0;
  if (expanded === false && fsDir === null) {
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
        if (child.type === "dir") {
          return (
            <Folder
              name={child.name}
              path={props.path + "/" + child.name}
              depth={depth + 1}
            />
          );
        } else {
          return (
            <div
              onClick={() => {
                FileOps.userSelectFileToView(props.path + "/" + child.name, null);
              }}
              className="flex hover:bg-gray-900 cursor-pointer items-center whitespace-nowrap overflow-x-hidden"
            >
              <DocumentIcon className="icon " />
              <div>{child.name}</div>
            </div>
          );
        }
      });
    } else {
      return null;
    }
  };
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
        <div>{props.name}</div>
      </div>
      <div></div>
      <div style={{ marginLeft: `${(depth + 1) * 12}px` }}>{getChildren()}</div>
    </div>
  );
}

export function Filesystem(props: { initialDir: string }) {
  // const [fsDir, setFsDir] = useState<Nullable<FsDir>>(null);
  // useEffect(() => {
  //   const getFolderData = async () => {
  //     const fsDir = await fileSystemService.readDir(props.initialDir);
  //     setFsDir(fsDir);
  //   };
  //   getFolderData();
  // }, [props.initialDir]);
  // if (!fsDir) {
  //   return null;
  // }

  return (
    <div className="max-h-96 overflow-y-scroll">
      <Folder expand={true} name={props.initialDir} path={props.initialDir} />
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
