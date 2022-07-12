import MonacoEditor, { Monaco } from "@monaco-editor/react";
import { ClockLoader as Loader } from "react-spinners";
import constants from "./constants";
import FileOps from "./FileOps";
import { store, useGlobalState, useGlobalValue } from "./Store";
import * as monaco from "monaco-editor";
import { useEffect, useRef, useState } from "react";
import Breakpoints from "./Breakpoints";
import {
  GdbAsmForFile,
  GdbAsmInstruction,
  GdbGuiBreakpoint,
  GdbguiSourceCodeState,
  SourceFile,
} from "./types";
import {
  getEffectiveLineNumberWithAsm,
  getHighlightLineFromNewNumber,
} from "./computeLineNumbers";

// function asmToRows(asmLines: GdbAsmForFile[] | GdbAsmLine[]) {
//   return asmLines
//     .map((g) => {
//       const onCurrentLine = g.address === store.data.stoppedDetails?.frame.addr;
//       return `${onCurrentLine ? ">" : " "} ${g.address} ${g.inst} ${g["func-name"]}`;
//     })
//     .join("\n");
// }

function getSourceCode(
  sourceCodeState: GdbguiSourceCodeState,
  sourcePath: Nullable<string>
): string {
  switch (sourceCodeState) {
    case "SOURCE_CACHED": {
      // display source code
      const obj = FileOps.getSourceFileFromFullname(sourcePath);
      if (!obj) {
        console.error("expected to find source file");
        return "error";
      }
      return obj.sourceCode.join("\n");
    }
    case "ASM_AND_SOURCE_CACHED":
      // display inline assembly with source code
      const obj = FileOps.getSourceFileFromFullname(sourcePath);
      if (!obj) {
        console.error(`Developer error - could not find file contents for ${sourcePath}`);
        return "";
      }
      const lineNumberToInstructionStrings = (lineNumber: number): string[] => {
        const asms = obj.assembly[lineNumber];
        return asms?.map(instructionToString).filter(Boolean) ?? [];
      };

      const instructionToString = (instruction: GdbAsmInstruction): string => {
        const indent = "";
        const maybeArrow =
          instruction.address === store.data.stoppedDetails?.frame.addr ? "-->" : "   ";
        return `${indent}${maybeArrow} ${instruction.address} ${instruction.inst}`;
      };

      return obj.sourceCode
        .map((sourceLine, lineNumber) => {
          const instructions = lineNumberToInstructionStrings(lineNumber).join("\n");
          return sourceLine + (instructions ? "\n" + instructions : "");
        })
        .join("\n");
    case "FETCHING_SOURCE": {
      return "fetching source, please wait";
    }
    case "ASM_CACHED": {
      // missing file
      const gdbAsm = store.data.disassembly_for_missing_file;
      return gdbAsm
        .map((g) => {
          const onCurrentLine = g.address === store.data.stoppedDetails?.frame.addr;
          return `${onCurrentLine ? ">" : " "} ${g.address} ${g.inst} ${g["func-name"]}`;
        })
        .join("\n");
    }
    case "FETCHING_ASSM": {
      return "fetching assembly, please wait";
    }
    case "ASM_UNAVAILABLE": {
      return "cannot access address";
    }
    case "FILE_MISSING": {
      return `file not found: ${sourcePath}`;
    }
    case "NONE_REQUESTED": {
      return "";
    }
    default: {
      return `developer error: unhandled state ${sourceCodeState}`;
    }
  }
}

// const hoverProviderName = "gdbguiVariableHover";
// monaco.languages.register({ id: hoverProviderName });

// const hoverProvider = {
//   provideHover: function (model: monaco.editor.ITextModel, position: monaco.Position) {
//     // return () => {
//     //   console.log(model);
//     //   console.log(position);
//     const value = model.getValue();
//     const word = model.getWordAtPosition(position);
//     console.log(value);
//     return {
//       range: new monaco.Range(
//         1,
//         word?.startColumn ?? 0,
//         model.getLineCount(),
//         word?.endColumn ?? 0
//       ),
//       contents: [
//         { value: "**SOURCE**" },
//         { value: "**SOURCE**" },
//         { value: "**SOURCE**" },
//       ],
//     };
//     // };
//   },
// };

// monaco.languages.registerHoverProvider(hoverProviderName, hoverProvider);

// monaco.languages.registerHoverProvider("mySpecialLanguage", {
//   provideHover: function (model, position) {
//     // Log the current word in the console, you probably want to do something else here.
//     console.log(model.getWordAtPosition(position));
//   },
// });

monaco.languages.register({ id: "myspecial" });
monaco.languages.registerHoverProvider("myspecial", {
  provideHover: function (model, position) {
    alert(model.getWordAtPosition(position));
    return null;
    // // return fetch("../playground.html").then(function (res) {
    // console.log("provider");
    // return Promise.resolve({
    //   range: new monaco.Range(
    //     1,
    //     1,
    //     model.getLineCount(),
    //     model.getLineMaxColumn(model.getLineCount())
    //   ),
    //   contents: [{ value: "**SOURCE**" }, { value: "```htmlasdfs\n```" }],
    // });
    // });
  },
});
function highlightLine(
  editor: monaco.editor.IStandaloneCodeEditor,
  lineNumInt: Nullable<number>,
  lastHighlight: React.MutableRefObject<Nullable<string[]>>
): void {
  if (!lineNumInt) {
    editor.deltaDecorations([], []);
    return;
  }
  let endCol;

  editor.revealLineInCenter(lineNumInt);
  try {
    endCol = editor.getModel()?.getLineMaxColumn(lineNumInt);
  } catch (e) {
    //
  }
  if (!endCol) {
    endCol = 999;
  }
  const r = new monaco.Range(lineNumInt, 1, lineNumInt, endCol);
  lastHighlight.current = editor.deltaDecorations(lastHighlight.current ?? [], [
    {
      range: r,
      options: {
        className: "bg-green-800",
        isWholeLine: true,
      },
    },
  ]);
}

