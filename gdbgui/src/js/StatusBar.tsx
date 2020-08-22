import React from "react";
import Util from "./Util";
import { store } from "statorgfc";

type State = any;

/**
 * Component to render a status message with optional error/warning label
 */
class StatusBar extends React.Component<{}, State> {
  render() {
    if (this.state.waiting_for_response) {
      return <span className="glyphicon glyphicon-refresh glyphicon-refresh-animate" />;
    } else {
      return "";
    }
  }
}

export default StatusBar;
