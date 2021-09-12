import React from "react";
import ReactDOM from "react-dom";
import "./index.css";
import "./app/static/css/gdbgui.css";
import "./app/static/vendor/css/pygments/monokai.css";
import "./app/static/vendor/css/pygments/light.css";
import "./app/static/vendor/css/gdbgui_awesomeplete.css";
import "./app/static/css/splitjs-gdbgui.css";
// import "bootstrap";
import { Gdbgui } from "./app/gdbgui";
import reportWebVitals from "./reportWebVitals";
import { RecoilRoot } from "recoil";
ReactDOM.render(
  <React.StrictMode>
    <RecoilRoot>
      <Gdbgui />
    </RecoilRoot>
  </React.StrictMode>,
  document.getElementById("root")
);

// If you want to start measuring performance in your app, pass a function
// to log results (for example: reportWebVitals(console.log))
// or send to an analytics endpoint. Learn more: https://bit.ly/CRA-vitals
reportWebVitals();
