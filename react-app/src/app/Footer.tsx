import { useGlobalValue } from "./GlobalState";

export function Footer() {
  const programState = useGlobalValue("inferior_program");

  const background = "bg-blue-500";
  return (
    <div className={`w-full ${background} fixed px-5 left-0 bottom-0`}>
      Status: {programState}
    </div>
  );
}
