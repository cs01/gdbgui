import React from 'react'

import {store} from 'statorgfc'
import BinaryLoader from './BinaryLoader.jsx'
import Settings from './Settings.jsx'
import SourceCodeHeading from './SourceCodeHeading.jsx'
import FileOps from './FileOps.jsx'
import GdbApi from './GdbApi.jsx'
import Actions from './Actions.js'
import constants from './constants.js'

let onkeyup_jump_to_line = e => {
  if (e.keyCode === constants.ENTER_BUTTON_NUM) {
    Actions.set_line_state(e.currentTarget.value)
  }
}

let btn_class = 'btn btn-default btn-sm'

let click_shutdown_button = function() {
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

let show_license = function() {
  Actions.show_modal(
    'gdbgui license',
    <React.Fragment>
      <a href="https://github.com/cs01/gdbgui/blob/master/LICENSE">GNU General Public License v3.0</a>
      <p>Copyright © Chad Smith</p>
      <p>This software can be used personally or commercially for free.</p>
      <p>
        Permissions of this strong copyleft license are conditioned on making available complete source code of licensed works and modifications,
        which include larger works using a licensed work, under the same license. Copyright and license notices must be preserved. Contributors
        provide an express grant of patent rights.
      </p>
      <p>
        If you wish to redistribute gdbgui as part of a closed source product, you can do so for a fee. Contact grassfedcode@gmail.com for details.
      </p>
    </React.Fragment>
  )
}

let About = {
  show_about: function() {
    Actions.show_modal(
      'About gdbgui',
      <React.Fragment>
        {About.get_upgrade_text()}
        <br />
        <a href="https://github.com/cs01/gdbgui/issues" className="pointer">
          Report a bug
        </a>
        <br />
        <a href="https://github.com/cs01/gdbgui/issues" className="pointer">
          Request a feature
        </a>
        <br />
        <a href="https://www.youtube.com/channel/UCUCOSclB97r9nd54NpXMV5A">YouTube Channel</a>
        <p />
        A <a href="http://grassfedcode.com">grassfedcode</a> project to make the easiest to use and most accessible gdb frontend.
        <p />
        Copyright © Chad Smith
      </React.Fragment>
    )
  },
}

let show_session_info = function() {
  Actions.show_modal(
    'session information',
    <React.Fragment>
      <table>
        <tbody>
          <tr>
            <td>gdb version: {store.get('gdb_version')}</td>
          </tr>

          <tr>
            <td>gdb pid for this tab: {store.get('gdb_pid')}</td>
          </tr>
        </tbody>
      </table>
    </React.Fragment>
  )
}

const menu = (
  <ul style={{height: 25, padding: 0, paddingRight: '15px', fontSize: '1.3em'}} className="nav navbar-nav navbar-right">
    <li id="menudropdown" className="dropdown">
      <a href="#" data-toggle="dropdown" role="button" style={{height: 25, padding: 0, paddingRight: 20}} className="dropdown-toggle">
        <span className="glyphicon glyphicon-menu-hamburger"> </span>
      </a>
      <ul className="dropdown-menu">
        <li>
          <a title="dashboard" className="pointer" href="/dashboard">
            Dashboard
          </a>
        </li>
        <li>
          <a onClick={show_session_info} className="pointer">
            Session Information
          </a>
        </li>
        <li>
          <a title="shutdown" className="pointer" onClick={click_shutdown_button}>
            Shutdown gdbgui server
          </a>
        </li>

        <li role="separator" className="divider" />
        <li>
          <a href={constants.gdbgui_donate_url} className="pointer">
            Donate
          </a>
        </li>
        <li>
          <a href="https://gitter.im/gdbgui/Lobby" className="pointer">
            Chat room
          </a>
        </li>
        <li>
          <a href="https://github.com/cs01/gdbgui" className="pointer">
            GitHub
          </a>
        </li>
        <li>
          <a href="http://gdbgui.com" className="pointer">
            Homepage
          </a>
        </li>

        <li role="separator" className="divider" />
        <li>
          <a onClick={show_license} className="pointer">
            License
          </a>
        </li>
        <li>
          <a onClick={About.show_about} className="pointer">
            About gdbgui
          </a>
        </li>
      </ul>
    </li>
  </ul>
)

class TopBar extends React.Component {
  constructor() {
    super()
    // state local to the component
    this.state = {
      assembly_flavor: 'intel', // default to intel (choices are 'att' or 'intel')
      show_spinner: false,
    }
    // global state attached to this component
    store.connectComponentState(
      this,
      ['debug_in_reverse', 'source_code_state', 'waiting_for_response', 'show_filesystem', 'latest_gdbgui_version', 'gdbgui_version'],
      this.store_update_callback.bind(this)
    )

    this.spinner_timeout = null
    this.spinner_timeout_msec = 5000
  }
  store_update_callback(keys) {
    if (keys.indexOf('waiting_for_response') !== -1) {
      this._clear_spinner_timeout()
      this.setState({show_spinner: false})
      if (this.state.waiting_for_response === true) {
        // false to true
        this._set_spinner_timeout()
      }
    }
  }
  _set_spinner_timeout() {
    this.spinner_timeout = setTimeout(() => {
      if (this.state.waiting_for_response) {
        this.setState({show_spinner: true})
      }
    }, this.spinner_timeout_msec)
  }
  _clear_spinner_timeout() {
    clearTimeout(this.spinner_timeout)
  }
  toggle_assembly_flavor() {
    const flavor = this.state.assembly_flavor === 'att' ? 'intel' : 'att'
    this.setState({assembly_flavor: flavor})
    GdbApi.set_assembly_flavor(flavor)
    Actions.clear_cached_assembly()
    FileOps.fetch_assembly_cur_line()
  }
  get_controls() {
    return (
      <div role="group" style={{marginBottom: 6, height: 25, width: 250}} className="btn-group btn-group">
        <button
          id="run_button"
          onClick={GdbApi.click_run_button}
          type="button"
          title="Start inferior program from the beginning (keyboard shortcut: r)"
          className={btn_class}>
          <span className="glyphicon glyphicon-repeat" />
        </button>
        <button
          id="continue_button"
          onClick={GdbApi.click_continue_button}
          type="button"
          title="Continue until breakpoint is hit or inferior program exits (keyboard shortcut: c)"
          className={btn_class}>
          <span className="glyphicon glyphicon-play" />
        </button>
        <button
          id="next_button"
          onClick={GdbApi.click_next_button}
          type="button"
          title="Step over next function call (keyboard shortcut: n or right arrow)"
          className={btn_class}>
          <span className="glyphicon glyphicon-step-forward" />
        </button>
        <button
          id="step_button"
          onClick={GdbApi.click_step_button}
          type="button"
          title="Step into next function call (keyboard shortcut: s or down arrow)"
          className={btn_class}>
          <span className="glyphicon glyphicon-arrow-down" />
        </button>
        <button
          id="return_button"
          onClick={GdbApi.click_return_button}
          type="button"
          title="Step out of current function (keyboard shortcut: u or up arrow)"
          className={btn_class}>
          <span className="glyphicon glyphicon-arrow-up" />
        </button>
        <div role="group" className="btn-group btn-group-xs">
          <button
            id="next_instruction_button"
            onClick={GdbApi.click_next_instruction_button}
            type="button"
            title="Next Instruction: Execute one machine instruction, stepping over function calls (keyboard shortcut: m)"
            className="btn btn-default">
            NI
          </button>
          <button
            id="step_instruction_button"
            onClick={GdbApi.click_step_instruction_button}
            type="button"
            title="Step Instruction: Execute one machine instruction, stepping into function calls (keyboard shortcut: ,)"
            className="btn btn-default">
            SI
          </button>
        </div>
      </div>
    )
  }
  render() {
    let toggle_assm_button = ''
    if (
      this.state.source_code_state === constants.source_code_states.ASSM_AND_SOURCE_CACHED ||
      this.state.source_code_state === constants.source_code_states.ASSM_CACHED
    ) {
      toggle_assm_button = (
        <button
          onClick={this.toggle_assembly_flavor.bind(this)}
          type="button"
          title={'Toggle between assembly flavors. The options are att or intel.'}
          className={'btn btn-default btn-xs'}>
          <span title={`Currently displaying ${this.state.assembly_flavor}. Click to toggle.`}>{this.state.assembly_flavor}</span>
        </button>
      )
    }

    let reload_button_disabled = 'disabled'
    if (
      this.state.source_code_state === constants.source_code_states.ASSM_AND_SOURCE_CACHED ||
      this.state.source_code_state === constants.source_code_states.SOURCE_CACHED
    ) {
      reload_button_disabled = ''
    }
    let reload_button = (
      <button
        onClick={FileOps.refresh_cached_source_files}
        type="button"
        title="Erase file from local cache and re-fetch it"
        className={'btn btn-default btn-xs ' + reload_button_disabled}>
        <span>reload file</span>
      </button>
    )

    let spinner = <span className="" style={{height: '100%', margin: '5px', width: '14px'}} />
    if (this.state.show_spinner) {
      spinner = <span className="glyphicon glyphicon-refresh glyphicon-refresh-animate" style={{height: '100%', margin: '5px', width: '14px'}} />
    }

    return (
      <div id="top" style={{background: '#f5f6f7', position: 'absolute', width: '100%'}}>
        <div className="flexrow">
          <BinaryLoader initial_user_input={this.props.initial_user_input} />
          {spinner}
          <label
            title="when clicking buttons to the right, pass the `--reverse` flag to gdb in an attempt to debug in reverse. This is not always supported. rr is known to support reverse debugging."
            style={{fontWeight: 'normal', fontSize: '0.9em', margin: '5px'}}>
            <input
              type="checkbox"
              checked={store.get('debug_in_reverse')}
              onChange={e => {
                store.set('debug_in_reverse', e.target.checked)
              }}
            />
            reverse
          </label>

          {this.get_controls()}

          <span
            onClick={() => Settings.toggle_key('show_settings')}
            title="settings"
            className="pointer glyphicon glyphicon-cog"
            style={{marginRight: '10px', fontSize: '1.3em'}}
          />
          {menu}
        </div>

        <div style={{marginTop: 3, whitespace: 'nowrap'}} className="flexrow">
          <div role="group" style={{height: '25px', marginRight: '10px'}} className="btn-group btn-group">
            <button
              className="btn btn-default btn-xs"
              title="Toggle file explorer visibility"
              onClick={() => {
                let middle_pane_sizes = store.get('middle_panes_split_obj').getSizes(),
                  file_explorer_size = middle_pane_sizes[0],
                  source_size = middle_pane_sizes[1],
                  sidebar_size = middle_pane_sizes[2],
                  new_file_explorer_size,
                  new_source_size,
                  new_sidebar_size

                if (store.get('show_filesystem')) {
                  // hide it since it's shown right now
                  new_file_explorer_size = 0
                  new_source_size = source_size + file_explorer_size / 2
                  new_sidebar_size = sidebar_size + file_explorer_size / 2
                } else {
                  new_file_explorer_size = 30
                  new_source_size = Math.max(30, source_size - new_file_explorer_size / 2)
                  new_sidebar_size = 99 - new_file_explorer_size - new_source_size
                }

                store.set('show_filesystem', !store.get('show_filesystem'))
                localStorage.setItem('show_filesystem', JSON.stringify(store.get('show_filesystem'))) // save this for next session
                store.get('middle_panes_split_obj').setSizes([new_file_explorer_size, new_source_size, new_sidebar_size])
              }}>
              {store.get('show_filesystem') ? 'hide filesystem' : 'show filesystem'}
            </button>

            <button onClick={() => FileOps.fetch_assembly_cur_line()} type="button" title="fetch disassembly" className="btn btn-default btn-xs">
              <span>fetch disassembly</span>
            </button>

            {reload_button}
            {toggle_assm_button}
          </div>

          <input
            onKeyUp={onkeyup_jump_to_line}
            autoComplete="on"
            title="Enter line number, then press enter"
            placeholder="jump to line"
            style={{width: 150, height: 25, marginLeft: 10}}
            className="form-control dropdown-input"
          />

          <div
            style={{
              marginRight: 5,
              marginLeft: 5,
              marginTop: 5,
              whiteSpace: 'nowrap',
              fontFamily: 'monospace',
              fontSize: '0.7em',
              display: 'flex',
              overflow: 'auto',
            }}
            className="lighttext">
            <SourceCodeHeading />
          </div>
        </div>
      </div>
    )
  }
  static needs_to_update_gdbgui_version() {
    // to actually check each value:

    // let latest = store.get('latest_gdbgui_version').split('.')
    // , cur = store.get('gdbgui_version').split('.')
    // if(latest.length !== cur.length){
    //     return true
    // }
    // for(let i in latest){
    //     let latest_n = latest[i]
    //     , actual_n = cur[i]
    //     if(latest_n > actual_n){
    //         return true
    //     }
    // }
    // return false
    return store.get('latest_gdbgui_version') !== store.get('gdbgui_version')
  }
  static get_upgrade_text() {
    let ltext = (
      <React.Fragment>
        <span className="bold">You are using the standard version of gdbgui. </span>
        <a href={constants.gdbgui_upgrade_url}>Get gdbgui premium key now.</a>
      </React.Fragment>
    )

    if (initial_data.p === 'd2b6fad22b1e05178f4888fcb461a481e8e0e3b7a28b6bc60b1df7eb286a77dc') {
      /* global initial_data */
      ltext = 'You are using the premium version of gdbgui.'
    }

    if (TopBar.needs_to_update_gdbgui_version()) {
      return (
        <React.Fragment>
          gdbgui version {store.get('latest_gdbgui_version')} is available. You are using {store.get('gdbgui_version')}.
          <p />
          <p />
          Visit <a href="https://gdbgui.com">gdbgui.com</a> to update to the latest version.
          <p />
          <p />
          {ltext}
          <p />
          <a href="https://github.com/cs01/gdbgui/blob/master/CHANGELOG.md">View changelog</a>
        </React.Fragment>
      )
    } else {
      return (
        <React.Fragment>
          <span>gdbgui version {store.get('gdbgui_version')} (latest version)</span>
          {ltext}
        </React.Fragment>
      )
    }
  }
}

export default TopBar
