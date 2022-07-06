import React, { useRef } from "react";
import { store, useGlobalState } from "./Store";

export function showModal(header: string, body: React.ReactNode) {
  const newModalData: typeof store.data.modalData = {
    header,
    modalBody: body,
    show: true,
  };
  store.set<typeof store.data.modalData>("modalData", newModalData);
}

export function Modal() {
  const [modalData, setModalData] =
    useGlobalState<typeof store.data.modalData>("modalData");
  const parentModalElement = useRef(null);
  const hideModal = () => setModalData({ ...modalData, show: false });
  return (
    <div
      style={{ zIndex: modalData.show ? 9999 : -100 }}
      className={
        (modalData.show ? "bg-opacity-80 " : "bg-opacity-0 ") +
        "w-screen h-screen bg-black absolute left-0 top-0 z-40 flex justify-center items-center"
      }
      ref={parentModalElement}
      onClick={(e) => {
        if (e.target === parentModalElement.current) {
          hideModal();
        }
      }}
    >
      <div
        className={
          modalData.show ? "p-10  bg-gray-800 rounded-lg max-w-2xl " : "  hidden"
        }
      >
        <h4 className="text-2xl font-bold">{modalData.header}</h4>

        <div className="py-10">{modalData.modalBody}</div>

        <div className="flex flex-col items-end">
          <button type="button" className="btn btn-purple" onClick={hideModal}>
            Close
          </button>
        </div>
      </div>
    </div>
  );
}
