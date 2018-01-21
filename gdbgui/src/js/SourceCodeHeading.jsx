import React from 'react';
import constants from './constants.js';
import {store} from './store.js';
import {FileLink} from './Links.jsx';
import FileOps from './FileOps.jsx';

class SourceCodeHeading extends React.Component {
    store_keys = [
        'fullname_to_render',
        'paused_on_frame',
        'line_of_source_to_flash',
        'source_code_selection_state',
    ]
    constructor() {
        super()
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
    render(){
        let line
        if(this.state.source_code_selection_state === constants.source_code_selection_states.PAUSED_FRAME && this.state.paused_on_frame){
            line = this.state.paused_on_frame.line
        }else{
            line = this.state.line_of_source_to_flash
        }

        let num_lines = 0
        if(this.state.fullname_to_render && FileOps.get_source_file_obj_from_cache(this.state.fullname_to_render)){
            num_lines = FileOps.get_num_lines_in_file(this.state.fullname_to_render)
        }
        return(<FileLink
            fullname={this.state.fullname_to_render}
            file={this.state.fullname_to_render}
            line={line}
            num_lines={num_lines}
            />)
    }
}

export default SourceCodeHeading
