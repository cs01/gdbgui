import {store} from './store.js';
import GdbConsoleComponent from './GdbConsole.js'
import constants from './constants.js'
import GdbApi from './GdbApi.js'

/**
 * The GdbCommandInput component
 */
const GdbCommandInput = {
    el: $('#gdb_command_input'),
    sent_cmds: JSON.parse(localStorage.getItem('sent_cmds')) || [],
    cmd_index: 0,
    init: function(){
        GdbCommandInput.el.keydown(GdbCommandInput.keydown_on_gdb_cmd_input)
        $('.run_gdb_command').click(GdbCommandInput.run_current_command)
    },
    shutdown: function(){
        localStorage.setItem('sent_cmds', JSON.stringify(GdbCommandInput.sent_cmds))
    },
    keydown_on_gdb_cmd_input: function(e){
        if(e.keyCode === constants.ENTER_BUTTON_NUM) {
            GdbCommandInput.cmd_index = 0
            GdbCommandInput.run_current_command()
            //reset cache-cmd index
        } else if (e.keyCode === constants.UP_BUTTON_NUM || e.keyCode === constants.DOWN_BUTTON_NUM) {
            let desired_index = e.keyCode === constants.UP_BUTTON_NUM ? GdbCommandInput.cmd_index +1 : GdbCommandInput.cmd_index -1
            , sent_cmds = GdbCommandInput.sent_cmds
            //get number of sent cmds
            , sent_cmds_count = sent_cmds.length

            if(desired_index > sent_cmds_count){
                GdbCommandInput.set_input_text('') // pressed up button too many times
                GdbCommandInput.cmd_index = 0
            }else if (desired_index < 0){
                desired_index = sent_cmds_count  // pressed down button with nothing in input
                GdbCommandInput.set_input_text(sent_cmds[sent_cmds_count - desired_index])
                GdbCommandInput.cmd_index = desired_index  // update current index
            }else{
                GdbCommandInput.set_input_text(sent_cmds[sent_cmds_count - desired_index])
                GdbCommandInput.cmd_index = desired_index  // update current index
            }
        }
    },
    run_current_command: function(){
        let cmd = GdbCommandInput.el.val()
        if(GdbCommandInput.sent_cmds.length > 1000){
            GdbCommandInput.sent_cmds.shift()  // remove first element so it never gets too long
        }
        GdbCommandInput.sent_cmds.push(cmd)
        GdbConsoleComponent.add_sent_commands(cmd)
        GdbCommandInput.clear()
        if(store.get('refresh_state_after_sending_console_command')){
            GdbApi.run_command_and_refresh_state(cmd)
        }else{
            GdbApi.run_gdb_command(cmd)
        }
    },
    set_input_text: function(new_text){
        GdbCommandInput.el.val(new_text)
    },
    make_flash: function(){
        GdbCommandInput.el.removeClass('flash')
        GdbCommandInput.el.addClass('flash')
    },
    clear_cmd_cache: function(){
        GdbCommandInput.sent_cmds = []
        GdbCommandInput.cmd_index = 0
    },
    clear: function(){
        GdbCommandInput.el.val('')
    }
}

export default GdbCommandInput
