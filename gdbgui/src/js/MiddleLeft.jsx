/**
 * The middle left div will be rendered with this content
 */

import React from 'react';
import SourceCode from './SourceCode.jsx';


class MiddleLeft extends React.Component {
    render(){
        return <div id='code_container' style={{overflow: 'auto', height: '100%'}}>
                    <SourceCode />
                </div>
    }
    componentDidMount(){
        SourceCode.el_code_container = $('#code_container')  // todo: no jquery
    }
}

export default MiddleLeft
