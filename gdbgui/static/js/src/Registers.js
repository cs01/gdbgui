import {store, Reactor} from './store.js';
import Util from './Util.js';
import Memory from './Memory.js';
import GdbApi from './GdbApi.js';

'use strict';

/**
 * The Registers component
 */
const Registers = {
    init: function(){
        new Reactor('#registers', Registers.render)
        window.addEventListener('event_inferior_program_exited', Registers.event_inferior_program_exited)
        window.addEventListener('event_inferior_program_running', Registers.event_inferior_program_running)
    },
    get_update_cmds: function(){
        let cmds = []
        if(store.get('can_fetch_register_values') === true){
            if(store.get('register_names').length === 0){
                // only fetch register names when we don't have them
                // assumption is that the names don't change over time
                cmds.push('-data-list-register-names')
            }
            // update all registers values
            cmds.push('-data-list-register-values x')
        }else{
            Registers.clear_cached_values()
        }
        return cmds
    },
    cache_register_names: function(names){
        // filter out non-empty names
        store.set('register_names', names.filter(name => name))
    },
    clear_register_name_cache: function(){
        store.set('register_names', [])
    },
    clear_cached_values: function(){
        store.set('previous_register_values', {})
        store.set('current_register_values', {})
    },
    event_inferior_program_exited: function(){
        Registers.clear_cached_values()
    },
    event_inferior_program_running: function(){
        // Registers.render_not_paused()
    },
    render: function(){
        let num_register_names = store.get('register_names').length
        , num_register_values = Object.keys(store.get('current_register_values')).length

        if(num_register_names > 0 && num_register_values > 0 && num_register_names !== num_register_values){
            // Somehow register names and values do not match. Clear cached values, then refetch both.
            Registers.clear_register_name_cache()
            Registers.clear_cached_values()
            GdbApi.run_gdb_command(Registers.get_update_cmds())
        }else if(num_register_names === num_register_values){
            let columns = ['name', 'value (hex)', 'value (decimal)']
            , register_table_data = []
            , register_names = store.get('register_names')
            , register_values = store.get('current_register_values')
            , prev_register_values = store.get('previous_register_values')

            for (let i in register_names){
                let name = register_names[i]
                    , obj = _.find(register_values, v => v['number'] === i)
                    , hex_val_raw = ''
                    , disp_hex_val = ''
                    , disp_dec_val = ''

                if (obj){
                    hex_val_raw = obj['value']

                    let old_obj = _.find(prev_register_values, v => v['number'] === i)
                    , old_hex_val_raw
                    , changed = false
                    if(old_obj) {old_hex_val_raw = old_obj['value']}

                    // if the value changed, highlight it
                    if(old_hex_val_raw !== undefined && hex_val_raw !== old_hex_val_raw){
                        changed = true
                    }

                    // if hex value is a valid value, convert it to a link
                    // and display decimal format too
                    if(obj['value'].indexOf('0x') === 0){
                       disp_hex_val = Memory.make_addrs_into_links(hex_val_raw)
                       disp_dec_val = parseInt(obj['value'], 16).toString(10)
                    }

                    if (changed){
                        name = `<span class='highlight bold'>${name}</span>`
                        disp_hex_val = `<span class='highlight bold'>${disp_hex_val}</span>`
                        disp_dec_val = `<span class='highlight bold'>${disp_dec_val}</span>`
                    }

                }

                register_table_data.push([name, disp_hex_val, disp_dec_val])
            }

            return Util.get_table(columns, register_table_data, 'font-size: 0.9em;')
        }
        return'<span class=placeholder>no data to display</span>'
    }
}

export default Registers;
