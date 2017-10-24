import {store} from './store.js';
import constants from './constants.js';
import GdbApi from './GdbApi.js';
import Util from './Util.js';

/**
 * The autocomplete dropdown of source files is complicated enough
 * to have its own component. It uses the awesomeplete library,
 * which is really nice: https://leaverou.github.io/awesomplete/
 */

  /* global Awesomplete */
const SourceFileAutocomplete = {
    el: $('#source_file_input'),
    init: function(){
        store.subscribe(SourceFileAutocomplete.render)

        SourceFileAutocomplete.el.keyup(SourceFileAutocomplete.keyup_source_file_input)

        // initialize list of source files
        SourceFileAutocomplete.input = new Awesomplete('#source_file_input', {
            minChars: 0,
            maxItems: 10000,
            list: [],
            // standard sort algorithm (the default Awesomeplete sort is weird)
            sort: (a, b) => {return a < b ? -1 : 1;}
        })

        // when dropdown button is clicked, toggle showing/hiding it
        Awesomplete.$('#source_file_dropdown_button').addEventListener("click", function() {

            if(store.get('source_file_paths').length === 0){
                // we have not asked gdb to get the list of source paths yet, or it just doesn't have any.
                // request that gdb populate this list.
                SourceFileAutocomplete.fetch_source_files()
                return
            }

            if (SourceFileAutocomplete.input.ul.childNodes.length === 0) {
                SourceFileAutocomplete.input.evaluate()
            }
            else if (SourceFileAutocomplete.input.ul.hasAttribute('hidden')) {
                SourceFileAutocomplete.input.open()
            }
            else {
                SourceFileAutocomplete.input.close()
            }
        })

        // perform action when an item is selected
         Awesomplete.$('#source_file_input').addEventListener('awesomplete-selectcomplete', function(e){
            let fullname = e.currentTarget.value
            store.set('fullname_to_render', fullname)
            store.set('line_of_source_to_flash', 1)
            store.set('make_current_line_visible', true)
            store.set('render_paused_frame_or_user_selection', 'user_selection')
        })
    },
    fetch_source_files: function(){
        store.set('source_file_paths', [`${constants.ANIMATED_REFRESH_ICON} fetching source files for inferior program`])
        GdbApi.run_gdb_command('-file-list-exec-source-files')
    },
    render: function(){
        if(!_.isEqual(SourceFileAutocomplete.input._list, store.get('source_file_paths'))){
            SourceFileAutocomplete.input.list = store.get('source_file_paths')
            SourceFileAutocomplete.input.evaluate()
        }
    },
    keyup_source_file_input: function(e){
        if (e.keyCode === constants.ENTER_BUTTON_NUM){
            let user_input = _.trim(e.currentTarget.value)

            if(user_input.length === 0){
                return
            }

            let fullname
            , default_line = 0
            , line

            [fullname, line] = Util.parse_fullname_and_line(user_input, default_line)

            store.set('fullname_to_render',fullname)
            store.set('line_of_source_to_flash', line)
            store.set('make_current_line_visible', true)
            store.set('render_paused_frame_or_user_selection', 'user_selection')


        }else if (store.get('source_file_paths').length === 0){
            // source file list has not been fetched yet, so fetch it
            SourceFileAutocomplete.fetch_source_files()
        }
    }
}

export default SourceFileAutocomplete
