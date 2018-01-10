import React from 'react';
import Memory from './Memory.jsx';

class MemoryLink extends React.Component {
    constructor(props){
        super();
        this.parsed_addr = `0x${parseInt(props.addr, 16).toString(16)}`  // remove leading zeros
    }
    render(){
        return (
            <span className='pointer memadr_react'
                    onClick={()=>Memory.set_inputs_from_address(this.parsed_addr)}
                    title={`click to explore memory at ${this.parsed_addr}`}
                    style={this.props.style}>
                {this.parsed_addr}
            </span>)
    }
    static defaultProps = { style: {'fontFamily': 'monospace'} }
}

export default MemoryLink
