import { store, useGlobalValue } from "./Store";

export function Footer() {
  const programState = useGlobalValue<typeof store.data["gdbguiState"]>("gdbguiState");
  const stoppedDetails =
    useGlobalValue<typeof store.data.stoppedDetails>("stoppedDetails");

  const background =
    programState === "stopped" || programState === "running"
      ? "bg-yellow-600"
      : "bg-blue-500";
  return (
    <div
      className={`w-full ${background} fixed px-2 left-0 bottom-0 text-sm text-gray-300`}
    >
      Status: {programState}{" "}
      {programState === "stopped" ? `(${stoppedDetails?.reason})` : ""}
    </div>
  );
}
