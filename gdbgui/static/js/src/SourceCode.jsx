import {store, Reactor} from './store.js';
import Breakpoint from './Breakpoint.jsx';
import GdbApi from './GdbApi.js';
import Memory from './Memory.js';
import constants from './constants.js';
import Util from './Util.js';
import Modal from './Modal.js';

'use strict';

/**
 * The source code component
 */
const SourceCode = {
    el_code_container: $('#code_container'),
    el_title: $('#source_code_heading'),
    el_jump_to_line_input: $('#jump_to_line'),
    init: function(){
        new Reactor('#source_code_heading', () => {
            let source_file = store.get('rendered_source_file_fullname')
            if(source_file){
                return source_file
                // TODO: make into a link: return `<a href="file:/${source_file}">${source_file}</a>`
            }else{
                return ''
            }
        })
        new Reactor('#code_table', SourceCode.render, {should_render: SourceCode.should_render, after_render: SourceCode.after_render})

        $("body").on("click", ".srccode td.line_num", SourceCode.click_gutter)
        $("body").on("click", ".view_file", SourceCode.click_view_file)
        $('.fetch_assembly_cur_line').click(SourceCode.fetch_assembly_cur_line)
        $('#refresh_cached_source_files').click(SourceCode.refresh_cached_source_files)
        SourceCode.el_jump_to_line_input.keydown(SourceCode.keydown_jump_to_line)

        window.addEventListener('event_inferior_program_exited', SourceCode.event_inferior_program_exited)
        window.addEventListener('event_inferior_program_running', SourceCode.event_inferior_program_running)
    },
    event_inferior_program_exited: function(){
        SourceCode.remove_line_highlights()
    },
    event_inferior_program_running: function(){
        SourceCode.remove_line_highlights()
    },
    click_gutter: function(e){
        let line = e.currentTarget.dataset.line
        if(e.currentTarget.classList.contains('breakpoint') || e.currentTarget.classList.contains('breakpoint_disabled')){
            // clicked gutter with a breakpoint, remove it
            Breakpoint.remove_breakpoint_if_present(store.get('rendered_source_file_fullname'), line)

        }else{
            // clicked with no breakpoint, add it, and list all breakpoints to make sure breakpoint table is up to date
            let fullname = store.get('rendered_source_file_fullname')
            GdbApi.run_gdb_command(GdbApi.get_insert_break_cmd(fullname, line))
        }
    },
    is_cached: function(fullname){
        return store.get('cached_source_files').some(f => f.fullname === fullname)
    },
    get_cached_assembly_for_file: function(fullname){
        for(let file of store.get('cached_source_files')){
            if(file.fullname === fullname){
                return file.assembly
            }
        }
        return []
    },
    refresh_cached_source_files: function(){
        SourceCode.clear_cached_source_files()
        SourceCode.render()
    },
    clear_cached_source_files: function(){
        store.set('rendered_source_file_fullname', null)
        store.set('cached_source_files', [])
    },
    /**
     * Return html that can be displayed alongside source code
     * @param show_assembly: Boolean
     * @param assembly: Array of assembly data
     * @param line_num: line for which assembly html should be returned
     * @returns two <td> html elements with appropriate assembly code
     */
    get_assembly_html_for_line: function(show_assembly, assembly, line_num, addr){
        let instruction_content = []

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
        if(obj && store.get('inferior_binary_path')){
            if((obj.last_modified_unix_sec > store.get('inferior_binary_path_last_modified_unix_sec'))
                    && store.get('warning_shown_for_old_binary') !== true){
                Modal.render('Warning', `A source file was modified <bold>after</bold> the binary was compiled. Recompile the binary, then try again. Otherwise the source code may not
                    match the binary.
                    <p>
                    <p>Source file: ${fullname}, modified ${moment(obj.last_modified_unix_sec * 1000).format(constants.DATE_FORMAT)}
                    <p>Binary: ${store.get('inferior_binary_path')}, modified ${moment(store.get('inferior_binary_path_last_modified_unix_sec') * 1000).format(constants.DATE_FORMAT)}`)
                store.set('warning_shown_for_old_binary', true)
            }
        }
    },
    make_current_line_visible: function(){
        SourceCode.scroll_to_jq_selector($("#scroll_to_line"))
    },
    set_theme_in_dom: function(){
        let code_container = SourceCode.el_code_container
        , old_theme = code_container.data('theme')
        , current_theme = store.get('current_theme')
        if(store.get('themes').indexOf(current_theme) === -1){
            // somehow an invalid theme got set, update with a valid one
            store.set('current_theme', store.get('themese')[0])
            current_theme = store.get('current_theme')
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
        void(reactor)
        SourceCode.set_theme_in_dom()
        let fullname = store.get('fullname_to_render')

        if(fullname === undefined || store.get('missing_files').indexOf(fullname) !== -1){
            // don't try to be super efficient when rendering disassembly. It's not that large, and the logic
            // to determine this accurately is difficult.
            return true
        }

        if(fullname === store.get('rendered_source_file_fullname')){
            // we already rendered this file, but if we have new assembly, it should update
            return store.get('has_unrendered_assembly')
        }
        // rendering a different source file, it should update
        return true
    },
    render: function(reactor){
        void(reactor)

        let anon_file_source = store.get('disassembly_for_missing_file')
        , addr = store.get('current_assembly_address')
        , fullname = store.get('fullname_to_render')
        , current_line_of_source_code = parseInt(store.get('current_line_of_source_code'))

        if(fullname === null){
            store.set('rendered_source_file_fullname', null)
            return ''

        }else if(!SourceCode.is_cached(store.get('fullname_to_render'))){
            // if file is not missing or undefined, continue
            let source_file_does_not_exist = fullname === undefined || store.get('missing_files').indexOf(fullname) !== -1
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
                let file_to_fetch = store.get('fullname_to_render')
                SourceCode.fetch_file(store.get('fullname_to_render'))
                store.set('rendered_source_file_fullname', null)
                return 'fetching file ' + file_to_fetch
            }
        }

        let f = _.find(store.get('cached_source_files'), i => i.fullname === fullname)
        let source_code
        if(f){
            source_code = f.source_code
        }else{
            let anon_file_source = store.get('disassembly_for_missing_file')
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
            store.set('current_line_of_source_code', source_code.length)
        }else if (current_line_of_source_code < 0){
            SourceCode.el_jump_to_line_input.val(0)
            store.set('current_line_of_source_code', 0)
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

        store.set('rendered_source_file_fullname', fullname)
        store.set('make_current_line_visible', true)
        return tbody.join('')
    },
    after_render: function(reactor){
        void(reactor)
        let fullname = store.get('fullname_to_render')
        if(fullname && store.get('missing_files').indexOf(fullname) === -1){
            SourceCode.render_breakpoints()
            SourceCode.highlight_paused_line()
            if(store.get('make_current_line_visible')){
                SourceCode.make_current_line_visible()
            }
        }
        store.set('make_current_line_visible', false)
        store.set('has_unrendered_assembly', false)
    },
    // re-render breakpoints on whichever file is loaded
    render_breakpoints: function(){
        document.querySelectorAll('.line_num.breakpoint').forEach(el => el.classList.remove('breakpoint'))
        document.querySelectorAll('.line_num.disabled_breakpoint').forEach(el => el.classList.remove('disabled_breakpoint'))
        if(_.isString(store.get('rendered_source_file_fullname'))){

            let bkpt_lines = Breakpoint.get_breakpoint_lines_for_file(store.get('rendered_source_file_fullname'))
            , disabled_breakpoint_lines = Breakpoint.get_disabled_breakpoint_lines_for_file(store.get('rendered_source_file_fullname'))

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

        let fullname = store.get('rendered_source_file_fullname')
        , line_num = store.get('current_line_of_source_code')
        , addr = store.get('current_assembly_address')
        , inferior_program_is_paused_in_this_file = _.isObject(store.get('paused_on_frame')) && store.get('paused_on_frame').fullname === fullname
        , paused_on_current_line = (inferior_program_is_paused_in_this_file && parseInt(store.get('paused_on_frame').line) === parseInt(line_num))

        // make background blue if gdb is paused on a line in this file
        if(inferior_program_is_paused_in_this_file){
            let jq_line = $(`.loc[data-line=${store.get('paused_on_frame').line}]`)
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
        if(store.get('missing_files').indexOf(fullname) !== -1){
            // file doesn't exist and we already know about it
            // don't keep trying to fetch disassembly
            return
        }

        if(!_.isString(fullname) || !fullname.startsWith('/')){
            // this can happen when an executable doesn't have debug symbols.
            // don't try to fetch it because it will never exist.
            return
        }else if(store.get('files_being_fetched').indexOf(fullname) === -1){
            let files = store.get('files_being_fetched')
            files.push(fullname)
            store.set('files_being_fetched', files)
        }else{
            // this file is already being fetched
            return
        }

        $.ajax({
            url: "/read_file",
            cache: false,
            type: 'GET',
            data: {path: fullname, highlight: store.get('highlight_source_code')},
            success: function(response){
                SourceCode.add_source_file_to_cache(fullname, response.source_code, {}, response.last_modified_unix_sec)
            },
            error: function(response){
                if (response.responseJSON && response.responseJSON.message){
                    store.set('status', {'text': _.escape(response.responseJSON.message), 'error': true})
                }else{
                    store.set('status', {'text': `${response.statusText} (${response.status} error)`, 'error': true})
                }

                let missing_files = store.get('missing_files')
                missing_files.push(fullname)
                store.set('missing_files', missing_files)
            },
            complete: function(){
                let files = store.get('files_being_fetched')
                store.set('files_being_fetched', _.without(files, fullname))
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
        , cached_source_files = store.get('cached_source_files')
        cached_source_files.push(new_source_file)
        store.set('cached_source_files', cached_source_files)
    },
    get_source_file_obj_from_cache(fullname){
        for(let sf of store.get('cached_source_files')){
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
        let mi_response_format = SourceCode.get_dissasembly_format_num(store.get('gdb_version_array'))
        if(_.isString(fullname) && fullname.startsWith('/')){
            if(store.get('interpreter') === 'gdb'){
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
    fetch_assembly_cur_line: function(){
        let fullname = store.get('fullname_to_render')
        , line = parseInt(store.get('current_line_of_source_code'))
        SourceCode.fetch_disassembly(fullname, line)
    },
    fetch_disassembly: function(fullname, start_line){
        let cmd = SourceCode.get_fetch_disassembly_command(fullname, start_line)
        if(cmd){
           GdbApi.run_gdb_command(cmd)
        }
    },
    fetch_disassembly_for_missing_file: function(hex_addr){
        // https://sourceware.org/gdb/onlinedocs/gdb/GDB_002fMI-Data-Manipulation.html
        if(window.isNaN(hex_addr)){
            return
        }

        let start = hex_addr
        , end = hex_addr + 100
        GdbApi.run_gdb_command(constants.DISASSEMBLY_FOR_MISSING_FILE_STR + `-data-disassemble -s 0x${start.toString((16))} -e 0x${end.toString((16))} -- 0`)
    },
    /**
     * Save assembly and render source code if desired
     * @param mi_assembly: array of assembly instructions
     * @param mi_token (int): corresponds to either null (when src file is known and exists),
     *  constants.DISASSEMBLY_FOR_MISSING_FILE_INT when source file is undefined or does not exist on filesystem
     */
    save_new_assembly: function(mi_assembly, mi_token){
        if(!_.isArray(mi_assembly) || mi_assembly.length === 0){
            console.error('Attempted to save unexpected assembly', mi_assembly)
        }

        let fullname = mi_assembly[0].fullname
        if(mi_token === constants.DISASSEMBLY_FOR_MISSING_FILE_INT){
            store.set('disassembly_for_missing_file', mi_assembly)
            store.set('has_unrendered_assembly', true)
            return
        }

        // convert assembly to an object, with key corresponding to line numbers
        // and values corresponding to asm instructions for that line
        let assembly_to_save = {}
        for(let obj of mi_assembly){
            assembly_to_save[parseInt(obj.line)] = obj.line_asm_insn
        }

        let cached_source_files = store.get('cached_source_files')
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
                store.set('cached_source_files', cached_source_files)
                break
            }
        }
        store.set('has_unrendered_assembly', true)
    },
    /**
     * Something in DOM triggered this callback to view a file.
     * The current target must have data embedded in it with:
     * fullname: full path of source code file to view
     * line (optional): line number to scroll to
     * addr (optional): instruction address to highlight
     */
    click_view_file: function(e){
        store.set('fullname_to_render', e.currentTarget.dataset['fullname'])
        store.set('current_line_of_source_code', parseInt(e.currentTarget.dataset['line']))
        store.set('make_current_line_visible', true)
    },
    keydown_jump_to_line: function(e){
        if (e.keyCode === constants.ENTER_BUTTON_NUM){
            let line = parseInt(e.currentTarget.value)
            store.set('current_line_of_source_code', line)
            store.set('make_current_line_visible', true)
        }
    },
    get_attrs_to_view_file: function(fullname, line=0){
        return `class='view_file pointer' data-fullname=${fullname} data-line=${line}`
    },
}

export default SourceCode
