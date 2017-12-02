import React from 'react';
import {store} from './store.js';
import constants from './constants.js';
import Actions from './Actions.js';
import Util from './Util.js';

/**
 * The BinaryLoader component allows the user to select their binary
 * and specify inputs
 */
class BinaryLoader extends React.Component {
    constructor(props){
        super()

        this.state = {
            past_binaries: [],
            user_input: props.initial_user_input,
            set_target_app: props.initial_user_input !== '',  // if user supplied initial binary, load it immediately
            load_binary: true
        }

        try{
            this.state.past_binaries = _.uniq(JSON.parse(localStorage.getItem('past_binaries')))
            if(!this.state.user_input){
                let most_recent_binary = this.state.past_binaries[0]
                this.state.user_input = most_recent_binary
            }
        } catch(err){
            this.state.past_binaries = []
        }
    }
    set_button_as_load_binary(){
        this.setState({load_binary: true})
        document.getElementById("loadbutton").innerHTML = "Load Button";
        document.getElementById("binary").placeholder = "/path/to/target/executable -and -flags";
    }
    set_button_as_attach_process(){
        this.setState({load_binary: false})
        document.getElementById("loadbutton").innerHTML = "Attach Process";
        document.getElementById("binary").placeholder = "Process id";
    }
    click_action_of_button() {
        if(this.state.load_binary){
            this.click_set_target_app()
        } else {
            this.click_set_target_attach()
        }
    }
    render(){
        return(
                <form style={{marginBottom: 1, flex: '2 0 0'}}>
                  <div className="input-group input-group-sm">
                    <span className="input-group-btn">
                      <button id="loadbutton"
                        type="button"
                        onClick={this.click_action_of_button.bind(this)}
                        title="Loads the binary and any arguments present in the input to the right"
                        className="btn btn-primary">Load Binary</button>
                        <button type = "button" class = "btn btn-primary dropdown-toggle" 
                        data-toggle = "dropdown">
                            <span class = "caret"></span>
                            <span class = "sr-only">Toggle Dropdown</span>
                        </button>
                        <ul class = "dropdown-menu" role = "menu">
                            <li onClick={this.set_button_as_load_binary.bind(this)}>
                                Load Binary</li>
                            <li onClick={this.set_button_as_attach_process.bind(this)}>
                                Attach Process/threads</li>
                        </ul>
                    </span>
                    <input id="binary"
                        type="text"
                        placeholder="/path/to/target/executable -and -flags"
                        list="past_binaries"
                        style={{fontFamily: 'courier'}}
                        className="form-control"
                        onKeyUp={this.onkeyup_user_input.bind(this)}
                        onChange={this.onchange_user_inpu.bind(this)}
                        value={this.state.user_input}/>
                  </div>
                  <datalist id="past_binaries">
                    {this.state.past_binaries.map((b, i) => <option key={i}>{b}</option>)}
                  </datalist>
                </form>
        )
    }
    componentDidMount(){
        if(this.state.set_target_app){
            this.setState({'set_target_app': false})
            this.set_target_app()
        }
    }
    onkeyup_user_input(e){
        if(e.keyCode === constants.ENTER_BUTTON_NUM) {
            this.set_target_app()
        }
    }
    onchange_user_inpu(e){
        this.setState({'user_input': e.target.value})
    }
    click_set_target_app(){
        this.set_target_app()
    }
    click_set_target_attach(){
        this.set_target_attach()
    }
    // save to list of binaries used that autopopulates the input dropdown
    _add_user_input_to_history(binary_and_args){
        _.remove(this.state.past_binaries, i => i === binary_and_args)
        this.state.past_binaries.unshift(binary_and_args) // add to beginning
        this.setState({past_binaries: this.state.past_binaries})
        localStorage.setItem('past_binaries', JSON.stringify(this.state.past_binaries) || [])
    }
    /**
     * parse tokens with awareness of double quotes
     *
     * @param      {string}  user_input raw input from user
     * @return     {Object}  { the binary (string) and arguments (array) parsed from user input }
     */
    _parse_binary_and_args_from_user_input(user_input){
        let list_of_params = Util.string_to_array_safe_quotes(user_input)
        , binary = ''
        , args = []
        , len = list_of_params.length
        if(len === 1){
            binary = list_of_params[0]
        }else if(len > 1){
            binary = list_of_params[0]
            args = list_of_params.slice(1, len)
        }
        return {binary: binary, args: args}
    }
    /**
     * parse tokens with awareness of double quotes
     *
     * @param      {string}  user_input raw input from user
     * @return     {string}  { the process id}
     */
    _parse_processid_from_user_input(user_input){
        let list_of_params = Util.string_to_array_safe_quotes(user_input)
        , processid = ''
        processid = list_of_params[0]
        //perform string check to ensure only numbers are present
        return processid
    }
    set_target_app(){
        let user_input = _.trim(this.state.user_input)

        if (_.trim(user_input) === ''){
            store.set('status', {text: 'enter a binary path and arguments', error: true})
            return
        }

        this._add_user_input_to_history(user_input)

        const {binary, args} = this._parse_binary_and_args_from_user_input(user_input)
        Actions.set_gdb_binary_and_arguments(binary, args)
    }
    set_target_attach(){
        let user_input = _.trim(this.state.user_input)

        if (_.trim(user_input) === ''){
            store.set('status', {text: 'Enter a process ID', error: true})
            return
        }

        this._add_user_input_to_history(user_input)

        const processid = this. _parse_processid_from_user_input(user_input)
        // here the binary will 
        Actions.set_gdb_processid(processid)
    }
}

export default BinaryLoader
