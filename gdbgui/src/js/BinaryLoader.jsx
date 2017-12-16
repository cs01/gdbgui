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
            set_target_app: props.initial_user_input !== ''  // if user supplied initial binary, load it immediately
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
    render(){
        return(
                <form style={{marginBottom: 1, flex: '2 0 0'}}>
                  <div className="input-group input-group-sm">
                    <span className="input-group-btn">
                      <button
                        type="button"
                        title="Loads the binary and any arguments present in the input to the right"
                        onClick={this.click_set_target_app.bind(this)}
                        className="btn btn-primary">Load Binary</button>
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
        let args_in_quotes = args.map(a => '"' + a + '"')
        return {binary: binary, args: args_in_quotes.join(' ')}
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
}

export default BinaryLoader
