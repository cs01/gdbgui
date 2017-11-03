import React from 'react';
import Util from './Util.js';
import {store} from './store.js';

/**
 * Component to render a status message with optional error/warning label
 */
class StatusBar extends React.Component {
    store_keys = [
        'waiting_for_response',
        'status'
    ]
    constructor() {
        super();
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


    // statc method to update the store with mi object
    static render_from_gdb_mi_response(mi_obj){
        if(!mi_obj){
            return
        }
        // Update status
        let status = [],
            error = false
        if (mi_obj.message){
            if(mi_obj.message === 'error'){
                error = true
            }else{
                status.push(mi_obj.message)
            }
        }
        if (mi_obj.payload){
            let err_text_array = Util.get_err_text_from_mi_err_response(mi_obj)
            status = status.concat(err_text_array)
        }
        store.set('status', {'text': status.join(', '), 'error': error})
    }

    render() {
        if(this.state.waiting_for_response){
            return (<span className='glyphicon glyphicon-refresh glyphicon-refresh-animate'></span>)
        }else{
            let prefix = '';
            if(this.state.status.error){
                prefix = <span className='label label-danger'>error</span>
            }else if (this.state.status.warning){
                prefix = <span className='label label-warning'>warning</span>
            }
            return (
                <div >
                    {prefix}<span>&nbsp;</span>
                    <span>{this.state.status.text}</span>
                </div>
            );
        }
    }
}

export default StatusBar;
