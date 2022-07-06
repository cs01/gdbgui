/* This example requires Tailwind CSS v2.0+ */
import { useState } from "react";
import { CogIcon, MenuIcon, XIcon } from "@heroicons/react/outline";
import { store, useGlobalState } from "./Store";

export function Nav() {
  const [showMenu, setShowMenu] = useState(false);
  const [modalData, setModalData] =
    useGlobalState<typeof store.data.modalData>("modalData");
  return (
    <div className="h-10 flex bg-gradient-to-r from-purple-800  to-pink-800 ">
      <span className="ml-2 mt-2 h-10">gdbgui</span>
      <div className="flex-grow"></div>
      {/* <button type="button">
        <CogIcon className="h-6 w-6" aria-hidden="true" />
      </button> */}
      <button
        type="button"
        className="mr-2"
        onClick={() => {
          setShowMenu(!showMenu);
        }}
      >
        <MenuIcon className="h-6 w-6" aria-hidden="true" />
      </button>
      <div
        className={`absolute p-5 flex flex-col right-0 mt-10 bg-gray-700 w-80 ${
          showMenu ? null : "hidden"
        }`}
      >
        <button
          onClick={() => {
            setModalData({
              show: true,
              modalBody: <div>gdbgui, copyright Chad Smith, 2017-2022</div>,
              header: "About",
            });
          }}
        >
          About
        </button>
      </div>
    </div>
  );
}
