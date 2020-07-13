/**
 * A component to display, fetch, and store register
 */

import React from "react";
import { store } from "statorgfc";
import constants from "./constants.js";
import ReactTable from "./ReactTable.jsx";
import Memory from "./Memory.jsx";
import GdbApi from "./GdbApi.jsx";
import register_descriptions from "./register_descriptions.js";

const MAX_REGISTER_NAME_FETCH_COUNT = 5;
let register_name_fetch_count = 0,
  register_name_fetch_timeout = null;

class Registers extends React.Component {
  constructor() {
    super();
    store.connectComponentState(this, [
      "inferior_program",
      "previous_register_values",
      "current_register_values",
      "register_names",
      "can_fetch_register_values"
    ]);
  }
  static get_update_cmds() {
    let cmds = [];
    if (store.get("can_fetch_register_values") === true) {
      if (store.get("register_names").length === 0) {
        if (register_name_fetch_count <= MAX_REGISTER_NAME_FETCH_COUNT) {
          clearTimeout(register_name_fetch_timeout);
          register_name_fetch_count++;
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
  static cache_register_names(names) {
    // filter out non-empty names
    store.set("register_names", names.filter(name => name));
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
    let num_register_names = store.get("register_names").length,
      num_register_values = Object.keys(store.get("current_register_values")).length;

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
      let columns = ["name", "value (hex)", "value (decimal)", "description"],
        register_table_data = [],
        register_names = store.get("register_names"),
        register_values = store.get("current_register_values"),
        prev_register_values = store.get("previous_register_values");

      for (let i in register_names) {
        let name = register_names[i],
          obj = _.find(register_values, v => v["number"] === i),
          hex_val_raw = "",
          disp_hex_val = "",
          disp_dec_val = "",
          register_description = register_descriptions[name] || "";

        if (obj && obj.value) {
          hex_val_raw = obj["value"];

          let old_obj = _.find(prev_register_values, v => v["number"] === i),
            old_hex_val_raw,
            changed = false;
          if (old_obj) {
            old_hex_val_raw = old_obj["value"];
          }

          // if the value changed, highlight it
          if (old_hex_val_raw !== undefined && hex_val_raw !== old_hex_val_raw) {
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
            disp_hex_val = <span className="highlight bold">{disp_hex_val}</span>;
            disp_dec_val = <span className="highlight bold">{disp_dec_val}</span>;
          }
        }

        register_table_data.push([
          name,
          disp_hex_val,
          disp_dec_val,
          register_description
        ]);
      }
      return (
        <ReactTable
          data={register_table_data}
          header={columns}
          style={{ fontSize: "0.9em" }}
        />
      );
    }
    return <span className="placeholder">no data to display</span>;
  }
}

export default Registers;
