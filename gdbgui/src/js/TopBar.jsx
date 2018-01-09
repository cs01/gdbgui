import React from 'react';

import {store} from './store.js';
import BinaryLoader from './BinaryLoader.jsx';
import Settings from './Settings.jsx';
import SourceCodeHeading from './SourceCodeHeading.jsx';
import SourceFileAutocomplete from './SourceFileAutocomplete.jsx';
import FileOps from './FileOps.jsx';
import GdbApi from './GdbApi.jsx';
import Actions from './Actions.js';
import constants from './constants.js';

let onkeyup_jump_to_line = (e)=>{
    if (e.keyCode === constants.ENTER_BUTTON_NUM){
        Actions.set_line_state(e.currentTarget.value)
    }
}

let btn_class = 'btn btn-default btn-sm'

const controls =
        <div role="group" style={{marginBottom: 6, height: 25, width: 250}} className="btn-group btn-group">
          <button id="run_button"
                onClick={GdbApi.click_run_button}
                type="button"
                title="Start inferior program from the beginning (keyboard shortcut: r)"
                className={btn_class}><span className="glyphicon glyphicon-repeat" />
          </button>
          <button id="continue_button"
                onClick={GdbApi.click_continue_button}
                type="button"
                title="Continue until breakpoint is hit or inferior program exits (keyboard shortcut: c)"
                className={btn_class}><span className="glyphicon glyphicon-play" />
          </button>
          <button id="next_button"
                onClick={GdbApi.click_next_button}
                type="button"
                title="Step over next function call (keyboard shortcut: n or right arrow)"
                className={btn_class}><span className="glyphicon glyphicon-step-forward" />
          </button>
          <button id="step_button"
                onClick={GdbApi.click_step_button}
                type="button"
                title="Step into next function call (keyboard shortcut: s or down arrow)"
                className={btn_class}><span className="glyphicon glyphicon-arrow-down" />
          </button>
          <button id="return_button"
                onClick={GdbApi.click_return_button}
                type="button"
                title="Step out of current function (keyboard shortcut: u or up arrow)"
                className={btn_class}><span className="glyphicon glyphicon-arrow-up" />
          </button>
          <div role="group" className="btn-group btn-group-xs">
            <button id="next_instruction_button"
                onClick={GdbApi.click_next_instruction_button}
                type="button" title="Next Instruction: Execute one machine instruction, stepping over function calls (keyboard shortcut: m)"
                className="btn btn-default">NI
            </button>
            <button id="step_instruction_button"
                onClick={GdbApi.click_step_instruction_button}
                type="button"
                title="Step Instruction: Execute one machine instruction, stepping into function calls (keyboard shortcut: ,)"
                className="btn btn-default">SI
            </button>
          </div>
        </div>


let click_shutdown_button = function(){
    // no need to show confirmation before leaving, because we're about to prompt the user
    window.onbeforeunload = () => null
    // prompt user
    if (window.confirm('This will terminate the gdbgui for all browser tabs running gdbgui (and their gdb processes). Continue?') === true) {
        // user wants to shutdown, redirect them to the shutdown page
        window.location = '/shutdown'
    } else {
        // re-add confirmation before leaving page (when user actually leaves at a later time)
        window.onbeforeunload = () => 'some text'
    }
}

const menu =
    <ul style={{height: 25, padding: 0}} className="nav navbar-nav navbar-right">
      <li id="menudropdown" className="dropdown"><a href="#" data-toggle="dropdown" role="button" style={{height: 25, padding: 0, paddingRight: 20}} className="dropdown-toggle"><span className="glyphicon glyphicon-menu-hamburger"> </span></a>
        <ul className="dropdown-menu">
          <li><a onClick={()=>Settings.toggle_key('show_settings')} title="settings" className="pointer">Settings</a>
          </li>
          <li><a title="dashboard" className="pointer" href='/dashboard'>Dashboard</a>
          </li>
          <li><a href="http://gdbgui.com" className="pointer">gdbgui.com</a>
          </li>
          <li><a href="https://github.com/cs01/gdbgui" className="pointer">github</a>
          </li>
          <li><a href="https://gitter.im/gdbgui/Lobby" className="pointer">gdbgui Chat Room</a>
          </li>
          <li><a title="Help" href="https://github.com/cs01/gdbgui/blob/master/HELP.md" className="pointer">Help</a>
          </li>
          <li role="separator" className="divider" />
          <li><a title="shutdown" className="pointer" onClick={click_shutdown_button}>Shutdown</a>
          </li>
        </ul>
      </li>
    </ul>


