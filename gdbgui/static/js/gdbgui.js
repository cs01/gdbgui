(function ($) {
"use strict";

const Util = {
    get_table: function(thead, data) {
        var result = ["<table class='table table-striped table-bordered table-condensed'>"];
        result.push("<thead>");
        result.push("<tr>");
        for (let h of thead){
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
    post_msg: function(data){
        App.set_status(_.escape(data.responseJSON.message))
        // Messenger().post(_.escape(data.responseJSON.message))
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
    jq_console: $('#console'),
    jq_stdout: $('#stdout'),

    jq_gdb_command_input: $('#gdb_command'),
    jq_binary: $('#binary'),
    jq_code: $('#code_table'),
    jq_code_container: $('#code_container'),
    js_gdb_controls: $('.gdb_controls'),
    jq_breakpoints: $('#breakpoints'),
    jq_stack: $('#stack'),
    jq_registers: $('#registers'),
    jq_status: $('#status'),
    jq_command_history: $('#command_history'),
    jq_source_code_heading: $('#source_code_heading'),
    jq_disassembly: $('#disassembly'),
    jq_disassembly_heading: $('#disassembly_heading'),
    jq_refresh_disassembly_button: $('button#refresh_disassembly'),
}

let App = {

    // Initialize
    init: function(){
        App.register_events();

        Consts.jq_binary.val(localStorage.getItem('last_binary'))
        try{
            App.state.history = JSON.parse(localStorage.getItem('history'))
        }catch(err){
            App.state.history = []
        }
        if (_.isArray(App.state.history)){
            App.state.history.map(App.show_in_history_table)
        }
    },
    onclose: function(){
        console.log(JSON.stringify(App.state.history))
        console.log(JSON.stringify(App.state.history))
        console.log(JSON.stringify(App.state.history))
        localStorage.setItem('last_binary', Consts.jq_binary.val())
        localStorage.setItem('history', JSON.stringify(App.state.history))
        return null
    },
    set_status: function(status){
        Consts.jq_status.text(status)
    },
    state: {'breakpoints': [],  // list of breakpoints
            'source_files': [], // list of absolute paths, and their contents
            'frame': {}, // current "frame" in gdb. Has keys: line, fullname (path to file), among others.
            'rendered_source_file': {'fullname': null, 'line': null}, // current source file displayed
            'history': []
            },
    clear_state: function(){
        App.state =  {
            'breakpoints': [],  // list of breakpoints
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
        $('#stop_gdb').click(App.stop_gdb);
        $('.run_gdb_command').click(function(e){
                var cmd = Consts.jq_gdb_command_input.val();
                App.run_gdb_command(cmd);
            }
        );
        $('.gdb_cmd').click(function(e){App.click_gdb_cmd_button(e)});
        $('.clear_history').click(function(e){App.clear_history(e)});
        $('.clear_console').click(function(e){App.clear_console(e)});
        $("body").on("click", ".breakpoint", App.click_breakpoint);
        $("body").on("click", ".no_breakpoint", App.click_source_file_gutter_with_no_breakpoint);
        $("body").on("click", ".sent_command", App.click_sent_command);
        $("body").on("click", ".resizer", App.click_resizer_button);
        Consts.jq_refresh_disassembly_button.click(App.refresh_disassembly);

    },
    refresh_disassembly: function(e){
        let file = App.state.rendered_source_file.fullname
        let line = App.state.rendered_source_file.line
        if (file !== null && line !== null){
            line = Math.max(line - 10, 1)
            // https://sourceware.org/gdb/onlinedocs/gdb/GDB_002fMI-Data-Manipulation.html
            const mi_response_format = 4
            App.run_gdb_command(`-data-disassemble -f ${file} -l ${line} -- ${mi_response_format}`)
        } else {
            Consts.jq_status.html('gdbgui is not sure which file and line to disassemble. Reach a breakpoint, then try again.')
        }
    },
    click_set_target_app_button: function(e){
        var binary = Consts.jq_binary.val();
        App.run_gdb_command(`file ${binary}`);
        App.enable_gdb_controls();
    },
    keydown_on_binary_input: function(e){
        if(e.keyCode === 13) {
            App.click_set_target_app_button(e)
        }
    },
    keydown_on_gdb_cmd_input: function(e){
        if(e.keyCode === 13) {
            App.run_gdb_command($(e.target).val())
        }
    },
    click_gdb_cmd_button: function(e){
        App.run_gdb_command(e.currentTarget.dataset.cmd);
    },
    click_breakpoint: function(e){
        let line = e.currentTarget.dataset.line
        for (let b of App.state.breakpoints){
            if (b.fullname === App.state.rendered_source_file.fullname && b.line === line){
                let cmd = [`-break-delete ${b.number}`, '-break-list']
                App.run_gdb_command(cmd)
            }
        }
    },
    click_resizer_button: function(e){
        console.log(e)
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
    click_source_file_gutter_with_no_breakpoint: function(e){
        let line = e.currentTarget.dataset.line
        let cmd = [`-break-insert ${App.state.rendered_source_file.fullname}:${line}`, '-break-list']
        App.run_gdb_command(cmd)
    },
    click_sent_command: function(e){
        // when a previously sent command is clicked, populate the command input
        // with it
        let cmd = (e.currentTarget.dataset.cmd)
        Consts.jq_gdb_command_input.val(cmd)
    },
    stop_gdb: function(){
        $.ajax({
            url: "/stop_gdb",
            cache: false,
            type: 'GET',
            success: function(data){
                App.disable_gdb_controls();
                App.clear_state();
                App.set_status('gdb has exited');
            },
            error: Util.post_msg
        })
    },
    run_gdb_command: function(cmd){
        if(_.trim(cmd) === ''){
            return
        }

        App.set_status('')
        App.save_to_history(cmd)
        App.show_in_history_table(cmd)
        $.ajax({
            url: "/run_gdb_command",
            cache: false,
            method: 'POST',
            data: {'cmd': cmd},
            success: App.receive_gdb_response,
            error: Util.post_msg
        })
    },
    clear_history: function(){
        App.state.history = []
        Consts.jq_command_history.html('')
    },
    clear_console: function(){
        Consts.jq_console.html('')
    },
    save_to_history: function(cmd){
        if (_.isArray(App.state.history)){
            App.state.history.push(cmd)
        }else{
            App.state.history = [cmd]
        }
    },
    show_in_history_table: function(cmd){
        Consts.jq_command_history.prepend(`<tr><td class="sent_command pointer" data-cmd="${cmd}" style="padding: 0">${cmd}</td></tr>`)
    },
    receive_gdb_response: function(response_array){
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
                Consts.jq_stdout.append(`<p class='pre no_margin output'>${r.payload.replace(/[^(\\)]\\n/g)}</span>`)
            }else{
                // gdb machine interface structure output
                Consts.jq_gdb_mi_output.append(`<p class='pre ${text_class[r.type]} no_margin output'>${r.type}:\n${JSON.stringify(r, null, 4).replace(/[^(\\)]\\n/g)}</span>`)
            }


            if (r.type === 'result' && r.message === 'done' && r.payload){
                // This is special GDB Machine Interface structured data that we
                // can render in the frontend
                if ('bkpt' in r.payload){
                    // breakpoint was created
                    App.store_breakpoint(r.payload.bkpt);
                    App.render_breakpoint_table();
                    if (App.state.rendered_source_file.fullname !== null){
                        App.render_cached_source_file();
                    }else{
                        App.read_and_render_file(r.payload.bkpt.fullname);
                    }
                } else if ('BreakpointTable' in r.payload){
                    App.remove_stored_breakpoints()
                    for (let bkpt of r.payload.BreakpointTable.body){
                        App.store_breakpoint(bkpt);
                    }
                    App.render_breakpoint_table();
                    App.render_cached_source_file();
                } else if ('stack' in r.payload) {
                    App.render_stack(r.payload.stack)
                } else if ('register-values' in r.payload) {
                    if (App.register_names){
                        App.render_registers(App.register_names, r.payload['register-values'])
                    }
                } else if ('register-names' in r.payload) {
                    App.register_names = r.payload['register-names']
                } else if ('asm_insns' in r.payload) {
                    App.render_disasembly(r.payload.asm_insns)
                }

            } else if (r.payload && typeof r.payload.frame !== 'undefined') {
                // Stopped on a frame. We can render the file and highlight the line!
                App.state.frame = r.payload.frame;
                App.read_and_render_file(App.state.frame.fullname, App.state.frame.line);

            } else if (r.type === 'console'){
                // Consts.jq_console.append(_.replace(r.payload, '\\n', '<br>'))
                // Consts.jq_console.append(`<pre style="border-radius: 0; border: 0; margin: 0; padding: 0;">${r.payload}</pre>`)
                Consts.jq_console.append(`<p class='no_margin output'>${Util.escape(r.payload)}</span>`)
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
            if (r.payload && r.payload.msg){
                status.push(r.payload.msg)
            }
            if (r.payload && r.payload.reason){
                status.push(r.payload.reason)
            }
            App.set_status(status.join('. '))
        }

        // scroll to the bottom
        Consts.jq_stdout.animate({'scrollTop': Consts.jq_stdout.prop('scrollHeight')})
        Consts.jq_gdb_mi_output.animate({'scrollTop': Consts.jq_gdb_mi_output.prop('scrollHeight')})
        Consts.jq_console.animate({'scrollTop': Consts.jq_console.prop('scrollHeight')})
    },
    render_disasembly: function(asm_insns){
        let thead = [ 'line', 'function+offset address instruction']
        let data = []
        for(let i of asm_insns){
            let content = i['line_asm_insn'].map(el => `${el['func-name']}+${el['offset']} ${el.address} ${el.inst}`)
            data.push([i['line'], content.join('<br>')])
        }
        Consts.jq_disassembly.html(Util.get_table(thead, data));
        Consts.jq_disassembly_heading.html(asm_insns['fullname'])
    },
    render_stack: function(stack){
        let thead = _.keys(stack[0])
        let stack_array = stack.map(b => _.values(b));
        Consts.jq_stack.html(Util.get_table(thead, stack_array));
    },
    render_registers(names, values){
        let thead = ['name', 'value']
        let register_array = values.map(v => [names[v['number']], v['value']]);
        Consts.jq_registers.html(Util.get_table(thead, register_array));
    },
    read_and_render_file: function(fullname, highlight_line=0){
        if (fullname === null){
            return
        }

        if (App.state.source_files.some(f => f.fullname === fullname)){
            // We have this cached locally, just use it!
            let f = _.find(App.state.source_files, i => i.fullname === fullname);
            App.render_source_file(fullname, f.source_code, highlight_line);
            return
        }

        $.ajax({
            url: "/read_file",
            cache: false,
            type: 'GET',
            data: {path: fullname},
            success: function(response){
                App.state.source_files.push({'fullname': fullname, 'source_code': response.source_code})
                App.render_source_file(fullname, response.source_code, highlight_line);
            },
            error: Util.post_msg
        })
    },
    render_source_file: function(fullname, source_code, highlight_line=0){
        highlight_line = parseInt(highlight_line);
        let line_num = 1,
            tbody = [],
            bkpt_lines = App.state.breakpoints.filter(b => b.fullname === fullname).map(b => parseInt(b.line));

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
        Consts.jq_code.html(tbody.join(''))
        Consts.jq_source_code_heading.text(fullname)
        App.scroll_to_current_source_code_line()
        App.state.rendered_source_file.fullname = fullname
        App.state.rendered_source_file.line = highlight_line
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
        App.read_and_render_file(App.state.rendered_source_file.fullname, App.state.rendered_source_file.line)
    },
    remove_stored_breakpoints: function(){
        App.state.breakpoints = []
    },
    store_breakpoint: function(breakpoint){
        App.state.breakpoints.push(breakpoint);
    },
    render_breakpoint_table: function(){
        const thead = _.keys(App.state.breakpoints[0]);
        let bkpt_array = App.state.breakpoints.map(b => _.values(b));
        Consts.jq_breakpoints.html(Util.get_table(thead, bkpt_array));
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
window.addEventListener("beforeunload", App.onclose)
})(jQuery);
