import {store} from './store.js';
import GdbApi from './GdbApi.js';
import SourceCode from './SourceCode.jsx';
import Locals from './Locals.jsx';
import Memory from './Memory.jsx';
import constants from './constants.js';

const Actions = {
    clear_program_state: function(){
        store.set('line_of_source_to_flash', undefined)
        store.set('paused_on_frame', undefined)
        store.set('selected_frame_num', 0)
        store.set('current_thread_id', undefined)
        store.set('stack', [])
        store.set('threads', [])
        Memory.clear_cache()
        Locals.clear()
    },
    inferior_program_running: function(){
        store.set('inferior_program', constants.inferior_states.running)
        Actions.clear_program_state()
    },
    inferior_program_paused: function(frame={}){
        store.set('inferior_program', constants.inferior_states.paused)
        store.set('render_paused_frame_or_user_selection', 'paused_frame')
        store.set('paused_on_frame', frame)
        store.set('fullname_to_render', frame.fullname)
        store.set('line_of_source_to_flash', parseInt(frame.line))
        store.set('current_assembly_address', frame.addr)
        SourceCode.make_current_line_visible()
        Actions.refresh_state_for_gdb_pause()
    },
    inferior_program_exited: function(){
        store.set('inferior_program', constants.inferior_states.exited)
        store.set('disassembly_for_missing_file', [])
        store.set('root_gdb_tree_var', null)
        store.set('previous_register_values', {})
        store.set('current_register_values', {})
        store.set('inferior_pid', null)
        Actions.clear_program_state()
    },
    /**
     * Request relevant store information from gdb to refresh UI
     */
    refresh_state_for_gdb_pause: function(){
        GdbApi.run_gdb_command(GdbApi._get_refresh_state_for_pause_cmds())
    },
    execute_console_command: function(command){
        if(store.get('refresh_state_after_sending_console_command')){
            GdbApi.run_command_and_refresh_state(command)
        }else{
            GdbApi.run_gdb_command(command)
        }
    },
    clear_console: function() {
        store.set('gdb_console_entries', [])
    },
    add_console_entries: function(entries, type) {
        if(!_.isArray(entries)){
            entries = [entries]
        }

        const typed_entries = entries.map(entry => {
            return {type: type, value: entry}
        })

        const previous_entries = store.get('gdb_console_entries')
        const new_entries = previous_entries.concat(typed_entries)

        store.set('gdb_console_entries', new_entries)
    }
}

export default Actions
