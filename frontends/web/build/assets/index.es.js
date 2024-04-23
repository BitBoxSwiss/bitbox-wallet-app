import { g as getDefaultExportFromCjs, a as getAugmentedNamespace, E as require$$0$1, b as cjs$3, I as binary, M as wipe, O as random, P as fromString, R as toString, S as concat, c as commonjsGlobal, N as N$1, T as rt$1, V as ot$1, Z as kn, $ as Vn, a0 as Mn, K as Kn, a1 as Te, a2 as qn, a3 as xn, a4 as Hn, a5 as Fn, a6 as ee$1, a7 as $$1, L as Ln, a8 as vt$1, U, a9 as Et$1, aa as ut$1, ab as k$1, ac as Jn, ad as er$1, ae as Xn, af as nr$1, w as w$2, ag as Vt$1, ah as Mt$1, _ as _$1, p as pt$1, ai as It$1, aj as wt$1, d as at$1, y as yt$1, m as mt$1, H as Ht, k as kt$1, n as h$3, C as ft$1, ak as lt$1, al as dt$1, am as C, D as D$2, an as te$1, ao as p$1 } from "./index.js";
var events = { exports: {} };
var R$1 = typeof Reflect === "object" ? Reflect : null;
var ReflectApply = R$1 && typeof R$1.apply === "function" ? R$1.apply : function ReflectApply2(target, receiver, args) {
  return Function.prototype.apply.call(target, receiver, args);
};
var ReflectOwnKeys;
if (R$1 && typeof R$1.ownKeys === "function") {
  ReflectOwnKeys = R$1.ownKeys;
} else if (Object.getOwnPropertySymbols) {
  ReflectOwnKeys = function ReflectOwnKeys2(target) {
    return Object.getOwnPropertyNames(target).concat(Object.getOwnPropertySymbols(target));
  };
} else {
  ReflectOwnKeys = function ReflectOwnKeys2(target) {
    return Object.getOwnPropertyNames(target);
  };
}
function ProcessEmitWarning(warning) {
  if (console && console.warn)
    console.warn(warning);
}
var NumberIsNaN = Number.isNaN || function NumberIsNaN2(value) {
  return value !== value;
};
function EventEmitter() {
  EventEmitter.init.call(this);
}
events.exports = EventEmitter;
events.exports.once = once2;
EventEmitter.EventEmitter = EventEmitter;
EventEmitter.prototype._events = void 0;
EventEmitter.prototype._eventsCount = 0;
EventEmitter.prototype._maxListeners = void 0;
var defaultMaxListeners = 10;
function checkListener(listener) {
  if (typeof listener !== "function") {
    throw new TypeError('The "listener" argument must be of type Function. Received type ' + typeof listener);
  }
}
Object.defineProperty(EventEmitter, "defaultMaxListeners", {
  enumerable: true,
  get: function() {
    return defaultMaxListeners;
  },
  set: function(arg) {
    if (typeof arg !== "number" || arg < 0 || NumberIsNaN(arg)) {
      throw new RangeError('The value of "defaultMaxListeners" is out of range. It must be a non-negative number. Received ' + arg + ".");
    }
    defaultMaxListeners = arg;
  }
});
EventEmitter.init = function() {
  if (this._events === void 0 || this._events === Object.getPrototypeOf(this)._events) {
    this._events = /* @__PURE__ */ Object.create(null);
    this._eventsCount = 0;
  }
  this._maxListeners = this._maxListeners || void 0;
};
EventEmitter.prototype.setMaxListeners = function setMaxListeners(n2) {
  if (typeof n2 !== "number" || n2 < 0 || NumberIsNaN(n2)) {
    throw new RangeError('The value of "n" is out of range. It must be a non-negative number. Received ' + n2 + ".");
  }
  this._maxListeners = n2;
  return this;
};
function _getMaxListeners(that) {
  if (that._maxListeners === void 0)
    return EventEmitter.defaultMaxListeners;
  return that._maxListeners;
}
EventEmitter.prototype.getMaxListeners = function getMaxListeners() {
  return _getMaxListeners(this);
};
EventEmitter.prototype.emit = function emit(type) {
  var args = [];
  for (var i = 1; i < arguments.length; i++)
    args.push(arguments[i]);
  var doError = type === "error";
  var events2 = this._events;
  if (events2 !== void 0)
    doError = doError && events2.error === void 0;
  else if (!doError)
    return false;
  if (doError) {
    var er2;
    if (args.length > 0)
      er2 = args[0];
    if (er2 instanceof Error) {
      throw er2;
    }
    var err = new Error("Unhandled error." + (er2 ? " (" + er2.message + ")" : ""));
    err.context = er2;
    throw err;
  }
  var handler = events2[type];
  if (handler === void 0)
    return false;
  if (typeof handler === "function") {
    ReflectApply(handler, this, args);
  } else {
    var len = handler.length;
    var listeners2 = arrayClone(handler, len);
    for (var i = 0; i < len; ++i)
      ReflectApply(listeners2[i], this, args);
  }
  return true;
};
function _addListener(target, type, listener, prepend) {
  var m;
  var events2;
  var existing;
  checkListener(listener);
  events2 = target._events;
  if (events2 === void 0) {
    events2 = target._events = /* @__PURE__ */ Object.create(null);
    target._eventsCount = 0;
  } else {
    if (events2.newListener !== void 0) {
      target.emit(
        "newListener",
        type,
        listener.listener ? listener.listener : listener
      );
      events2 = target._events;
    }
    existing = events2[type];
  }
  if (existing === void 0) {
    existing = events2[type] = listener;
    ++target._eventsCount;
  } else {
    if (typeof existing === "function") {
      existing = events2[type] = prepend ? [listener, existing] : [existing, listener];
    } else if (prepend) {
      existing.unshift(listener);
    } else {
      existing.push(listener);
    }
    m = _getMaxListeners(target);
    if (m > 0 && existing.length > m && !existing.warned) {
      existing.warned = true;
      var w2 = new Error("Possible EventEmitter memory leak detected. " + existing.length + " " + String(type) + " listeners added. Use emitter.setMaxListeners() to increase limit");
      w2.name = "MaxListenersExceededWarning";
      w2.emitter = target;
      w2.type = type;
      w2.count = existing.length;
      ProcessEmitWarning(w2);
    }
  }
  return target;
}
EventEmitter.prototype.addListener = function addListener(type, listener) {
  return _addListener(this, type, listener, false);
};
EventEmitter.prototype.on = EventEmitter.prototype.addListener;
EventEmitter.prototype.prependListener = function prependListener(type, listener) {
  return _addListener(this, type, listener, true);
};
function onceWrapper() {
  if (!this.fired) {
    this.target.removeListener(this.type, this.wrapFn);
    this.fired = true;
    if (arguments.length === 0)
      return this.listener.call(this.target);
    return this.listener.apply(this.target, arguments);
  }
}
function _onceWrap(target, type, listener) {
  var state = { fired: false, wrapFn: void 0, target, type, listener };
  var wrapped = onceWrapper.bind(state);
  wrapped.listener = listener;
  state.wrapFn = wrapped;
  return wrapped;
}
EventEmitter.prototype.once = function once(type, listener) {
  checkListener(listener);
  this.on(type, _onceWrap(this, type, listener));
  return this;
};
EventEmitter.prototype.prependOnceListener = function prependOnceListener(type, listener) {
  checkListener(listener);
  this.prependListener(type, _onceWrap(this, type, listener));
  return this;
};
EventEmitter.prototype.removeListener = function removeListener(type, listener) {
  var list, events2, position, i, originalListener;
  checkListener(listener);
  events2 = this._events;
  if (events2 === void 0)
    return this;
  list = events2[type];
  if (list === void 0)
    return this;
  if (list === listener || list.listener === listener) {
    if (--this._eventsCount === 0)
      this._events = /* @__PURE__ */ Object.create(null);
    else {
      delete events2[type];
      if (events2.removeListener)
        this.emit("removeListener", type, list.listener || listener);
    }
  } else if (typeof list !== "function") {
    position = -1;
    for (i = list.length - 1; i >= 0; i--) {
      if (list[i] === listener || list[i].listener === listener) {
        originalListener = list[i].listener;
        position = i;
        break;
      }
    }
    if (position < 0)
      return this;
    if (position === 0)
      list.shift();
    else {
      spliceOne(list, position);
    }
    if (list.length === 1)
      events2[type] = list[0];
    if (events2.removeListener !== void 0)
      this.emit("removeListener", type, originalListener || listener);
  }
  return this;
};
EventEmitter.prototype.off = EventEmitter.prototype.removeListener;
EventEmitter.prototype.removeAllListeners = function removeAllListeners(type) {
  var listeners2, events2, i;
  events2 = this._events;
  if (events2 === void 0)
    return this;
  if (events2.removeListener === void 0) {
    if (arguments.length === 0) {
      this._events = /* @__PURE__ */ Object.create(null);
      this._eventsCount = 0;
    } else if (events2[type] !== void 0) {
      if (--this._eventsCount === 0)
        this._events = /* @__PURE__ */ Object.create(null);
      else
        delete events2[type];
    }
    return this;
  }
  if (arguments.length === 0) {
    var keys2 = Object.keys(events2);
    var key;
    for (i = 0; i < keys2.length; ++i) {
      key = keys2[i];
      if (key === "removeListener")
        continue;
      this.removeAllListeners(key);
    }
    this.removeAllListeners("removeListener");
    this._events = /* @__PURE__ */ Object.create(null);
    this._eventsCount = 0;
    return this;
  }
  listeners2 = events2[type];
  if (typeof listeners2 === "function") {
    this.removeListener(type, listeners2);
  } else if (listeners2 !== void 0) {
    for (i = listeners2.length - 1; i >= 0; i--) {
      this.removeListener(type, listeners2[i]);
    }
  }
  return this;
};
function _listeners(target, type, unwrap) {
  var events2 = target._events;
  if (events2 === void 0)
    return [];
  var evlistener = events2[type];
  if (evlistener === void 0)
    return [];
  if (typeof evlistener === "function")
    return unwrap ? [evlistener.listener || evlistener] : [evlistener];
  return unwrap ? unwrapListeners(evlistener) : arrayClone(evlistener, evlistener.length);
}
EventEmitter.prototype.listeners = function listeners(type) {
  return _listeners(this, type, true);
};
EventEmitter.prototype.rawListeners = function rawListeners(type) {
  return _listeners(this, type, false);
};
EventEmitter.listenerCount = function(emitter, type) {
  if (typeof emitter.listenerCount === "function") {
    return emitter.listenerCount(type);
  } else {
    return listenerCount.call(emitter, type);
  }
};
EventEmitter.prototype.listenerCount = listenerCount;
function listenerCount(type) {
  var events2 = this._events;
  if (events2 !== void 0) {
    var evlistener = events2[type];
    if (typeof evlistener === "function") {
      return 1;
    } else if (evlistener !== void 0) {
      return evlistener.length;
    }
  }
  return 0;
}
EventEmitter.prototype.eventNames = function eventNames() {
  return this._eventsCount > 0 ? ReflectOwnKeys(this._events) : [];
};
function arrayClone(arr, n2) {
  var copy = new Array(n2);
  for (var i = 0; i < n2; ++i)
    copy[i] = arr[i];
  return copy;
}
function spliceOne(list, index) {
  for (; index + 1 < list.length; index++)
    list[index] = list[index + 1];
  list.pop();
}
function unwrapListeners(arr) {
  var ret = new Array(arr.length);
  for (var i = 0; i < ret.length; ++i) {
    ret[i] = arr[i].listener || arr[i];
  }
  return ret;
}
function once2(emitter, name) {
  return new Promise(function(resolve, reject) {
    function errorListener(err) {
      emitter.removeListener(name, resolver);
      reject(err);
    }
    function resolver() {
      if (typeof emitter.removeListener === "function") {
        emitter.removeListener("error", errorListener);
      }
      resolve([].slice.call(arguments));
    }
    eventTargetAgnosticAddListener(emitter, name, resolver, { once: true });
    if (name !== "error") {
      addErrorHandlerIfEventEmitter(emitter, errorListener, { once: true });
    }
  });
}
function addErrorHandlerIfEventEmitter(emitter, handler, flags) {
  if (typeof emitter.on === "function") {
    eventTargetAgnosticAddListener(emitter, "error", handler, flags);
  }
}
function eventTargetAgnosticAddListener(emitter, name, listener, flags) {
  if (typeof emitter.on === "function") {
    if (flags.once) {
      emitter.once(name, listener);
    } else {
      emitter.on(name, listener);
    }
  } else if (typeof emitter.addEventListener === "function") {
    emitter.addEventListener(name, function wrapListener(arg) {
      if (flags.once) {
        emitter.removeEventListener(name, wrapListener);
      }
      listener(arg);
    });
  } else {
    throw new TypeError('The "emitter" argument must be of type EventEmitter. Received type ' + typeof emitter);
  }
}
var eventsExports = events.exports;
const Ye$1 = /* @__PURE__ */ getDefaultExportFromCjs(eventsExports);
const suspectProtoRx = /"(?:_|\\u0{2}5[Ff]){2}(?:p|\\u0{2}70)(?:r|\\u0{2}72)(?:o|\\u0{2}6[Ff])(?:t|\\u0{2}74)(?:o|\\u0{2}6[Ff])(?:_|\\u0{2}5[Ff]){2}"\s*:/;
const suspectConstructorRx = /"(?:c|\\u0063)(?:o|\\u006[Ff])(?:n|\\u006[Ee])(?:s|\\u0073)(?:t|\\u0074)(?:r|\\u0072)(?:u|\\u0075)(?:c|\\u0063)(?:t|\\u0074)(?:o|\\u006[Ff])(?:r|\\u0072)"\s*:/;
const JsonSigRx = /^\s*["[{]|^\s*-?\d{1,16}(\.\d{1,17})?([Ee][+-]?\d+)?\s*$/;
function jsonParseTransform(key, value) {
  if (key === "__proto__" || key === "constructor" && value && typeof value === "object" && "prototype" in value) {
    warnKeyDropped(key);
    return;
  }
  return value;
}
function warnKeyDropped(key) {
  console.warn(`[destr] Dropping "${key}" key to prevent prototype pollution.`);
}
function destr(value, options = {}) {
  if (typeof value !== "string") {
    return value;
  }
  const _value = value.trim();
  if (
    // eslint-disable-next-line unicorn/prefer-at
    value[0] === '"' && value.at(-1) === '"' && !value.includes("\\")
  ) {
    return _value.slice(1, -1);
  }
  if (_value.length <= 9) {
    const _lval = _value.toLowerCase();
    if (_lval === "true") {
      return true;
    }
    if (_lval === "false") {
      return false;
    }
    if (_lval === "undefined") {
      return void 0;
    }
    if (_lval === "null") {
      return null;
    }
    if (_lval === "nan") {
      return Number.NaN;
    }
    if (_lval === "infinity") {
      return Number.POSITIVE_INFINITY;
    }
    if (_lval === "-infinity") {
      return Number.NEGATIVE_INFINITY;
    }
  }
  if (!JsonSigRx.test(value)) {
    if (options.strict) {
      throw new SyntaxError("[destr] Invalid JSON");
    }
    return value;
  }
  try {
    if (suspectProtoRx.test(value) || suspectConstructorRx.test(value)) {
      if (options.strict) {
        throw new Error("[destr] Possible prototype pollution");
      }
      return JSON.parse(value, jsonParseTransform);
    }
    return JSON.parse(value);
  } catch (error) {
    if (options.strict) {
      throw error;
    }
    return value;
  }
}
function wrapToPromise(value) {
  if (!value || typeof value.then !== "function") {
    return Promise.resolve(value);
  }
  return value;
}
function asyncCall(function_, ...arguments_) {
  try {
    return wrapToPromise(function_(...arguments_));
  } catch (error) {
    return Promise.reject(error);
  }
}
function isPrimitive(value) {
  const type = typeof value;
  return value === null || type !== "object" && type !== "function";
}
function isPureObject(value) {
  const proto = Object.getPrototypeOf(value);
  return !proto || proto.isPrototypeOf(Object);
}
function stringify(value) {
  if (isPrimitive(value)) {
    return String(value);
  }
  if (isPureObject(value) || Array.isArray(value)) {
    return JSON.stringify(value);
  }
  if (typeof value.toJSON === "function") {
    return stringify(value.toJSON());
  }
  throw new Error("[unstorage] Cannot stringify value!");
}
function checkBufferSupport() {
  if (typeof Buffer === void 0) {
    throw new TypeError("[unstorage] Buffer is not supported!");
  }
}
const BASE64_PREFIX = "base64:";
function serializeRaw(value) {
  if (typeof value === "string") {
    return value;
  }
  checkBufferSupport();
  const base64 = Buffer.from(value).toString("base64");
  return BASE64_PREFIX + base64;
}
function deserializeRaw(value) {
  if (typeof value !== "string") {
    return value;
  }
  if (!value.startsWith(BASE64_PREFIX)) {
    return value;
  }
  checkBufferSupport();
  return Buffer.from(value.slice(BASE64_PREFIX.length), "base64");
}
function normalizeKey(key) {
  if (!key) {
    return "";
  }
  return key.split("?")[0].replace(/[/\\]/g, ":").replace(/:+/g, ":").replace(/^:|:$/g, "");
}
function joinKeys(...keys2) {
  return normalizeKey(keys2.join(":"));
}
function normalizeBaseKey(base) {
  base = normalizeKey(base);
  return base ? base + ":" : "";
}
function defineDriver(factory) {
  return factory;
}
const DRIVER_NAME = "memory";
const memory = defineDriver(() => {
  const data = /* @__PURE__ */ new Map();
  return {
    name: DRIVER_NAME,
    options: {},
    hasItem(key) {
      return data.has(key);
    },
    getItem(key) {
      return data.get(key) ?? null;
    },
    getItemRaw(key) {
      return data.get(key) ?? null;
    },
    setItem(key, value) {
      data.set(key, value);
    },
    setItemRaw(key, value) {
      data.set(key, value);
    },
    removeItem(key) {
      data.delete(key);
    },
    getKeys() {
      return Array.from(data.keys());
    },
    clear() {
      data.clear();
    },
    dispose() {
      data.clear();
    }
  };
});
function createStorage(options = {}) {
  const context = {
    mounts: { "": options.driver || memory() },
    mountpoints: [""],
    watching: false,
    watchListeners: [],
    unwatch: {}
  };
  const getMount = (key) => {
    for (const base of context.mountpoints) {
      if (key.startsWith(base)) {
        return {
          base,
          relativeKey: key.slice(base.length),
          driver: context.mounts[base]
        };
      }
    }
    return {
      base: "",
      relativeKey: key,
      driver: context.mounts[""]
    };
  };
  const getMounts = (base, includeParent) => {
    return context.mountpoints.filter(
      (mountpoint) => mountpoint.startsWith(base) || includeParent && base.startsWith(mountpoint)
    ).map((mountpoint) => ({
      relativeBase: base.length > mountpoint.length ? base.slice(mountpoint.length) : void 0,
      mountpoint,
      driver: context.mounts[mountpoint]
    }));
  };
  const onChange = (event, key) => {
    if (!context.watching) {
      return;
    }
    key = normalizeKey(key);
    for (const listener of context.watchListeners) {
      listener(event, key);
    }
  };
  const startWatch = async () => {
    if (context.watching) {
      return;
    }
    context.watching = true;
    for (const mountpoint in context.mounts) {
      context.unwatch[mountpoint] = await watch(
        context.mounts[mountpoint],
        onChange,
        mountpoint
      );
    }
  };
  const stopWatch = async () => {
    if (!context.watching) {
      return;
    }
    for (const mountpoint in context.unwatch) {
      await context.unwatch[mountpoint]();
    }
    context.unwatch = {};
    context.watching = false;
  };
  const runBatch = (items, commonOptions, cb) => {
    const batches = /* @__PURE__ */ new Map();
    const getBatch = (mount) => {
      let batch = batches.get(mount.base);
      if (!batch) {
        batch = {
          driver: mount.driver,
          base: mount.base,
          items: []
        };
        batches.set(mount.base, batch);
      }
      return batch;
    };
    for (const item of items) {
      const isStringItem = typeof item === "string";
      const key = normalizeKey(isStringItem ? item : item.key);
      const value = isStringItem ? void 0 : item.value;
      const options2 = isStringItem || !item.options ? commonOptions : { ...commonOptions, ...item.options };
      const mount = getMount(key);
      getBatch(mount).items.push({
        key,
        value,
        relativeKey: mount.relativeKey,
        options: options2
      });
    }
    return Promise.all([...batches.values()].map((batch) => cb(batch))).then(
      (r) => r.flat()
    );
  };
  const storage = {
    // Item
    hasItem(key, opts = {}) {
      key = normalizeKey(key);
      const { relativeKey, driver } = getMount(key);
      return asyncCall(driver.hasItem, relativeKey, opts);
    },
    getItem(key, opts = {}) {
      key = normalizeKey(key);
      const { relativeKey, driver } = getMount(key);
      return asyncCall(driver.getItem, relativeKey, opts).then(
        (value) => destr(value)
      );
    },
    getItems(items, commonOptions) {
      return runBatch(items, commonOptions, (batch) => {
        if (batch.driver.getItems) {
          return asyncCall(
            batch.driver.getItems,
            batch.items.map((item) => ({
              key: item.relativeKey,
              options: item.options
            })),
            commonOptions
          ).then(
            (r) => r.map((item) => ({
              key: joinKeys(batch.base, item.key),
              value: destr(item.value)
            }))
          );
        }
        return Promise.all(
          batch.items.map((item) => {
            return asyncCall(
              batch.driver.getItem,
              item.relativeKey,
              item.options
            ).then((value) => ({
              key: item.key,
              value: destr(value)
            }));
          })
        );
      });
    },
    getItemRaw(key, opts = {}) {
      key = normalizeKey(key);
      const { relativeKey, driver } = getMount(key);
      if (driver.getItemRaw) {
        return asyncCall(driver.getItemRaw, relativeKey, opts);
      }
      return asyncCall(driver.getItem, relativeKey, opts).then(
        (value) => deserializeRaw(value)
      );
    },
    async setItem(key, value, opts = {}) {
      if (value === void 0) {
        return storage.removeItem(key);
      }
      key = normalizeKey(key);
      const { relativeKey, driver } = getMount(key);
      if (!driver.setItem) {
        return;
      }
      await asyncCall(driver.setItem, relativeKey, stringify(value), opts);
      if (!driver.watch) {
        onChange("update", key);
      }
    },
    async setItems(items, commonOptions) {
      await runBatch(items, commonOptions, async (batch) => {
        if (batch.driver.setItems) {
          await asyncCall(
            batch.driver.setItems,
            batch.items.map((item) => ({
              key: item.relativeKey,
              value: stringify(item.value),
              options: item.options
            })),
            commonOptions
          );
        }
        if (!batch.driver.setItem) {
          return;
        }
        await Promise.all(
          batch.items.map((item) => {
            return asyncCall(
              batch.driver.setItem,
              item.relativeKey,
              stringify(item.value),
              item.options
            );
          })
        );
      });
    },
    async setItemRaw(key, value, opts = {}) {
      if (value === void 0) {
        return storage.removeItem(key, opts);
      }
      key = normalizeKey(key);
      const { relativeKey, driver } = getMount(key);
      if (driver.setItemRaw) {
        await asyncCall(driver.setItemRaw, relativeKey, value, opts);
      } else if (driver.setItem) {
        await asyncCall(driver.setItem, relativeKey, serializeRaw(value), opts);
      } else {
        return;
      }
      if (!driver.watch) {
        onChange("update", key);
      }
    },
    async removeItem(key, opts = {}) {
      if (typeof opts === "boolean") {
        opts = { removeMeta: opts };
      }
      key = normalizeKey(key);
      const { relativeKey, driver } = getMount(key);
      if (!driver.removeItem) {
        return;
      }
      await asyncCall(driver.removeItem, relativeKey, opts);
      if (opts.removeMeta || opts.removeMata) {
        await asyncCall(driver.removeItem, relativeKey + "$", opts);
      }
      if (!driver.watch) {
        onChange("remove", key);
      }
    },
    // Meta
    async getMeta(key, opts = {}) {
      if (typeof opts === "boolean") {
        opts = { nativeOnly: opts };
      }
      key = normalizeKey(key);
      const { relativeKey, driver } = getMount(key);
      const meta = /* @__PURE__ */ Object.create(null);
      if (driver.getMeta) {
        Object.assign(meta, await asyncCall(driver.getMeta, relativeKey, opts));
      }
      if (!opts.nativeOnly) {
        const value = await asyncCall(
          driver.getItem,
          relativeKey + "$",
          opts
        ).then((value_) => destr(value_));
        if (value && typeof value === "object") {
          if (typeof value.atime === "string") {
            value.atime = new Date(value.atime);
          }
          if (typeof value.mtime === "string") {
            value.mtime = new Date(value.mtime);
          }
          Object.assign(meta, value);
        }
      }
      return meta;
    },
    setMeta(key, value, opts = {}) {
      return this.setItem(key + "$", value, opts);
    },
    removeMeta(key, opts = {}) {
      return this.removeItem(key + "$", opts);
    },
    // Keys
    async getKeys(base, opts = {}) {
      base = normalizeBaseKey(base);
      const mounts = getMounts(base, true);
      let maskedMounts = [];
      const allKeys = [];
      for (const mount of mounts) {
        const rawKeys = await asyncCall(
          mount.driver.getKeys,
          mount.relativeBase,
          opts
        );
        const keys2 = rawKeys.map((key) => mount.mountpoint + normalizeKey(key)).filter((key) => !maskedMounts.some((p2) => key.startsWith(p2)));
        allKeys.push(...keys2);
        maskedMounts = [
          mount.mountpoint,
          ...maskedMounts.filter((p2) => !p2.startsWith(mount.mountpoint))
        ];
      }
      return base ? allKeys.filter((key) => key.startsWith(base) && !key.endsWith("$")) : allKeys.filter((key) => !key.endsWith("$"));
    },
    // Utils
    async clear(base, opts = {}) {
      base = normalizeBaseKey(base);
      await Promise.all(
        getMounts(base, false).map(async (m) => {
          if (m.driver.clear) {
            return asyncCall(m.driver.clear, m.relativeBase, opts);
          }
          if (m.driver.removeItem) {
            const keys2 = await m.driver.getKeys(m.relativeBase || "", opts);
            return Promise.all(
              keys2.map((key) => m.driver.removeItem(key, opts))
            );
          }
        })
      );
    },
    async dispose() {
      await Promise.all(
        Object.values(context.mounts).map((driver) => dispose(driver))
      );
    },
    async watch(callback) {
      await startWatch();
      context.watchListeners.push(callback);
      return async () => {
        context.watchListeners = context.watchListeners.filter(
          (listener) => listener !== callback
        );
        if (context.watchListeners.length === 0) {
          await stopWatch();
        }
      };
    },
    async unwatch() {
      context.watchListeners = [];
      await stopWatch();
    },
    // Mount
    mount(base, driver) {
      base = normalizeBaseKey(base);
      if (base && context.mounts[base]) {
        throw new Error(`already mounted at ${base}`);
      }
      if (base) {
        context.mountpoints.push(base);
        context.mountpoints.sort((a3, b3) => b3.length - a3.length);
      }
      context.mounts[base] = driver;
      if (context.watching) {
        Promise.resolve(watch(driver, onChange, base)).then((unwatcher) => {
          context.unwatch[base] = unwatcher;
        }).catch(console.error);
      }
      return storage;
    },
    async unmount(base, _dispose = true) {
      base = normalizeBaseKey(base);
      if (!base || !context.mounts[base]) {
        return;
      }
      if (context.watching && base in context.unwatch) {
        context.unwatch[base]();
        delete context.unwatch[base];
      }
      if (_dispose) {
        await dispose(context.mounts[base]);
      }
      context.mountpoints = context.mountpoints.filter((key) => key !== base);
      delete context.mounts[base];
    },
    getMount(key = "") {
      key = normalizeKey(key) + ":";
      const m = getMount(key);
      return {
        driver: m.driver,
        base: m.base
      };
    },
    getMounts(base = "", opts = {}) {
      base = normalizeKey(base);
      const mounts = getMounts(base, opts.parents);
      return mounts.map((m) => ({
        driver: m.driver,
        base: m.mountpoint
      }));
    }
  };
  return storage;
}
function watch(driver, onChange, base) {
  return driver.watch ? driver.watch((event, key) => onChange(event, base + key)) : () => {
  };
}
async function dispose(driver) {
  if (typeof driver.dispose === "function") {
    await asyncCall(driver.dispose);
  }
}
function promisifyRequest(request) {
  return new Promise((resolve, reject) => {
    request.oncomplete = request.onsuccess = () => resolve(request.result);
    request.onabort = request.onerror = () => reject(request.error);
  });
}
function createStore(dbName, storeName) {
  const request = indexedDB.open(dbName);
  request.onupgradeneeded = () => request.result.createObjectStore(storeName);
  const dbp = promisifyRequest(request);
  return (txMode, callback) => dbp.then((db) => callback(db.transaction(storeName, txMode).objectStore(storeName)));
}
let defaultGetStoreFunc;
function defaultGetStore() {
  if (!defaultGetStoreFunc) {
    defaultGetStoreFunc = createStore("keyval-store", "keyval");
  }
  return defaultGetStoreFunc;
}
function get(key, customStore = defaultGetStore()) {
  return customStore("readonly", (store) => promisifyRequest(store.get(key)));
}
function set(key, value, customStore = defaultGetStore()) {
  return customStore("readwrite", (store) => {
    store.put(value, key);
    return promisifyRequest(store.transaction);
  });
}
function del(key, customStore = defaultGetStore()) {
  return customStore("readwrite", (store) => {
    store.delete(key);
    return promisifyRequest(store.transaction);
  });
}
function clear(customStore = defaultGetStore()) {
  return customStore("readwrite", (store) => {
    store.clear();
    return promisifyRequest(store.transaction);
  });
}
function eachCursor(store, callback) {
  store.openCursor().onsuccess = function() {
    if (!this.result)
      return;
    callback(this.result);
    this.result.continue();
  };
  return promisifyRequest(store.transaction);
}
function keys(customStore = defaultGetStore()) {
  return customStore("readonly", (store) => {
    if (store.getAllKeys) {
      return promisifyRequest(store.getAllKeys());
    }
    const items = [];
    return eachCursor(store, (cursor) => items.push(cursor.key)).then(() => items);
  });
}
const JSONStringify = (data) => JSON.stringify(data, (_2, value) => typeof value === "bigint" ? value.toString() + "n" : value);
const JSONParse = (json) => {
  const numbersBiggerThanMaxInt = /([\[:])?(\d{17,}|(?:[9](?:[1-9]07199254740991|0[1-9]7199254740991|00[8-9]199254740991|007[2-9]99254740991|007199[3-9]54740991|0071992[6-9]4740991|00719925[5-9]740991|007199254[8-9]40991|0071992547[5-9]0991|00719925474[1-9]991|00719925474099[2-9])))([,\}\]])/g;
  const serializedData = json.replace(numbersBiggerThanMaxInt, '$1"$2n"$3');
  return JSON.parse(serializedData, (_2, value) => {
    const isCustomFormatBigInt = typeof value === "string" && value.match(/^\d+n$/);
    if (isCustomFormatBigInt)
      return BigInt(value.substring(0, value.length - 1));
    return value;
  });
};
function safeJsonParse(value) {
  if (typeof value !== "string") {
    throw new Error(`Cannot safe json parse value of type ${typeof value}`);
  }
  try {
    return JSONParse(value);
  } catch (_a) {
    return value;
  }
}
function safeJsonStringify(value) {
  return typeof value === "string" ? value : JSONStringify(value) || "";
}
const x = "idb-keyval";
var z = (i = {}) => {
  const t = i.base && i.base.length > 0 ? `${i.base}:` : "", e = (s) => t + s;
  let n2;
  return i.dbName && i.storeName && (n2 = createStore(i.dbName, i.storeName)), { name: x, options: i, async hasItem(s) {
    return !(typeof await get(e(s), n2) > "u");
  }, async getItem(s) {
    return await get(e(s), n2) ?? null;
  }, setItem(s, a3) {
    return set(e(s), a3, n2);
  }, removeItem(s) {
    return del(e(s), n2);
  }, getKeys() {
    return keys(n2);
  }, clear() {
    return clear(n2);
  } };
};
const D$1 = "WALLET_CONNECT_V2_INDEXED_DB", E$1 = "keyvaluestorage";
class _ {
  constructor() {
    this.indexedDb = createStorage({ driver: z({ dbName: D$1, storeName: E$1 }) });
  }
  async getKeys() {
    return this.indexedDb.getKeys();
  }
  async getEntries() {
    return (await this.indexedDb.getItems(await this.indexedDb.getKeys())).map((t) => [t.key, t.value]);
  }
  async getItem(t) {
    const e = await this.indexedDb.getItem(t);
    if (e !== null)
      return e;
  }
  async setItem(t, e) {
    await this.indexedDb.setItem(t, safeJsonStringify(e));
  }
  async removeItem(t) {
    await this.indexedDb.removeItem(t);
  }
}
var l = typeof globalThis < "u" ? globalThis : typeof window < "u" ? window : typeof global < "u" ? global : typeof self < "u" ? self : {}, c = { exports: {} };
(function() {
  let i;
  function t() {
  }
  i = t, i.prototype.getItem = function(e) {
    return this.hasOwnProperty(e) ? String(this[e]) : null;
  }, i.prototype.setItem = function(e, n2) {
    this[e] = String(n2);
  }, i.prototype.removeItem = function(e) {
    delete this[e];
  }, i.prototype.clear = function() {
    const e = this;
    Object.keys(e).forEach(function(n2) {
      e[n2] = void 0, delete e[n2];
    });
  }, i.prototype.key = function(e) {
    return e = e || 0, Object.keys(this)[e];
  }, i.prototype.__defineGetter__("length", function() {
    return Object.keys(this).length;
  }), typeof l < "u" && l.localStorage ? c.exports = l.localStorage : typeof window < "u" && window.localStorage ? c.exports = window.localStorage : c.exports = new t();
})();
function k(i) {
  var t;
  return [i[0], safeJsonParse((t = i[1]) != null ? t : "")];
}
class K {
  constructor() {
    this.localStorage = c.exports;
  }
  async getKeys() {
    return Object.keys(this.localStorage);
  }
  async getEntries() {
    return Object.entries(this.localStorage).map(k);
  }
  async getItem(t) {
    const e = this.localStorage.getItem(t);
    if (e !== null)
      return safeJsonParse(e);
  }
  async setItem(t, e) {
    this.localStorage.setItem(t, safeJsonStringify(e));
  }
  async removeItem(t) {
    this.localStorage.removeItem(t);
  }
}
const N = "wc_storage_version", y$1 = 1, O$1 = async (i, t, e) => {
  const n2 = N, s = await t.getItem(n2);
  if (s && s >= y$1) {
    e(t);
    return;
  }
  const a3 = await i.getKeys();
  if (!a3.length) {
    e(t);
    return;
  }
  const m = [];
  for (; a3.length; ) {
    const r = a3.shift();
    if (!r)
      continue;
    const o = r.toLowerCase();
    if (o.includes("wc@") || o.includes("walletconnect") || o.includes("wc_") || o.includes("wallet_connect")) {
      const f2 = await i.getItem(r);
      await t.setItem(r, f2), m.push(r);
    }
  }
  await t.setItem(n2, y$1), e(t), j(i, m);
}, j = async (i, t) => {
  t.length && t.forEach(async (e) => {
    await i.removeItem(e);
  });
};
let h$2 = class h {
  constructor() {
    this.initialized = false, this.setInitialized = (e) => {
      this.storage = e, this.initialized = true;
    };
    const t = new K();
    this.storage = t;
    try {
      const e = new _();
      O$1(t, e, this.setInitialized);
    } catch {
      this.initialized = true;
    }
  }
  async getKeys() {
    return await this.initialize(), this.storage.getKeys();
  }
  async getEntries() {
    return await this.initialize(), this.storage.getEntries();
  }
  async getItem(t) {
    return await this.initialize(), this.storage.getItem(t);
  }
  async setItem(t, e) {
    return await this.initialize(), this.storage.setItem(t, e);
  }
  async removeItem(t) {
    return await this.initialize(), this.storage.removeItem(t);
  }
  async initialize() {
    this.initialized || await new Promise((t) => {
      const e = setInterval(() => {
        this.initialized && (clearInterval(e), t());
      }, 20);
    });
  }
};
var cjs$2 = {};
var heartbeat$2 = {};
var types = {};
var heartbeat$1 = {};
let IEvents$1 = class IEvents {
};
const esm = /* @__PURE__ */ Object.freeze(/* @__PURE__ */ Object.defineProperty({
  __proto__: null,
  IEvents: IEvents$1
}, Symbol.toStringTag, { value: "Module" }));
const require$$0 = /* @__PURE__ */ getAugmentedNamespace(esm);
var hasRequiredHeartbeat$2;
function requireHeartbeat$2() {
  if (hasRequiredHeartbeat$2)
    return heartbeat$1;
  hasRequiredHeartbeat$2 = 1;
  Object.defineProperty(heartbeat$1, "__esModule", { value: true });
  heartbeat$1.IHeartBeat = void 0;
  const events_1 = require$$0;
  class IHeartBeat extends events_1.IEvents {
    constructor(opts) {
      super();
    }
  }
  heartbeat$1.IHeartBeat = IHeartBeat;
  return heartbeat$1;
}
var hasRequiredTypes;
function requireTypes() {
  if (hasRequiredTypes)
    return types;
  hasRequiredTypes = 1;
  (function(exports) {
    Object.defineProperty(exports, "__esModule", { value: true });
    const tslib_1 = require$$0$1;
    tslib_1.__exportStar(requireHeartbeat$2(), exports);
  })(types);
  return types;
}
var constants$1 = {};
var heartbeat = {};
var hasRequiredHeartbeat$1;
function requireHeartbeat$1() {
  if (hasRequiredHeartbeat$1)
    return heartbeat;
  hasRequiredHeartbeat$1 = 1;
  Object.defineProperty(heartbeat, "__esModule", { value: true });
  heartbeat.HEARTBEAT_EVENTS = heartbeat.HEARTBEAT_INTERVAL = void 0;
  const time_1 = cjs$3;
  heartbeat.HEARTBEAT_INTERVAL = time_1.FIVE_SECONDS;
  heartbeat.HEARTBEAT_EVENTS = {
    pulse: "heartbeat_pulse"
  };
  return heartbeat;
}
var hasRequiredConstants$1;
function requireConstants$1() {
  if (hasRequiredConstants$1)
    return constants$1;
  hasRequiredConstants$1 = 1;
  (function(exports) {
    Object.defineProperty(exports, "__esModule", { value: true });
    const tslib_1 = require$$0$1;
    tslib_1.__exportStar(requireHeartbeat$1(), exports);
  })(constants$1);
  return constants$1;
}
var hasRequiredHeartbeat;
function requireHeartbeat() {
  if (hasRequiredHeartbeat)
    return heartbeat$2;
  hasRequiredHeartbeat = 1;
  Object.defineProperty(heartbeat$2, "__esModule", { value: true });
  heartbeat$2.HeartBeat = void 0;
  const tslib_1 = require$$0$1;
  const events_1 = eventsExports;
  const time_1 = cjs$3;
  const types_1 = requireTypes();
  const constants_1 = requireConstants$1();
  class HeartBeat extends types_1.IHeartBeat {
    constructor(opts) {
      super(opts);
      this.events = new events_1.EventEmitter();
      this.interval = constants_1.HEARTBEAT_INTERVAL;
      this.interval = (opts === null || opts === void 0 ? void 0 : opts.interval) || constants_1.HEARTBEAT_INTERVAL;
    }
    static init(opts) {
      return tslib_1.__awaiter(this, void 0, void 0, function* () {
        const heartbeat2 = new HeartBeat(opts);
        yield heartbeat2.init();
        return heartbeat2;
      });
    }
    init() {
      return tslib_1.__awaiter(this, void 0, void 0, function* () {
        yield this.initialize();
      });
    }
    stop() {
      clearInterval(this.intervalRef);
    }
    on(event, listener) {
      this.events.on(event, listener);
    }
    once(event, listener) {
      this.events.once(event, listener);
    }
    off(event, listener) {
      this.events.off(event, listener);
    }
    removeListener(event, listener) {
      this.events.removeListener(event, listener);
    }
    initialize() {
      return tslib_1.__awaiter(this, void 0, void 0, function* () {
        this.intervalRef = setInterval(() => this.pulse(), time_1.toMiliseconds(this.interval));
      });
    }
    pulse() {
      this.events.emit(constants_1.HEARTBEAT_EVENTS.pulse);
    }
  }
  heartbeat$2.HeartBeat = HeartBeat;
  return heartbeat$2;
}
(function(exports) {
  Object.defineProperty(exports, "__esModule", { value: true });
  const tslib_1 = require$$0$1;
  tslib_1.__exportStar(requireHeartbeat(), exports);
  tslib_1.__exportStar(requireTypes(), exports);
  tslib_1.__exportStar(requireConstants$1(), exports);
})(cjs$2);
var cjs$1 = {};
var quickFormatUnescaped;
var hasRequiredQuickFormatUnescaped;
function requireQuickFormatUnescaped() {
  if (hasRequiredQuickFormatUnescaped)
    return quickFormatUnescaped;
  hasRequiredQuickFormatUnescaped = 1;
  function tryStringify(o) {
    try {
      return JSON.stringify(o);
    } catch (e) {
      return '"[Circular]"';
    }
  }
  quickFormatUnescaped = format;
  function format(f2, args, opts) {
    var ss2 = opts && opts.stringify || tryStringify;
    var offset = 1;
    if (typeof f2 === "object" && f2 !== null) {
      var len = args.length + offset;
      if (len === 1)
        return f2;
      var objects = new Array(len);
      objects[0] = ss2(f2);
      for (var index = 1; index < len; index++) {
        objects[index] = ss2(args[index]);
      }
      return objects.join(" ");
    }
    if (typeof f2 !== "string") {
      return f2;
    }
    var argLen = args.length;
    if (argLen === 0)
      return f2;
    var str = "";
    var a3 = 1 - offset;
    var lastPos = -1;
    var flen = f2 && f2.length || 0;
    for (var i = 0; i < flen; ) {
      if (f2.charCodeAt(i) === 37 && i + 1 < flen) {
        lastPos = lastPos > -1 ? lastPos : 0;
        switch (f2.charCodeAt(i + 1)) {
          case 100:
          case 102:
            if (a3 >= argLen)
              break;
            if (args[a3] == null)
              break;
            if (lastPos < i)
              str += f2.slice(lastPos, i);
            str += Number(args[a3]);
            lastPos = i + 2;
            i++;
            break;
          case 105:
            if (a3 >= argLen)
              break;
            if (args[a3] == null)
              break;
            if (lastPos < i)
              str += f2.slice(lastPos, i);
            str += Math.floor(Number(args[a3]));
            lastPos = i + 2;
            i++;
            break;
          case 79:
          case 111:
          case 106:
            if (a3 >= argLen)
              break;
            if (args[a3] === void 0)
              break;
            if (lastPos < i)
              str += f2.slice(lastPos, i);
            var type = typeof args[a3];
            if (type === "string") {
              str += "'" + args[a3] + "'";
              lastPos = i + 2;
              i++;
              break;
            }
            if (type === "function") {
              str += args[a3].name || "<anonymous>";
              lastPos = i + 2;
              i++;
              break;
            }
            str += ss2(args[a3]);
            lastPos = i + 2;
            i++;
            break;
          case 115:
            if (a3 >= argLen)
              break;
            if (lastPos < i)
              str += f2.slice(lastPos, i);
            str += String(args[a3]);
            lastPos = i + 2;
            i++;
            break;
          case 37:
            if (lastPos < i)
              str += f2.slice(lastPos, i);
            str += "%";
            lastPos = i + 2;
            i++;
            a3--;
            break;
        }
        ++a3;
      }
      ++i;
    }
    if (lastPos === -1)
      return f2;
    else if (lastPos < flen) {
      str += f2.slice(lastPos);
    }
    return str;
  }
  return quickFormatUnescaped;
}
var browser;
var hasRequiredBrowser;
function requireBrowser() {
  if (hasRequiredBrowser)
    return browser;
  hasRequiredBrowser = 1;
  const format = requireQuickFormatUnescaped();
  browser = pino;
  const _console = pfGlobalThisOrFallback().console || {};
  const stdSerializers = {
    mapHttpRequest: mock,
    mapHttpResponse: mock,
    wrapRequestSerializer: passthrough,
    wrapResponseSerializer: passthrough,
    wrapErrorSerializer: passthrough,
    req: mock,
    res: mock,
    err: asErrValue
  };
  function shouldSerialize(serialize, serializers) {
    if (Array.isArray(serialize)) {
      const hasToFilter = serialize.filter(function(k2) {
        return k2 !== "!stdSerializers.err";
      });
      return hasToFilter;
    } else if (serialize === true) {
      return Object.keys(serializers);
    }
    return false;
  }
  function pino(opts) {
    opts = opts || {};
    opts.browser = opts.browser || {};
    const transmit2 = opts.browser.transmit;
    if (transmit2 && typeof transmit2.send !== "function") {
      throw Error("pino: transmit option must have a send function");
    }
    const proto = opts.browser.write || _console;
    if (opts.browser.write)
      opts.browser.asObject = true;
    const serializers = opts.serializers || {};
    const serialize = shouldSerialize(opts.browser.serialize, serializers);
    let stdErrSerialize = opts.browser.serialize;
    if (Array.isArray(opts.browser.serialize) && opts.browser.serialize.indexOf("!stdSerializers.err") > -1)
      stdErrSerialize = false;
    const levels = ["error", "fatal", "warn", "info", "debug", "trace"];
    if (typeof proto === "function") {
      proto.error = proto.fatal = proto.warn = proto.info = proto.debug = proto.trace = proto;
    }
    if (opts.enabled === false)
      opts.level = "silent";
    const level = opts.level || "info";
    const logger = Object.create(proto);
    if (!logger.log)
      logger.log = noop;
    Object.defineProperty(logger, "levelVal", {
      get: getLevelVal
    });
    Object.defineProperty(logger, "level", {
      get: getLevel,
      set: setLevel
    });
    const setOpts = {
      transmit: transmit2,
      serialize,
      asObject: opts.browser.asObject,
      levels,
      timestamp: getTimeFunction(opts)
    };
    logger.levels = pino.levels;
    logger.level = level;
    logger.setMaxListeners = logger.getMaxListeners = logger.emit = logger.addListener = logger.on = logger.prependListener = logger.once = logger.prependOnceListener = logger.removeListener = logger.removeAllListeners = logger.listeners = logger.listenerCount = logger.eventNames = logger.write = logger.flush = noop;
    logger.serializers = serializers;
    logger._serialize = serialize;
    logger._stdErrSerialize = stdErrSerialize;
    logger.child = child;
    if (transmit2)
      logger._logEvent = createLogEventShape();
    function getLevelVal() {
      return this.level === "silent" ? Infinity : this.levels.values[this.level];
    }
    function getLevel() {
      return this._level;
    }
    function setLevel(level2) {
      if (level2 !== "silent" && !this.levels.values[level2]) {
        throw Error("unknown level " + level2);
      }
      this._level = level2;
      set2(setOpts, logger, "error", "log");
      set2(setOpts, logger, "fatal", "error");
      set2(setOpts, logger, "warn", "error");
      set2(setOpts, logger, "info", "log");
      set2(setOpts, logger, "debug", "log");
      set2(setOpts, logger, "trace", "log");
    }
    function child(bindings, childOptions) {
      if (!bindings) {
        throw new Error("missing bindings for child Pino");
      }
      childOptions = childOptions || {};
      if (serialize && bindings.serializers) {
        childOptions.serializers = bindings.serializers;
      }
      const childOptionsSerializers = childOptions.serializers;
      if (serialize && childOptionsSerializers) {
        var childSerializers = Object.assign({}, serializers, childOptionsSerializers);
        var childSerialize = opts.browser.serialize === true ? Object.keys(childSerializers) : serialize;
        delete bindings.serializers;
        applySerializers([bindings], childSerialize, childSerializers, this._stdErrSerialize);
      }
      function Child(parent) {
        this._childLevel = (parent._childLevel | 0) + 1;
        this.error = bind(parent, bindings, "error");
        this.fatal = bind(parent, bindings, "fatal");
        this.warn = bind(parent, bindings, "warn");
        this.info = bind(parent, bindings, "info");
        this.debug = bind(parent, bindings, "debug");
        this.trace = bind(parent, bindings, "trace");
        if (childSerializers) {
          this.serializers = childSerializers;
          this._serialize = childSerialize;
        }
        if (transmit2) {
          this._logEvent = createLogEventShape(
            [].concat(parent._logEvent.bindings, bindings)
          );
        }
      }
      Child.prototype = this;
      return new Child(this);
    }
    return logger;
  }
  pino.levels = {
    values: {
      fatal: 60,
      error: 50,
      warn: 40,
      info: 30,
      debug: 20,
      trace: 10
    },
    labels: {
      10: "trace",
      20: "debug",
      30: "info",
      40: "warn",
      50: "error",
      60: "fatal"
    }
  };
  pino.stdSerializers = stdSerializers;
  pino.stdTimeFunctions = Object.assign({}, { nullTime, epochTime, unixTime, isoTime });
  function set2(opts, logger, level, fallback) {
    const proto = Object.getPrototypeOf(logger);
    logger[level] = logger.levelVal > logger.levels.values[level] ? noop : proto[level] ? proto[level] : _console[level] || _console[fallback] || noop;
    wrap(opts, logger, level);
  }
  function wrap(opts, logger, level) {
    if (!opts.transmit && logger[level] === noop)
      return;
    logger[level] = /* @__PURE__ */ function(write) {
      return function LOG() {
        const ts2 = opts.timestamp();
        const args = new Array(arguments.length);
        const proto = Object.getPrototypeOf && Object.getPrototypeOf(this) === _console ? _console : this;
        for (var i = 0; i < args.length; i++)
          args[i] = arguments[i];
        if (opts.serialize && !opts.asObject) {
          applySerializers(args, this._serialize, this.serializers, this._stdErrSerialize);
        }
        if (opts.asObject)
          write.call(proto, asObject(this, level, args, ts2));
        else
          write.apply(proto, args);
        if (opts.transmit) {
          const transmitLevel = opts.transmit.level || logger.level;
          const transmitValue = pino.levels.values[transmitLevel];
          const methodValue = pino.levels.values[level];
          if (methodValue < transmitValue)
            return;
          transmit(this, {
            ts: ts2,
            methodLevel: level,
            methodValue,
            transmitLevel,
            transmitValue: pino.levels.values[opts.transmit.level || logger.level],
            send: opts.transmit.send,
            val: logger.levelVal
          }, args);
        }
      };
    }(logger[level]);
  }
  function asObject(logger, level, args, ts2) {
    if (logger._serialize)
      applySerializers(args, logger._serialize, logger.serializers, logger._stdErrSerialize);
    const argsCloned = args.slice();
    let msg = argsCloned[0];
    const o = {};
    if (ts2) {
      o.time = ts2;
    }
    o.level = pino.levels.values[level];
    let lvl = (logger._childLevel | 0) + 1;
    if (lvl < 1)
      lvl = 1;
    if (msg !== null && typeof msg === "object") {
      while (lvl-- && typeof argsCloned[0] === "object") {
        Object.assign(o, argsCloned.shift());
      }
      msg = argsCloned.length ? format(argsCloned.shift(), argsCloned) : void 0;
    } else if (typeof msg === "string")
      msg = format(argsCloned.shift(), argsCloned);
    if (msg !== void 0)
      o.msg = msg;
    return o;
  }
  function applySerializers(args, serialize, serializers, stdErrSerialize) {
    for (const i in args) {
      if (stdErrSerialize && args[i] instanceof Error) {
        args[i] = pino.stdSerializers.err(args[i]);
      } else if (typeof args[i] === "object" && !Array.isArray(args[i])) {
        for (const k2 in args[i]) {
          if (serialize && serialize.indexOf(k2) > -1 && k2 in serializers) {
            args[i][k2] = serializers[k2](args[i][k2]);
          }
        }
      }
    }
  }
  function bind(parent, bindings, level) {
    return function() {
      const args = new Array(1 + arguments.length);
      args[0] = bindings;
      for (var i = 1; i < args.length; i++) {
        args[i] = arguments[i - 1];
      }
      return parent[level].apply(this, args);
    };
  }
  function transmit(logger, opts, args) {
    const send = opts.send;
    const ts2 = opts.ts;
    const methodLevel = opts.methodLevel;
    const methodValue = opts.methodValue;
    const val = opts.val;
    const bindings = logger._logEvent.bindings;
    applySerializers(
      args,
      logger._serialize || Object.keys(logger.serializers),
      logger.serializers,
      logger._stdErrSerialize === void 0 ? true : logger._stdErrSerialize
    );
    logger._logEvent.ts = ts2;
    logger._logEvent.messages = args.filter(function(arg) {
      return bindings.indexOf(arg) === -1;
    });
    logger._logEvent.level.label = methodLevel;
    logger._logEvent.level.value = methodValue;
    send(methodLevel, logger._logEvent, val);
    logger._logEvent = createLogEventShape(bindings);
  }
  function createLogEventShape(bindings) {
    return {
      ts: 0,
      messages: [],
      bindings: bindings || [],
      level: { label: "", value: 0 }
    };
  }
  function asErrValue(err) {
    const obj = {
      type: err.constructor.name,
      msg: err.message,
      stack: err.stack
    };
    for (const key in err) {
      if (obj[key] === void 0) {
        obj[key] = err[key];
      }
    }
    return obj;
  }
  function getTimeFunction(opts) {
    if (typeof opts.timestamp === "function") {
      return opts.timestamp;
    }
    if (opts.timestamp === false) {
      return nullTime;
    }
    return epochTime;
  }
  function mock() {
    return {};
  }
  function passthrough(a3) {
    return a3;
  }
  function noop() {
  }
  function nullTime() {
    return false;
  }
  function epochTime() {
    return Date.now();
  }
  function unixTime() {
    return Math.round(Date.now() / 1e3);
  }
  function isoTime() {
    return new Date(Date.now()).toISOString();
  }
  function pfGlobalThisOrFallback() {
    function defd(o) {
      return typeof o !== "undefined" && o;
    }
    try {
      if (typeof globalThis !== "undefined")
        return globalThis;
      Object.defineProperty(Object.prototype, "globalThis", {
        get: function() {
          delete Object.prototype.globalThis;
          return this.globalThis = this;
        },
        configurable: true
      });
      return globalThis;
    } catch (e) {
      return defd(self) || defd(window) || defd(this) || {};
    }
  }
  return browser;
}
var constants = {};
var hasRequiredConstants;
function requireConstants() {
  if (hasRequiredConstants)
    return constants;
  hasRequiredConstants = 1;
  Object.defineProperty(constants, "__esModule", { value: true });
  constants.PINO_CUSTOM_CONTEXT_KEY = constants.PINO_LOGGER_DEFAULTS = void 0;
  constants.PINO_LOGGER_DEFAULTS = {
    level: "info"
  };
  constants.PINO_CUSTOM_CONTEXT_KEY = "custom_context";
  return constants;
}
var utils = {};
var hasRequiredUtils;
function requireUtils() {
  if (hasRequiredUtils)
    return utils;
  hasRequiredUtils = 1;
  Object.defineProperty(utils, "__esModule", { value: true });
  utils.generateChildLogger = utils.formatChildLoggerContext = utils.getLoggerContext = utils.setBrowserLoggerContext = utils.getBrowserLoggerContext = utils.getDefaultLoggerOptions = void 0;
  const constants_1 = requireConstants();
  function getDefaultLoggerOptions(opts) {
    return Object.assign(Object.assign({}, opts), { level: (opts === null || opts === void 0 ? void 0 : opts.level) || constants_1.PINO_LOGGER_DEFAULTS.level });
  }
  utils.getDefaultLoggerOptions = getDefaultLoggerOptions;
  function getBrowserLoggerContext(logger, customContextKey = constants_1.PINO_CUSTOM_CONTEXT_KEY) {
    return logger[customContextKey] || "";
  }
  utils.getBrowserLoggerContext = getBrowserLoggerContext;
  function setBrowserLoggerContext(logger, context, customContextKey = constants_1.PINO_CUSTOM_CONTEXT_KEY) {
    logger[customContextKey] = context;
    return logger;
  }
  utils.setBrowserLoggerContext = setBrowserLoggerContext;
  function getLoggerContext(logger, customContextKey = constants_1.PINO_CUSTOM_CONTEXT_KEY) {
    let context = "";
    if (typeof logger.bindings === "undefined") {
      context = getBrowserLoggerContext(logger, customContextKey);
    } else {
      context = logger.bindings().context || "";
    }
    return context;
  }
  utils.getLoggerContext = getLoggerContext;
  function formatChildLoggerContext(logger, childContext, customContextKey = constants_1.PINO_CUSTOM_CONTEXT_KEY) {
    const parentContext = getLoggerContext(logger, customContextKey);
    const context = parentContext.trim() ? `${parentContext}/${childContext}` : childContext;
    return context;
  }
  utils.formatChildLoggerContext = formatChildLoggerContext;
  function generateChildLogger(logger, childContext, customContextKey = constants_1.PINO_CUSTOM_CONTEXT_KEY) {
    const context = formatChildLoggerContext(logger, childContext, customContextKey);
    const child = logger.child({ context });
    return setBrowserLoggerContext(child, context, customContextKey);
  }
  utils.generateChildLogger = generateChildLogger;
  return utils;
}
(function(exports) {
  Object.defineProperty(exports, "__esModule", { value: true });
  exports.pino = void 0;
  const tslib_1 = require$$0$1;
  const pino_1 = tslib_1.__importDefault(requireBrowser());
  Object.defineProperty(exports, "pino", { enumerable: true, get: function() {
    return pino_1.default;
  } });
  tslib_1.__exportStar(requireConstants(), exports);
  tslib_1.__exportStar(requireUtils(), exports);
})(cjs$1);
class n extends IEvents$1 {
  constructor(s) {
    super(), this.opts = s, this.protocol = "wc", this.version = 2;
  }
}
let h$1 = class h2 extends IEvents$1 {
  constructor(s, t) {
    super(), this.core = s, this.logger = t, this.records = /* @__PURE__ */ new Map();
  }
};
let a$1 = class a {
  constructor(s, t) {
    this.logger = s, this.core = t;
  }
};
class u extends IEvents$1 {
  constructor(s, t) {
    super(), this.relayer = s, this.logger = t;
  }
}
let g$1 = class g extends IEvents$1 {
  constructor(s) {
    super();
  }
};
class p {
  constructor(s, t, o, w2) {
    this.core = s, this.logger = t, this.name = o;
  }
}
class d extends IEvents$1 {
  constructor(s, t) {
    super(), this.relayer = s, this.logger = t;
  }
}
class E extends IEvents$1 {
  constructor(s, t) {
    super(), this.core = s, this.logger = t;
  }
}
class y {
  constructor(s, t) {
    this.projectId = s, this.logger = t;
  }
}
let b$1 = class b {
  constructor(s) {
    this.opts = s, this.protocol = "wc", this.version = 2;
  }
};
let S$1 = class S {
  constructor(s) {
    this.client = s;
  }
};
var ed25519 = {};
var sha512 = {};
(function(exports) {
  Object.defineProperty(exports, "__esModule", { value: true });
  var binary_1 = binary;
  var wipe_1 = wipe;
  exports.DIGEST_LENGTH = 64;
  exports.BLOCK_SIZE = 128;
  var SHA512 = (
    /** @class */
    function() {
      function SHA5122() {
        this.digestLength = exports.DIGEST_LENGTH;
        this.blockSize = exports.BLOCK_SIZE;
        this._stateHi = new Int32Array(8);
        this._stateLo = new Int32Array(8);
        this._tempHi = new Int32Array(16);
        this._tempLo = new Int32Array(16);
        this._buffer = new Uint8Array(256);
        this._bufferLength = 0;
        this._bytesHashed = 0;
        this._finished = false;
        this.reset();
      }
      SHA5122.prototype._initState = function() {
        this._stateHi[0] = 1779033703;
        this._stateHi[1] = 3144134277;
        this._stateHi[2] = 1013904242;
        this._stateHi[3] = 2773480762;
        this._stateHi[4] = 1359893119;
        this._stateHi[5] = 2600822924;
        this._stateHi[6] = 528734635;
        this._stateHi[7] = 1541459225;
        this._stateLo[0] = 4089235720;
        this._stateLo[1] = 2227873595;
        this._stateLo[2] = 4271175723;
        this._stateLo[3] = 1595750129;
        this._stateLo[4] = 2917565137;
        this._stateLo[5] = 725511199;
        this._stateLo[6] = 4215389547;
        this._stateLo[7] = 327033209;
      };
      SHA5122.prototype.reset = function() {
        this._initState();
        this._bufferLength = 0;
        this._bytesHashed = 0;
        this._finished = false;
        return this;
      };
      SHA5122.prototype.clean = function() {
        wipe_1.wipe(this._buffer);
        wipe_1.wipe(this._tempHi);
        wipe_1.wipe(this._tempLo);
        this.reset();
      };
      SHA5122.prototype.update = function(data, dataLength) {
        if (dataLength === void 0) {
          dataLength = data.length;
        }
        if (this._finished) {
          throw new Error("SHA512: can't update because hash was finished.");
        }
        var dataPos = 0;
        this._bytesHashed += dataLength;
        if (this._bufferLength > 0) {
          while (this._bufferLength < exports.BLOCK_SIZE && dataLength > 0) {
            this._buffer[this._bufferLength++] = data[dataPos++];
            dataLength--;
          }
          if (this._bufferLength === this.blockSize) {
            hashBlocks(this._tempHi, this._tempLo, this._stateHi, this._stateLo, this._buffer, 0, this.blockSize);
            this._bufferLength = 0;
          }
        }
        if (dataLength >= this.blockSize) {
          dataPos = hashBlocks(this._tempHi, this._tempLo, this._stateHi, this._stateLo, data, dataPos, dataLength);
          dataLength %= this.blockSize;
        }
        while (dataLength > 0) {
          this._buffer[this._bufferLength++] = data[dataPos++];
          dataLength--;
        }
        return this;
      };
      SHA5122.prototype.finish = function(out) {
        if (!this._finished) {
          var bytesHashed = this._bytesHashed;
          var left = this._bufferLength;
          var bitLenHi = bytesHashed / 536870912 | 0;
          var bitLenLo = bytesHashed << 3;
          var padLength = bytesHashed % 128 < 112 ? 128 : 256;
          this._buffer[left] = 128;
          for (var i = left + 1; i < padLength - 8; i++) {
            this._buffer[i] = 0;
          }
          binary_1.writeUint32BE(bitLenHi, this._buffer, padLength - 8);
          binary_1.writeUint32BE(bitLenLo, this._buffer, padLength - 4);
          hashBlocks(this._tempHi, this._tempLo, this._stateHi, this._stateLo, this._buffer, 0, padLength);
          this._finished = true;
        }
        for (var i = 0; i < this.digestLength / 8; i++) {
          binary_1.writeUint32BE(this._stateHi[i], out, i * 8);
          binary_1.writeUint32BE(this._stateLo[i], out, i * 8 + 4);
        }
        return this;
      };
      SHA5122.prototype.digest = function() {
        var out = new Uint8Array(this.digestLength);
        this.finish(out);
        return out;
      };
      SHA5122.prototype.saveState = function() {
        if (this._finished) {
          throw new Error("SHA256: cannot save finished state");
        }
        return {
          stateHi: new Int32Array(this._stateHi),
          stateLo: new Int32Array(this._stateLo),
          buffer: this._bufferLength > 0 ? new Uint8Array(this._buffer) : void 0,
          bufferLength: this._bufferLength,
          bytesHashed: this._bytesHashed
        };
      };
      SHA5122.prototype.restoreState = function(savedState) {
        this._stateHi.set(savedState.stateHi);
        this._stateLo.set(savedState.stateLo);
        this._bufferLength = savedState.bufferLength;
        if (savedState.buffer) {
          this._buffer.set(savedState.buffer);
        }
        this._bytesHashed = savedState.bytesHashed;
        this._finished = false;
        return this;
      };
      SHA5122.prototype.cleanSavedState = function(savedState) {
        wipe_1.wipe(savedState.stateHi);
        wipe_1.wipe(savedState.stateLo);
        if (savedState.buffer) {
          wipe_1.wipe(savedState.buffer);
        }
        savedState.bufferLength = 0;
        savedState.bytesHashed = 0;
      };
      return SHA5122;
    }()
  );
  exports.SHA512 = SHA512;
  var K2 = new Int32Array([
    1116352408,
    3609767458,
    1899447441,
    602891725,
    3049323471,
    3964484399,
    3921009573,
    2173295548,
    961987163,
    4081628472,
    1508970993,
    3053834265,
    2453635748,
    2937671579,
    2870763221,
    3664609560,
    3624381080,
    2734883394,
    310598401,
    1164996542,
    607225278,
    1323610764,
    1426881987,
    3590304994,
    1925078388,
    4068182383,
    2162078206,
    991336113,
    2614888103,
    633803317,
    3248222580,
    3479774868,
    3835390401,
    2666613458,
    4022224774,
    944711139,
    264347078,
    2341262773,
    604807628,
    2007800933,
    770255983,
    1495990901,
    1249150122,
    1856431235,
    1555081692,
    3175218132,
    1996064986,
    2198950837,
    2554220882,
    3999719339,
    2821834349,
    766784016,
    2952996808,
    2566594879,
    3210313671,
    3203337956,
    3336571891,
    1034457026,
    3584528711,
    2466948901,
    113926993,
    3758326383,
    338241895,
    168717936,
    666307205,
    1188179964,
    773529912,
    1546045734,
    1294757372,
    1522805485,
    1396182291,
    2643833823,
    1695183700,
    2343527390,
    1986661051,
    1014477480,
    2177026350,
    1206759142,
    2456956037,
    344077627,
    2730485921,
    1290863460,
    2820302411,
    3158454273,
    3259730800,
    3505952657,
    3345764771,
    106217008,
    3516065817,
    3606008344,
    3600352804,
    1432725776,
    4094571909,
    1467031594,
    275423344,
    851169720,
    430227734,
    3100823752,
    506948616,
    1363258195,
    659060556,
    3750685593,
    883997877,
    3785050280,
    958139571,
    3318307427,
    1322822218,
    3812723403,
    1537002063,
    2003034995,
    1747873779,
    3602036899,
    1955562222,
    1575990012,
    2024104815,
    1125592928,
    2227730452,
    2716904306,
    2361852424,
    442776044,
    2428436474,
    593698344,
    2756734187,
    3733110249,
    3204031479,
    2999351573,
    3329325298,
    3815920427,
    3391569614,
    3928383900,
    3515267271,
    566280711,
    3940187606,
    3454069534,
    4118630271,
    4000239992,
    116418474,
    1914138554,
    174292421,
    2731055270,
    289380356,
    3203993006,
    460393269,
    320620315,
    685471733,
    587496836,
    852142971,
    1086792851,
    1017036298,
    365543100,
    1126000580,
    2618297676,
    1288033470,
    3409855158,
    1501505948,
    4234509866,
    1607167915,
    987167468,
    1816402316,
    1246189591
  ]);
  function hashBlocks(wh, wl, hh, hl, m, pos, len) {
    var ah0 = hh[0], ah1 = hh[1], ah2 = hh[2], ah3 = hh[3], ah4 = hh[4], ah5 = hh[5], ah6 = hh[6], ah7 = hh[7], al0 = hl[0], al1 = hl[1], al2 = hl[2], al3 = hl[3], al4 = hl[4], al5 = hl[5], al6 = hl[6], al7 = hl[7];
    var h4, l2;
    var th, tl;
    var a3, b3, c2, d2;
    while (len >= 128) {
      for (var i = 0; i < 16; i++) {
        var j2 = 8 * i + pos;
        wh[i] = binary_1.readUint32BE(m, j2);
        wl[i] = binary_1.readUint32BE(m, j2 + 4);
      }
      for (var i = 0; i < 80; i++) {
        var bh0 = ah0;
        var bh1 = ah1;
        var bh2 = ah2;
        var bh3 = ah3;
        var bh4 = ah4;
        var bh5 = ah5;
        var bh6 = ah6;
        var bh7 = ah7;
        var bl0 = al0;
        var bl1 = al1;
        var bl2 = al2;
        var bl3 = al3;
        var bl4 = al4;
        var bl5 = al5;
        var bl6 = al6;
        var bl7 = al7;
        h4 = ah7;
        l2 = al7;
        a3 = l2 & 65535;
        b3 = l2 >>> 16;
        c2 = h4 & 65535;
        d2 = h4 >>> 16;
        h4 = (ah4 >>> 14 | al4 << 32 - 14) ^ (ah4 >>> 18 | al4 << 32 - 18) ^ (al4 >>> 41 - 32 | ah4 << 32 - (41 - 32));
        l2 = (al4 >>> 14 | ah4 << 32 - 14) ^ (al4 >>> 18 | ah4 << 32 - 18) ^ (ah4 >>> 41 - 32 | al4 << 32 - (41 - 32));
        a3 += l2 & 65535;
        b3 += l2 >>> 16;
        c2 += h4 & 65535;
        d2 += h4 >>> 16;
        h4 = ah4 & ah5 ^ ~ah4 & ah6;
        l2 = al4 & al5 ^ ~al4 & al6;
        a3 += l2 & 65535;
        b3 += l2 >>> 16;
        c2 += h4 & 65535;
        d2 += h4 >>> 16;
        h4 = K2[i * 2];
        l2 = K2[i * 2 + 1];
        a3 += l2 & 65535;
        b3 += l2 >>> 16;
        c2 += h4 & 65535;
        d2 += h4 >>> 16;
        h4 = wh[i % 16];
        l2 = wl[i % 16];
        a3 += l2 & 65535;
        b3 += l2 >>> 16;
        c2 += h4 & 65535;
        d2 += h4 >>> 16;
        b3 += a3 >>> 16;
        c2 += b3 >>> 16;
        d2 += c2 >>> 16;
        th = c2 & 65535 | d2 << 16;
        tl = a3 & 65535 | b3 << 16;
        h4 = th;
        l2 = tl;
        a3 = l2 & 65535;
        b3 = l2 >>> 16;
        c2 = h4 & 65535;
        d2 = h4 >>> 16;
        h4 = (ah0 >>> 28 | al0 << 32 - 28) ^ (al0 >>> 34 - 32 | ah0 << 32 - (34 - 32)) ^ (al0 >>> 39 - 32 | ah0 << 32 - (39 - 32));
        l2 = (al0 >>> 28 | ah0 << 32 - 28) ^ (ah0 >>> 34 - 32 | al0 << 32 - (34 - 32)) ^ (ah0 >>> 39 - 32 | al0 << 32 - (39 - 32));
        a3 += l2 & 65535;
        b3 += l2 >>> 16;
        c2 += h4 & 65535;
        d2 += h4 >>> 16;
        h4 = ah0 & ah1 ^ ah0 & ah2 ^ ah1 & ah2;
        l2 = al0 & al1 ^ al0 & al2 ^ al1 & al2;
        a3 += l2 & 65535;
        b3 += l2 >>> 16;
        c2 += h4 & 65535;
        d2 += h4 >>> 16;
        b3 += a3 >>> 16;
        c2 += b3 >>> 16;
        d2 += c2 >>> 16;
        bh7 = c2 & 65535 | d2 << 16;
        bl7 = a3 & 65535 | b3 << 16;
        h4 = bh3;
        l2 = bl3;
        a3 = l2 & 65535;
        b3 = l2 >>> 16;
        c2 = h4 & 65535;
        d2 = h4 >>> 16;
        h4 = th;
        l2 = tl;
        a3 += l2 & 65535;
        b3 += l2 >>> 16;
        c2 += h4 & 65535;
        d2 += h4 >>> 16;
        b3 += a3 >>> 16;
        c2 += b3 >>> 16;
        d2 += c2 >>> 16;
        bh3 = c2 & 65535 | d2 << 16;
        bl3 = a3 & 65535 | b3 << 16;
        ah1 = bh0;
        ah2 = bh1;
        ah3 = bh2;
        ah4 = bh3;
        ah5 = bh4;
        ah6 = bh5;
        ah7 = bh6;
        ah0 = bh7;
        al1 = bl0;
        al2 = bl1;
        al3 = bl2;
        al4 = bl3;
        al5 = bl4;
        al6 = bl5;
        al7 = bl6;
        al0 = bl7;
        if (i % 16 === 15) {
          for (var j2 = 0; j2 < 16; j2++) {
            h4 = wh[j2];
            l2 = wl[j2];
            a3 = l2 & 65535;
            b3 = l2 >>> 16;
            c2 = h4 & 65535;
            d2 = h4 >>> 16;
            h4 = wh[(j2 + 9) % 16];
            l2 = wl[(j2 + 9) % 16];
            a3 += l2 & 65535;
            b3 += l2 >>> 16;
            c2 += h4 & 65535;
            d2 += h4 >>> 16;
            th = wh[(j2 + 1) % 16];
            tl = wl[(j2 + 1) % 16];
            h4 = (th >>> 1 | tl << 32 - 1) ^ (th >>> 8 | tl << 32 - 8) ^ th >>> 7;
            l2 = (tl >>> 1 | th << 32 - 1) ^ (tl >>> 8 | th << 32 - 8) ^ (tl >>> 7 | th << 32 - 7);
            a3 += l2 & 65535;
            b3 += l2 >>> 16;
            c2 += h4 & 65535;
            d2 += h4 >>> 16;
            th = wh[(j2 + 14) % 16];
            tl = wl[(j2 + 14) % 16];
            h4 = (th >>> 19 | tl << 32 - 19) ^ (tl >>> 61 - 32 | th << 32 - (61 - 32)) ^ th >>> 6;
            l2 = (tl >>> 19 | th << 32 - 19) ^ (th >>> 61 - 32 | tl << 32 - (61 - 32)) ^ (tl >>> 6 | th << 32 - 6);
            a3 += l2 & 65535;
            b3 += l2 >>> 16;
            c2 += h4 & 65535;
            d2 += h4 >>> 16;
            b3 += a3 >>> 16;
            c2 += b3 >>> 16;
            d2 += c2 >>> 16;
            wh[j2] = c2 & 65535 | d2 << 16;
            wl[j2] = a3 & 65535 | b3 << 16;
          }
        }
      }
      h4 = ah0;
      l2 = al0;
      a3 = l2 & 65535;
      b3 = l2 >>> 16;
      c2 = h4 & 65535;
      d2 = h4 >>> 16;
      h4 = hh[0];
      l2 = hl[0];
      a3 += l2 & 65535;
      b3 += l2 >>> 16;
      c2 += h4 & 65535;
      d2 += h4 >>> 16;
      b3 += a3 >>> 16;
      c2 += b3 >>> 16;
      d2 += c2 >>> 16;
      hh[0] = ah0 = c2 & 65535 | d2 << 16;
      hl[0] = al0 = a3 & 65535 | b3 << 16;
      h4 = ah1;
      l2 = al1;
      a3 = l2 & 65535;
      b3 = l2 >>> 16;
      c2 = h4 & 65535;
      d2 = h4 >>> 16;
      h4 = hh[1];
      l2 = hl[1];
      a3 += l2 & 65535;
      b3 += l2 >>> 16;
      c2 += h4 & 65535;
      d2 += h4 >>> 16;
      b3 += a3 >>> 16;
      c2 += b3 >>> 16;
      d2 += c2 >>> 16;
      hh[1] = ah1 = c2 & 65535 | d2 << 16;
      hl[1] = al1 = a3 & 65535 | b3 << 16;
      h4 = ah2;
      l2 = al2;
      a3 = l2 & 65535;
      b3 = l2 >>> 16;
      c2 = h4 & 65535;
      d2 = h4 >>> 16;
      h4 = hh[2];
      l2 = hl[2];
      a3 += l2 & 65535;
      b3 += l2 >>> 16;
      c2 += h4 & 65535;
      d2 += h4 >>> 16;
      b3 += a3 >>> 16;
      c2 += b3 >>> 16;
      d2 += c2 >>> 16;
      hh[2] = ah2 = c2 & 65535 | d2 << 16;
      hl[2] = al2 = a3 & 65535 | b3 << 16;
      h4 = ah3;
      l2 = al3;
      a3 = l2 & 65535;
      b3 = l2 >>> 16;
      c2 = h4 & 65535;
      d2 = h4 >>> 16;
      h4 = hh[3];
      l2 = hl[3];
      a3 += l2 & 65535;
      b3 += l2 >>> 16;
      c2 += h4 & 65535;
      d2 += h4 >>> 16;
      b3 += a3 >>> 16;
      c2 += b3 >>> 16;
      d2 += c2 >>> 16;
      hh[3] = ah3 = c2 & 65535 | d2 << 16;
      hl[3] = al3 = a3 & 65535 | b3 << 16;
      h4 = ah4;
      l2 = al4;
      a3 = l2 & 65535;
      b3 = l2 >>> 16;
      c2 = h4 & 65535;
      d2 = h4 >>> 16;
      h4 = hh[4];
      l2 = hl[4];
      a3 += l2 & 65535;
      b3 += l2 >>> 16;
      c2 += h4 & 65535;
      d2 += h4 >>> 16;
      b3 += a3 >>> 16;
      c2 += b3 >>> 16;
      d2 += c2 >>> 16;
      hh[4] = ah4 = c2 & 65535 | d2 << 16;
      hl[4] = al4 = a3 & 65535 | b3 << 16;
      h4 = ah5;
      l2 = al5;
      a3 = l2 & 65535;
      b3 = l2 >>> 16;
      c2 = h4 & 65535;
      d2 = h4 >>> 16;
      h4 = hh[5];
      l2 = hl[5];
      a3 += l2 & 65535;
      b3 += l2 >>> 16;
      c2 += h4 & 65535;
      d2 += h4 >>> 16;
      b3 += a3 >>> 16;
      c2 += b3 >>> 16;
      d2 += c2 >>> 16;
      hh[5] = ah5 = c2 & 65535 | d2 << 16;
      hl[5] = al5 = a3 & 65535 | b3 << 16;
      h4 = ah6;
      l2 = al6;
      a3 = l2 & 65535;
      b3 = l2 >>> 16;
      c2 = h4 & 65535;
      d2 = h4 >>> 16;
      h4 = hh[6];
      l2 = hl[6];
      a3 += l2 & 65535;
      b3 += l2 >>> 16;
      c2 += h4 & 65535;
      d2 += h4 >>> 16;
      b3 += a3 >>> 16;
      c2 += b3 >>> 16;
      d2 += c2 >>> 16;
      hh[6] = ah6 = c2 & 65535 | d2 << 16;
      hl[6] = al6 = a3 & 65535 | b3 << 16;
      h4 = ah7;
      l2 = al7;
      a3 = l2 & 65535;
      b3 = l2 >>> 16;
      c2 = h4 & 65535;
      d2 = h4 >>> 16;
      h4 = hh[7];
      l2 = hl[7];
      a3 += l2 & 65535;
      b3 += l2 >>> 16;
      c2 += h4 & 65535;
      d2 += h4 >>> 16;
      b3 += a3 >>> 16;
      c2 += b3 >>> 16;
      d2 += c2 >>> 16;
      hh[7] = ah7 = c2 & 65535 | d2 << 16;
      hl[7] = al7 = a3 & 65535 | b3 << 16;
      pos += 128;
      len -= 128;
    }
    return pos;
  }
  function hash(data) {
    var h4 = new SHA512();
    h4.update(data);
    var digest = h4.digest();
    h4.clean();
    return digest;
  }
  exports.hash = hash;
})(sha512);
(function(exports) {
  Object.defineProperty(exports, "__esModule", { value: true });
  exports.convertSecretKeyToX25519 = exports.convertPublicKeyToX25519 = exports.verify = exports.sign = exports.extractPublicKeyFromSecretKey = exports.generateKeyPair = exports.generateKeyPairFromSeed = exports.SEED_LENGTH = exports.SECRET_KEY_LENGTH = exports.PUBLIC_KEY_LENGTH = exports.SIGNATURE_LENGTH = void 0;
  const random_1 = random;
  const sha512_1 = sha512;
  const wipe_1 = wipe;
  exports.SIGNATURE_LENGTH = 64;
  exports.PUBLIC_KEY_LENGTH = 32;
  exports.SECRET_KEY_LENGTH = 64;
  exports.SEED_LENGTH = 32;
  function gf(init) {
    const r = new Float64Array(16);
    if (init) {
      for (let i = 0; i < init.length; i++) {
        r[i] = init[i];
      }
    }
    return r;
  }
  const _9 = new Uint8Array(32);
  _9[0] = 9;
  const gf0 = gf();
  const gf1 = gf([1]);
  const D2 = gf([
    30883,
    4953,
    19914,
    30187,
    55467,
    16705,
    2637,
    112,
    59544,
    30585,
    16505,
    36039,
    65139,
    11119,
    27886,
    20995
  ]);
  const D22 = gf([
    61785,
    9906,
    39828,
    60374,
    45398,
    33411,
    5274,
    224,
    53552,
    61171,
    33010,
    6542,
    64743,
    22239,
    55772,
    9222
  ]);
  const X2 = gf([
    54554,
    36645,
    11616,
    51542,
    42930,
    38181,
    51040,
    26924,
    56412,
    64982,
    57905,
    49316,
    21502,
    52590,
    14035,
    8553
  ]);
  const Y = gf([
    26200,
    26214,
    26214,
    26214,
    26214,
    26214,
    26214,
    26214,
    26214,
    26214,
    26214,
    26214,
    26214,
    26214,
    26214,
    26214
  ]);
  const I = gf([
    41136,
    18958,
    6951,
    50414,
    58488,
    44335,
    6150,
    12099,
    55207,
    15867,
    153,
    11085,
    57099,
    20417,
    9344,
    11139
  ]);
  function set25519(r, a3) {
    for (let i = 0; i < 16; i++) {
      r[i] = a3[i] | 0;
    }
  }
  function car25519(o) {
    let c2 = 1;
    for (let i = 0; i < 16; i++) {
      let v2 = o[i] + c2 + 65535;
      c2 = Math.floor(v2 / 65536);
      o[i] = v2 - c2 * 65536;
    }
    o[0] += c2 - 1 + 37 * (c2 - 1);
  }
  function sel25519(p2, q2, b3) {
    const c2 = ~(b3 - 1);
    for (let i = 0; i < 16; i++) {
      const t = c2 & (p2[i] ^ q2[i]);
      p2[i] ^= t;
      q2[i] ^= t;
    }
  }
  function pack25519(o, n2) {
    const m = gf();
    const t = gf();
    for (let i = 0; i < 16; i++) {
      t[i] = n2[i];
    }
    car25519(t);
    car25519(t);
    car25519(t);
    for (let j2 = 0; j2 < 2; j2++) {
      m[0] = t[0] - 65517;
      for (let i = 1; i < 15; i++) {
        m[i] = t[i] - 65535 - (m[i - 1] >> 16 & 1);
        m[i - 1] &= 65535;
      }
      m[15] = t[15] - 32767 - (m[14] >> 16 & 1);
      const b3 = m[15] >> 16 & 1;
      m[14] &= 65535;
      sel25519(t, m, 1 - b3);
    }
    for (let i = 0; i < 16; i++) {
      o[2 * i] = t[i] & 255;
      o[2 * i + 1] = t[i] >> 8;
    }
  }
  function verify32(x2, y2) {
    let d2 = 0;
    for (let i = 0; i < 32; i++) {
      d2 |= x2[i] ^ y2[i];
    }
    return (1 & d2 - 1 >>> 8) - 1;
  }
  function neq25519(a3, b3) {
    const c2 = new Uint8Array(32);
    const d2 = new Uint8Array(32);
    pack25519(c2, a3);
    pack25519(d2, b3);
    return verify32(c2, d2);
  }
  function par25519(a3) {
    const d2 = new Uint8Array(32);
    pack25519(d2, a3);
    return d2[0] & 1;
  }
  function unpack25519(o, n2) {
    for (let i = 0; i < 16; i++) {
      o[i] = n2[2 * i] + (n2[2 * i + 1] << 8);
    }
    o[15] &= 32767;
  }
  function add(o, a3, b3) {
    for (let i = 0; i < 16; i++) {
      o[i] = a3[i] + b3[i];
    }
  }
  function sub(o, a3, b3) {
    for (let i = 0; i < 16; i++) {
      o[i] = a3[i] - b3[i];
    }
  }
  function mul(o, a3, b3) {
    let v2, c2, t0 = 0, t1 = 0, t2 = 0, t3 = 0, t4 = 0, t5 = 0, t6 = 0, t7 = 0, t8 = 0, t9 = 0, t10 = 0, t11 = 0, t12 = 0, t13 = 0, t14 = 0, t15 = 0, t16 = 0, t17 = 0, t18 = 0, t19 = 0, t20 = 0, t21 = 0, t22 = 0, t23 = 0, t24 = 0, t25 = 0, t26 = 0, t27 = 0, t28 = 0, t29 = 0, t30 = 0, b0 = b3[0], b1 = b3[1], b22 = b3[2], b32 = b3[3], b4 = b3[4], b5 = b3[5], b6 = b3[6], b7 = b3[7], b8 = b3[8], b9 = b3[9], b10 = b3[10], b11 = b3[11], b12 = b3[12], b13 = b3[13], b14 = b3[14], b15 = b3[15];
    v2 = a3[0];
    t0 += v2 * b0;
    t1 += v2 * b1;
    t2 += v2 * b22;
    t3 += v2 * b32;
    t4 += v2 * b4;
    t5 += v2 * b5;
    t6 += v2 * b6;
    t7 += v2 * b7;
    t8 += v2 * b8;
    t9 += v2 * b9;
    t10 += v2 * b10;
    t11 += v2 * b11;
    t12 += v2 * b12;
    t13 += v2 * b13;
    t14 += v2 * b14;
    t15 += v2 * b15;
    v2 = a3[1];
    t1 += v2 * b0;
    t2 += v2 * b1;
    t3 += v2 * b22;
    t4 += v2 * b32;
    t5 += v2 * b4;
    t6 += v2 * b5;
    t7 += v2 * b6;
    t8 += v2 * b7;
    t9 += v2 * b8;
    t10 += v2 * b9;
    t11 += v2 * b10;
    t12 += v2 * b11;
    t13 += v2 * b12;
    t14 += v2 * b13;
    t15 += v2 * b14;
    t16 += v2 * b15;
    v2 = a3[2];
    t2 += v2 * b0;
    t3 += v2 * b1;
    t4 += v2 * b22;
    t5 += v2 * b32;
    t6 += v2 * b4;
    t7 += v2 * b5;
    t8 += v2 * b6;
    t9 += v2 * b7;
    t10 += v2 * b8;
    t11 += v2 * b9;
    t12 += v2 * b10;
    t13 += v2 * b11;
    t14 += v2 * b12;
    t15 += v2 * b13;
    t16 += v2 * b14;
    t17 += v2 * b15;
    v2 = a3[3];
    t3 += v2 * b0;
    t4 += v2 * b1;
    t5 += v2 * b22;
    t6 += v2 * b32;
    t7 += v2 * b4;
    t8 += v2 * b5;
    t9 += v2 * b6;
    t10 += v2 * b7;
    t11 += v2 * b8;
    t12 += v2 * b9;
    t13 += v2 * b10;
    t14 += v2 * b11;
    t15 += v2 * b12;
    t16 += v2 * b13;
    t17 += v2 * b14;
    t18 += v2 * b15;
    v2 = a3[4];
    t4 += v2 * b0;
    t5 += v2 * b1;
    t6 += v2 * b22;
    t7 += v2 * b32;
    t8 += v2 * b4;
    t9 += v2 * b5;
    t10 += v2 * b6;
    t11 += v2 * b7;
    t12 += v2 * b8;
    t13 += v2 * b9;
    t14 += v2 * b10;
    t15 += v2 * b11;
    t16 += v2 * b12;
    t17 += v2 * b13;
    t18 += v2 * b14;
    t19 += v2 * b15;
    v2 = a3[5];
    t5 += v2 * b0;
    t6 += v2 * b1;
    t7 += v2 * b22;
    t8 += v2 * b32;
    t9 += v2 * b4;
    t10 += v2 * b5;
    t11 += v2 * b6;
    t12 += v2 * b7;
    t13 += v2 * b8;
    t14 += v2 * b9;
    t15 += v2 * b10;
    t16 += v2 * b11;
    t17 += v2 * b12;
    t18 += v2 * b13;
    t19 += v2 * b14;
    t20 += v2 * b15;
    v2 = a3[6];
    t6 += v2 * b0;
    t7 += v2 * b1;
    t8 += v2 * b22;
    t9 += v2 * b32;
    t10 += v2 * b4;
    t11 += v2 * b5;
    t12 += v2 * b6;
    t13 += v2 * b7;
    t14 += v2 * b8;
    t15 += v2 * b9;
    t16 += v2 * b10;
    t17 += v2 * b11;
    t18 += v2 * b12;
    t19 += v2 * b13;
    t20 += v2 * b14;
    t21 += v2 * b15;
    v2 = a3[7];
    t7 += v2 * b0;
    t8 += v2 * b1;
    t9 += v2 * b22;
    t10 += v2 * b32;
    t11 += v2 * b4;
    t12 += v2 * b5;
    t13 += v2 * b6;
    t14 += v2 * b7;
    t15 += v2 * b8;
    t16 += v2 * b9;
    t17 += v2 * b10;
    t18 += v2 * b11;
    t19 += v2 * b12;
    t20 += v2 * b13;
    t21 += v2 * b14;
    t22 += v2 * b15;
    v2 = a3[8];
    t8 += v2 * b0;
    t9 += v2 * b1;
    t10 += v2 * b22;
    t11 += v2 * b32;
    t12 += v2 * b4;
    t13 += v2 * b5;
    t14 += v2 * b6;
    t15 += v2 * b7;
    t16 += v2 * b8;
    t17 += v2 * b9;
    t18 += v2 * b10;
    t19 += v2 * b11;
    t20 += v2 * b12;
    t21 += v2 * b13;
    t22 += v2 * b14;
    t23 += v2 * b15;
    v2 = a3[9];
    t9 += v2 * b0;
    t10 += v2 * b1;
    t11 += v2 * b22;
    t12 += v2 * b32;
    t13 += v2 * b4;
    t14 += v2 * b5;
    t15 += v2 * b6;
    t16 += v2 * b7;
    t17 += v2 * b8;
    t18 += v2 * b9;
    t19 += v2 * b10;
    t20 += v2 * b11;
    t21 += v2 * b12;
    t22 += v2 * b13;
    t23 += v2 * b14;
    t24 += v2 * b15;
    v2 = a3[10];
    t10 += v2 * b0;
    t11 += v2 * b1;
    t12 += v2 * b22;
    t13 += v2 * b32;
    t14 += v2 * b4;
    t15 += v2 * b5;
    t16 += v2 * b6;
    t17 += v2 * b7;
    t18 += v2 * b8;
    t19 += v2 * b9;
    t20 += v2 * b10;
    t21 += v2 * b11;
    t22 += v2 * b12;
    t23 += v2 * b13;
    t24 += v2 * b14;
    t25 += v2 * b15;
    v2 = a3[11];
    t11 += v2 * b0;
    t12 += v2 * b1;
    t13 += v2 * b22;
    t14 += v2 * b32;
    t15 += v2 * b4;
    t16 += v2 * b5;
    t17 += v2 * b6;
    t18 += v2 * b7;
    t19 += v2 * b8;
    t20 += v2 * b9;
    t21 += v2 * b10;
    t22 += v2 * b11;
    t23 += v2 * b12;
    t24 += v2 * b13;
    t25 += v2 * b14;
    t26 += v2 * b15;
    v2 = a3[12];
    t12 += v2 * b0;
    t13 += v2 * b1;
    t14 += v2 * b22;
    t15 += v2 * b32;
    t16 += v2 * b4;
    t17 += v2 * b5;
    t18 += v2 * b6;
    t19 += v2 * b7;
    t20 += v2 * b8;
    t21 += v2 * b9;
    t22 += v2 * b10;
    t23 += v2 * b11;
    t24 += v2 * b12;
    t25 += v2 * b13;
    t26 += v2 * b14;
    t27 += v2 * b15;
    v2 = a3[13];
    t13 += v2 * b0;
    t14 += v2 * b1;
    t15 += v2 * b22;
    t16 += v2 * b32;
    t17 += v2 * b4;
    t18 += v2 * b5;
    t19 += v2 * b6;
    t20 += v2 * b7;
    t21 += v2 * b8;
    t22 += v2 * b9;
    t23 += v2 * b10;
    t24 += v2 * b11;
    t25 += v2 * b12;
    t26 += v2 * b13;
    t27 += v2 * b14;
    t28 += v2 * b15;
    v2 = a3[14];
    t14 += v2 * b0;
    t15 += v2 * b1;
    t16 += v2 * b22;
    t17 += v2 * b32;
    t18 += v2 * b4;
    t19 += v2 * b5;
    t20 += v2 * b6;
    t21 += v2 * b7;
    t22 += v2 * b8;
    t23 += v2 * b9;
    t24 += v2 * b10;
    t25 += v2 * b11;
    t26 += v2 * b12;
    t27 += v2 * b13;
    t28 += v2 * b14;
    t29 += v2 * b15;
    v2 = a3[15];
    t15 += v2 * b0;
    t16 += v2 * b1;
    t17 += v2 * b22;
    t18 += v2 * b32;
    t19 += v2 * b4;
    t20 += v2 * b5;
    t21 += v2 * b6;
    t22 += v2 * b7;
    t23 += v2 * b8;
    t24 += v2 * b9;
    t25 += v2 * b10;
    t26 += v2 * b11;
    t27 += v2 * b12;
    t28 += v2 * b13;
    t29 += v2 * b14;
    t30 += v2 * b15;
    t0 += 38 * t16;
    t1 += 38 * t17;
    t2 += 38 * t18;
    t3 += 38 * t19;
    t4 += 38 * t20;
    t5 += 38 * t21;
    t6 += 38 * t22;
    t7 += 38 * t23;
    t8 += 38 * t24;
    t9 += 38 * t25;
    t10 += 38 * t26;
    t11 += 38 * t27;
    t12 += 38 * t28;
    t13 += 38 * t29;
    t14 += 38 * t30;
    c2 = 1;
    v2 = t0 + c2 + 65535;
    c2 = Math.floor(v2 / 65536);
    t0 = v2 - c2 * 65536;
    v2 = t1 + c2 + 65535;
    c2 = Math.floor(v2 / 65536);
    t1 = v2 - c2 * 65536;
    v2 = t2 + c2 + 65535;
    c2 = Math.floor(v2 / 65536);
    t2 = v2 - c2 * 65536;
    v2 = t3 + c2 + 65535;
    c2 = Math.floor(v2 / 65536);
    t3 = v2 - c2 * 65536;
    v2 = t4 + c2 + 65535;
    c2 = Math.floor(v2 / 65536);
    t4 = v2 - c2 * 65536;
    v2 = t5 + c2 + 65535;
    c2 = Math.floor(v2 / 65536);
    t5 = v2 - c2 * 65536;
    v2 = t6 + c2 + 65535;
    c2 = Math.floor(v2 / 65536);
    t6 = v2 - c2 * 65536;
    v2 = t7 + c2 + 65535;
    c2 = Math.floor(v2 / 65536);
    t7 = v2 - c2 * 65536;
    v2 = t8 + c2 + 65535;
    c2 = Math.floor(v2 / 65536);
    t8 = v2 - c2 * 65536;
    v2 = t9 + c2 + 65535;
    c2 = Math.floor(v2 / 65536);
    t9 = v2 - c2 * 65536;
    v2 = t10 + c2 + 65535;
    c2 = Math.floor(v2 / 65536);
    t10 = v2 - c2 * 65536;
    v2 = t11 + c2 + 65535;
    c2 = Math.floor(v2 / 65536);
    t11 = v2 - c2 * 65536;
    v2 = t12 + c2 + 65535;
    c2 = Math.floor(v2 / 65536);
    t12 = v2 - c2 * 65536;
    v2 = t13 + c2 + 65535;
    c2 = Math.floor(v2 / 65536);
    t13 = v2 - c2 * 65536;
    v2 = t14 + c2 + 65535;
    c2 = Math.floor(v2 / 65536);
    t14 = v2 - c2 * 65536;
    v2 = t15 + c2 + 65535;
    c2 = Math.floor(v2 / 65536);
    t15 = v2 - c2 * 65536;
    t0 += c2 - 1 + 37 * (c2 - 1);
    c2 = 1;
    v2 = t0 + c2 + 65535;
    c2 = Math.floor(v2 / 65536);
    t0 = v2 - c2 * 65536;
    v2 = t1 + c2 + 65535;
    c2 = Math.floor(v2 / 65536);
    t1 = v2 - c2 * 65536;
    v2 = t2 + c2 + 65535;
    c2 = Math.floor(v2 / 65536);
    t2 = v2 - c2 * 65536;
    v2 = t3 + c2 + 65535;
    c2 = Math.floor(v2 / 65536);
    t3 = v2 - c2 * 65536;
    v2 = t4 + c2 + 65535;
    c2 = Math.floor(v2 / 65536);
    t4 = v2 - c2 * 65536;
    v2 = t5 + c2 + 65535;
    c2 = Math.floor(v2 / 65536);
    t5 = v2 - c2 * 65536;
    v2 = t6 + c2 + 65535;
    c2 = Math.floor(v2 / 65536);
    t6 = v2 - c2 * 65536;
    v2 = t7 + c2 + 65535;
    c2 = Math.floor(v2 / 65536);
    t7 = v2 - c2 * 65536;
    v2 = t8 + c2 + 65535;
    c2 = Math.floor(v2 / 65536);
    t8 = v2 - c2 * 65536;
    v2 = t9 + c2 + 65535;
    c2 = Math.floor(v2 / 65536);
    t9 = v2 - c2 * 65536;
    v2 = t10 + c2 + 65535;
    c2 = Math.floor(v2 / 65536);
    t10 = v2 - c2 * 65536;
    v2 = t11 + c2 + 65535;
    c2 = Math.floor(v2 / 65536);
    t11 = v2 - c2 * 65536;
    v2 = t12 + c2 + 65535;
    c2 = Math.floor(v2 / 65536);
    t12 = v2 - c2 * 65536;
    v2 = t13 + c2 + 65535;
    c2 = Math.floor(v2 / 65536);
    t13 = v2 - c2 * 65536;
    v2 = t14 + c2 + 65535;
    c2 = Math.floor(v2 / 65536);
    t14 = v2 - c2 * 65536;
    v2 = t15 + c2 + 65535;
    c2 = Math.floor(v2 / 65536);
    t15 = v2 - c2 * 65536;
    t0 += c2 - 1 + 37 * (c2 - 1);
    o[0] = t0;
    o[1] = t1;
    o[2] = t2;
    o[3] = t3;
    o[4] = t4;
    o[5] = t5;
    o[6] = t6;
    o[7] = t7;
    o[8] = t8;
    o[9] = t9;
    o[10] = t10;
    o[11] = t11;
    o[12] = t12;
    o[13] = t13;
    o[14] = t14;
    o[15] = t15;
  }
  function square(o, a3) {
    mul(o, a3, a3);
  }
  function inv25519(o, i) {
    const c2 = gf();
    let a3;
    for (a3 = 0; a3 < 16; a3++) {
      c2[a3] = i[a3];
    }
    for (a3 = 253; a3 >= 0; a3--) {
      square(c2, c2);
      if (a3 !== 2 && a3 !== 4) {
        mul(c2, c2, i);
      }
    }
    for (a3 = 0; a3 < 16; a3++) {
      o[a3] = c2[a3];
    }
  }
  function pow2523(o, i) {
    const c2 = gf();
    let a3;
    for (a3 = 0; a3 < 16; a3++) {
      c2[a3] = i[a3];
    }
    for (a3 = 250; a3 >= 0; a3--) {
      square(c2, c2);
      if (a3 !== 1) {
        mul(c2, c2, i);
      }
    }
    for (a3 = 0; a3 < 16; a3++) {
      o[a3] = c2[a3];
    }
  }
  function edadd(p2, q2) {
    const a3 = gf(), b3 = gf(), c2 = gf(), d2 = gf(), e = gf(), f2 = gf(), g3 = gf(), h4 = gf(), t = gf();
    sub(a3, p2[1], p2[0]);
    sub(t, q2[1], q2[0]);
    mul(a3, a3, t);
    add(b3, p2[0], p2[1]);
    add(t, q2[0], q2[1]);
    mul(b3, b3, t);
    mul(c2, p2[3], q2[3]);
    mul(c2, c2, D22);
    mul(d2, p2[2], q2[2]);
    add(d2, d2, d2);
    sub(e, b3, a3);
    sub(f2, d2, c2);
    add(g3, d2, c2);
    add(h4, b3, a3);
    mul(p2[0], e, f2);
    mul(p2[1], h4, g3);
    mul(p2[2], g3, f2);
    mul(p2[3], e, h4);
  }
  function cswap(p2, q2, b3) {
    for (let i = 0; i < 4; i++) {
      sel25519(p2[i], q2[i], b3);
    }
  }
  function pack(r, p2) {
    const tx = gf(), ty = gf(), zi = gf();
    inv25519(zi, p2[2]);
    mul(tx, p2[0], zi);
    mul(ty, p2[1], zi);
    pack25519(r, ty);
    r[31] ^= par25519(tx) << 7;
  }
  function scalarmult(p2, q2, s) {
    set25519(p2[0], gf0);
    set25519(p2[1], gf1);
    set25519(p2[2], gf1);
    set25519(p2[3], gf0);
    for (let i = 255; i >= 0; --i) {
      const b3 = s[i / 8 | 0] >> (i & 7) & 1;
      cswap(p2, q2, b3);
      edadd(q2, p2);
      edadd(p2, p2);
      cswap(p2, q2, b3);
    }
  }
  function scalarbase(p2, s) {
    const q2 = [gf(), gf(), gf(), gf()];
    set25519(q2[0], X2);
    set25519(q2[1], Y);
    set25519(q2[2], gf1);
    mul(q2[3], X2, Y);
    scalarmult(p2, q2, s);
  }
  function generateKeyPairFromSeed(seed) {
    if (seed.length !== exports.SEED_LENGTH) {
      throw new Error(`ed25519: seed must be ${exports.SEED_LENGTH} bytes`);
    }
    const d2 = (0, sha512_1.hash)(seed);
    d2[0] &= 248;
    d2[31] &= 127;
    d2[31] |= 64;
    const publicKey = new Uint8Array(32);
    const p2 = [gf(), gf(), gf(), gf()];
    scalarbase(p2, d2);
    pack(publicKey, p2);
    const secretKey = new Uint8Array(64);
    secretKey.set(seed);
    secretKey.set(publicKey, 32);
    return {
      publicKey,
      secretKey
    };
  }
  exports.generateKeyPairFromSeed = generateKeyPairFromSeed;
  function generateKeyPair2(prng) {
    const seed = (0, random_1.randomBytes)(32, prng);
    const result = generateKeyPairFromSeed(seed);
    (0, wipe_1.wipe)(seed);
    return result;
  }
  exports.generateKeyPair = generateKeyPair2;
  function extractPublicKeyFromSecretKey(secretKey) {
    if (secretKey.length !== exports.SECRET_KEY_LENGTH) {
      throw new Error(`ed25519: secret key must be ${exports.SECRET_KEY_LENGTH} bytes`);
    }
    return new Uint8Array(secretKey.subarray(32));
  }
  exports.extractPublicKeyFromSecretKey = extractPublicKeyFromSecretKey;
  const L = new Float64Array([
    237,
    211,
    245,
    92,
    26,
    99,
    18,
    88,
    214,
    156,
    247,
    162,
    222,
    249,
    222,
    20,
    0,
    0,
    0,
    0,
    0,
    0,
    0,
    0,
    0,
    0,
    0,
    0,
    0,
    0,
    0,
    16
  ]);
  function modL(r, x2) {
    let carry;
    let i;
    let j2;
    let k2;
    for (i = 63; i >= 32; --i) {
      carry = 0;
      for (j2 = i - 32, k2 = i - 12; j2 < k2; ++j2) {
        x2[j2] += carry - 16 * x2[i] * L[j2 - (i - 32)];
        carry = Math.floor((x2[j2] + 128) / 256);
        x2[j2] -= carry * 256;
      }
      x2[j2] += carry;
      x2[i] = 0;
    }
    carry = 0;
    for (j2 = 0; j2 < 32; j2++) {
      x2[j2] += carry - (x2[31] >> 4) * L[j2];
      carry = x2[j2] >> 8;
      x2[j2] &= 255;
    }
    for (j2 = 0; j2 < 32; j2++) {
      x2[j2] -= carry * L[j2];
    }
    for (i = 0; i < 32; i++) {
      x2[i + 1] += x2[i] >> 8;
      r[i] = x2[i] & 255;
    }
  }
  function reduce(r) {
    const x2 = new Float64Array(64);
    for (let i = 0; i < 64; i++) {
      x2[i] = r[i];
    }
    for (let i = 0; i < 64; i++) {
      r[i] = 0;
    }
    modL(r, x2);
  }
  function sign(secretKey, message) {
    const x2 = new Float64Array(64);
    const p2 = [gf(), gf(), gf(), gf()];
    const d2 = (0, sha512_1.hash)(secretKey.subarray(0, 32));
    d2[0] &= 248;
    d2[31] &= 127;
    d2[31] |= 64;
    const signature = new Uint8Array(64);
    signature.set(d2.subarray(32), 32);
    const hs2 = new sha512_1.SHA512();
    hs2.update(signature.subarray(32));
    hs2.update(message);
    const r = hs2.digest();
    hs2.clean();
    reduce(r);
    scalarbase(p2, r);
    pack(signature, p2);
    hs2.reset();
    hs2.update(signature.subarray(0, 32));
    hs2.update(secretKey.subarray(32));
    hs2.update(message);
    const h4 = hs2.digest();
    reduce(h4);
    for (let i = 0; i < 32; i++) {
      x2[i] = r[i];
    }
    for (let i = 0; i < 32; i++) {
      for (let j2 = 0; j2 < 32; j2++) {
        x2[i + j2] += h4[i] * d2[j2];
      }
    }
    modL(signature.subarray(32), x2);
    return signature;
  }
  exports.sign = sign;
  function unpackneg(r, p2) {
    const t = gf(), chk = gf(), num = gf(), den = gf(), den2 = gf(), den4 = gf(), den6 = gf();
    set25519(r[2], gf1);
    unpack25519(r[1], p2);
    square(num, r[1]);
    mul(den, num, D2);
    sub(num, num, r[2]);
    add(den, r[2], den);
    square(den2, den);
    square(den4, den2);
    mul(den6, den4, den2);
    mul(t, den6, num);
    mul(t, t, den);
    pow2523(t, t);
    mul(t, t, num);
    mul(t, t, den);
    mul(t, t, den);
    mul(r[0], t, den);
    square(chk, r[0]);
    mul(chk, chk, den);
    if (neq25519(chk, num)) {
      mul(r[0], r[0], I);
    }
    square(chk, r[0]);
    mul(chk, chk, den);
    if (neq25519(chk, num)) {
      return -1;
    }
    if (par25519(r[0]) === p2[31] >> 7) {
      sub(r[0], gf0, r[0]);
    }
    mul(r[3], r[0], r[1]);
    return 0;
  }
  function verify(publicKey, message, signature) {
    const t = new Uint8Array(32);
    const p2 = [gf(), gf(), gf(), gf()];
    const q2 = [gf(), gf(), gf(), gf()];
    if (signature.length !== exports.SIGNATURE_LENGTH) {
      throw new Error(`ed25519: signature must be ${exports.SIGNATURE_LENGTH} bytes`);
    }
    if (unpackneg(q2, publicKey)) {
      return false;
    }
    const hs2 = new sha512_1.SHA512();
    hs2.update(signature.subarray(0, 32));
    hs2.update(publicKey);
    hs2.update(message);
    const h4 = hs2.digest();
    reduce(h4);
    scalarmult(p2, q2, h4);
    scalarbase(q2, signature.subarray(32));
    edadd(p2, q2);
    pack(t, p2);
    if (verify32(signature, t)) {
      return false;
    }
    return true;
  }
  exports.verify = verify;
  function convertPublicKeyToX25519(publicKey) {
    let q2 = [gf(), gf(), gf(), gf()];
    if (unpackneg(q2, publicKey)) {
      throw new Error("Ed25519: invalid public key");
    }
    let a3 = gf();
    let b3 = gf();
    let y2 = q2[1];
    add(a3, gf1, y2);
    sub(b3, gf1, y2);
    inv25519(b3, b3);
    mul(a3, a3, b3);
    let z2 = new Uint8Array(32);
    pack25519(z2, a3);
    return z2;
  }
  exports.convertPublicKeyToX25519 = convertPublicKeyToX25519;
  function convertSecretKeyToX25519(secretKey) {
    const d2 = (0, sha512_1.hash)(secretKey.subarray(0, 32));
    d2[0] &= 248;
    d2[31] &= 127;
    d2[31] |= 64;
    const o = new Uint8Array(d2.subarray(0, 32));
    (0, wipe_1.wipe)(d2);
    return o;
  }
  exports.convertSecretKeyToX25519 = convertSecretKeyToX25519;
})(ed25519);
const JWT_IRIDIUM_ALG = "EdDSA";
const JWT_IRIDIUM_TYP = "JWT";
const JWT_DELIMITER = ".";
const JWT_ENCODING = "base64url";
const JSON_ENCODING = "utf8";
const DATA_ENCODING = "utf8";
const DID_DELIMITER = ":";
const DID_PREFIX = "did";
const DID_METHOD = "key";
const MULTICODEC_ED25519_ENCODING = "base58btc";
const MULTICODEC_ED25519_BASE = "z";
const MULTICODEC_ED25519_HEADER = "K36";
const KEY_PAIR_SEED_LENGTH = 32;
function encodeJSON(val) {
  return toString(fromString(safeJsonStringify(val), JSON_ENCODING), JWT_ENCODING);
}
function encodeIss(publicKey) {
  const header = fromString(MULTICODEC_ED25519_HEADER, MULTICODEC_ED25519_ENCODING);
  const multicodec = MULTICODEC_ED25519_BASE + toString(concat([header, publicKey]), MULTICODEC_ED25519_ENCODING);
  return [DID_PREFIX, DID_METHOD, multicodec].join(DID_DELIMITER);
}
function encodeSig(bytes) {
  return toString(bytes, JWT_ENCODING);
}
function encodeData(params) {
  return fromString([encodeJSON(params.header), encodeJSON(params.payload)].join(JWT_DELIMITER), DATA_ENCODING);
}
function encodeJWT(params) {
  return [
    encodeJSON(params.header),
    encodeJSON(params.payload),
    encodeSig(params.signature)
  ].join(JWT_DELIMITER);
}
function generateKeyPair(seed = random.randomBytes(KEY_PAIR_SEED_LENGTH)) {
  return ed25519.generateKeyPairFromSeed(seed);
}
async function signJWT(sub, aud, ttl, keyPair, iat = cjs$3.fromMiliseconds(Date.now())) {
  const header = { alg: JWT_IRIDIUM_ALG, typ: JWT_IRIDIUM_TYP };
  const iss = encodeIss(keyPair.publicKey);
  const exp = iat + ttl;
  const payload = { iss, sub, aud, iat, exp };
  const data = encodeData({ header, payload });
  const signature = ed25519.sign(keyPair.secretKey, data);
  return encodeJWT({ header, payload, signature });
}
const PARSE_ERROR = "PARSE_ERROR";
const INVALID_REQUEST = "INVALID_REQUEST";
const METHOD_NOT_FOUND = "METHOD_NOT_FOUND";
const INVALID_PARAMS = "INVALID_PARAMS";
const INTERNAL_ERROR = "INTERNAL_ERROR";
const SERVER_ERROR = "SERVER_ERROR";
const RESERVED_ERROR_CODES = [-32700, -32600, -32601, -32602, -32603];
const STANDARD_ERROR_MAP = {
  [PARSE_ERROR]: { code: -32700, message: "Parse error" },
  [INVALID_REQUEST]: { code: -32600, message: "Invalid Request" },
  [METHOD_NOT_FOUND]: { code: -32601, message: "Method not found" },
  [INVALID_PARAMS]: { code: -32602, message: "Invalid params" },
  [INTERNAL_ERROR]: { code: -32603, message: "Internal error" },
  [SERVER_ERROR]: { code: -32e3, message: "Server error" }
};
const DEFAULT_ERROR = SERVER_ERROR;
function isReservedErrorCode(code) {
  return RESERVED_ERROR_CODES.includes(code);
}
function getError(type) {
  if (!Object.keys(STANDARD_ERROR_MAP).includes(type)) {
    return STANDARD_ERROR_MAP[DEFAULT_ERROR];
  }
  return STANDARD_ERROR_MAP[type];
}
function getErrorByCode(code) {
  const match = Object.values(STANDARD_ERROR_MAP).find((e) => e.code === code);
  if (!match) {
    return STANDARD_ERROR_MAP[DEFAULT_ERROR];
  }
  return match;
}
function parseConnectionError(e, url, type) {
  return e.message.includes("getaddrinfo ENOTFOUND") || e.message.includes("connect ECONNREFUSED") ? new Error(`Unavailable ${type} RPC url at ${url}`) : e;
}
var cjs = {};
var crypto$1 = {};
var hasRequiredCrypto;
function requireCrypto() {
  if (hasRequiredCrypto)
    return crypto$1;
  hasRequiredCrypto = 1;
  Object.defineProperty(crypto$1, "__esModule", { value: true });
  crypto$1.isBrowserCryptoAvailable = crypto$1.getSubtleCrypto = crypto$1.getBrowerCrypto = void 0;
  function getBrowerCrypto() {
    return (commonjsGlobal === null || commonjsGlobal === void 0 ? void 0 : commonjsGlobal.crypto) || (commonjsGlobal === null || commonjsGlobal === void 0 ? void 0 : commonjsGlobal.msCrypto) || {};
  }
  crypto$1.getBrowerCrypto = getBrowerCrypto;
  function getSubtleCrypto() {
    const browserCrypto = getBrowerCrypto();
    return browserCrypto.subtle || browserCrypto.webkitSubtle;
  }
  crypto$1.getSubtleCrypto = getSubtleCrypto;
  function isBrowserCryptoAvailable() {
    return !!getBrowerCrypto() && !!getSubtleCrypto();
  }
  crypto$1.isBrowserCryptoAvailable = isBrowserCryptoAvailable;
  return crypto$1;
}
var env = {};
var hasRequiredEnv;
function requireEnv() {
  if (hasRequiredEnv)
    return env;
  hasRequiredEnv = 1;
  Object.defineProperty(env, "__esModule", { value: true });
  env.isBrowser = env.isNode = env.isReactNative = void 0;
  function isReactNative() {
    return typeof document === "undefined" && typeof navigator !== "undefined" && navigator.product === "ReactNative";
  }
  env.isReactNative = isReactNative;
  function isNode() {
    return typeof process !== "undefined" && typeof process.versions !== "undefined" && typeof process.versions.node !== "undefined";
  }
  env.isNode = isNode;
  function isBrowser() {
    return !isReactNative() && !isNode();
  }
  env.isBrowser = isBrowser;
  return env;
}
(function(exports) {
  Object.defineProperty(exports, "__esModule", { value: true });
  const tslib_1 = require$$0$1;
  tslib_1.__exportStar(requireCrypto(), exports);
  tslib_1.__exportStar(requireEnv(), exports);
})(cjs);
function payloadId(entropy = 3) {
  const date = Date.now() * Math.pow(10, entropy);
  const extra = Math.floor(Math.random() * Math.pow(10, entropy));
  return date + extra;
}
function getBigIntRpcId(entropy = 6) {
  return BigInt(payloadId(entropy));
}
function formatJsonRpcRequest(method, params, id) {
  return {
    id: id || payloadId(),
    jsonrpc: "2.0",
    method,
    params
  };
}
function formatJsonRpcResult(id, result) {
  return {
    id,
    jsonrpc: "2.0",
    result
  };
}
function formatJsonRpcError(id, error, data) {
  return {
    id,
    jsonrpc: "2.0",
    error: formatErrorMessage(error, data)
  };
}
function formatErrorMessage(error, data) {
  if (typeof error === "undefined") {
    return getError(INTERNAL_ERROR);
  }
  if (typeof error === "string") {
    error = Object.assign(Object.assign({}, getError(SERVER_ERROR)), { message: error });
  }
  if (typeof data !== "undefined") {
    error.data = data;
  }
  if (isReservedErrorCode(error.code)) {
    error = getErrorByCode(error.code);
  }
  return error;
}
class IEvents2 {
}
class IBaseJsonRpcProvider extends IEvents2 {
  constructor() {
    super();
  }
}
class IJsonRpcProvider extends IBaseJsonRpcProvider {
  constructor(connection) {
    super();
  }
}
const WS_REGEX = "^wss?:";
function getUrlProtocol(url) {
  const matches = url.match(new RegExp(/^\w+:/, "gi"));
  if (!matches || !matches.length)
    return;
  return matches[0];
}
function matchRegexProtocol(url, regex) {
  const protocol = getUrlProtocol(url);
  if (typeof protocol === "undefined")
    return false;
  return new RegExp(regex).test(protocol);
}
function isWsUrl(url) {
  return matchRegexProtocol(url, WS_REGEX);
}
function isLocalhostUrl(url) {
  return new RegExp("wss?://localhost(:d{2,5})?").test(url);
}
function isJsonRpcPayload(payload) {
  return typeof payload === "object" && "id" in payload && "jsonrpc" in payload && payload.jsonrpc === "2.0";
}
function isJsonRpcRequest(payload) {
  return isJsonRpcPayload(payload) && "method" in payload;
}
function isJsonRpcResponse(payload) {
  return isJsonRpcPayload(payload) && (isJsonRpcResult(payload) || isJsonRpcError(payload));
}
function isJsonRpcResult(payload) {
  return "result" in payload;
}
function isJsonRpcError(payload) {
  return "error" in payload;
}
class JsonRpcProvider extends IJsonRpcProvider {
  constructor(connection) {
    super(connection);
    this.events = new eventsExports.EventEmitter();
    this.hasRegisteredEventListeners = false;
    this.connection = this.setConnection(connection);
    if (this.connection.connected) {
      this.registerEventListeners();
    }
  }
  async connect(connection = this.connection) {
    await this.open(connection);
  }
  async disconnect() {
    await this.close();
  }
  on(event, listener) {
    this.events.on(event, listener);
  }
  once(event, listener) {
    this.events.once(event, listener);
  }
  off(event, listener) {
    this.events.off(event, listener);
  }
  removeListener(event, listener) {
    this.events.removeListener(event, listener);
  }
  async request(request, context) {
    return this.requestStrict(formatJsonRpcRequest(request.method, request.params || [], request.id || getBigIntRpcId().toString()), context);
  }
  async requestStrict(request, context) {
    return new Promise(async (resolve, reject) => {
      if (!this.connection.connected) {
        try {
          await this.open();
        } catch (e) {
          reject(e);
        }
      }
      this.events.on(`${request.id}`, (response) => {
        if (isJsonRpcError(response)) {
          reject(response.error);
        } else {
          resolve(response.result);
        }
      });
      try {
        await this.connection.send(request, context);
      } catch (e) {
        reject(e);
      }
    });
  }
  setConnection(connection = this.connection) {
    return connection;
  }
  onPayload(payload) {
    this.events.emit("payload", payload);
    if (isJsonRpcResponse(payload)) {
      this.events.emit(`${payload.id}`, payload);
    } else {
      this.events.emit("message", {
        type: payload.method,
        data: payload.params
      });
    }
  }
  onClose(event) {
    if (event && event.code === 3e3) {
      this.events.emit("error", new Error(`WebSocket connection closed abnormally with code: ${event.code} ${event.reason ? `(${event.reason})` : ""}`));
    }
    this.events.emit("disconnect");
  }
  async open(connection = this.connection) {
    if (this.connection === connection && this.connection.connected)
      return;
    if (this.connection.connected)
      this.close();
    if (typeof connection === "string") {
      await this.connection.open(connection);
      connection = this.connection;
    }
    this.connection = this.setConnection(connection);
    await this.connection.open();
    this.registerEventListeners();
    this.events.emit("connect");
  }
  async close() {
    await this.connection.close();
  }
  registerEventListeners() {
    if (this.hasRegisteredEventListeners)
      return;
    this.connection.on("payload", (payload) => this.onPayload(payload));
    this.connection.on("close", (event) => this.onClose(event));
    this.connection.on("error", (error) => this.events.emit("error", error));
    this.connection.on("register_error", (error) => this.onClose());
    this.hasRegisteredEventListeners = true;
  }
}
const w$1 = () => typeof WebSocket < "u" ? WebSocket : typeof global < "u" && typeof global.WebSocket < "u" ? global.WebSocket : typeof window < "u" && typeof window.WebSocket < "u" ? window.WebSocket : typeof self < "u" && typeof self.WebSocket < "u" ? self.WebSocket : require("ws"), b2 = () => typeof WebSocket < "u" || typeof global < "u" && typeof global.WebSocket < "u" || typeof window < "u" && typeof window.WebSocket < "u" || typeof self < "u" && typeof self.WebSocket < "u", a2 = (c2) => c2.split("?")[0], h3 = 10, S2 = w$1();
class f {
  constructor(e) {
    if (this.url = e, this.events = new eventsExports.EventEmitter(), this.registering = false, !isWsUrl(e))
      throw new Error(`Provided URL is not compatible with WebSocket connection: ${e}`);
    this.url = e;
  }
  get connected() {
    return typeof this.socket < "u";
  }
  get connecting() {
    return this.registering;
  }
  on(e, t) {
    this.events.on(e, t);
  }
  once(e, t) {
    this.events.once(e, t);
  }
  off(e, t) {
    this.events.off(e, t);
  }
  removeListener(e, t) {
    this.events.removeListener(e, t);
  }
  async open(e = this.url) {
    await this.register(e);
  }
  async close() {
    return new Promise((e, t) => {
      if (typeof this.socket > "u") {
        t(new Error("Connection already closed"));
        return;
      }
      this.socket.onclose = (n2) => {
        this.onClose(n2), e();
      }, this.socket.close();
    });
  }
  async send(e) {
    typeof this.socket > "u" && (this.socket = await this.register());
    try {
      this.socket.send(safeJsonStringify(e));
    } catch (t) {
      this.onError(e.id, t);
    }
  }
  register(e = this.url) {
    if (!isWsUrl(e))
      throw new Error(`Provided URL is not compatible with WebSocket connection: ${e}`);
    if (this.registering) {
      const t = this.events.getMaxListeners();
      return (this.events.listenerCount("register_error") >= t || this.events.listenerCount("open") >= t) && this.events.setMaxListeners(t + 1), new Promise((n2, o) => {
        this.events.once("register_error", (s) => {
          this.resetMaxListeners(), o(s);
        }), this.events.once("open", () => {
          if (this.resetMaxListeners(), typeof this.socket > "u")
            return o(new Error("WebSocket connection is missing or invalid"));
          n2(this.socket);
        });
      });
    }
    return this.url = e, this.registering = true, new Promise((t, n2) => {
      const o = new URLSearchParams(e).get("origin"), s = cjs.isReactNative() ? { headers: { origin: o } } : { rejectUnauthorized: !isLocalhostUrl(e) }, i = new S2(e, [], s);
      b2() ? i.onerror = (r) => {
        const l2 = r;
        n2(this.emitError(l2.error));
      } : i.on("error", (r) => {
        n2(this.emitError(r));
      }), i.onopen = () => {
        this.onOpen(i), t(i);
      };
    });
  }
  onOpen(e) {
    e.onmessage = (t) => this.onPayload(t), e.onclose = (t) => this.onClose(t), this.socket = e, this.registering = false, this.events.emit("open");
  }
  onClose(e) {
    this.socket = void 0, this.registering = false, this.events.emit("close", e);
  }
  onPayload(e) {
    if (typeof e.data > "u")
      return;
    const t = typeof e.data == "string" ? safeJsonParse(e.data) : e.data;
    this.events.emit("payload", t);
  }
  onError(e, t) {
    const n2 = this.parseError(t), o = n2.message || n2.toString(), s = formatJsonRpcError(e, o);
    this.events.emit("payload", s);
  }
  parseError(e, t = this.url) {
    return parseConnectionError(e, a2(t), "WS");
  }
  resetMaxListeners() {
    this.events.getMaxListeners() > h3 && this.events.setMaxListeners(h3);
  }
  emitError(e) {
    const t = this.parseError(new Error((e == null ? void 0 : e.message) || `WebSocket connection failed for host: ${a2(this.url)}`));
    return this.events.emit("register_error", t), t;
  }
}
var lodash_isequal = { exports: {} };
lodash_isequal.exports;
(function(module, exports) {
  var LARGE_ARRAY_SIZE = 200;
  var HASH_UNDEFINED = "__lodash_hash_undefined__";
  var COMPARE_PARTIAL_FLAG = 1, COMPARE_UNORDERED_FLAG = 2;
  var MAX_SAFE_INTEGER = 9007199254740991;
  var argsTag = "[object Arguments]", arrayTag = "[object Array]", asyncTag = "[object AsyncFunction]", boolTag = "[object Boolean]", dateTag = "[object Date]", errorTag = "[object Error]", funcTag = "[object Function]", genTag = "[object GeneratorFunction]", mapTag = "[object Map]", numberTag = "[object Number]", nullTag = "[object Null]", objectTag = "[object Object]", promiseTag = "[object Promise]", proxyTag = "[object Proxy]", regexpTag = "[object RegExp]", setTag = "[object Set]", stringTag = "[object String]", symbolTag = "[object Symbol]", undefinedTag = "[object Undefined]", weakMapTag = "[object WeakMap]";
  var arrayBufferTag = "[object ArrayBuffer]", dataViewTag = "[object DataView]", float32Tag = "[object Float32Array]", float64Tag = "[object Float64Array]", int8Tag = "[object Int8Array]", int16Tag = "[object Int16Array]", int32Tag = "[object Int32Array]", uint8Tag = "[object Uint8Array]", uint8ClampedTag = "[object Uint8ClampedArray]", uint16Tag = "[object Uint16Array]", uint32Tag = "[object Uint32Array]";
  var reRegExpChar = /[\\^$.*+?()[\]{}|]/g;
  var reIsHostCtor = /^\[object .+?Constructor\]$/;
  var reIsUint = /^(?:0|[1-9]\d*)$/;
  var typedArrayTags = {};
  typedArrayTags[float32Tag] = typedArrayTags[float64Tag] = typedArrayTags[int8Tag] = typedArrayTags[int16Tag] = typedArrayTags[int32Tag] = typedArrayTags[uint8Tag] = typedArrayTags[uint8ClampedTag] = typedArrayTags[uint16Tag] = typedArrayTags[uint32Tag] = true;
  typedArrayTags[argsTag] = typedArrayTags[arrayTag] = typedArrayTags[arrayBufferTag] = typedArrayTags[boolTag] = typedArrayTags[dataViewTag] = typedArrayTags[dateTag] = typedArrayTags[errorTag] = typedArrayTags[funcTag] = typedArrayTags[mapTag] = typedArrayTags[numberTag] = typedArrayTags[objectTag] = typedArrayTags[regexpTag] = typedArrayTags[setTag] = typedArrayTags[stringTag] = typedArrayTags[weakMapTag] = false;
  var freeGlobal = typeof commonjsGlobal == "object" && commonjsGlobal && commonjsGlobal.Object === Object && commonjsGlobal;
  var freeSelf = typeof self == "object" && self && self.Object === Object && self;
  var root = freeGlobal || freeSelf || Function("return this")();
  var freeExports = exports && !exports.nodeType && exports;
  var freeModule = freeExports && true && module && !module.nodeType && module;
  var moduleExports = freeModule && freeModule.exports === freeExports;
  var freeProcess = moduleExports && freeGlobal.process;
  var nodeUtil = function() {
    try {
      return freeProcess && freeProcess.binding && freeProcess.binding("util");
    } catch (e) {
    }
  }();
  var nodeIsTypedArray = nodeUtil && nodeUtil.isTypedArray;
  function arrayFilter(array, predicate) {
    var index = -1, length = array == null ? 0 : array.length, resIndex = 0, result = [];
    while (++index < length) {
      var value = array[index];
      if (predicate(value, index, array)) {
        result[resIndex++] = value;
      }
    }
    return result;
  }
  function arrayPush(array, values) {
    var index = -1, length = values.length, offset = array.length;
    while (++index < length) {
      array[offset + index] = values[index];
    }
    return array;
  }
  function arraySome(array, predicate) {
    var index = -1, length = array == null ? 0 : array.length;
    while (++index < length) {
      if (predicate(array[index], index, array)) {
        return true;
      }
    }
    return false;
  }
  function baseTimes(n2, iteratee) {
    var index = -1, result = Array(n2);
    while (++index < n2) {
      result[index] = iteratee(index);
    }
    return result;
  }
  function baseUnary(func) {
    return function(value) {
      return func(value);
    };
  }
  function cacheHas(cache, key) {
    return cache.has(key);
  }
  function getValue(object, key) {
    return object == null ? void 0 : object[key];
  }
  function mapToArray(map) {
    var index = -1, result = Array(map.size);
    map.forEach(function(value, key) {
      result[++index] = [key, value];
    });
    return result;
  }
  function overArg(func, transform) {
    return function(arg) {
      return func(transform(arg));
    };
  }
  function setToArray(set2) {
    var index = -1, result = Array(set2.size);
    set2.forEach(function(value) {
      result[++index] = value;
    });
    return result;
  }
  var arrayProto = Array.prototype, funcProto = Function.prototype, objectProto = Object.prototype;
  var coreJsData = root["__core-js_shared__"];
  var funcToString = funcProto.toString;
  var hasOwnProperty = objectProto.hasOwnProperty;
  var maskSrcKey = function() {
    var uid = /[^.]+$/.exec(coreJsData && coreJsData.keys && coreJsData.keys.IE_PROTO || "");
    return uid ? "Symbol(src)_1." + uid : "";
  }();
  var nativeObjectToString = objectProto.toString;
  var reIsNative = RegExp(
    "^" + funcToString.call(hasOwnProperty).replace(reRegExpChar, "\\$&").replace(/hasOwnProperty|(function).*?(?=\\\()| for .+?(?=\\\])/g, "$1.*?") + "$"
  );
  var Buffer2 = moduleExports ? root.Buffer : void 0, Symbol2 = root.Symbol, Uint8Array2 = root.Uint8Array, propertyIsEnumerable = objectProto.propertyIsEnumerable, splice = arrayProto.splice, symToStringTag = Symbol2 ? Symbol2.toStringTag : void 0;
  var nativeGetSymbols = Object.getOwnPropertySymbols, nativeIsBuffer = Buffer2 ? Buffer2.isBuffer : void 0, nativeKeys = overArg(Object.keys, Object);
  var DataView = getNative(root, "DataView"), Map2 = getNative(root, "Map"), Promise2 = getNative(root, "Promise"), Set2 = getNative(root, "Set"), WeakMap = getNative(root, "WeakMap"), nativeCreate = getNative(Object, "create");
  var dataViewCtorString = toSource(DataView), mapCtorString = toSource(Map2), promiseCtorString = toSource(Promise2), setCtorString = toSource(Set2), weakMapCtorString = toSource(WeakMap);
  var symbolProto = Symbol2 ? Symbol2.prototype : void 0, symbolValueOf = symbolProto ? symbolProto.valueOf : void 0;
  function Hash(entries) {
    var index = -1, length = entries == null ? 0 : entries.length;
    this.clear();
    while (++index < length) {
      var entry = entries[index];
      this.set(entry[0], entry[1]);
    }
  }
  function hashClear() {
    this.__data__ = nativeCreate ? nativeCreate(null) : {};
    this.size = 0;
  }
  function hashDelete(key) {
    var result = this.has(key) && delete this.__data__[key];
    this.size -= result ? 1 : 0;
    return result;
  }
  function hashGet(key) {
    var data = this.__data__;
    if (nativeCreate) {
      var result = data[key];
      return result === HASH_UNDEFINED ? void 0 : result;
    }
    return hasOwnProperty.call(data, key) ? data[key] : void 0;
  }
  function hashHas(key) {
    var data = this.__data__;
    return nativeCreate ? data[key] !== void 0 : hasOwnProperty.call(data, key);
  }
  function hashSet(key, value) {
    var data = this.__data__;
    this.size += this.has(key) ? 0 : 1;
    data[key] = nativeCreate && value === void 0 ? HASH_UNDEFINED : value;
    return this;
  }
  Hash.prototype.clear = hashClear;
  Hash.prototype["delete"] = hashDelete;
  Hash.prototype.get = hashGet;
  Hash.prototype.has = hashHas;
  Hash.prototype.set = hashSet;
  function ListCache(entries) {
    var index = -1, length = entries == null ? 0 : entries.length;
    this.clear();
    while (++index < length) {
      var entry = entries[index];
      this.set(entry[0], entry[1]);
    }
  }
  function listCacheClear() {
    this.__data__ = [];
    this.size = 0;
  }
  function listCacheDelete(key) {
    var data = this.__data__, index = assocIndexOf(data, key);
    if (index < 0) {
      return false;
    }
    var lastIndex = data.length - 1;
    if (index == lastIndex) {
      data.pop();
    } else {
      splice.call(data, index, 1);
    }
    --this.size;
    return true;
  }
  function listCacheGet(key) {
    var data = this.__data__, index = assocIndexOf(data, key);
    return index < 0 ? void 0 : data[index][1];
  }
  function listCacheHas(key) {
    return assocIndexOf(this.__data__, key) > -1;
  }
  function listCacheSet(key, value) {
    var data = this.__data__, index = assocIndexOf(data, key);
    if (index < 0) {
      ++this.size;
      data.push([key, value]);
    } else {
      data[index][1] = value;
    }
    return this;
  }
  ListCache.prototype.clear = listCacheClear;
  ListCache.prototype["delete"] = listCacheDelete;
  ListCache.prototype.get = listCacheGet;
  ListCache.prototype.has = listCacheHas;
  ListCache.prototype.set = listCacheSet;
  function MapCache(entries) {
    var index = -1, length = entries == null ? 0 : entries.length;
    this.clear();
    while (++index < length) {
      var entry = entries[index];
      this.set(entry[0], entry[1]);
    }
  }
  function mapCacheClear() {
    this.size = 0;
    this.__data__ = {
      "hash": new Hash(),
      "map": new (Map2 || ListCache)(),
      "string": new Hash()
    };
  }
  function mapCacheDelete(key) {
    var result = getMapData(this, key)["delete"](key);
    this.size -= result ? 1 : 0;
    return result;
  }
  function mapCacheGet(key) {
    return getMapData(this, key).get(key);
  }
  function mapCacheHas(key) {
    return getMapData(this, key).has(key);
  }
  function mapCacheSet(key, value) {
    var data = getMapData(this, key), size = data.size;
    data.set(key, value);
    this.size += data.size == size ? 0 : 1;
    return this;
  }
  MapCache.prototype.clear = mapCacheClear;
  MapCache.prototype["delete"] = mapCacheDelete;
  MapCache.prototype.get = mapCacheGet;
  MapCache.prototype.has = mapCacheHas;
  MapCache.prototype.set = mapCacheSet;
  function SetCache(values) {
    var index = -1, length = values == null ? 0 : values.length;
    this.__data__ = new MapCache();
    while (++index < length) {
      this.add(values[index]);
    }
  }
  function setCacheAdd(value) {
    this.__data__.set(value, HASH_UNDEFINED);
    return this;
  }
  function setCacheHas(value) {
    return this.__data__.has(value);
  }
  SetCache.prototype.add = SetCache.prototype.push = setCacheAdd;
  SetCache.prototype.has = setCacheHas;
  function Stack(entries) {
    var data = this.__data__ = new ListCache(entries);
    this.size = data.size;
  }
  function stackClear() {
    this.__data__ = new ListCache();
    this.size = 0;
  }
  function stackDelete(key) {
    var data = this.__data__, result = data["delete"](key);
    this.size = data.size;
    return result;
  }
  function stackGet(key) {
    return this.__data__.get(key);
  }
  function stackHas(key) {
    return this.__data__.has(key);
  }
  function stackSet(key, value) {
    var data = this.__data__;
    if (data instanceof ListCache) {
      var pairs = data.__data__;
      if (!Map2 || pairs.length < LARGE_ARRAY_SIZE - 1) {
        pairs.push([key, value]);
        this.size = ++data.size;
        return this;
      }
      data = this.__data__ = new MapCache(pairs);
    }
    data.set(key, value);
    this.size = data.size;
    return this;
  }
  Stack.prototype.clear = stackClear;
  Stack.prototype["delete"] = stackDelete;
  Stack.prototype.get = stackGet;
  Stack.prototype.has = stackHas;
  Stack.prototype.set = stackSet;
  function arrayLikeKeys(value, inherited) {
    var isArr = isArray(value), isArg = !isArr && isArguments(value), isBuff = !isArr && !isArg && isBuffer(value), isType = !isArr && !isArg && !isBuff && isTypedArray(value), skipIndexes = isArr || isArg || isBuff || isType, result = skipIndexes ? baseTimes(value.length, String) : [], length = result.length;
    for (var key in value) {
      if ((inherited || hasOwnProperty.call(value, key)) && !(skipIndexes && // Safari 9 has enumerable `arguments.length` in strict mode.
      (key == "length" || // Node.js 0.10 has enumerable non-index properties on buffers.
      isBuff && (key == "offset" || key == "parent") || // PhantomJS 2 has enumerable non-index properties on typed arrays.
      isType && (key == "buffer" || key == "byteLength" || key == "byteOffset") || // Skip index properties.
      isIndex(key, length)))) {
        result.push(key);
      }
    }
    return result;
  }
  function assocIndexOf(array, key) {
    var length = array.length;
    while (length--) {
      if (eq(array[length][0], key)) {
        return length;
      }
    }
    return -1;
  }
  function baseGetAllKeys(object, keysFunc, symbolsFunc) {
    var result = keysFunc(object);
    return isArray(object) ? result : arrayPush(result, symbolsFunc(object));
  }
  function baseGetTag(value) {
    if (value == null) {
      return value === void 0 ? undefinedTag : nullTag;
    }
    return symToStringTag && symToStringTag in Object(value) ? getRawTag(value) : objectToString(value);
  }
  function baseIsArguments(value) {
    return isObjectLike(value) && baseGetTag(value) == argsTag;
  }
  function baseIsEqual(value, other, bitmask, customizer, stack) {
    if (value === other) {
      return true;
    }
    if (value == null || other == null || !isObjectLike(value) && !isObjectLike(other)) {
      return value !== value && other !== other;
    }
    return baseIsEqualDeep(value, other, bitmask, customizer, baseIsEqual, stack);
  }
  function baseIsEqualDeep(object, other, bitmask, customizer, equalFunc, stack) {
    var objIsArr = isArray(object), othIsArr = isArray(other), objTag = objIsArr ? arrayTag : getTag(object), othTag = othIsArr ? arrayTag : getTag(other);
    objTag = objTag == argsTag ? objectTag : objTag;
    othTag = othTag == argsTag ? objectTag : othTag;
    var objIsObj = objTag == objectTag, othIsObj = othTag == objectTag, isSameTag = objTag == othTag;
    if (isSameTag && isBuffer(object)) {
      if (!isBuffer(other)) {
        return false;
      }
      objIsArr = true;
      objIsObj = false;
    }
    if (isSameTag && !objIsObj) {
      stack || (stack = new Stack());
      return objIsArr || isTypedArray(object) ? equalArrays(object, other, bitmask, customizer, equalFunc, stack) : equalByTag(object, other, objTag, bitmask, customizer, equalFunc, stack);
    }
    if (!(bitmask & COMPARE_PARTIAL_FLAG)) {
      var objIsWrapped = objIsObj && hasOwnProperty.call(object, "__wrapped__"), othIsWrapped = othIsObj && hasOwnProperty.call(other, "__wrapped__");
      if (objIsWrapped || othIsWrapped) {
        var objUnwrapped = objIsWrapped ? object.value() : object, othUnwrapped = othIsWrapped ? other.value() : other;
        stack || (stack = new Stack());
        return equalFunc(objUnwrapped, othUnwrapped, bitmask, customizer, stack);
      }
    }
    if (!isSameTag) {
      return false;
    }
    stack || (stack = new Stack());
    return equalObjects(object, other, bitmask, customizer, equalFunc, stack);
  }
  function baseIsNative(value) {
    if (!isObject(value) || isMasked(value)) {
      return false;
    }
    var pattern = isFunction(value) ? reIsNative : reIsHostCtor;
    return pattern.test(toSource(value));
  }
  function baseIsTypedArray(value) {
    return isObjectLike(value) && isLength(value.length) && !!typedArrayTags[baseGetTag(value)];
  }
  function baseKeys(object) {
    if (!isPrototype(object)) {
      return nativeKeys(object);
    }
    var result = [];
    for (var key in Object(object)) {
      if (hasOwnProperty.call(object, key) && key != "constructor") {
        result.push(key);
      }
    }
    return result;
  }
  function equalArrays(array, other, bitmask, customizer, equalFunc, stack) {
    var isPartial = bitmask & COMPARE_PARTIAL_FLAG, arrLength = array.length, othLength = other.length;
    if (arrLength != othLength && !(isPartial && othLength > arrLength)) {
      return false;
    }
    var stacked = stack.get(array);
    if (stacked && stack.get(other)) {
      return stacked == other;
    }
    var index = -1, result = true, seen = bitmask & COMPARE_UNORDERED_FLAG ? new SetCache() : void 0;
    stack.set(array, other);
    stack.set(other, array);
    while (++index < arrLength) {
      var arrValue = array[index], othValue = other[index];
      if (customizer) {
        var compared = isPartial ? customizer(othValue, arrValue, index, other, array, stack) : customizer(arrValue, othValue, index, array, other, stack);
      }
      if (compared !== void 0) {
        if (compared) {
          continue;
        }
        result = false;
        break;
      }
      if (seen) {
        if (!arraySome(other, function(othValue2, othIndex) {
          if (!cacheHas(seen, othIndex) && (arrValue === othValue2 || equalFunc(arrValue, othValue2, bitmask, customizer, stack))) {
            return seen.push(othIndex);
          }
        })) {
          result = false;
          break;
        }
      } else if (!(arrValue === othValue || equalFunc(arrValue, othValue, bitmask, customizer, stack))) {
        result = false;
        break;
      }
    }
    stack["delete"](array);
    stack["delete"](other);
    return result;
  }
  function equalByTag(object, other, tag, bitmask, customizer, equalFunc, stack) {
    switch (tag) {
      case dataViewTag:
        if (object.byteLength != other.byteLength || object.byteOffset != other.byteOffset) {
          return false;
        }
        object = object.buffer;
        other = other.buffer;
      case arrayBufferTag:
        if (object.byteLength != other.byteLength || !equalFunc(new Uint8Array2(object), new Uint8Array2(other))) {
          return false;
        }
        return true;
      case boolTag:
      case dateTag:
      case numberTag:
        return eq(+object, +other);
      case errorTag:
        return object.name == other.name && object.message == other.message;
      case regexpTag:
      case stringTag:
        return object == other + "";
      case mapTag:
        var convert = mapToArray;
      case setTag:
        var isPartial = bitmask & COMPARE_PARTIAL_FLAG;
        convert || (convert = setToArray);
        if (object.size != other.size && !isPartial) {
          return false;
        }
        var stacked = stack.get(object);
        if (stacked) {
          return stacked == other;
        }
        bitmask |= COMPARE_UNORDERED_FLAG;
        stack.set(object, other);
        var result = equalArrays(convert(object), convert(other), bitmask, customizer, equalFunc, stack);
        stack["delete"](object);
        return result;
      case symbolTag:
        if (symbolValueOf) {
          return symbolValueOf.call(object) == symbolValueOf.call(other);
        }
    }
    return false;
  }
  function equalObjects(object, other, bitmask, customizer, equalFunc, stack) {
    var isPartial = bitmask & COMPARE_PARTIAL_FLAG, objProps = getAllKeys(object), objLength = objProps.length, othProps = getAllKeys(other), othLength = othProps.length;
    if (objLength != othLength && !isPartial) {
      return false;
    }
    var index = objLength;
    while (index--) {
      var key = objProps[index];
      if (!(isPartial ? key in other : hasOwnProperty.call(other, key))) {
        return false;
      }
    }
    var stacked = stack.get(object);
    if (stacked && stack.get(other)) {
      return stacked == other;
    }
    var result = true;
    stack.set(object, other);
    stack.set(other, object);
    var skipCtor = isPartial;
    while (++index < objLength) {
      key = objProps[index];
      var objValue = object[key], othValue = other[key];
      if (customizer) {
        var compared = isPartial ? customizer(othValue, objValue, key, other, object, stack) : customizer(objValue, othValue, key, object, other, stack);
      }
      if (!(compared === void 0 ? objValue === othValue || equalFunc(objValue, othValue, bitmask, customizer, stack) : compared)) {
        result = false;
        break;
      }
      skipCtor || (skipCtor = key == "constructor");
    }
    if (result && !skipCtor) {
      var objCtor = object.constructor, othCtor = other.constructor;
      if (objCtor != othCtor && ("constructor" in object && "constructor" in other) && !(typeof objCtor == "function" && objCtor instanceof objCtor && typeof othCtor == "function" && othCtor instanceof othCtor)) {
        result = false;
      }
    }
    stack["delete"](object);
    stack["delete"](other);
    return result;
  }
  function getAllKeys(object) {
    return baseGetAllKeys(object, keys2, getSymbols);
  }
  function getMapData(map, key) {
    var data = map.__data__;
    return isKeyable(key) ? data[typeof key == "string" ? "string" : "hash"] : data.map;
  }
  function getNative(object, key) {
    var value = getValue(object, key);
    return baseIsNative(value) ? value : void 0;
  }
  function getRawTag(value) {
    var isOwn = hasOwnProperty.call(value, symToStringTag), tag = value[symToStringTag];
    try {
      value[symToStringTag] = void 0;
      var unmasked = true;
    } catch (e) {
    }
    var result = nativeObjectToString.call(value);
    if (unmasked) {
      if (isOwn) {
        value[symToStringTag] = tag;
      } else {
        delete value[symToStringTag];
      }
    }
    return result;
  }
  var getSymbols = !nativeGetSymbols ? stubArray : function(object) {
    if (object == null) {
      return [];
    }
    object = Object(object);
    return arrayFilter(nativeGetSymbols(object), function(symbol) {
      return propertyIsEnumerable.call(object, symbol);
    });
  };
  var getTag = baseGetTag;
  if (DataView && getTag(new DataView(new ArrayBuffer(1))) != dataViewTag || Map2 && getTag(new Map2()) != mapTag || Promise2 && getTag(Promise2.resolve()) != promiseTag || Set2 && getTag(new Set2()) != setTag || WeakMap && getTag(new WeakMap()) != weakMapTag) {
    getTag = function(value) {
      var result = baseGetTag(value), Ctor = result == objectTag ? value.constructor : void 0, ctorString = Ctor ? toSource(Ctor) : "";
      if (ctorString) {
        switch (ctorString) {
          case dataViewCtorString:
            return dataViewTag;
          case mapCtorString:
            return mapTag;
          case promiseCtorString:
            return promiseTag;
          case setCtorString:
            return setTag;
          case weakMapCtorString:
            return weakMapTag;
        }
      }
      return result;
    };
  }
  function isIndex(value, length) {
    length = length == null ? MAX_SAFE_INTEGER : length;
    return !!length && (typeof value == "number" || reIsUint.test(value)) && (value > -1 && value % 1 == 0 && value < length);
  }
  function isKeyable(value) {
    var type = typeof value;
    return type == "string" || type == "number" || type == "symbol" || type == "boolean" ? value !== "__proto__" : value === null;
  }
  function isMasked(func) {
    return !!maskSrcKey && maskSrcKey in func;
  }
  function isPrototype(value) {
    var Ctor = value && value.constructor, proto = typeof Ctor == "function" && Ctor.prototype || objectProto;
    return value === proto;
  }
  function objectToString(value) {
    return nativeObjectToString.call(value);
  }
  function toSource(func) {
    if (func != null) {
      try {
        return funcToString.call(func);
      } catch (e) {
      }
      try {
        return func + "";
      } catch (e) {
      }
    }
    return "";
  }
  function eq(value, other) {
    return value === other || value !== value && other !== other;
  }
  var isArguments = baseIsArguments(/* @__PURE__ */ function() {
    return arguments;
  }()) ? baseIsArguments : function(value) {
    return isObjectLike(value) && hasOwnProperty.call(value, "callee") && !propertyIsEnumerable.call(value, "callee");
  };
  var isArray = Array.isArray;
  function isArrayLike(value) {
    return value != null && isLength(value.length) && !isFunction(value);
  }
  var isBuffer = nativeIsBuffer || stubFalse;
  function isEqual(value, other) {
    return baseIsEqual(value, other);
  }
  function isFunction(value) {
    if (!isObject(value)) {
      return false;
    }
    var tag = baseGetTag(value);
    return tag == funcTag || tag == genTag || tag == asyncTag || tag == proxyTag;
  }
  function isLength(value) {
    return typeof value == "number" && value > -1 && value % 1 == 0 && value <= MAX_SAFE_INTEGER;
  }
  function isObject(value) {
    var type = typeof value;
    return value != null && (type == "object" || type == "function");
  }
  function isObjectLike(value) {
    return value != null && typeof value == "object";
  }
  var isTypedArray = nodeIsTypedArray ? baseUnary(nodeIsTypedArray) : baseIsTypedArray;
  function keys2(object) {
    return isArrayLike(object) ? arrayLikeKeys(object) : baseKeys(object);
  }
  function stubArray() {
    return [];
  }
  function stubFalse() {
    return false;
  }
  module.exports = isEqual;
})(lodash_isequal, lodash_isequal.exports);
var lodash_isequalExports = lodash_isequal.exports;
const Bi = /* @__PURE__ */ getDefaultExportFromCjs(lodash_isequalExports);
var define_process_env_default = {};
function Vi(r, e) {
  if (r.length >= 255)
    throw new TypeError("Alphabet too long");
  for (var t = new Uint8Array(256), i = 0; i < t.length; i++)
    t[i] = 255;
  for (var s = 0; s < r.length; s++) {
    var n2 = r.charAt(s), o = n2.charCodeAt(0);
    if (t[o] !== 255)
      throw new TypeError(n2 + " is ambiguous");
    t[o] = s;
  }
  var a3 = r.length, h4 = r.charAt(0), l2 = Math.log(a3) / Math.log(256), d2 = Math.log(256) / Math.log(a3);
  function p2(u2) {
    if (u2 instanceof Uint8Array || (ArrayBuffer.isView(u2) ? u2 = new Uint8Array(u2.buffer, u2.byteOffset, u2.byteLength) : Array.isArray(u2) && (u2 = Uint8Array.from(u2))), !(u2 instanceof Uint8Array))
      throw new TypeError("Expected Uint8Array");
    if (u2.length === 0)
      return "";
    for (var m = 0, z2 = 0, I = 0, _2 = u2.length; I !== _2 && u2[I] === 0; )
      I++, m++;
    for (var S3 = (_2 - I) * d2 + 1 >>> 0, b3 = new Uint8Array(S3); I !== _2; ) {
      for (var T = u2[I], A = 0, C2 = S3 - 1; (T !== 0 || A < z2) && C2 !== -1; C2--, A++)
        T += 256 * b3[C2] >>> 0, b3[C2] = T % a3 >>> 0, T = T / a3 >>> 0;
      if (T !== 0)
        throw new Error("Non-zero carry");
      z2 = A, I++;
    }
    for (var x2 = S3 - z2; x2 !== S3 && b3[x2] === 0; )
      x2++;
    for (var j2 = h4.repeat(m); x2 < S3; ++x2)
      j2 += r.charAt(b3[x2]);
    return j2;
  }
  function y2(u2) {
    if (typeof u2 != "string")
      throw new TypeError("Expected String");
    if (u2.length === 0)
      return new Uint8Array();
    var m = 0;
    if (u2[m] !== " ") {
      for (var z2 = 0, I = 0; u2[m] === h4; )
        z2++, m++;
      for (var _2 = (u2.length - m) * l2 + 1 >>> 0, S3 = new Uint8Array(_2); u2[m]; ) {
        var b3 = t[u2.charCodeAt(m)];
        if (b3 === 255)
          return;
        for (var T = 0, A = _2 - 1; (b3 !== 0 || T < I) && A !== -1; A--, T++)
          b3 += a3 * S3[A] >>> 0, S3[A] = b3 % 256 >>> 0, b3 = b3 / 256 >>> 0;
        if (b3 !== 0)
          throw new Error("Non-zero carry");
        I = T, m++;
      }
      if (u2[m] !== " ") {
        for (var C2 = _2 - I; C2 !== _2 && S3[C2] === 0; )
          C2++;
        for (var x2 = new Uint8Array(z2 + (_2 - C2)), j2 = z2; C2 !== _2; )
          x2[j2++] = S3[C2++];
        return x2;
      }
    }
  }
  function M(u2) {
    var m = y2(u2);
    if (m)
      return m;
    throw new Error(`Non-${e} character`);
  }
  return { encode: p2, decodeUnsafe: y2, decode: M };
}
var qi = Vi, ji = qi;
const Ne = (r) => {
  if (r instanceof Uint8Array && r.constructor.name === "Uint8Array")
    return r;
  if (r instanceof ArrayBuffer)
    return new Uint8Array(r);
  if (ArrayBuffer.isView(r))
    return new Uint8Array(r.buffer, r.byteOffset, r.byteLength);
  throw new Error("Unknown type, must be binary type");
}, Gi = (r) => new TextEncoder().encode(r), Yi = (r) => new TextDecoder().decode(r);
class Hi {
  constructor(e, t, i) {
    this.name = e, this.prefix = t, this.baseEncode = i;
  }
  encode(e) {
    if (e instanceof Uint8Array)
      return `${this.prefix}${this.baseEncode(e)}`;
    throw Error("Unknown type, must be binary type");
  }
}
class Ji {
  constructor(e, t, i) {
    if (this.name = e, this.prefix = t, t.codePointAt(0) === void 0)
      throw new Error("Invalid prefix character");
    this.prefixCodePoint = t.codePointAt(0), this.baseDecode = i;
  }
  decode(e) {
    if (typeof e == "string") {
      if (e.codePointAt(0) !== this.prefixCodePoint)
        throw Error(`Unable to decode multibase string ${JSON.stringify(e)}, ${this.name} decoder only supports inputs prefixed with ${this.prefix}`);
      return this.baseDecode(e.slice(this.prefix.length));
    } else
      throw Error("Can only multibase decode strings");
  }
  or(e) {
    return Ue(this, e);
  }
}
class Wi {
  constructor(e) {
    this.decoders = e;
  }
  or(e) {
    return Ue(this, e);
  }
  decode(e) {
    const t = e[0], i = this.decoders[t];
    if (i)
      return i.decode(e);
    throw RangeError(`Unable to decode multibase string ${JSON.stringify(e)}, only inputs prefixed with ${Object.keys(this.decoders)} are supported`);
  }
}
const Ue = (r, e) => new Wi({ ...r.decoders || { [r.prefix]: r }, ...e.decoders || { [e.prefix]: e } });
class Xi {
  constructor(e, t, i, s) {
    this.name = e, this.prefix = t, this.baseEncode = i, this.baseDecode = s, this.encoder = new Hi(e, t, i), this.decoder = new Ji(e, t, s);
  }
  encode(e) {
    return this.encoder.encode(e);
  }
  decode(e) {
    return this.decoder.decode(e);
  }
}
const X = ({ name: r, prefix: e, encode: t, decode: i }) => new Xi(r, e, t, i), B = ({ prefix: r, name: e, alphabet: t }) => {
  const { encode: i, decode: s } = ji(t, e);
  return X({ prefix: r, name: e, encode: i, decode: (n2) => Ne(s(n2)) });
}, Qi = (r, e, t, i) => {
  const s = {};
  for (let d2 = 0; d2 < e.length; ++d2)
    s[e[d2]] = d2;
  let n2 = r.length;
  for (; r[n2 - 1] === "="; )
    --n2;
  const o = new Uint8Array(n2 * t / 8 | 0);
  let a3 = 0, h4 = 0, l2 = 0;
  for (let d2 = 0; d2 < n2; ++d2) {
    const p2 = s[r[d2]];
    if (p2 === void 0)
      throw new SyntaxError(`Non-${i} character`);
    h4 = h4 << t | p2, a3 += t, a3 >= 8 && (a3 -= 8, o[l2++] = 255 & h4 >> a3);
  }
  if (a3 >= t || 255 & h4 << 8 - a3)
    throw new SyntaxError("Unexpected end of data");
  return o;
}, Zi = (r, e, t) => {
  const i = e[e.length - 1] === "=", s = (1 << t) - 1;
  let n2 = "", o = 0, a3 = 0;
  for (let h4 = 0; h4 < r.length; ++h4)
    for (a3 = a3 << 8 | r[h4], o += 8; o > t; )
      o -= t, n2 += e[s & a3 >> o];
  if (o && (n2 += e[s & a3 << t - o]), i)
    for (; n2.length * t & 7; )
      n2 += "=";
  return n2;
}, g2 = ({ name: r, prefix: e, bitsPerChar: t, alphabet: i }) => X({ prefix: e, name: r, encode(s) {
  return Zi(s, i, t);
}, decode(s) {
  return Qi(s, i, t, r);
} }), es = X({ prefix: "\0", name: "identity", encode: (r) => Yi(r), decode: (r) => Gi(r) });
var ts = Object.freeze({ __proto__: null, identity: es });
const is = g2({ prefix: "0", name: "base2", alphabet: "01", bitsPerChar: 1 });
var ss = Object.freeze({ __proto__: null, base2: is });
const rs = g2({ prefix: "7", name: "base8", alphabet: "01234567", bitsPerChar: 3 });
var ns = Object.freeze({ __proto__: null, base8: rs });
const os = B({ prefix: "9", name: "base10", alphabet: "0123456789" });
var as = Object.freeze({ __proto__: null, base10: os });
const hs = g2({ prefix: "f", name: "base16", alphabet: "0123456789abcdef", bitsPerChar: 4 }), cs = g2({ prefix: "F", name: "base16upper", alphabet: "0123456789ABCDEF", bitsPerChar: 4 });
var us = Object.freeze({ __proto__: null, base16: hs, base16upper: cs });
const ls = g2({ prefix: "b", name: "base32", alphabet: "abcdefghijklmnopqrstuvwxyz234567", bitsPerChar: 5 }), ds = g2({ prefix: "B", name: "base32upper", alphabet: "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567", bitsPerChar: 5 }), gs = g2({ prefix: "c", name: "base32pad", alphabet: "abcdefghijklmnopqrstuvwxyz234567=", bitsPerChar: 5 }), ps = g2({ prefix: "C", name: "base32padupper", alphabet: "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567=", bitsPerChar: 5 }), Ds = g2({ prefix: "v", name: "base32hex", alphabet: "0123456789abcdefghijklmnopqrstuv", bitsPerChar: 5 }), ys = g2({ prefix: "V", name: "base32hexupper", alphabet: "0123456789ABCDEFGHIJKLMNOPQRSTUV", bitsPerChar: 5 }), ms = g2({ prefix: "t", name: "base32hexpad", alphabet: "0123456789abcdefghijklmnopqrstuv=", bitsPerChar: 5 }), bs = g2({ prefix: "T", name: "base32hexpadupper", alphabet: "0123456789ABCDEFGHIJKLMNOPQRSTUV=", bitsPerChar: 5 }), fs = g2({ prefix: "h", name: "base32z", alphabet: "ybndrfg8ejkmcpqxot1uwisza345h769", bitsPerChar: 5 });
var Es = Object.freeze({ __proto__: null, base32: ls, base32upper: ds, base32pad: gs, base32padupper: ps, base32hex: Ds, base32hexupper: ys, base32hexpad: ms, base32hexpadupper: bs, base32z: fs });
const ws = B({ prefix: "k", name: "base36", alphabet: "0123456789abcdefghijklmnopqrstuvwxyz" }), vs = B({ prefix: "K", name: "base36upper", alphabet: "0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ" });
var Is = Object.freeze({ __proto__: null, base36: ws, base36upper: vs });
const Cs = B({ name: "base58btc", prefix: "z", alphabet: "123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz" }), Rs = B({ name: "base58flickr", prefix: "Z", alphabet: "123456789abcdefghijkmnopqrstuvwxyzABCDEFGHJKLMNPQRSTUVWXYZ" });
var _s = Object.freeze({ __proto__: null, base58btc: Cs, base58flickr: Rs });
const Ss = g2({ prefix: "m", name: "base64", alphabet: "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/", bitsPerChar: 6 }), Ts = g2({ prefix: "M", name: "base64pad", alphabet: "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/=", bitsPerChar: 6 }), Ps = g2({ prefix: "u", name: "base64url", alphabet: "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_", bitsPerChar: 6 }), xs = g2({ prefix: "U", name: "base64urlpad", alphabet: "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_=", bitsPerChar: 6 });
var Os = Object.freeze({ __proto__: null, base64: Ss, base64pad: Ts, base64url: Ps, base64urlpad: xs });
const Le = Array.from("🚀🪐☄🛰🌌🌑🌒🌓🌔🌕🌖🌗🌘🌍🌏🌎🐉☀💻🖥💾💿😂❤😍🤣😊🙏💕😭😘👍😅👏😁🔥🥰💔💖💙😢🤔😆🙄💪😉☺👌🤗💜😔😎😇🌹🤦🎉💞✌✨🤷😱😌🌸🙌😋💗💚😏💛🙂💓🤩😄😀🖤😃💯🙈👇🎶😒🤭❣😜💋👀😪😑💥🙋😞😩😡🤪👊🥳😥🤤👉💃😳✋😚😝😴🌟😬🙃🍀🌷😻😓⭐✅🥺🌈😈🤘💦✔😣🏃💐☹🎊💘😠☝😕🌺🎂🌻😐🖕💝🙊😹🗣💫💀👑🎵🤞😛🔴😤🌼😫⚽🤙☕🏆🤫👈😮🙆🍻🍃🐶💁😲🌿🧡🎁⚡🌞🎈❌✊👋😰🤨😶🤝🚶💰🍓💢🤟🙁🚨💨🤬✈🎀🍺🤓😙💟🌱😖👶🥴▶➡❓💎💸⬇😨🌚🦋😷🕺⚠🙅😟😵👎🤲🤠🤧📌🔵💅🧐🐾🍒😗🤑🌊🤯🐷☎💧😯💆👆🎤🙇🍑❄🌴💣🐸💌📍🥀🤢👅💡💩👐📸👻🤐🤮🎼🥵🚩🍎🍊👼💍📣🥂"), As = Le.reduce((r, e, t) => (r[t] = e, r), []), zs = Le.reduce((r, e, t) => (r[e.codePointAt(0)] = t, r), []);
function Ns(r) {
  return r.reduce((e, t) => (e += As[t], e), "");
}
function Us(r) {
  const e = [];
  for (const t of r) {
    const i = zs[t.codePointAt(0)];
    if (i === void 0)
      throw new Error(`Non-base256emoji character: ${t}`);
    e.push(i);
  }
  return new Uint8Array(e);
}
const Ls = X({ prefix: "🚀", name: "base256emoji", encode: Ns, decode: Us });
var Fs = Object.freeze({ __proto__: null, base256emoji: Ls }), $s = $e, Fe = 128, Ms = 127, ks = ~Ms, Ks = Math.pow(2, 31);
function $e(r, e, t) {
  e = e || [], t = t || 0;
  for (var i = t; r >= Ks; )
    e[t++] = r & 255 | Fe, r /= 128;
  for (; r & ks; )
    e[t++] = r & 255 | Fe, r >>>= 7;
  return e[t] = r | 0, $e.bytes = t - i + 1, e;
}
var Bs = he, Vs = 128, Me = 127;
function he(r, i) {
  var t = 0, i = i || 0, s = 0, n2 = i, o, a3 = r.length;
  do {
    if (n2 >= a3)
      throw he.bytes = 0, new RangeError("Could not decode varint");
    o = r[n2++], t += s < 28 ? (o & Me) << s : (o & Me) * Math.pow(2, s), s += 7;
  } while (o >= Vs);
  return he.bytes = n2 - i, t;
}
var qs = Math.pow(2, 7), js = Math.pow(2, 14), Gs = Math.pow(2, 21), Ys = Math.pow(2, 28), Hs = Math.pow(2, 35), Js = Math.pow(2, 42), Ws = Math.pow(2, 49), Xs = Math.pow(2, 56), Qs = Math.pow(2, 63), Zs = function(r) {
  return r < qs ? 1 : r < js ? 2 : r < Gs ? 3 : r < Ys ? 4 : r < Hs ? 5 : r < Js ? 6 : r < Ws ? 7 : r < Xs ? 8 : r < Qs ? 9 : 10;
}, er = { encode: $s, decode: Bs, encodingLength: Zs }, ke = er;
const Ke = (r, e, t = 0) => (ke.encode(r, e, t), e), Be = (r) => ke.encodingLength(r), ce = (r, e) => {
  const t = e.byteLength, i = Be(r), s = i + Be(t), n2 = new Uint8Array(s + t);
  return Ke(r, n2, 0), Ke(t, n2, i), n2.set(e, s), new tr(r, t, e, n2);
};
class tr {
  constructor(e, t, i, s) {
    this.code = e, this.size = t, this.digest = i, this.bytes = s;
  }
}
const Ve = ({ name: r, code: e, encode: t }) => new ir(r, e, t);
class ir {
  constructor(e, t, i) {
    this.name = e, this.code = t, this.encode = i;
  }
  digest(e) {
    if (e instanceof Uint8Array) {
      const t = this.encode(e);
      return t instanceof Uint8Array ? ce(this.code, t) : t.then((i) => ce(this.code, i));
    } else
      throw Error("Unknown type, must be binary type");
  }
}
const qe = (r) => async (e) => new Uint8Array(await crypto.subtle.digest(r, e)), sr = Ve({ name: "sha2-256", code: 18, encode: qe("SHA-256") }), rr = Ve({ name: "sha2-512", code: 19, encode: qe("SHA-512") });
var nr = Object.freeze({ __proto__: null, sha256: sr, sha512: rr });
const je = 0, or = "identity", Ge = Ne, ar = (r) => ce(je, Ge(r)), hr = { code: je, name: or, encode: Ge, digest: ar };
var cr = Object.freeze({ __proto__: null, identity: hr });
new TextEncoder(), new TextDecoder();
const Ye = { ...ts, ...ss, ...ns, ...as, ...us, ...Es, ...Is, ..._s, ...Os, ...Fs };
({ ...nr, ...cr });
function He(r) {
  return globalThis.Buffer != null ? new Uint8Array(r.buffer, r.byteOffset, r.byteLength) : r;
}
function ur(r = 0) {
  return globalThis.Buffer != null && globalThis.Buffer.allocUnsafe != null ? He(globalThis.Buffer.allocUnsafe(r)) : new Uint8Array(r);
}
function Je(r, e, t, i) {
  return { name: r, prefix: e, encoder: { name: r, prefix: e, encode: t }, decoder: { decode: i } };
}
const We = Je("utf8", "u", (r) => "u" + new TextDecoder("utf8").decode(r), (r) => new TextEncoder().encode(r.substring(1))), ue = Je("ascii", "a", (r) => {
  let e = "a";
  for (let t = 0; t < r.length; t++)
    e += String.fromCharCode(r[t]);
  return e;
}, (r) => {
  r = r.substring(1);
  const e = ur(r.length);
  for (let t = 0; t < r.length; t++)
    e[t] = r.charCodeAt(t);
  return e;
}), lr = { utf8: We, "utf-8": We, hex: Ye.base16, latin1: ue, ascii: ue, binary: ue, ...Ye };
function dr(r, e = "utf8") {
  const t = lr[e];
  if (!t)
    throw new Error(`Unsupported encoding "${e}"`);
  return (e === "utf8" || e === "utf-8") && globalThis.Buffer != null && globalThis.Buffer.from != null ? He(globalThis.Buffer.from(r, "utf-8")) : t.decoder.decode(`${t.prefix}${r}`);
}
const le = "wc", Xe = 2, Q = "core", O = `${le}@2:${Q}:`, Qe = { name: Q, logger: "error" }, Ze = { database: ":memory:" }, et = "crypto", de = "client_ed25519_seed", tt = cjs$3.ONE_DAY, it = "keychain", st = "0.3", rt = "messages", nt = "0.3", ot = cjs$3.SIX_HOURS, at = "publisher", ht = "irn", ct = "error", ge = "wss://relay.walletconnect.com", pe = "wss://relay.walletconnect.org", ut = "relayer", D = { message: "relayer_message", message_ack: "relayer_message_ack", connect: "relayer_connect", disconnect: "relayer_disconnect", error: "relayer_error", connection_stalled: "relayer_connection_stalled", transport_closed: "relayer_transport_closed", publish: "relayer_publish" }, lt = "_subscription", P = { payload: "payload", connect: "connect", disconnect: "disconnect", error: "error" }, dt = cjs$3.ONE_SECOND, gr = { database: ":memory:" }, gt = "2.10.6", pt = 1e4, Dt = "0.3", yt = "WALLETCONNECT_CLIENT_ID", w = { created: "subscription_created", deleted: "subscription_deleted", expired: "subscription_expired", disabled: "subscription_disabled", sync: "subscription_sync", resubscribed: "subscription_resubscribed" }, pr = cjs$3.THIRTY_DAYS, mt = "subscription", bt = "0.3", ft = cjs$3.FIVE_SECONDS * 1e3, Et = "pairing", wt = "0.3", Dr = cjs$3.THIRTY_DAYS, F = { wc_pairingDelete: { req: { ttl: cjs$3.ONE_DAY, prompt: false, tag: 1e3 }, res: { ttl: cjs$3.ONE_DAY, prompt: false, tag: 1001 } }, wc_pairingPing: { req: { ttl: cjs$3.THIRTY_SECONDS, prompt: false, tag: 1002 }, res: { ttl: cjs$3.THIRTY_SECONDS, prompt: false, tag: 1003 } }, unregistered_method: { req: { ttl: cjs$3.ONE_DAY, prompt: false, tag: 0 }, res: { ttl: cjs$3.ONE_DAY, prompt: false, tag: 0 } } }, V = { create: "pairing_create", expire: "pairing_expire", delete: "pairing_delete", ping: "pairing_ping" }, R = { created: "history_created", updated: "history_updated", deleted: "history_deleted", sync: "history_sync" }, vt = "history", It = "0.3", Ct = "expirer", v = { created: "expirer_created", deleted: "expirer_deleted", expired: "expirer_expired", sync: "expirer_sync" }, Rt = "0.3", yr = cjs$3.ONE_DAY, Z = "verify-api", $ = "https://verify.walletconnect.com", ee = "https://verify.walletconnect.org", _t = [$, ee];
class St {
  constructor(e, t) {
    this.core = e, this.logger = t, this.keychain = /* @__PURE__ */ new Map(), this.name = it, this.version = st, this.initialized = false, this.storagePrefix = O, this.init = async () => {
      if (!this.initialized) {
        const i = await this.getKeyChain();
        typeof i < "u" && (this.keychain = i), this.initialized = true;
      }
    }, this.has = (i) => (this.isInitialized(), this.keychain.has(i)), this.set = async (i, s) => {
      this.isInitialized(), this.keychain.set(i, s), await this.persist();
    }, this.get = (i) => {
      this.isInitialized();
      const s = this.keychain.get(i);
      if (typeof s > "u") {
        const { message: n2 } = N$1("NO_MATCHING_KEY", `${this.name}: ${i}`);
        throw new Error(n2);
      }
      return s;
    }, this.del = async (i) => {
      this.isInitialized(), this.keychain.delete(i), await this.persist();
    }, this.core = e, this.logger = cjs$1.generateChildLogger(t, this.name);
  }
  get context() {
    return cjs$1.getLoggerContext(this.logger);
  }
  get storageKey() {
    return this.storagePrefix + this.version + this.core.customStoragePrefix + "//" + this.name;
  }
  async setKeyChain(e) {
    await this.core.storage.setItem(this.storageKey, rt$1(e));
  }
  async getKeyChain() {
    const e = await this.core.storage.getItem(this.storageKey);
    return typeof e < "u" ? ot$1(e) : void 0;
  }
  async persist() {
    await this.setKeyChain(this.keychain);
  }
  isInitialized() {
    if (!this.initialized) {
      const { message: e } = N$1("NOT_INITIALIZED", this.name);
      throw new Error(e);
    }
  }
}
class Tt {
  constructor(e, t, i) {
    this.core = e, this.logger = t, this.name = et, this.initialized = false, this.init = async () => {
      this.initialized || (await this.keychain.init(), this.initialized = true);
    }, this.hasKeys = (s) => (this.isInitialized(), this.keychain.has(s)), this.getClientId = async () => {
      this.isInitialized();
      const s = await this.getClientSeed(), n2 = generateKeyPair(s);
      return encodeIss(n2.publicKey);
    }, this.generateKeyPair = () => {
      this.isInitialized();
      const s = kn();
      return this.setPrivateKey(s.publicKey, s.privateKey);
    }, this.signJWT = async (s) => {
      this.isInitialized();
      const n2 = await this.getClientSeed(), o = generateKeyPair(n2), a3 = Vn(), h4 = tt;
      return await signJWT(a3, s, h4, o);
    }, this.generateSharedKey = (s, n2, o) => {
      this.isInitialized();
      const a3 = this.getPrivateKey(s), h4 = Mn(a3, n2);
      return this.setSymKey(h4, o);
    }, this.setSymKey = async (s, n2) => {
      this.isInitialized();
      const o = n2 || Kn(s);
      return await this.keychain.set(o, s), o;
    }, this.deleteKeyPair = async (s) => {
      this.isInitialized(), await this.keychain.del(s);
    }, this.deleteSymKey = async (s) => {
      this.isInitialized(), await this.keychain.del(s);
    }, this.encode = async (s, n2, o) => {
      this.isInitialized();
      const a3 = Te(o), h4 = safeJsonStringify(n2);
      if (qn(a3)) {
        const y2 = a3.senderPublicKey, M = a3.receiverPublicKey;
        s = await this.generateSharedKey(y2, M);
      }
      const l2 = this.getSymKey(s), { type: d2, senderPublicKey: p2 } = a3;
      return xn({ type: d2, symKey: l2, message: h4, senderPublicKey: p2 });
    }, this.decode = async (s, n2, o) => {
      this.isInitialized();
      const a3 = Hn(n2, o);
      if (qn(a3)) {
        const h4 = a3.receiverPublicKey, l2 = a3.senderPublicKey;
        s = await this.generateSharedKey(h4, l2);
      }
      try {
        const h4 = this.getSymKey(s), l2 = Fn({ symKey: h4, encoded: n2 });
        return safeJsonParse(l2);
      } catch (h4) {
        this.logger.error(`Failed to decode message from topic: '${s}', clientId: '${await this.getClientId()}'`), this.logger.error(h4);
      }
    }, this.getPayloadType = (s) => {
      const n2 = ee$1(s);
      return $$1(n2.type);
    }, this.getPayloadSenderPublicKey = (s) => {
      const n2 = ee$1(s);
      return n2.senderPublicKey ? toString(n2.senderPublicKey, p$1) : void 0;
    }, this.core = e, this.logger = cjs$1.generateChildLogger(t, this.name), this.keychain = i || new St(this.core, this.logger);
  }
  get context() {
    return cjs$1.getLoggerContext(this.logger);
  }
  async setPrivateKey(e, t) {
    return await this.keychain.set(e, t), e;
  }
  getPrivateKey(e) {
    return this.keychain.get(e);
  }
  async getClientSeed() {
    let e = "";
    try {
      e = this.keychain.get(de);
    } catch {
      e = Vn(), await this.keychain.set(de, e);
    }
    return dr(e, "base16");
  }
  getSymKey(e) {
    return this.keychain.get(e);
  }
  isInitialized() {
    if (!this.initialized) {
      const { message: e } = N$1("NOT_INITIALIZED", this.name);
      throw new Error(e);
    }
  }
}
class Pt extends a$1 {
  constructor(e, t) {
    super(e, t), this.logger = e, this.core = t, this.messages = /* @__PURE__ */ new Map(), this.name = rt, this.version = nt, this.initialized = false, this.storagePrefix = O, this.init = async () => {
      if (!this.initialized) {
        this.logger.trace("Initialized");
        try {
          const i = await this.getRelayerMessages();
          typeof i < "u" && (this.messages = i), this.logger.debug(`Successfully Restored records for ${this.name}`), this.logger.trace({ type: "method", method: "restore", size: this.messages.size });
        } catch (i) {
          this.logger.debug(`Failed to Restore records for ${this.name}`), this.logger.error(i);
        } finally {
          this.initialized = true;
        }
      }
    }, this.set = async (i, s) => {
      this.isInitialized();
      const n2 = Ln(s);
      let o = this.messages.get(i);
      return typeof o > "u" && (o = {}), typeof o[n2] < "u" || (o[n2] = s, this.messages.set(i, o), await this.persist()), n2;
    }, this.get = (i) => {
      this.isInitialized();
      let s = this.messages.get(i);
      return typeof s > "u" && (s = {}), s;
    }, this.has = (i, s) => {
      this.isInitialized();
      const n2 = this.get(i), o = Ln(s);
      return typeof n2[o] < "u";
    }, this.del = async (i) => {
      this.isInitialized(), this.messages.delete(i), await this.persist();
    }, this.logger = cjs$1.generateChildLogger(e, this.name), this.core = t;
  }
  get context() {
    return cjs$1.getLoggerContext(this.logger);
  }
  get storageKey() {
    return this.storagePrefix + this.version + this.core.customStoragePrefix + "//" + this.name;
  }
  async setRelayerMessages(e) {
    await this.core.storage.setItem(this.storageKey, rt$1(e));
  }
  async getRelayerMessages() {
    const e = await this.core.storage.getItem(this.storageKey);
    return typeof e < "u" ? ot$1(e) : void 0;
  }
  async persist() {
    await this.setRelayerMessages(this.messages);
  }
  isInitialized() {
    if (!this.initialized) {
      const { message: e } = N$1("NOT_INITIALIZED", this.name);
      throw new Error(e);
    }
  }
}
class mr extends u {
  constructor(e, t) {
    super(e, t), this.relayer = e, this.logger = t, this.events = new eventsExports.EventEmitter(), this.name = at, this.queue = /* @__PURE__ */ new Map(), this.publishTimeout = cjs$3.toMiliseconds(cjs$3.TEN_SECONDS), this.needsTransportRestart = false, this.publish = async (i, s, n2) => {
      var o;
      this.logger.debug("Publishing Payload"), this.logger.trace({ type: "method", method: "publish", params: { topic: i, message: s, opts: n2 } });
      try {
        const a3 = (n2 == null ? void 0 : n2.ttl) || ot, h4 = vt$1(n2), l2 = (n2 == null ? void 0 : n2.prompt) || false, d2 = (n2 == null ? void 0 : n2.tag) || 0, p2 = (n2 == null ? void 0 : n2.id) || getBigIntRpcId().toString(), y2 = { topic: i, message: s, opts: { ttl: a3, relay: h4, prompt: l2, tag: d2, id: p2 } }, M = setTimeout(() => this.queue.set(p2, y2), this.publishTimeout);
        try {
          await await ut$1(this.rpcPublish(i, s, a3, h4, l2, d2, p2), this.publishTimeout, "Failed to publish payload, please try again."), this.removeRequestFromQueue(p2), this.relayer.events.emit(D.publish, y2);
        } catch (u2) {
          if (this.logger.debug("Publishing Payload stalled"), this.needsTransportRestart = true, (o = n2 == null ? void 0 : n2.internal) != null && o.throwOnFailedPublish)
            throw this.removeRequestFromQueue(p2), u2;
          return;
        } finally {
          clearTimeout(M);
        }
        this.logger.debug("Successfully Published Payload"), this.logger.trace({ type: "method", method: "publish", params: { topic: i, message: s, opts: n2 } });
      } catch (a3) {
        throw this.logger.debug("Failed to Publish Payload"), this.logger.error(a3), a3;
      }
    }, this.on = (i, s) => {
      this.events.on(i, s);
    }, this.once = (i, s) => {
      this.events.once(i, s);
    }, this.off = (i, s) => {
      this.events.off(i, s);
    }, this.removeListener = (i, s) => {
      this.events.removeListener(i, s);
    }, this.relayer = e, this.logger = cjs$1.generateChildLogger(t, this.name), this.registerEventListeners();
  }
  get context() {
    return cjs$1.getLoggerContext(this.logger);
  }
  rpcPublish(e, t, i, s, n2, o, a3) {
    var h4, l2, d2, p2;
    const y2 = { method: Et$1(s.protocol).publish, params: { topic: e, message: t, ttl: i, prompt: n2, tag: o }, id: a3 };
    return w$2((h4 = y2.params) == null ? void 0 : h4.prompt) && ((l2 = y2.params) == null || delete l2.prompt), w$2((d2 = y2.params) == null ? void 0 : d2.tag) && ((p2 = y2.params) == null || delete p2.tag), this.logger.debug("Outgoing Relay Payload"), this.logger.trace({ type: "message", direction: "outgoing", request: y2 }), this.relayer.request(y2);
  }
  removeRequestFromQueue(e) {
    this.queue.delete(e);
  }
  checkQueue() {
    this.queue.forEach(async (e) => {
      const { topic: t, message: i, opts: s } = e;
      await this.publish(t, i, s);
    });
  }
  registerEventListeners() {
    this.relayer.core.heartbeat.on(cjs$2.HEARTBEAT_EVENTS.pulse, () => {
      if (this.needsTransportRestart) {
        this.needsTransportRestart = false, this.relayer.events.emit(D.connection_stalled);
        return;
      }
      this.checkQueue();
    }), this.relayer.on(D.message_ack, (e) => {
      this.removeRequestFromQueue(e.id.toString());
    });
  }
}
class br {
  constructor() {
    this.map = /* @__PURE__ */ new Map(), this.set = (e, t) => {
      const i = this.get(e);
      this.exists(e, t) || this.map.set(e, [...i, t]);
    }, this.get = (e) => this.map.get(e) || [], this.exists = (e, t) => this.get(e).includes(t), this.delete = (e, t) => {
      if (typeof t > "u") {
        this.map.delete(e);
        return;
      }
      if (!this.map.has(e))
        return;
      const i = this.get(e);
      if (!this.exists(e, t))
        return;
      const s = i.filter((n2) => n2 !== t);
      if (!s.length) {
        this.map.delete(e);
        return;
      }
      this.map.set(e, s);
    }, this.clear = () => {
      this.map.clear();
    };
  }
  get topics() {
    return Array.from(this.map.keys());
  }
}
var fr = Object.defineProperty, Er = Object.defineProperties, wr = Object.getOwnPropertyDescriptors, xt = Object.getOwnPropertySymbols, vr = Object.prototype.hasOwnProperty, Ir = Object.prototype.propertyIsEnumerable, Ot = (r, e, t) => e in r ? fr(r, e, { enumerable: true, configurable: true, writable: true, value: t }) : r[e] = t, q = (r, e) => {
  for (var t in e || (e = {}))
    vr.call(e, t) && Ot(r, t, e[t]);
  if (xt)
    for (var t of xt(e))
      Ir.call(e, t) && Ot(r, t, e[t]);
  return r;
}, De = (r, e) => Er(r, wr(e));
class At extends d {
  constructor(e, t) {
    super(e, t), this.relayer = e, this.logger = t, this.subscriptions = /* @__PURE__ */ new Map(), this.topicMap = new br(), this.events = new eventsExports.EventEmitter(), this.name = mt, this.version = bt, this.pending = /* @__PURE__ */ new Map(), this.cached = [], this.initialized = false, this.pendingSubscriptionWatchLabel = "pending_sub_watch_label", this.pollingInterval = 20, this.storagePrefix = O, this.subscribeTimeout = 1e4, this.restartInProgress = false, this.batchSubscribeTopicsLimit = 500, this.init = async () => {
      this.initialized || (this.logger.trace("Initialized"), this.registerEventListeners(), this.clientId = await this.relayer.core.crypto.getClientId());
    }, this.subscribe = async (i, s) => {
      await this.restartToComplete(), this.isInitialized(), this.logger.debug("Subscribing Topic"), this.logger.trace({ type: "method", method: "subscribe", params: { topic: i, opts: s } });
      try {
        const n2 = vt$1(s), o = { topic: i, relay: n2 };
        this.pending.set(i, o);
        const a3 = await this.rpcSubscribe(i, n2);
        return this.onSubscribe(a3, o), this.logger.debug("Successfully Subscribed Topic"), this.logger.trace({ type: "method", method: "subscribe", params: { topic: i, opts: s } }), a3;
      } catch (n2) {
        throw this.logger.debug("Failed to Subscribe Topic"), this.logger.error(n2), n2;
      }
    }, this.unsubscribe = async (i, s) => {
      await this.restartToComplete(), this.isInitialized(), typeof (s == null ? void 0 : s.id) < "u" ? await this.unsubscribeById(i, s.id, s) : await this.unsubscribeByTopic(i, s);
    }, this.isSubscribed = async (i) => this.topics.includes(i) ? true : await new Promise((s, n2) => {
      const o = new cjs$3.Watch();
      o.start(this.pendingSubscriptionWatchLabel);
      const a3 = setInterval(() => {
        !this.pending.has(i) && this.topics.includes(i) && (clearInterval(a3), o.stop(this.pendingSubscriptionWatchLabel), s(true)), o.elapsed(this.pendingSubscriptionWatchLabel) >= ft && (clearInterval(a3), o.stop(this.pendingSubscriptionWatchLabel), n2(new Error("Subscription resolution timeout")));
      }, this.pollingInterval);
    }).catch(() => false), this.on = (i, s) => {
      this.events.on(i, s);
    }, this.once = (i, s) => {
      this.events.once(i, s);
    }, this.off = (i, s) => {
      this.events.off(i, s);
    }, this.removeListener = (i, s) => {
      this.events.removeListener(i, s);
    }, this.restart = async () => {
      this.restartInProgress = true, await this.restore(), await this.reset(), this.restartInProgress = false;
    }, this.relayer = e, this.logger = cjs$1.generateChildLogger(t, this.name), this.clientId = "";
  }
  get context() {
    return cjs$1.getLoggerContext(this.logger);
  }
  get storageKey() {
    return this.storagePrefix + this.version + this.relayer.core.customStoragePrefix + "//" + this.name;
  }
  get length() {
    return this.subscriptions.size;
  }
  get ids() {
    return Array.from(this.subscriptions.keys());
  }
  get values() {
    return Array.from(this.subscriptions.values());
  }
  get topics() {
    return this.topicMap.topics;
  }
  hasSubscription(e, t) {
    let i = false;
    try {
      i = this.getSubscription(e).topic === t;
    } catch {
    }
    return i;
  }
  onEnable() {
    this.cached = [], this.initialized = true;
  }
  onDisable() {
    this.cached = this.values, this.subscriptions.clear(), this.topicMap.clear();
  }
  async unsubscribeByTopic(e, t) {
    const i = this.topicMap.get(e);
    await Promise.all(i.map(async (s) => await this.unsubscribeById(e, s, t)));
  }
  async unsubscribeById(e, t, i) {
    this.logger.debug("Unsubscribing Topic"), this.logger.trace({ type: "method", method: "unsubscribe", params: { topic: e, id: t, opts: i } });
    try {
      const s = vt$1(i);
      await this.rpcUnsubscribe(e, t, s);
      const n2 = U("USER_DISCONNECTED", `${this.name}, ${e}`);
      await this.onUnsubscribe(e, t, n2), this.logger.debug("Successfully Unsubscribed Topic"), this.logger.trace({ type: "method", method: "unsubscribe", params: { topic: e, id: t, opts: i } });
    } catch (s) {
      throw this.logger.debug("Failed to Unsubscribe Topic"), this.logger.error(s), s;
    }
  }
  async rpcSubscribe(e, t) {
    const i = { method: Et$1(t.protocol).subscribe, params: { topic: e } };
    this.logger.debug("Outgoing Relay Payload"), this.logger.trace({ type: "payload", direction: "outgoing", request: i });
    try {
      await await ut$1(this.relayer.request(i), this.subscribeTimeout);
    } catch {
      this.logger.debug("Outgoing Relay Subscribe Payload stalled"), this.relayer.events.emit(D.connection_stalled);
    }
    return Ln(e + this.clientId);
  }
  async rpcBatchSubscribe(e) {
    if (!e.length)
      return;
    const t = e[0].relay, i = { method: Et$1(t.protocol).batchSubscribe, params: { topics: e.map((s) => s.topic) } };
    this.logger.debug("Outgoing Relay Payload"), this.logger.trace({ type: "payload", direction: "outgoing", request: i });
    try {
      return await await ut$1(this.relayer.request(i), this.subscribeTimeout);
    } catch {
      this.logger.debug("Outgoing Relay Payload stalled"), this.relayer.events.emit(D.connection_stalled);
    }
  }
  rpcUnsubscribe(e, t, i) {
    const s = { method: Et$1(i.protocol).unsubscribe, params: { topic: e, id: t } };
    return this.logger.debug("Outgoing Relay Payload"), this.logger.trace({ type: "payload", direction: "outgoing", request: s }), this.relayer.request(s);
  }
  onSubscribe(e, t) {
    this.setSubscription(e, De(q({}, t), { id: e })), this.pending.delete(t.topic);
  }
  onBatchSubscribe(e) {
    e.length && e.forEach((t) => {
      this.setSubscription(t.id, q({}, t)), this.pending.delete(t.topic);
    });
  }
  async onUnsubscribe(e, t, i) {
    this.events.removeAllListeners(t), this.hasSubscription(t, e) && this.deleteSubscription(t, i), await this.relayer.messages.del(e);
  }
  async setRelayerSubscriptions(e) {
    await this.relayer.core.storage.setItem(this.storageKey, e);
  }
  async getRelayerSubscriptions() {
    return await this.relayer.core.storage.getItem(this.storageKey);
  }
  setSubscription(e, t) {
    this.subscriptions.has(e) || (this.logger.debug("Setting subscription"), this.logger.trace({ type: "method", method: "setSubscription", id: e, subscription: t }), this.addSubscription(e, t));
  }
  addSubscription(e, t) {
    this.subscriptions.set(e, q({}, t)), this.topicMap.set(t.topic, e), this.events.emit(w.created, t);
  }
  getSubscription(e) {
    this.logger.debug("Getting subscription"), this.logger.trace({ type: "method", method: "getSubscription", id: e });
    const t = this.subscriptions.get(e);
    if (!t) {
      const { message: i } = N$1("NO_MATCHING_KEY", `${this.name}: ${e}`);
      throw new Error(i);
    }
    return t;
  }
  deleteSubscription(e, t) {
    this.logger.debug("Deleting subscription"), this.logger.trace({ type: "method", method: "deleteSubscription", id: e, reason: t });
    const i = this.getSubscription(e);
    this.subscriptions.delete(e), this.topicMap.delete(i.topic, e), this.events.emit(w.deleted, De(q({}, i), { reason: t }));
  }
  async persist() {
    await this.setRelayerSubscriptions(this.values), this.events.emit(w.sync);
  }
  async reset() {
    if (this.cached.length) {
      const e = Math.ceil(this.cached.length / this.batchSubscribeTopicsLimit);
      for (let t = 0; t < e; t++) {
        const i = this.cached.splice(0, this.batchSubscribeTopicsLimit);
        await this.batchSubscribe(i);
      }
    }
    this.events.emit(w.resubscribed);
  }
  async restore() {
    try {
      const e = await this.getRelayerSubscriptions();
      if (typeof e > "u" || !e.length)
        return;
      if (this.subscriptions.size) {
        const { message: t } = N$1("RESTORE_WILL_OVERRIDE", this.name);
        throw this.logger.error(t), this.logger.error(`${this.name}: ${JSON.stringify(this.values)}`), new Error(t);
      }
      this.cached = e, this.logger.debug(`Successfully Restored subscriptions for ${this.name}`), this.logger.trace({ type: "method", method: "restore", subscriptions: this.values });
    } catch (e) {
      this.logger.debug(`Failed to Restore subscriptions for ${this.name}`), this.logger.error(e);
    }
  }
  async batchSubscribe(e) {
    if (!e.length)
      return;
    const t = await this.rpcBatchSubscribe(e);
    k$1(t) && this.onBatchSubscribe(t.map((i, s) => De(q({}, e[s]), { id: i })));
  }
  async onConnect() {
    this.restartInProgress || (await this.restart(), this.onEnable());
  }
  onDisconnect() {
    this.onDisable();
  }
  async checkPending() {
    if (!this.initialized || this.relayer.transportExplicitlyClosed)
      return;
    const e = [];
    this.pending.forEach((t) => {
      e.push(t);
    }), await this.batchSubscribe(e);
  }
  registerEventListeners() {
    this.relayer.core.heartbeat.on(cjs$2.HEARTBEAT_EVENTS.pulse, async () => {
      await this.checkPending();
    }), this.relayer.on(D.connect, async () => {
      await this.onConnect();
    }), this.relayer.on(D.disconnect, () => {
      this.onDisconnect();
    }), this.events.on(w.created, async (e) => {
      const t = w.created;
      this.logger.info(`Emitting ${t}`), this.logger.debug({ type: "event", event: t, data: e }), await this.persist();
    }), this.events.on(w.deleted, async (e) => {
      const t = w.deleted;
      this.logger.info(`Emitting ${t}`), this.logger.debug({ type: "event", event: t, data: e }), await this.persist();
    });
  }
  isInitialized() {
    if (!this.initialized) {
      const { message: e } = N$1("NOT_INITIALIZED", this.name);
      throw new Error(e);
    }
  }
  async restartToComplete() {
    this.restartInProgress && await new Promise((e) => {
      const t = setInterval(() => {
        this.restartInProgress || (clearInterval(t), e());
      }, this.pollingInterval);
    });
  }
}
var Cr = Object.defineProperty, zt = Object.getOwnPropertySymbols, Rr = Object.prototype.hasOwnProperty, _r = Object.prototype.propertyIsEnumerable, Nt = (r, e, t) => e in r ? Cr(r, e, { enumerable: true, configurable: true, writable: true, value: t }) : r[e] = t, Sr = (r, e) => {
  for (var t in e || (e = {}))
    Rr.call(e, t) && Nt(r, t, e[t]);
  if (zt)
    for (var t of zt(e))
      _r.call(e, t) && Nt(r, t, e[t]);
  return r;
};
class Ut extends g$1 {
  constructor(e) {
    super(e), this.protocol = "wc", this.version = 2, this.events = new eventsExports.EventEmitter(), this.name = ut, this.transportExplicitlyClosed = false, this.initialized = false, this.connectionAttemptInProgress = false, this.connectionStatusPollingInterval = 20, this.staleConnectionErrors = ["socket hang up", "socket stalled"], this.hasExperiencedNetworkDisruption = false, this.request = async (t) => {
      this.logger.debug("Publishing Request Payload");
      try {
        return await this.toEstablishConnection(), await this.provider.request(t);
      } catch (i) {
        throw this.logger.debug("Failed to Publish Request"), this.logger.error(i), i;
      }
    }, this.onPayloadHandler = (t) => {
      this.onProviderPayload(t);
    }, this.onConnectHandler = () => {
      this.events.emit(D.connect);
    }, this.onDisconnectHandler = () => {
      this.onProviderDisconnect();
    }, this.onProviderErrorHandler = (t) => {
      this.logger.error(t), this.events.emit(D.error, t), this.logger.info("Fatal socket error received, closing transport"), this.transportClose();
    }, this.registerProviderListeners = () => {
      this.provider.on(P.payload, this.onPayloadHandler), this.provider.on(P.connect, this.onConnectHandler), this.provider.on(P.disconnect, this.onDisconnectHandler), this.provider.on(P.error, this.onProviderErrorHandler);
    }, this.core = e.core, this.logger = typeof e.logger < "u" && typeof e.logger != "string" ? cjs$1.generateChildLogger(e.logger, this.name) : cjs$1.pino(cjs$1.getDefaultLoggerOptions({ level: e.logger || ct })), this.messages = new Pt(this.logger, e.core), this.subscriber = new At(this, this.logger), this.publisher = new mr(this, this.logger), this.relayUrl = (e == null ? void 0 : e.relayUrl) || ge, this.projectId = e.projectId, this.bundleId = Jn(), this.provider = {};
  }
  async init() {
    this.logger.trace("Initialized"), this.registerEventListeners(), await this.createProvider(), await Promise.all([this.messages.init(), this.subscriber.init()]);
    try {
      await this.transportOpen();
    } catch {
      this.logger.warn(`Connection via ${this.relayUrl} failed, attempting to connect via failover domain ${pe}...`), await this.restartTransport(pe);
    }
    this.initialized = true, setTimeout(async () => {
      this.subscriber.topics.length === 0 && (this.logger.info("No topics subscribed to after init, closing transport"), await this.transportClose(), this.transportExplicitlyClosed = false);
    }, pt);
  }
  get context() {
    return cjs$1.getLoggerContext(this.logger);
  }
  get connected() {
    return this.provider.connection.connected;
  }
  get connecting() {
    return this.provider.connection.connecting;
  }
  async publish(e, t, i) {
    this.isInitialized(), await this.publisher.publish(e, t, i), await this.recordMessageEvent({ topic: e, message: t, publishedAt: Date.now() });
  }
  async subscribe(e, t) {
    var i;
    this.isInitialized();
    let s = ((i = this.subscriber.topicMap.get(e)) == null ? void 0 : i[0]) || "";
    if (s)
      return s;
    let n2;
    const o = (a3) => {
      a3.topic === e && (this.subscriber.off(w.created, o), n2());
    };
    return await Promise.all([new Promise((a3) => {
      n2 = a3, this.subscriber.on(w.created, o);
    }), new Promise(async (a3) => {
      s = await this.subscriber.subscribe(e, t), a3();
    })]), s;
  }
  async unsubscribe(e, t) {
    this.isInitialized(), await this.subscriber.unsubscribe(e, t);
  }
  on(e, t) {
    this.events.on(e, t);
  }
  once(e, t) {
    this.events.once(e, t);
  }
  off(e, t) {
    this.events.off(e, t);
  }
  removeListener(e, t) {
    this.events.removeListener(e, t);
  }
  async transportClose() {
    this.transportExplicitlyClosed = true, this.hasExperiencedNetworkDisruption && this.connected ? await ut$1(this.provider.disconnect(), 1e3, "provider.disconnect()").catch(() => this.onProviderDisconnect()) : this.connected && await this.provider.disconnect();
  }
  async transportOpen(e) {
    if (this.transportExplicitlyClosed = false, await this.confirmOnlineStateOrThrow(), !this.connectionAttemptInProgress) {
      e && e !== this.relayUrl && (this.relayUrl = e, await this.transportClose(), await this.createProvider()), this.connectionAttemptInProgress = true;
      try {
        await Promise.all([new Promise((t) => {
          if (!this.initialized)
            return t();
          this.subscriber.once(w.resubscribed, () => {
            t();
          });
        }), new Promise(async (t, i) => {
          try {
            await ut$1(this.provider.connect(), 1e4, `Socket stalled when trying to connect to ${this.relayUrl}`);
          } catch (s) {
            i(s);
            return;
          }
          t();
        })]);
      } catch (t) {
        this.logger.error(t);
        const i = t;
        if (!this.isConnectionStalled(i.message))
          throw t;
        this.provider.events.emit(P.disconnect);
      } finally {
        this.connectionAttemptInProgress = false, this.hasExperiencedNetworkDisruption = false;
      }
    }
  }
  async restartTransport(e) {
    await this.confirmOnlineStateOrThrow(), !this.connectionAttemptInProgress && (this.relayUrl = e || this.relayUrl, await this.transportClose(), await this.createProvider(), await this.transportOpen());
  }
  async confirmOnlineStateOrThrow() {
    if (!await er$1())
      throw new Error("No internet connection detected. Please restart your network and try again.");
  }
  isConnectionStalled(e) {
    return this.staleConnectionErrors.some((t) => e.includes(t));
  }
  async createProvider() {
    this.provider.connection && this.unregisterProviderListeners();
    const e = await this.core.crypto.signJWT(this.relayUrl);
    this.provider = new JsonRpcProvider(new f(Xn({ sdkVersion: gt, protocol: this.protocol, version: this.version, relayUrl: this.relayUrl, projectId: this.projectId, auth: e, useOnCloseEvent: true, bundleId: this.bundleId }))), this.registerProviderListeners();
  }
  async recordMessageEvent(e) {
    const { topic: t, message: i } = e;
    await this.messages.set(t, i);
  }
  async shouldIgnoreMessageEvent(e) {
    const { topic: t, message: i } = e;
    if (!i || i.length === 0)
      return this.logger.debug(`Ignoring invalid/empty message: ${i}`), true;
    if (!await this.subscriber.isSubscribed(t))
      return this.logger.debug(`Ignoring message for non-subscribed topic ${t}`), true;
    const s = this.messages.has(t, i);
    return s && this.logger.debug(`Ignoring duplicate message: ${i}`), s;
  }
  async onProviderPayload(e) {
    if (this.logger.debug("Incoming Relay Payload"), this.logger.trace({ type: "payload", direction: "incoming", payload: e }), isJsonRpcRequest(e)) {
      if (!e.method.endsWith(lt))
        return;
      const t = e.params, { topic: i, message: s, publishedAt: n2 } = t.data, o = { topic: i, message: s, publishedAt: n2 };
      this.logger.debug("Emitting Relayer Payload"), this.logger.trace(Sr({ type: "event", event: t.id }, o)), this.events.emit(t.id, o), await this.acknowledgePayload(e), await this.onMessageEvent(o);
    } else
      isJsonRpcResponse(e) && this.events.emit(D.message_ack, e);
  }
  async onMessageEvent(e) {
    await this.shouldIgnoreMessageEvent(e) || (this.events.emit(D.message, e), await this.recordMessageEvent(e));
  }
  async acknowledgePayload(e) {
    const t = formatJsonRpcResult(e.id, true);
    await this.provider.connection.send(t);
  }
  unregisterProviderListeners() {
    this.provider.off(P.payload, this.onPayloadHandler), this.provider.off(P.connect, this.onConnectHandler), this.provider.off(P.disconnect, this.onDisconnectHandler), this.provider.off(P.error, this.onProviderErrorHandler);
  }
  async registerEventListeners() {
    this.events.on(D.connection_stalled, () => {
      this.restartTransport().catch((t) => this.logger.error(t));
    });
    let e = await er$1();
    nr$1(async (t) => {
      this.initialized && e !== t && (e = t, t ? await this.restartTransport().catch((i) => this.logger.error(i)) : (this.hasExperiencedNetworkDisruption = true, await this.transportClose().catch((i) => this.logger.error(i))));
    });
  }
  onProviderDisconnect() {
    this.events.emit(D.disconnect), this.attemptToReconnect();
  }
  attemptToReconnect() {
    this.transportExplicitlyClosed || (this.logger.info("attemptToReconnect called. Connecting..."), setTimeout(async () => {
      await this.restartTransport().catch((e) => this.logger.error(e));
    }, cjs$3.toMiliseconds(dt)));
  }
  isInitialized() {
    if (!this.initialized) {
      const { message: e } = N$1("NOT_INITIALIZED", this.name);
      throw new Error(e);
    }
  }
  async toEstablishConnection() {
    if (await this.confirmOnlineStateOrThrow(), !this.connected) {
      if (this.connectionAttemptInProgress)
        return await new Promise((e) => {
          const t = setInterval(() => {
            this.connected && (clearInterval(t), e());
          }, this.connectionStatusPollingInterval);
        });
      await this.restartTransport();
    }
  }
}
var Tr = Object.defineProperty, Lt = Object.getOwnPropertySymbols, Pr = Object.prototype.hasOwnProperty, xr = Object.prototype.propertyIsEnumerable, Ft = (r, e, t) => e in r ? Tr(r, e, { enumerable: true, configurable: true, writable: true, value: t }) : r[e] = t, $t = (r, e) => {
  for (var t in e || (e = {}))
    Pr.call(e, t) && Ft(r, t, e[t]);
  if (Lt)
    for (var t of Lt(e))
      xr.call(e, t) && Ft(r, t, e[t]);
  return r;
};
class Mt extends p {
  constructor(e, t, i, s = O, n2 = void 0) {
    super(e, t, i, s), this.core = e, this.logger = t, this.name = i, this.map = /* @__PURE__ */ new Map(), this.version = Dt, this.cached = [], this.initialized = false, this.storagePrefix = O, this.init = async () => {
      this.initialized || (this.logger.trace("Initialized"), await this.restore(), this.cached.forEach((o) => {
        this.getKey && o !== null && !w$2(o) ? this.map.set(this.getKey(o), o) : Vt$1(o) ? this.map.set(o.id, o) : Mt$1(o) && this.map.set(o.topic, o);
      }), this.cached = [], this.initialized = true);
    }, this.set = async (o, a3) => {
      this.isInitialized(), this.map.has(o) ? await this.update(o, a3) : (this.logger.debug("Setting value"), this.logger.trace({ type: "method", method: "set", key: o, value: a3 }), this.map.set(o, a3), await this.persist());
    }, this.get = (o) => (this.isInitialized(), this.logger.debug("Getting value"), this.logger.trace({ type: "method", method: "get", key: o }), this.getData(o)), this.getAll = (o) => (this.isInitialized(), o ? this.values.filter((a3) => Object.keys(o).every((h4) => Bi(a3[h4], o[h4]))) : this.values), this.update = async (o, a3) => {
      this.isInitialized(), this.logger.debug("Updating value"), this.logger.trace({ type: "method", method: "update", key: o, update: a3 });
      const h4 = $t($t({}, this.getData(o)), a3);
      this.map.set(o, h4), await this.persist();
    }, this.delete = async (o, a3) => {
      this.isInitialized(), this.map.has(o) && (this.logger.debug("Deleting value"), this.logger.trace({ type: "method", method: "delete", key: o, reason: a3 }), this.map.delete(o), await this.persist());
    }, this.logger = cjs$1.generateChildLogger(t, this.name), this.storagePrefix = s, this.getKey = n2;
  }
  get context() {
    return cjs$1.getLoggerContext(this.logger);
  }
  get storageKey() {
    return this.storagePrefix + this.version + this.core.customStoragePrefix + "//" + this.name;
  }
  get length() {
    return this.map.size;
  }
  get keys() {
    return Array.from(this.map.keys());
  }
  get values() {
    return Array.from(this.map.values());
  }
  async setDataStore(e) {
    await this.core.storage.setItem(this.storageKey, e);
  }
  async getDataStore() {
    return await this.core.storage.getItem(this.storageKey);
  }
  getData(e) {
    const t = this.map.get(e);
    if (!t) {
      const { message: i } = N$1("NO_MATCHING_KEY", `${this.name}: ${e}`);
      throw this.logger.error(i), new Error(i);
    }
    return t;
  }
  async persist() {
    await this.setDataStore(this.values);
  }
  async restore() {
    try {
      const e = await this.getDataStore();
      if (typeof e > "u" || !e.length)
        return;
      if (this.map.size) {
        const { message: t } = N$1("RESTORE_WILL_OVERRIDE", this.name);
        throw this.logger.error(t), new Error(t);
      }
      this.cached = e, this.logger.debug(`Successfully Restored value for ${this.name}`), this.logger.trace({ type: "method", method: "restore", value: this.values });
    } catch (e) {
      this.logger.debug(`Failed to Restore value for ${this.name}`), this.logger.error(e);
    }
  }
  isInitialized() {
    if (!this.initialized) {
      const { message: e } = N$1("NOT_INITIALIZED", this.name);
      throw new Error(e);
    }
  }
}
class kt {
  constructor(e, t) {
    this.core = e, this.logger = t, this.name = Et, this.version = wt, this.events = new Ye$1(), this.initialized = false, this.storagePrefix = O, this.ignoredPayloadTypes = [_$1], this.registeredMethods = [], this.init = async () => {
      this.initialized || (await this.pairings.init(), await this.cleanup(), this.registerRelayerEvents(), this.registerExpirerEvents(), this.initialized = true, this.logger.trace("Initialized"));
    }, this.register = ({ methods: i }) => {
      this.isInitialized(), this.registeredMethods = [.../* @__PURE__ */ new Set([...this.registeredMethods, ...i])];
    }, this.create = async () => {
      this.isInitialized();
      const i = Vn(), s = await this.core.crypto.setSymKey(i), n2 = pt$1(cjs$3.FIVE_MINUTES), o = { protocol: ht }, a3 = { topic: s, expiry: n2, relay: o, active: false }, h4 = It$1({ protocol: this.core.protocol, version: this.core.version, topic: s, symKey: i, relay: o });
      return await this.pairings.set(s, a3), await this.core.relayer.subscribe(s), this.core.expirer.set(s, n2), { topic: s, uri: h4 };
    }, this.pair = async (i) => {
      this.isInitialized(), this.isValidPair(i);
      const { topic: s, symKey: n2, relay: o } = wt$1(i.uri);
      let a3;
      if (this.pairings.keys.includes(s) && (a3 = this.pairings.get(s), a3.active))
        throw new Error(`Pairing already exists: ${s}. Please try again with a new connection URI.`);
      const h4 = pt$1(cjs$3.FIVE_MINUTES), l2 = { topic: s, relay: o, expiry: h4, active: false };
      return await this.pairings.set(s, l2), this.core.expirer.set(s, h4), i.activatePairing && await this.activate({ topic: s }), this.events.emit(V.create, l2), this.core.crypto.keychain.has(s) || (await this.core.crypto.setSymKey(n2, s), await this.core.relayer.subscribe(s, { relay: o })), l2;
    }, this.activate = async ({ topic: i }) => {
      this.isInitialized();
      const s = pt$1(cjs$3.THIRTY_DAYS);
      await this.pairings.update(i, { active: true, expiry: s }), this.core.expirer.set(i, s);
    }, this.ping = async (i) => {
      this.isInitialized(), await this.isValidPing(i);
      const { topic: s } = i;
      if (this.pairings.keys.includes(s)) {
        const n2 = await this.sendRequest(s, "wc_pairingPing", {}), { done: o, resolve: a3, reject: h4 } = at$1();
        this.events.once(yt$1("pairing_ping", n2), ({ error: l2 }) => {
          l2 ? h4(l2) : a3();
        }), await o();
      }
    }, this.updateExpiry = async ({ topic: i, expiry: s }) => {
      this.isInitialized(), await this.pairings.update(i, { expiry: s });
    }, this.updateMetadata = async ({ topic: i, metadata: s }) => {
      this.isInitialized(), await this.pairings.update(i, { peerMetadata: s });
    }, this.getPairings = () => (this.isInitialized(), this.pairings.values), this.disconnect = async (i) => {
      this.isInitialized(), await this.isValidDisconnect(i);
      const { topic: s } = i;
      this.pairings.keys.includes(s) && (await this.sendRequest(s, "wc_pairingDelete", U("USER_DISCONNECTED")), await this.deletePairing(s));
    }, this.sendRequest = async (i, s, n2) => {
      const o = formatJsonRpcRequest(s, n2), a3 = await this.core.crypto.encode(i, o), h4 = F[s].req;
      return this.core.history.set(i, o), this.core.relayer.publish(i, a3, h4), o.id;
    }, this.sendResult = async (i, s, n2) => {
      const o = formatJsonRpcResult(i, n2), a3 = await this.core.crypto.encode(s, o), h4 = await this.core.history.get(s, i), l2 = F[h4.request.method].res;
      await this.core.relayer.publish(s, a3, l2), await this.core.history.resolve(o);
    }, this.sendError = async (i, s, n2) => {
      const o = formatJsonRpcError(i, n2), a3 = await this.core.crypto.encode(s, o), h4 = await this.core.history.get(s, i), l2 = F[h4.request.method] ? F[h4.request.method].res : F.unregistered_method.res;
      await this.core.relayer.publish(s, a3, l2), await this.core.history.resolve(o);
    }, this.deletePairing = async (i, s) => {
      await this.core.relayer.unsubscribe(i), await Promise.all([this.pairings.delete(i, U("USER_DISCONNECTED")), this.core.crypto.deleteSymKey(i), s ? Promise.resolve() : this.core.expirer.del(i)]);
    }, this.cleanup = async () => {
      const i = this.pairings.getAll().filter((s) => mt$1(s.expiry));
      await Promise.all(i.map((s) => this.deletePairing(s.topic)));
    }, this.onRelayEventRequest = (i) => {
      const { topic: s, payload: n2 } = i;
      switch (n2.method) {
        case "wc_pairingPing":
          return this.onPairingPingRequest(s, n2);
        case "wc_pairingDelete":
          return this.onPairingDeleteRequest(s, n2);
        default:
          return this.onUnknownRpcMethodRequest(s, n2);
      }
    }, this.onRelayEventResponse = async (i) => {
      const { topic: s, payload: n2 } = i, o = (await this.core.history.get(s, n2.id)).request.method;
      switch (o) {
        case "wc_pairingPing":
          return this.onPairingPingResponse(s, n2);
        default:
          return this.onUnknownRpcMethodResponse(o);
      }
    }, this.onPairingPingRequest = async (i, s) => {
      const { id: n2 } = s;
      try {
        this.isValidPing({ topic: i }), await this.sendResult(n2, i, true), this.events.emit(V.ping, { id: n2, topic: i });
      } catch (o) {
        await this.sendError(n2, i, o), this.logger.error(o);
      }
    }, this.onPairingPingResponse = (i, s) => {
      const { id: n2 } = s;
      setTimeout(() => {
        isJsonRpcResult(s) ? this.events.emit(yt$1("pairing_ping", n2), {}) : isJsonRpcError(s) && this.events.emit(yt$1("pairing_ping", n2), { error: s.error });
      }, 500);
    }, this.onPairingDeleteRequest = async (i, s) => {
      const { id: n2 } = s;
      try {
        this.isValidDisconnect({ topic: i }), await this.deletePairing(i), this.events.emit(V.delete, { id: n2, topic: i });
      } catch (o) {
        await this.sendError(n2, i, o), this.logger.error(o);
      }
    }, this.onUnknownRpcMethodRequest = async (i, s) => {
      const { id: n2, method: o } = s;
      try {
        if (this.registeredMethods.includes(o))
          return;
        const a3 = U("WC_METHOD_UNSUPPORTED", o);
        await this.sendError(n2, i, a3), this.logger.error(a3);
      } catch (a3) {
        await this.sendError(n2, i, a3), this.logger.error(a3);
      }
    }, this.onUnknownRpcMethodResponse = (i) => {
      this.registeredMethods.includes(i) || this.logger.error(U("WC_METHOD_UNSUPPORTED", i));
    }, this.isValidPair = (i) => {
      var s;
      if (!Ht(i)) {
        const { message: o } = N$1("MISSING_OR_INVALID", `pair() params: ${i}`);
        throw new Error(o);
      }
      if (!kt$1(i.uri)) {
        const { message: o } = N$1("MISSING_OR_INVALID", `pair() uri: ${i.uri}`);
        throw new Error(o);
      }
      const n2 = wt$1(i.uri);
      if (!((s = n2 == null ? void 0 : n2.relay) != null && s.protocol)) {
        const { message: o } = N$1("MISSING_OR_INVALID", "pair() uri#relay-protocol");
        throw new Error(o);
      }
      if (!(n2 != null && n2.symKey)) {
        const { message: o } = N$1("MISSING_OR_INVALID", "pair() uri#symKey");
        throw new Error(o);
      }
    }, this.isValidPing = async (i) => {
      if (!Ht(i)) {
        const { message: n2 } = N$1("MISSING_OR_INVALID", `ping() params: ${i}`);
        throw new Error(n2);
      }
      const { topic: s } = i;
      await this.isValidPairingTopic(s);
    }, this.isValidDisconnect = async (i) => {
      if (!Ht(i)) {
        const { message: n2 } = N$1("MISSING_OR_INVALID", `disconnect() params: ${i}`);
        throw new Error(n2);
      }
      const { topic: s } = i;
      await this.isValidPairingTopic(s);
    }, this.isValidPairingTopic = async (i) => {
      if (!h$3(i, false)) {
        const { message: s } = N$1("MISSING_OR_INVALID", `pairing topic should be a string: ${i}`);
        throw new Error(s);
      }
      if (!this.pairings.keys.includes(i)) {
        const { message: s } = N$1("NO_MATCHING_KEY", `pairing topic doesn't exist: ${i}`);
        throw new Error(s);
      }
      if (mt$1(this.pairings.get(i).expiry)) {
        await this.deletePairing(i);
        const { message: s } = N$1("EXPIRED", `pairing topic: ${i}`);
        throw new Error(s);
      }
    }, this.core = e, this.logger = cjs$1.generateChildLogger(t, this.name), this.pairings = new Mt(this.core, this.logger, this.name, this.storagePrefix);
  }
  get context() {
    return cjs$1.getLoggerContext(this.logger);
  }
  isInitialized() {
    if (!this.initialized) {
      const { message: e } = N$1("NOT_INITIALIZED", this.name);
      throw new Error(e);
    }
  }
  registerRelayerEvents() {
    this.core.relayer.on(D.message, async (e) => {
      const { topic: t, message: i } = e;
      if (!this.pairings.keys.includes(t) || this.ignoredPayloadTypes.includes(this.core.crypto.getPayloadType(i)))
        return;
      const s = await this.core.crypto.decode(t, i);
      try {
        isJsonRpcRequest(s) ? (this.core.history.set(t, s), this.onRelayEventRequest({ topic: t, payload: s })) : isJsonRpcResponse(s) && (await this.core.history.resolve(s), await this.onRelayEventResponse({ topic: t, payload: s }), this.core.history.delete(t, s.id));
      } catch (n2) {
        this.logger.error(n2);
      }
    });
  }
  registerExpirerEvents() {
    this.core.expirer.on(v.expired, async (e) => {
      const { topic: t } = ft$1(e.target);
      t && this.pairings.keys.includes(t) && (await this.deletePairing(t, true), this.events.emit(V.expire, { topic: t }));
    });
  }
}
class Kt extends h$1 {
  constructor(e, t) {
    super(e, t), this.core = e, this.logger = t, this.records = /* @__PURE__ */ new Map(), this.events = new eventsExports.EventEmitter(), this.name = vt, this.version = It, this.cached = [], this.initialized = false, this.storagePrefix = O, this.init = async () => {
      this.initialized || (this.logger.trace("Initialized"), await this.restore(), this.cached.forEach((i) => this.records.set(i.id, i)), this.cached = [], this.registerEventListeners(), this.initialized = true);
    }, this.set = (i, s, n2) => {
      if (this.isInitialized(), this.logger.debug("Setting JSON-RPC request history record"), this.logger.trace({ type: "method", method: "set", topic: i, request: s, chainId: n2 }), this.records.has(s.id))
        return;
      const o = { id: s.id, topic: i, request: { method: s.method, params: s.params || null }, chainId: n2, expiry: pt$1(cjs$3.THIRTY_DAYS) };
      this.records.set(o.id, o), this.events.emit(R.created, o);
    }, this.resolve = async (i) => {
      if (this.isInitialized(), this.logger.debug("Updating JSON-RPC response history record"), this.logger.trace({ type: "method", method: "update", response: i }), !this.records.has(i.id))
        return;
      const s = await this.getRecord(i.id);
      typeof s.response > "u" && (s.response = isJsonRpcError(i) ? { error: i.error } : { result: i.result }, this.records.set(s.id, s), this.events.emit(R.updated, s));
    }, this.get = async (i, s) => (this.isInitialized(), this.logger.debug("Getting record"), this.logger.trace({ type: "method", method: "get", topic: i, id: s }), await this.getRecord(s)), this.delete = (i, s) => {
      this.isInitialized(), this.logger.debug("Deleting record"), this.logger.trace({ type: "method", method: "delete", id: s }), this.values.forEach((n2) => {
        if (n2.topic === i) {
          if (typeof s < "u" && n2.id !== s)
            return;
          this.records.delete(n2.id), this.events.emit(R.deleted, n2);
        }
      });
    }, this.exists = async (i, s) => (this.isInitialized(), this.records.has(s) ? (await this.getRecord(s)).topic === i : false), this.on = (i, s) => {
      this.events.on(i, s);
    }, this.once = (i, s) => {
      this.events.once(i, s);
    }, this.off = (i, s) => {
      this.events.off(i, s);
    }, this.removeListener = (i, s) => {
      this.events.removeListener(i, s);
    }, this.logger = cjs$1.generateChildLogger(t, this.name);
  }
  get context() {
    return cjs$1.getLoggerContext(this.logger);
  }
  get storageKey() {
    return this.storagePrefix + this.version + this.core.customStoragePrefix + "//" + this.name;
  }
  get size() {
    return this.records.size;
  }
  get keys() {
    return Array.from(this.records.keys());
  }
  get values() {
    return Array.from(this.records.values());
  }
  get pending() {
    const e = [];
    return this.values.forEach((t) => {
      if (typeof t.response < "u")
        return;
      const i = { topic: t.topic, request: formatJsonRpcRequest(t.request.method, t.request.params, t.id), chainId: t.chainId };
      return e.push(i);
    }), e;
  }
  async setJsonRpcRecords(e) {
    await this.core.storage.setItem(this.storageKey, e);
  }
  async getJsonRpcRecords() {
    return await this.core.storage.getItem(this.storageKey);
  }
  getRecord(e) {
    this.isInitialized();
    const t = this.records.get(e);
    if (!t) {
      const { message: i } = N$1("NO_MATCHING_KEY", `${this.name}: ${e}`);
      throw new Error(i);
    }
    return t;
  }
  async persist() {
    await this.setJsonRpcRecords(this.values), this.events.emit(R.sync);
  }
  async restore() {
    try {
      const e = await this.getJsonRpcRecords();
      if (typeof e > "u" || !e.length)
        return;
      if (this.records.size) {
        const { message: t } = N$1("RESTORE_WILL_OVERRIDE", this.name);
        throw this.logger.error(t), new Error(t);
      }
      this.cached = e, this.logger.debug(`Successfully Restored records for ${this.name}`), this.logger.trace({ type: "method", method: "restore", records: this.values });
    } catch (e) {
      this.logger.debug(`Failed to Restore records for ${this.name}`), this.logger.error(e);
    }
  }
  registerEventListeners() {
    this.events.on(R.created, (e) => {
      const t = R.created;
      this.logger.info(`Emitting ${t}`), this.logger.debug({ type: "event", event: t, record: e }), this.persist();
    }), this.events.on(R.updated, (e) => {
      const t = R.updated;
      this.logger.info(`Emitting ${t}`), this.logger.debug({ type: "event", event: t, record: e }), this.persist();
    }), this.events.on(R.deleted, (e) => {
      const t = R.deleted;
      this.logger.info(`Emitting ${t}`), this.logger.debug({ type: "event", event: t, record: e }), this.persist();
    }), this.core.heartbeat.on(cjs$2.HEARTBEAT_EVENTS.pulse, () => {
      this.cleanup();
    });
  }
  cleanup() {
    try {
      this.records.forEach((e) => {
        cjs$3.toMiliseconds(e.expiry || 0) - Date.now() <= 0 && (this.logger.info(`Deleting expired history log: ${e.id}`), this.delete(e.topic, e.id));
      });
    } catch (e) {
      this.logger.warn(e);
    }
  }
  isInitialized() {
    if (!this.initialized) {
      const { message: e } = N$1("NOT_INITIALIZED", this.name);
      throw new Error(e);
    }
  }
}
class Bt extends E {
  constructor(e, t) {
    super(e, t), this.core = e, this.logger = t, this.expirations = /* @__PURE__ */ new Map(), this.events = new eventsExports.EventEmitter(), this.name = Ct, this.version = Rt, this.cached = [], this.initialized = false, this.storagePrefix = O, this.init = async () => {
      this.initialized || (this.logger.trace("Initialized"), await this.restore(), this.cached.forEach((i) => this.expirations.set(i.target, i)), this.cached = [], this.registerEventListeners(), this.initialized = true);
    }, this.has = (i) => {
      try {
        const s = this.formatTarget(i);
        return typeof this.getExpiration(s) < "u";
      } catch {
        return false;
      }
    }, this.set = (i, s) => {
      this.isInitialized();
      const n2 = this.formatTarget(i), o = { target: n2, expiry: s };
      this.expirations.set(n2, o), this.checkExpiry(n2, o), this.events.emit(v.created, { target: n2, expiration: o });
    }, this.get = (i) => {
      this.isInitialized();
      const s = this.formatTarget(i);
      return this.getExpiration(s);
    }, this.del = (i) => {
      if (this.isInitialized(), this.has(i)) {
        const s = this.formatTarget(i), n2 = this.getExpiration(s);
        this.expirations.delete(s), this.events.emit(v.deleted, { target: s, expiration: n2 });
      }
    }, this.on = (i, s) => {
      this.events.on(i, s);
    }, this.once = (i, s) => {
      this.events.once(i, s);
    }, this.off = (i, s) => {
      this.events.off(i, s);
    }, this.removeListener = (i, s) => {
      this.events.removeListener(i, s);
    }, this.logger = cjs$1.generateChildLogger(t, this.name);
  }
  get context() {
    return cjs$1.getLoggerContext(this.logger);
  }
  get storageKey() {
    return this.storagePrefix + this.version + this.core.customStoragePrefix + "//" + this.name;
  }
  get length() {
    return this.expirations.size;
  }
  get keys() {
    return Array.from(this.expirations.keys());
  }
  get values() {
    return Array.from(this.expirations.values());
  }
  formatTarget(e) {
    if (typeof e == "string")
      return lt$1(e);
    if (typeof e == "number")
      return dt$1(e);
    const { message: t } = N$1("UNKNOWN_TYPE", `Target type: ${typeof e}`);
    throw new Error(t);
  }
  async setExpirations(e) {
    await this.core.storage.setItem(this.storageKey, e);
  }
  async getExpirations() {
    return await this.core.storage.getItem(this.storageKey);
  }
  async persist() {
    await this.setExpirations(this.values), this.events.emit(v.sync);
  }
  async restore() {
    try {
      const e = await this.getExpirations();
      if (typeof e > "u" || !e.length)
        return;
      if (this.expirations.size) {
        const { message: t } = N$1("RESTORE_WILL_OVERRIDE", this.name);
        throw this.logger.error(t), new Error(t);
      }
      this.cached = e, this.logger.debug(`Successfully Restored expirations for ${this.name}`), this.logger.trace({ type: "method", method: "restore", expirations: this.values });
    } catch (e) {
      this.logger.debug(`Failed to Restore expirations for ${this.name}`), this.logger.error(e);
    }
  }
  getExpiration(e) {
    const t = this.expirations.get(e);
    if (!t) {
      const { message: i } = N$1("NO_MATCHING_KEY", `${this.name}: ${e}`);
      throw this.logger.error(i), new Error(i);
    }
    return t;
  }
  checkExpiry(e, t) {
    const { expiry: i } = t;
    cjs$3.toMiliseconds(i) - Date.now() <= 0 && this.expire(e, t);
  }
  expire(e, t) {
    this.expirations.delete(e), this.events.emit(v.expired, { target: e, expiration: t });
  }
  checkExpirations() {
    this.core.relayer.connected && this.expirations.forEach((e, t) => this.checkExpiry(t, e));
  }
  registerEventListeners() {
    this.core.heartbeat.on(cjs$2.HEARTBEAT_EVENTS.pulse, () => this.checkExpirations()), this.events.on(v.created, (e) => {
      const t = v.created;
      this.logger.info(`Emitting ${t}`), this.logger.debug({ type: "event", event: t, data: e }), this.persist();
    }), this.events.on(v.expired, (e) => {
      const t = v.expired;
      this.logger.info(`Emitting ${t}`), this.logger.debug({ type: "event", event: t, data: e }), this.persist();
    }), this.events.on(v.deleted, (e) => {
      const t = v.deleted;
      this.logger.info(`Emitting ${t}`), this.logger.debug({ type: "event", event: t, data: e }), this.persist();
    });
  }
  isInitialized() {
    if (!this.initialized) {
      const { message: e } = N$1("NOT_INITIALIZED", this.name);
      throw new Error(e);
    }
  }
}
class Vt extends y {
  constructor(e, t) {
    super(e, t), this.projectId = e, this.logger = t, this.name = Z, this.initialized = false, this.queue = [], this.verifyDisabled = false, this.init = async (i) => {
      if (this.verifyDisabled || C() || !D$2())
        return;
      const s = this.getVerifyUrl(i == null ? void 0 : i.verifyUrl);
      this.verifyUrl !== s && this.removeIframe(), this.verifyUrl = s;
      try {
        await this.createIframe();
      } catch (n2) {
        this.logger.info(`Verify iframe failed to load: ${this.verifyUrl}`), this.logger.info(n2);
      }
      if (!this.initialized) {
        this.removeIframe(), this.verifyUrl = ee;
        try {
          await this.createIframe();
        } catch (n2) {
          this.logger.info(`Verify iframe failed to load: ${this.verifyUrl}`), this.logger.info(n2), this.verifyDisabled = true;
        }
      }
    }, this.register = async (i) => {
      this.initialized ? this.sendPost(i.attestationId) : (this.addToQueue(i.attestationId), await this.init());
    }, this.resolve = async (i) => {
      if (this.isDevEnv)
        return "";
      const s = this.getVerifyUrl(i == null ? void 0 : i.verifyUrl);
      let n2;
      try {
        n2 = await this.fetchAttestation(i.attestationId, s);
      } catch (o) {
        this.logger.info(`failed to resolve attestation: ${i.attestationId} from url: ${s}`), this.logger.info(o), n2 = await this.fetchAttestation(i.attestationId, ee);
      }
      return n2;
    }, this.fetchAttestation = async (i, s) => {
      this.logger.info(`resolving attestation: ${i} from url: ${s}`);
      const n2 = this.startAbortTimer(cjs$3.ONE_SECOND * 2), o = await fetch(`${s}/attestation/${i}`, { signal: this.abortController.signal });
      return clearTimeout(n2), o.status === 200 ? await o.json() : void 0;
    }, this.addToQueue = (i) => {
      this.queue.push(i);
    }, this.processQueue = () => {
      this.queue.length !== 0 && (this.queue.forEach((i) => this.sendPost(i)), this.queue = []);
    }, this.sendPost = (i) => {
      var s;
      try {
        if (!this.iframe)
          return;
        (s = this.iframe.contentWindow) == null || s.postMessage(i, "*"), this.logger.info(`postMessage sent: ${i} ${this.verifyUrl}`);
      } catch {
      }
    }, this.createIframe = async () => {
      let i;
      const s = (n2) => {
        n2.data === "verify_ready" && (this.initialized = true, this.processQueue(), window.removeEventListener("message", s), i());
      };
      await Promise.race([new Promise((n2) => {
        if (document.getElementById(Z))
          return n2();
        window.addEventListener("message", s);
        const o = document.createElement("iframe");
        o.id = Z, o.src = `${this.verifyUrl}/${this.projectId}`, o.style.display = "none", document.body.append(o), this.iframe = o, i = n2;
      }), new Promise((n2, o) => setTimeout(() => {
        window.removeEventListener("message", s), o("verify iframe load timeout");
      }, cjs$3.toMiliseconds(cjs$3.FIVE_SECONDS)))]);
    }, this.removeIframe = () => {
      this.iframe && (this.iframe.remove(), this.iframe = void 0, this.initialized = false);
    }, this.getVerifyUrl = (i) => {
      let s = i || $;
      return _t.includes(s) || (this.logger.info(`verify url: ${s}, not included in trusted list, assigning default: ${$}`), s = $), s;
    }, this.logger = cjs$1.generateChildLogger(t, this.name), this.verifyUrl = $, this.abortController = new AbortController(), this.isDevEnv = te$1() && define_process_env_default.IS_VITEST;
  }
  get context() {
    return cjs$1.getLoggerContext(this.logger);
  }
  startAbortTimer(e) {
    return this.abortController = new AbortController(), setTimeout(() => this.abortController.abort(), cjs$3.toMiliseconds(e));
  }
}
var Or = Object.defineProperty, qt = Object.getOwnPropertySymbols, Ar = Object.prototype.hasOwnProperty, zr = Object.prototype.propertyIsEnumerable, jt = (r, e, t) => e in r ? Or(r, e, { enumerable: true, configurable: true, writable: true, value: t }) : r[e] = t, Gt = (r, e) => {
  for (var t in e || (e = {}))
    Ar.call(e, t) && jt(r, t, e[t]);
  if (qt)
    for (var t of qt(e))
      zr.call(e, t) && jt(r, t, e[t]);
  return r;
};
class te extends n {
  constructor(e) {
    super(e), this.protocol = le, this.version = Xe, this.name = Q, this.events = new eventsExports.EventEmitter(), this.initialized = false, this.on = (i, s) => this.events.on(i, s), this.once = (i, s) => this.events.once(i, s), this.off = (i, s) => this.events.off(i, s), this.removeListener = (i, s) => this.events.removeListener(i, s), this.projectId = e == null ? void 0 : e.projectId, this.relayUrl = (e == null ? void 0 : e.relayUrl) || ge, this.customStoragePrefix = e != null && e.customStoragePrefix ? `:${e.customStoragePrefix}` : "";
    const t = typeof (e == null ? void 0 : e.logger) < "u" && typeof (e == null ? void 0 : e.logger) != "string" ? e.logger : cjs$1.pino(cjs$1.getDefaultLoggerOptions({ level: (e == null ? void 0 : e.logger) || Qe.logger }));
    this.logger = cjs$1.generateChildLogger(t, this.name), this.heartbeat = new cjs$2.HeartBeat(), this.crypto = new Tt(this, this.logger, e == null ? void 0 : e.keychain), this.history = new Kt(this, this.logger), this.expirer = new Bt(this, this.logger), this.storage = e != null && e.storage ? e.storage : new h$2(Gt(Gt({}, Ze), e == null ? void 0 : e.storageOptions)), this.relayer = new Ut({ core: this, logger: this.logger, relayUrl: this.relayUrl, projectId: this.projectId }), this.pairing = new kt(this, this.logger), this.verify = new Vt(this.projectId || "", this.logger);
  }
  static async init(e) {
    const t = new te(e);
    await t.initialize();
    const i = await t.crypto.getClientId();
    return await t.storage.setItem(yt, i), t;
  }
  get context() {
    return cjs$1.getLoggerContext(this.logger);
  }
  async start() {
    this.initialized || await this.initialize();
  }
  async initialize() {
    this.logger.trace("Initialized");
    try {
      await this.crypto.init(), await this.history.init(), await this.expirer.init(), await this.relayer.init(), await this.heartbeat.init(), await this.pairing.init(), this.initialized = true, this.logger.info("Core Initialization Success");
    } catch (e) {
      throw this.logger.warn(`Core Initialization Failure at epoch ${Date.now()}`, e), this.logger.error(e.message), e;
    }
  }
}
const Nr = te;
const index_es = /* @__PURE__ */ Object.freeze(/* @__PURE__ */ Object.defineProperty({
  __proto__: null,
  CORE_CONTEXT: Q,
  CORE_DEFAULT: Qe,
  CORE_PROTOCOL: le,
  CORE_STORAGE_OPTIONS: Ze,
  CORE_STORAGE_PREFIX: O,
  CORE_VERSION: Xe,
  CRYPTO_CLIENT_SEED: de,
  CRYPTO_CONTEXT: et,
  CRYPTO_JWT_TTL: tt,
  Core: Nr,
  Crypto: Tt,
  EXPIRER_CONTEXT: Ct,
  EXPIRER_DEFAULT_TTL: yr,
  EXPIRER_EVENTS: v,
  EXPIRER_STORAGE_VERSION: Rt,
  Expirer: Bt,
  HISTORY_CONTEXT: vt,
  HISTORY_EVENTS: R,
  HISTORY_STORAGE_VERSION: It,
  JsonRpcHistory: Kt,
  KEYCHAIN_CONTEXT: it,
  KEYCHAIN_STORAGE_VERSION: st,
  KeyChain: St,
  MESSAGES_CONTEXT: rt,
  MESSAGES_STORAGE_VERSION: nt,
  MessageTracker: Pt,
  PAIRING_CONTEXT: Et,
  PAIRING_DEFAULT_TTL: Dr,
  PAIRING_EVENTS: V,
  PAIRING_RPC_OPTS: F,
  PAIRING_STORAGE_VERSION: wt,
  PENDING_SUB_RESOLUTION_TIMEOUT: ft,
  PUBLISHER_CONTEXT: at,
  PUBLISHER_DEFAULT_TTL: ot,
  Pairing: kt,
  RELAYER_CONTEXT: ut,
  RELAYER_DEFAULT_LOGGER: ct,
  RELAYER_DEFAULT_PROTOCOL: ht,
  RELAYER_DEFAULT_RELAY_URL: ge,
  RELAYER_EVENTS: D,
  RELAYER_FAILOVER_RELAY_URL: pe,
  RELAYER_PROVIDER_EVENTS: P,
  RELAYER_RECONNECT_TIMEOUT: dt,
  RELAYER_SDK_VERSION: gt,
  RELAYER_STORAGE_OPTIONS: gr,
  RELAYER_SUBSCRIBER_SUFFIX: lt,
  RELAYER_TRANSPORT_CUTOFF: pt,
  Relayer: Ut,
  STORE_STORAGE_VERSION: Dt,
  SUBSCRIBER_CONTEXT: mt,
  SUBSCRIBER_DEFAULT_TTL: pr,
  SUBSCRIBER_EVENTS: w,
  SUBSCRIBER_STORAGE_VERSION: bt,
  Store: Mt,
  Subscriber: At,
  TRUSTED_VERIFY_URLS: _t,
  VERIFY_CONTEXT: Z,
  VERIFY_FALLBACK_SERVER: ee,
  VERIFY_SERVER: $,
  Verify: Vt,
  WALLETCONNECT_CLIENT_ID: yt,
  default: te
}, Symbol.toStringTag, { value: "Module" }));
export {
  $,
  D,
  Mt as M,
  Nr as N,
  S$1 as S,
  V,
  Ye$1 as Y,
  isJsonRpcError as a,
  isJsonRpcRequest as b,
  cjs$1 as c,
  isJsonRpcResponse as d,
  eventsExports as e,
  formatJsonRpcError as f,
  formatJsonRpcRequest as g,
  formatJsonRpcResult as h,
  isJsonRpcResult as i,
  b$1 as j,
  ht as k,
  index_es as l,
  payloadId as p,
  v
};
