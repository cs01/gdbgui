import React from 'react';

import {store} from './store.js';
import constants from './constants.js'

class GdbCommandInput extends React.Component {
    componentDidUpdate() {
        this.command_input_element.focus()
    }
    
    on_command_input_key_down = (event) => {
        const {display_confirmation_prompt} = this.props
        if(display_confirmation_prompt){
            event.preventDefault()
            switch (event.keyCode) {
                case constants.Y_BUTTON_NUM:
                    this.props.confirmation_prompt_response(true)
                    break
                case constants.N_BUTTON_NUM:
                    this.props.confirmation_prompt_response(false)
                    break
            }
            return;
        }

        switch (event.keyCode){
            case constants.UP_BUTTON_NUM:
                this.props.request_previous_command()
                break
            case constants.DOWN_BUTTON_NUM:
                this.props.request_next_command()
                break
            case constants.TAB_BUTTON_NUM:
                event.preventDefault()
                this.props.send_autocomplete_command()
                break
            case constants.ENTER_BUTTON_NUM:
                this.props.run_command()
                break
        }
    }

    render(){
        const {
            on_current_command_input_change,
            current_command_input,
            display_confirmation_prompt, 
            autocomplete_options_count,
            clear_console
        } = this.props
        const interpreter = store.get('interpreter')
        const message = `enter ${interpreter} command. To interrupt inferior, send SIGINT.` 
        let input_value = current_command_input
        if(display_confirmation_prompt){
            input_value = `Display all ${autocomplete_options_count} possibilities (y or n)?`
        }

        return (
            <div id='gdb_command_input'>
                <table>
                    <tbody>
                        <tr>
                            <td>({interpreter})</td>
                            <td>
                                <input 
                                    ref={(el) => { this.command_input_element = el }}
                                    onKeyDown={this.on_command_input_key_down}
                                    onChange={(event) => on_current_command_input_change(event.target.value)}
                                    className='form-control dropdown-input gdb_command_input'
                                    type='text'
                                    autoComplete='on'
                                    placeholder={message}
                                    value={input_value}
                                />
                            </td>
                            <td>
                                <span
                                    onClick={clear_console}
                                    className='glyphicon glyphicon-ban-circle clear_console'
                                    title='clear console'
                                />
                            </td>
                        </tr>
                    </tbody>
                </table>
            </div>
        );
    }
}

export default GdbCommandInput
