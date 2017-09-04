"use strict;"

/*
 * The store can be changed via store.set() and retrieved via store.get(). store.get() does not return references to objects, it returns new objects.
 * store is only mutable with calls to store.set().
 *
 * For example, calling store.set('current_line_of_source_code', 100)
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

            if(store.options.debug) {
                console.log('stator ' + key, oldval, ' -> ', value)
            }

            _check_type_match(oldval, value, key)

            // *replace* the property with a clone of the value
            t[key] = _clone_obj(value)

            // suppress active timeouts (if any)
            if(store._debounce_timeout){
                store._clear_debounce_timeout()
                store._batched_event_count++
            }

            // emit event, or schedule event to be emitted so that Reactors and listeners are notified
            // that the store changed
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
     * Run subscribers' callback functions. Reactors are automatically part of this list.
     */
    publish: function(){
        store._clear_debounce_timeout()
        store._batched_store_changes = 0
        store._callbacks.map(c => c())
    },
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

/**
 * DEPRECATED - Use ReactJS Components instead
 * TODO Replace all Reactors with ReactJS Components and erase this class
 *
 * Reactive component that links a html-returning function to a DOM node. _Any changes to `store` will cause all `Reactor`s to
 * call their respective render functions and potentially update the html of their DOM node.
 * @param {string} element selector to have its inner html updated (i.e. `#my_id`). Selector must match exactly one node or an error will be raised.
 * @param {function} render_callback function that returns html that relplaces the inner html of element. This function is run when the store is updated.
 * @param {object} options Option list:
 */
function Reactor(element, render_callback, options={}){
    // select from dom once and cache it
    let nodes = document.querySelectorAll(element)
    if(nodes.length !== 1){
        throw `Reactor: querySelector "${element}" matched ${nodes.length} nodes. Expected 1.`
    }else if (store._elements.indexOf(element) !== -1) {
        throw `Reactor: querySelector "${element}" is already bound to a Reactor.`
    }else{
        store._elements.push(element)
    }
    this.element = element
    this.node = nodes[0]

    let default_options = {
        listen_to_global_store: true,
        render_on_init: true,
        before_render: (reactor)=>{void reactor},
        should_render: (reactor)=>{void reactor; return true},
        before_dom_update: (reactor)=>{void reactor},
        after_dom_update: (reactor)=>{void reactor},
        after_render: (reactor)=>{void reactor},
    }
    let invalid_options = Object.keys(options)
                            .filter(o => Object.keys(default_options).indexOf(o) === -1)

    if(invalid_options.length > 0){
        invalid_options.map(o => console.error(`Reactor got invalid option "${o}"`))
        return
    }
    // save options
    this.options = Object.assign(default_options, options)

    // store the render callback
    if(!render_callback || typeof render_callback !== 'function'){
        throw `Reactor did not receive a render callback function. This argument should be a function that returns html to populate the DOM element.`
    }
    this._render = render_callback.bind(this)  // this._render is called in this.render

    if(this.options.listen_to_global_store){
        // call render function when global store changes
        store.subscribe(this.render.bind(this))
    }
    if(this.options.render_on_init){
        this.render() // call the update function immediately so it renders itself
    }
}

/**
 * Calls the `render()` callback of the Reactor instance, and updates the inner html
 * of the Reactors's node if the new html does not match the previously rendered html.
 * i.e. `myreactor.render()`
 *
 * The render function looks like this has various lifecycle functions, all of them optional. The source code is displayed below for clarity.
 */
Reactor.prototype.render = function(){
    this.options.before_render(this)
    if(this.options.should_render(this)){
        // compute new value of node (it may or may not have changed)
        let new_html = this._render(this)

        let do_update = this.options.force_update

        if(new_html !== this.old_new_html){
            do_update = true
        }

        // update dom only if the return value of render changed
        if(do_update){
            this.options.force_update = false
            this.options.before_dom_update(this)
            this.node.innerHTML = new_html
            this.options.after_dom_update(this)
            this.old_new_html = new_html
        }
    }
    this.options.after_render(this)
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
        return a !== b
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

    // preferences
    // syntax highlighting
    themes: initial_data.themes,
    current_theme: localStorage.getItem('theme') || initial_data.themes[0],
    highlight_source_code: JSON.parse(localStorage.getItem('highlight_source_code')),  // get saved boolean to highlight source code

    auto_add_breakpoint_to_main: JSON.parse(localStorage.getItem('auto_add_breakpoint_to_main')),

    pretty_print: true,  // whether gdb should "pretty print" variables. There is an option for this in Settings
    refresh_state_after_sending_console_command: true,  // If true, send commands to refresh GUI store after each command is sent from console
    show_all_sent_commands_in_console: debug,  // show all sent commands if in debug mode

    // inferior program store
    // choices for inferior_program are:
    // 'running'
    // 'paused'
    // 'exited'
    // undefined
    inferior_program: undefined,

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
    current_line_of_source_code: null,
    current_assembly_address: null,
    rendered_source_file_fullname: null,
    has_unrendered_assembly: false,  // set to true when new assembly has been fetched and is cached in browser, but not displayed in source code window
    make_current_line_visible: false,  // set to true when source code window should jump to current line
    cached_source_files: [],  // list with keys fullname, source_code
    disassembly_for_missing_file: [],  // mi response object. Only fetched when there currently paused frame refers to a file that doesn't exist or is undefined
    missing_files: [],  // files that were attempted to be fetched but did not exist on the local filesystem


    // binary selection
    inferior_binary_path: null,
    inferior_binary_path_last_modified_unix_sec: null,
    warning_shown_for_old_binary: false,

    // registers
    register_names: [],
    previous_register_values: {},
    current_register_values: {},

    // memory
    memory_cache: {},

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


module.exports = {
    store: store,
    Reactor: Reactor,
    initial_store_data: initial_store_data
}
