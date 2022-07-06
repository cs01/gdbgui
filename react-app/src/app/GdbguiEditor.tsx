import MonacoEditor, { Monaco } from "@monaco-editor/react";
import { ClockLoader as Loader } from "react-spinners";
import constants from "./constants";
import FileOps from "./FileOps";
import { store, useGlobalState, useGlobalValue } from "./Store";
import * as monaco from "monaco-editor";
import { useEffect, useRef, useState } from "react";
import Breakpoints from "./Breakpoints";
import { GdbGuiBreakpoint } from "./types";
import _ from "lodash";

function getSourceCode(sourceCodeState: any, sourcePath: Nullable<string>): string {
  const states = constants.source_code_states;
  switch (sourceCodeState) {
    case states.ASSM_AND_SOURCE_CACHED: // fallthrough
    case states.SOURCE_CACHED: {
      const obj = FileOps.getSourceFileFromFullname(sourcePath);
      if (!obj) {
        console.error("expected to find source file");
        return "error";
      }
      return obj.sourceCode.join("\n");
    }
    case states.FETCHING_SOURCE: {
      return "fetching source, please wait";
    }
    case states.ASSM_CACHED: {
      return "assm cached";
      // const pausedAddr = this.state.paused_on_frame
      //   ? this.state.paused_on_frame.addr
      //   : null;
      // const asmArray = this.state.disassembly_for_missing_file;
      // return this.getBodyAsmOnly(asmArray, pausedAddr);
    }
    case states.FETCHING_ASSM: {
      return "fetching assembly, please wait";
    }
    case states.ASSM_UNAVAILABLE: {
      return "cannot access address";
    }
    case states.FILE_MISSING: {
      return `file not found: ${sourcePath}`;
    }
    case states.NONE_AVAILABLE: {
      return "";
    }
    default: {
      return "developer error";
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
  lineNumber: Nullable<string>,
  lastHighlight: React.MutableRefObject<Nullable<string[]>>
): void {
  if (!lineNumber) {
    editor.deltaDecorations([], []);
    return;
  }
  let endCol;
  const lineNumInt = parseInt(lineNumber);
  editor.revealLine(lineNumInt);
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
        className: "bg-gray-700",
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
  const flashLine = useGlobalValue<typeof store.data["line_of_source_to_flash"]>(
    "line_of_source_to_flash"
  );
  const breakpoints = useGlobalValue<typeof store.data.breakpoints>("breakpoints");
  const breakpointsCurrentFile = breakpoints.filter((b) => b.fullname === sourcePath);
  const [revealLine, setRevealLine] = useGlobalState<number>("revealLine");

  const lastHighlight = useRef<Nullable<string[]>>(null);
  const breakpointDecorations = useRef<Nullable<string[]>>(null);

  if (monacoObjects.current?.editor) {
    highlightLine(monacoObjects.current?.editor, flashLine, lastHighlight);
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
        wordWrap: "on",
        lineNumbers: (n: number) => {
          // TODO determine line number based on how many instructions per line
          return n.toString();
        },
      }}
    />
  );
}
