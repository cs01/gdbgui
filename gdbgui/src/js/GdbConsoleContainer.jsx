import React from 'react';

import {store} from './store.js';
import constants from './constants.js'
import GdbApi from './GdbApi.js'
import GdbCommandInput from './GdbCommandInput.jsx'
import GdbConsole from './GdbConsole.jsx'
import Actions from './Actions.js'
import CommandHistory from './CommandHistory.js'


class GdbConsoleContainer extends React.Component {
    constructor(){
        super()

        this.state = {
            current_command_input: '',
            gdb_console_entries: store.get('gdb_console_entries'),
            gdb_autocomplete_options: store.get('gdb_autocomplete_options'),
        }
        store.subscribe(this._store_change_callback)
    }

    componentWillUnmount(){
        store.unsubscribe(this._store_change_callback)
    }

    _store_change_callback = (keys) => {
        if(!_.intersection(['gdb_autocomplete_options', 'gdb_console_entries'], keys).length){
            return
        }

        this.setState({
            gdb_console_entries: store.get('gdb_console_entries'),
        })

        const autocomplete_options = store.get('gdb_autocomplete_options')
        if(autocomplete_options.length === 1){
            this.setState({
                current_command_input: `${autocomplete_options[0]} `, // just use the autocomplete value
            })
            store.set('gdb_autocomplete_options', [])
        }else if(autocomplete_options.length > 1){
            Actions.add_console_entries(autocomplete_options, constants.console_entry_type.AUTOCOMPLETE_OPTION)
            store.set('gdb_autocomplete_options', [])
        }
    }

    on_current_command_input_change = (value) => {
        this.setState({
            current_command_input: value,
        })
    }

    on_sent_command_clicked = (command) => {
        CommandHistory.reset()
        this.setState({
            current_command_input: command
        })
    }

    on_autocomplete_text_clicked = (command) => {
        CommandHistory.reset()
        this.setState({
            current_command_input: command + ' '
        })
    }

    get_previous_command_from_history = () => {
        this.setState({current_command_input: CommandHistory.get_previous_command(this.state.current_command_input) || this.state.current_command_input})
    }

    get_next_command_from_history = () => {
        this.setState({current_command_input: CommandHistory.get_next_command(this.state.current_command_input) || this.state.current_command_input})
    }

    run_command = () => {
        const command = this.state.current_command_input
        CommandHistory.add_command(command)
        Actions.add_console_entries(command, constants.console_entry_type.SENT_COMMAND)
        Actions.execute_console_command(command)

        this.setState({current_command_input: ''})
    }

    send_autocomplete_command = () => {
        const user_command = this.state.current_command_input
        GdbApi.send_autocomplete_command(user_command)
    }

    render(){
        const {
            gdb_console_entries,
            current_command_input,
            gdb_autocomplete_options
        } = this.state

        return (
            <div id="console_container">
                <GdbConsole
                    console_entries={gdb_console_entries}
                    on_sent_command_clicked={this.on_sent_command_clicked}
                    on_autocomplete_text_clicked={this.on_autocomplete_text_clicked}
                />
                <GdbCommandInput
                    current_command_input={current_command_input}
                    on_current_command_input_change={this.on_current_command_input_change}
                    autocomplete_options_count={gdb_autocomplete_options.length}
                    get_previous_command_from_history={this.get_previous_command_from_history}
                    get_next_command_from_history={this.get_next_command_from_history}
                    clear_console={() => Actions.clear_console()}
                    run_command={this.run_command}
                    send_autocomplete_command={this.send_autocomplete_command}
                />
            </div>
        )
    }
}

export default GdbConsoleContainer
