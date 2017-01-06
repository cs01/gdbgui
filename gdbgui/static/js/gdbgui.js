/**
 * This is the main frontend file to make
 * an interactive ui for gdb. Besides libraries,
 * everything exists in this single js file. There
 * are several components, each of which have their
 * own top-level object.
 */

(function ($, _, Awesomplete) {
"use strict";

const ENTER_BUTTON_NUM = 13

const Status = {
    el: $('#status'),
    render: function(status){
        Status.el.text(status)
    },
    render_ajax_error_msg: function(data){
        if (data.responseJSON && data.responseJSON.message){
            Status.render(_.escape(data.responseJSON.message))
        }else{
            Status.render(`${data.statusText} (${data.status} error)`)
        }
    },
    render_from_gdb_mi_response: function(mi_obj){
        if(!mi_obj){
            Status.render('empty response')
            return
        }
        // Update status
        let status = [];
        if (mi_obj.message){
            status.push(mi_obj.message)
        }
        if (mi_obj.payload){
            if (mi_obj.payload.msg) {status.push(mi_obj.payload.msg)}
            if (mi_obj.payload.reason) {status.push(mi_obj.payload.reason)}
            if (mi_obj.payload.frame){
                for(let i of ['file', 'func', 'line']){
                    if (i in mi_obj.payload.frame){
                        status.push(`${i}: ${mi_obj.payload.frame[i]}`)
                    }
                }
            }
        }
        Status.render(status.join(', '))
    }
}

const GdbApi = {
    init: function(){
        $("body").on("click", ".gdb_cmd", GdbApi.click_gdb_cmd_button)
        $("body").on("click", ".get_gdb_response", GdbApi.get_gdb_response)
        $('#stop_gdb').click(GdbApi.stop_gdb)
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
            while(cmd !== undefined && i < 10){
                cmds.push(cmd)
                i++
                cmd = e.currentTarget.dataset[`cmd${i}`]
            }
            GdbApi.run_gdb_command(cmds)
        }else{
            console.error('expected cmd or cmd0 [cmd1, cmd2, ...] data attribute(s) on element')
        }
    },
    stop_gdb: function(){
        $.ajax({
            url: "/stop_gdb",
            cache: false,
            type: 'GET',
            success: function(data){
                Status.render('gdb has exited')
            },
            error: Status.render_ajax_error_msg
        })
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
        History.save_to_history(cmds)
        GdbConsoleComponent.add_sent_commands(cmds)
        $.ajax({
            url: "/run_gdb_command",
            cache: false,
            method: 'POST',
            data: {'cmd': cmd},
            success: success_callback,
            error: Status.render_ajax_error_msg,
        })
    },
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

const Util = {
    get_table: function(columns, data) {
        var result = ["<table class='table table-striped table-bordered table-condensed'>"];
        result.push("<thead>")
        result.push("<tr>")
        for (let h of columns){
            result.push(`<th>${h}</th>`)
        }
        result.push("</tr>")
        result.push("</thead>")
        result.push("<tbody>")
        for(let row of data) {
                result.push("<tr>")
                for(let cell of row){
                        result.push(`<td>${cell}</td>`)
                }
                result.push("</tr>")
        }
        result.push("</tbody>")
        result.push("</table>")
        return result.join('\n')
    },
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
    escape: function(s){
        return s.replace(/([^\\]\\n)/g, '<br>')
                .replace(/\\t/g, '&nbsp')
                .replace(/\\"+/g, '"')
    }
}

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
        GdbMiOutput.el.append(`<p class='pre ${text_class[mi_obj.type]} margin_sm output'>${mi_obj.type}:\n${JSON.stringify(mi_obj, null, 4).replace(/[^(\\)]\\n/g)}</span>`)
    },
    scroll_to_bottom: function(){
        GdbMiOutput.el.animate({'scrollTop': GdbMiOutput.el.prop('scrollHeight')})
    }
}

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
        let bkpt = _.assign(breakpoint)
        // turn fullname into a link with classes that allows us to click and view the file/context of the breakpoint
        let links = []
        if ('fullname' in breakpoint){
             links.push(`<a class='view_file pointer' data-fullname=${breakpoint.fullname || ''} data-line=${breakpoint.line || ''} data-highlight=false>View</a>`)
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
    get_breakpoint_lines_For_file: function(fullname){
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

const SourceCode = {
    el: $('#code_table'),
    el_code_container: $('#code_container'),
    el_title: $('#source_code_heading'),
    rendered_source_file_fullname: null,
    rendered_source_file_line: null,
    init: function(){
        $("body").on("click", ".source_code_row td .line_num", SourceCode.click_gutter)
        $("body").on("click", ".view_file", SourceCode.click_view_file)
    },
    cached_source_files: [],  // list with keys fullname, source_code
    click_gutter: function(e){
        let line = e.currentTarget.dataset.line
        let has_breakpoint = (e.currentTarget.dataset.has_breakpoint === 'true')
        if(has_breakpoint){
            // clicked gutter with a breakpoint, remove it
            Breakpoint.remove_breakpoint_if_present(SourceCode.rendered_source_file_fullname, line)

        }else{
            // clicked with no breakpoint, add it, and list all breakpoints to make sure breakpoint table is up to date
            let cmd = [`-break-insert ${SourceCode.rendered_source_file_fullname}:${line}`, '-break-list']
            GdbApi.run_gdb_command(cmd)
        }
    },
    render_cached_source_file: function(){
        SourceCode.fetch_and_render_file(SourceCode.rendered_source_file_fullname, SourceCode.rendered_source_file_line, {'highlight': false, 'scroll': true})
    },
    is_cached: function(fullname){
        return SourceCode.cached_source_files.some(f => f.fullname === fullname)
    },
    render_source_file: function(fullname, source_code, current_line=0, options={'highlight': false, 'scroll': false}){
        current_line = parseInt(current_line)
        let line_num = 1,
            tbody = [],
            bkpt_lines = Breakpoint.get_breakpoint_lines_For_file(fullname)

        for (let line of source_code){
            let has_breakpoint = bkpt_lines.indexOf(line_num) !== -1
            let breakpoint_class = has_breakpoint ? 'breakpoint' : ''
            let tags = ''
            if (line_num === current_line){
              tags = `id=current_line ${options.highlight ? 'class=highlight' : ''}`
            }
            line = line.replace("<", "&lt;")
            line = line.replace(">", "&gt;")
            tbody.push(`
                <tr class='source_code_row'>
                    <td class='right_border'>
                        <div class='line_num ${breakpoint_class}' data-line=${line_num} data-has_breakpoint=${has_breakpoint}>${line_num}</div>
                    </td>

                    <td class='line_of_code'>
                        <pre ${tags}>${line}</pre>
                    </td>
                </tr>
                `)
            line_num++;
        }
        SourceCode.el_title.text(fullname)
        SourceCode.el.html(tbody.join(''))

        SourceCode.rendered_source_file_fullname = fullname
        SourceCode.rendered_source_file_line = current_line

        if(options.scroll){
            SourceCode.make_current_line_visible()
        }
    },
    // call this to rerender a file when breakpoints change, for example
    rerender: function(){
        if(_.isString(SourceCode.rendered_source_file_fullname)){
            SourceCode.fetch_and_render_file(SourceCode.rendered_source_file_fullname, SourceCode.rendered_source_file_line, {'highlight': false, 'scroll': false})
        }
    },
    // fetch file and render it, or used cached file if we have it
    fetch_and_render_file: function(fullname, current_line=0, options={'highlight': false, 'scroll': false}){
        if (!_.isString(fullname)){
            console.error('cannot render file without a name')

        } else if (SourceCode.is_cached(fullname)){
            // We have this cached locally, just use it!
            let f = _.find(SourceCode.cached_source_files, i => i.fullname === fullname)
            SourceCode.render_source_file(fullname, f.source_code, current_line, options)

        } else {
            $.ajax({
                url: "/read_file",
                cache: false,
                type: 'GET',
                data: {path: fullname},
                success: function(response){
                    SourceCode.cached_source_files.push({'fullname': fullname, 'source_code': response.source_code})
                    SourceCode.render_source_file(fullname, response.source_code, current_line, options)
                },
                error: function(response){
                    Status.render_ajax_error_msg(response)
                    let source_code = [`failed to fetch file ${fullname}`]
                    SourceCode.cached_source_files.push({'fullname': fullname, 'source_code': source_code})
                    SourceCode.render_source_file(fullname, source_code, 0, options)
                }
            })
        }
    },
    make_current_line_visible: function(){
        const time_to_scroll = 0
        let jq_current_line = $("#current_line")
        if (jq_current_line.length === 1){  // make sure a line is selected before trying to scroll to it
            let top_of_container = SourceCode.el_code_container.position().top,
                height_of_container = SourceCode.el_code_container.height(),
                bottom_of_container = top_of_container + height_of_container,
                top_of_line = jq_current_line.position().top,
                bottom_of_line = top_of_line+ jq_current_line.height(),
                top_of_table = jq_current_line.closest('table').position().top

            if ((top_of_line >= top_of_container) && (bottom_of_line < (bottom_of_container))){
                // do nothing, it's already in view
            }else{
                // line is out of view, scroll so it's in the middle of the table
                SourceCode.el_code_container.animate({'scrollTop': top_of_line - (top_of_table + height_of_container/2)}, 0)
            }

        }else{
            // there is no line to scroll to
        }
    },
    remove_current_line: function(){
        SourceCode.rendered_source_file_line = null
        let jq_current_line = $("#current_line")
        if (jq_current_line.length === 1){  // make sure a line is selected before trying to scroll to it
            jq_current_line.removeAttr('id')  // remove current line id
            jq_current_line.removeClass('highlight')  // remove current line id
        }
    },
    click_view_file: function(e){
        let fullname = e.currentTarget.dataset['fullname'],
            line = e.currentTarget.dataset['line'],
            highlight = e.currentTarget.dataset['highlight'] === 'true'
        SourceCode.fetch_and_render_file(fullname, line, {'highlight': highlight, 'scroll': true})
    }
}

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
            SourceCode.fetch_and_render_file(e.currentTarget.value)
        })
    },
    keyup_source_file_input: function(e){
        if (e.keyCode === ENTER_BUTTON_NUM){
            SourceCode.fetch_and_render_file(e.currentTarget.value)
        }
    },
}

