import React from 'react';

import {store} from './store.js';
import constants from './constants.js'
import GdbApi from './GdbApi.js'
import GdbCommandInput from './GdbCommandInput.jsx'
import GdbConsole from './GdbConsole.jsx'
import Actions from './Actions.js'

class CommandHistory {
    constructor(){
        this.command_index = 0
        this.sent_cmds = JSON.parse(localStorage.getItem('sent_cmds')) || []
        this.command_history_limit = 1000
        this.not_history_entry = true 
    }

    add_command(command){
        if(this.sent_cmds.length > this.command_history_limit){
            this.command_history.shift()
        }

        this.sent_cmds.push(command)
        localStorage.setItem('sent_cmds', JSON.stringify(this.sent_cmds))
    }

    reset_index(){
        this.command_index = 0
    }

    add_command_reset_index(command){
        this.add_command(command)
        this.command_index = 0
    }

    previous(){
        if(this.not_history_entry){
            this.not_history_entry = false
            this.command_index = this.sent_cmds.length 
        }
        this.command_index = this.command_index - 1
        if(this.command_index < 0){
            this.not_history_entry = true
            return null
        }

        return this.sent_cmds[this.command_index]
    }

    next(){
        if(this.not_history_entry){
            this.not_history_entry = false
            this.command_index = -1
        }

        this.command_index = this.command_index + 1
        if(this.command_index >= this.sent_cmds.length){
            this.not_history_entry = true
            return null 
        }

        return this.sent_cmds[this.command_index]
    }
}

const command_history = new CommandHistory()


class GdbConsoleContainer extends React.Component {
    constructor(){
        super()

        this.state = {
            current_command_input: '',
            gdb_console_entries: [],
            gdb_autocomplete_options: [],
            display_confirmation_prompt: false,
            gdb_autocomplete_options_ran_once: false
        }
    }

    componentWillMount(){
        store.subscribe(this._store_change_callback)
        this.set_state_from_store()
    }

    componentWillUnmount(){
        store.unsubscribe(this._store_change_callback)
    }

    _store_change_callback = (keys) => {
        const autocomplete_options = store.get('gdb_autocomplete_options')
        const options_changed = !_.isEqual(autocomplete_options, this.state.gdb_autocomplete_options)
        this.setState({
            gdb_console_entries: store.get('gdb_console_entries'),
            gdb_autocomplete_options: autocomplete_options
        })

        if(_.includes(keys, 'gdb_autocomplete_options') && options_changed){
            if(autocomplete_options.length === 1){
                this.setState({
                    current_command_input: `${autocomplete_options[0]} `,
                    gdb_autocomplete_options_ran_once: false 
                })
            }else if(autocomplete_options.length > 1){
                const firstOption = autocomplete_options[0]
                const secondOption = autocomplete_options[1]

                if(secondOption.indexOf(firstOption, 0) === 0){
                    this.setState({
                        current_command_input: `${autocomplete_options[0]}`,
                        gdb_autocomplete_options_ran_once: false
                    })
                }
            }

        }
    }

    set_state_from_store(){
        this.setState({
            gdb_console_entries: store.get('gdb_console_entries')
        })
    }

    on_current_command_input_change = (value) => {
        if (this.state.gdb_autocomplete_options.length > 0) {
            store.set('gdb_autocomplete_options', [])
        }

        this.setState({
            current_command_input: value,
            gdb_autocomplete_options_ran_once: false
        })
    }

    on_sent_command_clicked = (command) => {
        command_history.reset_index()
        this.setState({
            current_command_input: command
        })
    }

    request_previous_command = () => {
        this.setState({current_command_input: command_history.previous() || ''})
    }

    request_next_command = () => {
        this.setState({current_command_input: command_history.next() || ''})
    }
    
    run_command = () => {
        const command = this.state.current_command_input
        command_history.add_command_reset_index(command)
        Actions.add_console_entries(command, constants.console_entry_type.SENT_COMMAND)
        Actions.execute_console_command(command)
        
        this.setState({current_command_input: ''})
    }
    
    send_autocomplete_command = () => {
        if (this.state.gdb_autocomplete_options_ran_once && 
            this.state.gdb_autocomplete_options.length > 10) {
            this.setState({display_confirmation_prompt: true})
        } else if (this.state.gdb_autocomplete_options_ran_once) {
            this.display_all_autocomplete_options()
        } else {
            const command = this.state.current_command_input
            GdbApi.send_autocomplete_command(command)
            this.setState({gdb_autocomplete_options_ran_once: true})
        }
    }

    display_all_autocomplete_options = () => {
        const {gdb_autocomplete_options} = this.state;
        Actions.add_console_entries(gdb_autocomplete_options, constants.console_entry_type.STD_OUT)
    }

    confirmation_prompt_response = (result) => {
        this.setState({display_confirmation_prompt: false})
        if (result) {
            this.display_all_autocomplete_options()
        } 
    }

    render(){
        const {
            gdb_console_entries, 
            current_command_input,
            display_confirmation_prompt,
            gdb_autocomplete_options
        } = this.state

        return (
            <div id="console_container">
                <GdbConsole 
                    console_entries={gdb_console_entries}
                    on_sent_command_clicked={this.on_sent_command_clicked}
                    backtrace_button_clicked={() => GdbApi.backtrace()}
                />
                <GdbCommandInput 
                    current_command_input={current_command_input}
                    on_current_command_input_change={this.on_current_command_input_change}
                    autocomplete_options_count={gdb_autocomplete_options.length}
                    request_previous_command={this.request_previous_command}
                    request_next_command={this.request_next_command}
                    clear_console={() => Actions.clear_console()}
                    run_command={this.run_command}
                    send_autocomplete_command={this.send_autocomplete_command}
                    display_confirmation_prompt={display_confirmation_prompt}
                    confirmation_prompt_response={
                        this.confirmation_prompt_response
                    }

                />
            </div>
        )
    }
}

export default GdbConsoleContainer
