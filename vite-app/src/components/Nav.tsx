import { useState } from "react";
import { CogIcon, MenuIcon } from "@heroicons/react/outline";
import { Settings } from "./Settings";
import { TargetSelector } from "./TargetSelector";
import { InitialData } from "./InitialData";
import { showModal } from "./GdbguiModal";
import { store, useGlobalState } from "./Store";

function SettingsMenu(props: { showMenu: boolean; setShowMenu: (b: boolean) => void }) {
  const { setShowMenu, showMenu } = props;
  return (
    <div
      onClick={() => {
        setShowMenu(false);
      }}
      style={{ top: "10px" }}
      className={`absolute text-right pl-20 p-8 flex flex-col space-y-4 right-0 mt-10 bg-gray-700 ${
        showMenu ? null : "hidden"
      }`}
    >
      <button
        className="text-right flex align-middle"
        onClick={() => {
          showModal("Settings", <Settings />);
        }}
      >
        <CogIcon className="icon mt-1" />
        <span className="mx-2">Settings</span>
      </button>
      <a href="/dashboard" target="_blank">
        Dashboard
      </a>
      <a href="http://github.com/cs01/gdbgui" target="_blank" rel="noreferrer">
        GitHub
      </a>
      <button
        className="text-right"
        onClick={() => {
          showModal(
            "about",
            <div className="flex-col">
              <div>gdbgui</div>
              <div>Copyright Chad Smith, 2017-2022</div>
              <div>chadsmith.software@gmail.com</div>
            </div>
          );
        }}
      >
        About
      </button>
    </div>
  );
}

export function Nav(props: { initialData: InitialData }) {
  const [showMenu, setShowMenu] = useState(false);

  return (
    <div className="flex items-center bg-gradient-to-r from-purple-800 via-red-500 to-yellow-500 background-animate">
      <span className="ml-2 border-2 border-purple-500 rounded-lg p-1">gdbgui</span>
      <div className="flex-grow"></div>
      <TargetSelector initial_user_input={props.initialData.initial_binary_and_args} />
      <button
        type="button"
        className="ml-4 mr-2"
        onClick={() => {
          setShowMenu(!showMenu);
        }}
      >
        <MenuIcon className="h-8 w-6" aria-hidden="true" />
      </button>
      <SettingsMenu setShowMenu={setShowMenu} showMenu={showMenu} />
    </div>
  );
}
