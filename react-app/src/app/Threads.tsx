import React from "react";
import ReactTable from "./ReactTable";
import { store, useGlobalValue } from "./Store";
import GdbApi from "./GdbApi";
import Memory from "./Memory";
import { FileLink } from "./Links";
import MemoryLink from "./MemoryLink";
import { GdbStackFrame } from "./types";
import Handlers from "./EventHandlers";

class FrameArguments extends React.Component {
  render_frame_arg(frame_arg: any) {
    return [frame_arg.name, frame_arg.value];
  }

  render() {
    // @ts-expect-error ts-migrate(2339) FIXME: Property 'args' does not exist on type 'Readonly<{... Remove this comment to see the full error message
    let frame_args = this.props.args;
    // @ts-expect-error ts-migrate(2339) FIXME: Property 'args' does not exist on type 'Readonly<{... Remove this comment to see the full error message
    if (!this.props.args) {
      frame_args = [];
    }
    return (
      <ReactTable
        // @ts-expect-error ts-migrate(2769) FIXME: Property 'data' does not exist on type 'IntrinsicA... Remove this comment to see the full error message
        data={frame_args.map(this.render_frame_arg)}
        style={{ fontSize: "0.9em", borderWidth: "0" }}
      />
    );
  }
}

type ThreadsState = {
  threads: typeof store.data.threads;
  stack: typeof store.data.stack;
  selected_frame_num: typeof store.data.selected_frame_num;
};

function Frame(props: {
  frame: GdbStackFrame;
  isCurrentThread: boolean;
  isCurrentFrame: boolean;
}) {
  const frame = props.frame;
  return (
    <div
      className={`flex flex-wrap justify-between  ${
        props.isCurrentFrame && props.isCurrentThread
          ? "bg-blue-900 border-2 border-blue-600"
          : " "
      }`}
    >
      <div className="whitespace-nowrap">
        <button
          className="pr-2"
          title="Frame level"
          onClick={() => {
            GdbApi.requestSelectFrame(frame.level);
          }}
        >
          {frame.level}
        </button>{" "}
        <button
          className={frame.fullname ? "cursor-pointer" : ""}
          title={`${frame.func}()\n\n${frame.fullname}`}
          onClick={() => {
            GdbApi.requestSelectFrame(frame.level);
          }}
        >
          {frame.file ? `${frame.file}:${frame.line}` : null}
        </button>
      </div>
      <div>
        <MemoryLink addr={frame.addr} />
      </div>
    </div>
  );
}

export function Threads(props: {}) {
  const threads = useGlobalValue<typeof store.data.threads>("threads");
  const stackCurrentThread = useGlobalValue<typeof store.data.stack>("stack");
  if (threads === null) {
    return null;
  }
  const numThreads = threads.threads.length;
  return (
    <div className="px-1 space-y-3">
      {threads.threads.map((thread, i) => {
        const isCurrentThread = threads?.currentThreadId === thread.id;
        const frames = isCurrentThread ? stackCurrentThread ?? [] : [thread.frame];
        return (
          <div key={i} className="text-gray-100">
            <div
              className={
                "flex justify-between items-center " +
                (isCurrentThread ? "" : "cursor-pointer")
              }
              title={
                isCurrentThread
                  ? `Current thread (id ${thread.id})`
                  : `Select this thread (id ${thread.id})`
              }
              onClick={() => {
                if (!isCurrentThread) {
                  GdbApi.requestSelectThreadId(thread.id);
                }
              }}
            >
              <div
                className={isCurrentThread && numThreads > 1 ? "font-bold" : ""}
                title="Thread name"
              >
                {thread.name}
              </div>
              <div className="text-xs text-gray-500">
                {thread.state} | core {thread.core} | Thread ID{" "}
                <span className="bg-gray-700 rounded-xl p-1 text-gray-200">
                  {thread.id}
                </span>
              </div>
            </div>
            <div className="text-gray-400 text-sm">
              {frames.map((frame, i) => (
                <Frame
                  key={i}
                  frame={frame}
                  isCurrentFrame={thread.frame.level === frame.level}
                  isCurrentThread={isCurrentThread}
                />
              ))}
            </div>
          </div>
        );
      })}
    </div>
  );
}

class DEPRECATED_Threads extends React.Component<{}, ThreadsState> {
  constructor() {
    // @ts-expect-error ts-migrate(2554) FIXME: Expected 1-2 arguments, but got 0.
    super();
    store.reactComponentState(this, ["threads", "stack", "selected_frame_num"]);
  }