function addBreakpointGlyphs(
  editor: monaco.editor.IStandaloneCodeEditor,
  breakpoints: typeof store.data.breakpoints,
  lastBreakpointGlyphs: React.MutableRefObject<Nullable<string[]>>
): void {
  const oldBreakpointGlyphs = lastBreakpointGlyphs.current ?? [];
  const newBreakpointGlyphs = breakpoints.map((breakpoint) => {
    return {
      range: new monaco.Range(breakpoint.line, 1, breakpoint.line, 1),
      options: {
        isWholeLine: true,
        glyphMarginClassName:
          (breakpoint.enabled === "y" ? "bg-red-800" : "bg-blue-500") +
          " rounded-full w-[1em] h-[1rem]",
      },
    };
  });

  lastBreakpointGlyphs.current = editor.deltaDecorations(
    oldBreakpointGlyphs,
    newBreakpointGlyphs
  );
}

export function GdbguiEditor() {
  const monacoObjects =
    useRef<Nullable<{ editor: monaco.editor.IStandaloneCodeEditor; monaco: Monaco }>>(
      null
    );

  const sourceCodeState =
    useGlobalValue<typeof store.data["source_code_state"]>("source_code_state");
  const sourcePath =
    useGlobalValue<typeof store.data["fullname_to_render"]>("fullname_to_render");

  const breakpoints = useGlobalValue<typeof store.data.breakpoints>("breakpoints");
  const wordWrap = useGlobalValue<typeof store.data.wordWrap>("wordWrap");
  const pausedFrame =
    useGlobalValue<typeof store.data.paused_on_frame>("paused_on_frame");
  const breakpointsCurrentFile = breakpoints.filter((b) => b.fullname === sourcePath);

  const lastHighlight = useRef<Nullable<string[]>>(null);
  const breakpointDecorations = useRef<Nullable<string[]>>(null);
  const sourceFile = FileOps.getSourceFileFromFullname(sourcePath);

  if (monacoObjects.current?.editor) {
    const lineNumberToHighlight = getLineNumToHighlight(
      pausedFrame &&
        pausedFrame?.fullname === sourceFile?.fullname &&
        "line" in pausedFrame
        ? pausedFrame?.line
        : null,
      sourceFile,
      sourceCodeState
    );
    highlightLine(monacoObjects.current?.editor, lineNumberToHighlight, lastHighlight);
    addBreakpointGlyphs(
      monacoObjects.current?.editor,
      breakpointsCurrentFile,
      breakpointDecorations
    );
  }
  function handleEditorDidMount(
    editor: monaco.editor.IStandaloneCodeEditor,
    monaco: Monaco
  ) {
    monacoObjects.current = {
      editor,
      monaco,
    };
    // setRevealLine((lineNum: Nullable<number>) => {
    //   editor.revealLine(lineNum);
    //   if (lineNum) {
    //     console.log("revealing line");
    //     editor.revealLine(lineNum);
    //   }
    // });
    editor.onMouseDown((e: monaco.editor.IEditorMouseEvent) => {
      // TODO handle gutter clicks
      //     https://microsoft.github.io/monaco-editor/playground.html#interacting-with-the-editor-listening-to-mouse-events shows mouseDown, mouseMove events over the glyph margin.
      // In Visual Studio Code source, you can see the editor.onMouseDown event tests for clicks on the gutter:
      // const data = e.target.detail as monaco.editor.IMarginData;
      if (
        e.target.type === monaco.editor.MouseTargetType.GUTTER_GLYPH_MARGIN
        // ? ||
        // data.isAfterLines ||
        // !editor.marginFreeFromNonDebugDecorations(e.target.position.lineNumber)
      ) {
        if (store.data.fullname_to_render && e.target.position?.lineNumber) {
          Breakpoints.toggleBreakpoint(
            store.data.fullname_to_render,
            e.target.position?.lineNumber
          );
        }
      } else {
        console.log("mouse down", e);
      }
    });
  }

  return (
    <MonacoEditor
      // height="calc(100% - 19px)" // By default, it fully fits with its parent
      theme={"vs-dark"}
      // language="myspecial"
      // loading={<Loader />}
      path={sourcePath || ""}
      value={getSourceCode(sourceCodeState, sourcePath)}
      onMount={handleEditorDidMount}
      options={{
        glyphMargin: true,
        wordWrap: wordWrap ? "on" : "off",
        lineNumbers: (n: number) => {
          // const lineNumberToInstructionStrings = (lineNumber: number): string[] => {
          //   const asms = obj.assembly[lineNumber];
          //   return asms?.map(instructionToString) ?? [];
          // };
          switch (sourceCodeState) {
            case "ASM_AND_SOURCE_CACHED": {
              if (!sourceFile) {
                console.error("Expected source file in this state");
                return "";
              }
              return getEffectiveLineNumberWithAsm(sourceFile, n);
            }
            default: {
              return n.toString();
            }
          }
        },
      }}
    />
  );
}

function getLineNumToHighlight(
  flashLine: Nullable<string>,
  sourceFile: Nullable<SourceFile>,
  sourceCodeState: GdbguiSourceCodeState
): Nullable<number> {
  if (!flashLine) {
    return null;
  }
  const lineNum = parseInt(flashLine);
  if (sourceCodeState === "ASM_AND_SOURCE_CACHED") {
    if (!sourceFile) {
      return null;
    }
    return getHighlightLineFromNewNumber(sourceFile, lineNum);
  } else {
    return lineNum;
  }
}
