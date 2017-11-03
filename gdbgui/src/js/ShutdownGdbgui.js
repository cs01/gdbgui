/**
 * Component to shutdown gdbgui
 */
const ShutdownGdbgui = {
    /**
     * Set up events and render checkboxes
     */
    init: function(){
        document.getElementById('shutdown_gdbgui').onclick = ShutdownGdbgui.click_shutdown_button
    },
    click_shutdown_button: function(){
        // no need to show confirmation before leaving, because we're about to prompt the user
        window.onbeforeunload = () => null
        // prompt user
        if (window.confirm('This will terminate the gdbgui for all browser tabs running gdbgui (and their gdb processes). Continue?') === true) {
            // user wants to shutdown, redirect them to the shutdown page
            window.location = '/shutdown'
        } else {
            // re-add confirmation before leaving page (when user actually leaves at a later time)
            window.onbeforeunload = () => 'some text'
        }
    },
}

export default ShutdownGdbgui
