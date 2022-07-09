/**
 * A component to show/hide variable exploration when hovering over a variable
 * in the source code
 */

import React, { ReactNode, useState } from "react";

import Breakpoints, { BreakpointsFn } from "./Breakpoints";
import { GdbMiOutput } from "./GdbMiOutput";
import { Watch } from "./Watch";
import { Locals } from "./Locals";
import { Memory } from "./Memory";
import { Registers } from "./Registers";
import { Threads } from "./Threads";
import { ChevronDownIcon, ChevronRightIcon } from "@heroicons/react/outline";
import { Filesystem } from "./FileSystem";
import { TrashIcon } from "@heroicons/react/solid";
import { store, useGlobalValue } from "./Store";

function CollapsableContainer(props: {
  content: ReactNode;
  title: string;
  rightTitleBarContent?: ReactNode;
}) {
  const [collapsed, setCollapsed] = useState(false);
  return (
    <div className="w-full">
      <div className="w-full cursor-pointer bg-black-900 items-center flex">
        <span
          className="w-full"
          onClick={() => {
            setCollapsed(!collapsed);
          }}
        >
          {collapsed ? (
            <ChevronRightIcon className="icon inline" />
          ) : (
            <ChevronDownIcon className="icon inline" />
          )}
          <button className="ml-1 text-xs font-bold uppercase">{props.title}</button>
        </span>
        {props.rightTitleBarContent}
      </div>
      {<div className={`mx-1 ${collapsed ? "hidden" : ""} `}>{props.content}</div>}
      <hr className="w-full my-2 border-purple-900" />
    </div>
  );
}

export function RightSidebar(props: { signals: {}; debug: boolean; initialDir: string }) {
  const breakpoints = useGlobalValue<typeof store.data.breakpoints>("breakpoints");
  return (
    <div>
      <CollapsableContainer
        title={"filesystem"}
        content={<Filesystem initialDir={props.initialDir} />}
      />
      <CollapsableContainer
        title={"breakpoints"}
        content={<BreakpointsFn />}
        rightTitleBarContent={
          breakpoints.length ? (
            <button
              className="flex items-center mb-2 hover:bg-gray-800 whitespace-nowrap"
              onClick={() => {
                Breakpoints.deleteAllBreakpoints();
              }}
            >
              <TrashIcon className="icon " />
              <span className="text-xs">Delete all</span>
            </button>
          ) : null
        }
      />
      <CollapsableContainer title={"variables"} content={<Locals />} />
      <CollapsableContainer title={"watch"} content={<Watch />} />
      <CollapsableContainer title={"threads"} content={<Threads />} />
      <CollapsableContainer title={"memory"} content={<Memory />} />
      <CollapsableContainer title={"registers"} content={<Registers />} />
      <CollapsableContainer title={"gdb mi output"} content={<GdbMiOutput />} />
    </div>
  );
}