  render() {
    return <div>deprecated</div>;

    // if (this.state.threads?.threads.length) {
    //   return <span className="placeholder" />;
    // }

    // const content = [];

    // for (const thread of this.state.threads?.threads ?? []) {
    //   const isCurrentThreadBeingRendered =
    //     thread.id === this.state.threads?.currentThreadId;
    //   const stack = Threads.getStackForThread(
    //     thread.frame,
    //     this.state.stack,
    //     isCurrentThreadBeingRendered
    //   );
    //   let row_data;
    //   try {
    //     row_data = Threads.get_row_data_for_stack(
    //       stack,
    //       this.state.selected_frame_num,
    //       thread.id,
    //       isCurrentThreadBeingRendered
    //     );
    //   } catch (err) {
    //     row_data = ["unknown", "unknown", "unknown"];
    //     console.log(err);
    //   }
    //   content.push(Threads.getThreadHeader(thread, isCurrentThreadBeingRendered));
    //   content.push(
    //     // @ts-expect-error ts-migrate(2769) FIXME: Type 'string' is not assignable to type 'never'.
    //     <ReactTable
    //       data={row_data}
    //       style={{ fontSize: "0.9em", marginBottom: 0 }}
    //       key={thread.id}
    //       header={["func", "file", "addr", "args"]}
    //       classes={["table-bordered", "table-striped"]}
    //     />
    //   );
    //   content.push(<br key={thread.id + "br"} />);
    // }
    // return <div>{content}</div>;
  }

  static getStackForThread(
    cur_frame: any,
    stack_data: any,
    is_current_thread_being_rendered: any
  ) {
    // each thread provides only the frame that it's paused on (cur_frame).
    // we also have the output of `-stack-list-frames` (stack_data), which
    // is the full stack of the selected thread
    if (is_current_thread_being_rendered) {
      for (const frame of stack_data) {
        if (frame && cur_frame && frame.addr === cur_frame.addr) {
          return stack_data;
        }
      }
    }
    return [cur_frame];
  }

  static getThreadHeader(thread: any, is_current_thread_being_rendered: any) {
    let selected;
    let cls = "";
    if (is_current_thread_being_rendered) {
      cls = "font-bold";
      selected = (
        <span
          className=" bg-yellow-700"
          title="This thread is selected. Variables can be inspected for the current frame of this thread."
        >
          selected
        </span>
      );
    } else {
      selected = (
        <button
          className="btn btn-default text-sm"
          onClick={() => {
            GdbApi.requestSelectThreadId(thread.id);
          }}
          title="Select this thread"
        >
          select
        </button>
      );
    }
    const details = Memory.textToLinks(thread["target-id"]);
    const core = thread.core ? `, Core ${thread.core}` : "";
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
    frame: any,
    is_selected_frame: any,
    thread_id: any,
    is_current_thread_being_rendered: any,
    frame_num: any
  ) {
    let onclick;
    const classes = [];
    let title;

    if (is_selected_frame) {
      // current frame, current thread
      onclick = () => {};
      classes.push("bold");
      title = `this is the active frame of the selected thread (frame id ${frame_num})`;
    } else if (is_current_thread_being_rendered) {
      onclick = () => {
        GdbApi.requestSelectFrame(frame_num);
      };
      classes.push("pointer");
      title = `click to select this frame (frame id ${frame_num})`;
    } else {
      // different thread, allow user to switch threads
      onclick = () => {
        GdbApi.requestSelectThreadId(thread_id);
      };
      classes.push("pointer");
      title = `click to select this thead (thread id ${thread_id})`;
    }
    const key = thread_id + frame_num;

    return [
      <span key={key} title={title} className={classes.join(" ")} onClick={onclick}>
        {frame.func}
      </span>,
      <FileLink fullname={frame.fullname} file={frame.file} line={frame.line} />,
      <MemoryLink addr={frame.addr} />,
      // @ts-expect-error ts-migrate(2769) FIXME: Property 'args' does not exist on type 'IntrinsicA... Remove this comment to see the full error message
      <FrameArguments args={frame.args} />,
    ];
  }

  static get_row_data_for_stack(
    stack: any,
    selected_frame_num: any,
    thread_id: any,
    is_current_thread_being_rendered: any
  ) {
    const row_data = [];
    let frame_num = 0;
    for (const frame of stack) {
      const is_selected_frame =
        selected_frame_num === frame_num && is_current_thread_being_rendered;
      row_data.push(
        DEPRECATED_Threads.get_frame_row(
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
  static update_stack(stack: any) {
    store.set<typeof store.data.stack>("stack", stack);
    store.set<typeof store.data.paused_on_frame>(
      "paused_on_frame",
      stack[store.data.selected_frame_num || 0]
    );
    store.set(
      "fullname_to_render",
      store.data.paused_on_frame ? store.data.paused_on_frame.fullname : {}
    );
    store.set<typeof store.data.line_of_source_to_flash>(
      "line_of_source_to_flash",
      `${store.data.paused_on_frame.line}`
    );
    store.set<typeof store.data.current_assembly_address>(
      "current_assembly_address",
      store.data.paused_on_frame.addr
    );
    store.set<typeof store.data.make_current_line_visible>(
      "make_current_line_visible",
      true
    );
  }
}

export default DEPRECATED_Threads;
