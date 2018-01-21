import constants from './constants.js';
/* global debug */
/* global initial_data */

/*
 * The store can be changed via store.set() and retrieved via store.get(). store.get() returns references to objects.
 * store should only be changed with calls to store.set() so that listeners are notified.
 *
 * For example, calling store.set('line_of_source_to_flash', 100)
 * will change the highlighted line and automatically scroll to that line in the UI. Or calling
 * store.set('highlight_source_code', true) will "magically" make the source code be highlighted.
 */
const store = {
    /**
     * Set the initial store. This can only be done once, and must be done before the
     * store can be modified. This should be a JavaScript object with key/value pairs.
     * This is the initial "hydration" of the store, and sets the expected types for all keys.
     * @param {object} initial_store: Initial store object
     */
    initialize: function(initial_store){
        if(store._store_created){
            throw 'cannot create more than one global store'
        }
        for(let k in initial_store){
            store._store[k] = initial_store[k]
        }
        store._store_created = true
    },
    /**
     * options object with the following fields. Can be set like `store.options.debounce_ms = 30`
     * * **debounce_ms (int, default: 10)**  update subscribers only after this much time has passed and an update has not occurred
     * * **debug (bool, default: false)**: if true, print store changes to console
     */
    options: {
        debounce_ms: 10,
        debug: false,
    },
    /**
     * set key or keys of store object
     * @param {str/obj} key_or_new_store: if str, this key is replaced. If obj, all keys of the obj replace store's keys.
     * @param {any} value: If key was provided, the associated value. The type of the value for this key cannot change. Exceptions to this rule
     * are to/from null or undefined. Otherwise if you try to change, say, `1` to `'2'`, a type error will occur (int to string is not permitted).
     */
    set: function(key_or_new_store, value){
        if(arguments.length === 1){
            // replace the whole store
            let new_store = key_or_new_store
            for(let k in new_store){
                store.set(k, new_store[k])
            }
            return
        }

        let key = key_or_new_store
        if(!(store._store.hasOwnProperty(key))){
            // use hasOwnProperty for better performance (entrie prototype chain is not traversed)
            throw `cannot create new key after initialization (attempted to create ${key})`
        }

        let oldval = store._store[key]
        _check_type_match(oldval, value, key)
        if (_value_changed(oldval, value)){
            store._enqueue_change(key, oldval, value)
        }

    },
    /**
     * enqueue a change to the store. Event will be emitted based on
     * timeout rules.
     *
     * @param key     key to change
     * @param oldval  original value (for logging purposes)
     * @param value   new value to assign
     */
    _enqueue_change: function(key, oldval, value){

        if(store.options.debug) {
            // this is only meaningful when the store data is immutable
            // and updates aren't just references to the existing object
            if(KEYS_TO_NOT_LOG_CHANGES_IN_CONSOLE.indexOf(key) === -1){
                console.log(key, oldval, ' -> ', value)
            }
        }

        store._store[key] = value

        if(store._changed_keys.indexOf(key) === -1){
            store._changed_keys.push(key)
        }

        // suppress active timeout (if any)
        if(store._debounce_timeout){
            store._clear_debounce_timeout()
        }

        // delay event emission and set new timeout id
        store._debounce_timeout = setTimeout(store.publish, store.options.debounce_ms)
    },
    /**
     * Get reference to one of the keys in the current store.
     * @param {str} key of the store object to get a reference to
     * @return reference to value in the store.
     * NOTE: The store should *only* be update by calling `store.set(...)`
     *   Throws error if key does not exist in store.
     */
    get: function(key){
        if(!store._store_created){
            throw 'cannot get store because is has not been created'
        }
        if(arguments.length === 0){
            // return the whole store
            return store._store
        }else if(arguments.length > 1){
            console.error('unexpected number of arguments')
            return
        }
        // the "get" trap returns a value
        if(store._store.hasOwnProperty(key)){
            // TODO should this return a copy or reference?
            return store._store[key]
        }else{
            throw `attempted to access key that was not set during initialization: ${key}`
        }
    },
    /**
     * Add listener(s) to store changes. Reactors are automatically subscribed to store changes.
     * @param {function} function or array of functions to be called when event is dispatched due to store updates
     */
    subscribe(callback_function){
        if(Array.isArray(callback_function)){
            store._callbacks = store._callbacks.concat(callback_function)
        }else{
            store._callbacks.push(callback_function)
        }
    },
    /**
     * Remove listener of store changes
     * @param {function} function to stop being called when store is udpated
     */
    unsubscribe(callback_function){
        store._callbacks = store._callbacks.filter(c => c !== callback_function)
    },
    /**
     * Run subscribers' callback functions. An array of the changed keys is passed to the callback function.
     * Be careful how often this is called, since re-rendering components can become expensive.
     */
    publish: function(){
        const changed_keys = store._changed_keys
        if(changed_keys.length === 0){
            console.error('no keys were changed, yet we are trying to publish a store change')
            return
        }

        // make sure _changed_keys is reset before executing callbacks
        // (if callbacks modify state, the list of keys the callback changed would be wiped out)
        store._changed_keys = []
        store._clear_debounce_timeout()
        store._batched_store_changes = 0
        store._callbacks.map(c => c(changed_keys))

    },
    /**
     * keys that were modified in the store since the last publish
     */
    _changed_keys: [],
    /**
     * array of functions to be called when store changes (usually Reactor.render())
     */
    _callbacks: [],
    /**
     * Actual store is held here, but should NEVER be accessed directly. Only access through store.set/store.get!
     */
    _store: {},
    /**
     * dom selections that are bound to a reactor (i.e. `#my_id`)
     */
    _elements: [],
    /**
     * Clear the debounce timeout
     */
    _clear_debounce_timeout: function(){
        clearTimeout(store._debounce_timeout)
        store._debounce_timeout = null
    },
    /**
     * Debounce timeout
     */
    _debounce_timeout: null,
    /**
     * Suppressed event count.
     * Incremented when a queued timeout is replaced with new timeout. If queued timeouts keep getting
     * replaced, events never get dispatched. This is an "escape hatch" for that.
     * Set to zero when event is dispatched.
     */
    _batched_store_changes: 0,
    _store_created: false
}

