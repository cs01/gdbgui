/**
 * A component to display, in gory detail, what is
 * returned from gdb's machine interface. This displays the
 * data source that is fed to all components and UI elements
 * in gdb gui, and is useful when debugging gdbgui, or
 * a command that failed but didn't have a useful failure
 * message in gdbgui.
 */
import React from 'react';
import {store} from './store.js';

class GdbMiOutput extends React.Component {

    static MAX_OUTPUT_ENTRIES = 500
    store_keys = ['gdb_mi_output']
    constructor(){
        super()
        this._store_change_callback = this._store_change_callback.bind(this)
        this.state = this._get_applicable_global_state()
        store.subscribe(this._store_change_callback.bind(this))
        this._debounced_scroll_to_bottom = _.debounce(this._scroll_to_bottom.bind(this), 300, {leading: true})
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
        return(
            <div>
                <button title='clear all mi output'
                    className='pointer btn btn-default btn-xs'
                    onClick={()=>store.set('gdb_mi_output', [])}
                >
                    clear output
                    <span className='glyphicon glyphicon-ban-circle pointer' />
                </button>
                <div id='gdb_mi_output' className='otpt' style={{fontSize: '0.8em'}}>
                    {this.state.gdb_mi_output}
                </div>
            </div>
        )
    }
    componentDidMount(){
        this.el = document.getElementById('gdb_mi_output')
    }
    componentDidUpdate(){
        this._debounced_scroll_to_bottom()
    }
    _scroll_to_bottom(){
        this.el.scrollTop = this.el.scrollHeight
    }
    static add_mi_output(mi_obj){
        let new_str = JSON.stringify(mi_obj, null, 4)
            .replace(/[^(\\)]\\n/g).replace("<", "&lt;").replace(">", "&gt;")
        , gdb_mi_output = store.get('gdb_mi_output')

        while(gdb_mi_output.length > GdbMiOutput.MAX_OUTPUT_ENTRIES){
            gdb_mi_output.shift()
        }
        gdb_mi_output.push(new_str)

        store.set('gdb_mi_output', gdb_mi_output)
    }
}

export default GdbMiOutput