const Disassembly = {
    el_title: $('#disassembly_heading'),
    el: $('#disassembly'),
    init: function(){
        $('button#refresh_disassembly').click(Disassembly.refresh_disassembly)
    },
    refresh_disassembly: function(e){
        let file = SourceCode.rendered_source_file_fullname
        let line = SourceCode.rendered_source_file_line
        if (file !== null && line !== null){
            line = Math.max(line - 10, 1)
            // https://sourceware.org/gdb/onlinedocs/gdb/GDB_002fMI-Data-Manipulation.html
            const mi_response_format = 4
            GdbApi.run_gdb_command(`-data-disassemble -f ${file} -l ${line} -- ${mi_response_format}`)
        } else {
            Status.render('gdbgui is not sure which file and line to disassemble. Reach a breakpoint, then try again.')
        }
    },
    render_disasembly: function(asm_insns){
        let thead = ['line', 'function+offset address instruction', 'source']
        let data = []
        let source_code = []
        for (let file of SourceCode.cached_source_files){
            if(file.fullname === asm_insns[0].fullname){
                source_code = file.source_code
                break
            }
        }
        for(let i of asm_insns){
            let assembly = i['line_asm_insn'].map(el => `${el['func-name']}+${el['offset']} ${Memory.make_addr_into_link(el.address)} ${el.inst}`)
            let line_link = `<a class='view_file pointer' data-fullname=${i.fullname || ''} data-line=${i.line || ''} data-highlight=false>${i.line} view</a>`
            let source_line = '(file not loaded)'
            if(i.line <= source_code.length){
                source_line = source_code[i.line - 1]
            }
            data.push([line_link, assembly.join('<br>'), source_line])
        }
        Disassembly.el_title.html(asm_insns['fullname'])
        Disassembly.el.html(Util.get_table(thead, data))
    },
}

