/**
 * The middle left div will be rendered with this content
 */

import React from "react";
import SourceCode from "./SourceCode";
import FileOps from "./FileOps";
import $ from "jquery";

class MiddleLeft extends React.Component {
  fetchMoreAtTopTimeout: any;
  onscrollTimeout: any;
  sourceCodeContainerNode: any;
  constructor(props: any) {
    super(props);
    this.onscrollContainer = this.onscrollContainer.bind(this);
    this.onscrollTimeout = null;
    this.fetchMoreAtTopTimeout = null;
  }
  render() {
    return (
      <div
        id="code_container"
        style={{ overflow: "auto", height: "100%", minHeight: "200px" }}
        ref={(el) => (this.sourceCodeContainerNode = el)}
      >
        <SourceCode />
      </div>
    );
  }
  componentDidMount() {
    // @ts-expect-error ts-migrate(2322) FIXME: Type 'JQuery<HTMLElement>' is not assignable to ty... Remove this comment to see the full error message
    SourceCode.elCodeContainer = $("#code_container"); // todo: no jquery

    if (this.sourceCodeContainerNode) {
      this.sourceCodeContainerNode.onscroll = this.onscrollContainer.bind(this);
    }
  }

  onscrollContainer() {
    clearTimeout(this.onscrollTimeout);
    this.onscrollTimeout = setTimeout(this.checkToAutofetchMoreSource, 100);
  }

  checkToAutofetchMoreSource() {
    // test if "view more" buttons are visible, and if so, fetch more source

    let fetchingForTop = false; // don't fetch for more at bottom and top at same time
    if (SourceCode.viewMoreTopNode) {
      const { isVisible } = SourceCode.is_source_line_visible(
        // @ts-ignore
        $(SourceCode.viewMoreTopNode)
      );
      if (isVisible) {
        fetchingForTop = true;
        FileOps.fetch_more_source_at_beginning();
      }
    }

    if (!fetchingForTop && SourceCode.viewMoreBottomNode) {
      const { isVisible } = SourceCode.is_source_line_visible(
        $(SourceCode.viewMoreBottomNode)
      );
      if (isVisible) {
        FileOps.fetch_more_source_at_end();
      }
    }
  }
}

export default MiddleLeft;
