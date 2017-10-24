/**
 * An object to manage the websocket connection to the python server that manages gdb,
 * to send various commands to gdb, to and to dispatch gdb responses to gdbgui.
 */
import {store} from './store.js';
import Registers from './Registers.jsx';
import Memory from './Memory.jsx';
import Modal from './Modal.js';
import Actions from './Actions.js';
import GdbConsoleComponent from './GdbConsole.js';
import GdbVariable from './GdbVariable.jsx';
import constants from './constants.js';
import process_gdb_response from './process_gdb_response.js';

/* global debug */

// print to console if debug is true
let debug_print
if(debug){
    debug_print = console.info
}else{
    debug_print = function(){
        // stubbed out
    }
}

/**
 * This object contains methods to interact with
 * gdb, but does not directly render anything in the DOM.
 */
const GdbApi = {
    init: function(){
        $("body").on("click", ".gdb_cmd", GdbApi.click_gdb_cmd_button)
        $('body').on('click', '.backtrace', GdbApi.backtrace)
        $('#run_button').click(GdbApi.click_run_button)
        $('#continue_button').click(GdbApi.click_continue_button)
        $('#next_button').click(GdbApi.click_next_button)
        $('#step_button').click(GdbApi.click_step_button)
        $('#return_button').click(GdbApi.click_return_button)
        $('#next_instruction_button').click(GdbApi.click_next_instruction_button)
        $('#step_instruction_button').click(GdbApi.click_step_instruction_button)
        $('#send_interrupt_button').click(GdbApi.click_send_interrupt_button)

        const TIMEOUT_MIN = 5
        /* global io */
        GdbApi.socket = io.connect(`http://${document.domain}:${location.port}/gdb_listener`, {timeout: TIMEOUT_MIN * 60 * 1000});

        GdbApi.socket.on('connect', function(){
            debug_print('connected')
        });

        GdbApi.socket.on('gdb_response', function(response_array) {
            clearTimeout(GdbApi._waiting_for_response_timeout)
            store.set('waiting_for_response', false)
            process_gdb_response(response_array)
        });

        GdbApi.socket.on('error_running_gdb_command', function(data) {
            store.set('status', {text: `Error occurred on server when running gdb command: ${data.message}`, error: true, warning: false})
        });

        GdbApi.socket.on('gdb_pid', function(gdb_pid) {
            store.set('gdb_pid', gdb_pid)
            store.set('status', {text: `${store.get('interpreter')} process ${gdb_pid} is running for this tab`, error: false, warning: false})
        });

        GdbApi.socket.on('disconnect', function(){
            // we no longer need to warn the user before they exit the page since the gdb process
            // on the server is already gone
            window.onbeforeunload = () => null

            // show modal
            Modal.render('The gdbgui server has shutdown. This tab will no longer function as expected.')
            debug_print('disconnected')
        });
    },
    _waiting_for_response_timeout: null,
    click_run_button: function(){
        Actions.inferior_program_running()
        GdbApi.run_gdb_command('-exec-run')
    },
    inferior_is_paused: function(){
        return ([constants.inferior_states.unknown, constants.inferior_states.paused].indexOf(store.get('inferior_program')) !== -1)
    },
    click_continue_button: function(){
        Actions.inferior_program_running()
        GdbApi.run_gdb_command('-exec-continue')
    },
    click_next_button: function(){
        Actions.inferior_program_running()
        GdbApi.run_gdb_command('-exec-next')
    },
    click_step_button: function(){
        Actions.inferior_program_running()
        GdbApi.run_gdb_command('-exec-step')
    },
    click_return_button: function(){
        // From gdb mi docs (https://sourceware.org/gdb/onlinedocs/gdb/GDB_002fMI-Program-Execution.html#GDB_002fMI-Program-Execution):
        // `-exec-return` Makes current function return immediately. Doesn't execute the inferior.
        // That means we do NOT dispatch the event `event_inferior_program_running`, because it's not, in fact, running.
        // The return also doesn't even indicate that it's paused, so we need to manually trigger the event here.
        GdbApi.run_gdb_command('-exec-return')
        Actions.inferior_program_running()
    },
    click_next_instruction_button: function(){
        Actions.inferior_program_running()
        GdbApi.run_gdb_command('-exec-next-instruction')
    },
    click_step_instruction_button: function(){
        Actions.inferior_program_running()
        GdbApi.run_gdb_command('-exec-step-instruction')
    },
    click_send_interrupt_button: function(){
        Actions.inferior_program_running()
        GdbApi.run_gdb_command('-exec-interrupt')
    },
    click_gdb_cmd_button: function(e){
        if (e.currentTarget.dataset.cmd !== undefined){
            // run single command
            // i.e. <a data-cmd='cmd' />
            GdbApi.run_gdb_command(e.currentTarget.dataset.cmd)
        }else if (e.currentTarget.dataset.cmd0 !== undefined){
            // run multiple commands
            // i.e. <a data-cmd0='cmd 0' data-cmd1='cmd 1' data-...>
            let cmds = []
            let i = 0
            let cmd = e.currentTarget.dataset[`cmd${i}`]
            // extract all commands into an array, then run them
            // (max of 100 commands)
            while(cmd !== undefined && i < 100){
                cmds.push(cmd)
                i++
                cmd = e.currentTarget.dataset[`cmd${i}`]
            }
            GdbApi.run_gdb_command(cmds)
        }else{
            console.error('expected cmd or cmd0 [cmd1, cmd2, ...] data attribute(s) on element')
        }
    },
    select_frame: function(framenum){
        GdbApi.run_command_and_refresh_state(`-stack-select-frame ${framenum}`)
    },
    select_thread_id: function(thread_id){
        GdbApi.run_command_and_refresh_state(`-thread-select ${thread_id}`)
    },
    /**
     * Before sending a command, set a timeout to notify the user that something might be wrong
     * if a response from gdb is not received
     */
    waiting_for_response: function(){
        store.set('waiting_for_response', true)
        const WAIT_TIME_SEC = 3
        clearTimeout(GdbApi._waiting_for_response_timeout)
        GdbApi._waiting_for_response_timeout = setTimeout(
            () => {
                let text = `It's been over ${WAIT_TIME_SEC} seconds. Is an inferior program loaded and running?`
                store.set('waiting_for_response', false)
                store.set('status', {text: text, error: false, warning: true})
                GdbConsoleComponent.add(text, true)
                GdbConsoleComponent.scroll_to_bottom()
            },
            WAIT_TIME_SEC * 1000)
    },
    /**
     * runs a gdb cmd (or commands) directly in gdb on the backend
     * validates command before sending, and updates the gdb console and status bar
     * @param cmd: a string or array of strings, that are directly evaluated by gdb
     * @return nothing
     */
    run_gdb_command: function(cmd){
        if(_.trim(cmd) === ''){
            return
        }

        let cmds = cmd
        if(_.isString(cmds)){
            cmds = [cmds]
        }

        // add the send command to the console to show commands that are
        // automatically run by gdb
        if(store.get('show_all_sent_commands_in_console')){
            GdbConsoleComponent.add_sent_commands(cmds)
        }

        GdbApi.waiting_for_response()
        GdbApi.socket.emit('run_gdb_command', {cmd: cmds})
    },
    /**
     * Run a user-defined command, then refresh the store
     * @param user_cmd (str or array): command or commands to run before refreshing store
     */
    run_command_and_refresh_state: function(user_cmd){
        if(!user_cmd){
            console.error('missing required argument')
            return
        }
        let cmds = []
        if(_.isArray(user_cmd)){
            cmds = cmds.concat(user_cmd)
        }else if (_.isString(user_cmd) && user_cmd.length > 0){
            cmds.push(user_cmd)
        }
        cmds = cmds.concat(GdbApi._get_refresh_state_for_pause_cmds())
        GdbApi.run_gdb_command(cmds)
    },
    backtrace: function(){
        let cmds = ['backtrace']
        cmds = cmds.concat(GdbApi._get_refresh_state_for_pause_cmds())
        GdbApi.run_gdb_command(cmds)
    },
    /**
     * Get array of commands to send to gdb that refreshes everything in the
     * frontend
     */
    _get_refresh_state_for_pause_cmds: function(){
        let cmds = [
            // get info on current thread
            '-thread-info',
            // print the name, type and value for simple data types,
            // and the name and type for arrays, structures and unions.
            '-stack-list-variables --simple-values',
            // flush inferior process' output (if any)
            // by default, it only flushes when the program terminates
            // so this additional call is needed
            GdbApi.get_flush_output_cmd()
        ]
        if(store.get('interpreter') === 'gdb'){
            // update all user-defined variables in gdb
            cmds.push('-var-update --all-values *')
        }else if(store.get('interpreter') === 'lldb'){
            // the * arg doesn't work, so loop over all
            // names and push commands for each
            cmds = cmds.concat(GdbVariable.get_update_cmds())
        }

        // update registers
        cmds = cmds.concat(Registers.get_update_cmds())

        // re-fetch memory over desired range as specified by DOM inputs
        cmds = cmds.concat(Memory.get_gdb_commands_from_state())

        // refresh breakpoints
        cmds.push(GdbApi.get_break_list_cmd())

        // List the frames currently on the stack.
        cmds.push('-stack-list-frames')
        return cmds
    },
    refresh_breakpoints: function(){
        GdbApi.run_gdb_command([GdbApi.get_break_list_cmd()])
    },
    get_inferior_binary_last_modified_unix_sec(path){
        $.ajax({
            url: "/get_last_modified_unix_sec",
            cache: false,
            method: 'GET',
            data: {'path': path},
            success: GdbApi._recieve_last_modified_unix_sec,
            error: GdbApi._error_getting_last_modified_unix_sec,
        })
    },
    get_insert_break_cmd: function(fullname, line){
        if(store.get('interpreter') === 'gdb'){
            return [`-break-insert ${fullname}:${line}`]
        }else{
            console.log('TODOLLDB - find mi-friendly command')
            return [`breakpoint set --file ${fullname} --line ${line}`]
        }
    },
    get_delete_break_cmd: function(bkpt_num){
        if(store.get('interpreter') === 'gdb'){
            return `-break-delete ${bkpt_num}`
        }else{
            console.log('TODOLLDB - find mi-friendly command')
            return `breakpoint delete ${bkpt_num}`
        }
    },
    get_break_list_cmd: function(){
        if(store.get('interpreter') === 'gdb'){
            return '-break-list'
        }else if(store.get('interpreter') === 'lldb'){
            console.log('TODOLLDB - find mi-friendly command')
            return 'breakpoint list'
        }
    },
    get_flush_output_cmd: function(){
        if(store.get('language') === 'c_family'){
            if(store.get('interpreter') === 'gdb'){
                return constants.IGNORE_ERRORS_TOKEN_STR + '-data-evaluate-expression fflush(0)'
            }else if(store.get('interpreter') === 'lldb'){
                return ''
            }
        }else if(store.get('language') === 'go'){
            return ''  // TODO?
        }else if (store.get('language') === 'rust'){
            return ''  // TODO?
        }
    },
    _recieve_last_modified_unix_sec(data){
        if(data.path === store.get('inferior_binary_path')){
            store.set('inferior_binary_path_last_modified_unix_sec', data.last_modified_unix_sec)
        }
    },
    _error_getting_last_modified_unix_sec(data){
        void(data)
        store.set('inferior_binary_path', null)
    }
}

export default GdbApi;
