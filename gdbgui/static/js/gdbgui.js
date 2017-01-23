
/**
 * This is the main frontend file to make
 * an interactive ui for gdb. Everything exists in this single js
 * file (besides libraries).
 *
 * There are several components, each of which have their
 * own top-level object. Each component is reponsible
 * for its own data, state, event handling, and rendering (to
 * the extent that it's possible).
 */

(function ($, _, Awesomplete) {
"use strict";

/**
 * Constants
 */
const ENTER_BUTTON_NUM = 13

/**
 * Globals
 */
let globals = {
    gdb_version: localStorage.getItem('gdb_version') || undefined,  // this is parsed from gdb's output, but initialized to undefined
}


/**
 * The Status component display the most recent gdb status
 * at the top of the page
 */
const Status = {
    el: $('#status'),
    /**
     * Render a new status
     * @param status_str: The string to render
     * @param error: Whether this string relates to an error condition. If true,
     *                  a red label appears
     */
    render: function(status_str, error=false){
        if(error){
            Status.el.html(`<span class='label label-danger'>error</span>&nbsp;${status_str}`)
        }else{
            Status.el.text(status_str)
        }
    },
    /**
     * Handle http responses with error codes
     * @param response: response from server
     */
    render_ajax_error_msg: function(response){
        if (response.responseJSON && response.responseJSON.message){
            Status.render(_.escape(response.responseJSON.message), true)
        }else{
            Status.render(`${response.statusText} (${response.status} error)`, true)
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
            if (mi_obj.payload.msg) {status.push(mi_obj.payload.msg)}
            if (mi_obj.payload.reason) {status.push(mi_obj.payload.reason)}
            if (mi_obj.payload.frame){
                for(let i of ['file', 'func', 'line', 'addr']){
                    if (i in mi_obj.payload.frame){
                        status.push(`${i}: ${mi_obj.payload.frame[i]}`)
                    }
                }
            }
        }
        Status.render(status.join(', '), error)
    }
}

/**
 * This object contains methods to interact with
 * gdb, but does not directly render anything in the DOM.
 */
const GdbApi = {
    init: function(){
        $("body").on("click", ".gdb_cmd", GdbApi.click_gdb_cmd_button)
        $("body").on("click", ".get_gdb_response", GdbApi.get_gdb_response)
    },
    state: {'waiting_for_response': false},
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
    /**
     * runs a gdb cmd (or commands) directly in gdb on the backend
     * validates command before sending, and updates the gdb console and status bar
     * @param cmd: a string or array of strings, that are directly evaluated by gdb
     * @param success_callback: function to be called upon successful completion.  The data returned
     *                          is an object. See pygdbmi for a description of the format.
     *                          The default callback works in most cases, but in some cases a the response is stateful and
     *                          requires a specific callback. For example, when creating a variable in gdb
     *                          to watch, gdb returns generic looking data that a generic callback could not
     *                          figure out how to handle.
     * @return nothing
     */
    run_gdb_command: function(cmd, success_callback=process_gdb_response){
        if(_.trim(cmd) === ''){
            return
        }

        if(GdbApi.state.waiting_for_response === true){
            Status.render('Cannot send command while waiting for response. If gdb is hung, kill the server with CTRL+C, then start server again and reload page.')
            return
        }else{
            // todo
            // GdbApi.state.waiting_for_response = true
        }

        let cmds = cmd
        if(_.isString(cmds)){
            cmds = [cmds]
        }

        Status.render(`running command(s) "${cmd}"`)
        Status.render(``)
        History.save_to_history(cmds)
        // GdbConsoleComponent.add_sent_commands(cmds)
        $.ajax({
            url: "/run_gdb_command",
            cache: false,
            method: 'POST',
            data: {'cmd': cmd},
            success: success_callback,
            error: Status.render_ajax_error_msg,
        })
    },
    refresh_breakpoints: function(){
        GdbApi.run_gdb_command(['-break-list'])
    },
    refresh_stack: function(){
        let cmds = ['-stack-list-frames',
                    '-stack-info-frame',
                    '-thread-info',
                    '-var-update --all-values *',
                    '-data-list-register-names',
                    '-data-list-register-values x']
        // re-fetch memory over desired range as specified by DOM
        cmds.concat(Memory.get_gdb_commands_from_inputs())
        GdbApi.run_gdb_command(cmds)
    },
    /**
     * read gdb's buffers for any asynchronous data that
     * arrived since the last read
     */
    get_gdb_response: function(){
        if(GdbApi.state.waiting_for_response === true){
            Status.render('Cannot send command while waiting for response. If gdb is hung, kill the server with CTRL+C, then start server again and reload page.')
            return
        }else{
            // todo
            // GdbApi.state.waiting_for_response = true
        }
        Status.render(`Getting GDB response`)
        $.ajax({
            url: "/get_gdb_response",
            cache: false,
            success: process_gdb_response,
            error: Status.render_ajax_error_msg,
        })
    },
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
    get_table: function(columns, data) {
        var result = ["<table class='table table-striped table-bordered table-condensed'>"];
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
     * gdb will often return an array of objects
     * Iterate through all of them and find all keys
     * and corresponding data
     * @param objs: array of response objects from gdb, such as breakpoints
     * @return tuple of [column, data], compatible with Util.get_table
     */
    get_table_data_from_objs: function(objs){
        // put keys of all objects into array
        let all_keys = _.flatten(objs.map(i => _.keys(i)))
        let columns = _.uniq(_.flatten(all_keys)).sort()

        let data = []
        for (let s of objs){
            let row = []
            for (let k of columns){
                row.push(k in s ? s[k] : '')
            }
            data.push(row)
        }
        return [columns, data]
    },
    /**
     * Escape gdb's output to be browser compatible
     * @param s: string to mutate
     */
    escape: function(s){
        return s.replace(/([^\\]\\n)/g, '<br>')
                .replace(/\\t/g, '&nbsp')
                .replace(/\\"+/g, '"')
    },
    push_if_new: function(array, val){
        if(array.indexOf(val) === -1){
            array.push(val)
        }
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
        // TODO when focus is in input and up/down arrows are pressed, cycle through history and populate
        // input with old history entry
    },
    clear_console: function(){
        GdbConsoleComponent.el.html('')
    },
    add: function(s){
        let strings = s
        if(_.isString(s)){
            strings = [s]
        }
        strings.map(string => GdbConsoleComponent.el.append(`<p class='margin_sm output'>${Util.escape(string)}</p>`))
    },
    add_sent_commands(cmds){
        if(!_.isArray(cmds)){
            cmds = [cmds]
        }
        cmds.map(cmd => GdbConsoleComponent.el.append(`<p class='margin_sm output sent_command pointer' data-cmd="${cmd}">${Util.escape(cmd)}</p>`))
        GdbConsoleComponent.scroll_to_bottom()
    },
    scroll_to_bottom: function(){
        GdbConsoleComponent.el.animate({'scrollTop': GdbConsoleComponent.el.prop('scrollHeight')})
    },
    click_sent_command: function(e){
        // when a previously sent command is clicked, populate the command input
        // with it
        let previous_cmd_from_history = (e.currentTarget.dataset.cmd)
        GdbCommandInput.set_input_text(previous_cmd_from_history)
    },
}


/**
 * History component is not used, but could restore gdb's console history in browser
 * for when the page is reloaded
 */
const History = {
    init: function(){
        $("body").on("click", ".sent_command", History.click_sent_command)

        try{
            History.items = _.uniq(JSON.parse(localStorage.getItem('history')))
        }catch(err){
            History.items = []
        }
    },
    onclose: function(){
        localStorage.setItem('history', JSON.stringify(History.items) || [])
        return null
    },
    save_to_history: function(cmds){
        if (!_.isArray(cmds)){
            cmds = [cmds]
        }

        if (_.isArray(History.items)){
            _.remove(History.items, i => cmds.indexOf(i) !== -1)
            for(let cmd of cmds){
                History.items.unshift(cmd)
            }
        }else{
            History.items = cmds
        }
    },
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
    },
    clear: function(){
        GdbMiOutput.el.html('')
    },
    add_mi_output: function(mi_obj){
        const text_class = {
            'output': "",
            'notify': "text-info",
            'log': "text-primary",
            'status': "text-danger",
            'console': "text-info",
        }
        let mi_obj_dump = JSON.stringify(mi_obj, null, 4)
        mi_obj_dump = mi_obj_dump.replace(/[^(\\)]\\n/g).replace("<", "&lt;").replace(">", "&gt;")
        GdbMiOutput.el.append(`<p class='pre ${text_class[mi_obj.type]} margin_sm output'>${mi_obj.type}:<br>${mi_obj_dump}</span>`)
    },
    scroll_to_bottom: function(){
        GdbMiOutput.el.animate({'scrollTop': GdbMiOutput.el.prop('scrollHeight')})
    }
}

/**
 * The breakpoint table component
 */
const Breakpoint = {
    el: $('#breakpoints'),
    breakpoints: [],
    render_breakpoint_table: function(){
        let [columns, data] = Util.get_table_data_from_objs(Breakpoint.breakpoints)
        Breakpoint.el.html(Util.get_table(columns, data))
    },
    remove_stored_breakpoints: function(){
        Breakpoint.breakpoints = []
    },
    remove_breakpoint_if_present: function(fullname, line){
        for (let b of Breakpoint.breakpoints){
            if (b.fullname === fullname && b.line === line){
                let cmd = [`-break-delete ${b.number}`, '-break-list']
                GdbApi.run_gdb_command(cmd)
            }
        }
    },
    store_breakpoint: function(breakpoint){
        let bkpt = $.extend(true, {}, breakpoint)
        // turn fullname into a link with classes that allows us to click and view the file/context of the breakpoint
        let links = []
        if ('fullname' in breakpoint){
             links.push(SourceCode.get_link_to_view_file(breakpoint.fullname, breakpoint.line, '', 'false'))
        }
        links.push(`<a class="gdb_cmd pointer" data-cmd0="-break-delete ${breakpoint.number}" data-cmd1="-break-list">remove</a>`)
        bkpt[' '] = links.join(' | ')

        // turn address into link
        if (bkpt['addr']){
            bkpt['addr'] =  Memory.make_addr_into_link(bkpt['addr'])
        }

        // add the breakpoint if it's not stored already
        if(Breakpoint.breakpoints.indexOf(bkpt) === -1){
            Breakpoint.breakpoints.push(bkpt)
        }
    },
    get_breakpoint_lines_for_file: function(fullname){
        return Breakpoint.breakpoints.filter(b => b.fullname === fullname).map(b => parseInt(b.line))
    },
    assign_breakpoints_from_mi_breakpoint_table: function(payload){
        Breakpoint.remove_stored_breakpoints()
        if(payload && payload.BreakpointTable && payload.BreakpointTable.body){
            for (let bkpt of payload.BreakpointTable.body){
                Breakpoint.store_breakpoint(bkpt)
            }
            Breakpoint.render_breakpoint_table()
        }
    }
}

/**
 * The source code component
 */
const SourceCode = {
    el: $('#code_table'),
    el_code_container: $('#code_container'),
    el_title: $('#source_code_heading'),
    el_jump_to_line_input: $('#jump_to_line'),
    state: {'rendered_source_file_fullname': null,
            'rendered_source_file_line': null,
            'rendered_source_file_addr': null,
            'line_highlighted': false,
            'cached_source_files': [],  // list with keys fullname, source_code
    },
    init: function(){
        $("body").on("click", ".source_code_row td.line_num", SourceCode.click_gutter)
        $("body").on("click", ".view_file", SourceCode.click_view_file)
        $('#checkbox_show_assembly').change(SourceCode.show_assembly_checkbox_changed)
        $('#refresh_cached_source_files').click(SourceCode.refresh_cached_source_files)
        SourceCode.el_jump_to_line_input.keydown(SourceCode.keydown_jump_to_line)
    },
    click_gutter: function(e){
        let line = e.currentTarget.dataset.line
        let has_breakpoint = (e.currentTarget.dataset.has_breakpoint === 'true')
        if(has_breakpoint){
            // clicked gutter with a breakpoint, remove it
            Breakpoint.remove_breakpoint_if_present(SourceCode.state.rendered_source_file_fullname, line)

        }else{
            // clicked with no breakpoint, add it, and list all breakpoints to make sure breakpoint table is up to date
            let cmd = [`-break-insert ${SourceCode.state.rendered_source_file_fullname}:${line}`, '-break-list']
            GdbApi.run_gdb_command(cmd)
        }
    },
    render_cached_source_file: function(){
        SourceCode.fetch_and_render_file(SourceCode.state.rendered_source_file_fullname,
            SourceCode.state.rendered_source_file_line,
            SourceCode.state.rendered_source_file_addr,
            {'highlight': false, 'scroll': true})
    },
    is_cached: function(fullname){
        return SourceCode.state.cached_source_files.some(f => f.fullname === fullname)
    },
    get_cached_assembly_for_file: function(fullname){
        for(let file of SourceCode.state.cached_source_files){
            if(file.fullname === fullname){
                return file.assembly
            }
        }
        return null
    },
    refresh_cached_source_files: function(e){
        SourceCode.clear_cached_source_files()
        SourceCode.re_render()
    },
    clear_cached_source_files: function(){
        SourceCode.state.cached_source_files = []
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
                let cls = ''
                if(addr === i.address){
                    cls = 'bold'
                }
                instruction_content.push(`<span class=${cls}>${i.inst}</span>`)
                func_and_addr_content.push(`<span class='${cls}'> ${i['func-name']}+${i['offset']} ${Memory.make_addr_into_link(i.address)}</span>`)
            }

            instruction_content = instruction_content.join('<br>')
            func_and_addr_content = func_and_addr_content.join('<br>')

            // instruction_content = instructions_for_this_line.map(el => `${el.inst}`).join('<br>')
            // func_and_addr_content = instructions_for_this_line.map(el => ).join('<br>')
        }

        return `
        <td valign="top" class='assembly'>

            ${instruction_content}
        </td>
        <td valign="top" class='assembly'>
            ${func_and_addr_content}
        </td>`
    },
    /**
     * Render a cached source file
     */
    render_source_file: function(fullname, source_code, current_line=1, addr=undefined, options={'highlight': false, 'scroll': false}){
        current_line = parseInt(current_line)
        SourceCode.state.line_highlighted = options.highlight
        SourceCode.state.rendered_source_file_fullname = fullname
        SourceCode.state.rendered_source_file_line = current_line
        SourceCode.state.rendered_source_file_addr = addr

        let assembly,
            show_assembly = SourceCode.show_assembly_box_is_checked()

        if(show_assembly){
            assembly = SourceCode.get_cached_assembly_for_file(fullname)

            if(!assembly){
                SourceCode.fetch_disassembly()
                return  // when disassembly is returned, the source file will be rendered
            }
        }

        let line_num = 1,
            tbody = [],
            bkpt_lines = Breakpoint.get_breakpoint_lines_for_file(fullname)

        for (let line of source_code){
            let has_breakpoint = bkpt_lines.indexOf(line_num) !== -1
            let breakpoint_class = has_breakpoint ? 'breakpoint' : ''
            let tags = ''
            if (line_num === current_line){
              tags = `id=current_line ${options.highlight ? 'class=highlight' : ''}`
            }
            line = line.replace("<", "&lt;")
            line = line.replace(">", "&gt;")

            let assembly_for_line = SourceCode.get_assembly_html_for_line(show_assembly, assembly, line_num, addr)

            tbody.push(`
                <tr class='source_code_row'>
                    <td valign="top" class='line_num right_border  ${breakpoint_class}'  data-line=${line_num} data-has_breakpoint=${has_breakpoint}>
                        <div>${line_num}</div>
                    </td>

                    <td valign="top" class='line_of_code'>
                        <pre ${tags}>${line}</pre>
                    </td>

                    ${assembly_for_line}
                </tr>
                `)
            line_num++;
        }
        SourceCode.el_title.text(fullname)
        SourceCode.el_jump_to_line_input.val(current_line)
        SourceCode.el.html(tbody.join(''))


        if(options.scroll){
            SourceCode.make_current_line_visible()
        }
    },
    make_current_line_visible: function(){
        SourceCode.scroll_to_jq_selector($("#current_line"))
    },
    // re-render breakpoints on whichever file is loaded
    render_breakpoints: function(){
        if(_.isString(SourceCode.state.rendered_source_file_fullname)){
            let jq_old_bkpts = $('.line_num.breakpoint')
            for(let old_bkpt of jq_old_bkpts){
                // remove breakpoint class and set data.has_breakpoint to false
                let jq_old_bkpt = $(old_bkpt)
                jq_old_bkpt.removeClass('breakpoint')
                old_bkpt.dataset.has_breakpoint = 'false'
            }

            let bkpt_lines = Breakpoint.get_breakpoint_lines_for_file(SourceCode.state.rendered_source_file_fullname)
            , jq_lines = $('td.line_num')

            for(let bkpt_line of bkpt_lines){
                let js_line = $(`td.line_num[data-line=${bkpt_line}]`)[0]
                if(js_line){
                    $(js_line).addClass('breakpoint')
                    js_line.dataset.has_breakpoint = 'true'
                }
            }
        }
    },
    re_render: function(){
        let fullname = SourceCode.state.rendered_source_file_fullname,
            current_line = SourceCode.state.rendered_source_file_line || 0,
            addr = SourceCode.state.rendered_source_file_addr || 0,
            options = {'highlight': SourceCode.state.line_highlighted, 'scroll': false}

        // render file and pass current state
        SourceCode.fetch_and_render_file(fullname, current_line, addr, options)
    },
    // fetch file and render it, or used cached file if we have it
    fetch_and_render_file: function(fullname, current_line=1, addr='', options={'highlight': false, 'scroll': false}){
        if (!_.isString(fullname)){
            return
        } else if (SourceCode.is_cached(fullname)){
            // We have this cached locally, just use it!
            let f = _.find(SourceCode.state.cached_source_files, i => i.fullname === fullname)
            SourceCode.render_source_file(fullname, f.source_code, current_line, addr, options)

        } else {
            $.ajax({
                url: "/read_file",
                cache: false,
                type: 'GET',
                data: {path: fullname},
                success: function(response){
                    SourceCode.add_source_file_to_cache(fullname, response.source_code)
                    SourceCode.render_source_file(fullname, response.source_code, current_line, addr, options)
                },
                error: function(response){
                    Status.render_ajax_error_msg(response)
                    let source_code = [`failed to fetch file ${fullname}`]
                    SourceCode.add_source_file_to_cache(fullname, source_code)
                    SourceCode.render_source_file(fullname, source_code, 0, addr, options)
                }
            })
        }
    },
    add_source_file_to_cache: function(fullname, source_code, assembly){
        SourceCode.state.cached_source_files.push({'fullname': fullname, 'source_code': source_code, 'assembly': assembly})
    },
    /**
     * gdb changed its api for the data-disassemble command
     * see https://www.sourceware.org/gdb/onlinedocs/gdb/GDB_002fMI-Data-Manipulation.html
     * TODO not sure which version this change occured in. I know in 7.7 it needs the '3' option,
     * and in 7.11 it needs the '4' option. I should test the various version at some point.
     */
    get_dissasembly_format_num: function(gdb_version){
        if(gdb_version === undefined){
            // assuming new version, but we shouldn't ever not know the version...
            return 4
        } else if (gdb_version <= 7.7){
            // this option has been deprecated in newer versions, but is required in older ones
            //
            return 3
        }else{
            return 4
        }
    },
    get_fetch_disassembly_command: function(){
        if(SourceCode.state.rendered_source_file_fullname){
            let mi_response_format = SourceCode.get_dissasembly_format_num(globals.gdb_version)
            return `-data-disassemble -f ${SourceCode.state.rendered_source_file_fullname} -l 1 -- ${mi_response_format}`
        }else{
            // we don't have a file to fetch disassembly for
            return null
        }
    },
    show_assembly_box_is_checked: function(){
        return $('#checkbox_show_assembly').prop('checked')
    },
    /**
     * Fetch disassembly for current file/line. An error is raised
     * if gdbgui doesn't have that state saved.
     */
    show_assembly_checkbox_changed: function(e){
        if(SourceCode.show_assembly_box_is_checked()){
            let cmd = SourceCode.get_fetch_disassembly_command()
            if(cmd){
                GdbApi.run_gdb_command(cmd)
            }
        }else{
            SourceCode.re_render()
        }
    },
    fetch_disassembly: function(){
        let cmd = SourceCode.get_fetch_disassembly_command()
        if(cmd){
           GdbApi.run_gdb_command(cmd)
        }
    },
    /**
     * Save assembly and render source code if desired
     */
    save_new_assembly: function(mi_assembly){
        if(!_.isArray(mi_assembly) || mi_assembly.length === 0){
            console.error("Attempted to save unexpected assembly")
        }

        let assembly_to_save = {}
        for(let obj of mi_assembly){
            assembly_to_save[parseInt(obj.line)] = obj.line_asm_insn
        }

        let fullname = mi_assembly[0].fullname
        for (let cached_file of SourceCode.state.cached_source_files){
            if(cached_file.fullname === fullname){
                cached_file.assembly = assembly_to_save
                if (SourceCode.state.rendered_source_file_fullname === fullname){
                    // re render with our new disassembly
                    SourceCode.re_render()
                }
                break
            }
        }
    },
    /**
     * Scroll to a jQuery selection in the source code table
     * Used to jump around to various lines
     */
    scroll_to_jq_selector: function(jq_selector){
        if (jq_selector.length === 1){  // make sure a line is selected before trying to scroll to it
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
            // there is no line to scroll to
        }
    },
    /**
     * Current line has an id in the DOM and a variable
     * Remove the id and highlighting in the DOM, and set the
     * variable to null
     */
    remove_highlight: function(){
        SourceCode.state.line_highlighted = false
        let jq_current_line = $("#current_line")
        if (jq_current_line.length === 1){  // make sure a line is selected before trying to scroll to it
            jq_current_line.removeClass('highlight')  // remove current line id
        }
    },
    /**
     * Something in DOM triggered this callback to view a file.
     * The current target must have data embedded in it with:
     * fullname: full path of source code file to view
     * line (optional): line number to scroll to
     * hightlight (default: 'false'): if 'true', the line is highlighted
     */
    click_view_file: function(e){
        let fullname = e.currentTarget.dataset['fullname'],
            line = e.currentTarget.dataset['line'],
            highlight = e.currentTarget.dataset['highlight'] === 'true',
            addr = e.currentTarget.dataset['addr']
        SourceCode.fetch_and_render_file(fullname, line, addr, {'highlight': highlight, 'scroll': true})
    },
    keydown_jump_to_line: function(e){
        if (e.keyCode === ENTER_BUTTON_NUM){
            let line = e.currentTarget.value
            SourceCode.jump_to_line(line)
        }
    },
    jump_to_line: function(line){
        let jq_selector = $(`.line_num[data-line=${line}]`)
        SourceCode.scroll_to_jq_selector(jq_selector)
    },
    program_exited: function(){
        SourceCode.remove_highlight()
        SourceCode.clear_cached_source_files()
    },
    get_link_to_view_file: function(fullname, line=0, addr='', highlight='false', text='View'){
        // create local copies so we don't modify the references
        let _fullname = fullname
            , _line = line
            , _addr = addr
            , _highlight = highlight
            , _text = text
        return `<a class='view_file pointer' data-fullname=${_fullname} data-line=${_line} data-addr=${_addr} data-highlight=${_highlight}>${_text}</a>`
    }
}

/**
 * The autocomplete dropdown of source files is complicated enough
 * to have its own component. It uses the awesomeplete library,
 * which is really nice: https://leaverou.github.io/awesomplete/
 */
const SourceFileAutocomplete = {
    el: $('#source_file_input'),
    init: function(){
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
        Awesomplete.$('.dropdown-btn').addEventListener("click", function() {
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
            let fullname = e.currentTarget.value,
                line = 1
            SourceCode.fetch_and_render_file(fullname, 1, undefined, {'highlight': false, 'scroll': true})
        })
    },
    keyup_source_file_input: function(e){
        if (e.keyCode === ENTER_BUTTON_NUM){
            let user_input = _.trim(e.currentTarget.value)

            if(user_input.length === 0){
                return

            }

            // if user enterted "/path/to/file.c:line", be friendly and parse out the line for them
            let user_input_array = user_input.split(':'),
                file = user_input_array[0],
                line = 1
            if(user_input_array.length === 2){
                line = user_input_array[1]
            }

            SourceCode.fetch_and_render_file(file, line, undefined, {'highlight': false, 'scroll': true})
        }
    }
}

/**
 * The Registers component
 */
const Registers = {
    el: $('#registers'),
    state: {
        register_names: [],
        register_values: {},
    },
    render_registers(register_values){
        if(Registers.state.register_names.length === register_values.length){
            let columns = ['name', 'value (hex)', 'value (decimal)']
            , register_table_data = []
            , hex_val_raw = ''

            for (let i in Registers.state.register_names){
                let name = Registers.state.register_names[i]
                    , obj = _.find(register_values, v => v['number'] === i)
                    , hex_val_raw = ''
                    , disp_hex_val = ''
                    , disp_dec_val = ''

                if (obj){
                    let old_hex_val = Registers.state.register_values[i]
                        , changed = false
                    hex_val_raw = obj['value']

                    // if the value changed, highlight it
                    if(old_hex_val !== undefined && hex_val_raw !== old_hex_val){
                        changed = true
                    }

                    // if hex value is a valid value, convert it to a link
                    // and display decimal format too
                    if(obj['value'].indexOf('0x') === 0){
                       disp_hex_val = Memory.make_addr_into_link(hex_val_raw)
                       disp_dec_val = parseInt(obj['value'], 16).toString(10)
                    }

                    if (changed){
                        name = `<span class='highlight bold'>${name}</span>`
                        disp_hex_val = `<span class='highlight bold'>${disp_hex_val}</span>`
                        disp_dec_val = `<span class='highlight bold'>${disp_dec_val}</span>`
                    }

                }
                // update cached value for this register
                Registers.state.register_values[i] = hex_val_raw

                register_table_data.push([name, disp_hex_val, disp_dec_val])

            }

            Registers.el.html(Util.get_table(columns, register_table_data))
        } else {
            console.error('Could not render registers. Length of names != length of values!')
        }
    },
    set_register_names: function(names){
        // filter out non-empty names
        Registers.state.register_names = names.filter(name => name)
    },
    program_exited: function(){
        Registers.el.html('')
    }
}

/**
 * Preferences object
 * The intent of this is to have UI inputs that set and store
 * preferences. These preferences will be saved to localStorage
 * between sessions. (This is still in work)
 */
const Prefs = {
    auto_reload_breakpoints: function(){
        // todo add checkboxes in a UI widget
        return true
    }
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
    onclose: function(){
        localStorage.setItem('past_binaries', JSON.stringify(BinaryLoader.past_binaries) || [])
        return null
    },
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

        if (binary_and_args === ''){
            Status.render('enter a binary path before attempting to load')
            return
        }

        // save to list of binaries used that autopopulates the input dropdown
        _.remove(BinaryLoader.past_binaries, i => i === binary_and_args)
        BinaryLoader.past_binaries.unshift(binary_and_args)
        BinaryLoader.render_past_binary_options_datalist()

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
        cmds = [`-exec-arguments ${args}`, `-file-exec-and-symbols ${binary}`, '-file-list-exec-source-files']

        if($('#checkbox_auto_add_breakpoint_to_main').prop('checked')){
            cmds.push('-break-insert main')
        }
        cmds.push('-break-list')

        GdbApi.run_gdb_command(cmds)
    },
    render: function(binary){
        BinaryLoader.el.val(binary)
    },
}

