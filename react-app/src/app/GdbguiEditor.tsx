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
      const obj = FileOps.get_source_file_obj_from_cache(sourcePath);
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

monaco.languages.register({ id: "gdbguiVariableHover" });

const hoverProvider = {
  provideHover: function (model: monaco.editor.ITextModel, position: monaco.Position) {
    // return () => {
    //   console.log(model);
    //   console.log(position);
    const value = model.getValue();
    const word = model.getWordAtPosition(position);
    console.log(value);
    return {
      range: new monaco.Range(
        1,
        word?.startColumn ?? 0,
        model.getLineCount(),
        word?.endColumn ?? 0
      ),
      contents: [
        { value: "**SOURCE**" },
        { value: "**SOURCE**" },
        { value: "**SOURCE**" },
      ],
    };
    // };
  },
};

monaco.languages.registerHoverProvider("gdbguiVariableHover", hoverProvider);

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
  try {
    endCol = editor.getModel()?.getLineMaxColumn(lineNumInt);
  } catch (e) {
    //
  }
  if (!endCol) {
    endCol = 999;
  }
  endCol = 999;
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
  const breakpointLines: { [key: number]: Nullable<GdbGuiBreakpoint> } = {};
  for (const breakpoint of breakpoints) {
    breakpointLines[breakpoint.line] = breakpoint;
  }
  // @ts-ignore
  const lineCount = editor?.getModel().getLineCount();
  console.error("got lines", lineCount);
  // if (!_.isNumber(lineCount)) {
  //   return;
  // }
  const newBreakpointGlyphs: monaco.editor.IModelDeltaDecoration[] = [];
  // for (let lineNum = 1; lineNum++; lineNum <= 5) {
  //   console.log(lineNum);
  // }
  //   const breakpoint = breakpointLines[lineNum];
  //   if (breakpoint) {
  //     newBreakpointGlyphs.push({
  //       range: new monaco.Range(lineNum, 1, lineNum, 1),
  //       options: {
  //         isWholeLine: true,
  //         glyphMarginClassName:
  //           (breakpoint.enabled === "y" ? "bg-red-800" : "bg-blue-500") + " rounded ",
  //       },
  //     });
  //   } else {
  //     newBreakpointGlyphs.push({
  //       range: new monaco.Range(lineNum, 1, lineNum, 1),
  //       options: {
  //         isWholeLine: true,
  //         glyphMarginClassName: "hover:bg-red-100 rounded ",
  //       },
  //     });
  //   }
  // }
  // const linesWithBreakpoints = breakpoints.reduce(
  //   (prev: { [key: number]: null }, breakpoint: GdbGuiBreakpoint) => {
  //     pr;
  //   },
  //   {}
  // );

  // const newBreakpointGlyphs = breakpoints.map((breakpoint) => {
  //   return {
  //     range: new monaco.Range(breakpoint.line, 1, breakpoint.line, 1),
  //     options: {
  //       isWholeLine: true,
  //       glyphMarginClassName:
  //         (breakpoint.enabled === "y" ? "bg-red-800" : "bg-blue-500") + " rounded ",
  //     },
  //   };
  // });

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
  const [revealLine, setRevealLine] =
    useGlobalState<(lineNum: number) => void>("revealLine");

  const lastHighlight = useRef<Nullable<string[]>>(null);
  const breakpointDecorations = useRef<Nullable<string[]>>(null);

  if (monacoObjects.current?.editor) {
    highlightLine(monacoObjects.current?.editor, flashLine, lastHighlight);
    addBreakpointGlyphs(
      monacoObjects.current?.editor,
      breakpoints,
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
    setRevealLine((lineNum: Nullable<number>) => {
      if (lineNum) {
        editor.revealLine(lineNum);
      }
    });
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
      height="calc(100% - 19px)" // By default, it fully fits with its parent
      theme={"vs-dark"}
      language="c"
      loading={<Loader />}
      value={getSourceCode(sourceCodeState, sourcePath)}
      onMount={handleEditorDidMount}
      options={{ glyphMargin: true }}
    />
  );
}
