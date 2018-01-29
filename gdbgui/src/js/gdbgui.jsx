/**
 * This is the entrypoint to the frontend applicaiton.
 *
 * store (global state) is managed in a single location, and each time the store
 * changes, components are notified and update accordingly.
 *
 */

 /* global Split */
 /* global debug */
 /* global initial_data */

import {store, initial_store_data} from './store.js';
import GdbApi from './GdbApi.jsx';
import ReactDOM from 'react-dom';
import React from 'react';
import TopBar from './TopBar.jsx';
import GlobalEvents from './GlobalEvents.js';
import MiddleLeft from './MiddleLeft.jsx';
import FileOps from './FileOps.jsx';
import Settings from './Settings.jsx';
import Modal from './GdbguiModal.jsx';
import HoverVar from './HoverVar.jsx';
import RightSidebar from './RightSidebar.jsx';
import FoldersView from './FoldersView.jsx';
import GdbConsoleContainer from './GdbConsoleContainer.jsx';

store.options.debug = debug
store.initialize(initial_store_data)
// make this visible in the console
window.store = store

class Gdbgui extends React.PureComponent {
    componentWillMount(){
        GdbApi.init()
        GlobalEvents.init()
        FileOps.init()  // this should be initialized before components that use store key 'source_code_state'
    }
    render(){
        return (

            <div className='splitjs_container'>

                <TopBar initial_user_input={initial_data.initial_binary_and_args} />

                <div id="middle">

                    <div id='folders_view' className='content' style={{backgroundColor: 'rgb(33, 37, 43)'}}>
                        <FoldersView project_home={initial_data.project_home} />
                    </div>

                    <div id='source_code_view' className='content'>
                        <MiddleLeft />
                    </div>

                    <div id='controls_sidebar'
                      className='content'
                      style={{overflowX: 'visible'}}
                      >
                        <RightSidebar signals={initial_data.signals} debug={debug} />
                    </div>
                </div>


                <div id="bottom" className="split split-horizontal" style={{paddingBottom: '90px', width: '100%'}} >
                  <div id="bottom_content"
                        className="split content"
                        style={{paddingBottom: '0px' /* for height of input */}}>
                      <GdbConsoleContainer />
                  </div>
                </div>

                <Modal />
                <HoverVar />
                <Settings />
            </div>
        )
    }
    componentDidMount(){
        // Split the body into different panes using splitjs (https://github.com/nathancahill/Split.js)

        let middle_panes_split_obj = Split(['#folders_view', '#source_code_view', '#controls_sidebar'], {
            gutterSize: 8,
            minSize: 100,
            cursor: 'col-resize',
            direction: 'horizontal',  // horizontal makes a left/right pane, and a divider running vertically
            sizes: store.get('show_filesystem') ? [30, 40, 29] : [0, 70, 29]  // adding to exactly 100% is a little buggy due to splitjs, so keep it to 99
        })

        Split(['#middle', '#bottom'], {
            gutterSize: 8,
            cursor: 'row-resize',
            direction: 'vertical',  // vertical makes a top and bottom pane, and a divider running horizontally
            sizes: [70, 30],
        })

        store.set('middle_panes_split_obj', middle_panes_split_obj)
    }

}

ReactDOM.render(<Gdbgui />, document.getElementById('gdbgui'))
