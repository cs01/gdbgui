import {store} from './store.js';
import SourceCode from './SourceCode.jsx';
import StatusBar from './StatusBar.jsx';
import Registers from './Registers.js';
import GdbMiOutput from './GdbMiOutput.js';
import Breakpoint from './Breakpoint.jsx';
import Memory from './Memory.js';
import Modal from './Modal.js';
import Threads from './Threads.js';
import GdbConsoleComponent from './GdbConsole.js';
import {Expressions} from './Variables.js';


'use strict';

/* global debug */
/* global io */

// gdbgui convention to prefix MI commands with this number to ignore errors when response is received
// https://sourceware.org/gdb/onlinedocs/gdb/GDB_002fMI-Input-Syntax.html#GDB_002fMI-Input-Syntax
const IGNORE_ERRORS_TOKEN_STR = '1'
, IGNORE_ERRORS_TOKEN_INT = parseInt(IGNORE_ERRORS_TOKEN_STR)

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

        window.addEventListener('event_inferior_program_exited', GdbApi.event_inferior_program_exited)
        window.addEventListener('event_inferior_program_running', GdbApi.event_inferior_program_running)
        window.addEventListener('event_inferior_program_paused', GdbApi.event_inferior_program_paused)
        window.addEventListener('event_select_frame', GdbApi.event_select_frame)

        const TIMEOUT_MIN = 5
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
        window.dispatchEvent(new Event('event_inferior_program_running'))
        GdbApi.run_gdb_command('-exec-run')
    },
    inferior_is_paused: function(){
        return ([undefined, 'paused'].indexOf(store.get('inferior_program')) >= 0)
    },
    click_continue_button: function(){
        window.dispatchEvent(new Event('event_inferior_program_running'))
        GdbApi.run_gdb_command('-exec-continue')
    },
    click_next_button: function(){
        window.dispatchEvent(new Event('event_inferior_program_running'))
        GdbApi.run_gdb_command('-exec-next')
    },
    click_step_button: function(){
        window.dispatchEvent(new Event('event_inferior_program_running'))
        GdbApi.run_gdb_command('-exec-step')
    },
    click_return_button: function(){
        // From gdb mi docs (https://sourceware.org/gdb/onlinedocs/gdb/GDB_002fMI-Program-Execution.html#GDB_002fMI-Program-Execution):
        // `-exec-return` Makes current function return immediately. Doesn't execute the inferior.
        // That means we do NOT dispatch the event `event_inferior_program_running`, because it's not, in fact, running.
        // The return also doesn't even indicate that it's paused, so we need to manually trigger the event here.
        GdbApi.run_gdb_command('-exec-return')
        window.dispatchEvent(new Event('event_inferior_program_paused'))
    },
    click_next_instruction_button: function(){
        window.dispatchEvent(new Event('event_inferior_program_running'))
        GdbApi.run_gdb_command('-exec-next-instruction')
    },
    click_step_instruction_button: function(){
        window.dispatchEvent(new Event('event_inferior_program_running'))
        GdbApi.run_gdb_command('-exec-step-instruction')
    },
    click_send_interrupt_button: function(){
        window.dispatchEvent(new Event('event_inferior_program_running'))
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
    event_inferior_program_running: function(){
        // do nothing
    },
    event_inferior_program_paused: function(){
        GdbApi.refresh_state_for_gdb_pause()
    },
    event_select_frame: function(e){
        let framenum = e.detail
        GdbApi.run_gdb_command(`-stack-select-frame ${framenum}`)
        GdbApi.refresh_state_for_gdb_pause()
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
            cmds = cmds.concat(Expressions.get_update_cmds())
        }

        // update registers
        cmds = cmds.concat(Registers.get_update_cmds())

        // re-fetch memory over desired range as specified by DOM inputs
        cmds = cmds.concat(Memory.get_gdb_commands_from_inputs())

        // refresh breakpoints
        cmds.push(GdbApi.get_break_list_cmd())

        // List the frames currently on the stack.
        cmds.push('-stack-list-frames')
        return cmds
    },
    /**
     * Request relevant store information from gdb to refresh UI
     */
    refresh_state_for_gdb_pause: function(){
        GdbApi.run_gdb_command(GdbApi._get_refresh_state_for_pause_cmds())
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
            return [`-break-insert ${store.get('rendered_source_file_fullname')}:${line}`]
        }else{
            console.log('TODOLLDB - find mi-friendly command')
            return [`breakpoint set --file ${store.get('rendered_source_file_fullname')} --line ${line}`]
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
                return IGNORE_ERRORS_TOKEN_STR + '-data-evaluate-expression fflush(0)'
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


/**
 * This is the main callback when receiving a response from gdb.
 * This callback generally updates the store, which emits an event and
 * makes components re-render themselves.
 */
const process_gdb_response = function(response_array){
    // update status with error or with last response
    let update_status = true
    /**
     * Determines if response is an error and client does not want to be notified of errors for this particular response.
     * @param response: gdb mi response object
     * @return (bool): true if response should be ignored
     */
    , ignore = function(response){
        return response.token === IGNORE_ERRORS_TOKEN_INT && response.message === 'error'
    }

    for (let r of response_array){
        // gdb mi output
        GdbMiOutput.add_mi_output(r)

        if(ignore(r)){
            continue
        }

        if (r.type === 'result' && r.message === 'done' && r.payload){
            // This is special GDB Machine Interface structured data that we
            // can render in the frontend
            if ('bkpt' in r.payload){
                let new_bkpt = r.payload.bkpt

                // remove duplicate breakpoints
                let cmds = store.get('breakpoints')
                    .filter(b => (new_bkpt.fullname === b.fullname && new_bkpt.func === b.func && new_bkpt.line === b.line))
                    .map(b => GdbApi.get_delete_break_cmd(b.number))
                GdbApi.run_gdb_command(cmds)

                // save this breakpoint
                let bkpt = Breakpoint.save_breakpoint(r.payload.bkpt)

                // if executable does not have debug symbols (i.e. not compiled with -g flag)
                // gdb will not return a path, but rather the function name. The function name is
                // not a file, and therefore it cannot be displayed. Make sure the path is known before
                // trying to render the file of the newly created breakpoint.
                if(_.isString(bkpt.fullname_to_display) && bkpt.fullname_to_display.startsWith('/')){
                    // a normal breakpoint or child breakpoint
                    store.set('fullname_to_render', bkpt.fullname_to_display)
                    store.set('current_line_of_source_code', parseInt(bkpt.line))
                    store.set('make_current_line_visible', true)
                }

                // refresh all breakpoints
                GdbApi.refresh_breakpoints()
            }
            if ('BreakpointTable' in r.payload){
                Breakpoint.save_breakpoints(r.payload)
            }
            if ('stack' in r.payload) {
                Threads.update_stack(r.payload.stack)
            }
            if('threads' in r.payload){
                store.set('threads', r.payload.threads)
                if(store.get('interpreter') === 'gdb'){
                    store.set('current_thread_id', parseInt(r.payload['current-thread-id']))
                }else if(store.get('interpreter') === 'lldb'){
                    // lldb does not provide this
                }
            }
            if ('register-names' in r.payload) {
                let names = r.payload['register-names']
                // filter out empty names
                store.set('register_names', names.filter(name => name !== ''))
            }
            if ('register-values' in r.payload) {
                store.set('previous_register_values', store.get('current_register_values'))
                store.set('current_register_values', r.payload['register-values'])
            }
            if ('asm_insns' in r.payload) {
                SourceCode.save_new_assembly(r.payload.asm_insns, r.token)
            }
            if ('files' in r.payload){
                if(r.payload.files.length > 0){
                    let source_file_paths = _.uniq(r.payload.files.map(f => f.fullname)).sort()
                    store.set('source_file_paths', source_file_paths)

                    let language = 'c_family'
                    if(source_file_paths.some(p => p.endsWith('.rs'))){
                        language = 'rust'
                        let gdb_version_array = store.get('gdb_version_array')
                        // rust cannot view registers with gdb 7.12.x
                        if(gdb_version_array[0] == 7 && gdb_version_array[1] == 12){
                            GdbConsoleComponent.add(`Warning: Due to a bug in gdb version ${store.get('gdb_version')}, gdbgui cannot show register values with rust executables. See https://github.com/cs01/gdbgui/issues/64 for details.`, true)
                            store.set('can_fetch_register_values', false)
                        }
                    }else if (source_file_paths.some(p => p.endsWith('.go'))){
                        language = 'go'
                    }
                    store.set('language', language)
                }else{
                    store.set('source_file_paths', ['Executable was compiled without debug symbols. Source file paths are unknown.'])

                    if (store.get('inferior_binary_path')){
                        Modal.render('Warning',
                         `This binary was not compiled with debug symbols. Recompile with the -g flag for a better debugging experience.
                         <p>
                         <p>
                         Read more: <a href="http://www.delorie.com/gnu/docs/gdb/gdb_17.html">http://www.delorie.com/gnu/docs/gdb/gdb_17.html</a>`,
                         '')
                    }
                }

            }
            if ('memory' in r.payload){
                Memory.add_value_to_cache(r.payload.memory[0].begin, r.payload.memory[0].contents)
            }
            // gdb returns local variables as "variables" which is confusing, because you can also create variables
            // in gdb with '-var-create'. *Those* types of variables are referred to as "expressions" in gdbgui, and
            // are returned by gdbgui as "changelist", or have the keys "has_more", "numchild", "children", or "name".
            if ('variables' in r.payload){
                store.set('locals', r.payload.variables)
            }
            // gdbgui expression (aka a gdb variable was changed)
            if ('changelist' in r.payload){
                Expressions.handle_changelist(r.payload.changelist)
            }
            // gdbgui expression was evaluated for the first time for a child variable
            if('has_more' in r.payload && 'numchild' in r.payload && 'children' in r.payload){
                Expressions.gdb_created_children_variables(r)
            }
            // gdbgui expression was evaluated for the first time for a root variable
            if ('name' in r.payload){
                Expressions.gdb_created_root_variable(r)
            }
        } else if (r.type === 'result' && r.message === 'error'){
            // render it in the status bar, and don't render the last response in the array as it does by default
            if(update_status){
                StatusBar.render_from_gdb_mi_response(r)
                update_status = false
            }

            // we tried to load a binary, but gdb couldn't find it
            if(r.payload.msg === `${store.get('inferior_binary_path')}: No such file or directory.`){
                window.dispatchEvent(new Event('event_inferior_program_exited'))
            }

        } else if (r.type === 'console'){
            GdbConsoleComponent.add(r.payload, r.stream === 'stderr')
            if(store.get('gdb_version') === undefined){
                // parse gdb version from string such as
                // GNU gdb (Ubuntu 7.7.1-0ubuntu5~14.04.2) 7.7.1
                let m = /GNU gdb \(.*\)\s*(.*)\\n/g
                let a = m.exec(r.payload)
                if(_.isArray(a) && a.length === 2){
                    store.set('gdb_version', a[1])
                    store.set('gdb_version_array', a[1].split('.'))
                }
            }
        }else if (r.type === 'output' || r.type === 'target'){
            // output of program
            GdbConsoleComponent.add(r.payload, r.stream === 'stderr')
        }

        if (r.message && r.message === 'stopped' && r.payload && r.payload.reason){
            if(r.payload.reason.includes('exited')){
                window.dispatchEvent(new Event('event_inferior_program_exited'))

            }else if (r.payload.reason.includes('breakpoint-hit') || r.payload.reason.includes('end-stepping-range')){
                if (r.payload['new-thread-id']){
                    Threads.set_thread_id(r.payload['new-thread-id'])
                }
                window.dispatchEvent(new CustomEvent('event_inferior_program_paused', {'detail': r.payload.frame}))

            }else if (r.payload.reason === 'signal-received'){
                GdbConsoleComponent.add('gdbgui noticed a signal was recieved. ' +
                    'If the program exited due to a fault, you can attempt to re-enter the store of the program when the fault ' +
                    'occurred by clicking the below button.')
                GdbConsoleComponent.add_no_escape(`<a style="font-family: arial; margin-left: 10px;" class='btn btn-success backtrace'>Re-Enter Program (backtrace)</a>`)

            }else{
                console.log('TODO handle new reason for stopping. Notify developer of this.')
                console.log(r)
            }
        }
    }

    // render response of last element of array
    if(update_status){
        let last_response = _.last(response_array)
        if(ignore(last_response)){
            store.set('status', {text: '', error: false, warning: false})
        }else{
            StatusBar.render_from_gdb_mi_response(last_response)
        }
    }

    if(response_array.length > 0){
        // scroll to the bottom
        GdbMiOutput.scroll_to_bottom()
        GdbConsoleComponent.scroll_to_bottom()
    }
}

export default GdbApi;
