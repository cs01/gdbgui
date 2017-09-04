import {store, Reactor} from './store.js';
import SourceCode from './SourceCode.jsx';
import Util from './Util.js';
import GdbApi from './GdbApi.js';

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

        for (let b of store.get('breakpoints')){
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
                let escaped_line = line.replace(/>/g, "&gt;").replace(/</g, "&lt;")

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
                                <input type='checkbox' ${checked} class='toggle_breakpoint_enable' data-breakpoint_num='${b.number}'> </input>
                                ${function_text}
                                ${delete_text}

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
        for (let b of store.get('breakpoints')){
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
        return store.get('breakpoints').filter(b => (b.fullname_to_display === fullname) && b.enabled === 'y').map(b => parseInt(b.line))
    },
    get_disabled_breakpoint_lines_for_file: function(fullname){
        return store.get('breakpoints').filter(b => (b.fullname_to_display === fullname) && b.enabled !== 'y').map(b => parseInt(b.line))
    },
    save_breakpoints: function(payload){
        store.set('breakpoints', [])
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
        let bkpts = store.get('breakpoints')
        if(bkpts.indexOf(bkpt) === -1){
            bkpts.push(bkpt)
            store.set('breakpoints', bkpts)
        }
        return bkpt
    },
}

export default Breakpoint;
