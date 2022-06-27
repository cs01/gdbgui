import constants from "./constants";
import { debug } from "./InitialData";
import initialGlobalState from "./InitialGlobalState";
import { useState } from "react";
import { GlobalState } from "./types";
type Middleware = (key: string, oldval: any, newval: any) => boolean;

export function logChangesMiddleware(
  key: string,
  oldval: unknown,
  newval: unknown
): boolean {
  if (constants.doNotLogChanges.indexOf(key) === -1) {
    console.log(key, oldval, " -> ", newval);
  }
  return true;
}

function intersection(arr1: Array<string>, arr2: Array<string>) {
  return arr1.filter((i) => arr2.indexOf(i) !== -1);
}

type StoreKey = keyof GlobalState;
type StoreUpdateCallBack = (changedKeys: Array<any>) => void;

class Store {
  readonly data: GlobalState = initialGlobalState;
  private debounceMs: number = 0;
  private callbackId = 0; // this should always be unique and always increase
  private callbacks: Array<{ id: number; callback: StoreUpdateCallBack }> = [];
  private middleware: Array<Middleware>;
  private keysWithUnpublishedChanges: Array<StoreKey> = [];
  private debounceTimeout: NodeJS.Timeout | null = null;

  constructor(debounceMs: number, initialMiddleware: Array<Middleware>) {
    this.debounceMs = debounceMs;
    this.middleware = initialMiddleware;
  }

  /**
   * connect a React component's state to keys in the global store.
   * When a watched key of the store is updated, that the component's
   * setState method will be called.
   * Call this from the Component's constructor:
   *  store.connectComponentState(this, ['key1', 'key2'])
   */
  reactComponentState(
    component: React.Component,
    keysToWatchForChanges: Array<StoreKey>,
    additonalCallback: Nullable<(changedKeys: Array<StoreKey>) => void> = null
  ) {
    component.state = component.state || {}; // initialize if not set
    for (const k of keysToWatchForChanges) {
      // @ts-expect-error connectComponentState should only be called from constructor
      component.state[k] = this.data[k];
    }

    const callback = (changedKeys: Array<StoreKey>): void => {
      const watchedKeysDidChange = intersection(
        keysToWatchForChanges as Array<string>,
        changedKeys as Array<string>
      ).length;

      if (watchedKeysDidChange) {
        // @ts-expect-error
        const stateUpdateObj: GlobalState = {};
        // @ts-expect-error
        keysToWatchForChanges.forEach((key) => (stateUpdateObj[key] = this.data[key]));
        component.setState(stateUpdateObj);

        // if some other custom callback is required by the component
        // call that function as well
        if (additonalCallback) {
          additonalCallback(changedKeys);
        }
      }
    };

    return this.subscribe(callback);
  }
  /**
   * Connect a regular JavaScript function to a callback that is called ONLY
   * when one of a subset of the keys has been updated
   */
  public subscribeToKeys(
    keysToWatchForChanges: Array<StoreKey>,
    callback: StoreUpdateCallBack
  ) {
    // call this function whenever the store changes
    function _callback(changedKeys: Array<StoreKey>): void {
      if (
        intersection(keysToWatchForChanges as string[], changedKeys as string[]).length
      ) {
        callback(changedKeys);
      }
    }
    return this.subscribe(_callback);
  }

