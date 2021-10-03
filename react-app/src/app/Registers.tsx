/**
 * A component to display, fetch, and store register
 */

import React from "react";
import { store } from "./GlobalState";
import constants from "./constants";
import ReactTable from "./ReactTable";
import Memory from "./Memory";
import GdbApi from "./GdbApi";
import register_descriptions from "./register_descriptions";
import _ from "lodash";

const MAX_REGISTER_NAME_FETCH_COUNT = 5;
let register_name_fetch_count = 0;
let register_name_fetch_timeout: any = null;

type State = any;

class Registers extends React.Component<{}, State> {
  constructor() {
    // @ts-expect-error ts-migrate(2554) FIXME: Expected 1-2 arguments, but got 0.
    super();
    store.reactComponentState(this, [
      "inferior_program",
      "previous_register_values",
      "current_register_values",
      "register_names",
      "can_fetch_register_values",
    ]);
  }
  static get_update_cmds(): Array<string> {
    register_name_fetch_count++;
    const cmds: string[] = [];
    if (
      [constants.inferior_states.paused, constants.inferior_states.running].indexOf(
        store.get("inferior_program")
      ) == -1
    ) {
      return cmds;
    }
    if (store.data.can_fetch_register_values === true) {
      if (store.data.register_names.length === 0) {
        if (register_name_fetch_count <= MAX_REGISTER_NAME_FETCH_COUNT) {
          clearTimeout(register_name_fetch_timeout);
          // only fetch register names when we don't have them
          // assumption is that the names don't change over time
          cmds.push(constants.IGNORE_ERRORS_TOKEN_STR + "-data-list-register-names");
        } else {
          register_name_fetch_timeout = setTimeout(() => {
            register_name_fetch_count--;
          }, 5000);
        }
      }
      // update all registers values
      cmds.push(constants.IGNORE_ERRORS_TOKEN_STR + "-data-list-register-values x");
    } else {
      Registers.clear_cached_values();
    }
    return cmds;
  }
  static cache_register_names(names: any) {
    // filter out non-empty names
    store.set(
      "register_names",
      names.filter((name: any) => name)
    );
  }
  static clear_register_name_cache() {
    store.set("register_names", []);
  }
  static clear_cached_values() {
    store.set("previous_register_values", {});
    store.set("current_register_values", {});
  }
  static inferior_program_exited() {
    Registers.clear_cached_values();
  }
  render() {
    const num_register_names = store.data.register_names.length;
    const num_register_values = Object.keys(store.data.current_register_values).length;

    if (this.state.inferior_program !== constants.inferior_states.paused) {
      return <span className="placeholder">no data to display</span>;
    }

    if (
      (num_register_names > 0 &&
        num_register_values > 0 &&
        num_register_names !== num_register_values) ||
      (num_register_names === 0 &&
        register_name_fetch_count <= MAX_REGISTER_NAME_FETCH_COUNT)
    ) {
      // Somehow register names and values do not match. Clear cached values, then refetch both.
      Registers.clear_register_name_cache();
      Registers.clear_cached_values();
      GdbApi.run_gdb_command(Registers.get_update_cmds());
    } else if (num_register_names === num_register_values) {
      const columns = ["name", "value (hex)", "value (decimal)", "description"];
      const register_table_data = [];
      const register_names = store.data.register_names;
      const register_values = store.data.current_register_values;
      const prev_register_values = store.data.previous_register_values;

      for (const i in register_names) {
        let name = register_names[i];
        const obj = _.find(register_values, (v: any) => v["number"] === i);
        let hex_val_raw = "";
        let disp_hex_val = "";
        let disp_dec_val = "";
        // @ts-expect-error ts-migrate(7053) FIXME: Element implicitly has an 'any' type because expre... Remove this comment to see the full error message
        const register_description = register_descriptions[name] || "";

        if (obj && obj.value) {
          hex_val_raw = obj["value"];

          const oldObj = _.find(prev_register_values, (v: any) => v["number"] === i);
          let oldHexValRaw;
          let changed = false;
          if (oldObj) {
            oldHexValRaw = oldObj["value"];
          }

          // if the value changed, highlight it
          if (oldHexValRaw !== undefined && hex_val_raw !== oldHexValRaw) {
            changed = true;
          }

          // if hex value is a valid value, convert it to a link
          // and display decimal format too
          if (obj["value"].indexOf("0x") === 0) {
            disp_hex_val = Memory.make_addrs_into_links_react(hex_val_raw);
            disp_dec_val = parseInt(obj["value"], 16).toString(10);
          }

          if (changed) {
            name = <span className="highlight bold">{name}</span>;
            // @ts-expect-error ts-migrate(2322) FIXME: Type 'Element' is not assignable to type 'string'.
            disp_hex_val = <span className="highlight bold">{disp_hex_val}</span>;
            // @ts-expect-error ts-migrate(2322) FIXME: Type 'Element' is not assignable to type 'string'.
            disp_dec_val = <span className="highlight bold">{disp_dec_val}</span>;
          }
        }

        register_table_data.push([
          name,
          disp_hex_val,
          disp_dec_val,
          register_description,
        ]);
      }
      return (
        <ReactTable
          data={register_table_data}
          // @ts-expect-error ts-migrate(2769) FIXME: Type 'string[]' is not assignable to type 'never[]... Remove this comment to see the full error message
          header={columns}
          style={{ fontSize: "0.9em" }}
        />
      );
    }
    return <span className="placeholder">no data to display</span>;
  }
}

export default Registers;