const Stack = {
    el: $('#stack'),
    init: function(){
        $("body").on("click", ".select_frame", Stack.click_select_frame)
    },
    render_stack: function(stack){
        for (let s of stack){
            if ('fullname' in s){
                s[' '] = `<a class='select_frame pointer' data-fullname=${s.fullname} data-line=${s.line || ''} data-framenum=${s.level} data-highlight=true>View</a>`
            }
            if ('addr' in s){
                s.addr = Memory.make_addr_into_link(s.addr)
            }
        }

        let [columns, data] = Util.get_table_data_from_objs(stack)
        Stack.el.html(Util.get_table(columns, data))
    },
    /**
     * select a frame and jump to the line in source code
     * triggered when clicking on an object with the "select_frame" class
     * must have data attributes: framenum, fullname, line
     *
     */
    click_select_frame: function(e){
        Stack.select_frame(e.currentTarget.dataset.framenum)
        SourceCode.click_view_file(e)
        AllLocalVariables.clear()
    },
    select_frame: function(framenum){
        GdbApi.run_gdb_command(`-stack-select-frame ${framenum}`)
    }
}

const Registers = {
    el: $('#registers'),
    register_names: [],
    render_registers(register_values){
        if(Registers.register_names.length === register_values.length){
            let columns = ['name', 'value']
            let register_table_data = []

            for (let i in Registers.register_names){
                let name = Registers.register_names[i]
                let obj = _.find(register_values, v => v['number'] === i)
                if (obj){
                    register_table_data.push([name, obj['value']])
                }else{
                    register_table_data.push([name, ''])
                }
            }
            Registers.el.html(Util.get_table(columns, register_table_data))
        } else {
            console.error('Could not render registers. Length of names != length of values!')
        }
    },
    set_register_names: function(names){
        // filter out non-empty names
        Registers.register_names = names.filter(name => name)
    }
}