/****** helper functions ********/
function _check_type_match(a, b, key){
    if(a !== undefined && b !== undefined && a !== null && b !== null){
        let old_type = typeof a
        , new_type = typeof b
        if(old_type !== new_type){
            console.error('attempted to change ', key, ' from ', a, ' (', old_type, ') to ', b, ' (', new_type, ')')
            throw 'type error'
        }
    }
}

function _value_changed(a, b){
    if(_.isObject(a)){
        // since objects can be updated by reference, we don't
        // know if the value changed or not since the reference
        // is still the same. Err on the side of caution assume
        // objects always change
        return true
    }else{
        return !_.isEqual(a, b)
    }
}

/**
 * The initial store data. Keys cannot be added after initialization.
 * All fields in here should be shared by > 1 component, otherwise they should
 * exist as local state for that component.
 *
 */
const initial_store_data = {
    // environment
    debug: debug,  // if gdbgui is run in debug mode
    interpreter: initial_data.interpreter,  // either 'gdb' or 'llvm'
    gdbgui_version: initial_data.gdbgui_version,
    latest_gdbgui_version: '(not fetched)',
    show_gdbgui_upgrades: initial_data.show_gdbgui_upgrades,
    gdb_version: undefined,  // this is parsed from gdb's output
    gdb_version_array: [],  // this is parsed from gdb's output
    gdb_pid: undefined,
    can_fetch_register_values: true,  // set to false if using Rust and gdb v7.12.x (see https://github.com/cs01/gdbgui/issues/64)
    show_settings: false,

    'debug_in_reverse': false,
    show_modal: false,
    modal_header: null,
    modal_body: null,

    // preferences
    // syntax highlighting
    themes: initial_data.themes,
    current_theme: localStorage.getItem('theme') || initial_data.themes[0],
    highlight_source_code: true,  // get saved boolean to highlight source code
    max_lines_of_code_to_fetch: constants.default_max_lines_of_code_to_fetch,
    auto_add_breakpoint_to_main: true,

    pretty_print: true,  // whether gdb should "pretty print" variables. There is an option for this in Settings
    refresh_state_after_sending_console_command: true,  // If true, send commands to refresh GUI store after each command is sent from console
    show_all_sent_commands_in_console: debug,  // show all sent commands if in debug mode

    inferior_program: constants.inferior_states.unknown,
    inferior_pid: null,

    paused_on_frame: undefined,
    selected_frame_num: 0,
    current_thread_id: undefined,
    stack: [],
    locals: [],
    threads: [],

    // source files
    source_file_paths: [], // all the paths gdb says were used to compile the target binary
    language: 'c_family',  // assume langage of program is c or c++. Language is determined by source file paths. Used to turn on/off certain features/warnings.
    files_being_fetched: [],
    fullname_to_render: null,
    fullname_rendered: null,
    line_of_source_to_flash: null,
    current_assembly_address: null,
    // rendered_source: {},
    make_current_line_visible: false,  // set to true when source code window should jump to current line
    cached_source_files: [],  // list with keys fullname, source_code
    disassembly_for_missing_file: [],  // mi response object. Only fetched when there currently paused frame refers to a file that doesn't exist or is undefined
    missing_files: [],  // files that were attempted to be fetched but did not exist on the local filesystem
    source_code_state: constants.source_code_states.NONE_AVAILABLE,
    source_code_selection_state: constants.source_code_selection_states.PAUSED_FRAME,

    source_code_infinite_scrolling: false,
    source_linenum_to_display_start: 0,
    source_linenum_to_display_end: 0,

    // binary selection
    inferior_binary_path: null,
    inferior_binary_path_last_modified_unix_sec: null,

    // registers
    register_names: [],
    previous_register_values: {},
    current_register_values: {},

    // memory
    memory_cache: {},
    start_addr: '',
    end_addr: '',
    bytes_per_line: '8',

    // breakpoints
    breakpoints: [],

    // expressions
    expressions: [],  // array of dicts. Key is expression, value has various keys. See Expressions component.
    root_gdb_tree_var: null,  // draw tree for this variable

    waiting_for_response: false,

    gdb_mi_output: [],

    gdb_autocomplete_options: [],

    gdb_console_entries: [],

    show_filesystem: false,
    middle_panes_split_obj: {},
}

const KEYS_TO_NOT_LOG_CHANGES_IN_CONSOLE = [
    'gdb_mi_output',
    'gdb_console_entries'
]

// restore saved localStorage data
for(let key in initial_store_data){
    try{
        if(typeof initial_store_data[key] === 'boolean'){
            if(localStorage.hasOwnProperty(key)){
                let savedval = JSON.parse(localStorage.getItem(key))
                , oldval = initial_store_data[key]

                if((typeof oldval) === (typeof savedval)){
                    initial_store_data[key] = savedval
                }

            }
        }
    }catch(err){
        console.log(err)
        localStorage.removeItem(key)
    }
}

if(localStorage.hasOwnProperty('max_lines_of_code_to_fetch')){
    let savedval = JSON.parse(localStorage.getItem('max_lines_of_code_to_fetch'))
    if(_.isInteger(savedval) && savedval > 0){
        initial_store_data['max_lines_of_code_to_fetch'] = savedval
    }

}


module.exports = {
    store: store,
    initial_store_data: initial_store_data
}
