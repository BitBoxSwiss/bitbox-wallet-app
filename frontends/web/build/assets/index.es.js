var va = Object.defineProperty;
var o = (r, e) => va(r, "name", { value: e, configurable: !0 });
import { g as fn, a as wa, E as Dt, b as V, I as Ea, M as dn, O as gn, P as Ti, R as Cr, S as _a, c as lt, N as X, T as pn, V as yn, Z as xa, $ as Jr, a0 as Ia, K as Sa, a1 as Ta, a2 as Es, a3 as Oa, a4 as Ra, a5 as La, a6 as _s, a7 as Aa, L as Xr, a8 as Qr, U as Ht, a9 as fr, aa as Vt, ab as Pa, ac as Fa, ad as xs, ae as Ca, af as Na, w as Zr, ag as Da, ah as Ma, _ as za, p as dr, ai as Ua, aj as Is, d as $a, y as jr, m as Ss, H as Kr, k as ja, n as Ka, C as Ba, ak as Ha, al as ka, am as Ga, D as Va, an as qa, ao as Ya } from "./index.js";
var Oi = { exports: {} }, Nt = typeof Reflect == "object" ? Reflect : null, Ts = Nt && typeof Nt.apply == "function" ? Nt.apply : /* @__PURE__ */ o(function(e, t, i) {
  return Function.prototype.apply.call(e, t, i);
}, "ReflectApply"), gr;
Nt && typeof Nt.ownKeys == "function" ? gr = Nt.ownKeys : Object.getOwnPropertySymbols ? gr = /* @__PURE__ */ o(function(e) {
  return Object.getOwnPropertyNames(e).concat(Object.getOwnPropertySymbols(e));
}, "ReflectOwnKeys") : gr = /* @__PURE__ */ o(function(e) {
  return Object.getOwnPropertyNames(e);
}, "ReflectOwnKeys");
function Wa(r) {
  console && console.warn && console.warn(r);
}
o(Wa, "ProcessEmitWarning");
var mn = Number.isNaN || /* @__PURE__ */ o(function(e) {
  return e !== e;
}, "NumberIsNaN");
function Q() {
  Q.init.call(this);
}
o(Q, "EventEmitter");
Oi.exports = Q;
Oi.exports.once = Za;
Q.EventEmitter = Q;
Q.prototype._events = void 0;
Q.prototype._eventsCount = 0;
Q.prototype._maxListeners = void 0;
var Os = 10;
function Nr(r) {
  if (typeof r != "function")
    throw new TypeError('The "listener" argument must be of type Function. Received type ' + typeof r);
}
o(Nr, "checkListener");
Object.defineProperty(Q, "defaultMaxListeners", {
  enumerable: !0,
  get: function() {
    return Os;
  },
  set: function(r) {
    if (typeof r != "number" || r < 0 || mn(r))
      throw new RangeError('The value of "defaultMaxListeners" is out of range. It must be a non-negative number. Received ' + r + ".");
    Os = r;
  }
});
Q.init = function() {
  (this._events === void 0 || this._events === Object.getPrototypeOf(this)._events) && (this._events = /* @__PURE__ */ Object.create(null), this._eventsCount = 0), this._maxListeners = this._maxListeners || void 0;
};
Q.prototype.setMaxListeners = /* @__PURE__ */ o(function(e) {
  if (typeof e != "number" || e < 0 || mn(e))
    throw new RangeError('The value of "n" is out of range. It must be a non-negative number. Received ' + e + ".");
  return this._maxListeners = e, this;
}, "setMaxListeners");
function bn(r) {
  return r._maxListeners === void 0 ? Q.defaultMaxListeners : r._maxListeners;
}
o(bn, "_getMaxListeners");
Q.prototype.getMaxListeners = /* @__PURE__ */ o(function() {
  return bn(this);
}, "getMaxListeners");
Q.prototype.emit = /* @__PURE__ */ o(function(e) {
  for (var t = [], i = 1; i < arguments.length; i++)
    t.push(arguments[i]);
  var n = e === "error", c = this._events;
  if (c !== void 0)
    n = n && c.error === void 0;
  else if (!n)
    return !1;
  if (n) {
    var h;
    if (t.length > 0 && (h = t[0]), h instanceof Error)
      throw h;
    var d = new Error("Unhandled error." + (h ? " (" + h.message + ")" : ""));
    throw d.context = h, d;
  }
  var p = c[e];
  if (p === void 0)
    return !1;
  if (typeof p == "function")
    Ts(p, this, t);
  else
    for (var u = p.length, y = xn(p, u), i = 0; i < u; ++i)
      Ts(y[i], this, t);
  return !0;
}, "emit");
function vn(r, e, t, i) {
  var n, c, h;
  if (Nr(t), c = r._events, c === void 0 ? (c = r._events = /* @__PURE__ */ Object.create(null), r._eventsCount = 0) : (c.newListener !== void 0 && (r.emit(
    "newListener",
    e,
    t.listener ? t.listener : t
  ), c = r._events), h = c[e]), h === void 0)
    h = c[e] = t, ++r._eventsCount;
  else if (typeof h == "function" ? h = c[e] = i ? [t, h] : [h, t] : i ? h.unshift(t) : h.push(t), n = bn(r), n > 0 && h.length > n && !h.warned) {
    h.warned = !0;
    var d = new Error("Possible EventEmitter memory leak detected. " + h.length + " " + String(e) + " listeners added. Use emitter.setMaxListeners() to increase limit");
    d.name = "MaxListenersExceededWarning", d.emitter = r, d.type = e, d.count = h.length, Wa(d);
  }
  return r;
}
o(vn, "_addListener");
Q.prototype.addListener = /* @__PURE__ */ o(function(e, t) {
  return vn(this, e, t, !1);
}, "addListener");
Q.prototype.on = Q.prototype.addListener;
Q.prototype.prependListener = /* @__PURE__ */ o(function(e, t) {
  return vn(this, e, t, !0);
}, "prependListener");
function Ja() {
  if (!this.fired)
    return this.target.removeListener(this.type, this.wrapFn), this.fired = !0, arguments.length === 0 ? this.listener.call(this.target) : this.listener.apply(this.target, arguments);
}
o(Ja, "onceWrapper");
function wn(r, e, t) {
  var i = { fired: !1, wrapFn: void 0, target: r, type: e, listener: t }, n = Ja.bind(i);
  return n.listener = t, i.wrapFn = n, n;
}
o(wn, "_onceWrap");
Q.prototype.once = /* @__PURE__ */ o(function(e, t) {
  return Nr(t), this.on(e, wn(this, e, t)), this;
}, "once");
Q.prototype.prependOnceListener = /* @__PURE__ */ o(function(e, t) {
  return Nr(t), this.prependListener(e, wn(this, e, t)), this;
}, "prependOnceListener");
Q.prototype.removeListener = /* @__PURE__ */ o(function(e, t) {
  var i, n, c, h, d;
  if (Nr(t), n = this._events, n === void 0)
    return this;
  if (i = n[e], i === void 0)
    return this;
  if (i === t || i.listener === t)
    --this._eventsCount === 0 ? this._events = /* @__PURE__ */ Object.create(null) : (delete n[e], n.removeListener && this.emit("removeListener", e, i.listener || t));
  else if (typeof i != "function") {
    for (c = -1, h = i.length - 1; h >= 0; h--)
      if (i[h] === t || i[h].listener === t) {
        d = i[h].listener, c = h;
        break;
      }
    if (c < 0)
      return this;
    c === 0 ? i.shift() : Xa(i, c), i.length === 1 && (n[e] = i[0]), n.removeListener !== void 0 && this.emit("removeListener", e, d || t);
  }
  return this;
}, "removeListener");
Q.prototype.off = Q.prototype.removeListener;
Q.prototype.removeAllListeners = /* @__PURE__ */ o(function(e) {
  var t, i, n;
  if (i = this._events, i === void 0)
    return this;
  if (i.removeListener === void 0)
    return arguments.length === 0 ? (this._events = /* @__PURE__ */ Object.create(null), this._eventsCount = 0) : i[e] !== void 0 && (--this._eventsCount === 0 ? this._events = /* @__PURE__ */ Object.create(null) : delete i[e]), this;
  if (arguments.length === 0) {
    var c = Object.keys(i), h;
    for (n = 0; n < c.length; ++n)
      h = c[n], h !== "removeListener" && this.removeAllListeners(h);
    return this.removeAllListeners("removeListener"), this._events = /* @__PURE__ */ Object.create(null), this._eventsCount = 0, this;
  }
  if (t = i[e], typeof t == "function")
    this.removeListener(e, t);
  else if (t !== void 0)
    for (n = t.length - 1; n >= 0; n--)
      this.removeListener(e, t[n]);
  return this;
}, "removeAllListeners");
function En(r, e, t) {
  var i = r._events;
  if (i === void 0)
    return [];
  var n = i[e];
  return n === void 0 ? [] : typeof n == "function" ? t ? [n.listener || n] : [n] : t ? Qa(n) : xn(n, n.length);
}
o(En, "_listeners");
Q.prototype.listeners = /* @__PURE__ */ o(function(e) {
  return En(this, e, !0);
}, "listeners");
Q.prototype.rawListeners = /* @__PURE__ */ o(function(e) {
  return En(this, e, !1);
}, "rawListeners");
Q.listenerCount = function(r, e) {
  return typeof r.listenerCount == "function" ? r.listenerCount(e) : _n.call(r, e);
};
Q.prototype.listenerCount = _n;
function _n(r) {
  var e = this._events;
  if (e !== void 0) {
    var t = e[r];
    if (typeof t == "function")
      return 1;
    if (t !== void 0)
      return t.length;
  }
  return 0;
}
o(_n, "listenerCount");
Q.prototype.eventNames = /* @__PURE__ */ o(function() {
  return this._eventsCount > 0 ? gr(this._events) : [];
}, "eventNames");
function xn(r, e) {
  for (var t = new Array(e), i = 0; i < e; ++i)
    t[i] = r[i];
  return t;
}
o(xn, "arrayClone");
function Xa(r, e) {
  for (; e + 1 < r.length; e++)
    r[e] = r[e + 1];
  r.pop();
}
o(Xa, "spliceOne");
function Qa(r) {
  for (var e = new Array(r.length), t = 0; t < e.length; ++t)
    e[t] = r[t].listener || r[t];
  return e;
}
o(Qa, "unwrapListeners");
function Za(r, e) {
  return new Promise(function(t, i) {
    function n(h) {
      r.removeListener(e, c), i(h);
    }
    o(n, "errorListener");
    function c() {
      typeof r.removeListener == "function" && r.removeListener("error", n), t([].slice.call(arguments));
    }
    o(c, "resolver"), In(r, e, c, { once: !0 }), e !== "error" && ec(r, n, { once: !0 });
  });
}
o(Za, "once");
function ec(r, e, t) {
  typeof r.on == "function" && In(r, "error", e, t);
}
o(ec, "addErrorHandlerIfEventEmitter");
function In(r, e, t, i) {
  if (typeof r.on == "function")
    i.once ? r.once(e, t) : r.on(e, t);
  else if (typeof r.addEventListener == "function")
    r.addEventListener(e, /* @__PURE__ */ o(function n(c) {
      i.once && r.removeEventListener(e, n), t(c);
    }, "wrapListener"));
  else
    throw new TypeError('The "emitter" argument must be of type EventEmitter. Received type ' + typeof r);
}
o(In, "eventTargetAgnosticAddListener");
var ft = Oi.exports;
const tc = /* @__PURE__ */ fn(ft), rc = /"(?:_|\\u0{2}5[Ff]){2}(?:p|\\u0{2}70)(?:r|\\u0{2}72)(?:o|\\u0{2}6[Ff])(?:t|\\u0{2}74)(?:o|\\u0{2}6[Ff])(?:_|\\u0{2}5[Ff]){2}"\s*:/, ic = /"(?:c|\\u0063)(?:o|\\u006[Ff])(?:n|\\u006[Ee])(?:s|\\u0073)(?:t|\\u0074)(?:r|\\u0072)(?:u|\\u0075)(?:c|\\u0063)(?:t|\\u0074)(?:o|\\u006[Ff])(?:r|\\u0072)"\s*:/, sc = /^\s*["[{]|^\s*-?\d{1,16}(\.\d{1,17})?([Ee][+-]?\d+)?\s*$/;
function nc(r, e) {
  if (r === "__proto__" || r === "constructor" && e && typeof e == "object" && "prototype" in e) {
    oc(r);
    return;
  }
  return e;
}
o(nc, "jsonParseTransform");
function oc(r) {
  console.warn(`[destr] Dropping "${r}" key to prevent prototype pollution.`);
}
o(oc, "warnKeyDropped");
function ur(r, e = {}) {
  if (typeof r != "string")
    return r;
  const t = r.trim();
  if (
    // eslint-disable-next-line unicorn/prefer-at
    r[0] === '"' && r.at(-1) === '"' && !r.includes("\\")
  )
    return t.slice(1, -1);
  if (t.length <= 9) {
    const i = t.toLowerCase();
    if (i === "true")
      return !0;
    if (i === "false")
      return !1;
    if (i === "undefined")
      return;
    if (i === "null")
      return null;
    if (i === "nan")
      return Number.NaN;
    if (i === "infinity")
      return Number.POSITIVE_INFINITY;
    if (i === "-infinity")
      return Number.NEGATIVE_INFINITY;
  }
  if (!sc.test(r)) {
    if (e.strict)
      throw new SyntaxError("[destr] Invalid JSON");
    return r;
  }
  try {
    if (rc.test(r) || ic.test(r)) {
      if (e.strict)
        throw new Error("[destr] Possible prototype pollution");
      return JSON.parse(r, nc);
    }
    return JSON.parse(r);
  } catch (i) {
    if (e.strict)
      throw i;
    return r;
  }
}
o(ur, "destr");
function ac(r) {
  return !r || typeof r.then != "function" ? Promise.resolve(r) : r;
}
o(ac, "wrapToPromise");
function $e(r, ...e) {
  try {
    return ac(r(...e));
  } catch (t) {
    return Promise.reject(t);
  }
}
o($e, "asyncCall");
function cc(r) {
  const e = typeof r;
  return r === null || e !== "object" && e !== "function";
}
o(cc, "isPrimitive");
function hc(r) {
  const e = Object.getPrototypeOf(r);
  return !e || e.isPrototypeOf(Object);
}
o(hc, "isPureObject");
function pr(r) {
  if (cc(r))
    return String(r);
  if (hc(r) || Array.isArray(r))
    return JSON.stringify(r);
  if (typeof r.toJSON == "function")
    return pr(r.toJSON());
  throw new Error("[unstorage] Cannot stringify value!");
}
o(pr, "stringify");
function Sn() {
  if (typeof Buffer === void 0)
    throw new TypeError("[unstorage] Buffer is not supported!");
}
o(Sn, "checkBufferSupport");
const ei = "base64:";
function uc(r) {
  if (typeof r == "string")
    return r;
  Sn();
  const e = Buffer.from(r).toString("base64");
  return ei + e;
}
o(uc, "serializeRaw");
function lc(r) {
  return typeof r != "string" || !r.startsWith(ei) ? r : (Sn(), Buffer.from(r.slice(ei.length), "base64"));
}
o(lc, "deserializeRaw");
function Xe(r) {
  return r ? r.split("?")[0].replace(/[/\\]/g, ":").replace(/:+/g, ":").replace(/^:|:$/g, "") : "";
}
o(Xe, "normalizeKey");
function fc(...r) {
  return Xe(r.join(":"));
}
o(fc, "joinKeys");
function lr(r) {
  return r = Xe(r), r ? r + ":" : "";
}
o(lr, "normalizeBaseKey");
const dc = "memory", gc = () => {
  const r = /* @__PURE__ */ new Map();
  return {
    name: dc,
    options: {},
    hasItem(e) {
      return r.has(e);
    },
    getItem(e) {
      return r.get(e) ?? null;
    },
    getItemRaw(e) {
      return r.get(e) ?? null;
    },
    setItem(e, t) {
      r.set(e, t);
    },
    setItemRaw(e, t) {
      r.set(e, t);
    },
    removeItem(e) {
      r.delete(e);
    },
    getKeys() {
      return Array.from(r.keys());
    },
    clear() {
      r.clear();
    },
    dispose() {
      r.clear();
    }
  };
};
function pc(r = {}) {
  const e = {
    mounts: { "": r.driver || gc() },
    mountpoints: [""],
    watching: !1,
    watchListeners: [],
    unwatch: {}
  }, t = /* @__PURE__ */ o((u) => {
    for (const y of e.mountpoints)
      if (u.startsWith(y))
        return {
          base: y,
          relativeKey: u.slice(y.length),
          driver: e.mounts[y]
        };
    return {
      base: "",
      relativeKey: u,
      driver: e.mounts[""]
    };
  }, "getMount"), i = /* @__PURE__ */ o((u, y) => e.mountpoints.filter(
    (E) => E.startsWith(u) || y && u.startsWith(E)
  ).map((E) => ({
    relativeBase: u.length > E.length ? u.slice(E.length) : void 0,
    mountpoint: E,
    driver: e.mounts[E]
  })), "getMounts"), n = /* @__PURE__ */ o((u, y) => {
    if (e.watching) {
      y = Xe(y);
      for (const E of e.watchListeners)
        E(u, y);
    }
  }, "onChange"), c = /* @__PURE__ */ o(async () => {
    if (!e.watching) {
      e.watching = !0;
      for (const u in e.mounts)
        e.unwatch[u] = await Rs(
          e.mounts[u],
          n,
          u
        );
    }
  }, "startWatch"), h = /* @__PURE__ */ o(async () => {
    if (e.watching) {
      for (const u in e.unwatch)
        await e.unwatch[u]();
      e.unwatch = {}, e.watching = !1;
    }
  }, "stopWatch"), d = /* @__PURE__ */ o((u, y, E) => {
    const S = /* @__PURE__ */ new Map(), R = /* @__PURE__ */ o((I) => {
      let L = S.get(I.base);
      return L || (L = {
        driver: I.driver,
        base: I.base,
        items: []
      }, S.set(I.base, L)), L;
    }, "getBatch");
    for (const I of u) {
      const L = typeof I == "string", j = Xe(L ? I : I.key), H = L ? void 0 : I.value, $ = L || !I.options ? y : { ...y, ...I.options }, Z = t(j);
      R(Z).items.push({
        key: j,
        value: H,
        relativeKey: Z.relativeKey,
        options: $
      });
    }
    return Promise.all([...S.values()].map((I) => E(I))).then(
      (I) => I.flat()
    );
  }, "runBatch"), p = {
    // Item
    hasItem(u, y = {}) {
      u = Xe(u);
      const { relativeKey: E, driver: S } = t(u);
      return $e(S.hasItem, E, y);
    },
    getItem(u, y = {}) {
      u = Xe(u);
      const { relativeKey: E, driver: S } = t(u);
      return $e(S.getItem, E, y).then(
        (R) => ur(R)
      );
    },
    getItems(u, y) {
      return d(u, y, (E) => E.driver.getItems ? $e(
        E.driver.getItems,
        E.items.map((S) => ({
          key: S.relativeKey,
          options: S.options
        })),
        y
      ).then(
        (S) => S.map((R) => ({
          key: fc(E.base, R.key),
          value: ur(R.value)
        }))
      ) : Promise.all(
        E.items.map((S) => $e(
          E.driver.getItem,
          S.relativeKey,
          S.options
        ).then((R) => ({
          key: S.key,
          value: ur(R)
        })))
      ));
    },
    getItemRaw(u, y = {}) {
      u = Xe(u);
      const { relativeKey: E, driver: S } = t(u);
      return S.getItemRaw ? $e(S.getItemRaw, E, y) : $e(S.getItem, E, y).then(
        (R) => lc(R)
      );
    },
    async setItem(u, y, E = {}) {
      if (y === void 0)
        return p.removeItem(u);
      u = Xe(u);
      const { relativeKey: S, driver: R } = t(u);
      R.setItem && (await $e(R.setItem, S, pr(y), E), R.watch || n("update", u));
    },
    async setItems(u, y) {
      await d(u, y, async (E) => {
        E.driver.setItems && await $e(
          E.driver.setItems,
          E.items.map((S) => ({
            key: S.relativeKey,
            value: pr(S.value),
            options: S.options
          })),
          y
        ), E.driver.setItem && await Promise.all(
          E.items.map((S) => $e(
            E.driver.setItem,
            S.relativeKey,
            pr(S.value),
            S.options
          ))
        );
      });
    },
    async setItemRaw(u, y, E = {}) {
      if (y === void 0)
        return p.removeItem(u, E);
      u = Xe(u);
      const { relativeKey: S, driver: R } = t(u);
      if (R.setItemRaw)
        await $e(R.setItemRaw, S, y, E);
      else if (R.setItem)
        await $e(R.setItem, S, uc(y), E);
      else
        return;
      R.watch || n("update", u);
    },
    async removeItem(u, y = {}) {
      typeof y == "boolean" && (y = { removeMeta: y }), u = Xe(u);
      const { relativeKey: E, driver: S } = t(u);
      S.removeItem && (await $e(S.removeItem, E, y), (y.removeMeta || y.removeMata) && await $e(S.removeItem, E + "$", y), S.watch || n("remove", u));
    },
    // Meta
    async getMeta(u, y = {}) {
      typeof y == "boolean" && (y = { nativeOnly: y }), u = Xe(u);
      const { relativeKey: E, driver: S } = t(u), R = /* @__PURE__ */ Object.create(null);
      if (S.getMeta && Object.assign(R, await $e(S.getMeta, E, y)), !y.nativeOnly) {
        const I = await $e(
          S.getItem,
          E + "$",
          y
        ).then((L) => ur(L));
        I && typeof I == "object" && (typeof I.atime == "string" && (I.atime = new Date(I.atime)), typeof I.mtime == "string" && (I.mtime = new Date(I.mtime)), Object.assign(R, I));
      }
      return R;
    },
    setMeta(u, y, E = {}) {
      return this.setItem(u + "$", y, E);
    },
    removeMeta(u, y = {}) {
      return this.removeItem(u + "$", y);
    },
    // Keys
    async getKeys(u, y = {}) {
      u = lr(u);
      const E = i(u, !0);
      let S = [];
      const R = [];
      for (const I of E) {
        const j = (await $e(
          I.driver.getKeys,
          I.relativeBase,
          y
        )).map((H) => I.mountpoint + Xe(H)).filter((H) => !S.some(($) => H.startsWith($)));
        R.push(...j), S = [
          I.mountpoint,
          ...S.filter((H) => !H.startsWith(I.mountpoint))
        ];
      }
      return u ? R.filter((I) => I.startsWith(u) && !I.endsWith("$")) : R.filter((I) => !I.endsWith("$"));
    },
    // Utils
    async clear(u, y = {}) {
      u = lr(u), await Promise.all(
        i(u, !1).map(async (E) => {
          if (E.driver.clear)
            return $e(E.driver.clear, E.relativeBase, y);
          if (E.driver.removeItem) {
            const S = await E.driver.getKeys(E.relativeBase || "", y);
            return Promise.all(
              S.map((R) => E.driver.removeItem(R, y))
            );
          }
        })
      );
    },
    async dispose() {
      await Promise.all(
        Object.values(e.mounts).map((u) => Ls(u))
      );
    },
    async watch(u) {
      return await c(), e.watchListeners.push(u), async () => {
        e.watchListeners = e.watchListeners.filter(
          (y) => y !== u
        ), e.watchListeners.length === 0 && await h();
      };
    },
    async unwatch() {
      e.watchListeners = [], await h();
    },
    // Mount
    mount(u, y) {
      if (u = lr(u), u && e.mounts[u])
        throw new Error(`already mounted at ${u}`);
      return u && (e.mountpoints.push(u), e.mountpoints.sort((E, S) => S.length - E.length)), e.mounts[u] = y, e.watching && Promise.resolve(Rs(y, n, u)).then((E) => {
        e.unwatch[u] = E;
      }).catch(console.error), p;
    },
    async unmount(u, y = !0) {
      u = lr(u), !(!u || !e.mounts[u]) && (e.watching && u in e.unwatch && (e.unwatch[u](), delete e.unwatch[u]), y && await Ls(e.mounts[u]), e.mountpoints = e.mountpoints.filter((E) => E !== u), delete e.mounts[u]);
    },
    getMount(u = "") {
      u = Xe(u) + ":";
      const y = t(u);
      return {
        driver: y.driver,
        base: y.base
      };
    },
    getMounts(u = "", y = {}) {
      return u = Xe(u), i(u, y.parents).map((S) => ({
        driver: S.driver,
        base: S.mountpoint
      }));
    }
  };
  return p;
}
o(pc, "createStorage");
function Rs(r, e, t) {
  return r.watch ? r.watch((i, n) => e(i, t + n)) : () => {
  };
}
o(Rs, "watch");
async function Ls(r) {
  typeof r.dispose == "function" && await $e(r.dispose);
}
o(Ls, "dispose");
function Lt(r) {
  return new Promise((e, t) => {
    r.oncomplete = r.onsuccess = () => e(r.result), r.onabort = r.onerror = () => t(r.error);
  });
}
o(Lt, "promisifyRequest");
function Tn(r, e) {
  const t = indexedDB.open(r);
  t.onupgradeneeded = () => t.result.createObjectStore(e);
  const i = Lt(t);
  return (n, c) => i.then((h) => c(h.transaction(e, n).objectStore(e)));
}
o(Tn, "createStore");
let Br;
function er() {
  return Br || (Br = Tn("keyval-store", "keyval")), Br;
}
o(er, "defaultGetStore");
function As(r, e = er()) {
  return e("readonly", (t) => Lt(t.get(r)));
}
o(As, "get");
function yc(r, e, t = er()) {
  return t("readwrite", (i) => (i.put(e, r), Lt(i.transaction)));
}
o(yc, "set");
function mc(r, e = er()) {
  return e("readwrite", (t) => (t.delete(r), Lt(t.transaction)));
}
o(mc, "del");
function bc(r = er()) {
  return r("readwrite", (e) => (e.clear(), Lt(e.transaction)));
}
o(bc, "clear");
function vc(r, e) {
  return r.openCursor().onsuccess = function() {
    this.result && (e(this.result), this.result.continue());
  }, Lt(r.transaction);
}
o(vc, "eachCursor");
function wc(r = er()) {
  return r("readonly", (e) => {
    if (e.getAllKeys)
      return Lt(e.getAllKeys());
    const t = [];
    return vc(e, (i) => t.push(i.key)).then(() => t);
  });
}
o(wc, "keys");
const Ec = /* @__PURE__ */ o((r) => JSON.stringify(r, (e, t) => typeof t == "bigint" ? t.toString() + "n" : t), "JSONStringify"), _c = /* @__PURE__ */ o((r) => {
  const e = /([\[:])?(\d{17,}|(?:[9](?:[1-9]07199254740991|0[1-9]7199254740991|00[8-9]199254740991|007[2-9]99254740991|007199[3-9]54740991|0071992[6-9]4740991|00719925[5-9]740991|007199254[8-9]40991|0071992547[5-9]0991|00719925474[1-9]991|00719925474099[2-9])))([,\}\]])/g, t = r.replace(e, '$1"$2n"$3');
  return JSON.parse(t, (i, n) => typeof n == "string" && n.match(/^\d+n$/) ? BigInt(n.substring(0, n.length - 1)) : n);
}, "JSONParse");
function Dr(r) {
  if (typeof r != "string")
    throw new Error(`Cannot safe json parse value of type ${typeof r}`);
  try {
    return _c(r);
  } catch {
    return r;
  }
}
o(Dr, "safeJsonParse");
function tr(r) {
  return typeof r == "string" ? r : Ec(r) || "";
}
o(tr, "safeJsonStringify");
const xc = "idb-keyval";
var Ic = /* @__PURE__ */ o((r = {}) => {
  const e = r.base && r.base.length > 0 ? `${r.base}:` : "", t = /* @__PURE__ */ o((n) => e + n, "e");
  let i;
  return r.dbName && r.storeName && (i = Tn(r.dbName, r.storeName)), { name: xc, options: r, async hasItem(n) {
    return !(typeof await As(t(n), i) > "u");
  }, async getItem(n) {
    return await As(t(n), i) ?? null;
  }, setItem(n, c) {
    return yc(t(n), c, i);
  }, removeItem(n) {
    return mc(t(n), i);
  }, getKeys() {
    return wc(i);
  }, clear() {
    return bc(i);
  } };
}, "z");
const Sc = "WALLET_CONNECT_V2_INDEXED_DB", Tc = "keyvaluestorage", Ni = class Ni {
  constructor() {
    this.indexedDb = pc({ driver: Ic({ dbName: Sc, storeName: Tc }) });
  }
  async getKeys() {
    return this.indexedDb.getKeys();
  }
  async getEntries() {
    return (await this.indexedDb.getItems(await this.indexedDb.getKeys())).map((e) => [e.key, e.value]);
  }
  async getItem(e) {
    const t = await this.indexedDb.getItem(e);
    if (t !== null)
      return t;
  }
  async setItem(e, t) {
    await this.indexedDb.setItem(e, tr(t));
  }
  async removeItem(e) {
    await this.indexedDb.removeItem(e);
  }
};
o(Ni, "_");
let ti = Ni;
var Hr = typeof globalThis < "u" ? globalThis : typeof window < "u" ? window : typeof global < "u" ? global : typeof self < "u" ? self : {}, yr = { exports: {} };
(function() {
  let r;
  function e() {
  }
  o(e, "t"), r = e, r.prototype.getItem = function(t) {
    return this.hasOwnProperty(t) ? String(this[t]) : null;
  }, r.prototype.setItem = function(t, i) {
    this[t] = String(i);
  }, r.prototype.removeItem = function(t) {
    delete this[t];
  }, r.prototype.clear = function() {
    const t = this;
    Object.keys(t).forEach(function(i) {
      t[i] = void 0, delete t[i];
    });
  }, r.prototype.key = function(t) {
    return t = t || 0, Object.keys(this)[t];
  }, r.prototype.__defineGetter__("length", function() {
    return Object.keys(this).length;
  }), typeof Hr < "u" && Hr.localStorage ? yr.exports = Hr.localStorage : typeof window < "u" && window.localStorage ? yr.exports = window.localStorage : yr.exports = new e();
})();
function Oc(r) {
  var e;
  return [r[0], Dr((e = r[1]) != null ? e : "")];
}
o(Oc, "k");
const Di = class Di {
  constructor() {
    this.localStorage = yr.exports;
  }
  async getKeys() {
    return Object.keys(this.localStorage);
  }
  async getEntries() {
    return Object.entries(this.localStorage).map(Oc);
  }
  async getItem(e) {
    const t = this.localStorage.getItem(e);
    if (t !== null)
      return Dr(t);
  }
  async setItem(e, t) {
    this.localStorage.setItem(e, tr(t));
  }
  async removeItem(e) {
    this.localStorage.removeItem(e);
  }
};
o(Di, "K");
let ri = Di;
const Rc = "wc_storage_version", Ps = 1, Lc = /* @__PURE__ */ o(async (r, e, t) => {
  const i = Rc, n = await e.getItem(i);
  if (n && n >= Ps) {
    t(e);
    return;
  }
  const c = await r.getKeys();
  if (!c.length) {
    t(e);
    return;
  }
  const h = [];
  for (; c.length; ) {
    const d = c.shift();
    if (!d)
      continue;
    const p = d.toLowerCase();
    if (p.includes("wc@") || p.includes("walletconnect") || p.includes("wc_") || p.includes("wallet_connect")) {
      const u = await r.getItem(d);
      await e.setItem(d, u), h.push(d);
    }
  }
  await e.setItem(i, Ps), t(e), Ac(r, h);
}, "O$1"), Ac = /* @__PURE__ */ o(async (r, e) => {
  e.length && e.forEach(async (t) => {
    await r.removeItem(t);
  });
}, "j");
var qt;
let Pc = (qt = class {
  constructor() {
    this.initialized = !1, this.setInitialized = (t) => {
      this.storage = t, this.initialized = !0;
    };
    const e = new ri();
    this.storage = e;
    try {
      const t = new ti();
      Lc(e, t, this.setInitialized);
    } catch {
      this.initialized = !0;
    }
  }
  async getKeys() {
    return await this.initialize(), this.storage.getKeys();
  }
  async getEntries() {
    return await this.initialize(), this.storage.getEntries();
  }
  async getItem(e) {
    return await this.initialize(), this.storage.getItem(e);
  }
  async setItem(e, t) {
    return await this.initialize(), this.storage.setItem(e, t);
  }
  async removeItem(e) {
    return await this.initialize(), this.storage.removeItem(e);
  }
  async initialize() {
    this.initialized || await new Promise((e) => {
      const t = setInterval(() => {
        this.initialized && (clearInterval(t), e());
      }, 20);
    });
  }
}, o(qt, "h"), qt);
var Mt = {}, jt = {}, kr = {}, Kt = {}, Yt;
let At = (Yt = class {
}, o(Yt, "IEvents"), Yt);
const Fc = /* @__PURE__ */ Object.freeze(/* @__PURE__ */ Object.defineProperty({
  __proto__: null,
  IEvents: At
}, Symbol.toStringTag, { value: "Module" })), Cc = /* @__PURE__ */ wa(Fc);
var Fs;
function Nc() {
  if (Fs)
    return Kt;
  Fs = 1, Object.defineProperty(Kt, "__esModule", { value: !0 }), Kt.IHeartBeat = void 0;
  const r = Cc, t = class t extends r.IEvents {
    constructor(n) {
      super();
    }
  };
  o(t, "IHeartBeat");
  let e = t;
  return Kt.IHeartBeat = e, Kt;
}
o(Nc, "requireHeartbeat$2");
var Cs;
function On() {
  return Cs || (Cs = 1, function(r) {
    Object.defineProperty(r, "__esModule", { value: !0 }), Dt.__exportStar(Nc(), r);
  }(kr)), kr;
}
o(On, "requireTypes");
var Gr = {}, Ot = {}, Ns;
function Dc() {
  if (Ns)
    return Ot;
  Ns = 1, Object.defineProperty(Ot, "__esModule", { value: !0 }), Ot.HEARTBEAT_EVENTS = Ot.HEARTBEAT_INTERVAL = void 0;
  const r = V;
  return Ot.HEARTBEAT_INTERVAL = r.FIVE_SECONDS, Ot.HEARTBEAT_EVENTS = {
    pulse: "heartbeat_pulse"
  }, Ot;
}
o(Dc, "requireHeartbeat$1");
var Ds;
function Rn() {
  return Ds || (Ds = 1, function(r) {
    Object.defineProperty(r, "__esModule", { value: !0 }), Dt.__exportStar(Dc(), r);
  }(Gr)), Gr;
}
o(Rn, "requireConstants$1");
var Ms;
function Mc() {
  if (Ms)
    return jt;
  Ms = 1, Object.defineProperty(jt, "__esModule", { value: !0 }), jt.HeartBeat = void 0;
  const r = Dt, e = ft, t = V, i = On(), n = Rn(), h = class h extends i.IHeartBeat {
    constructor(p) {
      super(p), this.events = new e.EventEmitter(), this.interval = n.HEARTBEAT_INTERVAL, this.interval = (p == null ? void 0 : p.interval) || n.HEARTBEAT_INTERVAL;
    }
    static init(p) {
      return r.__awaiter(this, void 0, void 0, function* () {
        const u = new h(p);
        return yield u.init(), u;
      });
    }
    init() {
      return r.__awaiter(this, void 0, void 0, function* () {
        yield this.initialize();
      });
    }
    stop() {
      clearInterval(this.intervalRef);
    }
    on(p, u) {
      this.events.on(p, u);
    }
    once(p, u) {
      this.events.once(p, u);
    }
    off(p, u) {
      this.events.off(p, u);
    }
    removeListener(p, u) {
      this.events.removeListener(p, u);
    }
    initialize() {
      return r.__awaiter(this, void 0, void 0, function* () {
        this.intervalRef = setInterval(() => this.pulse(), t.toMiliseconds(this.interval));
      });
    }
    pulse() {
      this.events.emit(n.HEARTBEAT_EVENTS.pulse);
    }
  };
  o(h, "HeartBeat");
  let c = h;
  return jt.HeartBeat = c, jt;
}
o(Mc, "requireHeartbeat");
(function(r) {
  Object.defineProperty(r, "__esModule", { value: !0 });
  const e = Dt;
  e.__exportStar(Mc(), r), e.__exportStar(On(), r), e.__exportStar(Rn(), r);
})(Mt);
var W = {}, Vr, zs;
function zc() {
  if (zs)
    return Vr;
  zs = 1;
  function r(t) {
    try {
      return JSON.stringify(t);
    } catch {
      return '"[Circular]"';
    }
  }
  o(r, "tryStringify"), Vr = e;
  function e(t, i, n) {
    var c = n && n.stringify || r, h = 1;
    if (typeof t == "object" && t !== null) {
      var d = i.length + h;
      if (d === 1)
        return t;
      var p = new Array(d);
      p[0] = c(t);
      for (var u = 1; u < d; u++)
        p[u] = c(i[u]);
      return p.join(" ");
    }
    if (typeof t != "string")
      return t;
    var y = i.length;
    if (y === 0)
      return t;
    for (var E = "", S = 1 - h, R = -1, I = t && t.length || 0, L = 0; L < I; ) {
      if (t.charCodeAt(L) === 37 && L + 1 < I) {
        switch (R = R > -1 ? R : 0, t.charCodeAt(L + 1)) {
          case 100:
          case 102:
            if (S >= y || i[S] == null)
              break;
            R < L && (E += t.slice(R, L)), E += Number(i[S]), R = L + 2, L++;
            break;
          case 105:
            if (S >= y || i[S] == null)
              break;
            R < L && (E += t.slice(R, L)), E += Math.floor(Number(i[S])), R = L + 2, L++;
            break;
          case 79:
          case 111:
          case 106:
            if (S >= y || i[S] === void 0)
              break;
            R < L && (E += t.slice(R, L));
            var j = typeof i[S];
            if (j === "string") {
              E += "'" + i[S] + "'", R = L + 2, L++;
              break;
            }
            if (j === "function") {
              E += i[S].name || "<anonymous>", R = L + 2, L++;
              break;
            }
            E += c(i[S]), R = L + 2, L++;
            break;
          case 115:
            if (S >= y)
              break;
            R < L && (E += t.slice(R, L)), E += String(i[S]), R = L + 2, L++;
            break;
          case 37:
            R < L && (E += t.slice(R, L)), E += "%", R = L + 2, L++, S--;
            break;
        }
        ++S;
      }
      ++L;
    }
    return R === -1 ? t : (R < I && (E += t.slice(R)), E);
  }
  return o(e, "format"), Vr;
}
o(zc, "requireQuickFormatUnescaped");
var qr, Us;
function Uc() {
  if (Us)
    return qr;
  Us = 1;
  const r = zc();
  qr = n;
  const e = q().console || {}, t = {
    mapHttpRequest: I,
    mapHttpResponse: I,
    wrapRequestSerializer: L,
    wrapResponseSerializer: L,
    wrapErrorSerializer: L,
    req: I,
    res: I,
    err: S
  };
  function i(w, T) {
    return Array.isArray(w) ? w.filter(function(K) {
      return K !== "!stdSerializers.err";
    }) : w === !0 ? Object.keys(T) : !1;
  }
  o(i, "shouldSerialize");
  function n(w) {
    w = w || {}, w.browser = w.browser || {};
    const T = w.browser.transmit;
    if (T && typeof T.send != "function")
      throw Error("pino: transmit option must have a send function");
    const P = w.browser.write || e;
    w.browser.write && (w.browser.asObject = !0);
    const K = w.serializers || {}, M = i(w.browser.serialize, K);
    let B = w.browser.serialize;
    Array.isArray(w.browser.serialize) && w.browser.serialize.indexOf("!stdSerializers.err") > -1 && (B = !1);
    const G = ["error", "fatal", "warn", "info", "debug", "trace"];
    typeof P == "function" && (P.error = P.fatal = P.warn = P.info = P.debug = P.trace = P), w.enabled === !1 && (w.level = "silent");
    const fe = w.level || "info", m = Object.create(P);
    m.log || (m.log = j), Object.defineProperty(m, "levelVal", {
      get: ee
    }), Object.defineProperty(m, "level", {
      get: ce,
      set: N
    });
    const _ = {
      transmit: T,
      serialize: M,
      asObject: w.browser.asObject,
      levels: G,
      timestamp: R(w)
    };
    m.levels = n.levels, m.level = fe, m.setMaxListeners = m.getMaxListeners = m.emit = m.addListener = m.on = m.prependListener = m.once = m.prependOnceListener = m.removeListener = m.removeAllListeners = m.listeners = m.listenerCount = m.eventNames = m.write = m.flush = j, m.serializers = K, m._serialize = M, m._stdErrSerialize = B, m.child = A, T && (m._logEvent = E());
    function ee() {
      return this.level === "silent" ? 1 / 0 : this.levels.values[this.level];
    }
    o(ee, "getLevelVal");
    function ce() {
      return this._level;
    }
    o(ce, "getLevel");
    function N(O) {
      if (O !== "silent" && !this.levels.values[O])
        throw Error("unknown level " + O);
      this._level = O, c(_, m, "error", "log"), c(_, m, "fatal", "error"), c(_, m, "warn", "error"), c(_, m, "info", "log"), c(_, m, "debug", "log"), c(_, m, "trace", "log");
    }
    o(N, "setLevel");
    function A(O, C) {
      if (!O)
        throw new Error("missing bindings for child Pino");
      C = C || {}, M && O.serializers && (C.serializers = O.serializers);
      const be = C.serializers;
      if (M && be) {
        var se = Object.assign({}, K, be), bt = w.browser.serialize === !0 ? Object.keys(se) : M;
        delete O.serializers, p([O], bt, se, this._stdErrSerialize);
      }
      function k(Ve) {
        this._childLevel = (Ve._childLevel | 0) + 1, this.error = u(Ve, O, "error"), this.fatal = u(Ve, O, "fatal"), this.warn = u(Ve, O, "warn"), this.info = u(Ve, O, "info"), this.debug = u(Ve, O, "debug"), this.trace = u(Ve, O, "trace"), se && (this.serializers = se, this._serialize = bt), T && (this._logEvent = E(
          [].concat(Ve._logEvent.bindings, O)
        ));
      }
      return o(k, "Child"), k.prototype = this, new k(this);
    }
    return o(A, "child"), m;
  }
  o(n, "pino"), n.levels = {
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
  }, n.stdSerializers = t, n.stdTimeFunctions = Object.assign({}, { nullTime: H, epochTime: $, unixTime: Z, isoTime: ae });
  function c(w, T, P, K) {
    const M = Object.getPrototypeOf(T);
    T[P] = T.levelVal > T.levels.values[P] ? j : M[P] ? M[P] : e[P] || e[K] || j, h(w, T, P);
  }
  o(c, "set");
  function h(w, T, P) {
    !w.transmit && T[P] === j || (T[P] = function(K) {
      return /* @__PURE__ */ o(function() {
        const B = w.timestamp(), G = new Array(arguments.length), fe = Object.getPrototypeOf && Object.getPrototypeOf(this) === e ? e : this;
        for (var m = 0; m < G.length; m++)
          G[m] = arguments[m];
        if (w.serialize && !w.asObject && p(G, this._serialize, this.serializers, this._stdErrSerialize), w.asObject ? K.call(fe, d(this, P, G, B)) : K.apply(fe, G), w.transmit) {
          const _ = w.transmit.level || T.level, ee = n.levels.values[_], ce = n.levels.values[P];
          if (ce < ee)
            return;
          y(this, {
            ts: B,
            methodLevel: P,
            methodValue: ce,
            transmitLevel: _,
            transmitValue: n.levels.values[w.transmit.level || T.level],
            send: w.transmit.send,
            val: T.levelVal
          }, G);
        }
      }, "LOG");
    }(T[P]));
  }
  o(h, "wrap");
  function d(w, T, P, K) {
    w._serialize && p(P, w._serialize, w.serializers, w._stdErrSerialize);
    const M = P.slice();
    let B = M[0];
    const G = {};
    K && (G.time = K), G.level = n.levels.values[T];
    let fe = (w._childLevel | 0) + 1;
    if (fe < 1 && (fe = 1), B !== null && typeof B == "object") {
      for (; fe-- && typeof M[0] == "object"; )
        Object.assign(G, M.shift());
      B = M.length ? r(M.shift(), M) : void 0;
    } else
      typeof B == "string" && (B = r(M.shift(), M));
    return B !== void 0 && (G.msg = B), G;
  }
  o(d, "asObject");
  function p(w, T, P, K) {
    for (const M in w)
      if (K && w[M] instanceof Error)
        w[M] = n.stdSerializers.err(w[M]);
      else if (typeof w[M] == "object" && !Array.isArray(w[M]))
        for (const B in w[M])
          T && T.indexOf(B) > -1 && B in P && (w[M][B] = P[B](w[M][B]));
  }
  o(p, "applySerializers");
  function u(w, T, P) {
    return function() {
      const K = new Array(1 + arguments.length);
      K[0] = T;
      for (var M = 1; M < K.length; M++)
        K[M] = arguments[M - 1];
      return w[P].apply(this, K);
    };
  }
  o(u, "bind");
  function y(w, T, P) {
    const K = T.send, M = T.ts, B = T.methodLevel, G = T.methodValue, fe = T.val, m = w._logEvent.bindings;
    p(
      P,
      w._serialize || Object.keys(w.serializers),
      w.serializers,
      w._stdErrSerialize === void 0 ? !0 : w._stdErrSerialize
    ), w._logEvent.ts = M, w._logEvent.messages = P.filter(function(_) {
      return m.indexOf(_) === -1;
    }), w._logEvent.level.label = B, w._logEvent.level.value = G, K(B, w._logEvent, fe), w._logEvent = E(m);
  }
  o(y, "transmit");
  function E(w) {
    return {
      ts: 0,
      messages: [],
      bindings: w || [],
      level: { label: "", value: 0 }
    };
  }
  o(E, "createLogEventShape");
  function S(w) {
    const T = {
      type: w.constructor.name,
      msg: w.message,
      stack: w.stack
    };
    for (const P in w)
      T[P] === void 0 && (T[P] = w[P]);
    return T;
  }
  o(S, "asErrValue");
  function R(w) {
    return typeof w.timestamp == "function" ? w.timestamp : w.timestamp === !1 ? H : $;
  }
  o(R, "getTimeFunction");
  function I() {
    return {};
  }
  o(I, "mock");
  function L(w) {
    return w;
  }
  o(L, "passthrough");
  function j() {
  }
  o(j, "noop");
  function H() {
    return !1;
  }
  o(H, "nullTime");
  function $() {
    return Date.now();
  }
  o($, "epochTime");
  function Z() {
    return Math.round(Date.now() / 1e3);
  }
  o(Z, "unixTime");
  function ae() {
    return new Date(Date.now()).toISOString();
  }
  o(ae, "isoTime");
  function q() {
    function w(T) {
      return typeof T < "u" && T;
    }
    o(w, "defd");
    try {
      return typeof globalThis < "u" || Object.defineProperty(Object.prototype, "globalThis", {
        get: function() {
          return delete Object.prototype.globalThis, this.globalThis = this;
        },
        configurable: !0
      }), globalThis;
    } catch {
      return w(self) || w(window) || w(this) || {};
    }
  }
  return o(q, "pfGlobalThisOrFallback"), qr;
}
o(Uc, "requireBrowser");
var Rt = {}, $s;
function Ln() {
  return $s || ($s = 1, Object.defineProperty(Rt, "__esModule", { value: !0 }), Rt.PINO_CUSTOM_CONTEXT_KEY = Rt.PINO_LOGGER_DEFAULTS = void 0, Rt.PINO_LOGGER_DEFAULTS = {
    level: "info"
  }, Rt.PINO_CUSTOM_CONTEXT_KEY = "custom_context"), Rt;
}
o(Ln, "requireConstants");
var Ye = {}, js;
function $c() {
  if (js)
    return Ye;
  js = 1, Object.defineProperty(Ye, "__esModule", { value: !0 }), Ye.generateChildLogger = Ye.formatChildLoggerContext = Ye.getLoggerContext = Ye.setBrowserLoggerContext = Ye.getBrowserLoggerContext = Ye.getDefaultLoggerOptions = void 0;
  const r = Ln();
  function e(d) {
    return Object.assign(Object.assign({}, d), { level: (d == null ? void 0 : d.level) || r.PINO_LOGGER_DEFAULTS.level });
  }
  o(e, "getDefaultLoggerOptions"), Ye.getDefaultLoggerOptions = e;
  function t(d, p = r.PINO_CUSTOM_CONTEXT_KEY) {
    return d[p] || "";
  }
  o(t, "getBrowserLoggerContext"), Ye.getBrowserLoggerContext = t;
  function i(d, p, u = r.PINO_CUSTOM_CONTEXT_KEY) {
    return d[u] = p, d;
  }
  o(i, "setBrowserLoggerContext"), Ye.setBrowserLoggerContext = i;
  function n(d, p = r.PINO_CUSTOM_CONTEXT_KEY) {
    let u = "";
    return typeof d.bindings > "u" ? u = t(d, p) : u = d.bindings().context || "", u;
  }
  o(n, "getLoggerContext"), Ye.getLoggerContext = n;
  function c(d, p, u = r.PINO_CUSTOM_CONTEXT_KEY) {
    const y = n(d, u);
    return y.trim() ? `${y}/${p}` : p;
  }
  o(c, "formatChildLoggerContext"), Ye.formatChildLoggerContext = c;
  function h(d, p, u = r.PINO_CUSTOM_CONTEXT_KEY) {
    const y = c(d, p, u), E = d.child({ context: y });
    return i(E, y, u);
  }
  return o(h, "generateChildLogger"), Ye.generateChildLogger = h, Ye;
}
o($c, "requireUtils");
(function(r) {
  Object.defineProperty(r, "__esModule", { value: !0 }), r.pino = void 0;
  const e = Dt, t = e.__importDefault(Uc());
  Object.defineProperty(r, "pino", { enumerable: !0, get: function() {
    return t.default;
  } }), e.__exportStar(Ln(), r), e.__exportStar($c(), r);
})(W);
const Mi = class Mi extends At {
  constructor(e) {
    super(), this.opts = e, this.protocol = "wc", this.version = 2;
  }
};
o(Mi, "n");
let ii = Mi;
var Wt;
let jc = (Wt = class extends At {
  constructor(e, t) {
    super(), this.core = e, this.logger = t, this.records = /* @__PURE__ */ new Map();
  }
}, o(Wt, "h"), Wt);
var Jt;
let Kc = (Jt = class {
  constructor(e, t) {
    this.logger = e, this.core = t;
  }
}, o(Jt, "a"), Jt);
const zi = class zi extends At {
  constructor(e, t) {
    super(), this.relayer = e, this.logger = t;
  }
};
o(zi, "u");
let si = zi;
var Xt;
let Bc = (Xt = class extends At {
  constructor(e) {
    super();
  }
}, o(Xt, "g"), Xt);
const Ui = class Ui {
  constructor(e, t, i, n) {
    this.core = e, this.logger = t, this.name = i;
  }
};
o(Ui, "p");
let ni = Ui;
const $i = class $i extends At {
  constructor(e, t) {
    super(), this.relayer = e, this.logger = t;
  }
};
o($i, "d");
let oi = $i;
const ji = class ji extends At {
  constructor(e, t) {
    super(), this.core = e, this.logger = t;
  }
};
o(ji, "E");
let ai = ji;
const Ki = class Ki {
  constructor(e, t) {
    this.projectId = e, this.logger = t;
  }
};
o(Ki, "y");
let ci = Ki;
var Qt;
let hl = (Qt = class {
  constructor(e) {
    this.opts = e, this.protocol = "wc", this.version = 2;
  }
}, o(Qt, "b"), Qt);
var Zt;
let ul = (Zt = class {
  constructor(e) {
    this.client = e;
  }
}, o(Zt, "S"), Zt);
var Ri = {}, An = {};
(function(r) {
  Object.defineProperty(r, "__esModule", { value: !0 });
  var e = Ea, t = dn;
  r.DIGEST_LENGTH = 64, r.BLOCK_SIZE = 128;
  var i = (
    /** @class */
    function() {
      function d() {
        this.digestLength = r.DIGEST_LENGTH, this.blockSize = r.BLOCK_SIZE, this._stateHi = new Int32Array(8), this._stateLo = new Int32Array(8), this._tempHi = new Int32Array(16), this._tempLo = new Int32Array(16), this._buffer = new Uint8Array(256), this._bufferLength = 0, this._bytesHashed = 0, this._finished = !1, this.reset();
      }
      return o(d, "SHA512"), d.prototype._initState = function() {
        this._stateHi[0] = 1779033703, this._stateHi[1] = 3144134277, this._stateHi[2] = 1013904242, this._stateHi[3] = 2773480762, this._stateHi[4] = 1359893119, this._stateHi[5] = 2600822924, this._stateHi[6] = 528734635, this._stateHi[7] = 1541459225, this._stateLo[0] = 4089235720, this._stateLo[1] = 2227873595, this._stateLo[2] = 4271175723, this._stateLo[3] = 1595750129, this._stateLo[4] = 2917565137, this._stateLo[5] = 725511199, this._stateLo[6] = 4215389547, this._stateLo[7] = 327033209;
      }, d.prototype.reset = function() {
        return this._initState(), this._bufferLength = 0, this._bytesHashed = 0, this._finished = !1, this;
      }, d.prototype.clean = function() {
        t.wipe(this._buffer), t.wipe(this._tempHi), t.wipe(this._tempLo), this.reset();
      }, d.prototype.update = function(p, u) {
        if (u === void 0 && (u = p.length), this._finished)
          throw new Error("SHA512: can't update because hash was finished.");
        var y = 0;
        if (this._bytesHashed += u, this._bufferLength > 0) {
          for (; this._bufferLength < r.BLOCK_SIZE && u > 0; )
            this._buffer[this._bufferLength++] = p[y++], u--;
          this._bufferLength === this.blockSize && (c(this._tempHi, this._tempLo, this._stateHi, this._stateLo, this._buffer, 0, this.blockSize), this._bufferLength = 0);
        }
        for (u >= this.blockSize && (y = c(this._tempHi, this._tempLo, this._stateHi, this._stateLo, p, y, u), u %= this.blockSize); u > 0; )
          this._buffer[this._bufferLength++] = p[y++], u--;
        return this;
      }, d.prototype.finish = function(p) {
        if (!this._finished) {
          var u = this._bytesHashed, y = this._bufferLength, E = u / 536870912 | 0, S = u << 3, R = u % 128 < 112 ? 128 : 256;
          this._buffer[y] = 128;
          for (var I = y + 1; I < R - 8; I++)
            this._buffer[I] = 0;
          e.writeUint32BE(E, this._buffer, R - 8), e.writeUint32BE(S, this._buffer, R - 4), c(this._tempHi, this._tempLo, this._stateHi, this._stateLo, this._buffer, 0, R), this._finished = !0;
        }
        for (var I = 0; I < this.digestLength / 8; I++)
          e.writeUint32BE(this._stateHi[I], p, I * 8), e.writeUint32BE(this._stateLo[I], p, I * 8 + 4);
        return this;
      }, d.prototype.digest = function() {
        var p = new Uint8Array(this.digestLength);
        return this.finish(p), p;
      }, d.prototype.saveState = function() {
        if (this._finished)
          throw new Error("SHA256: cannot save finished state");
        return {
          stateHi: new Int32Array(this._stateHi),
          stateLo: new Int32Array(this._stateLo),
          buffer: this._bufferLength > 0 ? new Uint8Array(this._buffer) : void 0,
          bufferLength: this._bufferLength,
          bytesHashed: this._bytesHashed
        };
      }, d.prototype.restoreState = function(p) {
        return this._stateHi.set(p.stateHi), this._stateLo.set(p.stateLo), this._bufferLength = p.bufferLength, p.buffer && this._buffer.set(p.buffer), this._bytesHashed = p.bytesHashed, this._finished = !1, this;
      }, d.prototype.cleanSavedState = function(p) {
        t.wipe(p.stateHi), t.wipe(p.stateLo), p.buffer && t.wipe(p.buffer), p.bufferLength = 0, p.bytesHashed = 0;
      }, d;
    }()
  );
  r.SHA512 = i;
  var n = new Int32Array([
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
  function c(d, p, u, y, E, S, R) {
    for (var I = u[0], L = u[1], j = u[2], H = u[3], $ = u[4], Z = u[5], ae = u[6], q = u[7], w = y[0], T = y[1], P = y[2], K = y[3], M = y[4], B = y[5], G = y[6], fe = y[7], m, _, ee, ce, N, A, O, C; R >= 128; ) {
      for (var be = 0; be < 16; be++) {
        var se = 8 * be + S;
        d[be] = e.readUint32BE(E, se), p[be] = e.readUint32BE(E, se + 4);
      }
      for (var be = 0; be < 80; be++) {
        var bt = I, k = L, Ve = j, v = H, b = $, g = Z, s = ae, l = q, D = w, z = T, J = P, te = K, Y = M, re = B, je = G, Te = fe;
        if (m = q, _ = fe, N = _ & 65535, A = _ >>> 16, O = m & 65535, C = m >>> 16, m = ($ >>> 14 | M << 32 - 14) ^ ($ >>> 18 | M << 32 - 18) ^ (M >>> 41 - 32 | $ << 32 - (41 - 32)), _ = (M >>> 14 | $ << 32 - 14) ^ (M >>> 18 | $ << 32 - 18) ^ ($ >>> 41 - 32 | M << 32 - (41 - 32)), N += _ & 65535, A += _ >>> 16, O += m & 65535, C += m >>> 16, m = $ & Z ^ ~$ & ae, _ = M & B ^ ~M & G, N += _ & 65535, A += _ >>> 16, O += m & 65535, C += m >>> 16, m = n[be * 2], _ = n[be * 2 + 1], N += _ & 65535, A += _ >>> 16, O += m & 65535, C += m >>> 16, m = d[be % 16], _ = p[be % 16], N += _ & 65535, A += _ >>> 16, O += m & 65535, C += m >>> 16, A += N >>> 16, O += A >>> 16, C += O >>> 16, ee = O & 65535 | C << 16, ce = N & 65535 | A << 16, m = ee, _ = ce, N = _ & 65535, A = _ >>> 16, O = m & 65535, C = m >>> 16, m = (I >>> 28 | w << 32 - 28) ^ (w >>> 34 - 32 | I << 32 - (34 - 32)) ^ (w >>> 39 - 32 | I << 32 - (39 - 32)), _ = (w >>> 28 | I << 32 - 28) ^ (I >>> 34 - 32 | w << 32 - (34 - 32)) ^ (I >>> 39 - 32 | w << 32 - (39 - 32)), N += _ & 65535, A += _ >>> 16, O += m & 65535, C += m >>> 16, m = I & L ^ I & j ^ L & j, _ = w & T ^ w & P ^ T & P, N += _ & 65535, A += _ >>> 16, O += m & 65535, C += m >>> 16, A += N >>> 16, O += A >>> 16, C += O >>> 16, l = O & 65535 | C << 16, Te = N & 65535 | A << 16, m = v, _ = te, N = _ & 65535, A = _ >>> 16, O = m & 65535, C = m >>> 16, m = ee, _ = ce, N += _ & 65535, A += _ >>> 16, O += m & 65535, C += m >>> 16, A += N >>> 16, O += A >>> 16, C += O >>> 16, v = O & 65535 | C << 16, te = N & 65535 | A << 16, L = bt, j = k, H = Ve, $ = v, Z = b, ae = g, q = s, I = l, T = D, P = z, K = J, M = te, B = Y, G = re, fe = je, w = Te, be % 16 === 15)
          for (var se = 0; se < 16; se++)
            m = d[se], _ = p[se], N = _ & 65535, A = _ >>> 16, O = m & 65535, C = m >>> 16, m = d[(se + 9) % 16], _ = p[(se + 9) % 16], N += _ & 65535, A += _ >>> 16, O += m & 65535, C += m >>> 16, ee = d[(se + 1) % 16], ce = p[(se + 1) % 16], m = (ee >>> 1 | ce << 32 - 1) ^ (ee >>> 8 | ce << 32 - 8) ^ ee >>> 7, _ = (ce >>> 1 | ee << 32 - 1) ^ (ce >>> 8 | ee << 32 - 8) ^ (ce >>> 7 | ee << 32 - 7), N += _ & 65535, A += _ >>> 16, O += m & 65535, C += m >>> 16, ee = d[(se + 14) % 16], ce = p[(se + 14) % 16], m = (ee >>> 19 | ce << 32 - 19) ^ (ce >>> 61 - 32 | ee << 32 - (61 - 32)) ^ ee >>> 6, _ = (ce >>> 19 | ee << 32 - 19) ^ (ee >>> 61 - 32 | ce << 32 - (61 - 32)) ^ (ce >>> 6 | ee << 32 - 6), N += _ & 65535, A += _ >>> 16, O += m & 65535, C += m >>> 16, A += N >>> 16, O += A >>> 16, C += O >>> 16, d[se] = O & 65535 | C << 16, p[se] = N & 65535 | A << 16;
      }
      m = I, _ = w, N = _ & 65535, A = _ >>> 16, O = m & 65535, C = m >>> 16, m = u[0], _ = y[0], N += _ & 65535, A += _ >>> 16, O += m & 65535, C += m >>> 16, A += N >>> 16, O += A >>> 16, C += O >>> 16, u[0] = I = O & 65535 | C << 16, y[0] = w = N & 65535 | A << 16, m = L, _ = T, N = _ & 65535, A = _ >>> 16, O = m & 65535, C = m >>> 16, m = u[1], _ = y[1], N += _ & 65535, A += _ >>> 16, O += m & 65535, C += m >>> 16, A += N >>> 16, O += A >>> 16, C += O >>> 16, u[1] = L = O & 65535 | C << 16, y[1] = T = N & 65535 | A << 16, m = j, _ = P, N = _ & 65535, A = _ >>> 16, O = m & 65535, C = m >>> 16, m = u[2], _ = y[2], N += _ & 65535, A += _ >>> 16, O += m & 65535, C += m >>> 16, A += N >>> 16, O += A >>> 16, C += O >>> 16, u[2] = j = O & 65535 | C << 16, y[2] = P = N & 65535 | A << 16, m = H, _ = K, N = _ & 65535, A = _ >>> 16, O = m & 65535, C = m >>> 16, m = u[3], _ = y[3], N += _ & 65535, A += _ >>> 16, O += m & 65535, C += m >>> 16, A += N >>> 16, O += A >>> 16, C += O >>> 16, u[3] = H = O & 65535 | C << 16, y[3] = K = N & 65535 | A << 16, m = $, _ = M, N = _ & 65535, A = _ >>> 16, O = m & 65535, C = m >>> 16, m = u[4], _ = y[4], N += _ & 65535, A += _ >>> 16, O += m & 65535, C += m >>> 16, A += N >>> 16, O += A >>> 16, C += O >>> 16, u[4] = $ = O & 65535 | C << 16, y[4] = M = N & 65535 | A << 16, m = Z, _ = B, N = _ & 65535, A = _ >>> 16, O = m & 65535, C = m >>> 16, m = u[5], _ = y[5], N += _ & 65535, A += _ >>> 16, O += m & 65535, C += m >>> 16, A += N >>> 16, O += A >>> 16, C += O >>> 16, u[5] = Z = O & 65535 | C << 16, y[5] = B = N & 65535 | A << 16, m = ae, _ = G, N = _ & 65535, A = _ >>> 16, O = m & 65535, C = m >>> 16, m = u[6], _ = y[6], N += _ & 65535, A += _ >>> 16, O += m & 65535, C += m >>> 16, A += N >>> 16, O += A >>> 16, C += O >>> 16, u[6] = ae = O & 65535 | C << 16, y[6] = G = N & 65535 | A << 16, m = q, _ = fe, N = _ & 65535, A = _ >>> 16, O = m & 65535, C = m >>> 16, m = u[7], _ = y[7], N += _ & 65535, A += _ >>> 16, O += m & 65535, C += m >>> 16, A += N >>> 16, O += A >>> 16, C += O >>> 16, u[7] = q = O & 65535 | C << 16, y[7] = fe = N & 65535 | A << 16, S += 128, R -= 128;
    }
    return S;
  }
  o(c, "hashBlocks");
  function h(d) {
    var p = new i();
    p.update(d);
    var u = p.digest();
    return p.clean(), u;
  }
  o(h, "hash"), r.hash = h;
})(An);
(function(r) {
  Object.defineProperty(r, "__esModule", { value: !0 }), r.convertSecretKeyToX25519 = r.convertPublicKeyToX25519 = r.verify = r.sign = r.extractPublicKeyFromSecretKey = r.generateKeyPair = r.generateKeyPairFromSeed = r.SEED_LENGTH = r.SECRET_KEY_LENGTH = r.PUBLIC_KEY_LENGTH = r.SIGNATURE_LENGTH = void 0;
  const e = gn, t = An, i = dn;
  r.SIGNATURE_LENGTH = 64, r.PUBLIC_KEY_LENGTH = 32, r.SECRET_KEY_LENGTH = 64, r.SEED_LENGTH = 32;
  function n(v) {
    const b = new Float64Array(16);
    if (v)
      for (let g = 0; g < v.length; g++)
        b[g] = v[g];
    return b;
  }
  o(n, "gf");
  const c = new Uint8Array(32);
  c[0] = 9;
  const h = n(), d = n([1]), p = n([
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
  ]), u = n([
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
  ]), y = n([
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
  ]), E = n([
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
  ]), S = n([
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
  function R(v, b) {
    for (let g = 0; g < 16; g++)
      v[g] = b[g] | 0;
  }
  o(R, "set25519");
  function I(v) {
    let b = 1;
    for (let g = 0; g < 16; g++) {
      let s = v[g] + b + 65535;
      b = Math.floor(s / 65536), v[g] = s - b * 65536;
    }
    v[0] += b - 1 + 37 * (b - 1);
  }
  o(I, "car25519");
  function L(v, b, g) {
    const s = ~(g - 1);
    for (let l = 0; l < 16; l++) {
      const D = s & (v[l] ^ b[l]);
      v[l] ^= D, b[l] ^= D;
    }
  }
  o(L, "sel25519");
  function j(v, b) {
    const g = n(), s = n();
    for (let l = 0; l < 16; l++)
      s[l] = b[l];
    I(s), I(s), I(s);
    for (let l = 0; l < 2; l++) {
      g[0] = s[0] - 65517;
      for (let z = 1; z < 15; z++)
        g[z] = s[z] - 65535 - (g[z - 1] >> 16 & 1), g[z - 1] &= 65535;
      g[15] = s[15] - 32767 - (g[14] >> 16 & 1);
      const D = g[15] >> 16 & 1;
      g[14] &= 65535, L(s, g, 1 - D);
    }
    for (let l = 0; l < 16; l++)
      v[2 * l] = s[l] & 255, v[2 * l + 1] = s[l] >> 8;
  }
  o(j, "pack25519");
  function H(v, b) {
    let g = 0;
    for (let s = 0; s < 32; s++)
      g |= v[s] ^ b[s];
    return (1 & g - 1 >>> 8) - 1;
  }
  o(H, "verify32");
  function $(v, b) {
    const g = new Uint8Array(32), s = new Uint8Array(32);
    return j(g, v), j(s, b), H(g, s);
  }
  o($, "neq25519");
  function Z(v) {
    const b = new Uint8Array(32);
    return j(b, v), b[0] & 1;
  }
  o(Z, "par25519");
  function ae(v, b) {
    for (let g = 0; g < 16; g++)
      v[g] = b[2 * g] + (b[2 * g + 1] << 8);
    v[15] &= 32767;
  }
  o(ae, "unpack25519");
  function q(v, b, g) {
    for (let s = 0; s < 16; s++)
      v[s] = b[s] + g[s];
  }
  o(q, "add");
  function w(v, b, g) {
    for (let s = 0; s < 16; s++)
      v[s] = b[s] - g[s];
  }
  o(w, "sub");
  function T(v, b, g) {
    let s, l, D = 0, z = 0, J = 0, te = 0, Y = 0, re = 0, je = 0, Te = 0, Ke = 0, Le = 0, Oe = 0, ve = 0, me = 0, de = 0, ue = 0, ie = 0, we = 0, Ae = 0, ne = 0, ke = 0, qe = 0, Qe = 0, Ze = 0, Je = 0, ot = 0, ht = 0, vt = 0, et = 0, xt = 0, zt = 0, ir = 0, Ee = g[0], ge = g[1], _e = g[2], xe = g[3], Ie = g[4], pe = g[5], Pe = g[6], Fe = g[7], Ce = g[8], Ne = g[9], De = g[10], Re = g[11], Se = g[12], he = g[13], Me = g[14], ze = g[15];
    s = b[0], D += s * Ee, z += s * ge, J += s * _e, te += s * xe, Y += s * Ie, re += s * pe, je += s * Pe, Te += s * Fe, Ke += s * Ce, Le += s * Ne, Oe += s * De, ve += s * Re, me += s * Se, de += s * he, ue += s * Me, ie += s * ze, s = b[1], z += s * Ee, J += s * ge, te += s * _e, Y += s * xe, re += s * Ie, je += s * pe, Te += s * Pe, Ke += s * Fe, Le += s * Ce, Oe += s * Ne, ve += s * De, me += s * Re, de += s * Se, ue += s * he, ie += s * Me, we += s * ze, s = b[2], J += s * Ee, te += s * ge, Y += s * _e, re += s * xe, je += s * Ie, Te += s * pe, Ke += s * Pe, Le += s * Fe, Oe += s * Ce, ve += s * Ne, me += s * De, de += s * Re, ue += s * Se, ie += s * he, we += s * Me, Ae += s * ze, s = b[3], te += s * Ee, Y += s * ge, re += s * _e, je += s * xe, Te += s * Ie, Ke += s * pe, Le += s * Pe, Oe += s * Fe, ve += s * Ce, me += s * Ne, de += s * De, ue += s * Re, ie += s * Se, we += s * he, Ae += s * Me, ne += s * ze, s = b[4], Y += s * Ee, re += s * ge, je += s * _e, Te += s * xe, Ke += s * Ie, Le += s * pe, Oe += s * Pe, ve += s * Fe, me += s * Ce, de += s * Ne, ue += s * De, ie += s * Re, we += s * Se, Ae += s * he, ne += s * Me, ke += s * ze, s = b[5], re += s * Ee, je += s * ge, Te += s * _e, Ke += s * xe, Le += s * Ie, Oe += s * pe, ve += s * Pe, me += s * Fe, de += s * Ce, ue += s * Ne, ie += s * De, we += s * Re, Ae += s * Se, ne += s * he, ke += s * Me, qe += s * ze, s = b[6], je += s * Ee, Te += s * ge, Ke += s * _e, Le += s * xe, Oe += s * Ie, ve += s * pe, me += s * Pe, de += s * Fe, ue += s * Ce, ie += s * Ne, we += s * De, Ae += s * Re, ne += s * Se, ke += s * he, qe += s * Me, Qe += s * ze, s = b[7], Te += s * Ee, Ke += s * ge, Le += s * _e, Oe += s * xe, ve += s * Ie, me += s * pe, de += s * Pe, ue += s * Fe, ie += s * Ce, we += s * Ne, Ae += s * De, ne += s * Re, ke += s * Se, qe += s * he, Qe += s * Me, Ze += s * ze, s = b[8], Ke += s * Ee, Le += s * ge, Oe += s * _e, ve += s * xe, me += s * Ie, de += s * pe, ue += s * Pe, ie += s * Fe, we += s * Ce, Ae += s * Ne, ne += s * De, ke += s * Re, qe += s * Se, Qe += s * he, Ze += s * Me, Je += s * ze, s = b[9], Le += s * Ee, Oe += s * ge, ve += s * _e, me += s * xe, de += s * Ie, ue += s * pe, ie += s * Pe, we += s * Fe, Ae += s * Ce, ne += s * Ne, ke += s * De, qe += s * Re, Qe += s * Se, Ze += s * he, Je += s * Me, ot += s * ze, s = b[10], Oe += s * Ee, ve += s * ge, me += s * _e, de += s * xe, ue += s * Ie, ie += s * pe, we += s * Pe, Ae += s * Fe, ne += s * Ce, ke += s * Ne, qe += s * De, Qe += s * Re, Ze += s * Se, Je += s * he, ot += s * Me, ht += s * ze, s = b[11], ve += s * Ee, me += s * ge, de += s * _e, ue += s * xe, ie += s * Ie, we += s * pe, Ae += s * Pe, ne += s * Fe, ke += s * Ce, qe += s * Ne, Qe += s * De, Ze += s * Re, Je += s * Se, ot += s * he, ht += s * Me, vt += s * ze, s = b[12], me += s * Ee, de += s * ge, ue += s * _e, ie += s * xe, we += s * Ie, Ae += s * pe, ne += s * Pe, ke += s * Fe, qe += s * Ce, Qe += s * Ne, Ze += s * De, Je += s * Re, ot += s * Se, ht += s * he, vt += s * Me, et += s * ze, s = b[13], de += s * Ee, ue += s * ge, ie += s * _e, we += s * xe, Ae += s * Ie, ne += s * pe, ke += s * Pe, qe += s * Fe, Qe += s * Ce, Ze += s * Ne, Je += s * De, ot += s * Re, ht += s * Se, vt += s * he, et += s * Me, xt += s * ze, s = b[14], ue += s * Ee, ie += s * ge, we += s * _e, Ae += s * xe, ne += s * Ie, ke += s * pe, qe += s * Pe, Qe += s * Fe, Ze += s * Ce, Je += s * Ne, ot += s * De, ht += s * Re, vt += s * Se, et += s * he, xt += s * Me, zt += s * ze, s = b[15], ie += s * Ee, we += s * ge, Ae += s * _e, ne += s * xe, ke += s * Ie, qe += s * pe, Qe += s * Pe, Ze += s * Fe, Je += s * Ce, ot += s * Ne, ht += s * De, vt += s * Re, et += s * Se, xt += s * he, zt += s * Me, ir += s * ze, D += 38 * we, z += 38 * Ae, J += 38 * ne, te += 38 * ke, Y += 38 * qe, re += 38 * Qe, je += 38 * Ze, Te += 38 * Je, Ke += 38 * ot, Le += 38 * ht, Oe += 38 * vt, ve += 38 * et, me += 38 * xt, de += 38 * zt, ue += 38 * ir, l = 1, s = D + l + 65535, l = Math.floor(s / 65536), D = s - l * 65536, s = z + l + 65535, l = Math.floor(s / 65536), z = s - l * 65536, s = J + l + 65535, l = Math.floor(s / 65536), J = s - l * 65536, s = te + l + 65535, l = Math.floor(s / 65536), te = s - l * 65536, s = Y + l + 65535, l = Math.floor(s / 65536), Y = s - l * 65536, s = re + l + 65535, l = Math.floor(s / 65536), re = s - l * 65536, s = je + l + 65535, l = Math.floor(s / 65536), je = s - l * 65536, s = Te + l + 65535, l = Math.floor(s / 65536), Te = s - l * 65536, s = Ke + l + 65535, l = Math.floor(s / 65536), Ke = s - l * 65536, s = Le + l + 65535, l = Math.floor(s / 65536), Le = s - l * 65536, s = Oe + l + 65535, l = Math.floor(s / 65536), Oe = s - l * 65536, s = ve + l + 65535, l = Math.floor(s / 65536), ve = s - l * 65536, s = me + l + 65535, l = Math.floor(s / 65536), me = s - l * 65536, s = de + l + 65535, l = Math.floor(s / 65536), de = s - l * 65536, s = ue + l + 65535, l = Math.floor(s / 65536), ue = s - l * 65536, s = ie + l + 65535, l = Math.floor(s / 65536), ie = s - l * 65536, D += l - 1 + 37 * (l - 1), l = 1, s = D + l + 65535, l = Math.floor(s / 65536), D = s - l * 65536, s = z + l + 65535, l = Math.floor(s / 65536), z = s - l * 65536, s = J + l + 65535, l = Math.floor(s / 65536), J = s - l * 65536, s = te + l + 65535, l = Math.floor(s / 65536), te = s - l * 65536, s = Y + l + 65535, l = Math.floor(s / 65536), Y = s - l * 65536, s = re + l + 65535, l = Math.floor(s / 65536), re = s - l * 65536, s = je + l + 65535, l = Math.floor(s / 65536), je = s - l * 65536, s = Te + l + 65535, l = Math.floor(s / 65536), Te = s - l * 65536, s = Ke + l + 65535, l = Math.floor(s / 65536), Ke = s - l * 65536, s = Le + l + 65535, l = Math.floor(s / 65536), Le = s - l * 65536, s = Oe + l + 65535, l = Math.floor(s / 65536), Oe = s - l * 65536, s = ve + l + 65535, l = Math.floor(s / 65536), ve = s - l * 65536, s = me + l + 65535, l = Math.floor(s / 65536), me = s - l * 65536, s = de + l + 65535, l = Math.floor(s / 65536), de = s - l * 65536, s = ue + l + 65535, l = Math.floor(s / 65536), ue = s - l * 65536, s = ie + l + 65535, l = Math.floor(s / 65536), ie = s - l * 65536, D += l - 1 + 37 * (l - 1), v[0] = D, v[1] = z, v[2] = J, v[3] = te, v[4] = Y, v[5] = re, v[6] = je, v[7] = Te, v[8] = Ke, v[9] = Le, v[10] = Oe, v[11] = ve, v[12] = me, v[13] = de, v[14] = ue, v[15] = ie;
  }
  o(T, "mul");
  function P(v, b) {
    T(v, b, b);
  }
  o(P, "square");
  function K(v, b) {
    const g = n();
    let s;
    for (s = 0; s < 16; s++)
      g[s] = b[s];
    for (s = 253; s >= 0; s--)
      P(g, g), s !== 2 && s !== 4 && T(g, g, b);
    for (s = 0; s < 16; s++)
      v[s] = g[s];
  }
  o(K, "inv25519");
  function M(v, b) {
    const g = n();
    let s;
    for (s = 0; s < 16; s++)
      g[s] = b[s];
    for (s = 250; s >= 0; s--)
      P(g, g), s !== 1 && T(g, g, b);
    for (s = 0; s < 16; s++)
      v[s] = g[s];
  }
  o(M, "pow2523");
  function B(v, b) {
    const g = n(), s = n(), l = n(), D = n(), z = n(), J = n(), te = n(), Y = n(), re = n();
    w(g, v[1], v[0]), w(re, b[1], b[0]), T(g, g, re), q(s, v[0], v[1]), q(re, b[0], b[1]), T(s, s, re), T(l, v[3], b[3]), T(l, l, u), T(D, v[2], b[2]), q(D, D, D), w(z, s, g), w(J, D, l), q(te, D, l), q(Y, s, g), T(v[0], z, J), T(v[1], Y, te), T(v[2], te, J), T(v[3], z, Y);
  }
  o(B, "edadd");
  function G(v, b, g) {
    for (let s = 0; s < 4; s++)
      L(v[s], b[s], g);
  }
  o(G, "cswap");
  function fe(v, b) {
    const g = n(), s = n(), l = n();
    K(l, b[2]), T(g, b[0], l), T(s, b[1], l), j(v, s), v[31] ^= Z(g) << 7;
  }
  o(fe, "pack");
  function m(v, b, g) {
    R(v[0], h), R(v[1], d), R(v[2], d), R(v[3], h);
    for (let s = 255; s >= 0; --s) {
      const l = g[s / 8 | 0] >> (s & 7) & 1;
      G(v, b, l), B(b, v), B(v, v), G(v, b, l);
    }
  }
  o(m, "scalarmult");
  function _(v, b) {
    const g = [n(), n(), n(), n()];
    R(g[0], y), R(g[1], E), R(g[2], d), T(g[3], y, E), m(v, g, b);
  }
  o(_, "scalarbase");
  function ee(v) {
    if (v.length !== r.SEED_LENGTH)
      throw new Error(`ed25519: seed must be ${r.SEED_LENGTH} bytes`);
    const b = (0, t.hash)(v);
    b[0] &= 248, b[31] &= 127, b[31] |= 64;
    const g = new Uint8Array(32), s = [n(), n(), n(), n()];
    _(s, b), fe(g, s);
    const l = new Uint8Array(64);
    return l.set(v), l.set(g, 32), {
      publicKey: g,
      secretKey: l
    };
  }
  o(ee, "generateKeyPairFromSeed"), r.generateKeyPairFromSeed = ee;
  function ce(v) {
    const b = (0, e.randomBytes)(32, v), g = ee(b);
    return (0, i.wipe)(b), g;
  }
  o(ce, "generateKeyPair"), r.generateKeyPair = ce;
  function N(v) {
    if (v.length !== r.SECRET_KEY_LENGTH)
      throw new Error(`ed25519: secret key must be ${r.SECRET_KEY_LENGTH} bytes`);
    return new Uint8Array(v.subarray(32));
  }
  o(N, "extractPublicKeyFromSecretKey"), r.extractPublicKeyFromSecretKey = N;
  const A = new Float64Array([
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
  function O(v, b) {
    let g, s, l, D;
    for (s = 63; s >= 32; --s) {
      for (g = 0, l = s - 32, D = s - 12; l < D; ++l)
        b[l] += g - 16 * b[s] * A[l - (s - 32)], g = Math.floor((b[l] + 128) / 256), b[l] -= g * 256;
      b[l] += g, b[s] = 0;
    }
    for (g = 0, l = 0; l < 32; l++)
      b[l] += g - (b[31] >> 4) * A[l], g = b[l] >> 8, b[l] &= 255;
    for (l = 0; l < 32; l++)
      b[l] -= g * A[l];
    for (s = 0; s < 32; s++)
      b[s + 1] += b[s] >> 8, v[s] = b[s] & 255;
  }
  o(O, "modL");
  function C(v) {
    const b = new Float64Array(64);
    for (let g = 0; g < 64; g++)
      b[g] = v[g];
    for (let g = 0; g < 64; g++)
      v[g] = 0;
    O(v, b);
  }
  o(C, "reduce");
  function be(v, b) {
    const g = new Float64Array(64), s = [n(), n(), n(), n()], l = (0, t.hash)(v.subarray(0, 32));
    l[0] &= 248, l[31] &= 127, l[31] |= 64;
    const D = new Uint8Array(64);
    D.set(l.subarray(32), 32);
    const z = new t.SHA512();
    z.update(D.subarray(32)), z.update(b);
    const J = z.digest();
    z.clean(), C(J), _(s, J), fe(D, s), z.reset(), z.update(D.subarray(0, 32)), z.update(v.subarray(32)), z.update(b);
    const te = z.digest();
    C(te);
    for (let Y = 0; Y < 32; Y++)
      g[Y] = J[Y];
    for (let Y = 0; Y < 32; Y++)
      for (let re = 0; re < 32; re++)
        g[Y + re] += te[Y] * l[re];
    return O(D.subarray(32), g), D;
  }
  o(be, "sign"), r.sign = be;
  function se(v, b) {
    const g = n(), s = n(), l = n(), D = n(), z = n(), J = n(), te = n();
    return R(v[2], d), ae(v[1], b), P(l, v[1]), T(D, l, p), w(l, l, v[2]), q(D, v[2], D), P(z, D), P(J, z), T(te, J, z), T(g, te, l), T(g, g, D), M(g, g), T(g, g, l), T(g, g, D), T(g, g, D), T(v[0], g, D), P(s, v[0]), T(s, s, D), $(s, l) && T(v[0], v[0], S), P(s, v[0]), T(s, s, D), $(s, l) ? -1 : (Z(v[0]) === b[31] >> 7 && w(v[0], h, v[0]), T(v[3], v[0], v[1]), 0);
  }
  o(se, "unpackneg");
  function bt(v, b, g) {
    const s = new Uint8Array(32), l = [n(), n(), n(), n()], D = [n(), n(), n(), n()];
    if (g.length !== r.SIGNATURE_LENGTH)
      throw new Error(`ed25519: signature must be ${r.SIGNATURE_LENGTH} bytes`);
    if (se(D, v))
      return !1;
    const z = new t.SHA512();
    z.update(g.subarray(0, 32)), z.update(v), z.update(b);
    const J = z.digest();
    return C(J), m(l, D, J), _(D, g.subarray(32)), B(l, D), fe(s, l), !H(g, s);
  }
  o(bt, "verify"), r.verify = bt;
  function k(v) {
    let b = [n(), n(), n(), n()];
    if (se(b, v))
      throw new Error("Ed25519: invalid public key");
    let g = n(), s = n(), l = b[1];
    q(g, d, l), w(s, d, l), K(s, s), T(g, g, s);
    let D = new Uint8Array(32);
    return j(D, g), D;
  }
  o(k, "convertPublicKeyToX25519"), r.convertPublicKeyToX25519 = k;
  function Ve(v) {
    const b = (0, t.hash)(v.subarray(0, 32));
    b[0] &= 248, b[31] &= 127, b[31] |= 64;
    const g = new Uint8Array(b.subarray(0, 32));
    return (0, i.wipe)(b), g;
  }
  o(Ve, "convertSecretKeyToX25519"), r.convertSecretKeyToX25519 = Ve;
})(Ri);
const Hc = "EdDSA", kc = "JWT", Pn = ".", Fn = "base64url", Gc = "utf8", Vc = "utf8", qc = ":", Yc = "did", Wc = "key", Ks = "base58btc", Jc = "z", Xc = "K36", Qc = 32;
function br(r) {
  return Cr(Ti(tr(r), Gc), Fn);
}
o(br, "encodeJSON");
function Cn(r) {
  const e = Ti(Xc, Ks), t = Jc + Cr(_a([e, r]), Ks);
  return [Yc, Wc, t].join(qc);
}
o(Cn, "encodeIss");
function Zc(r) {
  return Cr(r, Fn);
}
o(Zc, "encodeSig");
function eh(r) {
  return Ti([br(r.header), br(r.payload)].join(Pn), Vc);
}
o(eh, "encodeData");
function th(r) {
  return [
    br(r.header),
    br(r.payload),
    Zc(r.signature)
  ].join(Pn);
}
o(th, "encodeJWT");
function Bs(r = gn.randomBytes(Qc)) {
  return Ri.generateKeyPairFromSeed(r);
}
o(Bs, "generateKeyPair");
async function rh(r, e, t, i, n = V.fromMiliseconds(Date.now())) {
  const c = { alg: Hc, typ: kc }, h = Cn(i.publicKey), d = n + t, p = { iss: h, sub: r, aud: e, iat: n, exp: d }, u = eh({ header: c, payload: p }), y = Ri.sign(i.secretKey, u);
  return th({ header: c, payload: p, signature: y });
}
o(rh, "signJWT");
const ih = "PARSE_ERROR", sh = "INVALID_REQUEST", nh = "METHOD_NOT_FOUND", oh = "INVALID_PARAMS", Nn = "INTERNAL_ERROR", Li = "SERVER_ERROR", ah = [-32700, -32600, -32601, -32602, -32603], Gt = {
  [ih]: { code: -32700, message: "Parse error" },
  [sh]: { code: -32600, message: "Invalid Request" },
  [nh]: { code: -32601, message: "Method not found" },
  [oh]: { code: -32602, message: "Invalid params" },
  [Nn]: { code: -32603, message: "Internal error" },
  [Li]: { code: -32e3, message: "Server error" }
}, Dn = Li;
function ch(r) {
  return ah.includes(r);
}
o(ch, "isReservedErrorCode");
function Hs(r) {
  return Object.keys(Gt).includes(r) ? Gt[r] : Gt[Dn];
}
o(Hs, "getError");
function hh(r) {
  const e = Object.values(Gt).find((t) => t.code === r);
  return e || Gt[Dn];
}
o(hh, "getErrorByCode");
function uh(r, e, t) {
  return r.message.includes("getaddrinfo ENOTFOUND") || r.message.includes("connect ECONNREFUSED") ? new Error(`Unavailable ${t} RPC url at ${e}`) : r;
}
o(uh, "parseConnectionError");
var Mn = {}, pt = {}, ks;
function lh() {
  if (ks)
    return pt;
  ks = 1, Object.defineProperty(pt, "__esModule", { value: !0 }), pt.isBrowserCryptoAvailable = pt.getSubtleCrypto = pt.getBrowerCrypto = void 0;
  function r() {
    return (lt === null || lt === void 0 ? void 0 : lt.crypto) || (lt === null || lt === void 0 ? void 0 : lt.msCrypto) || {};
  }
  o(r, "getBrowerCrypto"), pt.getBrowerCrypto = r;
  function e() {
    const i = r();
    return i.subtle || i.webkitSubtle;
  }
  o(e, "getSubtleCrypto"), pt.getSubtleCrypto = e;
  function t() {
    return !!r() && !!e();
  }
  return o(t, "isBrowserCryptoAvailable"), pt.isBrowserCryptoAvailable = t, pt;
}
o(lh, "requireCrypto");
var yt = {}, Gs;
function fh() {
  if (Gs)
    return yt;
  Gs = 1, Object.defineProperty(yt, "__esModule", { value: !0 }), yt.isBrowser = yt.isNode = yt.isReactNative = void 0;
  function r() {
    return typeof document > "u" && typeof navigator < "u" && navigator.product === "ReactNative";
  }
  o(r, "isReactNative"), yt.isReactNative = r;
  function e() {
    return typeof process < "u" && typeof process.versions < "u" && typeof process.versions.node < "u";
  }
  o(e, "isNode"), yt.isNode = e;
  function t() {
    return !r() && !e();
  }
  return o(t, "isBrowser"), yt.isBrowser = t, yt;
}
o(fh, "requireEnv");
(function(r) {
  Object.defineProperty(r, "__esModule", { value: !0 });
  const e = Dt;
  e.__exportStar(lh(), r), e.__exportStar(fh(), r);
})(Mn);
function zn(r = 3) {
  const e = Date.now() * Math.pow(10, r), t = Math.floor(Math.random() * Math.pow(10, r));
  return e + t;
}
o(zn, "payloadId");
function Un(r = 6) {
  return BigInt(zn(r));
}
o(Un, "getBigIntRpcId");
function Ai(r, e, t) {
  return {
    id: t || zn(),
    jsonrpc: "2.0",
    method: r,
    params: e
  };
}
o(Ai, "formatJsonRpcRequest");
function $n(r, e) {
  return {
    id: r,
    jsonrpc: "2.0",
    result: e
  };
}
o($n, "formatJsonRpcResult");
function jn(r, e, t) {
  return {
    id: r,
    jsonrpc: "2.0",
    error: dh(e, t)
  };
}
o(jn, "formatJsonRpcError");
function dh(r, e) {
  return typeof r > "u" ? Hs(Nn) : (typeof r == "string" && (r = Object.assign(Object.assign({}, Hs(Li)), { message: r })), typeof e < "u" && (r.data = e), ch(r.code) && (r = hh(r.code)), r);
}
o(dh, "formatErrorMessage");
const Bi = class Bi {
};
o(Bi, "IEvents");
let hi = Bi;
const Hi = class Hi extends hi {
  constructor() {
    super();
  }
};
o(Hi, "IBaseJsonRpcProvider");
let ui = Hi;
const ki = class ki extends ui {
  constructor(e) {
    super();
  }
};
o(ki, "IJsonRpcProvider");
let li = ki;
const gh = "^wss?:";
function ph(r) {
  const e = r.match(new RegExp(/^\w+:/, "gi"));
  if (!(!e || !e.length))
    return e[0];
}
o(ph, "getUrlProtocol");
function yh(r, e) {
  const t = ph(r);
  return typeof t > "u" ? !1 : new RegExp(e).test(t);
}
o(yh, "matchRegexProtocol");
function Vs(r) {
  return yh(r, gh);
}
o(Vs, "isWsUrl");
function mh(r) {
  return new RegExp("wss?://localhost(:d{2,5})?").test(r);
}
o(mh, "isLocalhostUrl");
function Kn(r) {
  return typeof r == "object" && "id" in r && "jsonrpc" in r && r.jsonrpc === "2.0";
}
o(Kn, "isJsonRpcPayload");
function Bn(r) {
  return Kn(r) && "method" in r;
}
o(Bn, "isJsonRpcRequest");
function Pi(r) {
  return Kn(r) && (Hn(r) || Mr(r));
}
o(Pi, "isJsonRpcResponse");
function Hn(r) {
  return "result" in r;
}
o(Hn, "isJsonRpcResult");
function Mr(r) {
  return "error" in r;
}
o(Mr, "isJsonRpcError");
const Gi = class Gi extends li {
  constructor(e) {
    super(e), this.events = new ft.EventEmitter(), this.hasRegisteredEventListeners = !1, this.connection = this.setConnection(e), this.connection.connected && this.registerEventListeners();
  }
  async connect(e = this.connection) {
    await this.open(e);
  }
  async disconnect() {
    await this.close();
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
  async request(e, t) {
    return this.requestStrict(Ai(e.method, e.params || [], e.id || Un().toString()), t);
  }
  async requestStrict(e, t) {
    return new Promise(async (i, n) => {
      if (!this.connection.connected)
        try {
          await this.open();
        } catch (c) {
          n(c);
        }
      this.events.on(`${e.id}`, (c) => {
        Mr(c) ? n(c.error) : i(c.result);
      });
      try {
        await this.connection.send(e, t);
      } catch (c) {
        n(c);
      }
    });
  }
  setConnection(e = this.connection) {
    return e;
  }
  onPayload(e) {
    this.events.emit("payload", e), Pi(e) ? this.events.emit(`${e.id}`, e) : this.events.emit("message", {
      type: e.method,
      data: e.params
    });
  }
  onClose(e) {
    e && e.code === 3e3 && this.events.emit("error", new Error(`WebSocket connection closed abnormally with code: ${e.code} ${e.reason ? `(${e.reason})` : ""}`)), this.events.emit("disconnect");
  }
  async open(e = this.connection) {
    this.connection === e && this.connection.connected || (this.connection.connected && this.close(), typeof e == "string" && (await this.connection.open(e), e = this.connection), this.connection = this.setConnection(e), await this.connection.open(), this.registerEventListeners(), this.events.emit("connect"));
  }
  async close() {
    await this.connection.close();
  }
  registerEventListeners() {
    this.hasRegisteredEventListeners || (this.connection.on("payload", (e) => this.onPayload(e)), this.connection.on("close", (e) => this.onClose(e)), this.connection.on("error", (e) => this.events.emit("error", e)), this.connection.on("register_error", (e) => this.onClose()), this.hasRegisteredEventListeners = !0);
  }
};
o(Gi, "JsonRpcProvider");
let fi = Gi;
const bh = /* @__PURE__ */ o(() => typeof WebSocket < "u" ? WebSocket : typeof global < "u" && typeof global.WebSocket < "u" ? global.WebSocket : typeof window < "u" && typeof window.WebSocket < "u" ? window.WebSocket : typeof self < "u" && typeof self.WebSocket < "u" ? self.WebSocket : require("ws"), "w$1"), vh = /* @__PURE__ */ o(() => typeof WebSocket < "u" || typeof global < "u" && typeof global.WebSocket < "u" || typeof window < "u" && typeof window.WebSocket < "u" || typeof self < "u" && typeof self.WebSocket < "u", "b"), qs = /* @__PURE__ */ o((r) => r.split("?")[0], "a"), Ys = 10, wh = bh(), Vi = class Vi {
  constructor(e) {
    if (this.url = e, this.events = new ft.EventEmitter(), this.registering = !1, !Vs(e))
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
      this.socket.onclose = (i) => {
        this.onClose(i), e();
      }, this.socket.close();
    });
  }
  async send(e) {
    typeof this.socket > "u" && (this.socket = await this.register());
    try {
      this.socket.send(tr(e));
    } catch (t) {
      this.onError(e.id, t);
    }
  }
  register(e = this.url) {
    if (!Vs(e))
      throw new Error(`Provided URL is not compatible with WebSocket connection: ${e}`);
    if (this.registering) {
      const t = this.events.getMaxListeners();
      return (this.events.listenerCount("register_error") >= t || this.events.listenerCount("open") >= t) && this.events.setMaxListeners(t + 1), new Promise((i, n) => {
        this.events.once("register_error", (c) => {
          this.resetMaxListeners(), n(c);
        }), this.events.once("open", () => {
          if (this.resetMaxListeners(), typeof this.socket > "u")
            return n(new Error("WebSocket connection is missing or invalid"));
          i(this.socket);
        });
      });
    }
    return this.url = e, this.registering = !0, new Promise((t, i) => {
      const n = new URLSearchParams(e).get("origin"), c = Mn.isReactNative() ? { headers: { origin: n } } : { rejectUnauthorized: !mh(e) }, h = new wh(e, [], c);
      vh() ? h.onerror = (d) => {
        const p = d;
        i(this.emitError(p.error));
      } : h.on("error", (d) => {
        i(this.emitError(d));
      }), h.onopen = () => {
        this.onOpen(h), t(h);
      };
    });
  }
  onOpen(e) {
    e.onmessage = (t) => this.onPayload(t), e.onclose = (t) => this.onClose(t), this.socket = e, this.registering = !1, this.events.emit("open");
  }
  onClose(e) {
    this.socket = void 0, this.registering = !1, this.events.emit("close", e);
  }
  onPayload(e) {
    if (typeof e.data > "u")
      return;
    const t = typeof e.data == "string" ? Dr(e.data) : e.data;
    this.events.emit("payload", t);
  }
  onError(e, t) {
    const i = this.parseError(t), n = i.message || i.toString(), c = jn(e, n);
    this.events.emit("payload", c);
  }
  parseError(e, t = this.url) {
    return uh(e, qs(t), "WS");
  }
  resetMaxListeners() {
    this.events.getMaxListeners() > Ys && this.events.setMaxListeners(Ys);
  }
  emitError(e) {
    const t = this.parseError(new Error((e == null ? void 0 : e.message) || `WebSocket connection failed for host: ${qs(this.url)}`));
    return this.events.emit("register_error", t), t;
  }
};
o(Vi, "f");
let di = Vi;
var vr = { exports: {} };
vr.exports;
(function(r, e) {
  var t = 200, i = "__lodash_hash_undefined__", n = 1, c = 2, h = 9007199254740991, d = "[object Arguments]", p = "[object Array]", u = "[object AsyncFunction]", y = "[object Boolean]", E = "[object Date]", S = "[object Error]", R = "[object Function]", I = "[object GeneratorFunction]", L = "[object Map]", j = "[object Number]", H = "[object Null]", $ = "[object Object]", Z = "[object Promise]", ae = "[object Proxy]", q = "[object RegExp]", w = "[object Set]", T = "[object String]", P = "[object Symbol]", K = "[object Undefined]", M = "[object WeakMap]", B = "[object ArrayBuffer]", G = "[object DataView]", fe = "[object Float32Array]", m = "[object Float64Array]", _ = "[object Int8Array]", ee = "[object Int16Array]", ce = "[object Int32Array]", N = "[object Uint8Array]", A = "[object Uint8ClampedArray]", O = "[object Uint16Array]", C = "[object Uint32Array]", be = /[\\^$.*+?()[\]{}|]/g, se = /^\[object .+?Constructor\]$/, bt = /^(?:0|[1-9]\d*)$/, k = {};
  k[fe] = k[m] = k[_] = k[ee] = k[ce] = k[N] = k[A] = k[O] = k[C] = !0, k[d] = k[p] = k[B] = k[y] = k[G] = k[E] = k[S] = k[R] = k[L] = k[j] = k[$] = k[q] = k[w] = k[T] = k[M] = !1;
  var Ve = typeof lt == "object" && lt && lt.Object === Object && lt, v = typeof self == "object" && self && self.Object === Object && self, b = Ve || v || Function("return this")(), g = e && !e.nodeType && e, s = g && !0 && r && !r.nodeType && r, l = s && s.exports === g, D = l && Ve.process, z = function() {
    try {
      return D && D.binding && D.binding("util");
    } catch {
    }
  }(), J = z && z.isTypedArray;
  function te(a, f) {
    for (var x = -1, F = a == null ? 0 : a.length, oe = 0, U = []; ++x < F; ) {
      var ye = a[x];
      f(ye, x, a) && (U[oe++] = ye);
    }
    return U;
  }
  o(te, "arrayFilter");
  function Y(a, f) {
    for (var x = -1, F = f.length, oe = a.length; ++x < F; )
      a[oe + x] = f[x];
    return a;
  }
  o(Y, "arrayPush");
  function re(a, f) {
    for (var x = -1, F = a == null ? 0 : a.length; ++x < F; )
      if (f(a[x], x, a))
        return !0;
    return !1;
  }
  o(re, "arraySome");
  function je(a, f) {
    for (var x = -1, F = Array(a); ++x < a; )
      F[x] = f(x);
    return F;
  }
  o(je, "baseTimes");
  function Te(a) {
    return function(f) {
      return a(f);
    };
  }
  o(Te, "baseUnary");
  function Ke(a, f) {
    return a.has(f);
  }
  o(Ke, "cacheHas");
  function Le(a, f) {
    return a == null ? void 0 : a[f];
  }
  o(Le, "getValue");
  function Oe(a) {
    var f = -1, x = Array(a.size);
    return a.forEach(function(F, oe) {
      x[++f] = [oe, F];
    }), x;
  }
  o(Oe, "mapToArray");
  function ve(a, f) {
    return function(x) {
      return a(f(x));
    };
  }
  o(ve, "overArg");
  function me(a) {
    var f = -1, x = Array(a.size);
    return a.forEach(function(F) {
      x[++f] = F;
    }), x;
  }
  o(me, "setToArray");
  var de = Array.prototype, ue = Function.prototype, ie = Object.prototype, we = b["__core-js_shared__"], Ae = ue.toString, ne = ie.hasOwnProperty, ke = function() {
    var a = /[^.]+$/.exec(we && we.keys && we.keys.IE_PROTO || "");
    return a ? "Symbol(src)_1." + a : "";
  }(), qe = ie.toString, Qe = RegExp(
    "^" + Ae.call(ne).replace(be, "\\$&").replace(/hasOwnProperty|(function).*?(?=\\\()| for .+?(?=\\\])/g, "$1.*?") + "$"
  ), Ze = l ? b.Buffer : void 0, Je = b.Symbol, ot = b.Uint8Array, ht = ie.propertyIsEnumerable, vt = de.splice, et = Je ? Je.toStringTag : void 0, xt = Object.getOwnPropertySymbols, zt = Ze ? Ze.isBuffer : void 0, ir = ve(Object.keys, Object), Ee = Pt(b, "DataView"), ge = Pt(b, "Map"), _e = Pt(b, "Promise"), xe = Pt(b, "Set"), Ie = Pt(b, "WeakMap"), pe = Pt(Object, "create"), Pe = St(Ee), Fe = St(ge), Ce = St(_e), Ne = St(xe), De = St(Ie), Re = Je ? Je.prototype : void 0, Se = Re ? Re.valueOf : void 0;
  function he(a) {
    var f = -1, x = a == null ? 0 : a.length;
    for (this.clear(); ++f < x; ) {
      var F = a[f];
      this.set(F[0], F[1]);
    }
  }
  o(he, "Hash");
  function Me() {
    this.__data__ = pe ? pe(null) : {}, this.size = 0;
  }
  o(Me, "hashClear");
  function ze(a) {
    var f = this.has(a) && delete this.__data__[a];
    return this.size -= f ? 1 : 0, f;
  }
  o(ze, "hashDelete");
  function Fo(a) {
    var f = this.__data__;
    if (pe) {
      var x = f[a];
      return x === i ? void 0 : x;
    }
    return ne.call(f, a) ? f[a] : void 0;
  }
  o(Fo, "hashGet");
  function Co(a) {
    var f = this.__data__;
    return pe ? f[a] !== void 0 : ne.call(f, a);
  }
  o(Co, "hashHas");
  function No(a, f) {
    var x = this.__data__;
    return this.size += this.has(a) ? 0 : 1, x[a] = pe && f === void 0 ? i : f, this;
  }
  o(No, "hashSet"), he.prototype.clear = Me, he.prototype.delete = ze, he.prototype.get = Fo, he.prototype.has = Co, he.prototype.set = No;
  function dt(a) {
    var f = -1, x = a == null ? 0 : a.length;
    for (this.clear(); ++f < x; ) {
      var F = a[f];
      this.set(F[0], F[1]);
    }
  }
  o(dt, "ListCache");
  function Do() {
    this.__data__ = [], this.size = 0;
  }
  o(Do, "listCacheClear");
  function Mo(a) {
    var f = this.__data__, x = nr(f, a);
    if (x < 0)
      return !1;
    var F = f.length - 1;
    return x == F ? f.pop() : vt.call(f, x, 1), --this.size, !0;
  }
  o(Mo, "listCacheDelete");
  function zo(a) {
    var f = this.__data__, x = nr(f, a);
    return x < 0 ? void 0 : f[x][1];
  }
  o(zo, "listCacheGet");
  function Uo(a) {
    return nr(this.__data__, a) > -1;
  }
  o(Uo, "listCacheHas");
  function $o(a, f) {
    var x = this.__data__, F = nr(x, a);
    return F < 0 ? (++this.size, x.push([a, f])) : x[F][1] = f, this;
  }
  o($o, "listCacheSet"), dt.prototype.clear = Do, dt.prototype.delete = Mo, dt.prototype.get = zo, dt.prototype.has = Uo, dt.prototype.set = $o;
  function It(a) {
    var f = -1, x = a == null ? 0 : a.length;
    for (this.clear(); ++f < x; ) {
      var F = a[f];
      this.set(F[0], F[1]);
    }
  }
  o(It, "MapCache");
  function jo() {
    this.size = 0, this.__data__ = {
      hash: new he(),
      map: new (ge || dt)(),
      string: new he()
    };
  }
  o(jo, "mapCacheClear");
  function Ko(a) {
    var f = or(this, a).delete(a);
    return this.size -= f ? 1 : 0, f;
  }
  o(Ko, "mapCacheDelete");
  function Bo(a) {
    return or(this, a).get(a);
  }
  o(Bo, "mapCacheGet");
  function Ho(a) {
    return or(this, a).has(a);
  }
  o(Ho, "mapCacheHas");
  function ko(a, f) {
    var x = or(this, a), F = x.size;
    return x.set(a, f), this.size += x.size == F ? 0 : 1, this;
  }
  o(ko, "mapCacheSet"), It.prototype.clear = jo, It.prototype.delete = Ko, It.prototype.get = Bo, It.prototype.has = Ho, It.prototype.set = ko;
  function sr(a) {
    var f = -1, x = a == null ? 0 : a.length;
    for (this.__data__ = new It(); ++f < x; )
      this.add(a[f]);
  }
  o(sr, "SetCache");
  function Go(a) {
    return this.__data__.set(a, i), this;
  }
  o(Go, "setCacheAdd");
  function Vo(a) {
    return this.__data__.has(a);
  }
  o(Vo, "setCacheHas"), sr.prototype.add = sr.prototype.push = Go, sr.prototype.has = Vo;
  function wt(a) {
    var f = this.__data__ = new dt(a);
    this.size = f.size;
  }
  o(wt, "Stack");
  function qo() {
    this.__data__ = new dt(), this.size = 0;
  }
  o(qo, "stackClear");
  function Yo(a) {
    var f = this.__data__, x = f.delete(a);
    return this.size = f.size, x;
  }
  o(Yo, "stackDelete");
  function Wo(a) {
    return this.__data__.get(a);
  }
  o(Wo, "stackGet");
  function Jo(a) {
    return this.__data__.has(a);
  }
  o(Jo, "stackHas");
  function Xo(a, f) {
    var x = this.__data__;
    if (x instanceof dt) {
      var F = x.__data__;
      if (!ge || F.length < t - 1)
        return F.push([a, f]), this.size = ++x.size, this;
      x = this.__data__ = new It(F);
    }
    return x.set(a, f), this.size = x.size, this;
  }
  o(Xo, "stackSet"), wt.prototype.clear = qo, wt.prototype.delete = Yo, wt.prototype.get = Wo, wt.prototype.has = Jo, wt.prototype.set = Xo;
  function Qo(a, f) {
    var x = ar(a), F = !x && da(a), oe = !x && !F && $r(a), U = !x && !F && !oe && vs(a), ye = x || F || oe || U, Ue = ye ? je(a.length, String) : [], Be = Ue.length;
    for (var le in a)
      (f || ne.call(a, le)) && !(ye && // Safari 9 has enumerable `arguments.length` in strict mode.
      (le == "length" || // Node.js 0.10 has enumerable non-index properties on buffers.
      oe && (le == "offset" || le == "parent") || // PhantomJS 2 has enumerable non-index properties on typed arrays.
      U && (le == "buffer" || le == "byteLength" || le == "byteOffset") || // Skip index properties.
      ca(le, Be))) && Ue.push(le);
    return Ue;
  }
  o(Qo, "arrayLikeKeys");
  function nr(a, f) {
    for (var x = a.length; x--; )
      if (ps(a[x][0], f))
        return x;
    return -1;
  }
  o(nr, "assocIndexOf");
  function Zo(a, f, x) {
    var F = f(a);
    return ar(a) ? F : Y(F, x(a));
  }
  o(Zo, "baseGetAllKeys");
  function Ut(a) {
    return a == null ? a === void 0 ? K : H : et && et in Object(a) ? oa(a) : fa(a);
  }
  o(Ut, "baseGetTag");
  function ls(a) {
    return $t(a) && Ut(a) == d;
  }
  o(ls, "baseIsArguments");
  function fs(a, f, x, F, oe) {
    return a === f ? !0 : a == null || f == null || !$t(a) && !$t(f) ? a !== a && f !== f : ea(a, f, x, F, fs, oe);
  }
  o(fs, "baseIsEqual");
  function ea(a, f, x, F, oe, U) {
    var ye = ar(a), Ue = ar(f), Be = ye ? p : Et(a), le = Ue ? p : Et(f);
    Be = Be == d ? $ : Be, le = le == d ? $ : le;
    var tt = Be == $, at = le == $, Ge = Be == le;
    if (Ge && $r(a)) {
      if (!$r(f))
        return !1;
      ye = !0, tt = !1;
    }
    if (Ge && !tt)
      return U || (U = new wt()), ye || vs(a) ? ds(a, f, x, F, oe, U) : sa(a, f, Be, x, F, oe, U);
    if (!(x & n)) {
      var rt = tt && ne.call(a, "__wrapped__"), it = at && ne.call(f, "__wrapped__");
      if (rt || it) {
        var _t = rt ? a.value() : a, gt = it ? f.value() : f;
        return U || (U = new wt()), oe(_t, gt, x, F, U);
      }
    }
    return Ge ? (U || (U = new wt()), na(a, f, x, F, oe, U)) : !1;
  }
  o(ea, "baseIsEqualDeep");
  function ta(a) {
    if (!bs(a) || ua(a))
      return !1;
    var f = ys(a) ? Qe : se;
    return f.test(St(a));
  }
  o(ta, "baseIsNative");
  function ra(a) {
    return $t(a) && ms(a.length) && !!k[Ut(a)];
  }
  o(ra, "baseIsTypedArray");
  function ia(a) {
    if (!la(a))
      return ir(a);
    var f = [];
    for (var x in Object(a))
      ne.call(a, x) && x != "constructor" && f.push(x);
    return f;
  }
  o(ia, "baseKeys");
  function ds(a, f, x, F, oe, U) {
    var ye = x & n, Ue = a.length, Be = f.length;
    if (Ue != Be && !(ye && Be > Ue))
      return !1;
    var le = U.get(a);
    if (le && U.get(f))
      return le == f;
    var tt = -1, at = !0, Ge = x & c ? new sr() : void 0;
    for (U.set(a, f), U.set(f, a); ++tt < Ue; ) {
      var rt = a[tt], it = f[tt];
      if (F)
        var _t = ye ? F(it, rt, tt, f, a, U) : F(rt, it, tt, a, f, U);
      if (_t !== void 0) {
        if (_t)
          continue;
        at = !1;
        break;
      }
      if (Ge) {
        if (!re(f, function(gt, Tt) {
          if (!Ke(Ge, Tt) && (rt === gt || oe(rt, gt, x, F, U)))
            return Ge.push(Tt);
        })) {
          at = !1;
          break;
        }
      } else if (!(rt === it || oe(rt, it, x, F, U))) {
        at = !1;
        break;
      }
    }
    return U.delete(a), U.delete(f), at;
  }
  o(ds, "equalArrays");
  function sa(a, f, x, F, oe, U, ye) {
    switch (x) {
      case G:
        if (a.byteLength != f.byteLength || a.byteOffset != f.byteOffset)
          return !1;
        a = a.buffer, f = f.buffer;
      case B:
        return !(a.byteLength != f.byteLength || !U(new ot(a), new ot(f)));
      case y:
      case E:
      case j:
        return ps(+a, +f);
      case S:
        return a.name == f.name && a.message == f.message;
      case q:
      case T:
        return a == f + "";
      case L:
        var Ue = Oe;
      case w:
        var Be = F & n;
        if (Ue || (Ue = me), a.size != f.size && !Be)
          return !1;
        var le = ye.get(a);
        if (le)
          return le == f;
        F |= c, ye.set(a, f);
        var tt = ds(Ue(a), Ue(f), F, oe, U, ye);
        return ye.delete(a), tt;
      case P:
        if (Se)
          return Se.call(a) == Se.call(f);
    }
    return !1;
  }
  o(sa, "equalByTag");
  function na(a, f, x, F, oe, U) {
    var ye = x & n, Ue = gs(a), Be = Ue.length, le = gs(f), tt = le.length;
    if (Be != tt && !ye)
      return !1;
    for (var at = Be; at--; ) {
      var Ge = Ue[at];
      if (!(ye ? Ge in f : ne.call(f, Ge)))
        return !1;
    }
    var rt = U.get(a);
    if (rt && U.get(f))
      return rt == f;
    var it = !0;
    U.set(a, f), U.set(f, a);
    for (var _t = ye; ++at < Be; ) {
      Ge = Ue[at];
      var gt = a[Ge], Tt = f[Ge];
      if (F)
        var ws = ye ? F(Tt, gt, Ge, f, a, U) : F(gt, Tt, Ge, a, f, U);
      if (!(ws === void 0 ? gt === Tt || oe(gt, Tt, x, F, U) : ws)) {
        it = !1;
        break;
      }
      _t || (_t = Ge == "constructor");
    }
    if (it && !_t) {
      var cr = a.constructor, hr = f.constructor;
      cr != hr && "constructor" in a && "constructor" in f && !(typeof cr == "function" && cr instanceof cr && typeof hr == "function" && hr instanceof hr) && (it = !1);
    }
    return U.delete(a), U.delete(f), it;
  }
  o(na, "equalObjects");
  function gs(a) {
    return Zo(a, ya, aa);
  }
  o(gs, "getAllKeys");
  function or(a, f) {
    var x = a.__data__;
    return ha(f) ? x[typeof f == "string" ? "string" : "hash"] : x.map;
  }
  o(or, "getMapData");
  function Pt(a, f) {
    var x = Le(a, f);
    return ta(x) ? x : void 0;
  }
  o(Pt, "getNative");
  function oa(a) {
    var f = ne.call(a, et), x = a[et];
    try {
      a[et] = void 0;
      var F = !0;
    } catch {
    }
    var oe = qe.call(a);
    return F && (f ? a[et] = x : delete a[et]), oe;
  }
  o(oa, "getRawTag");
  var aa = xt ? function(a) {
    return a == null ? [] : (a = Object(a), te(xt(a), function(f) {
      return ht.call(a, f);
    }));
  } : ma, Et = Ut;
  (Ee && Et(new Ee(new ArrayBuffer(1))) != G || ge && Et(new ge()) != L || _e && Et(_e.resolve()) != Z || xe && Et(new xe()) != w || Ie && Et(new Ie()) != M) && (Et = /* @__PURE__ */ o(function(a) {
    var f = Ut(a), x = f == $ ? a.constructor : void 0, F = x ? St(x) : "";
    if (F)
      switch (F) {
        case Pe:
          return G;
        case Fe:
          return L;
        case Ce:
          return Z;
        case Ne:
          return w;
        case De:
          return M;
      }
    return f;
  }, "getTag"));
  function ca(a, f) {
    return f = f ?? h, !!f && (typeof a == "number" || bt.test(a)) && a > -1 && a % 1 == 0 && a < f;
  }
  o(ca, "isIndex");
  function ha(a) {
    var f = typeof a;
    return f == "string" || f == "number" || f == "symbol" || f == "boolean" ? a !== "__proto__" : a === null;
  }
  o(ha, "isKeyable");
  function ua(a) {
    return !!ke && ke in a;
  }
  o(ua, "isMasked");
  function la(a) {
    var f = a && a.constructor, x = typeof f == "function" && f.prototype || ie;
    return a === x;
  }
  o(la, "isPrototype");
  function fa(a) {
    return qe.call(a);
  }
  o(fa, "objectToString");
  function St(a) {
    if (a != null) {
      try {
        return Ae.call(a);
      } catch {
      }
      try {
        return a + "";
      } catch {
      }
    }
    return "";
  }
  o(St, "toSource");
  function ps(a, f) {
    return a === f || a !== a && f !== f;
  }
  o(ps, "eq");
  var da = ls(function() {
    return arguments;
  }()) ? ls : function(a) {
    return $t(a) && ne.call(a, "callee") && !ht.call(a, "callee");
  }, ar = Array.isArray;
  function ga(a) {
    return a != null && ms(a.length) && !ys(a);
  }
  o(ga, "isArrayLike");
  var $r = zt || ba;
  function pa(a, f) {
    return fs(a, f);
  }
  o(pa, "isEqual");
  function ys(a) {
    if (!bs(a))
      return !1;
    var f = Ut(a);
    return f == R || f == I || f == u || f == ae;
  }
  o(ys, "isFunction");
  function ms(a) {
    return typeof a == "number" && a > -1 && a % 1 == 0 && a <= h;
  }
  o(ms, "isLength");
  function bs(a) {
    var f = typeof a;
    return a != null && (f == "object" || f == "function");
  }
  o(bs, "isObject");
  function $t(a) {
    return a != null && typeof a == "object";
  }
  o($t, "isObjectLike");
  var vs = J ? Te(J) : ra;
  function ya(a) {
    return ga(a) ? Qo(a) : ia(a);
  }
  o(ya, "keys");
  function ma() {
    return [];
  }
  o(ma, "stubArray");
  function ba() {
    return !1;
  }
  o(ba, "stubFalse"), r.exports = pa;
})(vr, vr.exports);
var Eh = vr.exports;
const _h = /* @__PURE__ */ fn(Eh);
function xh(r, e) {
  if (r.length >= 255)
    throw new TypeError("Alphabet too long");
  for (var t = new Uint8Array(256), i = 0; i < t.length; i++)
    t[i] = 255;
  for (var n = 0; n < r.length; n++) {
    var c = r.charAt(n), h = c.charCodeAt(0);
    if (t[h] !== 255)
      throw new TypeError(c + " is ambiguous");
    t[h] = n;
  }
  var d = r.length, p = r.charAt(0), u = Math.log(d) / Math.log(256), y = Math.log(256) / Math.log(d);
  function E(I) {
    if (I instanceof Uint8Array || (ArrayBuffer.isView(I) ? I = new Uint8Array(I.buffer, I.byteOffset, I.byteLength) : Array.isArray(I) && (I = Uint8Array.from(I))), !(I instanceof Uint8Array))
      throw new TypeError("Expected Uint8Array");
    if (I.length === 0)
      return "";
    for (var L = 0, j = 0, H = 0, $ = I.length; H !== $ && I[H] === 0; )
      H++, L++;
    for (var Z = ($ - H) * y + 1 >>> 0, ae = new Uint8Array(Z); H !== $; ) {
      for (var q = I[H], w = 0, T = Z - 1; (q !== 0 || w < j) && T !== -1; T--, w++)
        q += 256 * ae[T] >>> 0, ae[T] = q % d >>> 0, q = q / d >>> 0;
      if (q !== 0)
        throw new Error("Non-zero carry");
      j = w, H++;
    }
    for (var P = Z - j; P !== Z && ae[P] === 0; )
      P++;
    for (var K = p.repeat(L); P < Z; ++P)
      K += r.charAt(ae[P]);
    return K;
  }
  o(E, "p");
  function S(I) {
    if (typeof I != "string")
      throw new TypeError("Expected String");
    if (I.length === 0)
      return new Uint8Array();
    var L = 0;
    if (I[L] !== " ") {
      for (var j = 0, H = 0; I[L] === p; )
        j++, L++;
      for (var $ = (I.length - L) * u + 1 >>> 0, Z = new Uint8Array($); I[L]; ) {
        var ae = t[I.charCodeAt(L)];
        if (ae === 255)
          return;
        for (var q = 0, w = $ - 1; (ae !== 0 || q < H) && w !== -1; w--, q++)
          ae += d * Z[w] >>> 0, Z[w] = ae % 256 >>> 0, ae = ae / 256 >>> 0;
        if (ae !== 0)
          throw new Error("Non-zero carry");
        H = q, L++;
      }
      if (I[L] !== " ") {
        for (var T = $ - H; T !== $ && Z[T] === 0; )
          T++;
        for (var P = new Uint8Array(j + ($ - T)), K = j; T !== $; )
          P[K++] = Z[T++];
        return P;
      }
    }
  }
  o(S, "y");
  function R(I) {
    var L = S(I);
    if (L)
      return L;
    throw new Error(`Non-${e} character`);
  }
  return o(R, "M"), { encode: E, decodeUnsafe: S, decode: R };
}
o(xh, "Vi");
var Ih = xh, Sh = Ih;
const kn = /* @__PURE__ */ o((r) => {
  if (r instanceof Uint8Array && r.constructor.name === "Uint8Array")
    return r;
  if (r instanceof ArrayBuffer)
    return new Uint8Array(r);
  if (ArrayBuffer.isView(r))
    return new Uint8Array(r.buffer, r.byteOffset, r.byteLength);
  throw new Error("Unknown type, must be binary type");
}, "Ne"), Th = /* @__PURE__ */ o((r) => new TextEncoder().encode(r), "Gi"), Oh = /* @__PURE__ */ o((r) => new TextDecoder().decode(r), "Yi"), qi = class qi {
  constructor(e, t, i) {
    this.name = e, this.prefix = t, this.baseEncode = i;
  }
  encode(e) {
    if (e instanceof Uint8Array)
      return `${this.prefix}${this.baseEncode(e)}`;
    throw Error("Unknown type, must be binary type");
  }
};
o(qi, "Hi");
let gi = qi;
const Yi = class Yi {
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
    return Gn(this, e);
  }
};
o(Yi, "Ji");
let pi = Yi;
const Wi = class Wi {
  constructor(e) {
    this.decoders = e;
  }
  or(e) {
    return Gn(this, e);
  }
  decode(e) {
    const t = e[0], i = this.decoders[t];
    if (i)
      return i.decode(e);
    throw RangeError(`Unable to decode multibase string ${JSON.stringify(e)}, only inputs prefixed with ${Object.keys(this.decoders)} are supported`);
  }
};
o(Wi, "Wi");
let yi = Wi;
const Gn = /* @__PURE__ */ o((r, e) => new yi({ ...r.decoders || { [r.prefix]: r }, ...e.decoders || { [e.prefix]: e } }), "Ue"), Ji = class Ji {
  constructor(e, t, i, n) {
    this.name = e, this.prefix = t, this.baseEncode = i, this.baseDecode = n, this.encoder = new gi(e, t, i), this.decoder = new pi(e, t, n);
  }
  encode(e) {
    return this.encoder.encode(e);
  }
  decode(e) {
    return this.decoder.decode(e);
  }
};
o(Ji, "Xi");
let mi = Ji;
const zr = /* @__PURE__ */ o(({ name: r, prefix: e, encode: t, decode: i }) => new mi(r, e, t, i), "X"), rr = /* @__PURE__ */ o(({ prefix: r, name: e, alphabet: t }) => {
  const { encode: i, decode: n } = Sh(t, e);
  return zr({ prefix: r, name: e, encode: i, decode: (c) => kn(n(c)) });
}, "B"), Rh = /* @__PURE__ */ o((r, e, t, i) => {
  const n = {};
  for (let y = 0; y < e.length; ++y)
    n[e[y]] = y;
  let c = r.length;
  for (; r[c - 1] === "="; )
    --c;
  const h = new Uint8Array(c * t / 8 | 0);
  let d = 0, p = 0, u = 0;
  for (let y = 0; y < c; ++y) {
    const E = n[r[y]];
    if (E === void 0)
      throw new SyntaxError(`Non-${i} character`);
    p = p << t | E, d += t, d >= 8 && (d -= 8, h[u++] = 255 & p >> d);
  }
  if (d >= t || 255 & p << 8 - d)
    throw new SyntaxError("Unexpected end of data");
  return h;
}, "Qi"), Lh = /* @__PURE__ */ o((r, e, t) => {
  const i = e[e.length - 1] === "=", n = (1 << t) - 1;
  let c = "", h = 0, d = 0;
  for (let p = 0; p < r.length; ++p)
    for (d = d << 8 | r[p], h += 8; h > t; )
      h -= t, c += e[n & d >> h];
  if (h && (c += e[n & d << t - h]), i)
    for (; c.length * t & 7; )
      c += "=";
  return c;
}, "Zi"), He = /* @__PURE__ */ o(({ name: r, prefix: e, bitsPerChar: t, alphabet: i }) => zr({ prefix: e, name: r, encode(n) {
  return Lh(n, i, t);
}, decode(n) {
  return Rh(n, i, t, r);
} }), "g"), Ah = zr({ prefix: "\0", name: "identity", encode: (r) => Oh(r), decode: (r) => Th(r) });
var Ph = Object.freeze({ __proto__: null, identity: Ah });
const Fh = He({ prefix: "0", name: "base2", alphabet: "01", bitsPerChar: 1 });
var Ch = Object.freeze({ __proto__: null, base2: Fh });
const Nh = He({ prefix: "7", name: "base8", alphabet: "01234567", bitsPerChar: 3 });
var Dh = Object.freeze({ __proto__: null, base8: Nh });
const Mh = rr({ prefix: "9", name: "base10", alphabet: "0123456789" });
var zh = Object.freeze({ __proto__: null, base10: Mh });
const Uh = He({ prefix: "f", name: "base16", alphabet: "0123456789abcdef", bitsPerChar: 4 }), $h = He({ prefix: "F", name: "base16upper", alphabet: "0123456789ABCDEF", bitsPerChar: 4 });
var jh = Object.freeze({ __proto__: null, base16: Uh, base16upper: $h });
const Kh = He({ prefix: "b", name: "base32", alphabet: "abcdefghijklmnopqrstuvwxyz234567", bitsPerChar: 5 }), Bh = He({ prefix: "B", name: "base32upper", alphabet: "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567", bitsPerChar: 5 }), Hh = He({ prefix: "c", name: "base32pad", alphabet: "abcdefghijklmnopqrstuvwxyz234567=", bitsPerChar: 5 }), kh = He({ prefix: "C", name: "base32padupper", alphabet: "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567=", bitsPerChar: 5 }), Gh = He({ prefix: "v", name: "base32hex", alphabet: "0123456789abcdefghijklmnopqrstuv", bitsPerChar: 5 }), Vh = He({ prefix: "V", name: "base32hexupper", alphabet: "0123456789ABCDEFGHIJKLMNOPQRSTUV", bitsPerChar: 5 }), qh = He({ prefix: "t", name: "base32hexpad", alphabet: "0123456789abcdefghijklmnopqrstuv=", bitsPerChar: 5 }), Yh = He({ prefix: "T", name: "base32hexpadupper", alphabet: "0123456789ABCDEFGHIJKLMNOPQRSTUV=", bitsPerChar: 5 }), Wh = He({ prefix: "h", name: "base32z", alphabet: "ybndrfg8ejkmcpqxot1uwisza345h769", bitsPerChar: 5 });
var Jh = Object.freeze({ __proto__: null, base32: Kh, base32upper: Bh, base32pad: Hh, base32padupper: kh, base32hex: Gh, base32hexupper: Vh, base32hexpad: qh, base32hexpadupper: Yh, base32z: Wh });
const Xh = rr({ prefix: "k", name: "base36", alphabet: "0123456789abcdefghijklmnopqrstuvwxyz" }), Qh = rr({ prefix: "K", name: "base36upper", alphabet: "0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ" });
var Zh = Object.freeze({ __proto__: null, base36: Xh, base36upper: Qh });
const eu = rr({ name: "base58btc", prefix: "z", alphabet: "123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz" }), tu = rr({ name: "base58flickr", prefix: "Z", alphabet: "123456789abcdefghijkmnopqrstuvwxyzABCDEFGHJKLMNPQRSTUVWXYZ" });
var ru = Object.freeze({ __proto__: null, base58btc: eu, base58flickr: tu });
const iu = He({ prefix: "m", name: "base64", alphabet: "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/", bitsPerChar: 6 }), su = He({ prefix: "M", name: "base64pad", alphabet: "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/=", bitsPerChar: 6 }), nu = He({ prefix: "u", name: "base64url", alphabet: "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_", bitsPerChar: 6 }), ou = He({ prefix: "U", name: "base64urlpad", alphabet: "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_=", bitsPerChar: 6 });
var au = Object.freeze({ __proto__: null, base64: iu, base64pad: su, base64url: nu, base64urlpad: ou });
const Vn = Array.from("🚀🪐☄🛰🌌🌑🌒🌓🌔🌕🌖🌗🌘🌍🌏🌎🐉☀💻🖥💾💿😂❤😍🤣😊🙏💕😭😘👍😅👏😁🔥🥰💔💖💙😢🤔😆🙄💪😉☺👌🤗💜😔😎😇🌹🤦🎉💞✌✨🤷😱😌🌸🙌😋💗💚😏💛🙂💓🤩😄😀🖤😃💯🙈👇🎶😒🤭❣😜💋👀😪😑💥🙋😞😩😡🤪👊🥳😥🤤👉💃😳✋😚😝😴🌟😬🙃🍀🌷😻😓⭐✅🥺🌈😈🤘💦✔😣🏃💐☹🎊💘😠☝😕🌺🎂🌻😐🖕💝🙊😹🗣💫💀👑🎵🤞😛🔴😤🌼😫⚽🤙☕🏆🤫👈😮🙆🍻🍃🐶💁😲🌿🧡🎁⚡🌞🎈❌✊👋😰🤨😶🤝🚶💰🍓💢🤟🙁🚨💨🤬✈🎀🍺🤓😙💟🌱😖👶🥴▶➡❓💎💸⬇😨🌚🦋😷🕺⚠🙅😟😵👎🤲🤠🤧📌🔵💅🧐🐾🍒😗🤑🌊🤯🐷☎💧😯💆👆🎤🙇🍑❄🌴💣🐸💌📍🥀🤢👅💡💩👐📸👻🤐🤮🎼🥵🚩🍎🍊👼💍📣🥂"), cu = Vn.reduce((r, e, t) => (r[t] = e, r), []), hu = Vn.reduce((r, e, t) => (r[e.codePointAt(0)] = t, r), []);
function uu(r) {
  return r.reduce((e, t) => (e += cu[t], e), "");
}
o(uu, "Ns");
function lu(r) {
  const e = [];
  for (const t of r) {
    const i = hu[t.codePointAt(0)];
    if (i === void 0)
      throw new Error(`Non-base256emoji character: ${t}`);
    e.push(i);
  }
  return new Uint8Array(e);
}
o(lu, "Us");
const fu = zr({ prefix: "🚀", name: "base256emoji", encode: uu, decode: lu });
var du = Object.freeze({ __proto__: null, base256emoji: fu }), gu = qn, Ws = 128, pu = 127, yu = ~pu, mu = Math.pow(2, 31);
function qn(r, e, t) {
  e = e || [], t = t || 0;
  for (var i = t; r >= mu; )
    e[t++] = r & 255 | Ws, r /= 128;
  for (; r & yu; )
    e[t++] = r & 255 | Ws, r >>>= 7;
  return e[t] = r | 0, qn.bytes = t - i + 1, e;
}
o(qn, "$e");
var bu = bi, vu = 128, Js = 127;
function bi(r, i) {
  var t = 0, i = i || 0, n = 0, c = i, h, d = r.length;
  do {
    if (c >= d)
      throw bi.bytes = 0, new RangeError("Could not decode varint");
    h = r[c++], t += n < 28 ? (h & Js) << n : (h & Js) * Math.pow(2, n), n += 7;
  } while (h >= vu);
  return bi.bytes = c - i, t;
}
o(bi, "he");
var wu = Math.pow(2, 7), Eu = Math.pow(2, 14), _u = Math.pow(2, 21), xu = Math.pow(2, 28), Iu = Math.pow(2, 35), Su = Math.pow(2, 42), Tu = Math.pow(2, 49), Ou = Math.pow(2, 56), Ru = Math.pow(2, 63), Lu = /* @__PURE__ */ o(function(r) {
  return r < wu ? 1 : r < Eu ? 2 : r < _u ? 3 : r < xu ? 4 : r < Iu ? 5 : r < Su ? 6 : r < Tu ? 7 : r < Ou ? 8 : r < Ru ? 9 : 10;
}, "Zs"), Au = { encode: gu, decode: bu, encodingLength: Lu }, Yn = Au;
const Xs = /* @__PURE__ */ o((r, e, t = 0) => (Yn.encode(r, e, t), e), "Ke"), Qs = /* @__PURE__ */ o((r) => Yn.encodingLength(r), "Be"), vi = /* @__PURE__ */ o((r, e) => {
  const t = e.byteLength, i = Qs(r), n = i + Qs(t), c = new Uint8Array(n + t);
  return Xs(r, c, 0), Xs(t, c, i), c.set(e, n), new wi(r, t, e, c);
}, "ce"), Xi = class Xi {
  constructor(e, t, i, n) {
    this.code = e, this.size = t, this.digest = i, this.bytes = n;
  }
};
o(Xi, "tr");
let wi = Xi;
const Wn = /* @__PURE__ */ o(({ name: r, code: e, encode: t }) => new Ei(r, e, t), "Ve"), Qi = class Qi {
  constructor(e, t, i) {
    this.name = e, this.code = t, this.encode = i;
  }
  digest(e) {
    if (e instanceof Uint8Array) {
      const t = this.encode(e);
      return t instanceof Uint8Array ? vi(this.code, t) : t.then((i) => vi(this.code, i));
    } else
      throw Error("Unknown type, must be binary type");
  }
};
o(Qi, "ir");
let Ei = Qi;
const Jn = /* @__PURE__ */ o((r) => async (e) => new Uint8Array(await crypto.subtle.digest(r, e)), "qe"), Pu = Wn({ name: "sha2-256", code: 18, encode: Jn("SHA-256") }), Fu = Wn({ name: "sha2-512", code: 19, encode: Jn("SHA-512") });
var Cu = Object.freeze({ __proto__: null, sha256: Pu, sha512: Fu });
const Xn = 0, Nu = "identity", Qn = kn, Du = /* @__PURE__ */ o((r) => vi(Xn, Qn(r)), "ar"), Mu = { code: Xn, name: Nu, encode: Qn, digest: Du };
var zu = Object.freeze({ __proto__: null, identity: Mu });
new TextEncoder(), new TextDecoder();
const Zs = { ...Ph, ...Ch, ...Dh, ...zh, ...jh, ...Jh, ...Zh, ...ru, ...au, ...du };
({ ...Cu, ...zu });
function Zn(r) {
  return globalThis.Buffer != null ? new Uint8Array(r.buffer, r.byteOffset, r.byteLength) : r;
}
o(Zn, "He");
function Uu(r = 0) {
  return globalThis.Buffer != null && globalThis.Buffer.allocUnsafe != null ? Zn(globalThis.Buffer.allocUnsafe(r)) : new Uint8Array(r);
}
o(Uu, "ur");
function eo(r, e, t, i) {
  return { name: r, prefix: e, encoder: { name: r, prefix: e, encode: t }, decoder: { decode: i } };
}
o(eo, "Je");
const en = eo("utf8", "u", (r) => "u" + new TextDecoder("utf8").decode(r), (r) => new TextEncoder().encode(r.substring(1))), Yr = eo("ascii", "a", (r) => {
  let e = "a";
  for (let t = 0; t < r.length; t++)
    e += String.fromCharCode(r[t]);
  return e;
}, (r) => {
  r = r.substring(1);
  const e = Uu(r.length);
  for (let t = 0; t < r.length; t++)
    e[t] = r.charCodeAt(t);
  return e;
}), $u = { utf8: en, "utf-8": en, hex: Zs.base16, latin1: Yr, ascii: Yr, binary: Yr, ...Zs };
function ju(r, e = "utf8") {
  const t = $u[e];
  if (!t)
    throw new Error(`Unsupported encoding "${e}"`);
  return (e === "utf8" || e === "utf-8") && globalThis.Buffer != null && globalThis.Buffer.from != null ? Zn(globalThis.Buffer.from(r, "utf-8")) : t.decoder.decode(`${t.prefix}${r}`);
}
o(ju, "dr");
const Fi = "wc", to = 2, Ur = "core", mt = `${Fi}@2:${Ur}:`, ro = { name: Ur, logger: "error" }, io = { database: ":memory:" }, so = "crypto", _i = "client_ed25519_seed", no = V.ONE_DAY, oo = "keychain", ao = "0.3", co = "messages", ho = "0.3", uo = V.SIX_HOURS, lo = "publisher", fo = "irn", go = "error", Ci = "wss://relay.walletconnect.com", xi = "wss://relay.walletconnect.org", po = "relayer", We = { message: "relayer_message", message_ack: "relayer_message_ack", connect: "relayer_connect", disconnect: "relayer_disconnect", error: "relayer_error", connection_stalled: "relayer_connection_stalled", transport_closed: "relayer_transport_closed", publish: "relayer_publish" }, yo = "_subscription", ut = { payload: "payload", connect: "connect", disconnect: "disconnect", error: "error" }, mo = V.ONE_SECOND, Ku = { database: ":memory:" }, bo = "2.10.6", vo = 1e4, wo = "0.3", Eo = "WALLETCONNECT_CLIENT_ID", nt = { created: "subscription_created", deleted: "subscription_deleted", expired: "subscription_expired", disabled: "subscription_disabled", sync: "subscription_sync", resubscribed: "subscription_resubscribed" }, Bu = V.THIRTY_DAYS, _o = "subscription", xo = "0.3", Io = V.FIVE_SECONDS * 1e3, So = "pairing", To = "0.3", Hu = V.THIRTY_DAYS, Ft = { wc_pairingDelete: { req: { ttl: V.ONE_DAY, prompt: !1, tag: 1e3 }, res: { ttl: V.ONE_DAY, prompt: !1, tag: 1001 } }, wc_pairingPing: { req: { ttl: V.THIRTY_SECONDS, prompt: !1, tag: 1002 }, res: { ttl: V.THIRTY_SECONDS, prompt: !1, tag: 1003 } }, unregistered_method: { req: { ttl: V.ONE_DAY, prompt: !1, tag: 0 }, res: { ttl: V.ONE_DAY, prompt: !1, tag: 0 } } }, kt = { create: "pairing_create", expire: "pairing_expire", delete: "pairing_delete", ping: "pairing_ping" }, ct = { created: "history_created", updated: "history_updated", deleted: "history_deleted", sync: "history_sync" }, Oo = "history", Ro = "0.3", Lo = "expirer", st = { created: "expirer_created", deleted: "expirer_deleted", expired: "expirer_expired", sync: "expirer_sync" }, Ao = "0.3", ku = V.ONE_DAY, mr = "verify-api", Ct = "https://verify.walletconnect.com", wr = "https://verify.walletconnect.org", Po = [Ct, wr], Zi = class Zi {
  constructor(e, t) {
    this.core = e, this.logger = t, this.keychain = /* @__PURE__ */ new Map(), this.name = oo, this.version = ao, this.initialized = !1, this.storagePrefix = mt, this.init = async () => {
      if (!this.initialized) {
        const i = await this.getKeyChain();
        typeof i < "u" && (this.keychain = i), this.initialized = !0;
      }
    }, this.has = (i) => (this.isInitialized(), this.keychain.has(i)), this.set = async (i, n) => {
      this.isInitialized(), this.keychain.set(i, n), await this.persist();
    }, this.get = (i) => {
      this.isInitialized();
      const n = this.keychain.get(i);
      if (typeof n > "u") {
        const { message: c } = X("NO_MATCHING_KEY", `${this.name}: ${i}`);
        throw new Error(c);
      }
      return n;
    }, this.del = async (i) => {
      this.isInitialized(), this.keychain.delete(i), await this.persist();
    }, this.core = e, this.logger = W.generateChildLogger(t, this.name);
  }
  get context() {
    return W.getLoggerContext(this.logger);
  }
  get storageKey() {
    return this.storagePrefix + this.version + this.core.customStoragePrefix + "//" + this.name;
  }
  async setKeyChain(e) {
    await this.core.storage.setItem(this.storageKey, pn(e));
  }
  async getKeyChain() {
    const e = await this.core.storage.getItem(this.storageKey);
    return typeof e < "u" ? yn(e) : void 0;
  }
  async persist() {
    await this.setKeyChain(this.keychain);
  }
  isInitialized() {
    if (!this.initialized) {
      const { message: e } = X("NOT_INITIALIZED", this.name);
      throw new Error(e);
    }
  }
};
o(Zi, "St");
let Er = Zi;
const es = class es {
  constructor(e, t, i) {
    this.core = e, this.logger = t, this.name = so, this.initialized = !1, this.init = async () => {
      this.initialized || (await this.keychain.init(), this.initialized = !0);
    }, this.hasKeys = (n) => (this.isInitialized(), this.keychain.has(n)), this.getClientId = async () => {
      this.isInitialized();
      const n = await this.getClientSeed(), c = Bs(n);
      return Cn(c.publicKey);
    }, this.generateKeyPair = () => {
      this.isInitialized();
      const n = xa();
      return this.setPrivateKey(n.publicKey, n.privateKey);
    }, this.signJWT = async (n) => {
      this.isInitialized();
      const c = await this.getClientSeed(), h = Bs(c), d = Jr();
      return await rh(d, n, no, h);
    }, this.generateSharedKey = (n, c, h) => {
      this.isInitialized();
      const d = this.getPrivateKey(n), p = Ia(d, c);
      return this.setSymKey(p, h);
    }, this.setSymKey = async (n, c) => {
      this.isInitialized();
      const h = c || Sa(n);
      return await this.keychain.set(h, n), h;
    }, this.deleteKeyPair = async (n) => {
      this.isInitialized(), await this.keychain.del(n);
    }, this.deleteSymKey = async (n) => {
      this.isInitialized(), await this.keychain.del(n);
    }, this.encode = async (n, c, h) => {
      this.isInitialized();
      const d = Ta(h), p = tr(c);
      if (Es(d)) {
        const S = d.senderPublicKey, R = d.receiverPublicKey;
        n = await this.generateSharedKey(S, R);
      }
      const u = this.getSymKey(n), { type: y, senderPublicKey: E } = d;
      return Oa({ type: y, symKey: u, message: p, senderPublicKey: E });
    }, this.decode = async (n, c, h) => {
      this.isInitialized();
      const d = Ra(c, h);
      if (Es(d)) {
        const p = d.receiverPublicKey, u = d.senderPublicKey;
        n = await this.generateSharedKey(p, u);
      }
      try {
        const p = this.getSymKey(n), u = La({ symKey: p, encoded: c });
        return Dr(u);
      } catch (p) {
        this.logger.error(`Failed to decode message from topic: '${n}', clientId: '${await this.getClientId()}'`), this.logger.error(p);
      }
    }, this.getPayloadType = (n) => {
      const c = _s(n);
      return Aa(c.type);
    }, this.getPayloadSenderPublicKey = (n) => {
      const c = _s(n);
      return c.senderPublicKey ? Cr(c.senderPublicKey, Ya) : void 0;
    }, this.core = e, this.logger = W.generateChildLogger(t, this.name), this.keychain = i || new Er(this.core, this.logger);
  }
  get context() {
    return W.getLoggerContext(this.logger);
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
      e = this.keychain.get(_i);
    } catch {
      e = Jr(), await this.keychain.set(_i, e);
    }
    return ju(e, "base16");
  }
  getSymKey(e) {
    return this.keychain.get(e);
  }
  isInitialized() {
    if (!this.initialized) {
      const { message: e } = X("NOT_INITIALIZED", this.name);
      throw new Error(e);
    }
  }
};
o(es, "Tt");
let _r = es;
const ts = class ts extends Kc {
  constructor(e, t) {
    super(e, t), this.logger = e, this.core = t, this.messages = /* @__PURE__ */ new Map(), this.name = co, this.version = ho, this.initialized = !1, this.storagePrefix = mt, this.init = async () => {
      if (!this.initialized) {
        this.logger.trace("Initialized");
        try {
          const i = await this.getRelayerMessages();
          typeof i < "u" && (this.messages = i), this.logger.debug(`Successfully Restored records for ${this.name}`), this.logger.trace({ type: "method", method: "restore", size: this.messages.size });
        } catch (i) {
          this.logger.debug(`Failed to Restore records for ${this.name}`), this.logger.error(i);
        } finally {
          this.initialized = !0;
        }
      }
    }, this.set = async (i, n) => {
      this.isInitialized();
      const c = Xr(n);
      let h = this.messages.get(i);
      return typeof h > "u" && (h = {}), typeof h[c] < "u" || (h[c] = n, this.messages.set(i, h), await this.persist()), c;
    }, this.get = (i) => {
      this.isInitialized();
      let n = this.messages.get(i);
      return typeof n > "u" && (n = {}), n;
    }, this.has = (i, n) => {
      this.isInitialized();
      const c = this.get(i), h = Xr(n);
      return typeof c[h] < "u";
    }, this.del = async (i) => {
      this.isInitialized(), this.messages.delete(i), await this.persist();
    }, this.logger = W.generateChildLogger(e, this.name), this.core = t;
  }
  get context() {
    return W.getLoggerContext(this.logger);
  }
  get storageKey() {
    return this.storagePrefix + this.version + this.core.customStoragePrefix + "//" + this.name;
  }
  async setRelayerMessages(e) {
    await this.core.storage.setItem(this.storageKey, pn(e));
  }
  async getRelayerMessages() {
    const e = await this.core.storage.getItem(this.storageKey);
    return typeof e < "u" ? yn(e) : void 0;
  }
  async persist() {
    await this.setRelayerMessages(this.messages);
  }
  isInitialized() {
    if (!this.initialized) {
      const { message: e } = X("NOT_INITIALIZED", this.name);
      throw new Error(e);
    }
  }
};
o(ts, "Pt");
let xr = ts;
const rs = class rs extends si {
  constructor(e, t) {
    super(e, t), this.relayer = e, this.logger = t, this.events = new ft.EventEmitter(), this.name = lo, this.queue = /* @__PURE__ */ new Map(), this.publishTimeout = V.toMiliseconds(V.TEN_SECONDS), this.needsTransportRestart = !1, this.publish = async (i, n, c) => {
      var h;
      this.logger.debug("Publishing Payload"), this.logger.trace({ type: "method", method: "publish", params: { topic: i, message: n, opts: c } });
      try {
        const d = (c == null ? void 0 : c.ttl) || uo, p = Qr(c), u = (c == null ? void 0 : c.prompt) || !1, y = (c == null ? void 0 : c.tag) || 0, E = (c == null ? void 0 : c.id) || Un().toString(), S = { topic: i, message: n, opts: { ttl: d, relay: p, prompt: u, tag: y, id: E } }, R = setTimeout(() => this.queue.set(E, S), this.publishTimeout);
        try {
          await await Vt(this.rpcPublish(i, n, d, p, u, y, E), this.publishTimeout, "Failed to publish payload, please try again."), this.removeRequestFromQueue(E), this.relayer.events.emit(We.publish, S);
        } catch (I) {
          if (this.logger.debug("Publishing Payload stalled"), this.needsTransportRestart = !0, (h = c == null ? void 0 : c.internal) != null && h.throwOnFailedPublish)
            throw this.removeRequestFromQueue(E), I;
          return;
        } finally {
          clearTimeout(R);
        }
        this.logger.debug("Successfully Published Payload"), this.logger.trace({ type: "method", method: "publish", params: { topic: i, message: n, opts: c } });
      } catch (d) {
        throw this.logger.debug("Failed to Publish Payload"), this.logger.error(d), d;
      }
    }, this.on = (i, n) => {
      this.events.on(i, n);
    }, this.once = (i, n) => {
      this.events.once(i, n);
    }, this.off = (i, n) => {
      this.events.off(i, n);
    }, this.removeListener = (i, n) => {
      this.events.removeListener(i, n);
    }, this.relayer = e, this.logger = W.generateChildLogger(t, this.name), this.registerEventListeners();
  }
  get context() {
    return W.getLoggerContext(this.logger);
  }
  rpcPublish(e, t, i, n, c, h, d) {
    var p, u, y, E;
    const S = { method: fr(n.protocol).publish, params: { topic: e, message: t, ttl: i, prompt: c, tag: h }, id: d };
    return Zr((p = S.params) == null ? void 0 : p.prompt) && ((u = S.params) == null || delete u.prompt), Zr((y = S.params) == null ? void 0 : y.tag) && ((E = S.params) == null || delete E.tag), this.logger.debug("Outgoing Relay Payload"), this.logger.trace({ type: "message", direction: "outgoing", request: S }), this.relayer.request(S);
  }
  removeRequestFromQueue(e) {
    this.queue.delete(e);
  }
  checkQueue() {
    this.queue.forEach(async (e) => {
      const { topic: t, message: i, opts: n } = e;
      await this.publish(t, i, n);
    });
  }
  registerEventListeners() {
    this.relayer.core.heartbeat.on(Mt.HEARTBEAT_EVENTS.pulse, () => {
      if (this.needsTransportRestart) {
        this.needsTransportRestart = !1, this.relayer.events.emit(We.connection_stalled);
        return;
      }
      this.checkQueue();
    }), this.relayer.on(We.message_ack, (e) => {
      this.removeRequestFromQueue(e.id.toString());
    });
  }
};
o(rs, "mr");
let Ii = rs;
const is = class is {
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
      const n = i.filter((c) => c !== t);
      if (!n.length) {
        this.map.delete(e);
        return;
      }
      this.map.set(e, n);
    }, this.clear = () => {
      this.map.clear();
    };
  }
  get topics() {
    return Array.from(this.map.keys());
  }
};
o(is, "br");
let Si = is;
var Gu = Object.defineProperty, Vu = Object.defineProperties, qu = Object.getOwnPropertyDescriptors, tn = Object.getOwnPropertySymbols, Yu = Object.prototype.hasOwnProperty, Wu = Object.prototype.propertyIsEnumerable, rn = /* @__PURE__ */ o((r, e, t) => e in r ? Gu(r, e, { enumerable: !0, configurable: !0, writable: !0, value: t }) : r[e] = t, "Ot"), Bt = /* @__PURE__ */ o((r, e) => {
  for (var t in e || (e = {}))
    Yu.call(e, t) && rn(r, t, e[t]);
  if (tn)
    for (var t of tn(e))
      Wu.call(e, t) && rn(r, t, e[t]);
  return r;
}, "q"), Wr = /* @__PURE__ */ o((r, e) => Vu(r, qu(e)), "De");
const ss = class ss extends oi {
  constructor(e, t) {
    super(e, t), this.relayer = e, this.logger = t, this.subscriptions = /* @__PURE__ */ new Map(), this.topicMap = new Si(), this.events = new ft.EventEmitter(), this.name = _o, this.version = xo, this.pending = /* @__PURE__ */ new Map(), this.cached = [], this.initialized = !1, this.pendingSubscriptionWatchLabel = "pending_sub_watch_label", this.pollingInterval = 20, this.storagePrefix = mt, this.subscribeTimeout = 1e4, this.restartInProgress = !1, this.batchSubscribeTopicsLimit = 500, this.init = async () => {
      this.initialized || (this.logger.trace("Initialized"), this.registerEventListeners(), this.clientId = await this.relayer.core.crypto.getClientId());
    }, this.subscribe = async (i, n) => {
      await this.restartToComplete(), this.isInitialized(), this.logger.debug("Subscribing Topic"), this.logger.trace({ type: "method", method: "subscribe", params: { topic: i, opts: n } });
      try {
        const c = Qr(n), h = { topic: i, relay: c };
        this.pending.set(i, h);
        const d = await this.rpcSubscribe(i, c);
        return this.onSubscribe(d, h), this.logger.debug("Successfully Subscribed Topic"), this.logger.trace({ type: "method", method: "subscribe", params: { topic: i, opts: n } }), d;
      } catch (c) {
        throw this.logger.debug("Failed to Subscribe Topic"), this.logger.error(c), c;
      }
    }, this.unsubscribe = async (i, n) => {
      await this.restartToComplete(), this.isInitialized(), typeof (n == null ? void 0 : n.id) < "u" ? await this.unsubscribeById(i, n.id, n) : await this.unsubscribeByTopic(i, n);
    }, this.isSubscribed = async (i) => this.topics.includes(i) ? !0 : await new Promise((n, c) => {
      const h = new V.Watch();
      h.start(this.pendingSubscriptionWatchLabel);
      const d = setInterval(() => {
        !this.pending.has(i) && this.topics.includes(i) && (clearInterval(d), h.stop(this.pendingSubscriptionWatchLabel), n(!0)), h.elapsed(this.pendingSubscriptionWatchLabel) >= Io && (clearInterval(d), h.stop(this.pendingSubscriptionWatchLabel), c(new Error("Subscription resolution timeout")));
      }, this.pollingInterval);
    }).catch(() => !1), this.on = (i, n) => {
      this.events.on(i, n);
    }, this.once = (i, n) => {
      this.events.once(i, n);
    }, this.off = (i, n) => {
      this.events.off(i, n);
    }, this.removeListener = (i, n) => {
      this.events.removeListener(i, n);
    }, this.restart = async () => {
      this.restartInProgress = !0, await this.restore(), await this.reset(), this.restartInProgress = !1;
    }, this.relayer = e, this.logger = W.generateChildLogger(t, this.name), this.clientId = "";
  }
  get context() {
    return W.getLoggerContext(this.logger);
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
    let i = !1;
    try {
      i = this.getSubscription(e).topic === t;
    } catch {
    }
    return i;
  }
  onEnable() {
    this.cached = [], this.initialized = !0;
  }
  onDisable() {
    this.cached = this.values, this.subscriptions.clear(), this.topicMap.clear();
  }
  async unsubscribeByTopic(e, t) {
    const i = this.topicMap.get(e);
    await Promise.all(i.map(async (n) => await this.unsubscribeById(e, n, t)));
  }
  async unsubscribeById(e, t, i) {
    this.logger.debug("Unsubscribing Topic"), this.logger.trace({ type: "method", method: "unsubscribe", params: { topic: e, id: t, opts: i } });
    try {
      const n = Qr(i);
      await this.rpcUnsubscribe(e, t, n);
      const c = Ht("USER_DISCONNECTED", `${this.name}, ${e}`);
      await this.onUnsubscribe(e, t, c), this.logger.debug("Successfully Unsubscribed Topic"), this.logger.trace({ type: "method", method: "unsubscribe", params: { topic: e, id: t, opts: i } });
    } catch (n) {
      throw this.logger.debug("Failed to Unsubscribe Topic"), this.logger.error(n), n;
    }
  }
  async rpcSubscribe(e, t) {
    const i = { method: fr(t.protocol).subscribe, params: { topic: e } };
    this.logger.debug("Outgoing Relay Payload"), this.logger.trace({ type: "payload", direction: "outgoing", request: i });
    try {
      await await Vt(this.relayer.request(i), this.subscribeTimeout);
    } catch {
      this.logger.debug("Outgoing Relay Subscribe Payload stalled"), this.relayer.events.emit(We.connection_stalled);
    }
    return Xr(e + this.clientId);
  }
  async rpcBatchSubscribe(e) {
    if (!e.length)
      return;
    const t = e[0].relay, i = { method: fr(t.protocol).batchSubscribe, params: { topics: e.map((n) => n.topic) } };
    this.logger.debug("Outgoing Relay Payload"), this.logger.trace({ type: "payload", direction: "outgoing", request: i });
    try {
      return await await Vt(this.relayer.request(i), this.subscribeTimeout);
    } catch {
      this.logger.debug("Outgoing Relay Payload stalled"), this.relayer.events.emit(We.connection_stalled);
    }
  }
  rpcUnsubscribe(e, t, i) {
    const n = { method: fr(i.protocol).unsubscribe, params: { topic: e, id: t } };
    return this.logger.debug("Outgoing Relay Payload"), this.logger.trace({ type: "payload", direction: "outgoing", request: n }), this.relayer.request(n);
  }
  onSubscribe(e, t) {
    this.setSubscription(e, Wr(Bt({}, t), { id: e })), this.pending.delete(t.topic);
  }
  onBatchSubscribe(e) {
    e.length && e.forEach((t) => {
      this.setSubscription(t.id, Bt({}, t)), this.pending.delete(t.topic);
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
    this.subscriptions.set(e, Bt({}, t)), this.topicMap.set(t.topic, e), this.events.emit(nt.created, t);
  }
  getSubscription(e) {
    this.logger.debug("Getting subscription"), this.logger.trace({ type: "method", method: "getSubscription", id: e });
    const t = this.subscriptions.get(e);
    if (!t) {
      const { message: i } = X("NO_MATCHING_KEY", `${this.name}: ${e}`);
      throw new Error(i);
    }
    return t;
  }
  deleteSubscription(e, t) {
    this.logger.debug("Deleting subscription"), this.logger.trace({ type: "method", method: "deleteSubscription", id: e, reason: t });
    const i = this.getSubscription(e);
    this.subscriptions.delete(e), this.topicMap.delete(i.topic, e), this.events.emit(nt.deleted, Wr(Bt({}, i), { reason: t }));
  }
  async persist() {
    await this.setRelayerSubscriptions(this.values), this.events.emit(nt.sync);
  }
  async reset() {
    if (this.cached.length) {
      const e = Math.ceil(this.cached.length / this.batchSubscribeTopicsLimit);
      for (let t = 0; t < e; t++) {
        const i = this.cached.splice(0, this.batchSubscribeTopicsLimit);
        await this.batchSubscribe(i);
      }
    }
    this.events.emit(nt.resubscribed);
  }
  async restore() {
    try {
      const e = await this.getRelayerSubscriptions();
      if (typeof e > "u" || !e.length)
        return;
      if (this.subscriptions.size) {
        const { message: t } = X("RESTORE_WILL_OVERRIDE", this.name);
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
    Pa(t) && this.onBatchSubscribe(t.map((i, n) => Wr(Bt({}, e[n]), { id: i })));
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
    this.relayer.core.heartbeat.on(Mt.HEARTBEAT_EVENTS.pulse, async () => {
      await this.checkPending();
    }), this.relayer.on(We.connect, async () => {
      await this.onConnect();
    }), this.relayer.on(We.disconnect, () => {
      this.onDisconnect();
    }), this.events.on(nt.created, async (e) => {
      const t = nt.created;
      this.logger.info(`Emitting ${t}`), this.logger.debug({ type: "event", event: t, data: e }), await this.persist();
    }), this.events.on(nt.deleted, async (e) => {
      const t = nt.deleted;
      this.logger.info(`Emitting ${t}`), this.logger.debug({ type: "event", event: t, data: e }), await this.persist();
    });
  }
  isInitialized() {
    if (!this.initialized) {
      const { message: e } = X("NOT_INITIALIZED", this.name);
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
};
o(ss, "At");
let Ir = ss;
var Ju = Object.defineProperty, sn = Object.getOwnPropertySymbols, Xu = Object.prototype.hasOwnProperty, Qu = Object.prototype.propertyIsEnumerable, nn = /* @__PURE__ */ o((r, e, t) => e in r ? Ju(r, e, { enumerable: !0, configurable: !0, writable: !0, value: t }) : r[e] = t, "Nt"), Zu = /* @__PURE__ */ o((r, e) => {
  for (var t in e || (e = {}))
    Xu.call(e, t) && nn(r, t, e[t]);
  if (sn)
    for (var t of sn(e))
      Qu.call(e, t) && nn(r, t, e[t]);
  return r;
}, "Sr");
const ns = class ns extends Bc {
  constructor(e) {
    super(e), this.protocol = "wc", this.version = 2, this.events = new ft.EventEmitter(), this.name = po, this.transportExplicitlyClosed = !1, this.initialized = !1, this.connectionAttemptInProgress = !1, this.connectionStatusPollingInterval = 20, this.staleConnectionErrors = ["socket hang up", "socket stalled"], this.hasExperiencedNetworkDisruption = !1, this.request = async (t) => {
      this.logger.debug("Publishing Request Payload");
      try {
        return await this.toEstablishConnection(), await this.provider.request(t);
      } catch (i) {
        throw this.logger.debug("Failed to Publish Request"), this.logger.error(i), i;
      }
    }, this.onPayloadHandler = (t) => {
      this.onProviderPayload(t);
    }, this.onConnectHandler = () => {
      this.events.emit(We.connect);
    }, this.onDisconnectHandler = () => {
      this.onProviderDisconnect();
    }, this.onProviderErrorHandler = (t) => {
      this.logger.error(t), this.events.emit(We.error, t), this.logger.info("Fatal socket error received, closing transport"), this.transportClose();
    }, this.registerProviderListeners = () => {
      this.provider.on(ut.payload, this.onPayloadHandler), this.provider.on(ut.connect, this.onConnectHandler), this.provider.on(ut.disconnect, this.onDisconnectHandler), this.provider.on(ut.error, this.onProviderErrorHandler);
    }, this.core = e.core, this.logger = typeof e.logger < "u" && typeof e.logger != "string" ? W.generateChildLogger(e.logger, this.name) : W.pino(W.getDefaultLoggerOptions({ level: e.logger || go })), this.messages = new xr(this.logger, e.core), this.subscriber = new Ir(this, this.logger), this.publisher = new Ii(this, this.logger), this.relayUrl = (e == null ? void 0 : e.relayUrl) || Ci, this.projectId = e.projectId, this.bundleId = Fa(), this.provider = {};
  }
  async init() {
    this.logger.trace("Initialized"), this.registerEventListeners(), await this.createProvider(), await Promise.all([this.messages.init(), this.subscriber.init()]);
    try {
      await this.transportOpen();
    } catch {
      this.logger.warn(`Connection via ${this.relayUrl} failed, attempting to connect via failover domain ${xi}...`), await this.restartTransport(xi);
    }
    this.initialized = !0, setTimeout(async () => {
      this.subscriber.topics.length === 0 && (this.logger.info("No topics subscribed to after init, closing transport"), await this.transportClose(), this.transportExplicitlyClosed = !1);
    }, vo);
  }
  get context() {
    return W.getLoggerContext(this.logger);
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
    let n = ((i = this.subscriber.topicMap.get(e)) == null ? void 0 : i[0]) || "";
    if (n)
      return n;
    let c;
    const h = /* @__PURE__ */ o((d) => {
      d.topic === e && (this.subscriber.off(nt.created, h), c());
    }, "o");
    return await Promise.all([new Promise((d) => {
      c = d, this.subscriber.on(nt.created, h);
    }), new Promise(async (d) => {
      n = await this.subscriber.subscribe(e, t), d();
    })]), n;
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
    this.transportExplicitlyClosed = !0, this.hasExperiencedNetworkDisruption && this.connected ? await Vt(this.provider.disconnect(), 1e3, "provider.disconnect()").catch(() => this.onProviderDisconnect()) : this.connected && await this.provider.disconnect();
  }
  async transportOpen(e) {
    if (this.transportExplicitlyClosed = !1, await this.confirmOnlineStateOrThrow(), !this.connectionAttemptInProgress) {
      e && e !== this.relayUrl && (this.relayUrl = e, await this.transportClose(), await this.createProvider()), this.connectionAttemptInProgress = !0;
      try {
        await Promise.all([new Promise((t) => {
          if (!this.initialized)
            return t();
          this.subscriber.once(nt.resubscribed, () => {
            t();
          });
        }), new Promise(async (t, i) => {
          try {
            await Vt(this.provider.connect(), 1e4, `Socket stalled when trying to connect to ${this.relayUrl}`);
          } catch (n) {
            i(n);
            return;
          }
          t();
        })]);
      } catch (t) {
        this.logger.error(t);
        const i = t;
        if (!this.isConnectionStalled(i.message))
          throw t;
        this.provider.events.emit(ut.disconnect);
      } finally {
        this.connectionAttemptInProgress = !1, this.hasExperiencedNetworkDisruption = !1;
      }
    }
  }
  async restartTransport(e) {
    await this.confirmOnlineStateOrThrow(), !this.connectionAttemptInProgress && (this.relayUrl = e || this.relayUrl, await this.transportClose(), await this.createProvider(), await this.transportOpen());
  }
  async confirmOnlineStateOrThrow() {
    if (!await xs())
      throw new Error("No internet connection detected. Please restart your network and try again.");
  }
  isConnectionStalled(e) {
    return this.staleConnectionErrors.some((t) => e.includes(t));
  }
  async createProvider() {
    this.provider.connection && this.unregisterProviderListeners();
    const e = await this.core.crypto.signJWT(this.relayUrl);
    this.provider = new fi(new di(Ca({ sdkVersion: bo, protocol: this.protocol, version: this.version, relayUrl: this.relayUrl, projectId: this.projectId, auth: e, useOnCloseEvent: !0, bundleId: this.bundleId }))), this.registerProviderListeners();
  }
  async recordMessageEvent(e) {
    const { topic: t, message: i } = e;
    await this.messages.set(t, i);
  }
  async shouldIgnoreMessageEvent(e) {
    const { topic: t, message: i } = e;
    if (!i || i.length === 0)
      return this.logger.debug(`Ignoring invalid/empty message: ${i}`), !0;
    if (!await this.subscriber.isSubscribed(t))
      return this.logger.debug(`Ignoring message for non-subscribed topic ${t}`), !0;
    const n = this.messages.has(t, i);
    return n && this.logger.debug(`Ignoring duplicate message: ${i}`), n;
  }
  async onProviderPayload(e) {
    if (this.logger.debug("Incoming Relay Payload"), this.logger.trace({ type: "payload", direction: "incoming", payload: e }), Bn(e)) {
      if (!e.method.endsWith(yo))
        return;
      const t = e.params, { topic: i, message: n, publishedAt: c } = t.data, h = { topic: i, message: n, publishedAt: c };
      this.logger.debug("Emitting Relayer Payload"), this.logger.trace(Zu({ type: "event", event: t.id }, h)), this.events.emit(t.id, h), await this.acknowledgePayload(e), await this.onMessageEvent(h);
    } else
      Pi(e) && this.events.emit(We.message_ack, e);
  }
  async onMessageEvent(e) {
    await this.shouldIgnoreMessageEvent(e) || (this.events.emit(We.message, e), await this.recordMessageEvent(e));
  }
  async acknowledgePayload(e) {
    const t = $n(e.id, !0);
    await this.provider.connection.send(t);
  }
  unregisterProviderListeners() {
    this.provider.off(ut.payload, this.onPayloadHandler), this.provider.off(ut.connect, this.onConnectHandler), this.provider.off(ut.disconnect, this.onDisconnectHandler), this.provider.off(ut.error, this.onProviderErrorHandler);
  }
  async registerEventListeners() {
    this.events.on(We.connection_stalled, () => {
      this.restartTransport().catch((t) => this.logger.error(t));
    });
    let e = await xs();
    Na(async (t) => {
      this.initialized && e !== t && (e = t, t ? await this.restartTransport().catch((i) => this.logger.error(i)) : (this.hasExperiencedNetworkDisruption = !0, await this.transportClose().catch((i) => this.logger.error(i))));
    });
  }
  onProviderDisconnect() {
    this.events.emit(We.disconnect), this.attemptToReconnect();
  }
  attemptToReconnect() {
    this.transportExplicitlyClosed || (this.logger.info("attemptToReconnect called. Connecting..."), setTimeout(async () => {
      await this.restartTransport().catch((e) => this.logger.error(e));
    }, V.toMiliseconds(mo)));
  }
  isInitialized() {
    if (!this.initialized) {
      const { message: e } = X("NOT_INITIALIZED", this.name);
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
};
o(ns, "Ut");
let Sr = ns;
var el = Object.defineProperty, on = Object.getOwnPropertySymbols, tl = Object.prototype.hasOwnProperty, rl = Object.prototype.propertyIsEnumerable, an = /* @__PURE__ */ o((r, e, t) => e in r ? el(r, e, { enumerable: !0, configurable: !0, writable: !0, value: t }) : r[e] = t, "Ft"), cn = /* @__PURE__ */ o((r, e) => {
  for (var t in e || (e = {}))
    tl.call(e, t) && an(r, t, e[t]);
  if (on)
    for (var t of on(e))
      rl.call(e, t) && an(r, t, e[t]);
  return r;
}, "$t");
const os = class os extends ni {
  constructor(e, t, i, n = mt, c = void 0) {
    super(e, t, i, n), this.core = e, this.logger = t, this.name = i, this.map = /* @__PURE__ */ new Map(), this.version = wo, this.cached = [], this.initialized = !1, this.storagePrefix = mt, this.init = async () => {
      this.initialized || (this.logger.trace("Initialized"), await this.restore(), this.cached.forEach((h) => {
        this.getKey && h !== null && !Zr(h) ? this.map.set(this.getKey(h), h) : Da(h) ? this.map.set(h.id, h) : Ma(h) && this.map.set(h.topic, h);
      }), this.cached = [], this.initialized = !0);
    }, this.set = async (h, d) => {
      this.isInitialized(), this.map.has(h) ? await this.update(h, d) : (this.logger.debug("Setting value"), this.logger.trace({ type: "method", method: "set", key: h, value: d }), this.map.set(h, d), await this.persist());
    }, this.get = (h) => (this.isInitialized(), this.logger.debug("Getting value"), this.logger.trace({ type: "method", method: "get", key: h }), this.getData(h)), this.getAll = (h) => (this.isInitialized(), h ? this.values.filter((d) => Object.keys(h).every((p) => _h(d[p], h[p]))) : this.values), this.update = async (h, d) => {
      this.isInitialized(), this.logger.debug("Updating value"), this.logger.trace({ type: "method", method: "update", key: h, update: d });
      const p = cn(cn({}, this.getData(h)), d);
      this.map.set(h, p), await this.persist();
    }, this.delete = async (h, d) => {
      this.isInitialized(), this.map.has(h) && (this.logger.debug("Deleting value"), this.logger.trace({ type: "method", method: "delete", key: h, reason: d }), this.map.delete(h), await this.persist());
    }, this.logger = W.generateChildLogger(t, this.name), this.storagePrefix = n, this.getKey = c;
  }
  get context() {
    return W.getLoggerContext(this.logger);
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
      const { message: i } = X("NO_MATCHING_KEY", `${this.name}: ${e}`);
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
        const { message: t } = X("RESTORE_WILL_OVERRIDE", this.name);
        throw this.logger.error(t), new Error(t);
      }
      this.cached = e, this.logger.debug(`Successfully Restored value for ${this.name}`), this.logger.trace({ type: "method", method: "restore", value: this.values });
    } catch (e) {
      this.logger.debug(`Failed to Restore value for ${this.name}`), this.logger.error(e);
    }
  }
  isInitialized() {
    if (!this.initialized) {
      const { message: e } = X("NOT_INITIALIZED", this.name);
      throw new Error(e);
    }
  }
};
o(os, "Mt");
let Tr = os;
const as = class as {
  constructor(e, t) {
    this.core = e, this.logger = t, this.name = So, this.version = To, this.events = new tc(), this.initialized = !1, this.storagePrefix = mt, this.ignoredPayloadTypes = [za], this.registeredMethods = [], this.init = async () => {
      this.initialized || (await this.pairings.init(), await this.cleanup(), this.registerRelayerEvents(), this.registerExpirerEvents(), this.initialized = !0, this.logger.trace("Initialized"));
    }, this.register = ({ methods: i }) => {
      this.isInitialized(), this.registeredMethods = [.../* @__PURE__ */ new Set([...this.registeredMethods, ...i])];
    }, this.create = async () => {
      this.isInitialized();
      const i = Jr(), n = await this.core.crypto.setSymKey(i), c = dr(V.FIVE_MINUTES), h = { protocol: fo }, d = { topic: n, expiry: c, relay: h, active: !1 }, p = Ua({ protocol: this.core.protocol, version: this.core.version, topic: n, symKey: i, relay: h });
      return await this.pairings.set(n, d), await this.core.relayer.subscribe(n), this.core.expirer.set(n, c), { topic: n, uri: p };
    }, this.pair = async (i) => {
      this.isInitialized(), this.isValidPair(i);
      const { topic: n, symKey: c, relay: h } = Is(i.uri);
      let d;
      if (this.pairings.keys.includes(n) && (d = this.pairings.get(n), d.active))
        throw new Error(`Pairing already exists: ${n}. Please try again with a new connection URI.`);
      const p = dr(V.FIVE_MINUTES), u = { topic: n, relay: h, expiry: p, active: !1 };
      return await this.pairings.set(n, u), this.core.expirer.set(n, p), i.activatePairing && await this.activate({ topic: n }), this.events.emit(kt.create, u), this.core.crypto.keychain.has(n) || (await this.core.crypto.setSymKey(c, n), await this.core.relayer.subscribe(n, { relay: h })), u;
    }, this.activate = async ({ topic: i }) => {
      this.isInitialized();
      const n = dr(V.THIRTY_DAYS);
      await this.pairings.update(i, { active: !0, expiry: n }), this.core.expirer.set(i, n);
    }, this.ping = async (i) => {
      this.isInitialized(), await this.isValidPing(i);
      const { topic: n } = i;
      if (this.pairings.keys.includes(n)) {
        const c = await this.sendRequest(n, "wc_pairingPing", {}), { done: h, resolve: d, reject: p } = $a();
        this.events.once(jr("pairing_ping", c), ({ error: u }) => {
          u ? p(u) : d();
        }), await h();
      }
    }, this.updateExpiry = async ({ topic: i, expiry: n }) => {
      this.isInitialized(), await this.pairings.update(i, { expiry: n });
    }, this.updateMetadata = async ({ topic: i, metadata: n }) => {
      this.isInitialized(), await this.pairings.update(i, { peerMetadata: n });
    }, this.getPairings = () => (this.isInitialized(), this.pairings.values), this.disconnect = async (i) => {
      this.isInitialized(), await this.isValidDisconnect(i);
      const { topic: n } = i;
      this.pairings.keys.includes(n) && (await this.sendRequest(n, "wc_pairingDelete", Ht("USER_DISCONNECTED")), await this.deletePairing(n));
    }, this.sendRequest = async (i, n, c) => {
      const h = Ai(n, c), d = await this.core.crypto.encode(i, h), p = Ft[n].req;
      return this.core.history.set(i, h), this.core.relayer.publish(i, d, p), h.id;
    }, this.sendResult = async (i, n, c) => {
      const h = $n(i, c), d = await this.core.crypto.encode(n, h), p = await this.core.history.get(n, i), u = Ft[p.request.method].res;
      await this.core.relayer.publish(n, d, u), await this.core.history.resolve(h);
    }, this.sendError = async (i, n, c) => {
      const h = jn(i, c), d = await this.core.crypto.encode(n, h), p = await this.core.history.get(n, i), u = Ft[p.request.method] ? Ft[p.request.method].res : Ft.unregistered_method.res;
      await this.core.relayer.publish(n, d, u), await this.core.history.resolve(h);
    }, this.deletePairing = async (i, n) => {
      await this.core.relayer.unsubscribe(i), await Promise.all([this.pairings.delete(i, Ht("USER_DISCONNECTED")), this.core.crypto.deleteSymKey(i), n ? Promise.resolve() : this.core.expirer.del(i)]);
    }, this.cleanup = async () => {
      const i = this.pairings.getAll().filter((n) => Ss(n.expiry));
      await Promise.all(i.map((n) => this.deletePairing(n.topic)));
    }, this.onRelayEventRequest = (i) => {
      const { topic: n, payload: c } = i;
      switch (c.method) {
        case "wc_pairingPing":
          return this.onPairingPingRequest(n, c);
        case "wc_pairingDelete":
          return this.onPairingDeleteRequest(n, c);
        default:
          return this.onUnknownRpcMethodRequest(n, c);
      }
    }, this.onRelayEventResponse = async (i) => {
      const { topic: n, payload: c } = i, h = (await this.core.history.get(n, c.id)).request.method;
      switch (h) {
        case "wc_pairingPing":
          return this.onPairingPingResponse(n, c);
        default:
          return this.onUnknownRpcMethodResponse(h);
      }
    }, this.onPairingPingRequest = async (i, n) => {
      const { id: c } = n;
      try {
        this.isValidPing({ topic: i }), await this.sendResult(c, i, !0), this.events.emit(kt.ping, { id: c, topic: i });
      } catch (h) {
        await this.sendError(c, i, h), this.logger.error(h);
      }
    }, this.onPairingPingResponse = (i, n) => {
      const { id: c } = n;
      setTimeout(() => {
        Hn(n) ? this.events.emit(jr("pairing_ping", c), {}) : Mr(n) && this.events.emit(jr("pairing_ping", c), { error: n.error });
      }, 500);
    }, this.onPairingDeleteRequest = async (i, n) => {
      const { id: c } = n;
      try {
        this.isValidDisconnect({ topic: i }), await this.deletePairing(i), this.events.emit(kt.delete, { id: c, topic: i });
      } catch (h) {
        await this.sendError(c, i, h), this.logger.error(h);
      }
    }, this.onUnknownRpcMethodRequest = async (i, n) => {
      const { id: c, method: h } = n;
      try {
        if (this.registeredMethods.includes(h))
          return;
        const d = Ht("WC_METHOD_UNSUPPORTED", h);
        await this.sendError(c, i, d), this.logger.error(d);
      } catch (d) {
        await this.sendError(c, i, d), this.logger.error(d);
      }
    }, this.onUnknownRpcMethodResponse = (i) => {
      this.registeredMethods.includes(i) || this.logger.error(Ht("WC_METHOD_UNSUPPORTED", i));
    }, this.isValidPair = (i) => {
      var n;
      if (!Kr(i)) {
        const { message: h } = X("MISSING_OR_INVALID", `pair() params: ${i}`);
        throw new Error(h);
      }
      if (!ja(i.uri)) {
        const { message: h } = X("MISSING_OR_INVALID", `pair() uri: ${i.uri}`);
        throw new Error(h);
      }
      const c = Is(i.uri);
      if (!((n = c == null ? void 0 : c.relay) != null && n.protocol)) {
        const { message: h } = X("MISSING_OR_INVALID", "pair() uri#relay-protocol");
        throw new Error(h);
      }
      if (!(c != null && c.symKey)) {
        const { message: h } = X("MISSING_OR_INVALID", "pair() uri#symKey");
        throw new Error(h);
      }
    }, this.isValidPing = async (i) => {
      if (!Kr(i)) {
        const { message: c } = X("MISSING_OR_INVALID", `ping() params: ${i}`);
        throw new Error(c);
      }
      const { topic: n } = i;
      await this.isValidPairingTopic(n);
    }, this.isValidDisconnect = async (i) => {
      if (!Kr(i)) {
        const { message: c } = X("MISSING_OR_INVALID", `disconnect() params: ${i}`);
        throw new Error(c);
      }
      const { topic: n } = i;
      await this.isValidPairingTopic(n);
    }, this.isValidPairingTopic = async (i) => {
      if (!Ka(i, !1)) {
        const { message: n } = X("MISSING_OR_INVALID", `pairing topic should be a string: ${i}`);
        throw new Error(n);
      }
      if (!this.pairings.keys.includes(i)) {
        const { message: n } = X("NO_MATCHING_KEY", `pairing topic doesn't exist: ${i}`);
        throw new Error(n);
      }
      if (Ss(this.pairings.get(i).expiry)) {
        await this.deletePairing(i);
        const { message: n } = X("EXPIRED", `pairing topic: ${i}`);
        throw new Error(n);
      }
    }, this.core = e, this.logger = W.generateChildLogger(t, this.name), this.pairings = new Tr(this.core, this.logger, this.name, this.storagePrefix);
  }
  get context() {
    return W.getLoggerContext(this.logger);
  }
  isInitialized() {
    if (!this.initialized) {
      const { message: e } = X("NOT_INITIALIZED", this.name);
      throw new Error(e);
    }
  }
  registerRelayerEvents() {
    this.core.relayer.on(We.message, async (e) => {
      const { topic: t, message: i } = e;
      if (!this.pairings.keys.includes(t) || this.ignoredPayloadTypes.includes(this.core.crypto.getPayloadType(i)))
        return;
      const n = await this.core.crypto.decode(t, i);
      try {
        Bn(n) ? (this.core.history.set(t, n), this.onRelayEventRequest({ topic: t, payload: n })) : Pi(n) && (await this.core.history.resolve(n), await this.onRelayEventResponse({ topic: t, payload: n }), this.core.history.delete(t, n.id));
      } catch (c) {
        this.logger.error(c);
      }
    });
  }
  registerExpirerEvents() {
    this.core.expirer.on(st.expired, async (e) => {
      const { topic: t } = Ba(e.target);
      t && this.pairings.keys.includes(t) && (await this.deletePairing(t, !0), this.events.emit(kt.expire, { topic: t }));
    });
  }
};
o(as, "kt");
let Or = as;
const cs = class cs extends jc {
  constructor(e, t) {
    super(e, t), this.core = e, this.logger = t, this.records = /* @__PURE__ */ new Map(), this.events = new ft.EventEmitter(), this.name = Oo, this.version = Ro, this.cached = [], this.initialized = !1, this.storagePrefix = mt, this.init = async () => {
      this.initialized || (this.logger.trace("Initialized"), await this.restore(), this.cached.forEach((i) => this.records.set(i.id, i)), this.cached = [], this.registerEventListeners(), this.initialized = !0);
    }, this.set = (i, n, c) => {
      if (this.isInitialized(), this.logger.debug("Setting JSON-RPC request history record"), this.logger.trace({ type: "method", method: "set", topic: i, request: n, chainId: c }), this.records.has(n.id))
        return;
      const h = { id: n.id, topic: i, request: { method: n.method, params: n.params || null }, chainId: c, expiry: dr(V.THIRTY_DAYS) };
      this.records.set(h.id, h), this.events.emit(ct.created, h);
    }, this.resolve = async (i) => {
      if (this.isInitialized(), this.logger.debug("Updating JSON-RPC response history record"), this.logger.trace({ type: "method", method: "update", response: i }), !this.records.has(i.id))
        return;
      const n = await this.getRecord(i.id);
      typeof n.response > "u" && (n.response = Mr(i) ? { error: i.error } : { result: i.result }, this.records.set(n.id, n), this.events.emit(ct.updated, n));
    }, this.get = async (i, n) => (this.isInitialized(), this.logger.debug("Getting record"), this.logger.trace({ type: "method", method: "get", topic: i, id: n }), await this.getRecord(n)), this.delete = (i, n) => {
      this.isInitialized(), this.logger.debug("Deleting record"), this.logger.trace({ type: "method", method: "delete", id: n }), this.values.forEach((c) => {
        if (c.topic === i) {
          if (typeof n < "u" && c.id !== n)
            return;
          this.records.delete(c.id), this.events.emit(ct.deleted, c);
        }
      });
    }, this.exists = async (i, n) => (this.isInitialized(), this.records.has(n) ? (await this.getRecord(n)).topic === i : !1), this.on = (i, n) => {
      this.events.on(i, n);
    }, this.once = (i, n) => {
      this.events.once(i, n);
    }, this.off = (i, n) => {
      this.events.off(i, n);
    }, this.removeListener = (i, n) => {
      this.events.removeListener(i, n);
    }, this.logger = W.generateChildLogger(t, this.name);
  }
  get context() {
    return W.getLoggerContext(this.logger);
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
      const i = { topic: t.topic, request: Ai(t.request.method, t.request.params, t.id), chainId: t.chainId };
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
      const { message: i } = X("NO_MATCHING_KEY", `${this.name}: ${e}`);
      throw new Error(i);
    }
    return t;
  }
  async persist() {
    await this.setJsonRpcRecords(this.values), this.events.emit(ct.sync);
  }
  async restore() {
    try {
      const e = await this.getJsonRpcRecords();
      if (typeof e > "u" || !e.length)
        return;
      if (this.records.size) {
        const { message: t } = X("RESTORE_WILL_OVERRIDE", this.name);
        throw this.logger.error(t), new Error(t);
      }
      this.cached = e, this.logger.debug(`Successfully Restored records for ${this.name}`), this.logger.trace({ type: "method", method: "restore", records: this.values });
    } catch (e) {
      this.logger.debug(`Failed to Restore records for ${this.name}`), this.logger.error(e);
    }
  }
  registerEventListeners() {
    this.events.on(ct.created, (e) => {
      const t = ct.created;
      this.logger.info(`Emitting ${t}`), this.logger.debug({ type: "event", event: t, record: e }), this.persist();
    }), this.events.on(ct.updated, (e) => {
      const t = ct.updated;
      this.logger.info(`Emitting ${t}`), this.logger.debug({ type: "event", event: t, record: e }), this.persist();
    }), this.events.on(ct.deleted, (e) => {
      const t = ct.deleted;
      this.logger.info(`Emitting ${t}`), this.logger.debug({ type: "event", event: t, record: e }), this.persist();
    }), this.core.heartbeat.on(Mt.HEARTBEAT_EVENTS.pulse, () => {
      this.cleanup();
    });
  }
  cleanup() {
    try {
      this.records.forEach((e) => {
        V.toMiliseconds(e.expiry || 0) - Date.now() <= 0 && (this.logger.info(`Deleting expired history log: ${e.id}`), this.delete(e.topic, e.id));
      });
    } catch (e) {
      this.logger.warn(e);
    }
  }
  isInitialized() {
    if (!this.initialized) {
      const { message: e } = X("NOT_INITIALIZED", this.name);
      throw new Error(e);
    }
  }
};
o(cs, "Kt");
let Rr = cs;
const hs = class hs extends ai {
  constructor(e, t) {
    super(e, t), this.core = e, this.logger = t, this.expirations = /* @__PURE__ */ new Map(), this.events = new ft.EventEmitter(), this.name = Lo, this.version = Ao, this.cached = [], this.initialized = !1, this.storagePrefix = mt, this.init = async () => {
      this.initialized || (this.logger.trace("Initialized"), await this.restore(), this.cached.forEach((i) => this.expirations.set(i.target, i)), this.cached = [], this.registerEventListeners(), this.initialized = !0);
    }, this.has = (i) => {
      try {
        const n = this.formatTarget(i);
        return typeof this.getExpiration(n) < "u";
      } catch {
        return !1;
      }
    }, this.set = (i, n) => {
      this.isInitialized();
      const c = this.formatTarget(i), h = { target: c, expiry: n };
      this.expirations.set(c, h), this.checkExpiry(c, h), this.events.emit(st.created, { target: c, expiration: h });
    }, this.get = (i) => {
      this.isInitialized();
      const n = this.formatTarget(i);
      return this.getExpiration(n);
    }, this.del = (i) => {
      if (this.isInitialized(), this.has(i)) {
        const n = this.formatTarget(i), c = this.getExpiration(n);
        this.expirations.delete(n), this.events.emit(st.deleted, { target: n, expiration: c });
      }
    }, this.on = (i, n) => {
      this.events.on(i, n);
    }, this.once = (i, n) => {
      this.events.once(i, n);
    }, this.off = (i, n) => {
      this.events.off(i, n);
    }, this.removeListener = (i, n) => {
      this.events.removeListener(i, n);
    }, this.logger = W.generateChildLogger(t, this.name);
  }
  get context() {
    return W.getLoggerContext(this.logger);
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
      return Ha(e);
    if (typeof e == "number")
      return ka(e);
    const { message: t } = X("UNKNOWN_TYPE", `Target type: ${typeof e}`);
    throw new Error(t);
  }
  async setExpirations(e) {
    await this.core.storage.setItem(this.storageKey, e);
  }
  async getExpirations() {
    return await this.core.storage.getItem(this.storageKey);
  }
  async persist() {
    await this.setExpirations(this.values), this.events.emit(st.sync);
  }
  async restore() {
    try {
      const e = await this.getExpirations();
      if (typeof e > "u" || !e.length)
        return;
      if (this.expirations.size) {
        const { message: t } = X("RESTORE_WILL_OVERRIDE", this.name);
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
      const { message: i } = X("NO_MATCHING_KEY", `${this.name}: ${e}`);
      throw this.logger.error(i), new Error(i);
    }
    return t;
  }
  checkExpiry(e, t) {
    const { expiry: i } = t;
    V.toMiliseconds(i) - Date.now() <= 0 && this.expire(e, t);
  }
  expire(e, t) {
    this.expirations.delete(e), this.events.emit(st.expired, { target: e, expiration: t });
  }
  checkExpirations() {
    this.core.relayer.connected && this.expirations.forEach((e, t) => this.checkExpiry(t, e));
  }
  registerEventListeners() {
    this.core.heartbeat.on(Mt.HEARTBEAT_EVENTS.pulse, () => this.checkExpirations()), this.events.on(st.created, (e) => {
      const t = st.created;
      this.logger.info(`Emitting ${t}`), this.logger.debug({ type: "event", event: t, data: e }), this.persist();
    }), this.events.on(st.expired, (e) => {
      const t = st.expired;
      this.logger.info(`Emitting ${t}`), this.logger.debug({ type: "event", event: t, data: e }), this.persist();
    }), this.events.on(st.deleted, (e) => {
      const t = st.deleted;
      this.logger.info(`Emitting ${t}`), this.logger.debug({ type: "event", event: t, data: e }), this.persist();
    });
  }
  isInitialized() {
    if (!this.initialized) {
      const { message: e } = X("NOT_INITIALIZED", this.name);
      throw new Error(e);
    }
  }
};
o(hs, "Bt");
let Lr = hs;
const us = class us extends ci {
  constructor(e, t) {
    super(e, t), this.projectId = e, this.logger = t, this.name = mr, this.initialized = !1, this.queue = [], this.verifyDisabled = !1, this.init = async (i) => {
      if (this.verifyDisabled || Ga() || !Va())
        return;
      const n = this.getVerifyUrl(i == null ? void 0 : i.verifyUrl);
      this.verifyUrl !== n && this.removeIframe(), this.verifyUrl = n;
      try {
        await this.createIframe();
      } catch (c) {
        this.logger.info(`Verify iframe failed to load: ${this.verifyUrl}`), this.logger.info(c);
      }
      if (!this.initialized) {
        this.removeIframe(), this.verifyUrl = wr;
        try {
          await this.createIframe();
        } catch (c) {
          this.logger.info(`Verify iframe failed to load: ${this.verifyUrl}`), this.logger.info(c), this.verifyDisabled = !0;
        }
      }
    }, this.register = async (i) => {
      this.initialized ? this.sendPost(i.attestationId) : (this.addToQueue(i.attestationId), await this.init());
    }, this.resolve = async (i) => {
      if (this.isDevEnv)
        return "";
      const n = this.getVerifyUrl(i == null ? void 0 : i.verifyUrl);
      let c;
      try {
        c = await this.fetchAttestation(i.attestationId, n);
      } catch (h) {
        this.logger.info(`failed to resolve attestation: ${i.attestationId} from url: ${n}`), this.logger.info(h), c = await this.fetchAttestation(i.attestationId, wr);
      }
      return c;
    }, this.fetchAttestation = async (i, n) => {
      this.logger.info(`resolving attestation: ${i} from url: ${n}`);
      const c = this.startAbortTimer(V.ONE_SECOND * 2), h = await fetch(`${n}/attestation/${i}`, { signal: this.abortController.signal });
      return clearTimeout(c), h.status === 200 ? await h.json() : void 0;
    }, this.addToQueue = (i) => {
      this.queue.push(i);
    }, this.processQueue = () => {
      this.queue.length !== 0 && (this.queue.forEach((i) => this.sendPost(i)), this.queue = []);
    }, this.sendPost = (i) => {
      var n;
      try {
        if (!this.iframe)
          return;
        (n = this.iframe.contentWindow) == null || n.postMessage(i, "*"), this.logger.info(`postMessage sent: ${i} ${this.verifyUrl}`);
      } catch {
      }
    }, this.createIframe = async () => {
      let i;
      const n = /* @__PURE__ */ o((c) => {
        c.data === "verify_ready" && (this.initialized = !0, this.processQueue(), window.removeEventListener("message", n), i());
      }, "s");
      await Promise.race([new Promise((c) => {
        if (document.getElementById(mr))
          return c();
        window.addEventListener("message", n);
        const h = document.createElement("iframe");
        h.id = mr, h.src = `${this.verifyUrl}/${this.projectId}`, h.style.display = "none", document.body.append(h), this.iframe = h, i = c;
      }), new Promise((c, h) => setTimeout(() => {
        window.removeEventListener("message", n), h("verify iframe load timeout");
      }, V.toMiliseconds(V.FIVE_SECONDS)))]);
    }, this.removeIframe = () => {
      this.iframe && (this.iframe.remove(), this.iframe = void 0, this.initialized = !1);
    }, this.getVerifyUrl = (i) => {
      let n = i || Ct;
      return Po.includes(n) || (this.logger.info(`verify url: ${n}, not included in trusted list, assigning default: ${Ct}`), n = Ct), n;
    }, this.logger = W.generateChildLogger(t, this.name), this.verifyUrl = Ct, this.abortController = new AbortController(), this.isDevEnv = qa() && {}.IS_VITEST;
  }
  get context() {
    return W.getLoggerContext(this.logger);
  }
  startAbortTimer(e) {
    return this.abortController = new AbortController(), setTimeout(() => this.abortController.abort(), V.toMiliseconds(e));
  }
};
o(us, "Vt");
let Ar = us;
var il = Object.defineProperty, hn = Object.getOwnPropertySymbols, sl = Object.prototype.hasOwnProperty, nl = Object.prototype.propertyIsEnumerable, un = /* @__PURE__ */ o((r, e, t) => e in r ? il(r, e, { enumerable: !0, configurable: !0, writable: !0, value: t }) : r[e] = t, "jt"), ln = /* @__PURE__ */ o((r, e) => {
  for (var t in e || (e = {}))
    sl.call(e, t) && un(r, t, e[t]);
  if (hn)
    for (var t of hn(e))
      nl.call(e, t) && un(r, t, e[t]);
  return r;
}, "Gt");
const Fr = class Fr extends ii {
  constructor(e) {
    super(e), this.protocol = Fi, this.version = to, this.name = Ur, this.events = new ft.EventEmitter(), this.initialized = !1, this.on = (i, n) => this.events.on(i, n), this.once = (i, n) => this.events.once(i, n), this.off = (i, n) => this.events.off(i, n), this.removeListener = (i, n) => this.events.removeListener(i, n), this.projectId = e == null ? void 0 : e.projectId, this.relayUrl = (e == null ? void 0 : e.relayUrl) || Ci, this.customStoragePrefix = e != null && e.customStoragePrefix ? `:${e.customStoragePrefix}` : "";
    const t = typeof (e == null ? void 0 : e.logger) < "u" && typeof (e == null ? void 0 : e.logger) != "string" ? e.logger : W.pino(W.getDefaultLoggerOptions({ level: (e == null ? void 0 : e.logger) || ro.logger }));
    this.logger = W.generateChildLogger(t, this.name), this.heartbeat = new Mt.HeartBeat(), this.crypto = new _r(this, this.logger, e == null ? void 0 : e.keychain), this.history = new Rr(this, this.logger), this.expirer = new Lr(this, this.logger), this.storage = e != null && e.storage ? e.storage : new Pc(ln(ln({}, io), e == null ? void 0 : e.storageOptions)), this.relayer = new Sr({ core: this, logger: this.logger, relayUrl: this.relayUrl, projectId: this.projectId }), this.pairing = new Or(this, this.logger), this.verify = new Ar(this.projectId || "", this.logger);
  }
  static async init(e) {
    const t = new Fr(e);
    await t.initialize();
    const i = await t.crypto.getClientId();
    return await t.storage.setItem(Eo, i), t;
  }
  get context() {
    return W.getLoggerContext(this.logger);
  }
  async start() {
    this.initialized || await this.initialize();
  }
  async initialize() {
    this.logger.trace("Initialized");
    try {
      await this.crypto.init(), await this.history.init(), await this.expirer.init(), await this.relayer.init(), await this.heartbeat.init(), await this.pairing.init(), this.initialized = !0, this.logger.info("Core Initialization Success");
    } catch (e) {
      throw this.logger.warn(`Core Initialization Failure at epoch ${Date.now()}`, e), this.logger.error(e.message), e;
    }
  }
};
o(Fr, "te");
let Pr = Fr;
const ol = Pr, ll = /* @__PURE__ */ Object.freeze(/* @__PURE__ */ Object.defineProperty({
  __proto__: null,
  CORE_CONTEXT: Ur,
  CORE_DEFAULT: ro,
  CORE_PROTOCOL: Fi,
  CORE_STORAGE_OPTIONS: io,
  CORE_STORAGE_PREFIX: mt,
  CORE_VERSION: to,
  CRYPTO_CLIENT_SEED: _i,
  CRYPTO_CONTEXT: so,
  CRYPTO_JWT_TTL: no,
  Core: ol,
  Crypto: _r,
  EXPIRER_CONTEXT: Lo,
  EXPIRER_DEFAULT_TTL: ku,
  EXPIRER_EVENTS: st,
  EXPIRER_STORAGE_VERSION: Ao,
  Expirer: Lr,
  HISTORY_CONTEXT: Oo,
  HISTORY_EVENTS: ct,
  HISTORY_STORAGE_VERSION: Ro,
  JsonRpcHistory: Rr,
  KEYCHAIN_CONTEXT: oo,
  KEYCHAIN_STORAGE_VERSION: ao,
  KeyChain: Er,
  MESSAGES_CONTEXT: co,
  MESSAGES_STORAGE_VERSION: ho,
  MessageTracker: xr,
  PAIRING_CONTEXT: So,
  PAIRING_DEFAULT_TTL: Hu,
  PAIRING_EVENTS: kt,
  PAIRING_RPC_OPTS: Ft,
  PAIRING_STORAGE_VERSION: To,
  PENDING_SUB_RESOLUTION_TIMEOUT: Io,
  PUBLISHER_CONTEXT: lo,
  PUBLISHER_DEFAULT_TTL: uo,
  Pairing: Or,
  RELAYER_CONTEXT: po,
  RELAYER_DEFAULT_LOGGER: go,
  RELAYER_DEFAULT_PROTOCOL: fo,
  RELAYER_DEFAULT_RELAY_URL: Ci,
  RELAYER_EVENTS: We,
  RELAYER_FAILOVER_RELAY_URL: xi,
  RELAYER_PROVIDER_EVENTS: ut,
  RELAYER_RECONNECT_TIMEOUT: mo,
  RELAYER_SDK_VERSION: bo,
  RELAYER_STORAGE_OPTIONS: Ku,
  RELAYER_SUBSCRIBER_SUFFIX: yo,
  RELAYER_TRANSPORT_CUTOFF: vo,
  Relayer: Sr,
  STORE_STORAGE_VERSION: wo,
  SUBSCRIBER_CONTEXT: _o,
  SUBSCRIBER_DEFAULT_TTL: Bu,
  SUBSCRIBER_EVENTS: nt,
  SUBSCRIBER_STORAGE_VERSION: xo,
  Store: Tr,
  Subscriber: Ir,
  TRUSTED_VERIFY_URLS: Po,
  VERIFY_CONTEXT: mr,
  VERIFY_FALLBACK_SERVER: wr,
  VERIFY_SERVER: Ct,
  Verify: Ar,
  WALLETCONNECT_CLIENT_ID: Eo,
  default: Pr
}, Symbol.toStringTag, { value: "Module" }));
export {
  Ct as $,
  We as D,
  Tr as M,
  ol as N,
  ul as S,
  kt as V,
  tc as Y,
  Mr as a,
  Bn as b,
  W as c,
  Pi as d,
  ft as e,
  jn as f,
  Ai as g,
  $n as h,
  Hn as i,
  hl as j,
  fo as k,
  ll as l,
  zn as p,
  st as v
};