const Prefs = {
    auto_reload_breakpoints: function(){
        // todo add checkboxes in a UI widget
        return true
    }
}

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
    click_set_target_app: function(e){
        BinaryLoader.set_target_app()
    },
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
        cmds = [`-exec-arguments ${args}`, `-file-exec-and-symbols ${binary}`]

        // reload breakpoints after sending to make sure they're up to date
        if (Prefs.auto_reload_breakpoints()){
            cmds.push('-break-list')
        }
        GdbApi.run_gdb_command(cmds)

    },
    render: function(binary){
        BinaryLoader.el.val(binary)
    },
    keydown_on_binary_input: function(e){
        if(e.keyCode === ENTER_BUTTON_NUM) {
            BinaryLoader.set_target_app()
        }
    },
    render_past_binary_options_datalist: function(){
        BinaryLoader.el_past_binaries.html(BinaryLoader.past_binaries.map(b => `<option>${b}</option`))
    },
}

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

const Memory = {
    el: $('#memory'),
    init: function(){
        $("body").on("click", ".memory_address", Memory.click_memory_address)
    },
    click_memory_address: function(e){
        let addr = e.currentTarget.dataset['memory_address']
        GdbApi.run_gdb_command(` -data-read-memory-bytes ${addr} 1`)
    },
    render_memory: function(mi_memory_data){
        let data = mi_memory_data.map(m => _.values(m))
        let table = Util.get_table(_.keys(mi_memory_data[0]), data)
        Memory.el.html(table)
    },
    make_addr_into_link: function(addr){
        return `<a class='pointer memory_address' data-memory_address='${addr}'>${addr}</a>`
    }
}

/**
 * https://sourceware.org/gdb/onlinedocs/gdb/GDB_002fMI-Variable-Objects.html#GDB_002fMI-Variable-Objects
 */
