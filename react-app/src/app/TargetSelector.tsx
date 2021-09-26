import React, { useState } from "react";
import constants from "./constants";
import Actions from "./Actions";
import Util from "./Util";
import { initial_data } from "./InitialData";
import _ from "lodash";
import { Fragment } from "react";
import { Menu, Transition } from "@headlessui/react";
import { ChevronDownIcon } from "@heroicons/react/solid";

function classNames(...classes: any) {
  return classes.filter(Boolean).join(" ");
}

export function TargetSelector(props: { initial_user_input: string[] }) {
  const [userInput, setUserInput] = useState("");
  const targetTypes = [
    {
      gdbCommand: "",
      name: "Binary Executable",
      title:
        "Loads the binary and any arguments present in the input to the right. Backslashes are treated as escape characters. Windows users can either use two backslashes in paths, or forward slashes.",
      placeholder: "/path/to/executable --myflag",
      onClick: () => {
        Actions.setGdbBinaryAndArguments(userInput, []);
      },
    },
    {
      gdbCommand: "",
      name: "gdb server",
      title:
        "Loads the binary and any arguments present in the input to the right. Backslashes are treated as escape characters. Windows users can either use two backslashes in paths, or forward slashes.",
      placeholder: "/path/to/target/executable -and -flags",
      onClick: () => {
        Actions.connectToGdbserver(userInput);
      },
    },
  ];

  const [chosenOption, setChosenOption] = useState(targetTypes[0]);
  return (
    <div className="w-full align-middle content-center flex h-auto my-2 items-start ">
      <Menu as="div" className="ml-2 mr-1 inline-block text-left z-10">
        <div>
          <Menu.Button className="inline-flex whitespace-nowrap justify-center w-full rounded-l-sm border border-gray-300 shadow-sm pl-1 pr-4 py-2 bg-white text-sm font-medium text-gray-700 hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-gray-100 focus:ring-indigo-500">
            <ChevronDownIcon className="mr-1 ml-1 h-5 w-5" aria-hidden="true" />
            Target Type: &nbsp;<span className="font-bold">{chosenOption.name}</span>
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
          <Menu.Items className="origin-top-left absolute left-0 mt-2 w-56 rounded-md shadow-lg bg-white ring-1 ring-black ring-opacity-5 focus:outline-none">
            <div className="py-2">
              {targetTypes.map((option) => {
                return (
                  <Menu.Item key={option.name}>
                    {({ active }) => (
                      <button
                        className={classNames(
                          active ? "bg-gray-100 text-gray-900" : "text-gray-700",
                          "block px-4 py-2 text-sm whitespace-nowrap"
                        )}
                        title={option.title}
                        onClick={() => {
                          setChosenOption(
                            targetTypes.find((target) => target.name === option.name) ??
                              targetTypes[0]
                          );
                        }}
                      >
                        {option.name}
                      </button>
                    )}
                  </Menu.Item>
                );
              })}
            </div>
          </Menu.Items>
        </Transition>
      </Menu>
      <input
        className={
          "flex-grow p-2 w-full mr-1 rounded-sm focus:outline-none focus:ring-2 focus:ring-gray-200"
        }
        placeholder={chosenOption.placeholder}
        onChange={(e) => {
          setUserInput(e.target.value);
        }}
      />
      <button
        className="btn btn-purple mr-2"
        onClick={chosenOption.onClick}
        title="Start debugging"
      >
        Debug
      </button>
    </div>
  );
}
