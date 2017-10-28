/**
 * A component to render source code, assembly, and break points
 */

import {store} from './store.js';
import React from 'react';
import FileOps from './FileOps.js';
import Breakpoints from './Breakpoints.jsx';
import MemoryLink from './MemoryLink.jsx';
import constants from './constants.js';

class SourceCode extends React.Component {
    static el_code_container = $('#code_container')  // todo: no jquery
    store_keys = [
        'fullname_to_render',
        'cached_source_files',
        'missing_files',
        'disassembly_for_missing_file',
        'line_of_source_to_flash',
        'paused_on_frame',
        'breakpoints',
        'source_code_state',
        'make_current_line_visible',
        'render_paused_frame_or_user_selection',
        'current_theme',
        'inferior_binary_path',
        'has_unrendered_assembly'
    ]

    constructor() {
        super()

        document.getElementById('jump_to_line').onkeyup = (e)=>{
            if (e.keyCode === constants.ENTER_BUTTON_NUM){
                SourceCode.set_line_state(e.currentTarget.value)
            }
        }

        // bind methods
        this.get_body_assembly_only = this.get_body_assembly_only.bind(this)
        this._get_source_line = this._get_source_line.bind(this)
        this._get_assm_row = this._get_assm_row.bind(this)
        this.click_gutter = this.click_gutter.bind(this)
        this.is_paused_on_this_line = this.is_paused_on_this_line.bind(this)
        this._store_change_callback = this._store_change_callback.bind(this)

        this.state = this._get_applicable_global_state()
        store.subscribe(this._store_change_callback.bind(this))
    }

    _store_change_callback(keys){
        if(_.intersection(this.store_keys, keys).length){
            this.setState(this._get_applicable_global_state())
        }
    }
    _get_applicable_global_state(){
        let applicable_state = {}
        for (let k of this.store_keys){
            applicable_state[k] = store._store[k]
        }
        return applicable_state
    }

    click_gutter(line_num){
        Breakpoints.add_or_remove_breakpoint(this.state.fullname_to_render, line_num)
    }

    _get_source_line(   source,
                        line_should_flash,
                        is_paused_on_this_line,
                        line_num_being_rendered,
                        has_bkpt,
                        has_disabled_bkpt,
                        assembly_for_line,
                        paused_addr){

        let row_class = ['srccode']

        if(is_paused_on_this_line){
            row_class.push('paused_on_line')
        }else if(line_should_flash){
            row_class.push('flash')
        }

        let id = ''
        if(is_paused_on_this_line && this.state.render_paused_frame_or_user_selection === 'paused_frame' ||
            line_should_flash){
            id = 'scroll_to_line'
        }

        let gutter_cls = ''
        if(has_bkpt){
            gutter_cls = 'breakpoint'
        }else if (has_disabled_bkpt){
            gutter_cls = 'disabled_breakpoint'
        }

        let assembly_content = []
        if(assembly_for_line){
            let i = 0
            for(let assm of assembly_for_line){
                assembly_content.push(SourceCode._get_assm_content(i, assm, paused_addr))
                assembly_content.push(<br key={'br'+i}/>)
                i++
            }
        }

        return (
            <tr id={id} key={line_num_being_rendered} className={`${row_class.join(' ')}`}>

                <td style={{'verticalAlign': 'top', width: '30px'}} className={'line_num ' + gutter_cls} onClick={()=>{this.click_gutter(line_num_being_rendered)}}>
                    <div>{line_num_being_rendered}</div>
                </td>

                <td style={{'verticalAlign': 'top'}} className="loc">
                    <span className='wsp' dangerouslySetInnerHTML={{__html: source}}></span>
                </td>

                <td className='assembly'>
                    {assembly_content}
                </td>
            </tr>)
    }

    /**
     * example return value: mov $0x400684,%edi(00) main+8 0x0000000000400585
     */
    static _get_assm_content(key, assm, paused_addr){
        let op = assm.opcodes ? `(${assm.opcodes})` : ''
        , instruction = assm.inst
        , func_name = assm['func-name']
        , offset = assm.offset
        , addr = assm.address
        , on_current_instruction = paused_addr === assm.address
        , cls = on_current_instruction ? 'current_assembly_command' : ''
        , asterisk = on_current_instruction ? <span className='glyphicon glyphicon-chevron-right' style={{width: '10px', display: 'inline-block'}}/> : <span style={{width: '10px', display: 'inline-block'}}> </span>
        return(<span key={key} style={{'whiteSpace': "nowrap"}} className={cls}>
                    {asterisk} {op} {instruction} {func_name}+{offset} <MemoryLink addr={addr} />
                </span>)
    }

    _get_assm_row(key, assm, paused_addr){
        return (
            <tr key={key} className='srccode'>
            <td className='assembly loc'>
                {SourceCode._get_assm_content(key, assm, paused_addr)}
            </td>
            </tr>
        )
    }

