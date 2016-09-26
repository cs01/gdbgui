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
    }
}

const Consts = {
    set_target_app_button: $('#set_target_app'),
    jq_raw_output: $('#raw_output'),
    jq_console: $('#console'),
    stdout: $('#stdout'),

    jq_gdb_command_input: $('#gdb_command'),
    jq_binary: $('#binary'),
    jq_code: $('#code_table'),
    jq_code_container: $('.code_container'),
    js_gdb_controls: $('.gdb_controls'),
    jq_breakpoints: $('#breakpoints'),
    jq_status: $('#status'),
    jq_commands_sent: $('#commands_sent'),
    jq_source_code_heading: $('#source_code_heading'),
}

let App = {

    // Initialize
    init: function(){
        App.register_events();
        Consts.jq_binary.val(localStorage.getItem('last_binary'))
    },
    onclose: function(){
        localStorage.setItem('last_binary', Consts.jq_binary.val())
        console.log(Consts.jq_binary.val())
        return null
    },
    set_status: function(status){
        Consts.jq_status.text(status)
    },
    state: {'breakpoints': [],  // list of breakpoints
            'source_files': [], // list of absolute paths, and their contents
            'frame': {}, // current "frame" in gdb. Has keys: line, fullname (path to file), among others.
            'rendered_source_file': {'fullname': null, 'line': null} // current source file displayed
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
        $("body").on("click", ".breakpoint", App.click_breakpoint);
        $("body").on("click", ".no_breakpoint", App.click_source_file_gutter_with_no_breakpoint);
        $("body").on("click", ".sent_command", App.click_sent_command);

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
        Consts.jq_commands_sent.prepend(`<tr><td class="sent_command" data-cmd="${cmd}" style="padding: 0">${cmd}</td></tr>`)
        $.ajax({
            url: "/run_gdb_command",
            cache: false,
            method: 'POST',
            data: {'cmd': cmd},
            success: App.receive_gdb_response,
            error: Util.post_msg
        })
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
                Consts.stdout.append(`<p class='pre no_margin output'>${r.payload.replace(/[^(\\)]\\n/g)}</span>`)
            }else{
                // output of gdb
                Consts.jq_raw_output.append(`<p class='pre ${text_class[r.type]} no_margin output'>${r.type}:\n${JSON.stringify(r, null, 4).replace(/[^(\\)]\\n/g)}</span>`)
            }


            if (r.type === 'result' && r.message === 'done' && r.payload){
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
                }

            }else if (r.payload && typeof r.payload.frame !== 'undefined') {
                // Stopped on a frame. We can render the file and highlight the line!
                App.state.frame = r.payload.frame;
                App.read_and_render_file(App.state.frame.fullname, App.state.frame.line);
            }

            if (r.message && r.message === 'stopped'){
                if (r.payload && r.payload.reason && r.payload.reason.includes('exited')){
                    App.state.rendered_source_file.line = null;
                    App.render_cached_source_file();
                }
            }

            if (r.type === 'console'){
                // Consts.jq_console.append(_.replace(r.payload, '\\n', '<br>'))
                Consts.jq_console.append(`<pre style="border-radius: 0; border-right: 0; border-top: 0; border-left: 0; border-color: #dcdcdc; margin: 0; padding: 0;">${r.payload}</pre>`)
            }

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
        Consts.stdout.animate({'scrollTop': Consts.stdout.prop('scrollHeight')})
        Consts.jq_raw_output.animate({'scrollTop': Consts.jq_raw_output.prop('scrollHeight')})
        Consts.jq_console.animate({'scrollTop': Consts.jq_console.prop('scrollHeight')})
    },
    read_and_render_file: function(fullname, highlight_line=0){
        if (fullname === null){
            return
        }

        if (App.state.source_files.some(f => f.fullname === fullname)){
            // We have this cached locally, just use it!
            let f = _.find(App.state.source_files, i => i.fullname === fullname);
            App.render_source_file(fullname, f.source_code, highlight_line);
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
        Consts.jq_source_code_heading.html('Source Code: ' + fullname)
        App.scroll_to_current_source_code_line()
        App.state.rendered_source_file.fullname = fullname
        App.state.rendered_source_file.line = highlight_line

    },
    scroll_to_current_source_code_line: function(){
        let jq_current_line = $("#current_line")
        if (jq_current_line.length === 1){
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
