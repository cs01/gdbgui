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
import TopBar from './TopBar.jsx';
import GlobalEvents from './GlobalEvents.js';
import MiddleLeft from './MiddleLeft.jsx';
import FileOps from './FileOps.js';
import Settings from './Settings.jsx';
import Modal from './GdbguiModal.jsx';
import HoverVar from './HoverVar.jsx';
import RightSidebar from './RightSidebar.jsx';
import GdbConsoleContainer from './GdbConsoleContainer.jsx';

store.options.debug = debug
store.initialize(initial_store_data)


class Gdbgui extends React.Component {
    constructor(){
        super()
        this.state = store._store
        store.subscribe(()=>{this.setState(store._store)})
    }
    render(){
        return (

            <div>
                <Modal header={store.get('modal_header')} body={store.get('modal_body')} show_modal={store.get('show_modal')} />
                <HoverVar />
                <Settings />
            </div>
        )
    }
}

GdbApi.init()
GlobalEvents.init()
FileOps.init()  // this should be initialized before components that use store key 'source_code_state'

// top section
ReactDOM.render(<TopBar initial_user_input={initial_data.initial_binary_and_args} />, document.getElementById('top'))

// middle left
ReactDOM.render(<MiddleLeft />, document.getElementById('middle_left'))  // uses store key 'source_code_state'

// middle right
ReactDOM.render(<RightSidebar signals={initial_data.signals} debug={debug} />, document.getElementById('middle_right'))

// bottom
ReactDOM.render(<GdbConsoleContainer />, document.getElementById('bottom_content'))

// app (TODO pull everything in here)
ReactDOM.render(<Gdbgui />, document.getElementById('gdbgui'))


// make this visible in the console
window.store = store

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

// TODO use this
// render(){
//     return (
//         <div>
//           <TopBar initial_user_input={initial_data.initial_binary_and_args} />
//           <div id="middle">
//             <div id='middle_left' style={{height: '100%', float: 'left'}} >
//                 <MiddleLeft />
//             </div>
//             <div id='middle_right' style={{height: '100%', float: 'right'}}>
//                 <RightSidebar signals={initial_data.signals} debug={debug} />
//             </div>
//           </div>

//           <div id="bottom" style={{paddingBottom: 90, width: '100%'}} className="split split-horizontal">
//             <div id="bottom_content" style={{width: '100%', height: '100%', position: 'relative', paddingBottom: 30}} className="split content">
//               <GdbConsoleContainer />
//             </div>
//           </div>


//           <div>
//             <Modal
//                 header={store.get('modal_header')}
//                 body={store.get('modal_body')}
//                 show_modal={store.get('show_modal')}
//             />
//             <HoverVar />
//             <Settings />
//             </div>
//         </div>
//     )
// }
// componentDidMount(){
//     /**
//      * Split the body into different panes using splitjs (https://github.com/nathancahill/Split.js)
//      */
//     Split(['#middle_left', '#middle_right'], {
//         gutterSize: 8,
//         cursor: 'col-resize',
//         direction: 'horizontal',  // horizontal makes a left/right pane, and a divider running vertically
//         sizes: [70, 30],
//     })

//     Split(['#middle', '#bottom'], {
//         gutterSize: 8,
//         cursor: 'row-resize',
//         direction: 'vertical',  // vertical makes a top and bottom pane, and a divider running horizontally
//         sizes: [70, 30],
//     })
// }
