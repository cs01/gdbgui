import {store} from './store.js';
import constants from './constants.js';
import GdbApi from './GdbApi.js';
import Actions from './Actions.js';

/**
 * The BinaryLoader component allows the user to select their binary
 * and specify inputs
 */
const BinaryLoader = {
    el: $('#binary'),
    el_past_binaries: $('#past_binaries'),
    init: function(){
        // events
        $('#set_target_app').click(BinaryLoader.click_set_target_app)
        $('#attach').click(BinaryLoader.click_attach)
        BinaryLoader.el.keydown(BinaryLoader.keydown_on_binary_input)

        try{
            BinaryLoader.past_binaries = _.uniq(JSON.parse(localStorage.getItem('past_binaries')))
            BinaryLoader.render(BinaryLoader.past_binaries[0])
        } catch(err){
            BinaryLoader.past_binaries = []
        }
        // update list of old binarys
        BinaryLoader.render_past_binary_options_datalist()
    },
    past_binaries: [],
    keydown_on_binary_input: function(e){
        if(e.keyCode === constants.ENTER_BUTTON_NUM) {
            BinaryLoader.set_target_app()
        }
    },
    render_past_binary_options_datalist: function(){
        BinaryLoader.el_past_binaries.html(BinaryLoader.past_binaries.map(b => `<option>${b}</option`))
    },
    click_set_target_app: function(){
        BinaryLoader.set_target_app('binary')
    },
    click_attach: function(){
        BinaryLoader.set_target_app('attach')
    },
    /**
     * Set the target application and arguments based on the
     * current fields in the DOM
     */
    set_target_app: function(cmdtype='binary'){
        let user_input = _.trim(BinaryLoader.el.val())

        if (_.trim(user_input) === ''){
            store.set('status', {text: 'enter a binary path and arguments', error: true})
            return
        }

        // save to list of binaries used that autopopulates the input dropdown
        _.remove(BinaryLoader.past_binaries, i => i === user_input)
        BinaryLoader.past_binaries.unshift(user_input)
        localStorage.setItem('past_binaries', JSON.stringify(BinaryLoader.past_binaries) || [])
        BinaryLoader.render_past_binary_options_datalist()

        // remove list of source files associated with the loaded binary since we're loading a new one
        store.set('source_file_paths', [])
        store.set('language', 'c_family')

        let cmds, binary
        if(cmdtype === 'binary'){
            // find the binary and arguments so gdb can be told which is which
            let args
            let index_of_first_space = user_input.indexOf(' ')
            if( index_of_first_space === -1){
                binary = user_input
                args = ''
            }else{
                binary = user_input.slice(0, index_of_first_space)
                args = user_input.slice(index_of_first_space + 1, user_input.length)
            }

            // tell gdb which arguments to use when calling the binary, before loading the binary
            cmds = [
                    `-exec-arguments ${args}`, // Set the inferior program arguments, to be used in the next `-exec-run`
                    `-file-exec-and-symbols ${binary}`,  // Specify the executable file to be debugged. This file is the one from which the symbol table is also read.
                    ]
        }else if(cmdtype === 'attach'){
            cmds = [`-target-attach ${user_input}`]
        }

        // add breakpoint if we don't already have one
        if(store.get('auto_add_breakpoint_to_main')){
            cmds.push('-break-insert main')
        }
        cmds.push(GdbApi.get_break_list_cmd())

        Actions.inferior_program_exited()
        GdbApi.run_gdb_command(cmds)

        if(cmdtype === 'binary'){
            store.set('inferior_binary_path', binary)
            GdbApi.get_inferior_binary_last_modified_unix_sec(binary)
        }else{
            store.set('inferior_binary_path', null)
            GdbApi.get_inferior_binary_last_modified_unix_sec(binary)
        }
    },
    render: function(binary){
        BinaryLoader.el.val(binary)
    },
}

export default BinaryLoader
