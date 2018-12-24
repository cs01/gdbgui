import React from "react";

class Collapser extends React.Component {
  static defaultProps = { collapsed: false, id: "" };

  constructor(props) {
    super();
    this.state = {
      collapsed: props.collapsed,
      autosize: true,
      height_px: null, // if an integer, force height to this value
      _mouse_y_click_pos_px: null,
      _height_when_clicked: null
    };
    this.onmousedown_resizer = this.onmousedown_resizer.bind(this);
    this.onmouseup_resizer = this.onmouseup_resizer.bind(this);
    this.onmousemove_resizer = this.onmousemove_resizer.bind(this);
    this.onclick_restore_autosize = this.onclick_restore_autosize.bind(this);

    onmouseup_in_parent_callbacks.push(this.onmouseup_resizer.bind(this));
    onmousemove_in_parent_callbacks.push(this.onmousemove_resizer.bind(this));
  }

  toggle_visibility() {
    this.setState({ collapsed: !this.state.collapsed });
  }

  onmousedown_resizer(e) {
    this._resizing = true;
    this._page_y_orig = e.pageY;
    this._height_when_clicked = this.collapser_box_node.clientHeight;
  }

  onmouseup_resizer() {
    this._resizing = false;
  }

  onmousemove_resizer(e) {
    if (this._resizing) {
      let dh = e.pageY - this._page_y_orig;
      this.setState({
        height_px: this._height_when_clicked + dh,
        autosize: false
      });
    }
  }

  onclick_restore_autosize() {
    this.setState({ autosize: true });
  }

  render() {
    let style = {
      height: this.state.autosize ? "auto" : this.state.height_px + "px",
      overflow: this.state.autosize ? "visible" : "auto"
    };

    let reset_size_button = "";
    if (!this.state.autosize) {
      reset_size_button = (
        <button
          onClick={this.onclick_restore_autosize}
          className="placeholder reset-height btn btn-default btn-xs"
          title={
            "Height frozen at " + this.state.height_px + "px"
          }>
          auto
        </button>
      );
    }

    let resizer = "";
    if (!this.state.collapsed) {
      resizer = (
        <React.Fragment>
          <div
            className="rowresizer"
            onMouseDown={this.onmousedown_resizer}
            style={{ textAlign: "right" }}
            title="Click and drag to resize height">
            {" "}
            {reset_size_button}
          </div>
        </React.Fragment>
      );
    }

    return (
      <div className="collapser">
        <div className="pointer titlebar" onClick={this.toggle_visibility.bind(this)}>
          <span
            className={`glyphicon titlebar chevron glyphicon-chevron-${
              this.state.collapsed ? "right" : "down"
              }`}/>
          <span>{this.props.title}</span>
        </div>

        <div
          className={this.state.collapsed ? "hidden" : ""}
          id={this.props.id}
          style={style}
          ref={n => (this.collapser_box_node = n)}>
          {this.props.content}
        </div>

        {resizer}
      </div>
    );
  }
}