    is_paused_on_this_line(line_num_being_rendered, gdb_paused_on_line){
        if(this.state.paused_on_frame){
            return (line_num_being_rendered === gdb_paused_on_line &&
                    this.state.paused_on_frame.fullname === this.state.fullname_to_render)
        }else{
            return false
        }
    }

    get_body_source_and_assm(source_code, assembly, paused_addr){
        let body = []

        let bkpt_lines = Breakpoints.get_breakpoint_lines_for_file(this.state.fullname_to_render)
        , disabled_breakpoint_lines = Breakpoints.get_disabled_breakpoint_lines_for_file(this.state.fullname_to_render)

        let gdb_paused_on_line = this.state.paused_on_frame ? parseInt(this.state.paused_on_frame.line) : 0
        for (let i = 0; i < source_code.length; i++){

            let line_num_being_rendered = i + 1
            , has_bkpt = bkpt_lines.indexOf(line_num_being_rendered) !== -1
            , has_disabled_bkpt = disabled_breakpoint_lines.indexOf(line_num_being_rendered) !== -1
            , is_paused_on_this_line = this.is_paused_on_this_line(line_num_being_rendered, gdb_paused_on_line)
            , assembly_for_line = assembly[line_num_being_rendered]

            body.push(this._get_source_line(source_code[i],
                this.state.line_of_source_to_flash === line_num_being_rendered,
                is_paused_on_this_line,
                line_num_being_rendered,
                has_bkpt,
                has_disabled_bkpt,
                assembly_for_line,
                paused_addr))
        }
        return body
    }

    get_body_assembly_only(assm_array, paused_addr){
        let body = []
        , i = 0
        for(let assm of assm_array){
            body.push(this._get_assm_row(i, assm, paused_addr))
            i++
        }
        return body
    }

    get_body_empty(){
        return(<tr><td>no source code or assembly to display</td></tr>)
    }

    get_body(){
        const states = constants.source_code_states
        switch(this.state.source_code_state){
            case (states.ASSM_AND_SOURCE_CACHED):{
                let obj = FileOps.get_source_file_obj_from_cache(this.state.fullname_to_render)
                if(!obj){
                    console.error("expected to find source file")
                    return this.get_body_empty()
                }
                let paused_addr = this.state.paused_on_frame ? this.state.paused_on_frame.addr : null
                return this.get_body_source_and_assm(obj.source_code, obj.assembly, paused_addr)
            }
            case (states.SOURCE_CACHED):{
                let obj = FileOps.get_source_file_obj_from_cache(this.state.fullname_to_render)
                if(!obj){
                    console.error("expected to find source file")
                    return this.get_body_empty()
                }
                let paused_addr = this.state.paused_on_frame ? this.state.paused_on_frame.addr : null
                return this.get_body_source_and_assm(obj.source_code, obj.assembly, paused_addr)
            }
            case states.FETCHING_SOURCE:{
                return(<tr><td>fetching source, please wait</td></tr>)
            }
            case states.ASSM_CACHED:{
                let paused_addr = this.state.paused_on_frame ? this.state.paused_on_frame.addr : null
                , assm_array = this.state.disassembly_for_missing_file
                return this.get_body_assembly_only(assm_array, paused_addr)
            }
            case states.FETCHING_ASSM:{
                return(<tr><td>fetching assembly, please wait</td></tr>)
            }
            case states.ASSM_UNAVAILABLE:{
                let paused_addr = this.state.paused_on_frame ? this.state.paused_on_frame.addr : null
                return (<tr><td>cannot access address {paused_addr}</td></tr>)
            }
            case states.FILE_MISSING:{
                return (<tr><td>file not found: {this.state.fullname_to_render}</td></tr>)
            }
            case states.NONE_AVAILABLE:{
                return this.get_body_empty()
            }
            default:{
                console.error('developer error: unhandled state')
                return this.get_body_empty()
            }
        }
    }
    shouldComponentUpdate(){
        return true
        // TODO fine tune this
        // SourceCode.set_theme_in_dom()
        // if(store.get('has_unrendered_assembly')){
        //     return true
        // }

        // if (this.state.source_code_state === constants.source_code_states.SOURCE_CACHED ||
        //     this.state.source_code_state === constants.source_code_states.ASSM_AND_SOURCE_CACHED){
        //     if(store.get('fullname_to_render') === store.get('fullname_rendered')){
        //         // no need to render the whole file all over again. Just make "decorations" are up to date
        //         render_breakpoints()
        //         highlight_paused_line()
        //         highlight_current_instruction()
        //         return false
        //     }
        // }
        // return true
    }
    render(){
        return(<div className={this.state.current_theme} style={{height: '100%'}}>
                    <table id='code_table' className={this.state.current_theme}  style={{width: '100%'}}>
                    <tbody id='code_body'>
                        {this.get_body()}
                    </tbody>
                </table>
            </div>)
    }

