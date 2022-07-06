import { useGlobalState } from "./Store";
import { GlobalState } from "./types";

export function GlobalBooleanToggle(props: {
  label: string;
  storeKey: keyof GlobalState;
}) {
  const [globalValue, setGlobalValue] = useGlobalState<boolean>(props.storeKey);
  if (globalValue !== true && globalValue !== false) {
    throw new Error(`${props.storeKey} must be a boolean (got ${typeof globalValue})`);
  }
  return (
    <div className="flex">
      <input
        className="mr-2"
        type="checkbox"
        value={props.label}
        checked={globalValue}
        onChange={(e) => {
          setGlobalValue(!globalValue);
        }}
      />
      {props.label}
    </div>
  );
}
