
import {store} from './store.js'
import GdbApi from './GdbApi.jsx'
import constants from './constants.js'
import Actions from './Actions.js'
import React from 'react';  // needed for jsx
void(React)

const FileOps = {
    warning_shown_for_old_binary: false,
    unfetchable_disassembly_addresses: {},
    disassembly_addr_being_fetched: null,
    init: function(){
        store.subscribe(FileOps._store_change_callback)
    },
    user_select_file_to_view: function(fullname, line){
        store.set('render_paused_frame_or_user_selection', 'user_selection')
        store.set('fullname_to_render',fullname)
        store.set('line_of_source_to_flash', line)
        store.set('make_current_line_visible', true)
    },
    _store_change_callback: function(keys){
        if(_.intersection(
            ['inferior_program',
            'render_paused_frame_or_user_selection',
            'paused_on_frame',
            'current_assembly_address',
            'disassembly_for_missing_file',
            'highlight_source_code',
            'missing_files',
            'files_being_fetched',
            'gdb_version_array',
            'interpreter',
            'fullname_to_render',
            'line_of_source_to_flash',
            'cached_source_files',
            'max_lines_of_code_to_fetch'], keys).length === 0)
        {
            // FileOps is not affected by this key
            return
        }

        if(store.get('inferior_program') === constants.inferior_states.running){
            return
        }

        let paused_frame_or_user_selection = store.get('render_paused_frame_or_user_selection')
        , rendering_user_selection = paused_frame_or_user_selection === 'user_selection'
        , fullname = null
        , is_paused = false
        , paused_addr = null
        , paused_frame_fullname = null
        , paused_frame = store.get('paused_on_frame')

        if(paused_frame){
            paused_frame_fullname = paused_frame.fullname
        }

        let paused_on_line
        if (rendering_user_selection){
            fullname = store.get('fullname_to_render')
            is_paused = false
            paused_addr = null
            paused_on_line = parseInt(store.get('line_of_source_to_flash'))
        }else {  // paused_frame_or_user_selection === 'paused_frame'){
            is_paused = store.get('inferior_program') === constants.inferior_states.paused
            paused_addr = store.get('current_assembly_address')
            fullname = paused_frame_fullname
            paused_on_line = parseInt(store.get('line_of_source_to_flash'))
        }

        let assembly_is_cached = FileOps.assembly_is_cached(fullname)
        , file_is_missing = FileOps.is_missing_file(fullname)
        if(!paused_on_line){
            paused_on_line = 1
        }
        let start_line = Math.max(Math.floor(paused_on_line - store.get('max_lines_of_code_to_fetch') / 2), 1)
        , end_line = Math.ceil(start_line + store.get('max_lines_of_code_to_fetch'))
        , source_file_obj = FileOps.get_source_file_obj_from_cache(fullname)
        if(source_file_obj){
            end_line = Math.min(end_line, FileOps.get_num_lines_in_file(fullname)) // don't go past the end of the line
        }
        if(start_line > end_line){
            start_line = Math.max(1, end_line - store.get('max_lines_of_code_to_fetch'))
        }
        paused_on_line = Math.min(paused_on_line, end_line)


        FileOps.update_source_code_state(fullname, start_line, paused_on_line, end_line, assembly_is_cached, file_is_missing, is_paused, paused_addr)
    },
    update_source_code_state(fullname, start_line, paused_on_line, end_line, assembly_is_cached, file_is_missing, is_paused, paused_addr){
        const states = constants.source_code_states
        , line_is_cached = FileOps.line_is_cached(fullname, paused_on_line)

        if(fullname && line_is_cached){
            // we have file cached. We may have assembly cached too.
            store.set('source_code_state', assembly_is_cached ? states.ASSM_AND_SOURCE_CACHED: states.SOURCE_CACHED)
            store.set('source_linenum_to_display_start', start_line)
            end_line = Math.min(end_line, FileOps.get_num_lines_in_file(fullname))
            store.set('source_linenum_to_display_end', end_line)

        }else if (fullname && !file_is_missing ){
            // we don't have file cached, and it is not known to be missing on the file system, so try to get it
            store.set('source_code_state', states.FETCHING_SOURCE)

            FileOps.fetch_file(fullname, start_line, end_line)

        } else if (is_paused && paused_addr && store.get('disassembly_for_missing_file').some(obj => parseInt(obj.address, 16) === parseInt(paused_addr, 16))){
            store.set('source_code_state', states.ASSM_CACHED)

        } else if(is_paused && paused_addr){
            if(paused_addr in FileOps.unfetchable_disassembly_addresses){
                store.set('source_code_state', states.ASSM_UNAVAILABLE)

            }else{
                // get disassembly
                store.set('source_code_state', states.FETCHING_ASSM)
                FileOps.fetch_disassembly_for_missing_file(paused_addr)
            }

        } else if (file_is_missing){
            store.set('source_code_state', states.FILE_MISSING)
        }else{
            store.set('source_code_state', states.NONE_AVAILABLE)
        }
    },
    get_num_lines_in_file: function(fullname, source_file_obj){
        if(!source_file_obj){
            source_file_obj = FileOps.get_source_file_obj_from_cache(fullname)
        }
        if(!source_file_obj){
            console.error('Developer error: expected to find file object for ' + fullname)
            return
        }
        if(!source_file_obj.num_lines_in_file){
            console.error('Developer error: expected key "num_lines_in_file"')
            return Infinity
        }
        return source_file_obj.num_lines_in_file
    },
    lines_are_cached: function(fullname, start_line, end_line){
        let source_file_obj = FileOps.get_source_file_obj_from_cache(fullname)
        , linenum = start_line
        if(!source_file_obj){
            return false
        }

        const num_lines_in_file = FileOps.get_num_lines_in_file(fullname, source_file_obj)
        if(start_line > num_lines_in_file){
            return false
        }

        let safe_end_line = Math.min(end_line, num_lines_in_file)

        while(linenum <= safe_end_line){
            if(!FileOps.line_is_cached(fullname, linenum, source_file_obj)){
                return false
            }
            linenum++
        }
        return true
    },
    line_is_cached: function(fullname, linenum, source_file_obj){
        if(!source_file_obj){
            source_file_obj = FileOps.get_source_file_obj_from_cache(fullname)
        }
        return source_file_obj && source_file_obj.source_code_obj && source_file_obj.source_code_obj[linenum] !== undefined
    },
    get_line_from_file: function(fullname, linenum){
        let source_file_obj = FileOps.get_source_file_obj_from_cache(fullname)
        if(!source_file_obj){
            return null
        }
        return source_file_obj.source_code_obj[linenum]
    },
    assembly_is_cached: function(fullname){
        let source_file_obj = FileOps.get_source_file_obj_from_cache(fullname)
        return source_file_obj && source_file_obj.assembly && Object.keys(source_file_obj.assembly).length
    },
    get_source_file_obj_from_cache: function(fullname){
        let cached_files = store.get('cached_source_files')
        for(let sf of cached_files){
            if (sf.fullname === fullname){
                return sf
            }
        }
        return null
    },
    add_source_file_to_cache: function(fullname, source_code_obj, last_modified_unix_sec, num_lines_in_file){

        let cached_file_obj = FileOps.get_source_file_obj_from_cache(fullname)
        if(cached_file_obj === null){
            // nothing cached in the front end, add a new entry
            let new_source_file = {'fullname': fullname,
                                    'source_code_obj': source_code_obj,
                                    'assembly': {},
                                    'last_modified_unix_sec': last_modified_unix_sec,
                                    'num_lines_in_file': num_lines_in_file,
                                    'exists': true,
                                }
            , cached_source_files = store.get('cached_source_files')

            cached_source_files.push(new_source_file)
            store.set('cached_source_files', cached_source_files)
            FileOps.warning_shown_for_old_binary = false
            FileOps.show_modal_if_file_modified_after_binary(fullname, new_source_file.last_modified_unix_sec)
        }else{
            // mutate existing source code object by adding keys (lines) of the new source code object
            Object.assign(cached_file_obj.source_code_obj, source_code_obj)
            store.set('cached_source_files', store.get('cached_source_files'))
        }
    },
    /**
     * Show modal warning if user is trying to show a file that was modified after the binary was compiled
     */
    show_modal_if_file_modified_after_binary(fullname, src_last_modified_unix_sec){
        if(store.get('inferior_binary_path')){
            if((src_last_modified_unix_sec > store.get('inferior_binary_path_last_modified_unix_sec'))
                    && FileOps.warning_shown_for_old_binary === false){
                Actions.show_modal('Warning', (
                    <div>
                        This source file was modified <span className='bold'>after</span> the binary was compiled. Recompile the binary, then try again. Otherwise the source code may not
                        match the binary.
                        <p/>
                        <p>
                            {`Source file: ${fullname}, modified ${moment(src_last_modified_unix_sec * 1000).format(constants.DATE_FORMAT)}`}
                        </p>
                        <p>
                            {`Binary: ${store.get('inferior_binary_path')}, modified ${moment(store.get('inferior_binary_path_last_modified_unix_sec') * 1000).format(constants.DATE_FORMAT)}`})
                        </p>
                    </div>
                    )
                )
                FileOps.warning_shown_for_old_binary = true
            }
        }
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
        FileOps.clear_cached_source_files()
    },
    clear_cached_source_files: function(){
        store.set('cached_source_files', [])
    },
    fetch_file: function(fullname, start_line, end_line){
        if(FileOps.is_missing_file(fullname)){
            // file doesn't exist and we already know about it
            // don't keep trying to fetch disassembly
            console.warn(`tried to fetch a file known to be missing ${fullname}`)
            return
        }

        if(!_.isString(fullname)){
            console.warn(`trying to fetch filename that is not a string`, fullname)
            FileOps.add_missing_file(fullname)
        }else if(!fullname.startsWith('/')){
            // this can happen when an executable doesn't have debug symbols.
            // don't try to fetch it because it will never exist.
            FileOps.add_missing_file(fullname)
            return
        }

        if(FileOps.is_file_being_fetched(fullname)){
            // nothing to do
            return
        }else{
            FileOps.add_file_being_fetched(fullname)
        }

        const data = {
            start_line: start_line,
            end_line: end_line,
            path: fullname,
            highlight: store.get('highlight_source_code'),
        }

        $.ajax({
            url: "/read_file",
            cache: false,
            type: 'GET',
            data: data,
            success: function(response){
                response.source_code
                let source_code_obj = {}
                let linenum = response.start_line
                for(let line of response.source_code_array){
                    source_code_obj[linenum] = line
                    linenum++
                }

                FileOps.add_source_file_to_cache(fullname,
                                                source_code_obj,
                                                response.last_modified_unix_sec,
                                                response.num_lines_in_file)
            },
            error: function(response){
                if (response.responseJSON && response.responseJSON.message){
                    Actions.add_console_entries(_.escape(response.responseJSON.message), constants.console_entry_type.STD_ERR)
                }else{
                    Actions.add_console_entries(`${response.statusText} (${response.status} error)`, constants.console_entry_type.STD_ERR)
                }
                FileOps.file_no_longer_being_fetched(fullname)
                FileOps.add_missing_file(fullname)
            },
            complete: function(){
                FileOps.file_no_longer_being_fetched(fullname)
            }
        })
    },
    is_file_being_fetched: function(fullname){
        return store.get('files_being_fetched').indexOf(fullname) !== -1
    },
    is_missing_file: function(fullname){
        return store.get('missing_files').indexOf(fullname) !== -1
    },
    add_missing_file: function(fullname){
        let missing_files = store.get('missing_files')
        missing_files.push(fullname)
        store.set('missing_files', missing_files)
    },
    add_file_being_fetched: function(fullname){
        let files = store.get('files_being_fetched')
        if(files.indexOf(fullname) !== -1){
            console.warn(`${fullname} is already being fetched`)
        }
        files.push(fullname)
        store.set('files_being_fetched', files)
    },
    file_no_longer_being_fetched: function(fullname){
        let files = store.get('files_being_fetched')
        store.set('files_being_fetched', _.without(files, fullname))
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
        let mi_response_format = FileOps.get_dissasembly_format_num(store.get('gdb_version_array'))
        if(_.isString(fullname) && fullname.startsWith('/')){
            if(store.get('interpreter') === 'gdb'){
                return `-data-disassemble -f ${fullname} -l ${start_line} -n 1000 -- ${mi_response_format}`
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
        , line = parseInt(store.get('line_of_source_to_flash'))
        if(!line){
            line = 1
        }
        FileOps.fetch_disassembly(fullname, line)
    },
    fetch_disassembly: function(fullname, start_line){
        let cmd = FileOps.get_fetch_disassembly_command(fullname, start_line)
        if(cmd){
           GdbApi.run_gdb_command(cmd)
        }
    },
    fetch_disassembly_for_missing_file: function(hex_addr){
        // https://sourceware.org/gdb/onlinedocs/gdb/GDB_002fMI-Data-Manipulation.html
        if(window.isNaN(hex_addr)){
            return
        }

        let start = parseInt(hex_addr, 16)
        , end = start + 100
        FileOps.disassembly_addr_being_fetched = hex_addr
        GdbApi.run_gdb_command(constants.DISASSEMBLY_FOR_MISSING_FILE_STR + `-data-disassemble -s 0x${start.toString((16))} -e 0x${end.toString((16))} -- 0`)

    },
    fetch_disassembly_for_missing_file_failed: function(){
        let addr_being_fetched = FileOps.disassembly_addr_being_fetched
        FileOps.unfetchable_disassembly_addresses[addr_being_fetched] = true
        FileOps.disassembly_addr_being_fetched = null
    },
    /**
     * Save assembly and render source code if desired
     * @param mi_assembly: array of assembly instructions
     * @param mi_token (int): corresponds to either null (when src file is known and exists),
     *  constants.DISASSEMBLY_FOR_MISSING_FILE_INT when source file is undefined or does not exist on filesystem
     */
    save_new_assembly: function(mi_assembly, mi_token){
        FileOps.disassembly_addr_being_fetched = null

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
                cached_file.assembly = Object.assign(cached_file.assembly, assembly_to_save)

                let max_assm_line = Math.max(Object.keys(cached_file.assembly))
                , max_source_line = Math.max(Object.keys(cached_file.source_code_obj))
                if(max_assm_line > max_source_line){
                    cached_file.source_code_obj[max_assm_line] = ''
                    for(let i = 0; i < max_assm_line; i++){
                        if(!cached_file.source_code_obj[i]){
                            cached_file.source_code_obj[i] = ''
                        }
                    }
                }
                store.set('cached_source_files', cached_source_files)
                break
            }
        }
        store.set('has_unrendered_assembly', true)
    },
}
export default FileOps
