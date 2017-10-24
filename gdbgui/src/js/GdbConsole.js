import GdbCommandInput from './GdbCommandInput.js'
import Util from './Util.js'

/**
 * A component that mimicks the gdb console.
 * It displays any console output and lets you enter commands.
 * It also stores previous commands, accessible by the up arrow.
 */
const GdbConsoleComponent = {
    el: $('#console'),
    init: function(){
        $('.clear_console').click(GdbConsoleComponent.clear_console)
        $("body").on("click", ".sent_command", GdbConsoleComponent.click_sent_command)
    },
    clear_console: function(){
        GdbConsoleComponent.el.html('')
    },
    add: function(s, stderr=false){
        let strings = _.isString(s) ? [s] : s,
            cls = stderr ? 'stderr' : ''
        strings.map(string => GdbConsoleComponent.el.append(`<p class='otpt ${cls}'>${Util.escape(string)}</p>`))
    },
    add_no_escape: function(raw_string){
        GdbConsoleComponent.el.append(raw_string)
    },
    add_mi_error: function(mi_obj){
        let err_text_array = Util.get_err_text_from_mi_err_response(mi_obj)
        GdbConsoleComponent.add(err_text_array, true)
    },
    add_sent_commands(cmds){
        if(!_.isArray(cmds)){
            cmds = [cmds]
        }
        cmds.map(cmd => GdbConsoleComponent.el.append(`<p class='otpt sent_command pointer' data-cmd="${cmd}">${Util.escape(cmd)}</p>`))
        GdbConsoleComponent.scroll_to_bottom()
    },
    _scroll_to_bottom: function(){
        GdbConsoleComponent.el.animate({'scrollTop': GdbConsoleComponent.el.prop('scrollHeight')})
    },
    click_sent_command: function(e){
        // when a previously sent command is clicked, populate the command input
        // with it
        let previous_cmd_from_history = (e.currentTarget.dataset.cmd)
        GdbCommandInput.set_input_text(previous_cmd_from_history)
        // put focus back in input so user can just hit enter
        GdbCommandInput.el.focus()
        // reset up-down arrow cmd history index
        GdbCommandInput.cmd_index = 0
    },
}
GdbConsoleComponent.scroll_to_bottom = _.debounce(GdbConsoleComponent._scroll_to_bottom, 300, {leading: true})

export default GdbConsoleComponent
