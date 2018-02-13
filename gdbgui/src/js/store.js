/*
 * The store is the global state of the application.
 * It can be changed via store.set() and retrieved via store.get().
 *
 * The store should only be changed with calls to store.set() so that listeners
 * are notified.
 *
 * For example, calling store.set('line_of_source_to_flash', 100)
 * will change the highlighted line and automatically scroll to that line in the UI. Or calling
 * store.set('highlight_source_code', true) will "magically" make the source code be highlighted.
 */
const store = {
    /**
     * the store's options
     */
    options: {
        debounce_ms: 0,
        debug: false,
        immutable: true,
        // sometimes values are extremely large and just add noise when logging
        // if the key name is in this array and debug is true, value changes
        // will not be logged in the console
        keys_to_not_log_changes_in_console: [],
    },
    /**
     * Set the initial store. This can only be done once, and must be done before the
     * store can be modified. This should be a JavaScript object with key/value pairs.
     * This is the initial "hydration" of the store, and sets the expected types for all keys.
     * @param {object} initial_store: Initial store object
     * @param {object} options: options to apply to store
     */
    initialize: function(initial_store, options){
        if(store._store_created){
            throw 'cannot create more than one global store'
        }
        for(let k in initial_store){
            store._store[k] = initial_store[k]
        }
        if(options){
          Object.assign(store.options, options)
        }
        store._store_created = true
    },
    /**
     * connect a React component's state to keys in the global store.
     * When a watched key of the store is updated, that the component's
     * setState method will be called.
     * Call this from the Component's constructor:
     *  store.connectComponentState(this, ['key1', 'key2'])
     */
    connectComponentState: function(component,
                          keys_to_watch_for_changes,
                          additonal_callback=null){

        component.state = component.state || {}  // initialize if not set

        // add keys that map to the store's keys
        for (let k of keys_to_watch_for_changes){
            if(!(store._store.hasOwnProperty(k))){
              throw 'Store does not have key ' + k
            }
            if(component.state.hasOwnProperty(k)){
              console.warn('Overwriting existing state key ' + k)
            }
            component.state[k] = store._store[k]
            store._record_key_watcher(k, component.constructor.name)
        }

        // call this function whenever the store changes
        function _store_change_callback(changed_keys){
            if(intersection(keys_to_watch_for_changes, changed_keys).length){
                // only update the state if a key we care about has changed
                let state_update_obj = {}
                keys_to_watch_for_changes.forEach(k => state_update_obj[k] = store._store[k])
                this.setState(state_update_obj)

                // if some other custom callback is required by the component
                // call that function as well
                if(additonal_callback){
                  additonal_callback(changed_keys)
                }
            }
        }
        let callback_bound_to_component = _store_change_callback.bind(component)
        return store.subscribe(callback_bound_to_component)
    },
    /**
     * Connect a regular JavaScript function to a callback that is called ONLY
     * when one of a subset of the keys has been updated
     */
    subscribe_to_keys: function(keys_to_watch_for_changes, callback){
      // add keys that map to the store's keys
      for (let k of keys_to_watch_for_changes){
          if(!(store._store.hasOwnProperty(k))){
            throw 'Store does not have key ' + k
          }
          store._record_key_watcher(k, callback.name)
      }

      // call this function whenever the store changes
      function _callback(changed_keys){
          if(intersection(keys_to_watch_for_changes, changed_keys).length){
              callback(changed_keys)
          }
      }
      return store.subscribe(_callback)
    },
    get_key_watchers(){
      return copy_by_value(store._keys_connected_to_store_updates)
    },
    _record_key_watcher(key, watcher_name){
      if(!store._keys_connected_to_store_updates.hasOwnProperty(key)){
        store._keys_connected_to_store_updates[key] = []
      }
      store._keys_connected_to_store_updates[key].push(watcher_name)
    },
    /**
     * Add listener(s) to store changes. Reactors are automatically subscribed to store changes.
     * @param {function} function or array of functions to be called when event is dispatched due to store updates
     */
    subscribe(callback){
        let id = store._cur_callback_id
        store._cur_callback_id++

        function unsubscribe(){
          store._callback_objs = store._callback_objs.filter(c => c.id !== id)
        }
        store._callback_objs.push({id: id, callback: callback})
        return unsubscribe
    },
    /**
     * return an array of keys that do not trigger any callbacks when changed, and therefore
     * probably don't need to be included in the global store
     */
    getUnwatchedKeys: function(){
      let arr1 = Object.keys(store._store)
      , arr2 = Object.keys(store._keys_connected_to_store_updates)
      return arr1.filter(i => arr2.indexOf(i) === -1)
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
        check_type_match(oldval, value, key)
        if (value_changed(oldval, value)){
            // TODO add middleware calls
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
            if(store.options.keys_to_not_log_changes_in_console.indexOf(key) === -1){
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
        if(store.options.debounce_ms){
          store._debounce_timeout = setTimeout(store._publish, store.options.debounce_ms)
        }else{
          store._publish()
        }
    },
    /**
     * Get reference to one of the keys in the current store.
     * @param {str} key of the store object to get a reference to
     * @return reference or new object (depending on `immutable` option)
     * NOTE: The store should *only* be update by calling `store.set(...)`
     *   Throws error if key does not exist in store.
     */
    get: function(key){
        if(!store._store_created){
            throw 'cannot get store because is has not been created'
        }
        if(arguments.length === 0){
            // return the whole store
            if(store.options.immutable){
              return Object.assign({}, store._store)  // copy entire store by value
            }else{
              return store._store  // return reference to store
            }
        }else if(arguments.length > 1){
            console.error('unexpected number of arguments')
            return
        }

        if(!store._store.hasOwnProperty(key)){
          throw `attempted to access key that was not set during initialization: ${key}`
        }

        let ref = store._store[key]

        if(store.options.immutable){
          return copy_by_value(ref)
        }else{
          // return the reference
          return ref
        }
    },
    /**
     * Run subscribers' callback functions. An array of the changed keys is passed to the callback function.
     * Be careful how often this is called, since re-rendering components can become expensive.
     */
    _publish: function(){
        const changed_keys = store._changed_keys
        if(changed_keys.length === 0){
            console.error('no keys were changed, yet we are trying to publish a store change')
            return
        }

        // make sure _changed_keys is reset before executing callbacks
        // (if callbacks modify state, the list of keys the callback changed would be wiped out)
        store._changed_keys = []
        store._clear_debounce_timeout()
        store._callback_objs.forEach(c => c.callback(changed_keys))

    },
    /**
     * keys that were modified in the store since the last publish
     */
    _changed_keys: [],
    /**
     * array of functions to be called when store changes (usually Reactor.render())
     */
    _callback_objs: [],
    // unique id for each callback. Used when unsubscribing.
    _cur_callback_id: 0,
    /**
     * Actual store is held here, but should NEVER be accessed directly. Only access through store.set/store.get!
     */
    _store: {},
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
    _store_created: false,
    _keys_connected_to_store_updates: {},
}

/****** helper functions ********/
function intersection(arr1, arr2){
  return arr1.filter(i => arr2.indexOf(i) !== -1)
}

function copy_by_value(ref){
  if(Array.isArray(ref)){
    return ref.slice()
  }else if (is_object(ref)){
    return Object.assign({}, ref)
  }else{
    return ref
  }
}

function is_object(ref){
  return (ref instanceof Object && ref.constructor === Object  )
}

function check_type_match(a, b, key){
    if(a !== undefined && b !== undefined && a !== null && b !== null){
        let old_type = typeof a
        , new_type = typeof b
        if(old_type !== new_type){
            console.error('attempted to change ', key, ' from ', a, ' (', old_type, ') to ', b, ' (', new_type, ')')
            throw 'type error'
        }
    }
}

function value_changed(a, b){
    if((is_object(a) || Array.isArray(a)) &&
          !store.options.immutable) {
        // since objects can be updated by reference, we don't
        // know if the value changed or not since the reference
        // is still the same. Err on the side of caution assume
        // objects always change
        return true
    }else{
        return !shallow_equal(a, b)
    }
}

// adapted from react-redux shallowEqual.js
// https://github.com/reactjs/react-redux/blob/master/src/utils/shallowEqual.js
function is_same_ref(x, y) {
  if (x === y) {
    return x !== 0 || y !== 0 || 1 / x === 1 / y
  } else {
    return x !== x && y !== y
  }
}

function shallow_equal(objA, objB) {
  if (is_same_ref(objA, objB)){
    return true
  }

  if (typeof objA !== 'object' || objA === null ||
      typeof objB !== 'object' || objB === null) {
    return false
  }

  const keysA = Object.keys(objA)
  const keysB = Object.keys(objB)

  if (keysA.length !== keysB.length){
    return false
  }

  for (let k of keysA) {
    if (!objB.hasOwnProperty(k)){
      return false
    }else if(!is_same_ref(objA[k], objB[k])) {
      return false
    }
  }

  return true
}


module.exports = {
    store: store,
}
