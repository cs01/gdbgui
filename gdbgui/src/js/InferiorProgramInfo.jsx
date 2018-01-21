import Actions from './Actions.js'
import constants from './constants.js'
import React from 'react'
import {store} from './store.js'

class InferiorProgramInfo extends React.Component {
    store_keys = [
        'inferior_pid',
        'gdb_pid',
    ]
    constructor() {
        super()
        this.send_signal = this.send_signal.bind(this)
        this.get_choice = this.get_choice.bind(this)
        this._store_change_callback = this._store_change_callback.bind(this)
        this.state = {inferior_pid: store._store.inferior_pid,
            selected_inferior_signal: 'SIGINT',
            selected_gdb_signal: 'SIGINT',
        }
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

    send_signal(signal_name, pid){
        $.ajax({
            url: "/send_signal_to_pid",
            cache: false,
            type: 'GET',
            data: {signal_name: signal_name, pid: pid},
            success: function(response){
                Actions.add_console_entries(response.message, constants.console_entry_type.GDBGUI_OUTPUT)
            },
            error: function(response){
                if (response.responseJSON && response.responseJSON.message){
                    Actions.add_console_entries(_.escape(response.responseJSON.message), constants.console_entry_type.STD_ERR)
                }else{
                    Actions.add_console_entries(`${response.statusText} (${response.status} error)`, constants.console_entry_type.STD_ERR)
                }
                console.error(response)
            },
            complete: function(){
            }
        })
    }

    get_choice(s, signal_key){
        let onclick = function(){
                        let obj = {}
                        obj[signal_key] = s
                        this.setState(obj)
                    }.bind(this)

        return <li key={s} className='pointer' value={s} onClick={onclick}>
                    <a >{`${s} (${this.props.signals[s]})`}</a>
                </li>
    }
    get_signal_choices(signal_key){
        let signals = []
        for(let s in this.props.signals){
            if(s === 'SIGKILL' || s === 'SIGINT'){
                signals.push(this.get_choice(s, signal_key))
            }
        }
        for(let s in this.props.signals){
            if(s !== 'SIGKILL' && s !== 'SIGINT'){
                signals.push(this.get_choice(s, signal_key))
            }
        }
        return signals
    }
    render(){

        return(
            <div>

                <span>gdb pid: {this.state.gdb_pid}</span>
                <br/>
                <div className="dropdown btn-group">

                    <button className="btn btn-default btn-xs dropdown-toggle" type="button" data-toggle="dropdown">{this.state.selected_gdb_signal}
                        <span className="caret" style={{marginLeft: '5px'}}> </span>
                    </button>
                    <ul className="dropdown-menu" style={{maxHeight: '300px', overflow: 'auto'}}>
                        {this.get_signal_choices('selected_gdb_signal')}
                    </ul>

                    <button className='btn btn-default btn-xs'
                                id='step_instruction_button'
                                style={{marginLeft: '5px'}}
                                type='button'
                                title={`Send signal to pid ${this.state.gdb_pid}`}
                                onClick={() => this.send_signal(this.state.selected_gdb_signal, this.state.gdb_pid)}
                            >
                                send to gdb
                    </button>
                </div>

                <p />

                <span>inferior program pid: {this.state.inferior_pid ? this.state.inferior_pid : 'n/a'}</span>
                <br/>
                <div className="dropdown btn-group">

                    <button className="btn btn-default btn-xs dropdown-toggle" type="button" data-toggle="dropdown">{this.state.selected_inferior_signal}
                        <span className="caret" style={{marginLeft: '5px'}}> </span>
                    </button>
                    <ul className="dropdown-menu" style={{maxHeight: '300px', overflow: 'auto'}}>
                      {this.get_signal_choices('selected_inferior_signal')}
                    </ul>

                    <button className='btn btn-default btn-xs'
                                id='step_instruction_button'
                                style={{marginLeft: '5px'}}
                                type='button'
                                title={`Send signal to pid ${this.state.inferior_pid}. Note: signal is sent to machine running the gdbgui, so if running gdbserver remotely this will not work.`}
                                onClick={() => this.send_signal(this.state.selected_inferior_signal, this.state.inferior_pid)}
                            >
                                send to inferior
                    </button>
                </div>



            </div>
        )
    }
}

export default InferiorProgramInfo
