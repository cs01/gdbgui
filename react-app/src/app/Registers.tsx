import { constants } from "./constants";
import React from "react";
import Memory from "./Memory";
import registerDescriptions from "./register_descriptions";
import { store, useGlobalValue } from "./Store";
import { GdbguiRegisterValues, GdbMiRegisterValue } from "./types";

export function Registers(props: {}) {
  const registerNames =
    useGlobalValue<typeof store.data.register_names>("register_names");
  const registerValues = useGlobalValue<typeof store.data.current_register_values>(
    "current_register_values"
  );
  return (
    <table className="text-sm text-left ">
      <tr className=" ">
        <th>Name</th>
        <th>Value</th>
        <th>Decimal value</th>
      </tr>
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
            <td>{registerValue ? Memory.textToLinks(registerValue.gdbValue) : null}</td>
            <td>{registerValue ? registerValue.decimalValue : null}</td>
          </tr>
        );
      })}
    </table>
    // <div className="text-sm">
    //   <div className="flex space-x-4 hover:bg-gray-900">
    //     <div className="w-20">Name</div>
    //     <div className="min-w-40 flex-grow max-w-xl">Value</div>
    //     <div className="min-w-40">Decimal value</div>
    //   </div>
    //   {registerNames.map((name, i) => {
    //     const registerValue = registerValues[i];
    //     if (!name || registerValue == null) {
    //       return null;
    //     }
    //     return (
    //       <div
    //         className="flex space-x-4 hover:bg-gray-900"
    //         key={i}
    //         // @ts-expect-error
    //         title={registerDescriptions[name]}
    //       >
    //         <div className="w-20">{name}</div>
    //         <div className="w-80">{Memory.textToLinks(registerValue.gdbValue)}</div>
    //         <div className="w-80">{registerValue.decimalValue}</div>
    //       </div>
    //     );
    //   })}
    // </div>
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
    // if (store.data.can_fetch_register_values === true) {
    //   if (store.data.register_names.length === 0) {
    //     if (register_name_fetch_count <= MAX_REGISTER_NAME_FETCH_COUNT) {
    //       clearTimeout(register_name_fetch_timeout);
    //       // only fetch register names when we don't have them
    //       // assumption is that the names don't change over time
    //       cmds.push(constants.IGNORE_ERRORS_TOKEN_STR + "-data-list-register-names");
    //     } else {
    //       register_name_fetch_timeout = setTimeout(() => {
    //         register_name_fetch_count--;
    //       }, 5000);
    //     }
    //   }
    //   // update all registers values
    //   cmds.push(constants.IGNORE_ERRORS_TOKEN_STR + "-data-list-register-values x");
    // } else {
    //   Registers.clear_cached_values();
    // }
    // return cmds;
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
    // store.set<typeof store.data.previous_register_values>(
    //   "previous_register_values",
    //   store.data.current_register_values
    // );
    const initial: GdbguiRegisterValues = {};
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
