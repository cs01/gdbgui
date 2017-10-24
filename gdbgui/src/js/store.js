import constants from './constants.js';

/*
 * The store can be changed via store.set() and retrieved via store.get(). store.get() does not return references to objects, it returns new objects.
 * store is only mutable with calls to store.set().
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
            store._store[k] = _clone_obj(initial_store[k])
        }
        store._store_created = true
    },
    /**
     * options object with the following fields. Can be set like `store.options.debounce_ms = 30`
     * * **debounce_ms (int, default: 10)**  update subscribers only after this much time has passed and an update has not occurred
     * * **max_batched_event_count (int, default: 10)** emit event only after this much time has passed and subscribers have not been notified <= 0 will notify immediately. max delay is: debounce_ms * max_batched_event_count
     * * **debug (bool, default: false)**: if true, print store changes to console
     */
    options: {
        debounce_ms: 10,
        max_batched_event_count: 10,
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
        let t = store._store  // t is the target object to update
        if(!(t.hasOwnProperty(key))){
            // use hasOwnProperty for better performance (entrie prototype chain is not traversed)
            throw `cannot create new key after initialization (attempted to create ${key})`
        }

        let oldval = t[key]

        // update the store
        if(_value_changed(oldval, value)){
            _check_type_match(oldval, value, key)

            if(store.options.debug) {
                console.log(key, oldval, ' -> ', value)
            }

            // *replace* the property with a clone of the value
            t[key] = _clone_obj(value)

            if(store._changed_keys.indexOf(key) === -1){
                store._changed_keys.push(key)
            }

            // suppress active timeouts (if any)
            if(store._debounce_timeout){
                store._clear_debounce_timeout()
                store._batched_event_count++
            }

            // publish changes, or schedule changes to be published
            if(store._batched_event_count >= store.options.max_batched_event_count){
                // emit event immediately since we have suppressed enough already
                if(store.options.debug){
                    console.log(`suppressed ${store._batched_event_count} events (${store.options.max_batched_event_count} max). Emitting event now.`)
                }
                store.publish()
            }else{
                // delay event emission and set new timeout id
                store._debounce_timeout = setTimeout(store.publish, store.options.debounce_ms)
            }
        }
    },
    /**
     * Get copy of value (not reference) of one of the keys in the current store.
     * @param {str} key key of the store object to get a copy of
     * @return copy of value of the current store's key
     */
    get: function(key){
        if(!store._store_created){
            throw 'cannot get store because is has not been created'
        }
        if(arguments.length === 0){
            // return the whole store
            return _clone_obj(store._store)
        }else if(arguments.length > 1){
            console.error('unexpected number of arguments')
            return
        }
        // the "get" trap returns a value
        if(store._store.hasOwnProperty(key)){
            // return copy since store cannot be mutated in place
            return _clone_obj(store._store[key])
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

function _clone_obj(obj){
    if(obj === undefined){return undefined}
    return JSON.parse(JSON.stringify(obj))
}

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
    if(Array.isArray(a) && Array.isArray(b) && a.length === 0 && b.length === 0){
        return false
    }else{
        return !_.isEqual(a, b)
    }
}

/* global debug */
/* global initial_data */
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
    show_settings: true,

    // preferences
    // syntax highlighting
    themes: initial_data.themes,
    current_theme: localStorage.getItem('theme') || initial_data.themes[0],
    highlight_source_code: JSON.parse(localStorage.getItem('highlight_source_code')),  // get saved boolean to highlight source code

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
    line_of_source_to_flash: null,
    current_assembly_address: null,
    // rendered_source: {},
    has_unrendered_assembly: false,  // set to true when new assembly has been fetched and is cached in browser, but not displayed in source code window
    make_current_line_visible: false,  // set to true when source code window should jump to current line
    cached_source_files: [],  // list with keys fullname, source_code
    disassembly_for_missing_file: [],  // mi response object. Only fetched when there currently paused frame refers to a file that doesn't exist or is undefined
    missing_files: [],  // files that were attempted to be fetched but did not exist on the local filesystem
    source_code_state: constants.source_code_states.NONE_AVAILABLE,
    render_paused_frame_or_user_selection: 'paused_frame',  // 'paused_frame' or 'user_selection'

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
    bytes_per_line: 8,


    // breakpoints
    breakpoints: [],

    // expressions
    expr_gdb_parent_var_currently_fetching_children: null,  // parent gdb variable name (i.e. var7)
    expr_being_created: null,  // the expression being created (i.e. myvar)
    // type of expression being created. Choices are: 'local' (autocreated local var), 'hover' (created when hovering in source coee), 'expr' (a "watch" expression )
    expr_type: null,
    expressions: [],  // array of dicts. Key is expression, value has various keys. See Expressions component.
    root_gdb_tree_var: null,  // draw tree for this variable

    status: {'text': '', 'error': false, 'warn': false},
    waiting_for_response: false
}

// restore saved localStorage data
for(let key in initial_store_data){
    if(typeof initial_store_data[key] === 'boolean'){
        if(localStorage.hasOwnProperty(key)){
            initial_store_data[key] = JSON.parse(localStorage.getItem(key))

        }
    }
}


module.exports = {
    store: store,
    initial_store_data: initial_store_data
}
