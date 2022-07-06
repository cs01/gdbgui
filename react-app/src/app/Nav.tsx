/* This example requires Tailwind CSS v2.0+ */
import { useState } from "react";
import { CogIcon, MenuIcon, XIcon } from "@heroicons/react/outline";
import { store, useGlobalState } from "./Store";

export function Nav() {
  const [showMenu, setShowMenu] = useState(false);
  const [modalData, setModalData] =
    useGlobalState<typeof store.data.modalData>("modalData");
  return (
    <div
      className="h-10 flex
      bg-gradient-to-r
      from-purple-800
      via-red-500
      to-yellow-500
background-animate
"
    >
      <span className="ml-2 mt-2 h-10">gdbgui</span>
      <div className="flex-grow"></div>
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
        className={`absolute text-right pl-20 p-8 flex flex-col space-y-4 right-0 mt-10 bg-gray-700 ${
          showMenu ? null : "hidden"
        }`}
      >
        <button
          className="text-right"
          onClick={() => {
            setModalData({
              show: true,
              modalBody: (
                <div className="flex-col">
                  <div>gdbgui</div>
                  <div>Copyright Chad Smith, 2017-2022</div>
                  <div>chadsmith.software@gmail.com</div>
                </div>
              ),
              header: "About",
            });
          }}
        >
          About
        </button>
        <a href="/dashboard" target="_blank">
          Dashboard
        </a>
        <a href="http://github.com/cs01/gdbgui" target="_blank" rel="noreferrer">
          GitHub
        </a>
      </div>
    </div>
  );
}
