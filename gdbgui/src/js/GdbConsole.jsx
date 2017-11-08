import React from 'react';

import constants from './constants.js'

const pre_escape = (string) => {
    return string.replace(/\\n/g, '\n')
                .replace(/\\"/g, '"')
}

class GdbConsole extends React.Component {
    componentDidUpdate(){
        this.scroll_to_bottom();
    }
    scroll_to_bottom(){
        this.console_end.scrollIntoView({block: "end", inline: "nearest", behavior: 'smooth'})
    }
    backtrace_button_clicked = (event) => {
        event.preventDefault()
        this.props.backtrace_button_clicked()
    }

    render_entries(console_entries){
        return console_entries.map((entry, index) => {
            const escaped_value = pre_escape(entry.value)
            switch (entry.type) {
                case constants.console_entry_type.STD_OUT:
                    return <p key={index} className='otpt'>{escaped_value}</p>
                case constants.console_entry_type.STD_ERR:
                    return <p key={index} className='otpt stderr'>{escaped_value}</p>
                case constants.console_entry_type.SENT_COMMAND:
                    return (
                        <p 
                            key={index} 
                            className='otpt sent_command pointer'
                            onClick={() => this.props.on_sent_command_clicked(entry.value)}
                        >
                            {escaped_value}
                        </p>
                    )
                case constants.console_entry_type.BACKTRACE_LINK:
                    return (
                        <div 
                            key={index} 
                        >
                            <a 
                                onClick={this.backtrace_button_clicked}
                                style={{fontFamily: 'arial', marginLeft: '10px'}}
                                className='btn btn-success backtrace'
                            >
                                {escaped_value}
                            </a>
                        </div>
                    )
            }
        })
    }
    render(){
        const {console_entries} = this.props

        return (
            <div id="console">
                {this.render_entries(console_entries)}
                <div 
                    ref={(el) => { this.console_end = el }}
                >
                </div>
            </div>
        )
    }
}

export default GdbConsole

