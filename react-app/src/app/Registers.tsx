import { constants } from "./constants";
import React from "react";
import MemoryClass from "./Memory";
import registerDescriptions from "./register_descriptions";
import { store, useGlobalValue } from "./Store";
import { GdbguiRegisterValue, GdbMiRegisterValue } from "./types";

export function Registers(props: {}) {
  const registerNames =
    useGlobalValue<typeof store.data.register_names>("register_names");
  const registerValues = useGlobalValue<typeof store.data.current_register_values>(
    "current_register_values"
  );
  return (
    <table className="text-sm text-left ">
      <thead>
        <tr className=" ">
          <th>Name</th>
          <th>Value</th>
          <th>Decimal value</th>
        </tr>
      </thead>
      <tbody>
        {registerNames.map((name, i) => {
          const registerValue = registerValues[i];
          if (!name || registerValue == null) {
            return null;
          }
          return (
            <tr
              className="hover:bg-gray-900 text-left"
              key={i}
              // @ts-expect-error
              title={registerDescriptions[name]}
            >
              <td>{name ?? null}</td>
              <td>
                {registerValue ? MemoryClass.textToLinks(registerValue.gdbValue) : null}
              </td>
              <td>{registerValue ? registerValue.decimalValue : null}</td>
            </tr>
          );
        })}
      </tbody>
    </table>
  );
}

export class RegisterClass {
  static get_update_cmds(): Array<string> {
    if (store.data.register_names) {
      const cmds: string[] = [
        `${constants.IGNORE_ERRORS_TOKEN_STR}-data-list-register-values x `,
      ];
      return cmds;
    }
    return [];
  }
  static cacheNames(names: string[]) {
    store.set<typeof store.data.register_names>("register_names", names);
  }
  static clearNameCache() {
    store.set<typeof store.data.register_names>("register_names", []);
  }
  static clearCache() {
    store.set<typeof store.data.previous_register_values>("previous_register_values", {});
    store.set<typeof store.data.current_register_values>("current_register_values", {});
  }
  static inferior_program_exited() {
    RegisterClass.clearCache();
  }
  static saveRegisterValues(values: GdbMiRegisterValue[]) {
    const initial: GdbguiRegisterValue = {};
    store.set<typeof store.data.current_register_values>(
      "current_register_values",
      values.reduce((prev, valueObj) => {
        const decimalValue = parseInt(valueObj.value, 16);
        prev[valueObj.number] = {
          gdbValue: valueObj.value,
          decimalValue: isNaN(decimalValue) ? null : decimalValue,
        };
        return prev;
      }, initial)
    );
  }
  static saveRegisterNames(names: string[]) {
    store.set<typeof store.data.register_names>("register_names", names);
  }
}
