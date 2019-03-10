import React from "react";
import ReactTable from "./ReactTable.jsx";
import { store } from "statorgfc";
import GdbApi from "./GdbApi.jsx";
import Memory from "./Memory.jsx";
import { FileLink } from "./Links";
import MemoryLink from "./MemoryLink";

class FrameArguments extends React.Component {
  render_frame_arg(frame_arg) {
    return [frame_arg.name, frame_arg.value];
  }

  render() {
    let frame_args = this.props.args;
    if (!this.props.args) {
      frame_args = [];
    }
    return (
      <ReactTable
        data={frame_args.map(this.render_frame_arg)}
        style={{ fontSize: "0.9em", borderWidth: "0" }}
      />
    );
  }
}

class Threads extends React.Component {
  constructor() {
    super();
    store.connectComponentState(this, [
      "threads",
      "current_thread_id",
      "stack",
      "selected_frame_num"
    ]);
  }

  static select_thread_id(thread_id) {
    GdbApi.select_thread_id(thread_id);
  }

  static select_frame(framenum) {
    store.set("selected_frame_num", framenum);
    store.set("line_of_source_to_flash", null);
    store.set("make_current_line_visible", true);
    GdbApi.select_frame(framenum);
  }

  render() {
    if (this.state.threads.length <= 0) {
      return <span className="placeholder" />;
    }

    let content = [];

    for (let thread of this.state.threads) {
      let is_current_thread_being_rendered =
        parseInt(thread.id) === this.state.current_thread_id;
      let stack = Threads.get_stack_for_thread(
        thread.frame,
        this.state.stack,
        is_current_thread_being_rendered
      );
      let row_data;
      try {
        row_data = Threads.get_row_data_for_stack(
          stack,
          this.state.selected_frame_num,
          thread.id,
          is_current_thread_being_rendered
        );
      } catch (err) {
        row_data = ["unknown", "unknown", "unknown"];
        console.log(err);
      }
      content.push(Threads.get_thread_header(thread, is_current_thread_being_rendered));
      content.push(
        <ReactTable
          data={row_data}
          style={{ fontSize: "0.9em", marginBottom: 0 }}
          key={thread.id}
          header={["func", "file", "addr", "args"]}
          classes={["table-bordered", "table-striped"]}
        />
      );
      content.push(<br key={thread.id + "br"} />);
    }
    return <div>{content}</div>;
  }

  static get_stack_for_thread(cur_frame, stack_data, is_current_thread_being_rendered) {
    // each thread provides only the frame that it's paused on (cur_frame).
    // we also have the output of `-stack-list-frames` (stack_data), which
    // is the full stack of the selected thread
    if (is_current_thread_being_rendered) {
      for (let frame of stack_data) {
        if (frame && cur_frame && frame.addr === cur_frame.addr) {
          return stack_data;
        }
      }
    }
    return [cur_frame];
  }

  static get_thread_header(thread, is_current_thread_being_rendered) {
    let selected,
      cls = "";
    if (is_current_thread_being_rendered) {
      cls = "bold";
      selected = (
        <span
          className="label label-primary"
          title="This thread is selected. Variables can be inspected for the current frame of this thread."
        >
          selected
        </span>
      );
    } else {
      selected = (
        <button
          className="pointer btn btn-default btn-xs"
          onClick={() => {
            Threads.select_thread_id(thread.id);
          }}
          title="Select this thread"
          style={{ fontSize: "75%" }}
        >
          select
        </button>
      );
    }
    const details = Memory.make_addrs_into_links_react(thread["target-id"]);
    const core = thread.core ? `, core ${thread.core}` : "";
    const state = ", " + thread.state;
    const id = ", id " + thread.id;
    const name = thread.name ? `, ${thread.name}` : "";
    return (
      <span key={"thread" + thread.id} className={`${cls}`} style={{ fontSize: "0.9em" }}>
        {selected} {details}
        {id}
        {core}
        {state}
        {name}
      </span>
    );
  }
  static get_frame_row(
    frame,
    is_selected_frame,
    thread_id,
    is_current_thread_being_rendered,
    frame_num
  ) {
    let onclick;
    let classes = [];
    let title;

    if (is_selected_frame) {
      // current frame, current thread
      onclick = () => {};
      classes.push("bold");
      title = `this is the active frame of the selected thread (frame id ${frame_num})`;
    } else if (is_current_thread_being_rendered) {
      onclick = () => {
        Threads.select_frame(frame_num);
      };
      classes.push("pointer");
      title = `click to select this frame (frame id ${frame_num})`;
    } else {
      // different thread, allow user to switch threads
      onclick = () => {
        Threads.select_thread_id(thread_id);
      };
      classes.push("pointer");
      title = `click to select this thead (thread id ${thread_id})`;
    }
    let key = thread_id + frame_num;

    return [
      <span key={key} title={title} className={classes.join(" ")} onClick={onclick}>
        {frame.func}
      </span>,
      <FileLink fullname={frame.fullname} file={frame.file} line={frame.line} />,
      <MemoryLink addr={frame.addr} />,
      <FrameArguments args={frame.args} />
    ];
  }

  static get_row_data_for_stack(
    stack,
    selected_frame_num,
    thread_id,
    is_current_thread_being_rendered
  ) {
    let row_data = [];
    let frame_num = 0;
    for (let frame of stack) {
      let is_selected_frame =
        selected_frame_num === frame_num && is_current_thread_being_rendered;
      row_data.push(
        Threads.get_frame_row(
          frame || {},
          is_selected_frame,
          thread_id,
          is_current_thread_being_rendered,
          frame_num
        )
      );
      frame_num++;
    }

    if (stack.length === 0) {
      row_data.push(["unknown", "unknown", "unknown"]);
    }
    return row_data;
  }
  static update_stack(stack) {
    store.set("stack", stack);
    store.set("paused_on_frame", stack[store.get("selected_frame_num") || 0]);
    store.set(
      "fullname_to_render",
      store.get("paused_on_frame") ? store.get("paused_on_frame").fullname : {}
    );
    store.set("line_of_source_to_flash", parseInt(store.get("paused_on_frame").line));
    store.set("current_assembly_address", store.get("paused_on_frame").addr);
    store.set("make_current_line_visible", true);
  }
  set_thread_id(id) {
    store.set("current_thread_id", parseInt(id));
  }
}

export default Threads;
