import Editor from "@monaco-editor/react";
import { useState } from "react";
import { ClockLoader as Loader } from "react-spinners";
import constants from "./constants";
import FileOps from "./FileOps";
import { useGlobalValue } from "./GlobalState";
import monaco from "monaco-editor";
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
      return "empty";
    }
    default: {
      return "developer error";
    }
  }
}

export function GdbguiEditor() {
  const [theme, setTheme] = useState("vs-dark");
  const [language, setLanguage] = useState("javascript");
  const [isEditorReady, setIsEditorReady] = useState(false);
  const sourceCodeState = useGlobalValue("source_code_state");
  const sourcePath = useGlobalValue("fullname_to_render");
  function handleEditorDidMount(editor: typeof monaco.editor, monaco: any) {
    setIsEditorReady(true);

    editor.onMouseDown((e: monaco.editor.IEditorMouseEvent) => {
      // TODO handle gutter clicks
      //     https://microsoft.github.io/monaco-editor/playground.html#interacting-with-the-editor-listening-to-mouse-events shows mouseDown, mouseMove events over the glyph margin.
      // In Visual Studio Code source, you can see the editor.onMouseDown event tests for clicks on the gutter:
      // const data = e.target.detail as monaco.editor.IMarginData;
      // if (
      //   e.target.type !== monaco.editor.MouseTargetType.GUTTER_GLYPH_MARGIN ||
      //   data.isAfterLines ||
      //   !editor.marginFreeFromNonDebugDecorations(e.target.position.lineNumber)
      // ) {
      //   return;
      // }
    });
  }

  return (
    <Editor
      height="calc(100% - 19px)" // By default, it fully fits with its parent
      theme={theme}
      language="c"
      loading={<Loader />}
      value={getSourceCode(sourceCodeState, sourcePath)}
      // @ts-ignore
      editorDidMount={handleEditorDidMount}
    />
  );
}