const Variables = {
    el: $('#variables'),
    el_input: $('#variable_input'),
    init: function(){
        // create new var when enter is pressed
        Variables.el_input.keydown(Variables.keydown_on_input)

        // remove var when icon is clicked
        $("body").on("click", ".delete_gdb_variable", Variables.click_delete_gdb_variable)
        Variables.render()
    },
    state: {
        waiting_for_create_var_response: false,
        waiting_for_children_list_response: false,
        children_being_retrieve_for_var: null,
        expression_being_created: null,
        variables: []
    },
    save_new_variable: function(expression, gdb_var_name, mi_obj){
        Variables.state.variables.push({'expression': expression, 'gdb_var_name': gdb_var_name, 'mi_obj': mi_obj})
    },
    get_obj_from_gdb_var_name: function(gdb_var_name){
        let objs = Variables.state.variables.filter(v => v.gdb_var_name === gdb_var_name)
        if(objs.length === 1){
            return objs[0]
        }
        return undefined
    },
    get_obj_from_expression: function(expression){
        let objs = Variables.state.variables.filter(v => v.expression === expression)
        if(objs.length === 1){
            return objs[0]
        }
        return undefined
    },
    get_expression_from_gdb_var_name: function(gdb_var_name){
        let objs = Variables.state.variables.filter(v => v.gdb_var_name === gdb_var_name)
        if(objs.length === 1){
            return objs[0].expression
        }
        return undefined
    },
    delete_local_gdb_var_data: function(gdb_var_name){
        _.remove(Variables.state.variables, v => v.gdb_var_name === gdb_var_name)
    },
    keydown_on_input: function(e){
        if((e.keyCode === ENTER_BUTTON_NUM)) {
            let expr = Variables.el_input.val()
            if(_.trim(expr) !== ''){
                Variables.create_variable(Variables.el_input.val())
            }
        }
    },
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
        GdbApi.run_gdb_command(`-var-create - * ${expression}`, Variables.callback_after_create_variable)
    },
    callback_after_create_variable: function(mi_response_array){
        Variables.state.waiting_for_create_var_response = false

        mi_response_array.map(r => GdbMiOutput.add_mi_output(r))

        if(mi_response_array.length === 1){
            let r = mi_response_array[0]
            if(r.type === 'result' && r.message === 'done'){
               // an example payload:
               // "payload": {
               //      "has_more": "0",
               //      "name": "var2",
               //      "numchild": "0",
               //      "thread-id": "1",
               //      "type": "int",
               //      "value": "0"
               //  },

               // add the children key and initialize to empty array
                r.payload.children = []

                // save this payload
                Variables.save_new_variable(Variables.expression_being_created, r.payload.name, r.payload)

                // // fetch info on children if necessary
                // if(parseInt(r.payload.numchild) > 0){
                //     Variables.get_children_for_var(r.payload.name)
                // }

            }else{
                // this is an unexpected case. Let the status bar render some info to help debug the issue.
                Status.render_from_gdb_mi_response(r)
            }
        }else{
            process_gdb_response(mi_response_array)
        }
        Variables.render()
    },
    get_children_for_var: function(gdb_variable_name){
        if(Variables.state.waiting_for_children_list_response === true){
            Status.render(`cannot search for children of ${gdb_variable_name} while waiting for response from ${Variables.state.children_being_retrieved_for_var}`)
            return
        }
        Variables.state.children_being_retrieved_for_var = gdb_variable_name
        Variables.state.waiting_for_children_list_response = true
        GdbApi.run_gdb_command(`-var-list-children --all-values ${gdb_variable_name}`, Variables.callback_after_list_children)
    },
    // callback_after_list_children: function(mi_response_array){
    //     Variables.state.waiting_for_children_list_response = false

    //     mi_response_array.map(r => GdbMiOutput.add_mi_output(r))

    //     let r = mi_response_array[0]
    //     let obj = Variables.get_obj_from_gdb_var_name(Variables.state.children_being_retrieved_for_var)
    //     if(obj){
    //         obj.mi_obj.children = r.payload.children
    //     }
    //     Variables.render()
    // },
    render: function(){
        const col_names = ['', 'expression (type): value', 'gdb var']
        const child_display = function(child){
            return child.name
        }
        let table_data = []

        for(let obj of Variables.state.variables){
            console.log(obj.in_scope)
            if(obj.in_scope === 'true' || _.isUndefined(obj.in_scope)){
                table_data.push(Variables.get_rendered_var(obj.expression, obj.mi_obj))
            }
        }

        Variables.el.html(Util.get_table(col_names, table_data))
    },
    get_rendered_var: function(expression, mi_obj){

        let child_tree = `<ul>

        </ul>`
        let child_li = ''
        for(let child of mi_obj.children){
            child_li += `<li>${child.exp} (${child.type}): ${child.value}</li>`

            // TODO handle children of children
            // if(parseInt(child.numchild) > 0){
            //     child_name_and_val = '+ ' + child_name_and_val
            // }
        }

        let delete_button = `<span class='glyphicon glyphicon-remove delete_gdb_variable pointer' data-gdb_variable='${mi_obj.name}' />`

        let expression_and_value = `
        <ul>
        <li>${expression} (${mi_obj.type}): ${mi_obj.value}
            <ul>
                ${child_li}
            </ul>
        <ul>
        `
        return [delete_button, expression_and_value, mi_obj.name]
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
        // delete locally
        Variables.delete_local_gdb_var_data(e.currentTarget.dataset.gdb_variable)

        // delete in gdb too
        GdbApi.run_gdb_command(`-var-delete ${e.currentTarget.dataset.gdb_variable}`)

        // re-render variables in browser
        Variables.render()
    }
}

