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
import ProjectView from './ProjectView.jsx';
import GdbConsoleContainer from './GdbConsoleContainer.jsx';

store.options.debug = debug
store.initialize(initial_store_data)
// make this visible in the console
window.store = store

let hasProjectNature = store.get('project_home') != null;

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

                    <div id='project_view' className='content' >
                        <ProjectView />
                    </div>

                    <div id='middle_left' className='content'>
                        <MiddleLeft />
                    </div>

                    <div id='middle_right' className='content' style={{overflowX: 'visible'}}>
                        <RightSidebar signals={initial_data.signals} debug={debug} />
                    </div>
                </div>


                <div id="bottom" className="split split-horizontal" style={{paddingBottom: '90px', width: '100%'}} >
                  <div id="bottom_content"
                        className="split content"
                        style={{paddingBottom: '30px' /* for height of input */}}>
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

        let panes, panesSizes;

        if (hasProjectNature) {
            panes = ['#project_view', '#middle_left', '#middle_right'];
            panesSizes = [20, 50, 30];
        }
        else {
            $('#project_view').css('display', 'none');
            panes = ['#middle_left', '#middle_right'];
            panesSizes = [70, 30];
        }

        Split(panes, {
            gutterSize: 8,
            cursor: 'col-resize',
            direction: 'horizontal',  // horizontal makes a left/right pane, and a divider running vertically
            sizes: panesSizes
        })

        Split(['#middle', '#bottom'], {
            gutterSize: 8,
            cursor: 'row-resize',
            direction: 'vertical',  // vertical makes a top and bottom pane, and a divider running horizontally
            sizes: [70, 30],
        })
    }

}

ReactDOM.render(<Gdbgui />, document.getElementById('gdbgui'))
