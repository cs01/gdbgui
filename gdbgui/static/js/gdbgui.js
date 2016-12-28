(function ($, _, Awesomplete) {
"use strict";

const Util = {
    get_table: function(columns, data) {
        var result = ["<table class='table table-striped table-bordered table-condensed'>"];
        result.push("<thead>");
        result.push("<tr>");
        for (let h of columns){
            result.push(`<th>${h}</th>`);
        }
        result.push("</tr>");
        result.push("</thead>");
        result.push("<tbody>");
        for(let row of data) {
                result.push("<tr>");
                for(let cell of row){
                        result.push(`<td>${cell}</td>`);
                }
                result.push("</tr>");
        }
        result.push("</tbody>");
        result.push("</table>");
        return result.join('\n');
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
    post_msg: function(data){
        if (data.responseJSON && data.responseJSON.message){
            Status.render(_.escape(data.responseJSON.message))
        }else{
            Status.render(`${data.statusText} (${data.status} error)`)
        }
    },
    escape: function(s){
        return s.replace(/([^\\]\\n)/g, '<br>')
                .replace(/\\t/g, '&nbsp')
                .replace(/\\"+/g, '"')
    }
}

const Consts = {
    set_target_app_button: $('#set_target_app'),
    jq_gdb_mi_output: $('#gdb_mi_output'),
    jq_gdb_command_input: $('#gdb_command'),
    jq_binary: $('#binary'),
    jq_code_container: $('#code_container'),
    js_gdb_controls: $('.gdb_controls'),
}

/**
 * Object with methods to interact with gdb on the
 * backend
 */
let GdbApi = {
    stop_gdb: function(){
        $.ajax({
            url: "/stop_gdb",
            cache: false,
            type: 'GET',
            success: function(data){
                App.disable_gdb_controls();
                App.clear_state();
                Status.render('gdb has exited');
            },
            error: Util.post_msg
        })
    },
    run_gdb_command: function(cmd){
        if(_.trim(cmd) === ''){
            return
        }

        Status.render(`running command "${cmd}"`)
        History.update(cmd)
        $.ajax({
            url: "/run_gdb_command",
            cache: false,
            method: 'POST',
            data: {'cmd': cmd},
            success: GdbApi.process_gdb_response,
            error: Util.post_msg
        })
    },
    get_gdb_response: function(){
        Status.render(`Getting GDB response`)
        $.ajax({
            url: "/get_gdb_response",
            cache: false,
            success: GdbApi.process_gdb_response,
            error: Util.post_msg
        })
    },
    process_gdb_response: function(response_array){
        const text_class = {
            'output': "",
            'notify': "text-info",
            'log': "text-primary",
            'status': "text-danger",
            'console': "text-info",
        }

        for (let r of response_array){
            if (r.type === 'output'){
                // output of program
                StdoutStderr.add_output(r.payload)
            }else{
                // gdb machine interface structure output
                Consts.jq_gdb_mi_output.append(`<p class='pre ${text_class[r.type]} no_margin output'>${r.type}:\n${JSON.stringify(r, null, 4).replace(/[^(\\)]\\n/g)}</span>`)
            }


            if (r.type === 'result' && r.message === 'done' && r.payload){
                // This is special GDB Machine Interface structured data that we
                // can render in the frontend
                if ('bkpt' in r.payload){
                    // breakpoint was created
                    Breakpoint.store_breakpoint(r.payload.bkpt);
                    Breakpoint.render_breakpoint_table();
                    if (App.state.rendered_source_file.fullname !== null){
                        App.render_cached_source_file();
                    }else{
                        SourceCode.read_and_render_file(r.payload.bkpt.fullname);
                    }
                } else if ('BreakpointTable' in r.payload){
                    Breakpoint.remove_stored_breakpoints()
                    for (let bkpt of r.payload.BreakpointTable.body){
                        Breakpoint.store_breakpoint(bkpt);
                    }
                    Breakpoint.render_breakpoint_table();
                    App.render_cached_source_file();
                } else if ('stack' in r.payload) {
                    StackComponent.render_stack(r.payload.stack)

                } else if ('register-names' in r.payload) {
                    Registers.set_register_names(r.payload['register-names'])

                } else if ('register-values' in r.payload) {
                    Registers.render_registers(r.payload['register-values'])

                } else if ('asm_insns' in r.payload) {
                    Disassembly.render_disasembly(r.payload.asm_insns)

                } else if ('files' in r.payload){
                    App.state.source_files = _.uniq(r.payload.files.map(f => f.fullname)).sort()
                    App.autocomplete_source_file_input.list = App.state.source_files
                    App.autocomplete_source_file_input.evaluate()
                }

            } else if (r.payload && typeof r.payload.frame !== 'undefined') {
                // Stopped on a frame. We can render the file and highlight the line!
                App.state.frame = r.payload.frame;
                SourceCode.read_and_render_file(App.state.frame.fullname, App.state.frame.line);

            } else if (r.type === 'console'){
                GdbConsoleComponent.add(r.payload)
            }

            if (r.message && r.message === 'stopped'){
                if (r.payload && r.payload.reason && r.payload.reason.includes('exited')){
                    App.state.rendered_source_file.line = null;
                    App.render_cached_source_file();
                }
            }

            // Update status
            let status = [];
            if (r.message){
                status.push(r.message)
            }
            if (r.payload){
                if (r.payload.msg) {status.push(r.payload.msg)}
                if (r.payload.reason) {status.push(r.payload.reason)}
                if (r.payload.frame){
                    for(let i of ['file', 'func', 'line']){
                        if (i in r.payload.frame){
                            status.push(`${i}: ${r.payload.frame[i]}`)
                        }
                    }
                }
            }
            Status.render(status.join(', '))
        }

        // scroll to the bottom
        StdoutStderr.scroll_to_bottom()
        Consts.jq_gdb_mi_output.animate({'scrollTop': Consts.jq_gdb_mi_output.prop('scrollHeight')})
        GdbConsoleComponent.scroll_to_bottom()
    },
}

/**
 * update and manipulate the console component
 */
let GdbConsoleComponent = {
    el: $('#console'),
    clear_console: function(){
        GdbConsoleComponent.el.html('')
    },
    add: function(s){
        GdbConsoleComponent.el.append(`<p class='no_margin output'>${Util.escape(s)}</span>`)
    },
    scroll_to_bottom: function(){
        GdbConsoleComponent.el.animate({'scrollTop': GdbConsoleComponent.el.prop('scrollHeight')})
    }
}

/**
 * update and manipulate the stdout/stderr component
 */
let StdoutStderr = {
    el: $('#stdout'),
    clear_stdout: function(){
        StdoutStderr.el.html('')
    },
    add_output: function(s){
        StdoutStderr.el.append(`<p class='pre no_margin output'>${s.replace(/[^(\\)]\\n/g)}</span>`)
    },
    scroll_to_bottom: function(){
        GdbConsoleComponent.el.animate({'scrollTop': GdbConsoleComponent.el.prop('scrollHeight')})
        StdoutStderr.el.animate({'scrollTop': StdoutStderr.el.prop('scrollHeight')})
    }
}

/**
 * update and manipulate the breakpoint component
 */
let Breakpoint = {
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
        Breakpoint.breakpoints.push(breakpoint);
    },
    get_breakpoint_lines_For_file: function(fullname){
        return Breakpoint.breakpoints.filter(b => b.fullname === fullname).map(b => parseInt(b.line));
    }
}

/**
 * update and manipulate the breakpoint component
 */
let SourceCode = {
    el_source_file_input: $('#source_file_input'),
    el_source_code: $('#code_table'),
    el_title: $('#source_code_heading'),
    init: function(){
        $("body").on("click", ".breakpoint", SourceCode.click_breakpoint)
        $("body").on("click", ".no_breakpoint", SourceCode.click_source_file_gutter_with_no_breakpoint)
        SourceCode.el_source_file_input.keyup(SourceCode.keyup_source_file_input);
        SourceCode.setup_source_file_autocomplete()
    },
    click_breakpoint: function(e){
        let line = e.currentTarget.dataset.line
        // todo: embed fullname in the dom instead of depending on state
        Breakpoint.remove_breakpoint_if_present(App.state.rendered_source_file.fullname, line)
    },
    click_source_file_gutter_with_no_breakpoint: function(e){
        let line = e.currentTarget.dataset.line
        let cmd = [`-break-insert ${App.state.rendered_source_file.fullname}:${line}`, '-break-list']
        GdbApi.run_gdb_command(cmd)
    },
    setup_source_file_autocomplete: function(){
        // initialize list of source files
        App.autocomplete_source_file_input = new Awesomplete('#source_file_input', {
            minChars: 0,
            maxItems: 10000,
            list: [],
            sort: (a, b) => {return a < b ? -1 : 1;}
        });

        // when dropdown button is clicked, toggle showing/hiding it
        Awesomplete.$('.dropdown-btn').addEventListener("click", function() {
            if (App.autocomplete_source_file_input.ul.childNodes.length === 0) {
                App.autocomplete_source_file_input.minChars = 0;
                App.autocomplete_source_file_input.evaluate();
            }
            else if (App.autocomplete_source_file_input.ul.hasAttribute('hidden')) {
                App.autocomplete_source_file_input.open();
            }
            else {
                App.autocomplete_source_file_input.close();
            }
        })

        // perform action when an item is selected
         Awesomplete.$('#source_file_input').addEventListener('awesomplete-selectcomplete', function(e){
            SourceCode.read_and_render_file(e.currentTarget.value)
        });
    },
    render_source_file: function(fullname, source_code, highlight_line=0){
        highlight_line = parseInt(highlight_line);
        let line_num = 1,
            tbody = [],
            bkpt_lines = Breakpoint.get_breakpoint_lines_For_file(fullname)

        for (let line of source_code){
            let breakpoint_class = (bkpt_lines.indexOf(line_num) !== -1) ? 'breakpoint': 'no_breakpoint';
            let current_line_id = (line_num === highlight_line) ? 'id=current_line': '';
            tbody.push(`<tr class='source_code ${breakpoint_class}' data-line=${line_num}>
                <td class='gutter'><div></div></td>
                <td class='line_num'>${line_num}</td>
                <td class='line_of_code'><pre ${current_line_id}>${line}</pre></td>
                </tr>
                `);
            line_num++;
        }
        SourceCode.el_source_code.html(tbody.join(''))
        SourceCode.el_title.text(fullname)
        App.scroll_to_current_source_code_line()
        App.state.rendered_source_file.fullname = fullname
        App.state.rendered_source_file.line = highlight_line
    },
    read_and_render_file: function(fullname, highlight_line=0){
        if (fullname === null || fullname === undefined){
            return
        }

        if (App.state.cached_source_files.some(f => f.fullname === fullname)){
            // We have this cached locally, just use it!
            let f = _.find(App.state.cached_source_files, i => i.fullname === fullname);
            SourceCode.render_source_file(fullname, f.source_code, highlight_line);
            return
        }

        $.ajax({
            url: "/read_file",
            cache: false,
            type: 'GET',
            data: {path: fullname},
            success: function(response){
                App.state.cached_source_files.push({'fullname': fullname, 'source_code': response.source_code})
                SourceCode.render_source_file(fullname, response.source_code, highlight_line);
            },
            error: Util.post_msg
        })
    },
    keyup_source_file_input: function(e){
        if (e.keyCode === 13){
            SourceCode.read_and_render_file(e.currentTarget.value)
        }
    },
}

let Disassembly = {
    el_title: $('#disassembly_heading'),
    el: $('#disassembly'),
    init: function(){
        $('button#refresh_disassembly').click(Disassembly.refresh_disassembly)
    },
    refresh_disassembly: function(e){
        let file = App.state.rendered_source_file.fullname
        let line = App.state.rendered_source_file.line
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
        let thead = [ 'line', 'function+offset address instruction']
        let data = []
        for(let i of asm_insns){
            let content = i['line_asm_insn'].map(el => `${el['func-name']}+${el['offset']} ${el.address} ${el.inst}`)
            data.push([i['line'], content.join('<br>')])
        }
        Disassembly.el_title.html(asm_insns['fullname'])
        Disassembly.el.html(Util.get_table(thead, data))
    },
}

let StackComponent = {
    el: $('#stack'),
    render_stack: function(stack){
        let [columns, data] = Util.get_table_data_from_objs(stack)
        StackComponent.el.html(Util.get_table(columns, data));
    },
}

let Registers = {
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
            Registers.el.html(Util.get_table(columns, register_table_data));
        } else {
            console.error('Could not render registers. Length of names != length of values!')
        }
    },
    set_register_names: function(names){
        // filter out non-empty names
        Registers.register_names = names.filter(name => name)
    }
}

let Status = {
    el: $('#status'),
    render: function(status){
        Status.el.text(status)
    },
}

let History = {
    el: $('#command_history'),
    items: [],
    init: function(){
        $('.clear_history').click(function(e){History.clear(e)});
        $("body").on("click", ".sent_command", History.click_sent_command);

        try{
            History.items = _.uniq(JSON.parse(localStorage.getItem('history')))
        }catch(err){
            History.items = []
        }
        History.render()
    },
    onclose: function(){
        localStorage.setItem('history', JSON.stringify(History.items) || [])
        return null
    },
    clear: function(){
        History.items = []
        History.render()
    },
    update: function(cmd){
        History.save_to_history(cmd)
        History.render()
    },
    save_to_history: function(cmd){
        if (_.isArray(History.items)){
            _.remove(History.items, i => i === cmd)
            History.items.unshift(cmd)
        }else{
            History.items = [cmd]
        }
    },
    render: function(){
        let history_html = History.items.map(cmd => `<tr><td class="sent_command pointer" data-cmd="${cmd}" style="padding: 0">${cmd}</td></tr>`)
        History.el.html(history_html)
    },
    click_sent_command: function(e){
        // when a previously sent command is clicked, populate the command input
        // with it
        let cmd = (e.currentTarget.dataset.cmd)
        Consts.jq_gdb_command_input.val(cmd)
    },
}

let App = {
    // Initialize
    init: function(){
        App.register_events();

        try{
            App.state.past_binaries = _.uniq(JSON.parse(localStorage.getItem('past_binaries')))
            Consts.jq_binary.val(App.state.past_binaries[0])
        } catch(err){
            App.state.past_binaries = []
        }
        App.render_past_binary_options_datalist()
        History.render()
    },
    onclose: function(){
        localStorage.setItem('past_binaries', JSON.stringify(App.state.past_binaries) || [])
        return null
    },
    state: {'source_files': [], // list of absolute paths
            'cached_source_files': [], // list of absolute paths, and their source code
            'frame': {}, // current "frame" in gdb. Has keys: line, fullname (path to file), among others.
            'rendered_source_file': {'fullname': null, 'line': null}, // current source file displayed
            'history': [],
            'past_binaries': [],
            },
    clear_state: function(){
        App.state =  {
            'source_files': [], // list of absolute paths, and their contents
            'frame': {} // current "frame" in gdb. Has keys line, fullname (path to file), among others.
        }
    },
    // Event handling
    register_events: function(){
        $(window).keydown(function(e){
            if((event.keyCode === 13)) {
                event.preventDefault();
            }
        });

        Consts.set_target_app_button.click(App.click_set_target_app_button);
        Consts.jq_binary.keydown(App.keydown_on_binary_input)
        Consts.jq_gdb_command_input.keydown(App.keydown_on_gdb_cmd_input)

        $('#stop_gdb').click(GdbApi.stop_gdb);
        $('.run_gdb_command').click(function(e){
                var cmd = Consts.jq_gdb_command_input.val();
                GdbApi.run_gdb_command(cmd);
            }
        );

        $('.gdb_cmd').click(function(e){App.click_gdb_cmd_button(e)});
        $('.clear_console').click(function(e){GdbConsoleComponent.clear_console(e)});

        $('.get_gdb_response').click(function(e){GdbApi.get_gdb_response(e)});

        $("body").on("click", ".resizer", App.click_resizer_button);
    },
    click_set_target_app_button: function(e){
        var binary = Consts.jq_binary.val();
        _.remove(App.state.past_binaries, i => i === binary)
        App.state.past_binaries.unshift(binary)
        App.render_past_binary_options_datalist()
        GdbApi.run_gdb_command(`-file-exec-and-symbols ${binary}`);
    },
    render_past_binary_options_datalist: function(){
        $('#past_binaries').html(App.state.past_binaries.map(b => `<option>${b}</option`))
    },
    keydown_on_binary_input: function(e){
        if(e.keyCode === 13) {
            App.click_set_target_app_button(e)
        }
    },
    keydown_on_gdb_cmd_input: function(e){
        if(e.keyCode === 13) {
            GdbApi.run_gdb_command($(e.target).val())
        }
    },
    click_gdb_cmd_button: function(e){
        GdbApi.run_gdb_command(e.currentTarget.dataset.cmd);
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
    scroll_to_current_source_code_line: function(){
        let jq_current_line = $("#current_line")
        if (jq_current_line.length === 1){  // make sure a line is selected before trying to scroll to it
            let top_of_line = jq_current_line.position().top
            let top_of_table = jq_current_line.closest('table').position().top
            let time_to_scroll = 0
            Consts.jq_code_container.animate({'scrollTop': top_of_line - top_of_table}, 0)
        }
    },
    render_cached_source_file: function(){
        SourceCode.read_and_render_file(App.state.rendered_source_file.fullname, App.state.rendered_source_file.line)
    },
    enable_gdb_controls: function(){
        Consts.js_gdb_controls.removeClass('disabled');
        $('#run_gdb').addClass('disabled');
        $('#stop_gdb').removeClass('disabled');
    },
    disable_gdb_controls: function(){
        Consts.js_gdb_controls.addClass('disabled');
        $('#run_gdb').removeClass('disabled');
        $('#stop_gdb').addClass('disabled');
    },
}

App.init();
SourceCode.init()
Disassembly.init()
History.init()
window.addEventListener("beforeunload", App.onclose)
window.addEventListener("beforeunload", History.onclose)
})(jQuery, _, Awesomplete);