    componentDidUpdate(){
        if (this.state.source_code_state === constants.source_code_states.SOURCE_CACHED ||
            this.state.source_code_state === constants.source_code_states.ASSM_AND_SOURCE_CACHED)
        {
            if (this.state.make_current_line_visible){
                SourceCode.make_current_line_visible()
                store.set('make_current_line_visible', false)
            }
            store.set('fullname_rendered', this.state.fullname_to_render)
        }

        if (this.state.source_code_state === constants.source_code_states.ASSM_AND_SOURCE_CACHED ||
            this.state.source_code_state === constants.source_code_states.ASSM_CACHED){
            store.set('has_unrendered_assembly', false)
        }
    }
    static make_current_line_visible(){
        SourceCode.scroll_to_jq_selector($("#scroll_to_line"))
    }
    /**
     * Scroll to a jQuery selection in the source code table
     * Used to jump around to various lines
     */
    static scroll_to_jq_selector(jq_selector){
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
                let scroll_top = top_of_line - (top_of_table + height_of_container/2)
                SourceCode.el_code_container.animate({'scrollTop': scroll_top}, time_to_scroll)
            }
        }else{
            // nothing to scroll to
        }
    }
    static view_file(fullname, line){
        store.set('render_paused_frame_or_user_selection', 'user_selection')
        store.set('fullname_to_render', fullname)
        SourceCode.set_line_state(line)
    }

    static set_line_state(line){
        store.set('line_of_source_to_flash', parseInt(line))
        store.set('make_current_line_visible', true)
    }

}

// =======================================================
// TODO ressurect these for more efficiency when large files are being rendered
// =======================================================
// re-render breakpoints on whichever file is loaded
// let render_breakpoints = function(){
//     console.warn("TODO: render_breakpoints")
    // document.querySelectorAll('.line_num.breakpoint').forEach(el => el.classList.remove('breakpoint'))
    // document.querySelectorAll('.line_num.disabled_breakpoint').forEach(el => el.classList.remove('disabled_breakpoint'))
    // if(_.isString(state.get('rendered_source_file_fullname'))){

    //     let bkpt_lines = Breakpoint.get_breakpoint_lines_for_file(state.get('rendered_source_file_fullname'))
    //     , disabled_breakpoint_lines = Breakpoint.get_disabled_breakpoint_lines_for_file(state.get('rendered_source_file_fullname'))

    //     for(let bkpt_line of bkpt_lines){
    //         let js_line = $(`td.line_num[data-line=${bkpt_line}]`)[0]
    //         if(js_line){
    //             $(js_line).addClass('breakpoint')
    //         }
    //     }

    //     for(let bkpt_line of disabled_breakpoint_lines){
    //         let js_line = $(`td.line_num[data-line=${bkpt_line}]`)[0]
    //         if(js_line){
    //             $(js_line).addClass('disabled_breakpoint')
    //         }
    //     }
    // }
// }

// let highlight_paused_line = function(){
//     console.warn("TODO: highlight_paused_line")

    // remove_line_highlights()

    // let fullname = state.get('rendered_source_file_fullname')
    // , line_num = state.get('current_line_of_source_code')
    // , addr = state.get('current_assembly_address')
    // , inferior_program_is_paused_in_this_file = _.isObject(state.get('paused_on_frame')) && state.get('paused_on_frame').fullname === fullname
    // , paused_on_current_line = (inferior_program_is_paused_in_this_file && parseInt(state.get('paused_on_frame').line) === parseInt(line_num))

    // // make background blue if gdb is paused on a line in this file
    // if(inferior_program_is_paused_in_this_file){
    //     let jq_line = $(`.loc[data-line=${state.get('paused_on_frame').line}]`)
    //     if(jq_line.length === 1){
    //         jq_line.offset()  // needed so DOM registers change and re-draws animation
    //         jq_line.addClass('paused_on_line')
    //         if(paused_on_current_line){
    //             jq_line.attr('id', 'scroll_to_line')
    //         }
    //     }
    // }

    // // make this line flash ONLY if it's NOT the line we're paused on
    // if(line_num && !paused_on_current_line){
    //     let jq_line = $(`.loc[data-line=${line_num}]`)
    //     if(jq_line.length === 1){
    //         // https://css-tricks.com/restart-css-animation/
    //         jq_line.offset()  // needed so DOM registers change and re-draws animation
    //         jq_line.addClass('flash')
    //         jq_line.attr('id', 'scroll_to_line')
    //     }
    // }

    // if(addr){
    //     // find element with assembly class and data-addr as the desired address, and
    //     // current_assembly_command class
    //     let jq_assembly = $(`.assembly[data-addr=${addr}]`)
    //     if(jq_assembly.length === 1){
    //         jq_assembly.addClass('current_assembly_command')
    //     }
    // }
// }

// let highlight_current_instruction = function(){
//     console.warn("TODO: highlight_current_instruction")
// }

export default SourceCode
