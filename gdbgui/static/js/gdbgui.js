/**
 * This is the main frontend file to make
 * an interactive ui for gdb. Everything exists in this single js
 * file (besides vendor libraries).
 *
 * There are several top-level components, most of which can render new html in the browser.
 *
 * state is managed in a single location (state._state), and each time the state
 * changes, an event is emitted, which Components listen for. Each Component then re-renders itself
 * as necessary.
 *
 * The state can be changed via state.set() and retrieved via state.get(). state._state should not
 * be accessed directly. state.get() does not return references to objects, it returns new objects.
 * When used this way, state._state is only mutable with calls to state.set().
 *
 * This pattern is written in plain javascript, yet provides for a reactive environment. It was inspired
 * by ReactJS but does not require a build system or JSX.
 *
 * For example, calling state.set('current_line_of_source_code', 100)
 * will change the highlighted line and automatically scroll to that line in the UI. Or calling
 * state.set('highlight_source_code', true) will "magically" make the source code be highlighted.
 * Debounce functions are used to mitigate inefficiencies of rapid state changes (see _.debounce()).
 *
 */

 /* global state */
 /* global Reactor */
 /* global Awesomplete */
 /* global Split */
 /* global io */
 /* global moment */
 /* global debug */
 /* global initial_data */

window.state = (function ($, _, state, Reactor, Awesomplete, Split, io, moment, debug, initial_data) {
"use strict";

/**
 * Constants
 */
const ENTER_BUTTON_NUM = 13
    , LEFT_BUTTON_NUM = 37
    , UP_BUTTON_NUM = 38
    , RIGHT_BUTTON_NUM = 39
    , DOWN_BUTTON_NUM = 40
    , COMMA_BUTTON_NUM = 188
    , DATE_FORMAT = 'dddd, MMMM Do YYYY, h:mm:ss a'
    , ANIMATED_REFRESH_ICON = "<span class='glyphicon glyphicon-refresh glyphicon-refresh-animate'></span>"
    // gdbgui convention to prefix MI commands with this number to ignore errors when response is received
    // https://sourceware.org/gdb/onlinedocs/gdb/GDB_002fMI-Input-Syntax.html#GDB_002fMI-Input-Syntax
    , IGNORE_ERRORS_TOKEN_STR = '1'
    , IGNORE_ERRORS_TOKEN_INT = parseInt(IGNORE_ERRORS_TOKEN_STR)
    , DISASSEMBLY_FOR_MISSING_FILE_STR = '2'
    , DISASSEMBLY_FOR_MISSING_FILE_INT = parseInt(DISASSEMBLY_FOR_MISSING_FILE_STR)
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
 * Some general utility methods
 */
const Util = {
    /**
     * Get html table
     * @param columns: array of strings
     * @param data: array of arrays of data
     */
    get_table: function(columns, data, style='') {
        var result = [`<table class='table table-bordered table-condensed' style="${style}">`];
        if(columns){
            result.push("<thead>")
            result.push("<tr>")
            for (let h of columns){
                result.push(`<th>${h}</th>`)
            }
            result.push("</tr>")
            result.push("</thead>")
        }

        if(data){
            result.push("<tbody>")
            for(let row of data) {
                    result.push("<tr>")
                    for(let cell of row){
                            result.push(`<td>${cell}</td>`)
                    }
                    result.push("</tr>")
            }
        }
        result.push("</tbody>")
        result.push("</table>")
        return result.join('\n')
    },
    /**
     * Escape gdb's output to be browser compatible
     * @param s: string to mutate
     */
    escape: function(s){
        return s.replace(/\>/g, "&gt;")
                .replace(/\</g, "&lt;")
                .replace(/\\n/g, '<br>')
                .replace(/\\r/g, '')
                .replace(/\\"/g, '"')
                .replace(/\\t/g, '&nbsp')
    },
    /**
     * take a string of html in JavaScript and strip out the html
     * http://stackoverflow.com/a/822486/2893090
     */
    get_text_from_html: function(html){
       var tmp = document.createElement("DIV");
       tmp.innerHTML = html;
       return tmp.textContent || tmp.innerText || "";
    },
    /**
     * @param fullname_and_line: i.e. /path/to/file.c:78
     * @param default_line_if_not_found: i.e. 0
     * @return: Array, with 0'th element == path, 1st element == line
     */
    parse_fullname_and_line: function(fullname_and_line, default_line_if_not_found=undefined){
        let user_input_array = fullname_and_line.split(':'),
            fullname = user_input_array[0],
            line = default_line_if_not_found
        if(user_input_array.length === 2){
            line = user_input_array[1]
        }
        return [fullname, parseInt(line)]
    },
    /**
     * @param mi_obj: gdb mi obj from pygdbmi
     * @return array of error messages and frame information (if any)
     */
    get_err_text_from_mi_err_response: function(mi_obj){
        const interesting_keys = ['msg', 'reason', 'signal-name', 'signal-meaning']
        let text = []
        for(let k of interesting_keys){
            if (mi_obj.payload[k]) {text.push(mi_obj.payload[k])}
        }

        if (mi_obj.payload.frame){
            for(let i of ['file', 'func', 'line', 'addr']){
                if (i in mi_obj.payload.frame){
                    text.push(`${i}: ${mi_obj.payload.frame[i]}`)
                }
            }
        }
        return text
    }
}

const initial_state = {
    // environment
    debug: debug,  // if gdbgui is run in debug mode
    interpreter: initial_data.interpreter,  // either 'gdb' or 'llvm'
    gdbgui_version: initial_data.gdbgui_version,
    latest_gdbgui_version: '(not fetched)',
    show_gdbgui_upgrades: initial_data.show_gdbgui_upgrades,
    gdb_version: undefined,  // this is parsed from gdb's output
    gdb_version_array: [],  // this is parsed from gdb's output
    gdb_pid: undefined,
    can_fetch_register_values: true,  // set to false if using Rust and gdb v7.12.x (see https://github.com/cs01/gdbgui/issues/64)

    // preferences
    // syntax highlighting
    themes: initial_data.themes,
    current_theme: localStorage.getItem('theme') || initial_data.themes[0],
    highlight_source_code: JSON.parse(localStorage.getItem('highlight_source_code')),  // get saved boolean to highlight source code

    auto_add_breakpoint_to_main: JSON.parse(localStorage.getItem('auto_add_breakpoint_to_main')),

    pretty_print: true,  // whether gdb should "pretty print" variables. There is an option for this in Settings
    refresh_state_after_sending_console_command: true,  // If true, send commands to refresh GUI state after each command is sent from console
    show_all_sent_commands_in_console: debug,  // show all sent commands if in debug mode

    // inferior program state
    // choices for inferior_program are:
    // 'running'
    // 'paused'
    // 'exited'
    // undefined
    inferior_program: undefined,

    paused_on_frame: undefined,
    selected_frame_num: 0,
    current_thread_id: undefined,
    stack: [],
    locals: [],
    threads: [],

    // source files
    source_file_paths: [], // all the paths gdb says were used to compile the target binary
    language: 'c_family',  // assume langage of program is c or c++. Language is determined by source file paths. Used to turn on/off certain features/warnings.
    files_being_fetched: [],
    fullname_to_render: null,
    current_line_of_source_code: null,
    current_assembly_address: null,
    rendered_source_file_fullname: null,
    has_unrendered_assembly: false,  // set to true when new assembly has been fetched and is cached in browser, but not displayed in source code window
    make_current_line_visible: false,  // set to true when source code window should jump to current line
    cached_source_files: [],  // list with keys fullname, source_code
    disassembly_for_missing_file: [],  // mi response object. Only fetched when there currently paused frame refers to a file that doesn't exist or is undefined
    missing_files: [],  // files that were attempted to be fetched but did not exist on the local filesystem


    // binary selection
    inferior_binary_path: null,
    inferior_binary_path_last_modified_unix_sec: null,
    warning_shown_for_old_binary: false,

    // registers
    register_names: [],
    previous_register_values: {},
    current_register_values: {},
    fetch_registers: false,

    // memory
    memory_cache: {},

    // breakpoints
    breakpoints: [],

    // expressions
    expr_gdb_parent_var_currently_fetching_children: null,  // parent gdb variable name (i.e. var7)
    expr_being_created: null,  // the expression being created (i.e. myvar)
    // type of expression being created. Choices are: 'local' (autocreated local var), 'hover' (created when hovering in source coee), 'expr' (a "watch" expression )
    expr_type: null,
    expressions: [],  // array of dicts. Key is expression, value has various keys. See Expressions component.
}

state.options.debug = debug
// stator library creates global state: https://github.com/cs01/stator
state.initialize(initial_state)

/**
 * Modal component that is hidden by default, but shown
 * when render is called. The user must close the modal to
 * resume using the GUI.
 */
const Modal = {
    init: function(){
        $('#gdb_modal').on('hidden.bs.modal', function () {
            $('main').removeClass('blur') // unblur the main content
        })

    },
    /**
     * Call when an important modal message must be shown
     */
    render: function(title, body){
        $('#modal_title').html(title)
        $('#modal_body').html(body)
        $('#gdb_modal').modal('show')
        $('main').addClass('blur')  // blur the main content
    }
}

/**
 * The StatusBar component display the most recent gdb status
 * at the top of the page
 */
const StatusBar = {
    el: $('#status'),
    /**
     * If user runs a command, show warning message if gdb does not respond
     * in a timely manner. Set a timeout, and store it here. Remove it when gdb
     * responds.
     */
    waiting_timeout: null,
    /**
     * Render a new status
     * @param status_str: The string to render
     * @param error: Whether this string relates to an error condition. If true,
     *                  a red label appears
     */
    render: function(status_str, error=false, warn=false){
        clearTimeout(StatusBar.waiting_timeout)
        let prefix = ''
        if(error){
            prefix = "<span class='label label-danger'>error</span>&nbsp;"
        }else if (warn){
            prefix = "<span class='label label-warning'>warning</span>&nbsp;"
        }
        StatusBar.el.html(prefix + status_str)

        // also add to the console if error/warning
        if(error || warn){
            GdbConsoleComponent.add(status_str, true)
        }

    },
    /**
     * When waiting for a response render this, and set a timeout.
     * If response is not received, update the status to indicate there might be
     * an issue that needs to be addressed by the user.
     */
    render_waiting: function(){
        const WAIT_TIME_SEC = 3
        StatusBar.render(ANIMATED_REFRESH_ICON)
        StatusBar.waiting_timeout = setTimeout(
            () => {
                let warn_text = `It's been over ${WAIT_TIME_SEC} seconds. Is an inferior program loaded and running?`
                StatusBar.render(warn_text, false, true)
                GdbConsoleComponent.add(warn_text, true)
                GdbConsoleComponent.scroll_to_bottom()
            },
            WAIT_TIME_SEC * 1000)
    },
    /**
     * Handle http responses with error codes
     * @param response: response from server
     */
    render_ajax_error_msg: function(response){
        if (response.responseJSON && response.responseJSON.message){
            StatusBar.render(_.escape(response.responseJSON.message), true)
        }else{
            StatusBar.render(`${response.statusText} (${response.status} error)`, true)
        }
    },
    /**
     * Render pygdbmi response
     * @param mi_obj: gdb mi obj from pygdbmi
     */
    render_from_gdb_mi_response: function(mi_obj){
        if(!mi_obj){
            return
        }
        // Update status
        let status = [],
            error = false
        if (mi_obj.message){
            if(mi_obj.message === 'error'){
                error = true
            }else{
                status.push(mi_obj.message)
            }
        }
        if (mi_obj.payload){
            let err_text_array = Util.get_err_text_from_mi_err_response(mi_obj)
            status = status.concat(err_text_array)
        }
        StatusBar.render(status.join(', '), error)
    }
}

/**
 * A component to mimicks the gdb console.
 * It stores previous commands, and allows you to enter new ones.
 * It also displays any console output.
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
        strings.map(string => GdbConsoleComponent.el.append(`<p class='margin_sm output ${cls}'>${Util.escape(string)}</p>`))
    },
    add_mi_error: function(mi_obj){
        let err_text_array = Util.get_err_text_from_mi_err_response(mi_obj)
        GdbConsoleComponent.add(err_text_array, true)
    },
    add_sent_commands(cmds){
        if(!_.isArray(cmds)){
            cmds = [cmds]
        }
        cmds.map(cmd => GdbConsoleComponent.el.append(`<p class='margin_sm output sent_command pointer' data-cmd="${cmd}">${Util.escape(cmd)}</p>`))
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

/**
 * This object contains methods to interact with
 * gdb, but does not directly render anything in the DOM.
 */
const GdbApi = {
    init: function(){
        $("body").on("click", ".gdb_cmd", GdbApi.click_gdb_cmd_button)
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
            process_gdb_response(response_array)
        });

        GdbApi.socket.on('error_running_gdb_command', function(data) {
            StatusBar.render(`Error occurred on server when running gdb command: ${data.message}`, true)
        });

        GdbApi.socket.on('gdb_pid', function(gdb_pid) {
            state.set('gdb_pid', gdb_pid)
            StatusBar.render(`${state.get('interpreter')} process ${gdb_pid} is running for this tab`)
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
    click_run_button: function(e){
        window.dispatchEvent(new Event('event_inferior_program_running'))
        GdbApi.run_gdb_command('-exec-run')
    },
    inferior_is_paused: function(){
        return ([undefined, 'paused'].indexOf(state.get('inferior_program')) >= 0)
    },
    click_continue_button: function(e){
        window.dispatchEvent(new Event('event_inferior_program_running'))
        GdbApi.run_gdb_command('-exec-continue')
    },
    click_next_button: function(e){
        window.dispatchEvent(new Event('event_inferior_program_running'))
        GdbApi.run_gdb_command('-exec-next')
    },
    click_step_button: function(e){
        window.dispatchEvent(new Event('event_inferior_program_running'))
        GdbApi.run_gdb_command('-exec-step')
    },
    click_return_button: function(e){
        // From gdb mi docs (https://sourceware.org/gdb/onlinedocs/gdb/GDB_002fMI-Program-Execution.html#GDB_002fMI-Program-Execution):
        // `-exec-return` Makes current function return immediately. Doesn't execute the inferior.
        // That means we do NOT dispatch the event `event_inferior_program_running`, because it's not, in fact, running.
        // The return also doesn't even indicate that it's paused, so we need to manually trigger the event here.
        GdbApi.run_gdb_command('-exec-return')
        window.dispatchEvent(new Event('event_inferior_program_paused'))
    },
    click_next_instruction_button: function(e){
        window.dispatchEvent(new Event('event_inferior_program_running'))
        GdbApi.run_gdb_command('-exec-next-instruction')
    },
    click_step_instruction_button: function(e){
        window.dispatchEvent(new Event('event_inferior_program_running'))
        GdbApi.run_gdb_command('-exec-step-instruction')
    },
    click_send_interrupt_button: function(e){
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
        if(state.get('show_all_sent_commands_in_console')){
            GdbConsoleComponent.add_sent_commands(cmds)
        }

        StatusBar.render_waiting()
        GdbApi.socket.emit('run_gdb_command', {cmd: cmds});
    },
    /**
     * Run a user-defined command, then refresh the state
     * @param user_cmd (str or array): command or commands to run before refreshing state
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
        if(state.get('interpreter') === 'gdb'){
            // update all user-defined variables in gdb
            cmds.push('-var-update --all-values *')
        }else if(state.get('interpreter') === 'lldb'){
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
     * Request relevant state information from gdb to refresh UI
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
        if(state.get('interpreter') === 'gdb'){
            return [`-break-insert ${state.get('rendered_source_file_fullname')}:${line}`]
        }else{
            console.log('TODOLLDB - find mi-friendly command')
            return [`breakpoint set --file ${state.get('rendered_source_file_fullname')} --line ${line}`]
        }
    },
    get_delete_break_cmd: function(bkpt_num){
        if(state.get('interpreter') === 'gdb'){
            return `-break-delete ${bkpt_num}`
        }else{
            console.log('TODOLLDB - find mi-friendly command')
            return `breakpoint delete ${bkpt_num}`
        }
    },
    get_break_list_cmd: function(){
        if(state.get('interpreter') === 'gdb'){
            return '-break-list'
        }else if(state.get('interpreter') === 'lldb'){
            console.log('TODOLLDB - find mi-friendly command')
            return 'breakpoint list'
        }
    },
    get_flush_output_cmd: function(){
        if(state.get('language') === 'c_family'){
            if(state.get('interpreter') === 'gdb'){
                return IGNORE_ERRORS_TOKEN_STR + '-data-evaluate-expression fflush(0)'
            }else if(state.get('interpreter') === 'lldb'){
                return ''
            }
        }else if(state.get('language') === 'go'){
            return ''  // TODO?
        }else if (state.get('language') === 'rust'){
            return ''  // TODO?
        }
    },
    _recieve_last_modified_unix_sec(data){
        if(data.path === state.get('inferior_binary_path')){
            state.set('inferior_binary_path_last_modified_unix_sec', data.last_modified_unix_sec)
        }
    },
    _error_getting_last_modified_unix_sec(data){
        state.set('inferior_binary_path', null)
    }
}

/**
 * A component to display, in gory detail, what is
 * returned from gdb's machine interface. This displays the
 * data source that is fed to all components and UI elements
 * in gdb gui, and is useful when debugging gdbgui, or
 * a command that failed but didn't have a useful failure
 * message in gdbgui.
 */
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

/**
 * The breakpoint table component
 */
const Breakpoint = {
    el: $('#breakpoints'),
    init: function(){
        new Reactor('#breakpoints', Breakpoint.render)

        $("body").on("click", ".toggle_breakpoint_enable", Breakpoint.toggle_breakpoint_enable)
    },
    toggle_breakpoint_enable: function(e){
        if($(e.currentTarget).prop('checked')){
            GdbApi.run_gdb_command([`-break-enable ${e.currentTarget.dataset.breakpoint_num}`, GdbApi.get_break_list_cmd()])
        }else{
            GdbApi.run_gdb_command([`-break-disable ${e.currentTarget.dataset.breakpoint_num}`, GdbApi.get_break_list_cmd()])
        }
    },
    render: function(){
        const MAX_CHARS_TO_SHOW_FROM_SOURCE = 40
        let bkpt_html = ''

        for (let b of state.get('breakpoints')){
            let checked = b.enabled === 'y' ? 'checked' : ''
            , source_line = '(file not cached)'

            // if we have the source file cached, we can display the line of text
            let source_file_obj = SourceCode.get_source_file_obj_from_cache(b.fullname_to_display)
            if(source_file_obj && source_file_obj.source_code && source_file_obj.source_code.length >= (b.line - 1)){
                let syntax_highlighted_line = SourceCode.get_source_file_obj_from_cache(b.fullname_to_display).source_code[b.line - 1]
                , line = _.trim(Util.get_text_from_html(syntax_highlighted_line))

                if(line.length > MAX_CHARS_TO_SHOW_FROM_SOURCE){
                    line = line.slice(0, MAX_CHARS_TO_SHOW_FROM_SOURCE) + '...'
                }
                let escaped_line = Util.escape(line)

                source_line = `
                <span class='monospace' style='white-space: nowrap; font-size: 0.9em;'>
                    ${escaped_line}
                </span>
                <br>`
            }

            let delete_text, info_glyph, function_text, location_text, bkpt_num_to_delete
            if(b.is_child_breakpoint){
                bkpt_num_to_delete = b.parent_breakpoint_number
                info_glyph = `<span class='glyphicon glyphicon-th-list' title='Child breakpoint automatically created from parent. If parent or any child of this tree is deleted, all related breakpoints will be deleted.'></span>`
            }else if(b.is_parent_breakpoint){
                info_glyph = `<span class='glyphicon glyphicon-th-list' title='Parent breakpoint with one or more child breakpoints. If parent or any child of this tree is deleted, all related breakpoints will be deleted.'></span>`
                bkpt_num_to_delete = b.number
            }else{
                bkpt_num_to_delete = b.number
                info_glyph = ''
            }

            delete_text = Breakpoint.get_delete_breakpoint_link(bkpt_num_to_delete,
                `<div style='width: 10px; display: inline;'>
                    <span class='glyphicon glyphicon-trash breakpoint_trashcan'> </span>
                </div>`)

            if(b.is_parent_breakpoint){
                function_text = `
                <span class=placeholder>
                ${info_glyph} parent breakpoint on inline, template, or ambiguous location
                </span>`

                location_text = `
                <span>
                    ${b.fullname_to_display}:${b.line}
                </span>
                `
            }else{
                let func = b.func === undefined ? '(unknown function)' : b.func

                function_text = `
                    <span class=monospace>
                        ${info_glyph} ${func}
                    </span>
                    <span style='color: #bbbbbb; font-style: italic;'>
                        thread groups: ${b['thread-groups']}
                    </span>
                    `
                location_text = `
                    <span>
                        ${b.fullname_to_display}:${b.line}
                    </span>
                    `
            }

            bkpt_html += `
            <div class='breakpoint'>
                <div ${SourceCode.get_attrs_to_view_file(b.fullname_to_display, b.line)}>
                    <table style='width: 100%; font-size: 0.9em; border-width: 1px; border-color: black;' class='lighttext table-condensed'>
                        <tr>
                            <td>
                                ${delete_text}
                                <input type='checkbox' ${checked} class='toggle_breakpoint_enable' data-breakpoint_num='${b.number}'> </input>
                                ${function_text}

                        <tr>
                            <td>
                                ${location_text}

                        <tr>
                            <td>
                                ${source_line}
                    </table>
                </div>
            </div>
            `
        }

        if(bkpt_html === ''){
            bkpt_html = '<span class=placeholder>no breakpoints</span>'
        }
        return bkpt_html
    },
    remove_breakpoint_if_present: function(fullname, line){
        for (let b of state.get('breakpoints')){
            if (b.fullname === fullname && b.line === line){
                let cmd = [GdbApi.get_delete_break_cmd(b.number), GdbApi.get_break_list_cmd()]
                GdbApi.run_gdb_command(cmd)
            }
        }
    },
    get_delete_breakpoint_link: function(breakpoint_number, text='remove'){
        return `<a class="gdb_cmd pointer" data-cmd0="${GdbApi.get_delete_break_cmd(breakpoint_number)}" data-cmd1="${GdbApi.get_break_list_cmd()}">${text}</a>`
    },
    get_breakpoint_lines_for_file: function(fullname){
        return state.get('breakpoints').filter(b => (b.fullname_to_display === fullname) && b.enabled === 'y').map(b => parseInt(b.line))
    },
    get_disabled_breakpoint_lines_for_file: function(fullname){
        return state.get('breakpoints').filter(b => (b.fullname_to_display === fullname) && b.enabled !== 'y').map(b => parseInt(b.line))
    },
    save_breakpoints: function(payload){
        state.set('breakpoints', [])
        if(payload && payload.BreakpointTable && payload.BreakpointTable.body){
            for (let breakpoint of payload.BreakpointTable.body){
                Breakpoint.save_breakpoint(breakpoint)
            }
        }
    },
    save_breakpoint: function(breakpoint){
        let bkpt = $.extend(true, {}, breakpoint)

        bkpt.is_parent_breakpoint = bkpt.addr === '<MULTIPLE>'
        // parent breakpoints have numbers like "5.6", whereas normal breakpoints and parent breakpoints have numbers like "5"
        bkpt.is_child_breakpoint = (parseInt(bkpt.number) !== parseFloat(bkpt.number))
        bkpt.is_normal_breakpoint = (!bkpt.is_parent_breakpoint && !bkpt.is_child_breakpoint)

        if(bkpt.is_child_breakpoint){
            bkpt.parent_breakpoint_number = parseInt(bkpt.number)
        }

        if ('fullname' in breakpoint && breakpoint.fullname){
            // this is a normal/child breakpoint; gdb gives it the fullname
            bkpt.fullname_to_display = breakpoint.fullname
        }else if ('original-location' in breakpoint && breakpoint['original-location']){
            // this breakpoint is the parent breakpoint of multiple other breakpoints. gdb does not give it
            // the fullname field, but rather the "original-location" field.
            // example breakpoint['original-location']: /home/file.h:19
            // so we need to parse out the line number, and store it
            [bkpt.fullname_to_display, bkpt.line] = Util.parse_fullname_and_line(breakpoint['original-location'])
        }else{
            bkpt.fullname_to_display = null
        }

        // add the breakpoint if it's not stored already
        let bkpts = state.get('breakpoints')
        if(bkpts.indexOf(bkpt) === -1){
            bkpts.push(bkpt)
            state.set('breakpoints', bkpts)
        }
        return bkpt
    },
}

/**
 * The source code component
 */
const SourceCode = {
    el_code_container: $('#code_container'),
    el_title: $('#source_code_heading'),
    el_jump_to_line_input: $('#jump_to_line'),
    init: function(){
        new Reactor('#source_code_heading', () => {return `file path: ${state.get('rendered_source_file_fullname')}`})
        new Reactor('#code_table', SourceCode.render, {should_render: SourceCode.should_render, after_render: SourceCode.after_render})

        $("body").on("click", ".srccode td.line_num", SourceCode.click_gutter)
        $("body").on("click", ".view_file", SourceCode.click_view_file)
        $('.fetch_assembly_cur_line').click(SourceCode.fetch_assembly_cur_line)
        $('#refresh_cached_source_files').click(SourceCode.refresh_cached_source_files)
        SourceCode.el_jump_to_line_input.keydown(SourceCode.keydown_jump_to_line)

        window.addEventListener('event_inferior_program_exited', SourceCode.event_inferior_program_exited)
        window.addEventListener('event_inferior_program_running', SourceCode.event_inferior_program_running)
    },
    event_inferior_program_exited: function(e){
        SourceCode.remove_line_highlights()
    },
    event_inferior_program_running: function(e){
        SourceCode.remove_line_highlights()
    },
    click_gutter: function(e){
        let line = e.currentTarget.dataset.line
        if(e.currentTarget.classList.contains('breakpoint') || e.currentTarget.classList.contains('breakpoint_disabled')){
            // clicked gutter with a breakpoint, remove it
            Breakpoint.remove_breakpoint_if_present(state.get('rendered_source_file_fullname'), line)

        }else{
            // clicked with no breakpoint, add it, and list all breakpoints to make sure breakpoint table is up to date
            let fullname = state.get('rendered_source_file_fullname')
            GdbApi.run_gdb_command(GdbApi.get_insert_break_cmd(fullname, line))
        }
    },
    is_cached: function(fullname){
        return state.get('cached_source_files').some(f => f.fullname === fullname)
    },
    get_cached_assembly_for_file: function(fullname){
        for(let file of state.get('cached_source_files')){
            if(file.fullname === fullname){
                return file.assembly
            }
        }
        return []
    },
    refresh_cached_source_files: function(e){
        SourceCode.clear_cached_source_files()
        SourceCode.render()
    },
    clear_cached_source_files: function(){
        state.set('rendered_source_file_fullname', null)
        state.set('cached_source_files', [])
    },
    /**
     * Return html that can be displayed alongside source code
     * @param show_assembly: Boolean
     * @param assembly: Array of assembly data
     * @param line_num: line for which assembly html should be returned
     * @returns two <td> html elements with appropriate assembly code
     */
    get_assembly_html_for_line: function(show_assembly, assembly, line_num, addr){
        let instruction_content = [],
            func_and_addr_content = []

        if(show_assembly && assembly[line_num]){

            let instructions_for_this_line = assembly[line_num]
            for(let i of instructions_for_this_line){
                let cls = (addr === i.address) ? 'current_assembly_command assembly' : 'assembly'
                , addr_link = Memory.make_addrs_into_links(i.address)
                , instruction = Memory.make_addrs_into_links(Util.escape(i.inst))
                , opcodes = i.opcodes ? `(${i.opcodes})` : ''
                instruction_content.push(`
                    <span style="white-space: nowrap;" class='${cls}' data-addr=${i.address}>
                        ${instruction}${opcodes} ${i['func-name']}+${i['offset']} ${addr_link}
                    </span>`)
                // i.e. mov $0x400684,%edi(00) main+8 0x0000000000400585
            }
        }

        return `
        <td valign="top" class='assembly'>
            ${instruction_content.join('<br>')}
        </td>`
    },
    _get_assembly_html: function(cur_addr, i){
        let cls = (cur_addr === i.address) ? 'current_assembly_command assembly' : 'assembly'
        , addr_link = Memory.make_addrs_into_links(i.address)
        , instruction = Memory.make_addrs_into_links(i.inst)

        return `<span style="white-space: nowrap;" class='${cls}' data-addr=${i.address}>
            ${instruction}(${i.opcodes}) ${i['func-name']}+${i['offset']} ${addr_link}
        </span>`
    },
    /**
     * Show modal warning if user is trying to show a file that was modified after the binary was compiled
     */
    show_modal_if_file_modified_after_binary(fullname){
        let obj = SourceCode.get_source_file_obj_from_cache(fullname)
        if(obj && state.get('inferior_binary_path')){
            if((obj.last_modified_unix_sec > state.get('inferior_binary_path_last_modified_unix_sec'))
                    && state.get('warning_shown_for_old_binary') !== true){
                Modal.render('Warning', `A source file was modified <bold>after</bold> the binary was compiled. Recompile the binary, then try again. Otherwise the source code may not
                    match the binary.
                    <p>
                    <p>Source file: ${fullname}, modified ${moment(obj.last_modified_unix_sec * 1000).format(DATE_FORMAT)}
                    <p>Binary: ${state.get('inferior_binary_path')}, modified ${moment(state.get('inferior_binary_path_last_modified_unix_sec') * 1000).format(DATE_FORMAT)}`)
                state.set('warning_shown_for_old_binary', true)
            }
        }
    },
    /**
     * Render a cached source file
     */
    render_cached_source_file: function(fullname, source_code, scroll_to_line=1, addr=undefined){
    },
    make_current_line_visible: function(){
        SourceCode.scroll_to_jq_selector($("#scroll_to_line"))
    },
    set_theme_in_dom: function(){
        let code_container = SourceCode.el_code_container
        , old_theme = code_container.data('theme')
        , current_theme = state.get('current_theme')
        if(state.get('themes').indexOf(current_theme) === -1){
            // somehow an invalid theme got set, update with a valid one
            state.set('current_theme', state.get('themese')[0])
            current_theme = state.get('current_theme')
        }

        if(old_theme !== current_theme){
            code_container.removeClass(old_theme)
            code_container.data('theme', current_theme)
            code_container.addClass(current_theme)
        }
    },
    /**
     * To make rendering efficient, only render the (potentially very large) source file when we need to.
     * Otherwise just update breakpoints and line highlighting through DOM manipluation in "after_render"
     * param reactor: reactor object (see stator.js) tied to DOM node
     */
    should_render: function(reactor){
        SourceCode.set_theme_in_dom()
        let fullname = state.get('fullname_to_render')

        if(fullname === undefined || state.get('missing_files').indexOf(fullname) !== -1){
            // don't try to be super efficient when rendering disassembly. It's not that large, and the logic
            // to determine this accurately is difficult.
            return true
        }

        if(fullname === state.get('rendered_source_file_fullname')){
            // we already rendered this file, but if we have new assembly, it should update
            return state.get('has_unrendered_assembly')
        }
        // rendering a different source file, it should update
        return true
    },
    render: function(reactor){

        let anon_file_source = state.get('disassembly_for_missing_file')
        , addr = state.get('current_assembly_address')
        , fullname = state.get('fullname_to_render')
        , current_line_of_source_code = parseInt(state.get('current_line_of_source_code'))

        if(fullname === null){
            state.set('rendered_source_file_fullname', null)
            return ''

        }else if(!SourceCode.is_cached(state.get('fullname_to_render'))){
            // if file is not missing or undefined, continue
            let source_file_does_not_exist = fullname === undefined || state.get('missing_files').indexOf(fullname) !== -1
            , assembly_is_cached_for_this_addr = anon_file_source.some(obj => obj.address === addr)
            if(source_file_does_not_exist){
                if(!assembly_is_cached_for_this_addr){
                    if(addr === undefined){
                        return 'stopped on unknown address'
                    }
                    SourceCode.fetch_disassembly_for_missing_file(parseInt(addr))
                    return 'fetching assembly'
                }
            }else{
                // source file *might* exist. Try to fetch it. If it exists, this render function will be called again
                // and either the source will be displayed (if it exists), or the assembly will be fetched.
                let file_to_fetch = state.get('fullname_to_render')
                SourceCode.fetch_file(state.get('fullname_to_render'))
                state.set('rendered_source_file_fullname', null)
                return 'fetching file ' + file_to_fetch
            }
        }

        let f = _.find(state.get('cached_source_files'), i => i.fullname === fullname)
        let source_code
        if(f){
            source_code = f.source_code
        }else{
            let anon_file_source = state.get('disassembly_for_missing_file')
            if(anon_file_source){
                source_code = anon_file_source.map(i => SourceCode._get_assembly_html(addr, i))
            }else{
                // this shouldn't be possible
                return 'no source code, no assembly'
            }
        }

        // make sure desired line is within number of lines of source code
        if(current_line_of_source_code > source_code.length){
            SourceCode.el_jump_to_line_input.val(source_code.length)
            state.set('current_line_of_source_code', source_code.length)
        }else if (current_line_of_source_code < 0){
            SourceCode.el_jump_to_line_input.val(0)
            state.set('current_line_of_source_code', 0)
        }

        SourceCode.show_modal_if_file_modified_after_binary(fullname)

        let assembly = SourceCode.get_cached_assembly_for_file(fullname)
            , line_num = 1
            , tbody = []

        for (let line of source_code){
            let assembly_for_line = SourceCode.get_assembly_html_for_line(true, assembly, line_num, addr)

            tbody.push(`
                <tr class='srccode'>
                    <td valign="top" class='line_num' data-line=${line_num} style='width: 30px;'>
                        <div>${line_num}</div>
                    </td>

                    <td valign="top" class='loc' data-line=${line_num}>
                        <span class='wsp'>${line}</span>
                    </td>

                    ${assembly_for_line}
                </tr>
                `)
            line_num++;
        }

        state.set('rendered_source_file_fullname', fullname)
        state.set('make_current_line_visible', true)
        return tbody.join('')
    },
    after_render: function(reactor){
        let fullname = state.get('fullname_to_render')
        if(fullname && state.get('missing_files').indexOf(fullname) === -1){
            SourceCode.render_breakpoints()
            SourceCode.highlight_paused_line()
            if(state.get('make_current_line_visible')){
                SourceCode.make_current_line_visible()
            }
        }
        state.set('make_current_line_visible', false)
        state.set('has_unrendered_assembly', false)
    },
    // re-render breakpoints on whichever file is loaded
    render_breakpoints: function(){
        document.querySelectorAll('.line_num.breakpoint').forEach(el => el.classList.remove('breakpoint'))
        document.querySelectorAll('.line_num.disabled_breakpoint').forEach(el => el.classList.remove('disabled_breakpoint'))
        if(_.isString(state.get('rendered_source_file_fullname'))){

            let bkpt_lines = Breakpoint.get_breakpoint_lines_for_file(state.get('rendered_source_file_fullname'))
            , disabled_breakpoint_lines = Breakpoint.get_disabled_breakpoint_lines_for_file(state.get('rendered_source_file_fullname'))

            for(let bkpt_line of bkpt_lines){
                let js_line = $(`td.line_num[data-line=${bkpt_line}]`)[0]
                if(js_line){
                    $(js_line).addClass('breakpoint')
                }
            }

            for(let bkpt_line of disabled_breakpoint_lines){
                let js_line = $(`td.line_num[data-line=${bkpt_line}]`)[0]
                if(js_line){
                    $(js_line).addClass('disabled_breakpoint')
                }
            }
        }
    },
    /**
     * Scroll to a jQuery selection in the source code table
     * Used to jump around to various lines
     */
    scroll_to_jq_selector: function(jq_selector){
        if (jq_selector.length === 1){  // make sure something is selected before trying to scroll to it
            let top_of_container = SourceCode.el_code_container.position().top,
                height_of_container = SourceCode.el_code_container.height(),
                bottom_of_container = top_of_container + height_of_container,
                top_of_line = jq_selector.position().top,
                bottom_of_line = top_of_line+ jq_selector.height(),
                top_of_table = jq_selector.closest('table').position().top

            if ((top_of_line >= top_of_container) && (bottom_of_line < (bottom_of_container))){
                // do nothing, it's already in view
            }else{
                // line is out of view, scroll so it's in the middle of the table
                const time_to_scroll = 0
                SourceCode.el_code_container.animate({'scrollTop': top_of_line - (top_of_table + height_of_container/2)}, time_to_scroll)
            }
        }else{
            // nothing to scroll to
        }
    },
    /**
     * Current line has an id in the DOM and a variable
     * Remove the id and highlighting in the DOM, and set the
     * variable to null
     */
    remove_line_highlights: function(){
        $('#scroll_to_line').removeAttr('id')
        document.querySelectorAll('.flash').forEach(el => el.classList.remove('flash'))
        document.querySelectorAll('.current_assembly_command').forEach(el => el.classList.remove('current_assembly_command'))
        document.querySelectorAll('.paused_on_line').forEach(el => el.classList.remove('paused_on_line'))
    },
    highlight_paused_line: function(){
        SourceCode.remove_line_highlights()

        let fullname = state.get('rendered_source_file_fullname')
        , line_num = state.get('current_line_of_source_code')
        , addr = state.get('current_assembly_address')
        , inferior_program_is_paused_in_this_file = _.isObject(state.get('paused_on_frame')) && state.get('paused_on_frame').fullname === fullname
        , paused_on_current_line = (inferior_program_is_paused_in_this_file && parseInt(state.get('paused_on_frame').line) === parseInt(line_num))

        // make background blue if gdb is paused on a line in this file
        if(inferior_program_is_paused_in_this_file){
            let jq_line = $(`.loc[data-line=${state.get('paused_on_frame').line}]`)
            if(jq_line.length === 1){
                jq_line.offset()  // needed so DOM registers change and re-draws animation
                jq_line.addClass('paused_on_line')
                if(paused_on_current_line){
                    jq_line.attr('id', 'scroll_to_line')
                }
            }
        }

        // make this line flash ONLY if it's NOT the line we're paused on
        if(line_num && !paused_on_current_line){
            let jq_line = $(`.loc[data-line=${line_num}]`)
            if(jq_line.length === 1){
                // https://css-tricks.com/restart-css-animation/
                jq_line.offset()  // needed so DOM registers change and re-draws animation
                jq_line.addClass('flash')
                jq_line.attr('id', 'scroll_to_line')
            }
        }

        if(addr){
            // find element with assembly class and data-addr as the desired address, and
            // current_assembly_command class
            let jq_assembly = $(`.assembly[data-addr=${addr}]`)
            if(jq_assembly.length === 1){
                jq_assembly.addClass('current_assembly_command')
            }
        }
    },
    fetch_file: function(fullname){
        if(state.get('missing_files').indexOf(fullname) !== -1){
            // file doesn't exist and we already know about it
            // don't keep trying to fetch disassembly
            return
        }

        if(!_.isString(fullname) || !fullname.startsWith('/')){
            // this can happen when an executable doesn't have debug symbols.
            // don't try to fetch it because it will never exist.
            return
        }else if(state.get('files_being_fetched').indexOf(fullname) === -1){
            let files = state.get('files_being_fetched')
            files.push(fullname)
            state.set('files_being_fetched', files)
        }else{
            // this file is already being fetched
            return
        }

        $.ajax({
            url: "/read_file",
            cache: false,
            type: 'GET',
            data: {path: fullname, highlight: state.get('highlight_source_code')},
            success: function(response){
                SourceCode.add_source_file_to_cache(fullname, response.source_code, {}, response.last_modified_unix_sec)
            },
            error: function(response){
                StatusBar.render_ajax_error_msg(response)

                let missing_files = state.get('missing_files')
                missing_files.push(fullname)
                state.set('missing_files', missing_files)

                let source_code = [`failed to fetch file at path "${fullname}"`,
                'will display the disassembly here if possible',
                'view disassembly dump in console by typing "disassembly"']
            },
            complete: function(){
                let files = state.get('files_being_fetched')
                state.set('files_being_fetched', _.without(files, fullname))
            }
        })
    },
    add_source_file_to_cache: function(fullname, source_code, assembly, last_modified_unix_sec, exists=true){
        let new_source_file = {'fullname': fullname,
                                'source_code': source_code,
                                'assembly': assembly,
                                'last_modified_unix_sec': last_modified_unix_sec,
                                'exists': exists,
                            }
        , cached_source_files = state.get('cached_source_files')
        cached_source_files.push(new_source_file)
        state.set('cached_source_files', cached_source_files)
    },
    get_source_file_obj_from_cache(fullname){
        for(let sf of state.get('cached_source_files')){
            if (sf.fullname === fullname){
                return sf
            }
        }
        return null
    },
    /**
     * gdb changed its api for the data-disassemble command
     * see https://www.sourceware.org/gdb/onlinedocs/gdb/GDB_002fMI-Data-Manipulation.html
     * TODO not sure which version this change occured in. I know in 7.7 it needs the '3' option,
     * and in 7.11 it needs the '4' option. I should test the various version at some point.
     */
    get_dissasembly_format_num: function(gdb_version_array){
        if(gdb_version_array.length === 0){
            // assuming new version, but we shouldn't ever not know the version...
            return 4

        } else if (gdb_version_array[0] < 7 || (parseInt(gdb_version_array[0]) === 7 && gdb_version_array[1] <= 7)){
            // this option has been deprecated in newer versions, but is required in older ones
            return 3
        }else{
            return 4
        }
    },
    get_fetch_disassembly_command: function(fullname, start_line){
        let mi_response_format = SourceCode.get_dissasembly_format_num(state.get('gdb_version_array'))
        if(_.isString(fullname) && fullname.startsWith('/')){
            if(state.get('interpreter') === 'gdb'){
                return `-data-disassemble -f ${fullname} -l ${start_line} -n 100 -- ${mi_response_format}`
            }else{
                console.log('TODOLLDB - get mi command to disassemble')
                return `disassemble --frame`
            }
        }else{
            console.warn('not fetching undefined file')
        }
    },
    /**
     * Fetch disassembly for current file/line.
     */
    fetch_assembly_cur_line: function(e){
        let fullname = state.get('fullname_to_render')
        , line = parseInt(state.get('current_line_of_source_code'))
        SourceCode.fetch_disassembly(fullname, line)
    },
    fetch_disassembly: function(fullname, start_line){
        let cmd = SourceCode.get_fetch_disassembly_command(fullname, start_line)
        if(cmd){
           GdbApi.run_gdb_command(cmd)
        }
    },
    fetch_disassembly_for_missing_file: function(hex_addr){
        let mi_response_format = SourceCode.get_dissasembly_format_num(state.get('gdb_version_array'))
        // https://sourceware.org/gdb/onlinedocs/gdb/GDB_002fMI-Data-Manipulation.html
        if(window.isNaN(hex_addr)){
            return
        }

        let start = hex_addr
        , end = hex_addr + 100
        GdbApi.run_gdb_command(DISASSEMBLY_FOR_MISSING_FILE_STR + `-data-disassemble -s 0x${start.toString((16))} -e 0x${end.toString((16))} -- 0`)
    },
    /**
     * Save assembly and render source code if desired
     * @param mi_assembly: array of assembly instructions
     * @param mi_token (int): corresponds to either null (when src file is known and exists),
     *  DISASSEMBLY_FOR_MISSING_FILE_INT when source file is undefined or does not exist on filesystem
     */
    save_new_assembly: function(mi_assembly, mi_token){
        if(!_.isArray(mi_assembly) || mi_assembly.length === 0){
            console.error('Attempted to save unexpected assembly', mi_assembly)
        }

        let fullname = mi_assembly[0].fullname
        if(mi_token === DISASSEMBLY_FOR_MISSING_FILE_INT){
            state.set('disassembly_for_missing_file', mi_assembly)
            state.set('has_unrendered_assembly', true)
            return
        }

        // convert assembly to an object, with key corresponding to line numbers
        // and values corresponding to asm instructions for that line
        let assembly_to_save = {}
        for(let obj of mi_assembly){
            assembly_to_save[parseInt(obj.line)] = obj.line_asm_insn
        }

        let cached_source_files = state.get('cached_source_files')
        for (let cached_file of cached_source_files){
            if(cached_file.fullname === fullname){
                cached_file.assembly = $.extend(true, cached_file.assembly, assembly_to_save)

                let max_assm_line = Math.max(Object.keys(cached_file.assembly))

                if(max_assm_line > cached_file.source_code.length){
                    cached_file.source_code[max_assm_line] = ''
                    for(let i = 0; i < max_assm_line; i++){
                        if(!cached_file.source_code[i]){
                            cached_file.source_code[i] = ''
                        }
                    }
                }
                state.set('cached_source_files', cached_source_files)
                break
            }
        }
        state.set('has_unrendered_assembly', true)
    },
    /**
     * Something in DOM triggered this callback to view a file.
     * The current target must have data embedded in it with:
     * fullname: full path of source code file to view
     * line (optional): line number to scroll to
     * addr (optional): instruction address to highlight
     */
    click_view_file: function(e){
        state.set('fullname_to_render', e.currentTarget.dataset['fullname'])
        state.set('current_line_of_source_code', parseInt(e.currentTarget.dataset['line']))
        state.set('make_current_line_visible', true)
    },
    keydown_jump_to_line: function(e){
        if (e.keyCode === ENTER_BUTTON_NUM){
            let line = parseInt(e.currentTarget.value)
            state.set('current_line_of_source_code', line)
            state.set('make_current_line_visible', true)
        }
    },
    get_attrs_to_view_file: function(fullname, line=0){
        return `class='view_file pointer' data-fullname=${fullname} data-line=${line}`
    },
}

/**
 * The autocomplete dropdown of source files is complicated enough
 * to have its own component. It uses the awesomeplete library,
 * which is really nice: https://leaverou.github.io/awesomplete/
 */
const SourceFileAutocomplete = {
    el: $('#source_file_input'),
    init: function(){
        state.subscribe(SourceFileAutocomplete.render)

        SourceFileAutocomplete.el.keyup(SourceFileAutocomplete.keyup_source_file_input)

        // initialize list of source files
        SourceFileAutocomplete.input = new Awesomplete('#source_file_input', {
            minChars: 0,
            maxItems: 10000,
            list: [],
            // standard sort algorithm (the default Awesomeplete sort is weird)
            sort: (a, b) => {return a < b ? -1 : 1;}
        })

        // when dropdown button is clicked, toggle showing/hiding it
        Awesomplete.$('#source_file_dropdown_button').addEventListener("click", function() {

            if(state.get('source_file_paths').length === 0){
                // we have not asked gdb to get the list of source paths yet, or it just doesn't have any.
                // request that gdb populate this list.
                SourceFileAutocomplete.fetch_source_files()
                return
            }

            if (SourceFileAutocomplete.input.ul.childNodes.length === 0) {
                SourceFileAutocomplete.input.evaluate()
            }
            else if (SourceFileAutocomplete.input.ul.hasAttribute('hidden')) {
                SourceFileAutocomplete.input.open()
            }
            else {
                SourceFileAutocomplete.input.close()
            }
        })

        // perform action when an item is selected
         Awesomplete.$('#source_file_input').addEventListener('awesomplete-selectcomplete', function(e){
            let fullname = e.currentTarget.value
            state.set('fullname_to_render', fullname)
            state.set('current_line_of_source_code', 1)
            state.set('make_current_line_visible', true)
        })
    },
    fetch_source_files: function(){
        state.set('source_file_paths', [`${ANIMATED_REFRESH_ICON} fetching source files for inferior program`])
        GdbApi.run_gdb_command('-file-list-exec-source-files')
    },
    render: function(e){
        if(!_.isEqual(SourceFileAutocomplete.input._list, state.get('source_file_paths'))){
            SourceFileAutocomplete.input.list = state.get('source_file_paths')
            SourceFileAutocomplete.input.evaluate()
        }
    },
    keyup_source_file_input: function(e){
        if (e.keyCode === ENTER_BUTTON_NUM){
            let user_input = _.trim(e.currentTarget.value)

            if(user_input.length === 0){
                return
            }

            let fullname
            , default_line = 0
            , line

            [fullname, line] = Util.parse_fullname_and_line(user_input, default_line)

            state.set('fullname_to_render',fullname)
            state.set('current_line_of_source_code', line)
            state.set('make_current_line_visible', true)
        }else if (state.get('source_file_paths').length === 0){
            // source file list has not been fetched yet, so fetch it
            SourceFileAutocomplete.fetch_source_files()
        }
    }
}

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
        if(!state.get('fetch_registers')){
            return []
        }

        let cmds = []
        if(state.get('can_fetch_register_values') === true){
            if(state.get('register_names').length === 0){
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
        state.set('register_names', names.filter(name => name))
    },
    clear_cached_values: function(){
        state.set('previous_register_values', {})
        state.set('current_register_values', {})
    },
    event_inferior_program_exited: function(){
        Registers.clear_cached_values()
    },
    event_inferior_program_running: function(){
        // Registers.render_not_paused()
    },
    render: function(){
        if(state.get('register_names').length === Object.keys(state.get('current_register_values')).length){
            let columns = ['name', 'value (hex)', 'value (decimal)']
            , register_table_data = []
            , hex_val_raw = ''

            for (let i in state.get('register_names')){
                let name = state.get('register_names')[i]
                    , obj = _.find(state.get('current_register_values'), v => v['number'] === i)
                    , hex_val_raw = ''
                    , disp_hex_val = ''
                    , disp_dec_val = ''

                if (obj){
                    hex_val_raw = obj['value']

                    let old_obj = _.find(state.get('previous_register_values'), v => v['number'] === i)
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

/**
 * Settings modal when clicking the gear icon
 */
const Settings = {
    el: $('#gdbgui_settings_button'),
    pane: $('#settings_container'),
    init: function(){
        new Reactor('#settings_body', Settings.render)

        $('body').on('change', '#theme_selector', Settings.theme_selection_changed)
        $('body').on('change', '#syntax_highlight_selector', Settings.syntax_highlight_selector_changed)
        $('body').on('change', '#checkbox_auto_add_breakpoint_to_main', Settings.checkbox_auto_add_breakpoint_to_main_changed)
        $('body').on('change', '#pretty_print', Settings.update_state_from_checkbox_and_id)  // id must match existing key in state
        $('body').on('change', '#refresh_state_after_sending_console_command', Settings.update_state_from_checkbox_and_id)  // id must match existing key in state
        $('body').on('change', '#show_all_sent_commands_in_console', Settings.update_state_from_checkbox_and_id)  // id must match existing key in state
        $('body').on('click', '.toggle_settings_view', Settings.click_toggle_settings_view)


        // Fetch the latest version only if using in normal mode. If debugging, we tend to
        // refresh quite a bit, which might make too many requests to github and cause them
        // to block our ip? Either way it just seems weird to make so many ajax requests.
        if(!state.get('debug')){
            // fetch version
            $.ajax({
                url: "https://raw.githubusercontent.com/cs01/gdbgui/master/gdbgui/VERSION.txt",
                cache: false,
                method: 'GET',
                success: (data) => {
                    state.set('latest_gdbgui_version', _.trim(data))

                    if(Settings.needs_to_update_gdbgui_version() && state.get('show_gdbgui_upgrades')){
                        Modal.render(`Update Available`, Settings.get_upgrade_text())
                    }
                },
                error: (data) => {state.set('latest_gdbgui_version', '(could not contact server)')},
            })
        }
    },
    needs_to_update_gdbgui_version: function(){
        return state.get('latest_gdbgui_version') !== state.get('gdbgui_version')
    },
    get_upgrade_text: function(){
        if(Settings.needs_to_update_gdbgui_version()){
            return `gdbgui version ${state.get('latest_gdbgui_version')} is available. You are using ${state.get('gdbgui_version')}. <p><p>
            To upgrade:<p>
            Linux: <br>
            <span class='monospace bold'>sudo pip install gdbgui --upgrade</span><p>
            macOS:<br>
            <span class='monospace bold'>sudo pip install gdbgui --upgrade --user</span><p>
            virtualenv users do not need the "sudo" prefix.
            `
        }else{
            return `gdbgui version ${state.get('gdbgui_version')} (latest version)`
        }
    },
    render: function(){
        let theme_options = ''
        , current_theme = state.get('current_theme')

        for(let theme of state.get('themes')){
            if(theme === current_theme){
                theme_options += `<option selected value=${theme}>${theme}</option>`
            }else{
                theme_options += `<option value=${theme}>${theme}</option>`
            }
        }

        return `<table class='table table-condensed'>
            <tbody>
            <tr><td>
                <div class=checkbox>
                    <label>
                        <input id=checkbox_auto_add_breakpoint_to_main type='checkbox' ${state.get('auto_add_breakpoint_to_main') ? 'checked' : ''}>
                        Auto add breakpoint to main
                    </label>
                </div>

            <tr><td>
                <div class=checkbox>
                    <label>
                        <input id=pretty_print type='checkbox' ${state.get('pretty_print') ? 'checked' : ''}>
                        Pretty print dynamic variables (shows human readable values rather than internal methods)
                    </label>
                </div>

            <tr><td>
                <div class=checkbox>
                    <label>
                        <input id=refresh_state_after_sending_console_command type='checkbox' ${state.get('refresh_state_after_sending_console_command') ? 'checked' : ''}>
                        Refresh state after sending command from the console widget
                    </label>
                </div>


            <tr><td>
                <div class=checkbox>
                    <label>
                        <input id=show_all_sent_commands_in_console type='checkbox' ${state.get('show_all_sent_commands_in_console') ? 'checked' : ''}>
                        Show all sent commands in console
                    </label>
                </div>

            <tr><td>
                Theme: <select id=theme_selector>${theme_options}</select>

            <tr><td>
                Syntax Highlighting:
                    <select id=syntax_highlight_selector>
                        <option value='on' ${state.get('highlight_source_code') === true ? 'selected' : ''} >on</option>
                        <option value='off' ${state.get('highlight_source_code') === false ? 'selected' : ''} >off</option>
                    </select>
                     (better performance for large files when off)

            <tr><td>
                gdb version: ${state.get('gdb_version')}

            <tr><td>
                gdb pid for this tab: ${state.get('gdb_pid')}

            <tr><td>
                ${Settings.get_upgrade_text()}

            <tr><td>
            a <a href='http://grassfedcode.com'>grassfedcode</a> project | <a href=https://github.com/cs01/gdbgui>github</a> | <a href=https://pypi.python.org/pypi/gdbgui>pyPI</a>
            |  <a href='https://www.amazon.com/?&_encoding=UTF8&tag=grassfedcode04-20'>shop amazon to support gdbgui</a>
            `
    },
    click_toggle_settings_view: function(e){
        if(e.target.classList.contains('toggle_settings_view')){  // need this check in case background div has this class
            e.stopPropagation()  // need this to prevent toggling twice rapidly if a toggle button is over a div
            Settings.pane.toggleClass('hidden')
            $('main').toggleClass('blur')
        }
    },
    theme_selection_changed: function(e){
        state.set('current_theme', e.currentTarget.value)
        localStorage.setItem('theme', e.currentTarget.value)
    },
    syntax_highlight_selector_changed: function(e){
        // update preference in state
        state.set('highlight_source_code', e.currentTarget.value === 'on')
        // remove all cached source files, since the cache contains syntax highlighting, or is lacking it
        state.set('cached_source_files', [])
        state.set('rendered_source_file_fullname', null)
        // save preference for later
        localStorage.setItem('highlight_source_code', JSON.stringify(state.get('highlight_source_code')))
    },
    checkbox_auto_add_breakpoint_to_main_changed: function(){
        let checked = $('#checkbox_auto_add_breakpoint_to_main').prop('checked')
        state.set('auto_add_breakpoint_to_main', checked)
        localStorage.setItem('auto_add_breakpoint_to_main', JSON.stringify(state.get('auto_add_breakpoint_to_main')))
    },
    update_state_from_checkbox_and_id: function(e){
        let key = e.target.id  // must be an existing key in state
        , checked = e.target.checked
        state.set(key, checked)
    },
}

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
        if(e.keyCode === ENTER_BUTTON_NUM) {
            BinaryLoader.set_target_app()
        }
    },
    render_past_binary_options_datalist: function(){
        BinaryLoader.el_past_binaries.html(BinaryLoader.past_binaries.map(b => `<option>${b}</option`))
    },
    click_set_target_app: function(e){
        BinaryLoader.set_target_app()
    },
    /**
     * Set the target application and arguments based on the
     * current fields in the DOM
     */
    set_target_app: function(){
        var binary_and_args = _.trim(BinaryLoader.el.val())

        if (_.trim(binary_and_args) === ''){
            StatusBar.render('enter a binary path and arguments', true)
            return
        }

        // save to list of binaries used that autopopulates the input dropdown
        _.remove(BinaryLoader.past_binaries, i => i === binary_and_args)
        BinaryLoader.past_binaries.unshift(binary_and_args)
        localStorage.setItem('past_binaries', JSON.stringify(BinaryLoader.past_binaries) || [])
        BinaryLoader.render_past_binary_options_datalist()

        // remove list of source files associated with the loaded binary since we're loading a new one
        state.set('source_file_paths', [])
        state.set('language', 'c_family')

        // find the binary and arguments so gdb can be told which is which
        let binary, args, cmds
        let index_of_first_space = binary_and_args.indexOf(' ')
        if( index_of_first_space === -1){
            binary = binary_and_args
            args = ''
        }else{
            binary = binary_and_args.slice(0, index_of_first_space)
            args = binary_and_args.slice(index_of_first_space + 1, binary_and_args.length)
        }

        // tell gdb which arguments to use when calling the binary, before loading the binary
        cmds = [
                `-exec-arguments ${args}`, // Set the inferior program arguments, to be used in the next `-exec-run`
                `-file-exec-and-symbols ${binary}`,  // Specify the executable file to be debugged. This file is the one from which the symbol table is also read.
                ]

        // add breakpoint if we don't already have one
        if(state.get('auto_add_breakpoint_to_main')){
            cmds.push('-break-insert main')
        }
        cmds.push(GdbApi.get_break_list_cmd())

        window.dispatchEvent(new Event('event_inferior_program_exited'))
        GdbApi.run_gdb_command(cmds)

        state.set('inferior_binary_path', binary)
        GdbApi.get_inferior_binary_last_modified_unix_sec(binary)
    },
    render: function(binary){
        BinaryLoader.el.val(binary)
    },
}

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
        if(e.keyCode === ENTER_BUTTON_NUM) {
            GdbCommandInput.cmd_index = 0
            GdbCommandInput.run_current_command()
            //reset cache-cmd index
        } else if (e.keyCode === UP_BUTTON_NUM || e.keyCode === DOWN_BUTTON_NUM) {
            let desired_index = e.keyCode === UP_BUTTON_NUM ? GdbCommandInput.cmd_index +1 : GdbCommandInput.cmd_index -1
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
        if(state.get('refresh_state_after_sending_console_command')){
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

/**
 * The Memory component allows the user to view
 * data stored at memory locations
 */
const Memory = {
    el: $('#memory'),
    el_start: $('#memory_start_address'),
    el_end: $('#memory_end_address'),
    el_bytes_per_line: $('#memory_bytes_per_line'),
    MAX_ADDRESS_DELTA_BYTES: 1000,
    DEFAULT_ADDRESS_DELTA_BYTES: 31,
    init: function(){
        new Reactor('#memory', Memory.render)

        $("body").on("click", ".memory_address", Memory.click_memory_address)
        $("body").on("click", "#read_preceding_memory", Memory.click_read_preceding_memory)
        $("body").on("click", "#read_more_memory", Memory.click_read_more_memory)
        Memory.el_start.keydown(Memory.keydown_in_memory_inputs)
        Memory.el_end.keydown(Memory.keydown_in_memory_inputs)
        Memory.el_bytes_per_line.keydown(Memory.keydown_in_memory_inputs)

        window.addEventListener('event_inferior_program_exited', Memory.event_inferior_program_exited)
        window.addEventListener('event_inferior_program_running', Memory.event_inferior_program_running)
        window.addEventListener('event_inferior_program_paused', Memory.event_inferior_program_paused)
    },
    keydown_in_memory_inputs: function(e){
        if (e.keyCode === ENTER_BUTTON_NUM){
            Memory.fetch_memory_from_inputs()
        }
    },
    click_memory_address: function(e){
        e.stopPropagation()

        let addr = e.currentTarget.dataset['memory_address']
        // set inputs in DOM
        Memory.el_start.val('0x' + (parseInt(addr, 16)).toString(16))
        Memory.el_end.val('0x' + (parseInt(addr,16) + Memory.DEFAULT_ADDRESS_DELTA_BYTES).toString(16))

        // fetch memory from whatever's in DOM
        Memory.fetch_memory_from_inputs()
    },
    get_gdb_commands_from_inputs: function(){
        let start_addr = parseInt(_.trim(Memory.el_start.val()), 16),
            end_addr = parseInt(_.trim(Memory.el_end.val()), 16)

        if(!window.isNaN(start_addr) && window.isNaN(end_addr)){
            end_addr = start_addr + Memory.DEFAULT_ADDRESS_DELTA_BYTES
        }

        let cmds = []
        if(_.isInteger(start_addr) && end_addr){
            if(start_addr > end_addr){
                end_addr = start_addr + Memory.DEFAULT_ADDRESS_DELTA_BYTES
                Memory.el_end.val('0x' + end_addr.toString(16))
            }else if((end_addr - start_addr) > Memory.MAX_ADDRESS_DELTA_BYTES){
                end_addr = start_addr + Memory.MAX_ADDRESS_DELTA_BYTES
                Memory.el_end.val('0x' + end_addr.toString(16))
            }

            let cur_addr = start_addr
            while(cur_addr <= end_addr){
                cmds.push(`-data-read-memory-bytes ${'0x' + cur_addr.toString(16)} 1`)
                cur_addr = cur_addr + 1
            }
        }

        if(!window.isNaN(start_addr)){
            Memory.el_start.val('0x' + start_addr.toString(16))
        }
        if(!window.isNaN(end_addr)){
            Memory.el_end.val('0x' + end_addr.toString(16))
        }

        return cmds
    },
    fetch_memory_from_inputs: function(){
        let cmds = Memory.get_gdb_commands_from_inputs()
        Memory.clear_cache()
        GdbApi.run_gdb_command(cmds)
    },
    click_read_preceding_memory: function(){
        // update starting value, then re-fetch
        let NUM_ROWS = 3
        let start_addr = parseInt(_.trim(Memory.el_start.val()), 16)
        , byte_offset = Memory.el_bytes_per_line.val() * NUM_ROWS
        Memory.el_start.val('0x' + (start_addr - byte_offset).toString(16))
        Memory.fetch_memory_from_inputs()
    },
    click_read_more_memory: function(){
        // update ending value, then re-fetch
        let NUM_ROWS = 3
        let end_addr = parseInt(_.trim(Memory.el_end.val()), 16)
        , byte_offset = Memory.el_bytes_per_line.val() * NUM_ROWS
        Memory.el_end.val('0x' + (end_addr + byte_offset).toString(16))
        Memory.fetch_memory_from_inputs()
    },
    /**
     * Internal render function. Not called directly to avoid wasting DOM cycles
     * when memory is being received from gdb at a high rate.
     */
    render: function(){
        if(_.keys(state.get('memory_cache')).length === 0){
            return '<span class=placeholder>no memory to display</span>'
        }

        let data = []
        , hex_vals_for_this_addr = []
        , char_vals_for_this_addr = []
        , i = 0
        , hex_addr_to_display = null

        let bytes_per_line = (parseInt(Memory.el_bytes_per_line.val())) || 8
        bytes_per_line = Math.max(bytes_per_line, 1)
        $('#memory_bytes_per_line').val(bytes_per_line)

        if(Object.keys(state.get('memory_cache')).length > 0){
            data.push(['<span id=read_preceding_memory class=pointer style="font-style:italic; font-size: 0.8em;">more</span>',
                        '',
                        '']
            )
        }

        for (let hex_addr in state.get('memory_cache')){
            if(!hex_addr_to_display){
                hex_addr_to_display = hex_addr
            }

            if(i % (bytes_per_line) === 0 && hex_vals_for_this_addr.length > 0){
                // begin new row
                data.push([Memory.make_addrs_into_links(hex_addr_to_display),
                    hex_vals_for_this_addr.join(' '),
                    char_vals_for_this_addr.join(' ')])

                // update which address we're collecting values for
                i = 0
                hex_addr_to_display = hex_addr
                hex_vals_for_this_addr = []
                char_vals_for_this_addr = []

            }
            let hex_value = state.get('memory_cache')[hex_addr]
            hex_vals_for_this_addr.push(hex_value)
            let char = String.fromCharCode(parseInt(hex_value, 16)).replace(/\W/g, '.')
            char_vals_for_this_addr.push(`<span class='memory_char'>${char}</span>`)
            i++

        }

        if(hex_vals_for_this_addr.length > 0){
            // memory range requested wasn't divisible by bytes per line
            // add the remaining memory
            data.push([Memory.make_addrs_into_links(hex_addr_to_display),
                    hex_vals_for_this_addr.join(' '),
                    char_vals_for_this_addr.join(' ')])

        }

        if(Object.keys(state.get('memory_cache')).length > 0){
            data.push(['<span id=read_more_memory class=pointer style="font-style:italic; font-size: 0.8em;">more</span>',
                        '',
                        '']
            )
        }

        let table = Util.get_table(['address', 'hex' , 'char'], data)
        return table
    },
    _make_addr_into_link: function(addr, name=addr){
        let _addr = addr
            , _name = name
        return `<a class='pointer memory_address' data-memory_address='${_addr}'>${_name}</a>`
    },
    /**
     * Scan arbitrary text for addresses, and turn those addresses into links
     * that can be clicked in gdbgui
     */
    make_addrs_into_links: function(text, name=undefined){
        return text.replace(/(0x[\d\w]+)/g, Memory._make_addr_into_link('$1', name))
    },
    add_value_to_cache: function(hex_str, hex_val){
        // strip leading zeros off address provided by gdb
        // i.e. 0x000123 turns to
        // 0x123
        let hex_str_truncated = '0x' + (parseInt(hex_str, 16)).toString(16)
        let cache = state.get('memory_cache')
        cache[hex_str_truncated] = hex_val
        state.set('memory_cache', cache)
    },
    clear_cache: function(){
        state.set('memory_cache', {})
    },
    event_inferior_program_exited: function(){
        Memory.clear_cache()
    },
    event_inferior_program_running: function(){
        Memory.clear_cache()
    },
    event_inferior_program_paused: function(){
        // Memory.render()
    },
}

/**
 * The Expressions component allows the user to inspect expressions
 * stored as variables in gdb
 * see https://sourceware.org/gdb/onlinedocs/gdb/GDB_002fMI-Variable-Objects.html#GDB_002fMI-Variable-Objects
 *
 * gdb assigns a unique variable name for each expression the user wants evaluated
 * gdb returns
 */
const Expressions = {
    el: $('#expressions'),
    el_input: $('#expressions_input'),
    init: function(){
        // create new var when enter is pressed
        Expressions.el_input.keydown(Expressions.keydown_on_input)

        new Reactor('#expressions', Expressions.render, {after_render: Expressions.after_render})

        // remove var when icon is clicked
        $("body").on("click", ".delete_gdb_variable", Expressions.click_delete_gdb_variable)
        $("body").on("click", ".toggle_children_visibility", Expressions.click_toggle_children_visibility)
        $("body").on("click", ".toggle_plot", Expressions.click_toggle_plot)
    },
    /**
     * Locally save the variable to our cached variables
     */
    save_new_expression: function(expression, expr_type, obj){
        let new_obj = Expressions.prepare_gdb_obj_for_storage(obj, expr_type)
        new_obj.expression = expression
        let expressions = state.get('expressions')
        expressions.push(new_obj)
        state.set('expressions', expressions)
    },
    /**
     * Get child variable with a particular name
     */
    get_child_with_name: function(children, name){
        for(let child of children){
            if(child.name === name){
                return child
            }
        }
        return undefined
    },
    /**
     * Get object from gdb variable name. gdb variable names are unique, and don't match
     * the expression being evaluated. If drilling down into fields of structures, the
     * gdb variable name has dot notation, such as 'var.field1.field2'.
     * @param gdb_var_name: gdb variable name to find corresponding cached object. Can have dot notation
     * @return: object if found, or undefined if not found
     */
    get_obj_from_gdb_var_name: function(expressions, gdb_var_name){
        // gdb provides names in dot notation
        let gdb_var_names = gdb_var_name.split('.'),
            top_level_var_name = gdb_var_names[0],
            children_names = gdb_var_names.slice(1, gdb_var_names.length)

        let objs = expressions.filter(v => v.name === top_level_var_name)

        if(objs.length === 1){
            // we found our top level object
            let obj = objs[0]
            let name_to_find = top_level_var_name
            for(let i = 0; i < (children_names.length); i++){
                // append the '.' and field name to find as a child of the object we're looking at
                name_to_find += `.${children_names[i]}`

                let child_obj = Expressions.get_child_with_name(obj.children, name_to_find)

                if(child_obj){
                    // our new object to search is this child
                    obj = child_obj
                }else{
                    console.error(`could not find ${name_to_find}`)
                    return undefined
                }
            }
            return obj

        }else if (objs.length === 0){
            console.error(`Couldnt find gdb variable ${top_level_var_name}. This is likely because the page was refreshed, so gdb's variables are out of sync with the browsers variables.`)
            return undefined
        }else{
            console.error(`Somehow found multiple local gdb variables with the name ${top_level_var_name}. Not using any of them. File a bug report with the developer.`)
            return undefined
        }
    },
    keydown_on_input: function(e){
        if((e.keyCode === ENTER_BUTTON_NUM)) {
            let expr = Expressions.el_input.val()
            if(_.trim(expr) !== ''){
                Expressions.create_variable(Expressions.el_input.val(), 'expr')
            }
        }
    },
    /**
     * Create a new variable in gdb. gdb automatically assigns
     * a unique variable name.
     */
    create_variable: function(expression, expr_type, ignore_errors=false){
        state.set('expr_being_created', expression)
        state.set('expr_type', expr_type)

        // - means auto assign variable name in gdb
        // * means evaluate it at the current frame
        if(expression.length > 0 && expression.indexOf('"') !== 0){
            expression = '"' + expression + '"'
        }
        let cmds = []
        if(state.get('pretty_print')){
            cmds.push('-enable-pretty-printing')
        }

        let var_create_cmd = `-var-create - * ${expression}`
        if(ignore_errors){
            var_create_cmd = IGNORE_ERRORS_TOKEN_STR + var_create_cmd
        }
        cmds.push(var_create_cmd)

        GdbApi.run_gdb_command(cmds)
    },
    /**
     * gdb returns objects for its variables,, but before we save that
     * data locally, we will add more fields to make it more useful for gdbgui
     * @param obj (object): mi object returned from gdb
     * @param expr_type (str): type of expression being created (see state creation for documentation)
     */
    prepare_gdb_obj_for_storage: function(obj, expr_type){
        let new_obj = $.extend(true, {}, obj)
        // obj was copied, now add some additional fields used by gdbgui

        // A varobj's contents may be provided by a Python-based pretty-printer.
        // In this case the varobj is known as a dynamic varobj.
        // Dynamic varobjs have slightly different semantics in some cases.
        // https://sourceware.org/gdb/onlinedocs/gdb/GDB_002fMI-Variable-Objects.html#GDB_002fMI-Variable-Objects
        new_obj.numchild = obj.dynamic ? parseInt(obj.has_more) : parseInt(obj.numchild)
        new_obj.children = []  // actual child objects are fetched dynamically when the user requests them
        new_obj.show_children_in_ui = false

        // this field is not returned when the variable is created, but
        // it is returned when the variables are updated
        // it is returned by gdb mi as a string, and we assume it starts out in scope
        new_obj.in_scope = 'true'
        new_obj.expr_type = state.get('expr_type')

        // can only be plotted if: value is an expression (not a local), and value is numeric
        new_obj.can_plot = (new_obj.expr_type === 'expr') && !window.isNaN(parseFloat(new_obj.value))
        new_obj.dom_id_for_plot = new_obj.name
            .replace(/\./g, '-')  // replace '.' with '-'
            .replace(/\$/g, '_')  // replace '$' with '-'
            .replace(/\[/g, '_')  // replace '[' with '_'
            .replace(/\]/g, '_')  // replace ']' with '_'
        new_obj.show_plot = false  // used when rendering to decide whether to show plot or not
        // push to this array each time a new value is assigned if value is numeric.
        // Plots use this data
        if(new_obj.value.indexOf('0x') === 0){
            new_obj.values = [parseInt(new_obj.value, 16)]
        }else if (!window.isNaN(parseFloat(new_obj.value))){
            new_obj.values = [new_obj.value]
        }else{
            new_obj.values = []
        }
        return new_obj
    },
    /**
     * After a variable is created, we need to link the gdb
     * variable name (which is automatically created by gdb),
     * and the expression the user wanted to evailuate. The
     * new variable is saved locally. The variable UI element is then re-rendered
     * @param r (object): gdb mi object
     */
    gdb_created_root_variable: function(r){
        let expr = state.get('expr_being_created')
        if(expr){
            // example payload:
            // "payload": {
            //      "has_more": "0",
            //      "name": "var2",
            //      "numchild": "0",
            //      "thread-id": "1",
            //      "type": "int",
            //      "value": "0"
            //  },
            Expressions.save_new_expression(expr, state.get('expr_type'), r.payload)
            state.set('expr_being_created', null)
            // automatically fetch first level of children for root variables
            Expressions.fetch_and_show_children_for_var(r.payload.name)
        }else{
            console.error('Developer error: gdb created a variable, but gdbgui did not expect it to.')
        }
    },
    /**
     * Got data regarding children of a gdb variable. It could be an immediate child, or grandchild, etc.
     * This method stores this child array data to the appropriate locally stored
     * object
     * @param r (object): gdb mi object
     */
    gdb_created_children_variables: function(r){
        // example reponse payload:
        // "payload": {
        //         "has_more": "0",
        //         "numchild": "2",
        //         "children": [
        //             {
        //                 "name": "var9.a",
        //                 "thread-id": "1",
        //                 "numchild": "0",
        //                 "value": "4195840",
        //                 "exp": "a",
        //                 "type": "int"
        //             },
        //             {
        //                 "name": "var9.b",
        //                 "thread-id": "1",
        //                 "numchild": "0",
        //                 "value": "0",
        //                 "exp": "b",
        //                 "type": "float"
        //             },
        //         ]
        //     }

        let parent_name = state.get('expr_gdb_parent_var_currently_fetching_children')
        , expr_type = state.get('expr_type')

        state.set('expr_gdb_parent_var_currently_fetching_children', null)

        // get the parent object of these children
        let expressions = state.get('expressions')
        let parent_obj = Expressions.get_obj_from_gdb_var_name(expressions, parent_name)
        if(parent_obj){
            // prepare all the child objects we received for local storage
            let children = r.payload.children.map(child_obj => Expressions.prepare_gdb_obj_for_storage(child_obj, expr_type))
            // save these children as a field to their parent
            parent_obj.children = children
            parent_obj.numchild = children.length
            state.set('expressions', expressions)
        }else{
            console.error('Developer error: gdb created a variable, but gdbgui did not expect it to.')
        }

        // if this field is an anonymous struct, the user will want to
        // see this expanded by default
        for(let child of parent_obj.children){
            if (child.exp.includes('anonymous')){
                Expressions.fetch_and_show_children_for_var(child.name)
            }
        }
    },
    render: function(reactor){
        let html = ''
        const is_root = true

        let sorted_expression_objs = _.sortBy(state.get('expressions'), unsorted_obj => unsorted_obj.expression)
        // only render variables in scope that were not created for the Locals component
        , objs_to_render = sorted_expression_objs.filter(obj => obj.in_scope === 'true' && obj.expr_type === 'expr')
        , objs_to_delete = sorted_expression_objs.filter(obj => obj.in_scope === 'invalid')

        // delete invalid objects
        objs_to_delete.map(obj => Expressions.delete_gdb_variable(obj.name))

        for(let obj of objs_to_render){
            if(obj.numchild > 0) {
                html += Expressions.get_ul_for_var_with_children(obj.expression, obj, is_root, true)
            }else{
                html += Expressions.get_ul_for_var_without_children(obj.expression, obj, is_root, true)
            }
        }
        if(html === ''){
            html = '<span class=placeholder>no expressions in this context</span>'
        }
        html += '<div id=tooltip style="display: hidden"/>'

        reactor.objs_to_render = objs_to_render
        reactor.force_update = true
        return html
    },
    after_render: function(reactor){
        for(let obj of reactor.objs_to_render){
            Expressions.plot_var_and_children(obj)
        }
    },
    /**
     * function render a plot on an existing element
     * @param obj: object to make a plot for
     */
    _make_plot: function(obj){
        let id = '#' + obj.dom_id_for_plot  // this div should have been created already
        , jq = $(id)
        , data = []
        , i = 0

        // collect data
        for(let val of obj.values){
            data.push([i, val])
            i++
        }

        // make the plot
        $.plot(jq,
            [
                {data: data,
                shadowSize: 0,
                color: '#33cdff'}
            ],
            {
                series: {
                    lines: { show: true },
                    points: { show: true }
                },
                grid: { hoverable: true, clickable: false }
            }
        )

        // add hover event to show tooltip
        jq.bind('plothover', function (event, pos, item) {
            if (item) {
                let x = item.datapoint[0]
                , y = item.datapoint[1]

                $('#tooltip').html(`(${x}, ${y})`)
                    .css({top: item.pageY+5, left: item.pageX+5})
                    .show()
            } else {
                $("#tooltip").hide();
            }
        })
    },
    /**
     * look through all expression objects and see if they are supposed to show their plot.
     * If so, update the dom accordingly
     * @param obj: expression object to plot (may have children to plot too)
     */
    plot_var_and_children: function(obj){
        if(obj.show_plot){
            Expressions._make_plot(obj)
        }
        for(let child of obj.children){
            Expressions.plot_var_and_children(child)
        }
    },
    /**
     * get unordered list for a variable that has children
     * @return unordered list, expanded or collapsed based on the key "show_children_in_ui"
     */
    get_ul_for_var_with_children: function(expression, mi_obj, is_root=false){
        let child_tree = ''
        if(mi_obj.show_children_in_ui){
            child_tree = '<ul>'
            if(mi_obj.children.length > 0){
                for(let child of mi_obj.children){
                    if(child.numchild > 0){
                        child_tree += `<li>${Expressions.get_ul_for_var_with_children(child.exp, child)}</li>`
                    }else{
                        child_tree += `<li>${Expressions.get_ul_for_var_without_children(child.exp, child)}</li>`
                    }
                }
            }else{
                child_tree += `<li>${ANIMATED_REFRESH_ICON}</li>`
            }

            child_tree += '</ul>'
        }

        let plus_or_minus = mi_obj.show_children_in_ui ? '-' : '+'
        return Expressions._get_ul_for_var(expression, mi_obj, is_root, plus_or_minus, child_tree, mi_obj.show_children_in_ui, mi_obj.numchild)
    },
    get_ul_for_var_without_children: function(expression, mi_obj, is_root=false){
        return Expressions._get_ul_for_var(expression, mi_obj, is_root)
    },
    /**
     * Get ul for a variable with or without children
     */
    _get_ul_for_var: function(expression, mi_obj, is_root, plus_or_minus='', child_tree='', show_children_in_ui=false, numchild=0){
        let
            delete_button = is_root ? `<span class='glyphicon glyphicon-trash delete_gdb_variable pointer' data-gdb_variable='${mi_obj.name}' />` : ''
            ,toggle_classes = numchild > 0 ? 'toggle_children_visibility pointer' : ''
            , val = _.isString(mi_obj.value) ? Memory.make_addrs_into_links(mi_obj.value) : mi_obj.value
            , plot_content = ''
            , plot_button = ''

        if(mi_obj.can_plot && mi_obj.show_plot){
            // dots are not allowed in the dom as id's. replace with '-'.
            let id = mi_obj.dom_id_for_plot
            plot_button = `<span class='toggle_plot pointer glyphicon glyphicon-ban-circle' data-gdb_variable_name='${mi_obj.name}' title='remove plot'></span>`
            plot_content = `<div id='${id}' class=plot />`

        }else if(mi_obj.can_plot && !mi_obj.show_plot){
            plot_button = `<img src='/static/images/ploticon.png' class='toggle_plot pointer' data-gdb_variable_name='${mi_obj.name}' />`
        }

        return `<ul class='variable'>
            <li>
                <span class='${toggle_classes}' data-gdb_variable_name='${mi_obj.name}'>
                    ${plus_or_minus} ${Util.escape(expression)}:
                </span>

                ${val}

                <span class='var_type'>
                    ${Util.escape(mi_obj.type || '')}
                </span>


                <div class='right_help_icon_show_on_hover'>
                    ${plot_button}
                    ${delete_button}
                </div>

                ${plot_content}

            </li>
            ${child_tree}
        </ul>
        `
    },
    fetch_and_show_children_for_var: function(gdb_var_name){
        let expressions = state.get('expressions')
        let obj = Expressions.get_obj_from_gdb_var_name(expressions, gdb_var_name)
        // mutate object by reference
        obj.show_children_in_ui = true
        // update state
        state.set('expressions', expressions)
        if((obj.numchild) && obj.children.length === 0){
            // need to fetch child data
            Expressions._get_children_for_var(gdb_var_name, obj.expr_type)
        }else{
            // already have child data, re-render will occur from event dispatch
        }
    },
    hide_children_in_ui: function(gdb_var_name){
        let expressions = state.get('expressions')
        , obj = Expressions.get_obj_from_gdb_var_name(expressions, gdb_var_name)
        if(obj){
            obj.show_children_in_ui = false
            state.set('expressions', expressions)
        }
    },
    click_toggle_children_visibility: function(e){
        let gdb_var_name = e.currentTarget.dataset.gdb_variable_name
        // get data object, which has field that says whether its expanded or not
        , obj = Expressions.get_obj_from_gdb_var_name(state.get('expressions'), gdb_var_name)
        , showing_children_in_ui = obj.show_children_in_ui

        if(showing_children_in_ui){
            // collapse
            Expressions.hide_children_in_ui(gdb_var_name)
        }else{
            // expand
            Expressions.fetch_and_show_children_for_var(gdb_var_name)
        }
    },
    click_toggle_plot: function(e){
        let gdb_var_name = e.currentTarget.dataset.gdb_variable_name
        , expressions = state.get('expressions')
        // get data object, which has field that says whether its expanded or not
        , obj = Expressions.get_obj_from_gdb_var_name(expressions, gdb_var_name)
        obj.show_plot = !obj.show_plot
        state.set('expressions', expressions)
    },
    /**
     * Send command to gdb to give us all the children and values
     * for a gdb variable. Note that the gdb variable itself may be a child.
     */
    _get_children_for_var: function(gdb_variable_name, expr_type){
        state.set('expr_gdb_parent_var_currently_fetching_children', gdb_variable_name)
        state.set('expr_type', expr_type)
        GdbApi.run_gdb_command(`-var-list-children --all-values "${gdb_variable_name}"`)
    },
    get_update_cmds: function(){
        function _get_cmds_for_obj(obj){
            let cmds = [`-var-update --all-values ${obj.name}`]
            for(let child of obj.children){
                cmds = cmds.concat(_get_cmds_for_obj(child))
            }
            return cmds
        }

        let cmds = []
        for(let obj of state.get('expressions')){
            cmds = cmds.concat(_get_cmds_for_obj(obj))
        }
        return cmds
    },
    handle_changelist: function(changelist_array){
        for(let changelist of changelist_array){
            let expressions = state.get('expressions')
            , obj = Expressions.get_obj_from_gdb_var_name(expressions, changelist.name)
            if(obj){
                if(parseInt(changelist['has_more']) === 1 && 'name' in changelist){
                    // already retrieved children of obj, but more fields were added.
                    // Re-fetch the object from gdb
                    Expressions._get_children_for_var(changelist['name'], obj.expr_type)
                }
                if('new_children' in changelist){
                    let new_children = changelist.new_children.map(child_obj => Expressions.prepare_gdb_obj_for_storage(child_obj, obj.expr_type))
                    obj.children = obj.children.concat(new_children)
                }
                if('value' in changelist && obj.expr_type === 'expr'){
                    // this object is an expression and it had a value updated.
                    // save the value to an array for plotting
                    if(changelist.value.indexOf('0x') === 0){
                        obj.can_plot = true
                        obj.values.push(parseInt(changelist.value, 16))
                    }else if (!window.isNaN(parseFloat(changelist.value))){
                        obj.can_plot = true
                        obj.values.push(changelist.value)
                    }
                }
                // overwrite fields of obj with fields from changelist
                _.assign(obj, changelist)
                // update expressions array which will trigger and event, which will
                // cause components to re-render
                state.set('expressions', expressions)
            }else{
                // error
            }
        }
    },
    click_delete_gdb_variable: function(e){
        e.stopPropagation() // not sure if this is still needed
        Expressions.delete_gdb_variable(e.currentTarget.dataset.gdb_variable)
    },
    delete_gdb_variable: function(gdbvar){
        // delete locally
        Expressions._delete_local_gdb_var_data(gdbvar)
        // delete in gdb too
        GdbApi.run_gdb_command(`-var-delete ${gdbvar}`)
    },
    /**
     * Delete local copy of gdb variable (all its children are deleted too
     * since they are stored as fields in the object)
     */
    _delete_local_gdb_var_data: function(gdb_var_name){
        let expressions = state.get('expressions')
        _.remove(expressions, v => v.name === gdb_var_name)
        state.set('expressions', expressions)
    },
}

const HoverVar = {
    init: function(){
        $('body').on('mouseover', '#code_table span.n', HoverVar.mouseover_variable)
        $('body').on('mouseover', '#code_table span.nx', HoverVar.mouseover_variable)
        $('body').on('mouseenter', '#hovervar', HoverVar.mouseover_hover_window)
        $('body').on('mouseleave', '#code_table span.n', HoverVar.mouseout_variable)
        $('body').on('mouseleave', '#code_table span.nx', HoverVar.mouseout_variable)
        $('body').on('mouseleave', '#hovervar', HoverVar.mouseout_hover_window)
        new Reactor('#hovervar', HoverVar.render, {after_dom_update: HoverVar.after_dom_update})
    },
    enter_timeout: undefined,  // debounce fetching the expression
    exit_timeout: undefined,  // debounce removing the box
    left: 0,
    top: 0,
    mouseover_variable: function(e){
        HoverVar.clear_hover_state()

        let rect = e.target.getBoundingClientRect()
        , var_name = e.target.textContent

        // store coordinates of where the box should be displayed
        HoverVar.left = rect.left
        HoverVar.top = rect.bottom

        const WAIT_TIME_SEC = 0.5
        HoverVar.enter_timeout = setTimeout(
            ()=>{
                let program_stopped = state.get('stack').length > 0
                if(program_stopped){
                    let ignore_errors = true
                    Expressions.create_variable(var_name, 'hover', ignore_errors)
                }
            },
            WAIT_TIME_SEC * 1000)
    },
    mouseout_variable: function(e){
        const WAIT_TIME_SEC = 0.1
        HoverVar.exit_timeout = setTimeout(
            ()=>{
                HoverVar.clear_hover_state()
            },
            WAIT_TIME_SEC * 1000
        )
    },
    mouseover_hover_window: function(e){
        // Mouse went from hovering over variable name in source code to
        // hovering over the window showing the contents of the variable.
        // Don't remove the window in this case.
        clearTimeout(HoverVar.exit_timeout)
    },
    mouseout_hover_window: function(e){
        HoverVar.clear_hover_state()
    },
    clear_hover_state: function(){
        clearTimeout(HoverVar.enter_timeout)
        clearTimeout(HoverVar.exit_timeout)
        let exprs_objs_to_remove = state.get('expressions').filter(obj => obj.expr_type === 'hover')
        exprs_objs_to_remove.map(obj => Expressions.delete_gdb_variable(obj.name))
    },
    render: function(r){
        let hover_objs = state.get('expressions').filter(o => o.expr_type === 'hover')
        , obj
        if(Array.isArray(hover_objs) && hover_objs.length === 1){
            obj = hover_objs[0]
        }
        HoverVar.obj = obj
        if (obj){
            let is_root = true
            if(obj.numchild > 0){
                return Expressions.get_ul_for_var_with_children(obj.expression, obj, is_root)
            }else{
                return Expressions.get_ul_for_var_without_children(obj.expression, obj, is_root)
            }
        }else{
            return 'no variable hovered'
        }
    },
    after_dom_update: function(r){
        if(HoverVar.obj){
            r.node.style.left = HoverVar.left
            r.node.style.top = HoverVar.top
            r.node.classList.remove('hidden')
        }else{
            r.node.classList.add('hidden')
        }

    }

}

const Locals = {
    init: function(){
        new Reactor('#locals', Locals.render)

        window.addEventListener('event_inferior_program_exited', Locals.event_inferior_program_exited)
        window.addEventListener('event_inferior_program_running', Locals.event_inferior_program_running)

        $('body').on('click', '.locals_autocreate_new_expr', Locals.click_locals_autocreate_new_expr)
    },
    render: function(){
        if(state.get('locals').length === 0){
            return '<span class=placeholder>no variables to display</span>'
        }
        let sorted_local_objs = _.sortBy(state.get('locals'), unsorted_obj => unsorted_obj.name)
        let html = sorted_local_objs.map(local => {
            let obj = Locals.get_autocreated_obj_from_expr(local.name)
            if(obj){
                let expr = local.name
                , is_root = true
                if(obj.numchild > 0){
                    return Expressions.get_ul_for_var_with_children(expr, obj, is_root)
                }else{
                    return Expressions.get_ul_for_var_without_children(expr, obj, is_root)
                }

            }else{
                // turn hex addresses into links to view memory

                let value = ''
                , plus_or_minus
                , cls

                if('value' in local){
                    value = Memory.make_addrs_into_links(local.value)
                    plus_or_minus = local.type.indexOf('*') !== -1  ? '+' : ''// make plus if value is a pointer (has asterisk)
                }else{
                    // this is not a simple type, so no value was returned. Display the plus to indicate
                    // it can be clicked (which will autocreate and expression that populates the fields)
                    plus_or_minus = '+'
                }

                if(plus_or_minus === '+'){
                    cls = 'locals_autocreate_new_expr pointer'
                }


                // return local variable name, value (if available), and type
                    return  `
                        <span class='${cls}' data-expression='${local.name}'>
                            ${plus_or_minus} ${local.name}: ${value}
                        </span>
                        <span class='var_type'>
                            ${_.trim(local.type)}
                        </span>
                        <br>
                        `
            }

        })
        return html.join('')
    },
    click_locals_autocreate_new_expr: function(e){
        let expr = e.currentTarget.dataset.expression
        if(expr){
            Expressions.create_variable(expr, 'local')
        }
    },
    get_autocreated_obj_from_expr: function(expr){
        for(let obj of state.get('expressions')){
            if(obj.expression === expr && obj.expr_type === 'local'){
                return obj
            }
        }
        return null
    },
    clear_autocreated_exprs: function(){
        let exprs_objs_to_remove = state.get('expressions').filter(obj => obj.expr_type === 'local')
        exprs_objs_to_remove.map(obj => Expressions.delete_gdb_variable(obj.name))
    },
    clear: function(){
        Locals.clear_autocreated_exprs()
    },
    event_inferior_program_exited: function(){
        Locals.clear()
    },
    event_inferior_program_running: function(){
        Locals.clear()
    },
}

/**
 * The Threads component
 */
const Threads = {
    init: function(){
        new Reactor('#threads', Threads.render)

        $("body").on("click", ".select_thread_id", Threads.click_select_thread_id)
        $("body").on("click", ".select_frame", Threads.click_select_frame)
    },
    click_select_thread_id: function(e){
        GdbApi.run_gdb_command(`-thread-select ${e.currentTarget.dataset.thread_id}`)
        GdbApi.refresh_state_for_gdb_pause()
    },
    /**
     * select a frame and jump to the line in source code
     * triggered when clicking on an object with the "select_frame" class
     * must have data attributes: framenum, fullname, line
     *
     */
    click_select_frame: function(e){
        Threads.select_frame(e.currentTarget.dataset.framenum)
    },
    select_frame: function(framenum){
        window.dispatchEvent(new CustomEvent('event_select_frame', {'detail': parseInt(framenum)}))
    },
    render: function(){
        if(state.get('threads').length > 0){
            let body = []
            for(let t of state.get('threads')){

                if(state.get('interpreter') === 'lldb'){
                    console.log('TODOLLDB - find current thread id')
                }

                let is_current_thread_being_rendered = (parseInt(t.id) === state.get('current_thread_id'))
                , cls = is_current_thread_being_rendered ? 'bold' : ''

                let thread_text = `<span class=${cls}>thread id ${t.id}, core ${t.core} (${t.state})</span>`

                // add thread name
                if(is_current_thread_being_rendered){
                    body.push(thread_text)
                }else{
                    // add class to allow user to click and select this thread
                    body.push(`
                        <span class='select_thread_id pointer' data-thread_id='${t.id}'>
                            ${thread_text}
                        </span>
                        <br>
                        `)
                }

                if(is_current_thread_being_rendered || state.get('interpreter') === 'lldb'){
                    // add stack if current thread
                    for (let s of state.get('stack')){
                        if(s.addr === t.frame.addr){
                            body.push(Threads.get_stack_table(state.get('stack'), t.frame.addr, is_current_thread_being_rendered, t.id))
                            break
                        }
                    }
                }else{
                    // add frame if not current thread
                    body.push(Threads.get_stack_table([t.frame], '', is_current_thread_being_rendered, t.id))
                }
            }

            return body.join('')
        }else{
            return '<span class=placeholder>not paused</span>'
        }
    },
    get_stack_table: function(stack, cur_addr, is_current_thread_being_rendered, thread_id){
        let _stack = $.extend(true, [], stack)
            , table_data = []

        var frame_num = 0
        for (let s of _stack){

            // let arrow = (cur_addr === s.addr) ? `<span class='glyphicon glyphicon-arrow-right' style='margin-right: 4px;'></span>` : ''
            let bold = (state.get('selected_frame_num') === frame_num && is_current_thread_being_rendered) ? 'bold' : ''
            let fullname = 'fullname' in s ? s.fullname : '?'
                , line = 'line' in s ? s.line : '?'
                , attrs = is_current_thread_being_rendered ? `class="select_frame pointer ${bold}"` : `class="select_thread_id pointer ${bold}" data-thread_id=${thread_id}`
                , function_name =`
                <span ${attrs} data-framenum=${s.level}>
                    ${s.func}
                </span>`

            table_data.push([function_name, `${s.file}:${s.line} ${Memory.make_addrs_into_links(s.addr)}`])
            frame_num++
        }
        if(_stack.length === 0){
            table_data.push(['unknown', 'unknown'])
        }
        return Util.get_table([], table_data, 'font-size: 0.9em;')
    },
    update_stack: function(stack){
        state.set('stack', stack)
        state.set('paused_on_frame', stack[state.get('selected_frame_num') || 0])
        state.set('fullname_to_render', state.get('paused_on_frame').fullname)
        state.set('current_line_of_source_code', parseInt(state.get('paused_on_frame').line))
        state.set('current_assembly_address', state.get('paused_on_frame').addr)
        state.set('make_current_line_visible', true)
    },
    set_threads: function(threads){
        state.Set('threads', $.extend(true, [], threads))
        Threads.render()
    },
    set_thread_id: function(id){
        state.set('current_thread_id',  parseInt(id))
    },
}

/**
 * Component with checkboxes that allow the user to show/hide various components
 */
const VisibilityToggler = {
    /**
     * Set up events and render checkboxes
     */
    init: function(){
        $("body").on("click", ".visibility_toggler", VisibilityToggler.click_visibility_toggler)
    },
    /**
     * Update visibility of components as defined by
     * the checkboxes
     */
    click_visibility_toggler: function(e){
        if(e.target.classList.contains('glyphicon-ban-circle') || e.target.classList.contains('btn')){
            // don't toggle visibility if the clear button was pressed
            return
        }

        // toggle visiblity of target
        $(e.currentTarget.dataset.visibility_target_selector_string).toggleClass('hidden')

        // make triangle point down or to the right
        let is_hidden = $(e.currentTarget.dataset.visibility_target_selector_string).hasClass('hidden')
        if(is_hidden){
            $(e.currentTarget.dataset.glyph_selector).addClass('glyphicon-chevron-right').removeClass('glyphicon-chevron-down')
        }else{
            $(e.currentTarget.dataset.glyph_selector).addClass('glyphicon-chevron-down').removeClass('glyphicon-chevron-right')
        }

        if(e.target.textContent.trim() === 'registers'){
            // registers were toggled
            let is_visible = !is_hidden
            state.set('fetch_registers', is_visible)

            if (is_visible){
                GdbApi.run_gdb_command(Registers.get_update_cmds())
            }

        }
    }
}

/**
 * Component to shutdown gdbgui
 */
const ShutdownGdbgui = {
    el: $('#shutdown_gdbgui'),
    /**
     * Set up events and render checkboxes
     */
    init: function(){
        ShutdownGdbgui.el.click(ShutdownGdbgui.click_shutdown_button)
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

/**
 * This is the main callback when receiving a response from gdb.
 * This callback generally updates the state, which emits an event and
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
                // if gdb could not determine which function this breakpoint belongs to,
                // delete it, and don't display it in the frontend.
                // <MULTIPLE> indicates the breakpoint is on an inline function or template
                // that has mutliple child breakpoints, which is okay and shouldn't be deleted

                // if (new_bkpt.func === undefined && new_bkpt.addr !== '<MULTIPLE>'){
                //     console.warn('removing invalid breakpoint: ', new_bkpt)
                //     GdbConsoleComponent.add('Warning: Source file for breakpoint could not be determined. Click file dropdown to open file and visually add breakpoints.', true)
                //     continue
                // }

                // remove duplicate breakpoints
                let cmds = state.get('breakpoints')
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
                    state.set('fullname_to_render', bkpt.fullname_to_display)
                    state.set('current_line_of_source_code', parseInt(bkpt.line))
                    state.set('make_current_line_visible', true)
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
                state.set('threads', r.payload.threads)
                if(state.get('interpreter') === 'gdb'){
                    state.set('current_thread_id', parseInt(r.payload['current-thread-id']))
                }else if(state.get('interpreter') === 'lldb'){
                    // lldb does not provide this
                }
            }
            if ('register-names' in r.payload) {
                let names = r.payload['register-names']
                // filter out empty names
                state.set('register_names', names.filter(name => name !== ''))
            }
            if ('register-values' in r.payload) {
                state.set('previous_register_values', state.get('current_register_values'))
                state.set('current_register_values', r.payload['register-values'])
            }
            if ('asm_insns' in r.payload) {
                SourceCode.save_new_assembly(r.payload.asm_insns, r.token)
            }
            if ('files' in r.payload){
                if(r.payload.files.length > 0){
                    let source_file_paths = _.uniq(r.payload.files.map(f => f.fullname)).sort()
                    state.set('source_file_paths', source_file_paths)

                    let language = 'c_family'
                    if(source_file_paths.some(p => p.endsWith('.rs'))){
                        language = 'rust'
                        let gdb_version_array = state.get('gdb_version_array')
                        // rust cannot view registers with gdb 7.12.x
                        if(gdb_version_array[0] == 7 && gdb_version_array[1] == 12){
                            GdbConsoleComponent.add(`Warning: Due to a bug in gdb version ${state.get('gdb_version')}, gdbgui cannot show register values with rust executables. See https://github.com/cs01/gdbgui/issues/64 for details.`, true)
                            state.set('can_fetch_register_values', false)
                        }
                    }else if (source_file_paths.some(p => p.endsWith('.go'))){
                        language = 'go'
                    }
                    state.set('language', language)
                }else{
                    state.set('source_file_paths', ['Executable was compiled without debug symbols. Source file paths are unknown.'])

                    if (state.get('inferior_binary_path')){
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
                state.set('locals', r.payload.variables)
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
            if(r.payload.msg === `${state.get('inferior_binary_path')}: No such file or directory.`){
                window.dispatchEvent(new Event('event_inferior_program_exited'))
            }

        } else if (r.type === 'console'){
            GdbConsoleComponent.add(r.payload, r.stream === 'stderr')
            if(state.get('gdb_version') === undefined){
                // parse gdb version from string such as
                // GNU gdb (Ubuntu 7.7.1-0ubuntu5~14.04.2) 7.7.1
                let m = /GNU gdb \(.*\)\s*(.*)\\n/g
                let a = m.exec(r.payload)
                if(_.isArray(a) && a.length === 2){
                    state.set('gdb_version', a[1])
                    state.set('gdb_version_array', a[1].split('.'))
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
                // TODO not sure what to do here, but the status bar already renders the
                // signal nicely

            }else{
                console.log('TODO handle new reason for stopping. Notify developer of this.')
                console.log(r)
            }
        }
    }

    // perform any final actions
    if(update_status){
        // render response of last element of array
        let last_response = _.last(response_array)
        if(ignore(last_response)){
            StatusBar.render('')
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

const GlobalEvents = {
    init: function(){
        window.onkeydown = function(e){
           if((e.keyCode === ENTER_BUTTON_NUM)) {
               // when pressing enter in an input, don't redirect entire page
               e.preventDefault()
           }
        }

        $('body').on('keydown', GlobalEvents.body_keydown)

        window.addEventListener('event_inferior_program_exited', GlobalEvents.event_inferior_program_exited)
        window.addEventListener('event_inferior_program_running', GlobalEvents.event_inferior_program_running)
        window.addEventListener('event_inferior_program_paused', GlobalEvents.event_inferior_program_paused)
        window.addEventListener('event_select_frame', GlobalEvents.event_select_frame)

        // make sure saved preferences are set/valid
        if(localStorage.getItem('highlight_source_code') === null){
            localStorage.setItem('highlight_source_code', JSON.stringify(true))
            state.set('highlight_source_code', true)
        }
        if(localStorage.getItem('auto_add_breakpoint_to_main') === null){
            localStorage.setItem('auto_add_breakpoint_to_main', JSON.stringify(true))
            state.set('auto_add_breakpoint_to_main', true)
        }
    },
    /**
     * keyboard shortcuts to interact with gdb.
     * enabled only when key is depressed on a target that is NOT an input.
     */
    body_keydown: function(e){
        let modifier = e.altKey || e.ctrlKey || e.shiftKey || e.metaKey

        if(e.target.nodeName !== 'INPUT' && !modifier){
            let char = String.fromCharCode(e.keyCode).toLowerCase()
            if(e.keyCode === DOWN_BUTTON_NUM || char === 's'){
                GdbApi.click_step_button()
            }else if(e.keyCode === RIGHT_BUTTON_NUM || char === 'n'){
                GdbApi.click_next_button()
            }else if(char === 'c'){
                GdbApi.click_continue_button()
            }else if(e.keyCode === UP_BUTTON_NUM || char === 'u'){
                GdbApi.click_return_button()
            }else if(char === 'r'){
                GdbApi.click_run_button()
            }else if(char === 'm'){
                GdbApi.click_next_instruction_button()
            }else if(e.keyCode === COMMA_BUTTON_NUM){
                GdbApi.click_step_instruction_button()
            }
        }
    },
    clear_program_state: function(){
        state.set('current_line_of_source_code', undefined)
        state.set('paused_on_frame', undefined)
        state.set('selected_frame_num', 0)
        state.set('current_thread_id', undefined)
        state.set('stack', [])
        state.set('locals', [])
    },
    event_inferior_program_exited: function(){
        state.set('disassembly_for_missing_file', [])
        state.set('inferior_program', 'exited')
        GlobalEvents.clear_program_state()
    },
    event_inferior_program_running: function(){
        state.set('inferior_program', 'running')
        GlobalEvents.clear_program_state()
    },
    event_inferior_program_paused: function(e){
        let frame = e.detail || {}
        state.set('inferior_program', 'paused')
        state.set('paused_on_frame', frame)
        state.set('fullname_to_render', frame.fullname)
        state.set('make_current_line_visible', true)
        state.set('current_line_of_source_code', parseInt(frame.line))
        state.set('current_assembly_address', frame.addr)
    },
    event_select_frame: function(e){
        let selected_frame_num = e.detail || 0
        state.set('selected_frame_num', selected_frame_num)
        state.set('make_current_line_visible', true)
    },
}

/**
 * Split the body into different panes using splitjs (https://github.com/nathancahill/Split.js)
 */
Split(['#middle_left', '#middle_right'], {
    gutterSize: 6,
    cursor: 'col-resize',
    direction: 'horizontal',  // horizontal makes a left/right pane, and a divider running vertically
    sizes: [75, 25],
})

Split(['#middle', '#bottom'], {
    gutterSize: 6,
    cursor: 'row-resize',
    direction: 'vertical',  // vertical makes a top and bottom pane, and a divider running horizontally
    sizes: [65, 35],
})

// initialize components
GlobalEvents.init()
GdbApi.init()
GdbCommandInput.init()
Modal.init()
GdbConsoleComponent.init()
GdbMiOutput.init()
SourceCode.init()
Breakpoint.init()
BinaryLoader.init()
Registers.init()
SourceFileAutocomplete.init()
Memory.init()
Expressions.init()
HoverVar.init()
Locals.init()
Threads.init()
VisibilityToggler.init()
ShutdownGdbgui.init()
Settings.init()

window.addEventListener("beforeunload", GdbCommandInput.shutdown)
window.onbeforeunload = () => ('text here makes dialog appear when exiting. Set function to back to null for nomal behavior.')

// and finally, if user supplied an initial command, set it in the UI, and load the
// inferior binary
if(_.isString(initial_data.initial_binary_and_args) && _.trim(initial_data.initial_binary_and_args).length > 0){
    BinaryLoader.el.val(_.trim(initial_data.initial_binary_and_args))
    BinaryLoader.set_target_app()
}

return state
})(jQuery, _, state, Reactor, Awesomplete, Split, io, moment, debug, initial_data)
