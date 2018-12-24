// eslint-disable-next-line
import React from "react";

export const step0 =
  <div>
    <h5>Welcome to gdbgui.</h5>
    <p>
      This guide can be shown at any time by clicking the menu button,
      <span className="glyphicon glyphicon-menu-hamburger"> </span>, then clicking
      "Show Guide".
    </p>
  </div>


export const step1 =
  <div>
    <h5>Enter the path to the binary you wish to debug here.</h5>
    <p>This is the first thing you should do.</p>
    <p>
      The path can be absolute, or relative to where gdbgui was launched from.
    </p>
  </div>

export const step2 =
  <div>
    <h5>Press this button to load the executable specified in the input.</h5>
    <p>This is the second thing you should do.</p>
    <p>
      Debugging won't start, but you will be able to set breakpoints. If
      present,{" "}
      <a href="https://en.wikipedia.org/wiki/Debug_symbol">debugging symbols</a>{" "}
      in the binary are also loaded.
    </p>
    <p>
      If you don't want to debug a binary, click the dropdown to choose a
      different target type.
    </p>
  </div>

export const step3 =
  <div>
    <h5>
      These buttons allow you to control execution of the target you are
      debugging.
    </h5>
    <p>
      Hover over these buttons to see a description of their action. For
      example, the <span className="glyphicon glyphicon-repeat"/> button starts
      (or restarts) a program from the beginning.
    </p>
    <p>
      Each button has a keyboard shortcut. For example, you can press "r" to
      start running.
    </p>
  </div>

export const step4 =
  <div>
    <h5>You can view gdb's output here.</h5>
    You usually don't need to enter commands here, but you have the option to
    if there is something you can't do in the UI.
  </div>

export const step5 =
  <div>
    <h5>
      This sidebar contains a visual, interactive representation of the state of
      your program
    </h5>
    <p>
      You can see which function the process is stopped in, explore variables,
      and much more.
    </p>
    <p>
      There is more to discover, but this should be enough to get you started.
    </p>
    <p>
      Something missing? Found a bug?{" "}
      <a href="https://github.com/cs01/gdbgui/issues/">Create an issue</a> on
      github.
    </p>
    <p>Happy debugging!</p>
  </div>
