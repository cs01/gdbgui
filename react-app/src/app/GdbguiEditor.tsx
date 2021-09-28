import Editor from "@monaco-editor/react";
import { useState } from "react";
import { ClockLoader as Loader } from "react-spinners";
const rTabs = (str: string) => str.trim().replace(/^ {4}/gm, "");

const cCode = `#include <stdio.h>
#include <string.h>
void say_something(const char *str)
{
  printf("%s\n", str);
}

struct mystruct_t
{
  int value;
  char letter;
  char *string;

  struct
  {
    double dbl;
  } substruct; /* named sub-struct */

  struct
  {
    float fp;
  }; /* anonymous struct */

  void *ptr;
  size_t struct_size;
  union {
    int unionint;
    double uniondouble;
  };
};

int main(int argc, char **argv)
{
  printf("Hello World\n");

  int retval = 1;

  /* bytes are allocated for s,
  but still contain garbage */
  struct mystruct_t s;
  s.value = 100;
  s.string = "pass";
  s.substruct.dbl = 567.8;
  s.letter = 'P';
  s.fp = 123.4;
  s.ptr = say_something;  /* address of function */
  s.ptr = &say_something; /* also address of function */
  s.unionint = 0;
  s.uniondouble = 1.0;

  for (int i = 0; i < 2; i++)
  {
    printf("i is %d\n", i);
  }

  if (!strcmp(s.string, "pass"))
  {
    retval = 0;
  }

  printf("returning %d\n", retval);
  say_something("Goodbye");
  return retval;
}
`;
const code = `
    // @monaco-editor/react is Monaco editor wrapper for painless integration with React
    // applications without need of webpack (or other module bundler)
    // configuration files.

    import React, { useState } from "react";
    import ReactDOM from "react-dom";

    import Editor from "@monaco-editor/react";
    import examples from "./examples";

    function App() {
      const [theme, setTheme] = useState("light");
      const [language, setLanguage] = useState("javascript");
      const [isEditorReady, setIsEditorReady] = useState(false);

      function handleEditorDidMount() {
        setIsEditorReady(true);
      }

      function toggleTheme() {
        setTheme(theme === "light" ? "vs-dark" : "light");
      }

      function toggleLanguage() {
        setLanguage(language === "javascript" ? "python" : "javascript");
      }

      return (
        <>
          <button onClick={toggleTheme} disabled={!isEditorReady}>
            Toggle theme
          </button>
          <button onClick={toggleLanguage} disabled={!isEditorReady}>
            Toggle language
          </button>

          <Editor
            height="90vh" // By default, it fully fits with its parent
            theme={theme}
            language={language}
            value={examples[language]}
            editorDidMount={handleEditorDidMount}
            loading={"Loading..."}
          />
        </>
      );
    }

    const rootElement = document.getElementById("root");
    ReactDOM.render(<App />, rootElement);
  `;

export function GdbguiEditor() {
  const [theme, setTheme] = useState("vs-dark");
  const [language, setLanguage] = useState("javascript");
  const [isEditorReady, setIsEditorReady] = useState(false);

  function handleEditorDidMount() {
    setIsEditorReady(true);
  }

  return (
    <Editor
      height="calc(100% - 19px)" // By default, it fully fits with its parent
      theme={theme}
      language="c"
      loading={<Loader />}
      // @ts-ignore
      value={cCode}
      // @ts-ignore
      editorDidMount={handleEditorDidMount}
    />
  );
}
