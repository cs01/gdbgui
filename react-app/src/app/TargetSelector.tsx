import { useState } from "react";
import Handlers from "./EventHandlers";
import { Util } from "./Util";
import { Fragment } from "react";
import { Menu, Transition } from "@headlessui/react";
import { ChevronDownIcon } from "@heroicons/react/solid";
import { userInputLocalStorageKey } from "./localStorageKeys";
import {
  RefreshIcon,
  PlayIcon,
  PauseIcon,
  ArrowCircleRightIcon,
  ArrowCircleDownIcon,
  ArrowSmRightIcon,
  ArrowSmDownIcon,
} from "@heroicons/react/outline";
import GdbApi from "./GdbApi";
import { store, useGlobalState, useGlobalValue } from "./Store";

function classNames(...classes: any) {
  return classes.filter(Boolean).join(" ");
}

type DebugType = "Binary Executable" | "gdb server" | "attach to process";

function convertUserInputToGdbInput(userInput: string): { binary: string; args: string } {
  const paramList = Util.stringToArraySafeQuotes(userInput);
  return { binary: paramList[0], args: paramList.slice(1).join(" ") };
}

function getInputHistory(): Array<string> {
  try {
    const entries = JSON.parse(
      localStorage.getItem(userInputLocalStorageKey) ?? "[]"
    ) as Array<string>;
    const deduplicatedEntries = Array.from(new Set(entries));
    return deduplicatedEntries;
  } catch (e) {
    localStorage.removeItem(userInputLocalStorageKey);
    console.error("failed to read past inputs");
  }
  return [];
}

function addUserInputToHistory(binaryAndArgs: string) {
  const prevInput = getInputHistory();
  const newValues = Array.from(new Set([binaryAndArgs, ...prevInput]));

  localStorage.setItem(userInputLocalStorageKey, JSON.stringify(newValues));
}

export function TargetSelector(props: { initial_user_input: string[] }) {
  const [userInput, setUserInput] =
    useGlobalState<typeof store.data.userTargetInput>("userTargetInput");

  // const configs = {
  //   "Binary Executable": {
  //     title:
  //       "Loads the binary and any arguments present in the input to the right. Backslashes are treated as escape characters. Windows users can either use two backslashes in paths, or forward slashes.",
  //     placeholder: "/path/to/executable --myflag",
  //     onClick: (userInput: string) => {
  //       addUserInputToHistory(userInput);
  //       const { binary, args } = convertUserInputToGdbInput(userInput);
  //       Handlers.setGdbBinaryAndArguments(binary, args);
  //     },
  //     executeButton: (
  //       <button
  //         className="btn btn-purple mr-2 text-sm"
  //         onClick={() => {
  //           chosenConfigName.onClick(userInput);
  //         }}
  //         title="Load configured target and input"
  //       >
  //         Load
  //       </button>
  //     ),
  //   },
  // };
  // const targetTypes = [
  //   {
  //     name: "Binary Executable",
  //     title:
  //       "Loads the binary and any arguments present in the input to the right. Backslashes are treated as escape characters. Windows users can either use two backslashes in paths, or forward slashes.",
  //     placeholder: "/path/to/executable --myflag",
  //     onClick: (userInput: string) => {
  //       addUserInputToHistory(userInput);
  //       const { binary, args } = convertUserInputToGdbInput(userInput);
  //       Handlers.setGdbBinaryAndArguments(binary, args);
  //     },
  //     executeButton: (
  //       <button
  //         className="btn btn-purple mr-2 text-sm"
  //         onClick={() => {
  //           chosenOption.onClick(userInput);
  //         }}
  //         title="Load configured target and input"
  //       >
  //         Load
  //       </button>
  //     ),
  //   },
  //   {
  //     name: "gdb server",
  //     title: "Connect GDB to the remote target",
  //     placeholder: "examples: 127.0.0.1:9999 | /dev/ttya",
  //     onClick: (userInput: string) => {
  //       addUserInputToHistory(userInput);
  //       GdbApi.requestConnectToGdbserver(userInput);
  //     },
  //     executeButton: (
  //       <button
  //         className="btn btn-purple mr-2 text-sm whitespace-nowrap"
  //         onClick={() => {
  //           chosenOption.onClick(userInput);
  //         }}
  //         title="Load configured target and input"
  //       >
  //         Connect to server
  //       </button>
  //     ),
  //   },
  //   {
  //     name: "Attach to process",
  //     title:
  //       "Attach to a process 'pid' or a file 'file' outside of GDB, or a thread group 'gid'. " +
  //       "If attaching to a thread group, the id previously returned by " +
  //       "‘-list-thread-groups --available’ must be used. " +
  //       "Note: to do this, you usually need to run gdbgui as sudo.",
  //     placeholder: "pid | gid | file",
  //     onClick: (userInput: string) => {
  //       addUserInputToHistory(userInput);
  //       Handlers.attachToProcess(userInput);
  //     },
  //     executeButton: (
  //       <button
  //         className="btn btn-purple mr-2 text-sm whitespace-nowrap"
  //         onClick={() => {
  //           chosenOption.onClick(userInput);
  //         }}
  //         title="Load configured target and input"
  //       >
  //         Attach
  //       </button>
  //     ),
  //   },
  // ];

  const pastBinariesId = "past-binaries";
  const [debugType, setDebugType] = useState<DebugType>("Binary Executable");
  return (
    <div className="w-full align-middle content-center flex h-auto my-2 items-start ">
      <Menu as="div" className="ml-2 mr-1 inline-block text-left z-10 ">
        <div className="bg-gray-800 hover:bg-gray-800 focus:ring-purple-200 focus:ring-2">
          <Menu.Button className="inline-flex whitespace-nowrap justify-center w-full rounded-l-sm shadow-sm pl-1 pr-4 py-2 text-sm font-medium  focus:outline-none ">
            <ChevronDownIcon className="mr-1 ml-1 h-5 w-5" aria-hidden="true" />
            Target Type: &nbsp;<span className="font-bold">{debugType}</span>
          </Menu.Button>
        </div>

        <Transition
          as={Fragment}
          enter="transition ease-out duration-100"
          enterFrom="transform opacity-0 scale-95"
          enterTo="transform opacity-100 scale-100"
          leave="transition ease-in duration-75"
          leaveFrom="transform opacity-100 scale-100"
          leaveTo="transform opacity-0 scale-95"
        >
          <Menu.Items className="origin-top-left bg-gray-800 absolute left-0 mt-2 w-56 rounded-md shadow-lg  ring-1 ring-black ring-opacity-5 focus:outline-none">
            <div className="py-2">
              <Menu.Item key="binary executable">
                <button
                  className={classNames(
                    debugType === "Binary Executable" ? "font-bold" : "",
                    "block px-4 py-2 text-sm w-full text-left whitespace-nowrap"
                  )}
                  title={
                    "Loads the binary and any arguments present in the input to the right. Backslashes are treated as escape characters. Windows users can either use two backslashes in paths, or forward slashes."
                  }
                  onClick={() => {
                    setDebugType("Binary Executable");
                  }}
                >
                  Binary Executable
                </button>
              </Menu.Item>
            </div>
          </Menu.Items>
        </Transition>
      </Menu>
      <input
        className={
          "bg-gray-800 flex-grow p-2 w-full mr-1 " +
          "rounded-sm focus:outline-none focus:ring-0 " +
          "text-sm"
        }
        list={pastBinariesId}
        placeholder={"/path/to/executable --myflag"}
        onChange={(e) => {
          setUserInput(e.target.value);
        }}
        onKeyUp={(e) => {
          if (e.code?.toLocaleLowerCase() === "enter") {
            addUserInputToHistory(userInput);
            const { binary, args } = convertUserInputToGdbInput(userInput);
            Handlers.setGdbBinaryAndArguments(binary, args);
          }
        }}
        value={userInput}
      // not sure if we need this?
      // defaultValue={userInput}
      />
      <datalist id={pastBinariesId}>
        {getInputHistory().map((userInput) => (
          <option key={userInput}>{userInput}</option>
        ))}
      </datalist>
      {
        <button
          className="btn btn-purple mr-2 text-sm"
          onClick={() => {
            addUserInputToHistory(userInput);
            const { binary, args } = convertUserInputToGdbInput(userInput);
            Handlers.setGdbBinaryAndArguments(binary, args);
          }}
          title="Load configured target and input"
        >
          Load
        </button>
      }
      <DebugControls />
    </div>
  );
}