class TopBar extends React.Component {
    store_keys = ['debug_in_reverse', 'source_code_state', 'waiting_for_response']
    constructor(){
      super()
      this.state = this._get_applicable_global_state()
      this.state['assembly_flavor'] = 'intel'  // default to intel (choices are 'att' or 'intel')
      this.state['show_spinner'] = false  // att or intel
      store.subscribe(this._store_change_callback.bind(this))
      store.subscribe(this._set_spinner_timeout.bind(this))
      store.subscribe(this._clear_spinner_timeout.bind(this))

      this.spinner_timeout = null
      this.spinner_timeout_msec = 5000
    }

    _store_change_callback(keys){
        if(_.intersection(this.store_keys, keys).length){
            this.setState(this._get_applicable_global_state())
        }
        if(keys.indexOf('waiting_for_response') !== -1){
          this._clear_spinner_timeout()
          this.setState({'show_spinner': false})
          if(this.state.waiting_for_response === true){
            // false to true
            this._set_spinner_timeout()
          }
        }
    }
    _set_spinner_timeout(){
      this.spinner_timeout = setTimeout(()=>{
        if(this.state.waiting_for_response){
          this.setState({'show_spinner': true})
        }
      }, this.spinner_timeout_msec)
    }
    _clear_spinner_timeout(){
      clearTimeout(this.spinner_timeout)
    }
    _get_applicable_global_state(){
        let applicable_state = {}
        for (let k of this.store_keys){
            applicable_state[k] = store._store[k]
        }
        return applicable_state
    }

    toggle_assembly_flavor(){
      const flavor = this.state.assembly_flavor === 'att' ? 'intel' : 'att'
      this.setState({'assembly_flavor': flavor})
      GdbApi.set_assembly_flavor(flavor)
      Actions.clear_cached_assembly()
      FileOps.fetch_assembly_cur_line()
    }
    render(){
        let toggle_assm_button = ''
        if(this.state.source_code_state === constants.source_code_states.ASSM_AND_SOURCE_CACHED ||
          this.state.source_code_state === constants.source_code_states.ASSM_CACHED){
          toggle_assm_button = <button
                            onClick={this.toggle_assembly_flavor.bind(this)}
                            type="button"
                            title={'Toggle between assembly flavors. The options are att or intel.'}
                            className={"btn btn-default btn-xs"}>
                            <span title={`currently displaying ${this.state.assembly_flavor}. Click to toggle.`}>
                              {this.state.assembly_flavor}
                            </span>
                      </button>
        }

        let spinner = <span className='' style={{height: '100%', margin: '5px', 'width': '14px'}}/>
        if(this.state.show_spinner){
          spinner = <span className='glyphicon glyphicon-refresh glyphicon-refresh-animate' style={{height: '100%', margin: '5px', 'width': '14px'}}/>
        }

        return(
            <div id="top" style={{background: '#f5f6f7', marginBottom: 5}}>
                <div className="flexrow">

                    <BinaryLoader initial_user_input={this.props.initial_user_input} />
                    {spinner}
                    <label title='when clicking buttons to the right, pass the `--reverse` flag to gdb in an attempt to debug in reverse. This is not always supported. rr is known to support reverse debugging.' style={{fontWeight: 'normal', fontSize: '0.9em', 'margin': '5px'}}>
                      <input type='checkbox' checked={store.get('debug_in_reverse')} onChange={(e)=>{
                        store.set('debug_in_reverse', e.target.checked)
                      }}/>
                      reverse
                    </label>
                    {controls}
                    {menu}
                </div>

                <div style={{width: '100%'}}>
                    <SourceFileAutocomplete />
                </div>

                <div style={{marginTop: 3}} className="flexrow">
                    <input onKeyUp={onkeyup_jump_to_line}
                        autoComplete="on"
                        title="Enter line number, then press enter"
                        placeholder="jump to line" style={{width: 150, height: 25, marginLeft: 10}}
                        className="form-control dropdown-input"
                    />
                    <div role="group" style={{height: 25}} className="btn-group btn-group">

                      <button onClick={FileOps.fetch_assembly_cur_line} type="button" title="fetch disassembly" className="btn btn-default btn-xs">
                        <span>fetch disassembly</span>
                      </button>

                      <button
                            onClick={FileOps.refresh_cached_source_files}
                            type="button"
                            title="fetch disassembly"
                            className="btn btn-default btn-xs">
                          <span>reload/hide disassembly</span>
                      </button>

                      {toggle_assm_button}

                    </div>

                    <div style={{marginRight: 5, marginLeft: 5, marginTop: 5, whiteSpace: 'nowrap', fontFamily: 'monospace', fontSize: '0.7em'}} className="lighttext">
                        <SourceCodeHeading />
                    </div>
                </div>
            </div>
        )
    }
}

export default TopBar



