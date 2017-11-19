import React from 'react';
import Actions from './Actions.js';


class Modal extends React.Component {
    render(){
        return (
            <div className={(this.props.show_modal ? '' : 'hidden')}
                style={{display: 'block',
                position: 'fixed',
                overflow: 'hidden',
                top: '0',
                right: '0',
                bottom: '0',
                left: '0',
                zIndex: '1050',
                boxSizing: 'border-box',
                overflowX: 'auto',
                overflowY: 'auto',
                backgroundColor: 'rgba(0,0,0,0.4)'
            }}
            >
                <div style={{padding: '20px',
                    marginTop: '10px',
                    marginLeft: 'auto',
                    marginRight: 'auto',
                    background: 'white',
                    margin: 'auto',
                    border: '1px solid #888',
                    borderRadius: '4px',
                    width: '500px',
                    boxShadow: '0 5px 15px rgba(0,0,0,.5)'
                }}>

                    <div>
                        <button type="button" className='close' onClick={Actions.toggle_modal_visibility}>×</button>
                    </div>

                    <h4>{this.props.header}</h4>

                    <div style={{paddingBottom: '20px'}}>
                        {this.props.body}
                    </div>

                    <button style={{float: 'right'}} type="button"
                        className="btn btn-success"
                        onClick={Actions.toggle_modal_visibility}>Close
                    </button>
                    <div style={{paddingBottom: '30px'}}/>
                </div>
            </div>
        )
    }
}

export default Modal
