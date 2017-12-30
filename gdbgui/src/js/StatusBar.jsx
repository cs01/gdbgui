import React from 'react';
import Util from './Util.js';
import {store} from './store.js';

/**
 * Component to render a status message with optional error/warning label
 */
class StatusBar extends React.Component {
    render() {
        if(this.state.waiting_for_response){
            return (<span className='glyphicon glyphicon-refresh glyphicon-refresh-animate'></span>)
        }else{
            return ''
        }
    }
}

export default StatusBar;