const AllLocalVariables = {
    el: $('#all_local_variables'),
    render: function(data){
        const col_names = ['variable', 'value']
        let table_data = []
        for(let obj of data){
            let value_str = JSON.stringify(obj.value, null, 4).replace(/[^(\\)]\\n/g)
            table_data.push([obj.name, `<p class='pre'>${value_str}</p>`])
        }

        AllLocalVariables.el.html(Util.get_table(col_names, table_data))
    },
    refresh_all_for_current_frame: function(){
        GdbApi.run_gdb_command(`-stack-list-locals --all-values`)
    },
    clear: function(){
        AllLocalVariables.el.html('')
    }
}


const GlobalEvents = {
    // Initialize
    init: function(){
        GlobalEvents.register_events()
    },
    // Event handling
    register_events: function(){
        $(window).keydown(function(e){
            if((event.keyCode === ENTER_BUTTON_NUM)) {
                // when pressing enter in an input, don't redirect entire page
                event.preventDefault()
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

const process_gdb_response = function(response_array){

    // update status with error or with last response
    let update_status = true

    for (let r of response_array){
        if (r.type === 'result' && r.message === 'done' && r.payload){
            // This is special GDB Machine Interface structured data that we
            // can render in the frontend
            if ('bkpt' in r.payload){
                // breakpoint was created
                Breakpoint.store_breakpoint(r.payload.bkpt)
                Breakpoint.render_breakpoint_table()
                SourceCode.fetch_and_render_file(r.payload.bkpt.fullname, r.payload.bkpt.line, {'highlight': false, 'scroll': true})
            }
            if ('BreakpointTable' in r.payload){
                Breakpoint.assign_breakpoints_from_mi_breakpoint_table(r.payload)
                SourceCode.rerender()
            }
            if ('stack' in r.payload) {
                Stack.render_stack(r.payload.stack)
            }
            if ('register-names' in r.payload) {
                Registers.set_register_names(r.payload['register-names'])
            }
            if ('register-values' in r.payload) {
                Registers.render_registers(r.payload['register-values'])
            }
            if ('asm_insns' in r.payload) {
                Disassembly.render_disasembly(r.payload.asm_insns)
            }
            if ('files' in r.payload){
                SourceFileAutocomplete.input.list = _.uniq(r.payload.files.map(f => f.fullname)).sort()
                SourceFileAutocomplete.input.evaluate()
            }
            if ('memory' in r.payload){
                Memory.render_memory(r.payload.memory)
            }
            if ('locals' in r.payload){
                AllLocalVariables.render(r.payload.locals)
            }
            if ('changelist' in r.payload){
                Variables.handle_changelist(r.payload.changelist)
            }
            // if (your check here) {
            //      render your custom compenent here!
            // }

        } else if (r.type === 'console'){
            GdbConsoleComponent.add(r.payload)
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
            SourceCode.fetch_and_render_file(r.payload.frame.fullname, r.payload.frame.line, {'highlight': true, 'scroll': true})
        }

        if (r.message && r.message === 'stopped' && r.payload && r.payload.reason && r.payload.reason.includes('exited')){
            SourceCode.remove_current_line()
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
}

// initialize components
GlobalEvents.init()
GdbApi.init()
GdbCommandInput.init()
GdbConsoleComponent.init()
GdbMiOutput.init()
Stack.init()
SourceCode.init()
Disassembly.init()
BinaryLoader.init()
SourceFileAutocomplete.init()
Memory.init()
Variables.init()

window.addEventListener("beforeunload", BinaryLoader.onclose)

})(jQuery, _, Awesomplete)
