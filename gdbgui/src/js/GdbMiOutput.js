/**
 * A component to display, in gory detail, what is
 * returned from gdb's machine interface. This displays the
 * data source that is fed to all components and UI elements
 * in gdb gui, and is useful when debugging gdbgui, or
 * a command that failed but didn't have a useful failure
 * message in gdbgui.
 */

 /* global debug */
const GdbMiOutput = {
    el: $('#gdb_mi_output'),
    init: function(){
        $('.clear_mi_output').click(GdbMiOutput.clear)
        if(!debug){
            GdbMiOutput.el.html('this widget is only enabled in debug mode')
        }
    },
    clear: function(){
        GdbMiOutput.el.html('')
    },
    add_mi_output: function(mi_obj){
        if(debug){
            let mi_obj_dump = JSON.stringify(mi_obj, null, 4)
            mi_obj_dump = mi_obj_dump.replace(/[^(\\)]\\n/g).replace("<", "&lt;").replace(">", "&gt;")
            GdbMiOutput.el.append(`<p class='pre margin_sm output'>${mi_obj.type}:<br>${mi_obj_dump}</span>`)
            return
        }else{
            // dont append to this in release mode
        }
    },
    _scroll_to_bottom: function(){
        GdbMiOutput.el.animate({'scrollTop': GdbMiOutput.el.prop('scrollHeight')})
    }
}
GdbMiOutput.scroll_to_bottom = _.debounce(GdbMiOutput._scroll_to_bottom, 300, {leading: true})

export default GdbMiOutput
