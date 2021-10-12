/**
 * A component to show/hide variable exploration when hovering over a variable
 * in the source code
 */

import React, { ReactNode, useLayoutEffect, useState } from "react";

import { BreakpointsFn } from "./Breakpoints";
import constants from "./constants";
import Expressions from "./Expressions";
import { GdbMiOutput } from "./GdbMiOutput";
import InferiorProgramInfo from "./InferiorProgramInfo";
import Locals from "./Locals";
import Memory from "./Memory";
import Registers from "./Registers";
import Tree from "./Tree";
import { Threads } from "./Threads";
import { ChevronDownIcon, ChevronRightIcon } from "@heroicons/react/outline";

const onmouseupInParentCallbacks: Array<() => void> = [];
const onmousemoveInParentCallbacks: Array<(event: any) => void> = [];

const onmouseupInParentCallback = function () {
  onmouseupInParentCallbacks.forEach((fn) => fn());
};
const onmousemoveInParentCallback = function (e: any) {
  onmousemoveInParentCallbacks.forEach((fn) => {
    fn(e);
  });
};

function CollapsableContainer(props: { content: ReactNode; title: string }) {
  const [collapsed, setCollapsed] = useState(false);
  return (
    <div className="w-full">
      <div
        className="w-full cursor-pointer bg-black-900 items-center"
        onClick={() => {
          setCollapsed(!collapsed);
        }}
      >
        <span className="w-full">
          {collapsed ? (
            <ChevronRightIcon className="icon inline" />
          ) : (
            <ChevronDownIcon className="icon inline" />
          )}
          <button className="ml-1 text-xs font-bold uppercase">{props.title}</button>
        </span>
      </div>
      {collapsed ? null : <div>{props.content}</div>}
      <hr className="w-full my-1 border-purple-900" />
    </div>
  );
}

export function RightSidebar(props: { signals: {}; debug: boolean }) {
  return (
    <div>
      <CollapsableContainer title={"breakpoints"} content={<BreakpointsFn />} />
      <CollapsableContainer title={"variables"} content={<Locals />} />
      <CollapsableContainer title={"stack and threads"} content={<Threads />} />
      <CollapsableContainer title={"memory"} content={<Memory />} />
      <CollapsableContainer title={"gdb mi output"} content={<GdbMiOutput />} />
    </div>
  );
  // useLayoutEffect(() => {
  //   Tree.init();
  // }, []);

  // const input_style = {
  //   display: "inline",
  //   width: "100px",
  //   padding: "6px 6px",
  //   height: "25px",
  //   fontSize: "1em",
  // };

  // return (
  //   <div
  //     className="content"
  //     onMouseUp={onmouseupInParentCallback}
  //     onMouseMove={onmousemoveInParentCallback}
  //   >
  //     {/* @ts-expect-error ts-migrate(2322) FIXME: Property 'title' does not exist on type 'Intrinsic... Remove this comment to see the full error message */}
  //     <Collapser title="threads" content={<Threads />} />

  //     {/* @ts-expect-error ts-migrate(2322) FIXME: Property 'title' does not exist on type 'Intrinsic... Remove this comment to see the full error message */}
  //     <Collapser id="locals" title="local variables" content={<Locals />} />
  //     {/* @ts-expect-error ts-migrate(2322) FIXME: Property 'title' does not exist on type 'Intrinsic... Remove this comment to see the full error message */}
  //     <Collapser id="expressions" title="expressions" content={<Expressions />} />
  //     <Collapser
  //       // @ts-expect-error ts-migrate(2322) FIXME: Property 'title' does not exist on type 'Intrinsic... Remove this comment to see the full error message
  //       title="Tree"
  //       content={
  //         <div>
  //           <input
  //             id="tree_width"
  //             className="form-control"
  //             placeholder="width (px)"
  //             style={input_style}
  //           />
  //           <input
  //             id="tree_height"
  //             className="form-control"
  //             placeholder="height (px)"
  //             style={input_style}
  //           />
  //           <div id={constants.tree_component_id} />
  //         </div>
  //       }
  //     />
  //     {/* @ts-expect-error ts-migrate(2322) FIXME: Property 'title' does not exist on type 'Intrinsic... Remove this comment to see the full error message */}
  //     <Collapser id="memory" title="memory" content={<Memory />} />
  //     {/* @ts-expect-error ts-migrate(2322) FIXME: Property 'title' does not exist on type 'Intrinsic... Remove this comment to see the full error message */}
  //     <Collapser title="breakpoints" content={<Breakpoints />} />
  //     <Collapser
  //       // @ts-expect-error ts-migrate(2322) FIXME: Property 'title' does not exist on type 'Intrinsic... Remove this comment to see the full error message
  //       title="signals"
  //       // @ts-expect-error ts-migrate(2322) FIXME: Property 'signals' does not exist on type 'Intrins... Remove this comment to see the full error message
  //       content={<InferiorProgramInfo signals={this.props.signals} />}
  //     />
  //     {/* @ts-expect-error ts-migrate(2322) FIXME: Property 'title' does not exist on type 'Intrinsic... Remove this comment to see the full error message */}
  //     <Collapser title="registers" collapsed={true} content={<Registers />} />

  //     {mi_output}
  //   </div>
  // );
}