  /**
   * Add listener(s) to store changes.
   */
  public subscribe(callback: StoreUpdateCallBack): () => void {
    this.callbackId++;
    const id = this.callbackId;
    const unsubscribe = () => {
      this.callbacks = this.callbacks.filter((cb) => cb.id !== id);
    };
    this.callbacks.push({ id: id, callback });
    return unsubscribe;
  }
  public set<T>(key: StoreKey, value: T): void {
    const oldval = this.data[key];
    if (valueHasChanged(oldval, value)) {
      const updateStore = this.runMiddleware(key, oldval, value);
      if (updateStore) {
        // @ts-expect-error
        this.data[key] = value;
        this.enqueueChangedKey(key);
      }
    }
  }
  /**
   * use a middleware function
   * function signature of middleware is function(key, oldval, newval).
   * If middleware functions returns true, next middleware function will run
   * otherwise, the middleware chain will stop and the store will NOT be updated.
   */
  public use(middleware: Middleware) {
    this.middleware.push(middleware);
  }
  private runMiddleware(key: StoreKey, oldval: unknown, newval: unknown) {
    for (const fn of this.middleware) {
      const keepGoing = fn(key as string, oldval, newval);
      if (!keepGoing) {
        return false;
      }
    }
    return true;
  }
  /**
   * Emit event to subscribers based on timeout rules
   *
   * @param key     key to change
   */
  private enqueueChangedKey(key: StoreKey) {
    if (this.keysWithUnpublishedChanges.indexOf(key as any) === -1) {
      this.keysWithUnpublishedChanges.push(key as any);
    }
    this.clearDebounceTimeout();
    this.debounceTimeout = setTimeout(() => {
      this.flushChanges();
    }, this.debounceMs);
  }
  private clearDebounceTimeout() {
    if (this.debounceTimeout) {
      clearTimeout(this.debounceTimeout);
    }
    this.debounceTimeout = null;
  }
  /**
   * Run subscribers' callback functions. An array of the changed keys is passed to the callback function.
   * Be careful how often this is called, since re-rendering components can become expensive.
   */
  private flushChanges() {
    const changedKeys = this.keysWithUnpublishedChanges;
    if (changedKeys.length === 0) {
      console.error("no keys were changed, yet we are trying to publish a store change");
      return;
    }

    // make sure keysWithUnpublishedChanges is reset before executing callbacks
    // (if callbacks modify state, the list of keys the callback changed would be wiped out)
    this.keysWithUnpublishedChanges = [];
    this.clearDebounceTimeout();
    this.callbacks.forEach((callbackObj) => callbackObj.callback(changedKeys));
  }
}

// adapted from react-redux shallowEqual.js
// https://github.com/reactjs/react-redux/blob/master/src/utils/shallowEqual.js
function isSameRef(x: any, y: any) {
  if (x === y) {
    return x !== 0 || y !== 0 || 1 / x === 1 / y;
  } else {
    // eslint-disable-next-line no-self-compare
    return x !== x && y !== y;
  }
}
// adapted from react-redux shallowEqual.js
// https://github.com/reactjs/react-redux/blob/master/src/utils/shallowEqual.js
function shallowEqual(objA: any, objB: any) {
  if (isSameRef(objA, objB)) {
    return true;
  }

  if (
    typeof objA !== "object" ||
    objA === null ||
    typeof objB !== "object" ||
    objB === null
  ) {
    return false;
  }

  const keysA = Object.keys(objA);
  const keysB = Object.keys(objB);

  if (keysA.length !== keysB.length) {
    return false;
  }

  for (const k of keysA) {
    if (!objB.hasOwnProperty(k)) {
      return false;
    } else if (!isSameRef(objA[k], objB[k])) {
      return false;
    }
  }

  return true;
}
function isObject(ref: any) {
  return ref instanceof Object && ref.constructor === Object;
}

function valueHasChanged(a: any, b: any) {
  if (isObject(a) || Array.isArray(a)) {
    // since objects can be updated by reference, we don't
    // know if the value changed or not since the reference
    // is still the same. Err on the side of caution assume
    // objects always change.
    return true;
  } else {
    return !shallowEqual(a, b);
  }
}

export const store = new Store(10, debug ? [logChangesMiddleware] : []);

// React hook
export const useGlobalState = <T,>(
  key: StoreKey
): [T, React.Dispatch<React.SetStateAction<T>>] => {
  const [reactValue, setReactValue] = useState<T>(store.data[key]);

  store.subscribe((changedKeys: Array<StoreKey>): void => {
    if (changedKeys.includes(key)) {
      try {
        setReactValue(store.data[key]);
      } catch (e) {
        console.error(e);
      }
    }
  });

  return [
    reactValue,
    (newValue: unknown) => {
      store.set(key, newValue);
    },
  ];
};

// React hook
export const useGlobalValue = <T,>(key: StoreKey) => {
  const [reactValue, setReactValue] = useState<T>(store.data[key]);

  store.subscribe(function (changedKeys: Array<StoreKey>): void {
    if (changedKeys.indexOf(key) !== -1) {
      setReactValue(store.data[key]);
    }
  });

  return reactValue;
};