function DebugControls() {
  const reverseSupported = useGlobalValue("reverse_supported");
  return (
    <div className="flex">
      <button title="Start program from the beginning (keyboard shortcut: r)">
        <RefreshIcon
          className="h-8 w-8"
          aria-hidden="true"
          onClick={() => GdbApi.clickRunButton()}
        />
      </button>
      <button
        title={
          "Continue until breakpoint is hit or inferior program exits keyboard shortcut: c" +
          (reverseSupported ? ". shift + c for reverse." : "")
        }
      >
        <PlayIcon
          className="h-8 w-8"
          aria-hidden="true"
          onClick={() => GdbApi.requestContinue()}
        />
      </button>
      <button
        title={
          "Step over next function call keyboard shortcut: n or right arrow" +
          (reverseSupported ? ". shift + n for reverse." : "")
        }
      >
        <ArrowCircleRightIcon
          className="h-8 w-8"
          aria-hidden="true"
          onClick={() => GdbApi.requestNext()}
        />
      </button>
      <button
        title={
          "Step into next function call keyboard shortcut: s or down arrow" +
          (reverseSupported ? ". shift + s for reverse." : "")
        }
      >
        <ArrowCircleDownIcon
          className="h-8 w-8"
          aria-hidden="true"
          onClick={() => GdbApi.requestStep()}
        />
      </button>
      <button
        title={
          "Next Instruction: Execute one machine instruction, stepping over function calls keyboard shortcut: m" +
          (reverseSupported ? ". shift + m for reverse." : "")
        }
      >
        <ArrowSmRightIcon
          className="h-8 w-8"
          aria-hidden="true"
          onClick={() => GdbApi.requestSendNextInstruction()}
        />
      </button>
      <button
        title={
          "Step Instruction: Execute one machine instruction, stepping into function calls keyboard shortcut: ','" +
          (reverseSupported ? ". shift + , for reverse." : "")
        }
      >
        <ArrowSmDownIcon
          className="h-8 w-8"
          aria-hidden="true"
          onClick={() => GdbApi.requestSendStepInstruction()}
        />
      </button>
      <button title="Send Interrupt signal (SIGINT) to gdb process to pause it (if it's running)">
        <PauseIcon
          className="h-8 w-8"
          aria-hidden="true"
          onClick={
            // () => Handlers.send_signal("SIGINT", gdbPid)
            () => GdbApi.runCommandAndRefreshState("-exec-interrupt --all")
          }
        />
      </button>
    </div>
  );
}
