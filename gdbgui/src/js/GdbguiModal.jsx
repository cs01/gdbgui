import React from 'react';
import Actions from './Actions.js';


class Modal extends React.Component {
    render(){
        return (
            <div className={(this.props.show_modal ? 'fullscreen_modal' : 'hidden')}
                ref={(el) => this.fullscreen_node = el}

                onClick={(e)=>{
                    if(e.target === this.fullscreen_node){
                        Actions.toggle_modal_visibility()
                    }
                }
                }
            >
                <div className='modal_content' onClick={(e)=>e.preventDefault()}>
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

