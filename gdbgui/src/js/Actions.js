import {store} from './store.js';
import GdbApi from './GdbApi.js';
import SourceCode from './SourceCode.jsx';
import Locals from './Locals.jsx';
import constants from './constants.js';

const Actions = {
    clear_program_state: function(){
        store.set('line_of_source_to_flash', undefined)
        store.set('paused_on_frame', undefined)
        store.set('selected_frame_num', 0)
        store.set('current_thread_id', undefined)
        store.set('stack', [])
        store.set('threads', [])
        store.set('memory_cache', {})
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
    }

}

export default Actions
