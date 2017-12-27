/**
 * A component to show/hide variable exploration when hovering over a variable
 * in the source code
 */

import React from 'react';
import InferiorProgramInfo from './InferiorProgramInfo.jsx';
import Breakpoints from './Breakpoints.jsx';
import Expressions from './Expressions.jsx';
import Locals from './Locals.jsx';
import Tree from './Tree.js';
import Registers from './Registers.jsx';
import Threads from './Threads.jsx';
import Memory from './Memory.jsx';
import GdbMiOutput from './GdbMiOutput.jsx';
import constants from './constants.js';

class Collapser extends React.Component {
    static defaultProps = { collapsed: false, id: '' }
    constructor(props){
        super()
        this.state = {collapsed: props.collapsed}
    }
    toggle_visibility(){
        this.setState({'collapsed': !this.state.collapsed})
    }
    render(){
        return(
            <div>
                <div className='pointer titlebar' onClick={this.toggle_visibility.bind(this)}>
                    <span
                        className={`glyphicon glyphicon-chevron-${this.state.collapsed ? 'right' : 'down'}`}
                        style={{marginRight: '6px'}}
                    />
                    <span className='lighttext'>{this.props.title}</span>
                </div>

                <div className={this.state.collapsed ? 'hidden' : ''} id={this.props.id}>
                    {this.props.content}
                </div>
            </div>
        )
    }
}


class RightSidebar extends React.Component {
    render(){
        let input_style = {'display': 'inline', width: '100px', padding: '6px 6px', height: '25px', fontSize: '1em'}
        , mi_output = ''
        if (this.props.debug){
            mi_output = <Collapser title='gdb mi output' content={<GdbMiOutput id='gdb_mi_output' />} />
        }

        return (<div className='content'>
            <Collapser title='signals' content={<InferiorProgramInfo signals={this.props.signals} />} />

            <Collapser title='threads' content={<Threads/>}/>

            <Collapser id='locals' title='local variables' content={<Locals />} />
            <Collapser id='expressions' title='expressions' content={<Expressions />} />
            <Collapser title='Tree' content={
                <div>
                    <input id='tree_width' className='form-control' placeholder='width (px)' style={input_style} />
                    <input id='tree_height' className='form-control' placeholder='height (px)' style={input_style} />
                    <div id={constants.tree_component_id} />
                </div>
            } />
            <Collapser id='memory' title='memory' content={<Memory />} />
            <Collapser title='breakpoints' content={<Breakpoints />} />
            <Collapser title='registers' content={<Registers />} />
            {mi_output}

        </div>)
    }
    componentDidMount(){
        Tree.init()
    }
}
export default RightSidebar