/**
 * The GdbCommandInput component
 */
const GdbCommandInput = {
    el: $('#gdb_command'),
    init: function(){
        GdbCommandInput.el.keydown(GdbCommandInput.keydown_on_gdb_cmd_input)
        $('.run_gdb_command').click(GdbCommandInput.run_current_command)
    },
    keydown_on_gdb_cmd_input: function(e){
        if(e.keyCode === ENTER_BUTTON_NUM) {
            GdbCommandInput.run_current_command()
        }
    },
    run_current_command: function(){
        let cmd = GdbCommandInput.el.val()
        GdbCommandInput.clear()
        GdbConsoleComponent.add_sent_commands(cmd)
        GdbApi.run_gdb_command(cmd)
    },
    set_input_text: function(new_text){
        GdbCommandInput.el.val(new_text)
    },
    make_flash: function(){
        GdbCommandInput.el.removeClass('flash')
        GdbCommandInput.el.addClass('flash')
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
    init: function(){
        $("body").on("click", ".memory_address", Memory.click_memory_address)
        Memory.el_start.keydown(Memory.keydown_in_memory_inputs)
        Memory.el_end.keydown(Memory.keydown_in_memory_inputs)
    },
    state: {
        cache: {},
    },
    keydown_in_memory_inputs: function(e){
        if (e.keyCode === ENTER_BUTTON_NUM){
            Memory.fetch_memory_from_inputs()
        }
    },
    click_memory_address: function(e){
        let addr = e.currentTarget.dataset['memory_address']
        // set inputs in DOM
        Memory.el_start.val('0x' + (parseInt(addr, 16)).toString(16))
        Memory.el_end.val('0x' + (parseInt(addr,16) + 12).toString(16))

        // fetch memory from whatever's in DOM
        Memory.fetch_memory_from_inputs()
    },
    get_gdb_commands_from_inputs: function(){
        const MAX_ADDRESS_DELTA = 100

        let start_addr = parseInt(_.trim(Memory.el_start.val()), 16),
            end_addr = parseInt(_.trim(Memory.el_end.val()), 16)

        let cmds = []
        if(start_addr && end_addr){
            if(start_addr > end_addr || ((end_addr - start_addr) > MAX_ADDRESS_DELTA)){
                end_addr = start_addr + MAX_ADDRESS_DELTA
                Memory.el_end.val('0x' + end_addr.toString(16))
            }

            let cur_addr = start_addr
            while(cur_addr <= end_addr){
                cmds.push(`-data-read-memory-bytes ${'0x' + cur_addr.toString(16)} 1`)
                cur_addr = cur_addr + 1
            }
        }
        return cmds
    },
    fetch_memory_from_inputs: function(){
        let cmds = Memory.get_gdb_commands_from_inputs()
        Memory.clear_cache()
        GdbApi.run_gdb_command(cmds)
    },
    render: function(){
        if(!Memory.state.cache){
            Memory.el.html('')
            return
        }

        let data = []
        for (let hex_addr in Memory.state.cache){
            let hex_value = Memory.state.cache[hex_addr]
            data.push([Memory.make_addr_into_link(hex_addr),
                    Memory.make_addr_into_link('0x'+hex_value),
                    parseInt(hex_value, 16).toString(10),
                    String.fromCharCode(parseInt(hex_value, 16) || ' ')
                ]
            )

        }
        let table = Util.get_table(['address', 'value (hex)', 'value (decimal)', 'value (char)'], data)
        Memory.el.html(table)
    },
    make_addr_into_link: function(addr, name=addr){
        let _addr = addr
            , _name = name
        return `<a class='pointer memory_address' data-memory_address='${_addr}'>${_name}</a>`
    },
    add_value_to_cache: function(hex_str, hex_val){
        Memory.state.cache[hex_str] = hex_val
        Memory.render()
    },
    clear_cache: function(){
        Memory.state.cache = []
    },
    program_exited: function(){
        Memory.clear_cache()
        Memory.render()
    }
}

/**
 * The Variables component allows the user to inspect expressions
 * stored as variables in gdb
 * see https://sourceware.org/gdb/onlinedocs/gdb/GDB_002fMI-Variable-Objects.html#GDB_002fMI-Variable-Objects
 *
 * gdb assigns a unique variable name for each expression the user wants evaluated
 * gdb returns
 */
const Variables = {
    el: $('#variables'),
    el_input: $('#variable_input'),
    init: function(){
        // create new var when enter is pressed
        Variables.el_input.keydown(Variables.keydown_on_input)

        // remove var when icon is clicked
        $("body").on("click", ".delete_gdb_variable", Variables.click_delete_gdb_variable)
        $("body").on("click", ".toggle_children_visibility", Variables.click_toggle_children_visibility)
        Variables.render()
    },
    state: {
        waiting_for_create_var_response: false,
        waiting_for_children_list_response: false,
        children_being_retrieve_for_var: null,
        expression_being_created: null,
        variables: []
    },
    /**
     * Locally save the variable to our cached variables
     */
    save_new_variable: function(expression, obj){
        let new_obj = Variables.prepare_gdb_obj_for_storage(obj)
        new_obj.expression = expression
        Variables.state.variables.push(new_obj)
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
    get_obj_from_gdb_var_name: function(gdb_var_name){
        // gdb provides names in dot notation
        let gdb_var_names = gdb_var_name.split('.'),
            top_level_var_name = gdb_var_names[0],
            children_names = gdb_var_names.slice(1, gdb_var_names.length)

        let objs = Variables.state.variables.filter(v => v.name === top_level_var_name)

        if(objs.length === 1){
            // we found our top level object
            let obj = objs[0]
            let name_to_find = top_level_var_name
            for(let i = 0; i < (children_names.length); i++){
                // append the '.' and field name to find as a child of the object we're looking at
                name_to_find += `.${children_names[i]}`

                let child_obj = Variables.get_child_with_name(obj.children, name_to_find)

                if(child_obj){
                    // our new object to search is this child
                    obj = child_obj
                }else{
                    console.error(`could not find ${name_to_find}`)
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
            let expr = Variables.el_input.val()
            if(_.trim(expr) !== ''){
                Variables.create_variable(Variables.el_input.val())
            }
        }
    },
    /**
     * Create a new variable in gdb. gdb automatically assigns
     * a unique variable name. Use custom callback callback_after_create_variable to handle
     * gdb response
     */
    create_variable: function(expression){
        if(Variables.waiting_for_create_var_response === true){
            Status.render(`cannot create a new variable before finishing creation of expression "${Variables.state.expression_being_created}"`)
            return
        }
        Variables.state.waiting_for_create_var_response = true
        Variables.expression_being_created = expression
        // - means auto assign variable name in gdb
        // * means evaluate it at the current frame
        // need to use custom callback due to stateless nature of gdb's response
        // Variables.callback_after_create_variable
        GdbApi.run_gdb_command(`-var-create - * ${expression}`)
    },
    /**
     * gdb returns objects for its variables,, but before we save that
     * data locally, we want to add a little more metadata to make it more useful
     *
     * this method does the following:
     * - add the children array
     * - convert numchild string to integer
     * - store whether the object is expanded or collapsed in the ui
     */
    prepare_gdb_obj_for_storage: function(obj){
        let new_obj = jQuery.extend(true, {'children': [],
                                    'numchild': parseInt(obj.numchild),
                                    'show_children_in_ui': false,
                                    'in_scope': 'true', // this field will be returned by gdb mi as a string
                                }, obj)
        return new_obj
    },
    /**
     * After a variable is created, we need to link the gdb
     * variable name (which is automatically created by gdb),
     * and the expression the user wanted to evailuate. The
     * new variable is saved locally.
     *
     * The variable UI element is the re-rendered
     */
    gdb_created_root_variable: function(r){
        Variables.state.waiting_for_create_var_response = false

        if(Variables.expression_being_created){
            // example payload:
            // "payload": {
            //      "has_more": "0",
            //      "name": "var2",
            //      "numchild": "0",
            //      "thread-id": "1",
            //      "type": "int",
            //      "value": "0"
            //  },
            Variables.save_new_variable(Variables.expression_being_created, r.payload)
            Variables.state.expression_being_created = null
        }else{
            console.error('could no create new var')
        }

        Variables.render()
    },
    /**
     * Got data regarding children of a gdb variable. It could be an immediate child, or grandchild, etc.
     * This method stores this child array data to the appropriate locally stored
     * object, then re-renders the Variable UI element.
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

        let parent_name = Variables.state.gdb_parent_var_currently_fetching_children
        Variables.state.gdb_parent_var_currently_fetching_children = null
        Variables.state.waiting_for_children_list_response = false

        // get the parent object of these children
        let parent_obj = Variables.get_obj_from_gdb_var_name(parent_name)
        if(parent_obj){
            // prepare all the child objects we received for local storage
            let children = r.payload.children.map(child_obj => Variables.prepare_gdb_obj_for_storage(child_obj))
            // save these children as a field to their parent
            parent_obj.children = children
        }
        // re-render
        Variables.render()
    },
    render: function(){
        let html = ''
        const is_root = true
        for(let obj of Variables.state.variables){
            if(obj.in_scope === 'true'){
                if(obj.numchild > 0) {
                    html += Variables.get_ul_for_var_with_children(obj.expression, obj, is_root)
                }else{
                    html += Variables.get_ul_for_var_without_children(obj.expression, obj, is_root)
                }
            }else if (obj.in_scope === 'invalid'){
                console.log(`deleting invalid gdb var ${obj.name}`)
                Variables.delete_gdb_variable(obj.name)
            }
        }

        Variables.el.html(html)
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
                        child_tree += `<li>${Variables.get_ul_for_var_with_children(child.exp, child)}</li>`
                    }else{
                        child_tree += `<li>${Variables.get_ul_for_var_without_children(child.exp, child)}</li>`
                    }
                }
            }else{
                child_tree += `<li><span class='glyphicon glyphicon-refresh glyphicon-refresh-animate'></span></li>`
            }

            child_tree += '</ul>'
        }

        let plus_or_minus = mi_obj.show_children_in_ui ? '-' : '+'
        return Variables._get_ul_for_var(expression, mi_obj, is_root, plus_or_minus, child_tree, mi_obj.show_children_in_ui, mi_obj.numchild)
    },
    get_ul_for_var_without_children: function(expression, mi_obj, is_root=false){
        return Variables._get_ul_for_var(expression, mi_obj, is_root)
    },
    /**
     * Get ul for a variable with or without children
     * @param is_root: true if it has children and
     */
    _get_ul_for_var: function(expression, mi_obj, is_root, plus_or_minus='', child_tree='', show_children_in_ui=false, numchild=0){
        let
            delete_button = is_root ? `<span class='glyphicon glyphicon-trash delete_gdb_variable pointer' data-gdb_variable='${mi_obj.name}' />` : '',
            expanded = show_children_in_ui ? 'expanded' : '',
            toggle_classes = numchild > 0 ? 'toggle_children_visibility pointer' : ''

        return `<ul class='variable'>
            <li class='${toggle_classes} ${expanded}' data-gdb_variable_name='${mi_obj.name}'>
                ${delete_button}
                ${plus_or_minus} ${expression}: ${mi_obj.value} <span class='var_type'>${_.trim(mi_obj.type)}</span>
            </li>
            ${child_tree}
        </ul>
        `
    },
    click_toggle_children_visibility: function(e){
        let gdb_var_name = e.currentTarget.dataset.gdb_variable_name
        let obj = Variables.get_obj_from_gdb_var_name(gdb_var_name)

        if($(e.currentTarget).hasClass('expanded')){
            // collapse
            obj.show_children_in_ui = false
        }else{
            // show
            obj.show_children_in_ui = true
            if(obj.children.length === 0){
                // need to fetch child data
                Variables._get_children_for_var(gdb_var_name)
            }
        }
        $(e.currentTarget).toggleClass('expanded')
        Variables.render()
    },
    /**
     * Send command to gdb to give us all the children and values
     * for a gdb variable. Note that the gdb variable itself may be a child.
     */
    _get_children_for_var: function(gdb_variable_name){
        if(Variables.state.waiting_for_children_list_response === true){
            Status.render(`cannot search for children of ${gdb_variable_name} while waiting for response from ${Variables.state.gdb_parent_var_currently_fetching_children}`)
            return
        }
        Variables.state.gdb_parent_var_currently_fetching_children = gdb_variable_name
        Variables.state.waiting_for_children_list_response = true
        GdbApi.run_gdb_command(`-var-list-children --all-values ${gdb_variable_name}`)
    },
    update_variable_values: function(){
        GdbApi.run_gdb_command(`-var-update *`)
    },
    handle_changelist: function(changelist_array){
        for(let c of changelist_array){
            let obj = Variables.get_obj_from_gdb_var_name(c.name)
            if(obj){
                _.assign(obj, c)
            }
        }
        Variables.render()
    },
    click_delete_gdb_variable: function(e){
        e.stopPropagation() // not sure if this is still needed
        Variables.delete_gdb_variable(e.currentTarget.dataset.gdb_variable)
    },
    delete_gdb_variable: function(gdbvar){
        // delete locally
        Variables._delete_local_gdb_var_data(gdbvar)
        // delete in gdb too
        GdbApi.run_gdb_command(`-var-delete ${gdbvar}`)
        // re-render variables in browser
        Variables.render()
    },
    /**
     * Delete local copy of gdb variable (all its children are deleted too
     * since they are stored as fields in the object)
     */
    _delete_local_gdb_var_data: function(gdb_var_name){
        _.remove(Variables.state.variables, v => v.name === gdb_var_name)
    },
}

/**
 * The Threads component
 */
const Threads = {
    el: $('#threads'),
    state: {
        'threads': [],
        'current_thread_id': undefined,
        'stack': []
    },
    init: function(){
        $("body").on("click", ".select_thread_id", Threads.click_select_thread_id)
        $("body").on("click", ".select_frame", Threads.click_select_frame)
    },
    set_stack: function(stack){
        Threads.state.stack =  $.extend(true, [], stack)
    },
    program_exited: function(){
        Threads.clear()
    },
    clear: function(){
        Threads.state.threads = []
        Threads.state.current_thread_id = undefined
        Threads.state.stack = []
        Threads.render()
    },
    click_select_thread_id: function(e){
        GdbApi.run_gdb_command(`-thread-select ${e.currentTarget.dataset.thread_id}`)
        GdbApi.refresh_stack()
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
        GdbApi.run_gdb_command(`-stack-select-frame ${framenum}`)
        GdbApi.refresh_stack()
    },
    render: function(){
        if(Threads.state.current_thread_id && Threads.state.threads.length > 0){
            let tbody = []
            for(let t of Threads.state.threads){
                let cls = ''
                , stack = '?'
                , select_thread_link = ''
                if(parseInt(t.id) === Threads.state.current_thread_id){
                    cls = 'bold'
                } else {
                    select_thread_link = `<a class='select_thread_id pointer' data-thread_id='${t.id}'>select this thread</a>`
                }
                // each thread has a frame, but only the current frame in the current thread
                // is part of the stack
                // get the frame, and if t's frame is part of the stack, render the whole stack
                stack = Threads.get_stack_list([t.frame])

                for (let s of Threads.state.stack){
                    if(s.addr === t.frame.addr){
                        stack = Threads.get_stack_list(Threads.state.stack)
                        break
                    }
                }

                tbody.push([`<span class=${cls}>id ${t.id}, core ${t.core} (${t.state}) ${select_thread_link}</span>`, stack])
            }
            Threads.el.html(Util.get_table(['thread', 'stack'], tbody))
        }else{
            Threads.el.html('')
        }
    },
    get_stack_list: function(stack){
        let _stack = $.extend(true, [], stack)
            , stack_list = []


        for (let s of _stack){
            let fullname = 'unknown filename'
                , line = 'unknown line'
                , addr_link = 'unknown address'

            if ('fullname' in s){
                fullname = s.fullname
            }else if ('file' in s){
                fullname = s.file
            }
            if ('addr' in s){
                addr_link = Memory.make_addr_into_link(s.addr)
            }
            if('line' in s){
                line = s.line
            }

            let hightlight = true
                , view_link = SourceCode.get_link_to_view_file(fullname, line, s.addr, hightlight, `${fullname}:${line}`)
                , select_frame_link = ''

            if(s.level){
                select_frame_link = `<span class='pointer select_frame' data-framenum=${s.level}>select frame</span>`
            }

            stack_list.push(`<li>${view_link} ${addr_link} ${select_frame_link}</li>`)
        }

        return `<ul class='no_bullet'>
            ${stack_list.join('')}
        </ul>
        `
    },
    set_threads: function(threads){
        Threads.state.threads = $.extend(true, [], threads)
        Threads.render()
    },
    set_thread_id: function(id){
        Threads.state.current_thread_id = parseInt(id)
        Threads.render()
    },
}

/**
 * Component with checkboxes that allow the user to show/hide various components
 */
const ShowHideComponents = {
    el: $('#show_hide_components'),
    /**
     * Set up events and render checkboxes
     */
    init: function(){
        $("body").on("change", "input.componet_visibility_checkbox", ShowHideComponents.update_component_visibility_based_on_checkboxes)
        ShowHideComponents.render()
    },
    /**
     * Render the checkboxes and update visibility of components as defined by
     * the checkboxes
     */
    render: function(){
        let html = ''
        for (let i of $('.allow_visibility_toggle')){
            let name = $(i).data('name_for_visibility_toggling'),
                visibile_on_load = ($(i).data('visibile_on_load') === 'true' || $(i).data('visibile_on_load') === undefined),
                checked = visibile_on_load ? 'checked' : ''
            html += ` <div class="checkbox">
                  <label>
                    <input type="checkbox" ${checked} class='componet_visibility_checkbox' data-name_for_visibility_toggling="${name}"> ${name}
                  </label>
            </div>  `
        }
        ShowHideComponents.el.html(html)
        ShowHideComponents.update_component_visibility_based_on_checkboxes()
    },
    /**
     * Update visibility of components as defined by
     * the checkboxes
     */
    update_component_visibility_based_on_checkboxes: function(){
        for (let el of $('.componet_visibility_checkbox')){
            let jq_el = $(el)
            let name = jq_el.data('name_for_visibility_toggling'),
                el_to_toggle = $(`.allow_visibility_toggle[data-name_for_visibility_toggling='${name}']`)
            if(jq_el.prop('checked')){
                // make visible
                el_to_toggle.removeClass('hidden')
            } else {
                // hide
                el_to_toggle.addClass('hidden')
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
        if (window.confirm("This will end your gdbgui session. Continue?") === true) {
            // ShutdownGdbgui.shutdown()
            window.location = '/shutdown'
        } else {
            // don't do anything
        }
    },

}


/**
 * An object with methods for global events/callbacks
 * that apply to the whole page
 */
const GlobalEvents = {
    // Initialize
    init: function(){
        GlobalEvents.register_events()
    },
    // Event handling
    register_events: function(){
        $(window).keydown(function(e){
            if((e.keyCode === ENTER_BUTTON_NUM)) {
                // when pressing enter in an input, don't redirect entire page
                e.preventDefault()
            }
        })

        $("body").on("click", ".resizer", GlobalEvents.click_resizer_button)
    },
    click_resizer_button: function(e){
        let jq_selection = $(e.currentTarget.dataset['target_selector'])
        let cur_height = jq_selection.height()
        if (e.currentTarget.dataset['resize_type'] === 'enlarge'){
            jq_selection.height(cur_height + 50)
        } else if (e.currentTarget.dataset['resize_type'] === 'shrink'){
            if (cur_height > 50){
                jq_selection.height(cur_height - 50)
            }
        } else {
            console.error('unknown resize type ' + e.currentTarget.dataset['resize_type'])
        }
    },
}

const WebSocket = {
    init: function(){
        var socket = io.connect(`http://${document.domain}:${location.port}/gdb_listener`);

        socket.on('connect', function(){
            // console.log('connected')
            // socket.emit('my_event', {data: 'I\'m connected!'});
        });

        socket.on('gdb_response', function(response_array) {
            // console.log(response_array)
            process_gdb_response(response_array)
        });

        socket.on('disconnect', function(){
            // console.log('disconnected')
        });
    }
}

/**
 * This is the main callback when receiving a response from gdb.
 * This callback requires no state to handle the response.
 * This callback calls the appropriate methods of other Components,
 * and updates the status bar.
 */
const process_gdb_response = function(response_array){

    // update status with error or with last response
    let update_status = true,
        refresh_breakpoints = false,
        refresh_stack = false

    for (let r of response_array){
        if (r.type === 'result' && r.message === 'done' && r.payload){
            // This is special GDB Machine Interface structured data that we
            // can render in the frontend
            if ('bkpt' in r.payload){
                // breakpoint was created
                Breakpoint.store_breakpoint(r.payload.bkpt)
                Breakpoint.render_breakpoint_table()
                SourceCode.fetch_and_render_file(r.payload.bkpt.fullname, r.payload.bkpt.line, undefined, {'highlight': false, 'scroll': true})
                refresh_breakpoints = true
            }
            if ('BreakpointTable' in r.payload){
                Breakpoint.assign_breakpoints_from_mi_breakpoint_table(r.payload)
                SourceCode.render_breakpoints()
            }
            if ('stack' in r.payload) {
                Threads.set_stack(r.payload.stack)
            }
            if('threads' in r.payload){
                Threads.set_threads(r.payload.threads)
                Threads.set_thread_id((r.payload['current-thread-id']))
            }
            if ('register-names' in r.payload) {
                Registers.set_register_names(r.payload['register-names'])
            }
            if ('register-values' in r.payload) {
                Registers.render_registers(r.payload['register-values'])
            }
            if ('asm_insns' in r.payload) {
                SourceCode.save_new_assembly(r.payload.asm_insns)
            }
            if ('files' in r.payload){
                SourceFileAutocomplete.input.list = _.uniq(r.payload.files.map(f => f.fullname)).sort()
            }
            if ('memory' in r.payload){
                Memory.add_value_to_cache(r.payload.memory[0].begin, r.payload.memory[0].contents)
            }
            // if ('locals' in r.payload){
            //     AllLocalVariables.render(r.payload.locals)
            // }
            if ('changelist' in r.payload){
                Variables.handle_changelist(r.payload.changelist)
            }
            if ('name' in r.payload && 'thread-id' in r.payload && 'has_more' in r.payload &&
                'value' in r.payload && !('children' in r.payload)){
                Variables.gdb_created_root_variable(r)
            }
            if('has_more' in r.payload && 'numchild' in r.payload && 'children' in r.payload){
                Variables.gdb_created_children_variables(r)
            }
            // if (your check here) {
            //      render your custom compenent here!
            // }

        } else if (r.type === 'console'){
            GdbConsoleComponent.add(r.payload)
            if(globals.gdb_version === undefined){
                // parse gdb version from string such as
                // GNU gdb (Ubuntu 7.7.1-0ubuntu5~14.04.2) 7.7.
                let m = /GNU gdb \(.*\)\s*(.*)\./g
                let a = m.exec(r.payload)
                if(_.isArray(a) && a.length === 2){
                    globals.gdb_version = parseFloat(a[1])
                    localStorage.setItem('gdb_version', globals.gdb_version)
                }
            }
        }

        if (r.type === 'output'){
            // output of program
            GdbConsoleComponent.add(r.payload)
        }else{
            // gdb mi output
            GdbMiOutput.add_mi_output(r)
        }

        if (r.payload && typeof r.payload.frame !== 'undefined') {
            // Stopped on a frame. We can render the file and highlight the line!
            SourceCode.fetch_and_render_file(r.payload.frame.fullname, r.payload.frame.line, r.payload.frame.addr, {'highlight': true, 'scroll': true})

            if (r.payload['new-thread-id']){
                Threads.set_thread_id(r.payload['new-thread-id'])
            }
        }

        if (r.message && r.message === 'stopped' && r.payload && r.payload.reason){
            if(r.payload.reason.includes('exited')){
                // TODO emit event
                SourceCode.program_exited()
                Memory.program_exited()
                Registers.program_exited()
                Threads.program_exited()

            }else if (r.payload.reason.includes('breakpoint-hit') || r.payload.reason.includes('end-stepping-range')){
                refresh_stack = true
                refresh_breakpoints = true
            }
        }

        if(update_status && _.isString(r.message) && (r.message.indexOf('error') !== -1 || r.message.indexOf('not found') !== -1)){
            Status.render_from_gdb_mi_response(r)
            update_status = false
        }
    }

    if(update_status){
        // render response of last element of array
        Status.render_from_gdb_mi_response(_.last(response_array))
        update_status = false
    }

    if(response_array.length > 0){
        // scroll to the bottom
        GdbMiOutput.scroll_to_bottom()
        GdbConsoleComponent.scroll_to_bottom()
    }

    if(refresh_breakpoints === true){
        GdbApi.refresh_breakpoints()
    }
    if(refresh_stack === true){
        GdbApi.refresh_stack()
    }
}

// initialize components
GlobalEvents.init()
GdbApi.init()
GdbCommandInput.init()
GdbConsoleComponent.init()
GdbMiOutput.init()
SourceCode.init()
BinaryLoader.init()
SourceFileAutocomplete.init()
Memory.init()
Variables.init()
Threads.init()
ShowHideComponents.init()
ShutdownGdbgui.init()
WebSocket.init()

window.addEventListener("beforeunload", BinaryLoader.onclose)

})(jQuery, _, Awesomplete, io)
