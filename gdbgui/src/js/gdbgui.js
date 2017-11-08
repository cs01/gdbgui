/**
 * This is the main frontend that splits the UI into pieces,
 * intializes various components, etc.
 *
 * There are several top-level components, most of which can render new html in the browser.
 *
 * store (global state) is managed in a single location, and each time the store
 * changes, all listeners (mostly Components) are notified.
 * Each Component then re-renders itself as necessary.
 *
 */

 /* global Split */
 /* global debug */
 /* global initial_data */

import {store, initial_store_data} from './store.js';
import GdbApi from './GdbApi.js';
import ReactDOM from 'react-dom';
import React from 'react';
import StatusBar from './StatusBar.jsx';
import BinaryLoader from './BinaryLoader.js';
import GlobalEvents from './GlobalEvents.js';
import MiddleLeft from './MiddleLeft.jsx';
import SourceCodeHeading from './SourceCodeHeading.jsx';
import SourceFileAutocomplete from './SourceFileAutocomplete.js';
import FileOps from './FileOps.js';
import Settings from './Settings.jsx';
import Modal from './Modal.js';
import HoverVar from './HoverVar.jsx';
import ShutdownGdbgui from './ShutdownGdbgui.js';
import RightSidebar from './RightSidebar.jsx';
import GdbConsoleContainer from './GdbConsoleContainer.jsx';

store.options.debug = debug
store.initialize(initial_store_data)


/**
 * Split the body into different panes using splitjs (https://github.com/nathancahill/Split.js)
 */
Split(['#middle_left', '#middle_right'], {
    gutterSize: 8,
    cursor: 'col-resize',
    direction: 'horizontal',  // horizontal makes a left/right pane, and a divider running vertically
    sizes: [70, 30],
})

Split(['#middle', '#bottom'], {
    gutterSize: 8,
    cursor: 'row-resize',
    direction: 'vertical',  // vertical makes a top and bottom pane, and a divider running horizontally
    sizes: [70, 30],
})

GdbApi.init()
GlobalEvents.init()
Modal.init()
FileOps.init()  // this should be initialized before components that use store key 'source_code_state'

void(React)  // ReactDOM secretly depends on React; avoid "'React' is defined but never used  no-unused-vars" error
             //
// top section
ReactDOM.render(<StatusBar/>, document.getElementById('status'))
ReactDOM.render(<SourceCodeHeading/>, document.getElementById('source_code_heading'))
BinaryLoader.init()
ShutdownGdbgui.init()
SourceFileAutocomplete.init()

// middle left
ReactDOM.render(<MiddleLeft />, document.getElementById('middle_left'))  // uses store key 'source_code_state'

// middle right
ReactDOM.render(<RightSidebar signals={initial_data.signals} debug={debug} />, document.getElementById('middle_right'))

// bottom
ReactDOM.render(<GdbConsoleContainer />, document.getElementById('bottom_content'))

// full page/javascript objects
ReactDOM.render(<HoverVar />, document.getElementById('hovervar_container'))
ReactDOM.render(<Settings />, document.getElementById('settings_container'))

// make this visible in the console
window.store = store

// and finally, if user supplied an initial command, set it in the UI, and load the
// inferior binary
if(_.isString(initial_data.initial_binary_and_args) && _.trim(initial_data.initial_binary_and_args).length > 0){
    BinaryLoader.el.val(_.trim(initial_data.initial_binary_and_args))
    BinaryLoader.set_target_app()
}

