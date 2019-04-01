gdbgui was started and developed by me in my spare time. It has grown in scope, and gotten more users than I ever expected from all over the world, which is very exciting. It has been really fun and rewarding to make, and I'm proud of how many developers it has helped to understand and develop their application. College professors list it in tools to learn in class syllabi, engineers are using at companies like Google, and the Rust language even distributes a [`rust-gdbgui` script](https://github.com/rust-lang/rust/blob/79d8a0fcefa5134db2a94739b1d18daa01fc6e9f/src/etc/rust-gdbgui).

I have had some help from the community to iron out bugs and some corner cases, but the majority of workload and features have been added by me. And the reality is this is a non-trivial application that has taken a lot of work and focus to get to where it's at. Nevertheless it is a side-project that provides little incentive for me to spend my nights and weekends working on it.

It is stable and useful to a wide range of gdb users. That said, I am still interested in it, and have thoughts about what would make it better. I have laid them out here, and may or may not implement them someday.

If you have interest in making any of these happen, please reach out and get the ball rolling! I, and many users, would appreciate your help :raised_hands:. gdbgui is a full stack application, but don't be afraid to help if you are only comfortable with one part of the stack. For the most part, the abstractions allow you to work in one part of the code without needing to understand others.

I will update this task with updates as they occur.

## Near term
- Typescript support. It's almost there thanks to @bcherny (https://github.com/cs01/gdbgui/pull/256)
- Use mkdocs+GitHub pages for documentation and improve docs (similar to [TermPair docs](https://cs01.github.io/termpair/))
- Use bootstrap 4 (or 5?) and add button to toggle light/dark theme

## Medium term
- Get paid sponsors/ads (similar to codesandbox.io) which will help  development continue for gdbgui. Contact grassfedcode@gmail.com if interested.
- Find volunteer to own support/bugfixes/testing for Windows
- Replace splitjs library with css grid
- Replace awesomeplete with CTRL+P file search similar to chrome devtools, VSCode, Atom, etc.
- Spawn three pty's on backend instead of running gdb as a subprocess under pygdbmi and trying to emulate terminal output. The benefit of this is the gdb terminal will behave *exactly* as if you ran it from the terminal, including interacting with the process being debugged (like inputting text), displaying newlines. It behaves the same as if you ran it, because it will be running identically. (Currently it runs as a subprocess and doesn't handle I/O exactly same as if you ran from a terminal. gdbgui has several imperfect hacks to workaround this)
pty 1: a gdb subprocess.
pty 2: the gdb machine interface interpreter, connected to pty 1 by using the [`new-ui`](https://sourceware.org/gdb/onlinedocs/gdb/Interpreters.html).
pty 3: This will be in a separate tab at the bottom of the gdbgui ui; a shell for the user to interact with (see [pyxtermjs](https://github.com/cs01/pyxterm.js/tree/master/pyxtermjs) and [TermPair](https://github.com/cs01/termpair)) . Similar to how VSCode has a terminal at the bottom of the VSCode window.
**This would possibly result in dropping support for Windows** (I am not certain if `pty` works on windows or not)

## Long term
- Use asyncio on backend so that pygbmi is event-based rather than running in a loop and pausing for a short period of time. **This would result in dropping support for older python versions**
- Use Microsoft's [Monaco](https://microsoft.github.io/monaco-editor/) as a text editor instead of hand-made React component. This essentially enables all of VSCode's language service capabilities in the browser, such jump to defintion, language-specific semantic understanding of variables for things like hover. Adds ability to edit+save files. Also must support inline disassembly display.
