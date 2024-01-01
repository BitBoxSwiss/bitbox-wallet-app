var co = Object.defineProperty;
var a = (i, t) => co(i, "name", { value: t, configurable: !0 });
import { e as os, c as Mt, N as as, M as Jt, f as fs, i as xt, a as _t, D as bi, b as hs, d as us, V as cs, g as Ar, h as ls, j as lo, S as po, Y as vo, k as go, $ as mo, v as yo, p as wo } from "./index.es.js";
import { c as ds, g as Dr, r as bo, a as xo, K as yn, D as ps, N as B, b as X, k as _o, X as vs, s as Mo, _ as gs, Q as So, d as or, y as De, p as Vt, B as ii, j as Ao, U as Kt, e as Eo, h as Io, f as Ro, L as ni, m as Ht, t as xr, H as Xe, w as ar, x as No, i as Fo, u as si, l as wn, n as fr, q as Po, o as qo, v as Oo, z as bn, A as Co, Y as To, G as $o, W as Lo, J as Do, C as Uo, F as ko } from "./index.js";
var ms = { exports: {} };
/**
 * [js-sha3]{@link https://github.com/emn178/js-sha3}
 *
 * @version 0.8.0
 * @author Chen, Yi-Cyuan [emn178@gmail.com]
 * @copyright Chen, Yi-Cyuan 2015-2018
 * @license MIT
 */
(function(i) {
  (function() {
    var t = "input is invalid type", e = "finalize already called", r = typeof window == "object", n = r ? window : {};
    n.JS_SHA3_NO_WINDOW && (r = !1);
    var s = !r && typeof self == "object", c = !n.JS_SHA3_NO_NODE_JS && typeof process == "object" && process.versions && process.versions.node;
    c ? n = ds : s && (n = self);
    var l = !n.JS_SHA3_NO_COMMON_JS && !0 && i.exports, p = !n.JS_SHA3_NO_ARRAY_BUFFER && typeof ArrayBuffer < "u", y = "0123456789abcdef".split(""), x = [31, 7936, 2031616, 520093696], _ = [4, 1024, 262144, 67108864], E = [1, 256, 65536, 16777216], R = [6, 1536, 393216, 100663296], A = [0, 8, 16, 24], P = [
      1,
      0,
      32898,
      0,
      32906,
      2147483648,
      2147516416,
      2147483648,
      32907,
      0,
      2147483649,
      0,
      2147516545,
      2147483648,
      32777,
      2147483648,
      138,
      0,
      136,
      0,
      2147516425,
      0,
      2147483658,
      0,
      2147516555,
      0,
      139,
      2147483648,
      32905,
      2147483648,
      32771,
      2147483648,
      32770,
      2147483648,
      128,
      2147483648,
      32778,
      0,
      2147483658,
      2147483648,
      2147516545,
      2147483648,
      32896,
      2147483648,
      2147483649,
      0,
      2147516424,
      2147483648
    ], L = [224, 256, 384, 512], $ = [128, 256], j = ["hex", "buffer", "arrayBuffer", "array", "digest"], J = {
      128: 168,
      256: 136
    };
    (n.JS_SHA3_NO_NODE_JS || !Array.isArray) && (Array.isArray = function(u) {
      return Object.prototype.toString.call(u) === "[object Array]";
    }), p && (n.JS_SHA3_NO_ARRAY_BUFFER_IS_VIEW || !ArrayBuffer.isView) && (ArrayBuffer.isView = function(u) {
      return typeof u == "object" && u.buffer && u.buffer.constructor === ArrayBuffer;
    });
    for (var V = /* @__PURE__ */ a(function(u, I, N) {
      return function(F) {
        return new f(u, I, u).update(F)[N]();
      };
    }, "createOutputMethod"), K = /* @__PURE__ */ a(function(u, I, N) {
      return function(F, q) {
        return new f(u, I, q).update(F)[N]();
      };
    }, "createShakeOutputMethod"), G = /* @__PURE__ */ a(function(u, I, N) {
      return function(F, q, D, C) {
        return o["cshake" + u].update(F, q, D, C)[N]();
      };
    }, "createCshakeOutputMethod"), W = /* @__PURE__ */ a(function(u, I, N) {
      return function(F, q, D, C) {
        return o["kmac" + u].update(F, q, D, C)[N]();
      };
    }, "createKmacOutputMethod"), Z = /* @__PURE__ */ a(function(u, I, N, F) {
      for (var q = 0; q < j.length; ++q) {
        var D = j[q];
        u[D] = I(N, F, D);
      }
      return u;
    }, "createOutputMethods"), $e = /* @__PURE__ */ a(function(u, I) {
      var N = V(u, I, "hex");
      return N.create = function() {
        return new f(u, I, u);
      }, N.update = function(F) {
        return N.create().update(F);
      }, Z(N, V, u, I);
    }, "createMethod"), pt = /* @__PURE__ */ a(function(u, I) {
      var N = K(u, I, "hex");
      return N.create = function(F) {
        return new f(u, I, F);
      }, N.update = function(F, q) {
        return N.create(q).update(F);
      }, Z(N, K, u, I);
    }, "createShakeMethod"), Q = /* @__PURE__ */ a(function(u, I) {
      var N = J[u], F = G(u, I, "hex");
      return F.create = function(q, D, C) {
        return !D && !C ? o["shake" + u].create(q) : new f(u, I, q).bytepad([D, C], N);
      }, F.update = function(q, D, C, O) {
        return F.create(D, C, O).update(q);
      }, Z(F, G, u, I);
    }, "createCshakeMethod"), Ge = /* @__PURE__ */ a(function(u, I) {
      var N = J[u], F = W(u, I, "hex");
      return F.create = function(q, D, C) {
        return new m(u, I, D).bytepad(["KMAC", C], N).bytepad([q], N);
      }, F.update = function(q, D, C, O) {
        return F.create(q, C, O).update(D);
      }, Z(F, W, u, I);
    }, "createKmacMethod"), b = [
      { name: "keccak", padding: E, bits: L, createMethod: $e },
      { name: "sha3", padding: R, bits: L, createMethod: $e },
      { name: "shake", padding: x, bits: $, createMethod: pt },
      { name: "cshake", padding: _, bits: $, createMethod: Q },
      { name: "kmac", padding: _, bits: $, createMethod: Ge }
    ], o = {}, h = [], d = 0; d < b.length; ++d)
      for (var g = b[d], w = g.bits, M = 0; M < w.length; ++M) {
        var S = g.name + "_" + w[M];
        if (h.push(S), o[S] = g.createMethod(w[M], g.padding), g.name !== "sha3") {
          var v = g.name + w[M];
          h.push(v), o[v] = o[S];
        }
      }
    function f(u, I, N) {
      this.blocks = [], this.s = [], this.padding = I, this.outputBits = N, this.reset = !0, this.finalized = !1, this.block = 0, this.start = 0, this.blockCount = 1600 - (u << 1) >> 5, this.byteCount = this.blockCount << 2, this.outputBlocks = N >> 5, this.extraBytes = (N & 31) >> 3;
      for (var F = 0; F < 50; ++F)
        this.s[F] = 0;
    }
    a(f, "Keccak"), f.prototype.update = function(u) {
      if (this.finalized)
        throw new Error(e);
      var I, N = typeof u;
      if (N !== "string") {
        if (N === "object") {
          if (u === null)
            throw new Error(t);
          if (p && u.constructor === ArrayBuffer)
            u = new Uint8Array(u);
          else if (!Array.isArray(u) && (!p || !ArrayBuffer.isView(u)))
            throw new Error(t);
        } else
          throw new Error(t);
        I = !0;
      }
      for (var F = this.blocks, q = this.byteCount, D = u.length, C = this.blockCount, O = 0, qe = this.s, T, k; O < D; ) {
        if (this.reset)
          for (this.reset = !1, F[0] = this.block, T = 1; T < C + 1; ++T)
            F[T] = 0;
        if (I)
          for (T = this.start; O < D && T < q; ++O)
            F[T >> 2] |= u[O] << A[T++ & 3];
        else
          for (T = this.start; O < D && T < q; ++O)
            k = u.charCodeAt(O), k < 128 ? F[T >> 2] |= k << A[T++ & 3] : k < 2048 ? (F[T >> 2] |= (192 | k >> 6) << A[T++ & 3], F[T >> 2] |= (128 | k & 63) << A[T++ & 3]) : k < 55296 || k >= 57344 ? (F[T >> 2] |= (224 | k >> 12) << A[T++ & 3], F[T >> 2] |= (128 | k >> 6 & 63) << A[T++ & 3], F[T >> 2] |= (128 | k & 63) << A[T++ & 3]) : (k = 65536 + ((k & 1023) << 10 | u.charCodeAt(++O) & 1023), F[T >> 2] |= (240 | k >> 18) << A[T++ & 3], F[T >> 2] |= (128 | k >> 12 & 63) << A[T++ & 3], F[T >> 2] |= (128 | k >> 6 & 63) << A[T++ & 3], F[T >> 2] |= (128 | k & 63) << A[T++ & 3]);
        if (this.lastByteIndex = T, T >= q) {
          for (this.start = T - q, this.block = F[C], T = 0; T < C; ++T)
            qe[T] ^= F[T];
          U(qe), this.reset = !0;
        } else
          this.start = T;
      }
      return this;
    }, f.prototype.encode = function(u, I) {
      var N = u & 255, F = 1, q = [N];
      for (u = u >> 8, N = u & 255; N > 0; )
        q.unshift(N), u = u >> 8, N = u & 255, ++F;
      return I ? q.push(F) : q.unshift(F), this.update(q), q.length;
    }, f.prototype.encodeString = function(u) {
      var I, N = typeof u;
      if (N !== "string") {
        if (N === "object") {
          if (u === null)
            throw new Error(t);
          if (p && u.constructor === ArrayBuffer)
            u = new Uint8Array(u);
          else if (!Array.isArray(u) && (!p || !ArrayBuffer.isView(u)))
            throw new Error(t);
        } else
          throw new Error(t);
        I = !0;
      }
      var F = 0, q = u.length;
      if (I)
        F = q;
      else
        for (var D = 0; D < u.length; ++D) {
          var C = u.charCodeAt(D);
          C < 128 ? F += 1 : C < 2048 ? F += 2 : C < 55296 || C >= 57344 ? F += 3 : (C = 65536 + ((C & 1023) << 10 | u.charCodeAt(++D) & 1023), F += 4);
        }
      return F += this.encode(F * 8), this.update(u), F;
    }, f.prototype.bytepad = function(u, I) {
      for (var N = this.encode(I), F = 0; F < u.length; ++F)
        N += this.encodeString(u[F]);
      var q = I - N % I, D = [];
      return D.length = q, this.update(D), this;
    }, f.prototype.finalize = function() {
      if (!this.finalized) {
        this.finalized = !0;
        var u = this.blocks, I = this.lastByteIndex, N = this.blockCount, F = this.s;
        if (u[I >> 2] |= this.padding[I & 3], this.lastByteIndex === this.byteCount)
          for (u[0] = u[N], I = 1; I < N + 1; ++I)
            u[I] = 0;
        for (u[N - 1] |= 2147483648, I = 0; I < N; ++I)
          F[I] ^= u[I];
        U(F);
      }
    }, f.prototype.toString = f.prototype.hex = function() {
      this.finalize();
      for (var u = this.blockCount, I = this.s, N = this.outputBlocks, F = this.extraBytes, q = 0, D = 0, C = "", O; D < N; ) {
        for (q = 0; q < u && D < N; ++q, ++D)
          O = I[q], C += y[O >> 4 & 15] + y[O & 15] + y[O >> 12 & 15] + y[O >> 8 & 15] + y[O >> 20 & 15] + y[O >> 16 & 15] + y[O >> 28 & 15] + y[O >> 24 & 15];
        D % u === 0 && (U(I), q = 0);
      }
      return F && (O = I[q], C += y[O >> 4 & 15] + y[O & 15], F > 1 && (C += y[O >> 12 & 15] + y[O >> 8 & 15]), F > 2 && (C += y[O >> 20 & 15] + y[O >> 16 & 15])), C;
    }, f.prototype.arrayBuffer = function() {
      this.finalize();
      var u = this.blockCount, I = this.s, N = this.outputBlocks, F = this.extraBytes, q = 0, D = 0, C = this.outputBits >> 3, O;
      F ? O = new ArrayBuffer(N + 1 << 2) : O = new ArrayBuffer(C);
      for (var qe = new Uint32Array(O); D < N; ) {
        for (q = 0; q < u && D < N; ++q, ++D)
          qe[D] = I[q];
        D % u === 0 && U(I);
      }
      return F && (qe[q] = I[q], O = O.slice(0, C)), O;
    }, f.prototype.buffer = f.prototype.arrayBuffer, f.prototype.digest = f.prototype.array = function() {
      this.finalize();
      for (var u = this.blockCount, I = this.s, N = this.outputBlocks, F = this.extraBytes, q = 0, D = 0, C = [], O, qe; D < N; ) {
        for (q = 0; q < u && D < N; ++q, ++D)
          O = D << 2, qe = I[q], C[O] = qe & 255, C[O + 1] = qe >> 8 & 255, C[O + 2] = qe >> 16 & 255, C[O + 3] = qe >> 24 & 255;
        D % u === 0 && U(I);
      }
      return F && (O = D << 2, qe = I[q], C[O] = qe & 255, F > 1 && (C[O + 1] = qe >> 8 & 255), F > 2 && (C[O + 2] = qe >> 16 & 255)), C;
    };
    function m(u, I, N) {
      f.call(this, u, I, N);
    }
    a(m, "Kmac"), m.prototype = new f(), m.prototype.finalize = function() {
      return this.encode(this.outputBits, !0), f.prototype.finalize.call(this);
    };
    var U = /* @__PURE__ */ a(function(u) {
      var I, N, F, q, D, C, O, qe, T, k, It, ee, te, Rt, re, ie, Nt, ne, se, Ft, oe, ae, Pt, fe, he, qt, ue, ce, Ot, le, de, Ct, pe, ve, Tt, ge, me, $t, ye, we, Lt, be, xe, Dt, _e, Me, Ut, Se, Ae, kt, Ee, Ie, zt, Re, Ne, Bt, Fe, Pe, vt, gt, mt, yt, wt;
      for (F = 0; F < 48; F += 2)
        q = u[0] ^ u[10] ^ u[20] ^ u[30] ^ u[40], D = u[1] ^ u[11] ^ u[21] ^ u[31] ^ u[41], C = u[2] ^ u[12] ^ u[22] ^ u[32] ^ u[42], O = u[3] ^ u[13] ^ u[23] ^ u[33] ^ u[43], qe = u[4] ^ u[14] ^ u[24] ^ u[34] ^ u[44], T = u[5] ^ u[15] ^ u[25] ^ u[35] ^ u[45], k = u[6] ^ u[16] ^ u[26] ^ u[36] ^ u[46], It = u[7] ^ u[17] ^ u[27] ^ u[37] ^ u[47], ee = u[8] ^ u[18] ^ u[28] ^ u[38] ^ u[48], te = u[9] ^ u[19] ^ u[29] ^ u[39] ^ u[49], I = ee ^ (C << 1 | O >>> 31), N = te ^ (O << 1 | C >>> 31), u[0] ^= I, u[1] ^= N, u[10] ^= I, u[11] ^= N, u[20] ^= I, u[21] ^= N, u[30] ^= I, u[31] ^= N, u[40] ^= I, u[41] ^= N, I = q ^ (qe << 1 | T >>> 31), N = D ^ (T << 1 | qe >>> 31), u[2] ^= I, u[3] ^= N, u[12] ^= I, u[13] ^= N, u[22] ^= I, u[23] ^= N, u[32] ^= I, u[33] ^= N, u[42] ^= I, u[43] ^= N, I = C ^ (k << 1 | It >>> 31), N = O ^ (It << 1 | k >>> 31), u[4] ^= I, u[5] ^= N, u[14] ^= I, u[15] ^= N, u[24] ^= I, u[25] ^= N, u[34] ^= I, u[35] ^= N, u[44] ^= I, u[45] ^= N, I = qe ^ (ee << 1 | te >>> 31), N = T ^ (te << 1 | ee >>> 31), u[6] ^= I, u[7] ^= N, u[16] ^= I, u[17] ^= N, u[26] ^= I, u[27] ^= N, u[36] ^= I, u[37] ^= N, u[46] ^= I, u[47] ^= N, I = k ^ (q << 1 | D >>> 31), N = It ^ (D << 1 | q >>> 31), u[8] ^= I, u[9] ^= N, u[18] ^= I, u[19] ^= N, u[28] ^= I, u[29] ^= N, u[38] ^= I, u[39] ^= N, u[48] ^= I, u[49] ^= N, Rt = u[0], re = u[1], Me = u[11] << 4 | u[10] >>> 28, Ut = u[10] << 4 | u[11] >>> 28, ce = u[20] << 3 | u[21] >>> 29, Ot = u[21] << 3 | u[20] >>> 29, gt = u[31] << 9 | u[30] >>> 23, mt = u[30] << 9 | u[31] >>> 23, be = u[40] << 18 | u[41] >>> 14, xe = u[41] << 18 | u[40] >>> 14, ve = u[2] << 1 | u[3] >>> 31, Tt = u[3] << 1 | u[2] >>> 31, ie = u[13] << 12 | u[12] >>> 20, Nt = u[12] << 12 | u[13] >>> 20, Se = u[22] << 10 | u[23] >>> 22, Ae = u[23] << 10 | u[22] >>> 22, le = u[33] << 13 | u[32] >>> 19, de = u[32] << 13 | u[33] >>> 19, yt = u[42] << 2 | u[43] >>> 30, wt = u[43] << 2 | u[42] >>> 30, Re = u[5] << 30 | u[4] >>> 2, Ne = u[4] << 30 | u[5] >>> 2, ge = u[14] << 6 | u[15] >>> 26, me = u[15] << 6 | u[14] >>> 26, ne = u[25] << 11 | u[24] >>> 21, se = u[24] << 11 | u[25] >>> 21, kt = u[34] << 15 | u[35] >>> 17, Ee = u[35] << 15 | u[34] >>> 17, Ct = u[45] << 29 | u[44] >>> 3, pe = u[44] << 29 | u[45] >>> 3, fe = u[6] << 28 | u[7] >>> 4, he = u[7] << 28 | u[6] >>> 4, Bt = u[17] << 23 | u[16] >>> 9, Fe = u[16] << 23 | u[17] >>> 9, $t = u[26] << 25 | u[27] >>> 7, ye = u[27] << 25 | u[26] >>> 7, Ft = u[36] << 21 | u[37] >>> 11, oe = u[37] << 21 | u[36] >>> 11, Ie = u[47] << 24 | u[46] >>> 8, zt = u[46] << 24 | u[47] >>> 8, Dt = u[8] << 27 | u[9] >>> 5, _e = u[9] << 27 | u[8] >>> 5, qt = u[18] << 20 | u[19] >>> 12, ue = u[19] << 20 | u[18] >>> 12, Pe = u[29] << 7 | u[28] >>> 25, vt = u[28] << 7 | u[29] >>> 25, we = u[38] << 8 | u[39] >>> 24, Lt = u[39] << 8 | u[38] >>> 24, ae = u[48] << 14 | u[49] >>> 18, Pt = u[49] << 14 | u[48] >>> 18, u[0] = Rt ^ ~ie & ne, u[1] = re ^ ~Nt & se, u[10] = fe ^ ~qt & ce, u[11] = he ^ ~ue & Ot, u[20] = ve ^ ~ge & $t, u[21] = Tt ^ ~me & ye, u[30] = Dt ^ ~Me & Se, u[31] = _e ^ ~Ut & Ae, u[40] = Re ^ ~Bt & Pe, u[41] = Ne ^ ~Fe & vt, u[2] = ie ^ ~ne & Ft, u[3] = Nt ^ ~se & oe, u[12] = qt ^ ~ce & le, u[13] = ue ^ ~Ot & de, u[22] = ge ^ ~$t & we, u[23] = me ^ ~ye & Lt, u[32] = Me ^ ~Se & kt, u[33] = Ut ^ ~Ae & Ee, u[42] = Bt ^ ~Pe & gt, u[43] = Fe ^ ~vt & mt, u[4] = ne ^ ~Ft & ae, u[5] = se ^ ~oe & Pt, u[14] = ce ^ ~le & Ct, u[15] = Ot ^ ~de & pe, u[24] = $t ^ ~we & be, u[25] = ye ^ ~Lt & xe, u[34] = Se ^ ~kt & Ie, u[35] = Ae ^ ~Ee & zt, u[44] = Pe ^ ~gt & yt, u[45] = vt ^ ~mt & wt, u[6] = Ft ^ ~ae & Rt, u[7] = oe ^ ~Pt & re, u[16] = le ^ ~Ct & fe, u[17] = de ^ ~pe & he, u[26] = we ^ ~be & ve, u[27] = Lt ^ ~xe & Tt, u[36] = kt ^ ~Ie & Dt, u[37] = Ee ^ ~zt & _e, u[46] = gt ^ ~yt & Re, u[47] = mt ^ ~wt & Ne, u[8] = ae ^ ~Rt & ie, u[9] = Pt ^ ~re & Nt, u[18] = Ct ^ ~fe & qt, u[19] = pe ^ ~he & ue, u[28] = be ^ ~ve & ge, u[29] = xe ^ ~Tt & me, u[38] = Ie ^ ~Dt & Me, u[39] = zt ^ ~_e & Ut, u[48] = yt ^ ~Re & Bt, u[49] = wt ^ ~Ne & Fe, u[0] ^= P[F], u[1] ^= P[F + 1];
    }, "f");
    if (l)
      i.exports = o;
    else
      for (d = 0; d < h.length; ++d)
        n[h[d]] = o[h[d]];
  })();
})(ms);
var zo = ms.exports;
const Bo = /* @__PURE__ */ Dr(zo), Vo = "logger/5.7.0";
let xn = !1, _n = !1;
const Er = { debug: 1, default: 2, info: 2, warning: 3, error: 4, off: 5 };
let Mn = Er.default, oi = null;
function Ko() {
  try {
    const i = [];
    if (["NFD", "NFC", "NFKD", "NFKC"].forEach((t) => {
      try {
        if ("test".normalize(t) !== "test")
          throw new Error("bad normalize");
      } catch {
        i.push(t);
      }
    }), i.length)
      throw new Error("missing " + i.join(", "));
    if (String.fromCharCode(233).normalize("NFD") !== String.fromCharCode(101, 769))
      throw new Error("broken implementation");
  } catch (i) {
    return i.message;
  }
  return null;
}
a(Ko, "_checkNormalize");
const Sn = Ko();
var xi;
(function(i) {
  i.DEBUG = "DEBUG", i.INFO = "INFO", i.WARNING = "WARNING", i.ERROR = "ERROR", i.OFF = "OFF";
})(xi || (xi = {}));
var Ze;
(function(i) {
  i.UNKNOWN_ERROR = "UNKNOWN_ERROR", i.NOT_IMPLEMENTED = "NOT_IMPLEMENTED", i.UNSUPPORTED_OPERATION = "UNSUPPORTED_OPERATION", i.NETWORK_ERROR = "NETWORK_ERROR", i.SERVER_ERROR = "SERVER_ERROR", i.TIMEOUT = "TIMEOUT", i.BUFFER_OVERRUN = "BUFFER_OVERRUN", i.NUMERIC_FAULT = "NUMERIC_FAULT", i.MISSING_NEW = "MISSING_NEW", i.INVALID_ARGUMENT = "INVALID_ARGUMENT", i.MISSING_ARGUMENT = "MISSING_ARGUMENT", i.UNEXPECTED_ARGUMENT = "UNEXPECTED_ARGUMENT", i.CALL_EXCEPTION = "CALL_EXCEPTION", i.INSUFFICIENT_FUNDS = "INSUFFICIENT_FUNDS", i.NONCE_EXPIRED = "NONCE_EXPIRED", i.REPLACEMENT_UNDERPRICED = "REPLACEMENT_UNDERPRICED", i.UNPREDICTABLE_GAS_LIMIT = "UNPREDICTABLE_GAS_LIMIT", i.TRANSACTION_REPLACED = "TRANSACTION_REPLACED", i.ACTION_REJECTED = "ACTION_REJECTED";
})(Ze || (Ze = {}));
const An = "0123456789abcdef", Oe = class Oe {
  constructor(t) {
    Object.defineProperty(this, "version", {
      enumerable: !0,
      value: t,
      writable: !1
    });
  }
  _log(t, e) {
    const r = t.toLowerCase();
    Er[r] == null && this.throwArgumentError("invalid log level name", "logLevel", t), !(Mn > Er[r]) && console.log.apply(console, e);
  }
  debug(...t) {
    this._log(Oe.levels.DEBUG, t);
  }
  info(...t) {
    this._log(Oe.levels.INFO, t);
  }
  warn(...t) {
    this._log(Oe.levels.WARNING, t);
  }
  makeError(t, e, r) {
    if (_n)
      return this.makeError("censored error", e, {});
    e || (e = Oe.errors.UNKNOWN_ERROR), r || (r = {});
    const n = [];
    Object.keys(r).forEach((p) => {
      const y = r[p];
      try {
        if (y instanceof Uint8Array) {
          let x = "";
          for (let _ = 0; _ < y.length; _++)
            x += An[y[_] >> 4], x += An[y[_] & 15];
          n.push(p + "=Uint8Array(0x" + x + ")");
        } else
          n.push(p + "=" + JSON.stringify(y));
      } catch {
        n.push(p + "=" + JSON.stringify(r[p].toString()));
      }
    }), n.push(`code=${e}`), n.push(`version=${this.version}`);
    const s = t;
    let c = "";
    switch (e) {
      case Ze.NUMERIC_FAULT: {
        c = "NUMERIC_FAULT";
        const p = t;
        switch (p) {
          case "overflow":
          case "underflow":
          case "division-by-zero":
            c += "-" + p;
            break;
          case "negative-power":
          case "negative-width":
            c += "-unsupported";
            break;
          case "unbound-bitwise-result":
            c += "-unbound-result";
            break;
        }
        break;
      }
      case Ze.CALL_EXCEPTION:
      case Ze.INSUFFICIENT_FUNDS:
      case Ze.MISSING_NEW:
      case Ze.NONCE_EXPIRED:
      case Ze.REPLACEMENT_UNDERPRICED:
      case Ze.TRANSACTION_REPLACED:
      case Ze.UNPREDICTABLE_GAS_LIMIT:
        c = e;
        break;
    }
    c && (t += " [ See: https://links.ethers.org/v5-errors-" + c + " ]"), n.length && (t += " (" + n.join(", ") + ")");
    const l = new Error(t);
    return l.reason = s, l.code = e, Object.keys(r).forEach(function(p) {
      l[p] = r[p];
    }), l;
  }
  throwError(t, e, r) {
    throw this.makeError(t, e, r);
  }
  throwArgumentError(t, e, r) {
    return this.throwError(t, Oe.errors.INVALID_ARGUMENT, {
      argument: e,
      value: r
    });
  }
  assert(t, e, r, n) {
    t || this.throwError(e, r, n);
  }
  assertArgument(t, e, r, n) {
    t || this.throwArgumentError(e, r, n);
  }
  checkNormalize(t) {
    Sn && this.throwError("platform missing String.prototype.normalize", Oe.errors.UNSUPPORTED_OPERATION, {
      operation: "String.prototype.normalize",
      form: Sn
    });
  }
  checkSafeUint53(t, e) {
    typeof t == "number" && (e == null && (e = "value not safe"), (t < 0 || t >= 9007199254740991) && this.throwError(e, Oe.errors.NUMERIC_FAULT, {
      operation: "checkSafeInteger",
      fault: "out-of-safe-range",
      value: t
    }), t % 1 && this.throwError(e, Oe.errors.NUMERIC_FAULT, {
      operation: "checkSafeInteger",
      fault: "non-integer",
      value: t
    }));
  }
  checkArgumentCount(t, e, r) {
    r ? r = ": " + r : r = "", t < e && this.throwError("missing argument" + r, Oe.errors.MISSING_ARGUMENT, {
      count: t,
      expectedCount: e
    }), t > e && this.throwError("too many arguments" + r, Oe.errors.UNEXPECTED_ARGUMENT, {
      count: t,
      expectedCount: e
    });
  }
  checkNew(t, e) {
    (t === Object || t == null) && this.throwError("missing new", Oe.errors.MISSING_NEW, { name: e.name });
  }
  checkAbstract(t, e) {
    t === e ? this.throwError("cannot instantiate abstract class " + JSON.stringify(e.name) + " directly; use a sub-class", Oe.errors.UNSUPPORTED_OPERATION, { name: t.name, operation: "new" }) : (t === Object || t == null) && this.throwError("missing new", Oe.errors.MISSING_NEW, { name: e.name });
  }
  static globalLogger() {
    return oi || (oi = new Oe(Vo)), oi;
  }
  static setCensorship(t, e) {
    if (!t && e && this.globalLogger().throwError("cannot permanently disable censorship", Oe.errors.UNSUPPORTED_OPERATION, {
      operation: "setCensorship"
    }), xn) {
      if (!t)
        return;
      this.globalLogger().throwError("error censorship permanent", Oe.errors.UNSUPPORTED_OPERATION, {
        operation: "setCensorship"
      });
    }
    _n = !!t, xn = !!e;
  }
  static setLogLevel(t) {
    const e = Er[t.toLowerCase()];
    if (e == null) {
      Oe.globalLogger().warn("invalid log level - " + t);
      return;
    }
    Mn = e;
  }
  static from(t) {
    return new Oe(t);
  }
};
a(Oe, "Logger");
let St = Oe;
St.errors = Ze;
St.levels = xi;
const jo = "bytes/5.7.0", Ce = new St(jo);
function ys(i) {
  return !!i.toHexString;
}
a(ys, "isHexable");
function Wt(i) {
  return i.slice || (i.slice = function() {
    const t = Array.prototype.slice.call(arguments);
    return Wt(new Uint8Array(Array.prototype.slice.apply(i, t)));
  }), i;
}
a(Wt, "addSlice");
function Go(i) {
  return rt(i) && !(i.length % 2) || Gi(i);
}
a(Go, "isBytesLike");
function En(i) {
  return typeof i == "number" && i == i && i % 1 === 0;
}
a(En, "isInteger");
function Gi(i) {
  if (i == null)
    return !1;
  if (i.constructor === Uint8Array)
    return !0;
  if (typeof i == "string" || !En(i.length) || i.length < 0)
    return !1;
  for (let t = 0; t < i.length; t++) {
    const e = i[t];
    if (!En(e) || e < 0 || e >= 256)
      return !1;
  }
  return !0;
}
a(Gi, "isBytes");
function Te(i, t) {
  if (t || (t = {}), typeof i == "number") {
    Ce.checkSafeUint53(i, "invalid arrayify value");
    const e = [];
    for (; i; )
      e.unshift(i & 255), i = parseInt(String(i / 256));
    return e.length === 0 && e.push(0), Wt(new Uint8Array(e));
  }
  if (t.allowMissingPrefix && typeof i == "string" && i.substring(0, 2) !== "0x" && (i = "0x" + i), ys(i) && (i = i.toHexString()), rt(i)) {
    let e = i.substring(2);
    e.length % 2 && (t.hexPad === "left" ? e = "0" + e : t.hexPad === "right" ? e += "0" : Ce.throwArgumentError("hex data is odd-length", "value", i));
    const r = [];
    for (let n = 0; n < e.length; n += 2)
      r.push(parseInt(e.substring(n, n + 2), 16));
    return Wt(new Uint8Array(r));
  }
  return Gi(i) ? Wt(new Uint8Array(i)) : Ce.throwArgumentError("invalid arrayify value", "value", i);
}
a(Te, "arrayify");
function Ho(i) {
  const t = i.map((n) => Te(n)), e = t.reduce((n, s) => n + s.length, 0), r = new Uint8Array(e);
  return t.reduce((n, s) => (r.set(s, n), n + s.length), 0), Wt(r);
}
a(Ho, "concat");
function Jo(i, t) {
  i = Te(i), i.length > t && Ce.throwArgumentError("value out of range", "value", arguments[0]);
  const e = new Uint8Array(t);
  return e.set(i, t - i.length), Wt(e);
}
a(Jo, "zeroPad");
function rt(i, t) {
  return !(typeof i != "string" || !i.match(/^0x[0-9A-Fa-f]*$/) || t && i.length !== 2 + 2 * t);
}
a(rt, "isHexString");
const ai = "0123456789abcdef";
function Ve(i, t) {
  if (t || (t = {}), typeof i == "number") {
    Ce.checkSafeUint53(i, "invalid hexlify value");
    let e = "";
    for (; i; )
      e = ai[i & 15] + e, i = Math.floor(i / 16);
    return e.length ? (e.length % 2 && (e = "0" + e), "0x" + e) : "0x00";
  }
  if (typeof i == "bigint")
    return i = i.toString(16), i.length % 2 ? "0x0" + i : "0x" + i;
  if (t.allowMissingPrefix && typeof i == "string" && i.substring(0, 2) !== "0x" && (i = "0x" + i), ys(i))
    return i.toHexString();
  if (rt(i))
    return i.length % 2 && (t.hexPad === "left" ? i = "0x0" + i.substring(2) : t.hexPad === "right" ? i += "0" : Ce.throwArgumentError("hex data is odd-length", "value", i)), i.toLowerCase();
  if (Gi(i)) {
    let e = "0x";
    for (let r = 0; r < i.length; r++) {
      let n = i[r];
      e += ai[(n & 240) >> 4] + ai[n & 15];
    }
    return e;
  }
  return Ce.throwArgumentError("invalid hexlify value", "value", i);
}
a(Ve, "hexlify");
function Wo(i) {
  if (typeof i != "string")
    i = Ve(i);
  else if (!rt(i) || i.length % 2)
    return null;
  return (i.length - 2) / 2;
}
a(Wo, "hexDataLength");
function In(i, t, e) {
  return typeof i != "string" ? i = Ve(i) : (!rt(i) || i.length % 2) && Ce.throwArgumentError("invalid hexData", "value", i), t = 2 + 2 * t, e != null ? "0x" + i.substring(t, 2 + 2 * e) : "0x" + i.substring(t);
}
a(In, "hexDataSlice");
function Xt(i, t) {
  for (typeof i != "string" ? i = Ve(i) : rt(i) || Ce.throwArgumentError("invalid hex string", "value", i), i.length > 2 * t + 2 && Ce.throwArgumentError("value out of range", "value", arguments[1]); i.length < 2 * t + 2; )
    i = "0x0" + i.substring(2);
  return i;
}
a(Xt, "hexZeroPad");
function ws(i) {
  const t = {
    r: "0x",
    s: "0x",
    _vs: "0x",
    recoveryParam: 0,
    v: 0,
    yParityAndS: "0x",
    compact: "0x"
  };
  if (Go(i)) {
    let e = Te(i);
    e.length === 64 ? (t.v = 27 + (e[32] >> 7), e[32] &= 127, t.r = Ve(e.slice(0, 32)), t.s = Ve(e.slice(32, 64))) : e.length === 65 ? (t.r = Ve(e.slice(0, 32)), t.s = Ve(e.slice(32, 64)), t.v = e[64]) : Ce.throwArgumentError("invalid signature string", "signature", i), t.v < 27 && (t.v === 0 || t.v === 1 ? t.v += 27 : Ce.throwArgumentError("signature invalid v byte", "signature", i)), t.recoveryParam = 1 - t.v % 2, t.recoveryParam && (e[32] |= 128), t._vs = Ve(e.slice(32, 64));
  } else {
    if (t.r = i.r, t.s = i.s, t.v = i.v, t.recoveryParam = i.recoveryParam, t._vs = i._vs, t._vs != null) {
      const n = Jo(Te(t._vs), 32);
      t._vs = Ve(n);
      const s = n[0] >= 128 ? 1 : 0;
      t.recoveryParam == null ? t.recoveryParam = s : t.recoveryParam !== s && Ce.throwArgumentError("signature recoveryParam mismatch _vs", "signature", i), n[0] &= 127;
      const c = Ve(n);
      t.s == null ? t.s = c : t.s !== c && Ce.throwArgumentError("signature v mismatch _vs", "signature", i);
    }
    if (t.recoveryParam == null)
      t.v == null ? Ce.throwArgumentError("signature missing v and recoveryParam", "signature", i) : t.v === 0 || t.v === 1 ? t.recoveryParam = t.v : t.recoveryParam = 1 - t.v % 2;
    else if (t.v == null)
      t.v = 27 + t.recoveryParam;
    else {
      const n = t.v === 0 || t.v === 1 ? t.v : 1 - t.v % 2;
      t.recoveryParam !== n && Ce.throwArgumentError("signature recoveryParam mismatch v", "signature", i);
    }
    t.r == null || !rt(t.r) ? Ce.throwArgumentError("signature missing or invalid r", "signature", i) : t.r = Xt(t.r, 32), t.s == null || !rt(t.s) ? Ce.throwArgumentError("signature missing or invalid s", "signature", i) : t.s = Xt(t.s, 32);
    const e = Te(t.s);
    e[0] >= 128 && Ce.throwArgumentError("signature s out of range", "signature", i), t.recoveryParam && (e[0] |= 128);
    const r = Ve(e);
    t._vs && (rt(t._vs) || Ce.throwArgumentError("signature invalid _vs", "signature", i), t._vs = Xt(t._vs, 32)), t._vs == null ? t._vs = r : t._vs !== r && Ce.throwArgumentError("signature _vs mismatch v and s", "signature", i);
  }
  return t.yParityAndS = t._vs, t.compact = t.r + t.yParityAndS.substring(2), t;
}
a(ws, "splitSignature");
function Hi(i) {
  return "0x" + Bo.keccak_256(Te(i));
}
a(Hi, "keccak256");
var Ji = { exports: {} };
Ji.exports;
(function(i) {
  (function(t, e) {
    function r(b, o) {
      if (!b)
        throw new Error(o || "Assertion failed");
    }
    a(r, "assert");
    function n(b, o) {
      b.super_ = o;
      var h = /* @__PURE__ */ a(function() {
      }, "TempCtor");
      h.prototype = o.prototype, b.prototype = new h(), b.prototype.constructor = b;
    }
    a(n, "inherits");
    function s(b, o, h) {
      if (s.isBN(b))
        return b;
      this.negative = 0, this.words = null, this.length = 0, this.red = null, b !== null && ((o === "le" || o === "be") && (h = o, o = 10), this._init(b || 0, o || 10, h || "be"));
    }
    a(s, "BN"), typeof t == "object" ? t.exports = s : e.BN = s, s.BN = s, s.wordSize = 26;
    var c;
    try {
      typeof window < "u" && typeof window.Buffer < "u" ? c = window.Buffer : c = bo.Buffer;
    } catch {
    }
    s.isBN = /* @__PURE__ */ a(function(o) {
      return o instanceof s ? !0 : o !== null && typeof o == "object" && o.constructor.wordSize === s.wordSize && Array.isArray(o.words);
    }, "isBN"), s.max = /* @__PURE__ */ a(function(o, h) {
      return o.cmp(h) > 0 ? o : h;
    }, "max"), s.min = /* @__PURE__ */ a(function(o, h) {
      return o.cmp(h) < 0 ? o : h;
    }, "min"), s.prototype._init = /* @__PURE__ */ a(function(o, h, d) {
      if (typeof o == "number")
        return this._initNumber(o, h, d);
      if (typeof o == "object")
        return this._initArray(o, h, d);
      h === "hex" && (h = 16), r(h === (h | 0) && h >= 2 && h <= 36), o = o.toString().replace(/\s+/g, "");
      var g = 0;
      o[0] === "-" && (g++, this.negative = 1), g < o.length && (h === 16 ? this._parseHex(o, g, d) : (this._parseBase(o, h, g), d === "le" && this._initArray(this.toArray(), h, d)));
    }, "init"), s.prototype._initNumber = /* @__PURE__ */ a(function(o, h, d) {
      o < 0 && (this.negative = 1, o = -o), o < 67108864 ? (this.words = [o & 67108863], this.length = 1) : o < 4503599627370496 ? (this.words = [
        o & 67108863,
        o / 67108864 & 67108863
      ], this.length = 2) : (r(o < 9007199254740992), this.words = [
        o & 67108863,
        o / 67108864 & 67108863,
        1
      ], this.length = 3), d === "le" && this._initArray(this.toArray(), h, d);
    }, "_initNumber"), s.prototype._initArray = /* @__PURE__ */ a(function(o, h, d) {
      if (r(typeof o.length == "number"), o.length <= 0)
        return this.words = [0], this.length = 1, this;
      this.length = Math.ceil(o.length / 3), this.words = new Array(this.length);
      for (var g = 0; g < this.length; g++)
        this.words[g] = 0;
      var w, M, S = 0;
      if (d === "be")
        for (g = o.length - 1, w = 0; g >= 0; g -= 3)
          M = o[g] | o[g - 1] << 8 | o[g - 2] << 16, this.words[w] |= M << S & 67108863, this.words[w + 1] = M >>> 26 - S & 67108863, S += 24, S >= 26 && (S -= 26, w++);
      else if (d === "le")
        for (g = 0, w = 0; g < o.length; g += 3)
          M = o[g] | o[g + 1] << 8 | o[g + 2] << 16, this.words[w] |= M << S & 67108863, this.words[w + 1] = M >>> 26 - S & 67108863, S += 24, S >= 26 && (S -= 26, w++);
      return this._strip();
    }, "_initArray");
    function l(b, o) {
      var h = b.charCodeAt(o);
      if (h >= 48 && h <= 57)
        return h - 48;
      if (h >= 65 && h <= 70)
        return h - 55;
      if (h >= 97 && h <= 102)
        return h - 87;
      r(!1, "Invalid character in " + b);
    }
    a(l, "parseHex4Bits");
    function p(b, o, h) {
      var d = l(b, h);
      return h - 1 >= o && (d |= l(b, h - 1) << 4), d;
    }
    a(p, "parseHexByte"), s.prototype._parseHex = /* @__PURE__ */ a(function(o, h, d) {
      this.length = Math.ceil((o.length - h) / 6), this.words = new Array(this.length);
      for (var g = 0; g < this.length; g++)
        this.words[g] = 0;
      var w = 0, M = 0, S;
      if (d === "be")
        for (g = o.length - 1; g >= h; g -= 2)
          S = p(o, h, g) << w, this.words[M] |= S & 67108863, w >= 18 ? (w -= 18, M += 1, this.words[M] |= S >>> 26) : w += 8;
      else {
        var v = o.length - h;
        for (g = v % 2 === 0 ? h + 1 : h; g < o.length; g += 2)
          S = p(o, h, g) << w, this.words[M] |= S & 67108863, w >= 18 ? (w -= 18, M += 1, this.words[M] |= S >>> 26) : w += 8;
      }
      this._strip();
    }, "_parseHex");
    function y(b, o, h, d) {
      for (var g = 0, w = 0, M = Math.min(b.length, h), S = o; S < M; S++) {
        var v = b.charCodeAt(S) - 48;
        g *= d, v >= 49 ? w = v - 49 + 10 : v >= 17 ? w = v - 17 + 10 : w = v, r(v >= 0 && w < d, "Invalid character"), g += w;
      }
      return g;
    }
    a(y, "parseBase"), s.prototype._parseBase = /* @__PURE__ */ a(function(o, h, d) {
      this.words = [0], this.length = 1;
      for (var g = 0, w = 1; w <= 67108863; w *= h)
        g++;
      g--, w = w / h | 0;
      for (var M = o.length - d, S = M % g, v = Math.min(M, M - S) + d, f = 0, m = d; m < v; m += g)
        f = y(o, m, m + g, h), this.imuln(w), this.words[0] + f < 67108864 ? this.words[0] += f : this._iaddn(f);
      if (S !== 0) {
        var U = 1;
        for (f = y(o, m, o.length, h), m = 0; m < S; m++)
          U *= h;
        this.imuln(U), this.words[0] + f < 67108864 ? this.words[0] += f : this._iaddn(f);
      }
      this._strip();
    }, "_parseBase"), s.prototype.copy = /* @__PURE__ */ a(function(o) {
      o.words = new Array(this.length);
      for (var h = 0; h < this.length; h++)
        o.words[h] = this.words[h];
      o.length = this.length, o.negative = this.negative, o.red = this.red;
    }, "copy");
    function x(b, o) {
      b.words = o.words, b.length = o.length, b.negative = o.negative, b.red = o.red;
    }
    if (a(x, "move"), s.prototype._move = /* @__PURE__ */ a(function(o) {
      x(o, this);
    }, "_move"), s.prototype.clone = /* @__PURE__ */ a(function() {
      var o = new s(null);
      return this.copy(o), o;
    }, "clone"), s.prototype._expand = /* @__PURE__ */ a(function(o) {
      for (; this.length < o; )
        this.words[this.length++] = 0;
      return this;
    }, "_expand"), s.prototype._strip = /* @__PURE__ */ a(function() {
      for (; this.length > 1 && this.words[this.length - 1] === 0; )
        this.length--;
      return this._normSign();
    }, "strip"), s.prototype._normSign = /* @__PURE__ */ a(function() {
      return this.length === 1 && this.words[0] === 0 && (this.negative = 0), this;
    }, "_normSign"), typeof Symbol < "u" && typeof Symbol.for == "function")
      try {
        s.prototype[Symbol.for("nodejs.util.inspect.custom")] = _;
      } catch {
        s.prototype.inspect = _;
      }
    else
      s.prototype.inspect = _;
    function _() {
      return (this.red ? "<BN-R: " : "<BN: ") + this.toString(16) + ">";
    }
    a(_, "inspect");
    var E = [
      "",
      "0",
      "00",
      "000",
      "0000",
      "00000",
      "000000",
      "0000000",
      "00000000",
      "000000000",
      "0000000000",
      "00000000000",
      "000000000000",
      "0000000000000",
      "00000000000000",
      "000000000000000",
      "0000000000000000",
      "00000000000000000",
      "000000000000000000",
      "0000000000000000000",
      "00000000000000000000",
      "000000000000000000000",
      "0000000000000000000000",
      "00000000000000000000000",
      "000000000000000000000000",
      "0000000000000000000000000"
    ], R = [
      0,
      0,
      25,
      16,
      12,
      11,
      10,
      9,
      8,
      8,
      7,
      7,
      7,
      7,
      6,
      6,
      6,
      6,
      6,
      6,
      6,
      5,
      5,
      5,
      5,
      5,
      5,
      5,
      5,
      5,
      5,
      5,
      5,
      5,
      5,
      5,
      5
    ], A = [
      0,
      0,
      33554432,
      43046721,
      16777216,
      48828125,
      60466176,
      40353607,
      16777216,
      43046721,
      1e7,
      19487171,
      35831808,
      62748517,
      7529536,
      11390625,
      16777216,
      24137569,
      34012224,
      47045881,
      64e6,
      4084101,
      5153632,
      6436343,
      7962624,
      9765625,
      11881376,
      14348907,
      17210368,
      20511149,
      243e5,
      28629151,
      33554432,
      39135393,
      45435424,
      52521875,
      60466176
    ];
    s.prototype.toString = /* @__PURE__ */ a(function(o, h) {
      o = o || 10, h = h | 0 || 1;
      var d;
      if (o === 16 || o === "hex") {
        d = "";
        for (var g = 0, w = 0, M = 0; M < this.length; M++) {
          var S = this.words[M], v = ((S << g | w) & 16777215).toString(16);
          w = S >>> 24 - g & 16777215, g += 2, g >= 26 && (g -= 26, M--), w !== 0 || M !== this.length - 1 ? d = E[6 - v.length] + v + d : d = v + d;
        }
        for (w !== 0 && (d = w.toString(16) + d); d.length % h !== 0; )
          d = "0" + d;
        return this.negative !== 0 && (d = "-" + d), d;
      }
      if (o === (o | 0) && o >= 2 && o <= 36) {
        var f = R[o], m = A[o];
        d = "";
        var U = this.clone();
        for (U.negative = 0; !U.isZero(); ) {
          var u = U.modrn(m).toString(o);
          U = U.idivn(m), U.isZero() ? d = u + d : d = E[f - u.length] + u + d;
        }
        for (this.isZero() && (d = "0" + d); d.length % h !== 0; )
          d = "0" + d;
        return this.negative !== 0 && (d = "-" + d), d;
      }
      r(!1, "Base should be between 2 and 36");
    }, "toString"), s.prototype.toNumber = /* @__PURE__ */ a(function() {
      var o = this.words[0];
      return this.length === 2 ? o += this.words[1] * 67108864 : this.length === 3 && this.words[2] === 1 ? o += 4503599627370496 + this.words[1] * 67108864 : this.length > 2 && r(!1, "Number can only safely store up to 53 bits"), this.negative !== 0 ? -o : o;
    }, "toNumber"), s.prototype.toJSON = /* @__PURE__ */ a(function() {
      return this.toString(16, 2);
    }, "toJSON"), c && (s.prototype.toBuffer = /* @__PURE__ */ a(function(o, h) {
      return this.toArrayLike(c, o, h);
    }, "toBuffer")), s.prototype.toArray = /* @__PURE__ */ a(function(o, h) {
      return this.toArrayLike(Array, o, h);
    }, "toArray");
    var P = /* @__PURE__ */ a(function(o, h) {
      return o.allocUnsafe ? o.allocUnsafe(h) : new o(h);
    }, "allocate");
    s.prototype.toArrayLike = /* @__PURE__ */ a(function(o, h, d) {
      this._strip();
      var g = this.byteLength(), w = d || Math.max(1, g);
      r(g <= w, "byte array longer than desired length"), r(w > 0, "Requested array length <= 0");
      var M = P(o, w), S = h === "le" ? "LE" : "BE";
      return this["_toArrayLike" + S](M, g), M;
    }, "toArrayLike"), s.prototype._toArrayLikeLE = /* @__PURE__ */ a(function(o, h) {
      for (var d = 0, g = 0, w = 0, M = 0; w < this.length; w++) {
        var S = this.words[w] << M | g;
        o[d++] = S & 255, d < o.length && (o[d++] = S >> 8 & 255), d < o.length && (o[d++] = S >> 16 & 255), M === 6 ? (d < o.length && (o[d++] = S >> 24 & 255), g = 0, M = 0) : (g = S >>> 24, M += 2);
      }
      if (d < o.length)
        for (o[d++] = g; d < o.length; )
          o[d++] = 0;
    }, "_toArrayLikeLE"), s.prototype._toArrayLikeBE = /* @__PURE__ */ a(function(o, h) {
      for (var d = o.length - 1, g = 0, w = 0, M = 0; w < this.length; w++) {
        var S = this.words[w] << M | g;
        o[d--] = S & 255, d >= 0 && (o[d--] = S >> 8 & 255), d >= 0 && (o[d--] = S >> 16 & 255), M === 6 ? (d >= 0 && (o[d--] = S >> 24 & 255), g = 0, M = 0) : (g = S >>> 24, M += 2);
      }
      if (d >= 0)
        for (o[d--] = g; d >= 0; )
          o[d--] = 0;
    }, "_toArrayLikeBE"), Math.clz32 ? s.prototype._countBits = /* @__PURE__ */ a(function(o) {
      return 32 - Math.clz32(o);
    }, "_countBits") : s.prototype._countBits = /* @__PURE__ */ a(function(o) {
      var h = o, d = 0;
      return h >= 4096 && (d += 13, h >>>= 13), h >= 64 && (d += 7, h >>>= 7), h >= 8 && (d += 4, h >>>= 4), h >= 2 && (d += 2, h >>>= 2), d + h;
    }, "_countBits"), s.prototype._zeroBits = /* @__PURE__ */ a(function(o) {
      if (o === 0)
        return 26;
      var h = o, d = 0;
      return h & 8191 || (d += 13, h >>>= 13), h & 127 || (d += 7, h >>>= 7), h & 15 || (d += 4, h >>>= 4), h & 3 || (d += 2, h >>>= 2), h & 1 || d++, d;
    }, "_zeroBits"), s.prototype.bitLength = /* @__PURE__ */ a(function() {
      var o = this.words[this.length - 1], h = this._countBits(o);
      return (this.length - 1) * 26 + h;
    }, "bitLength");
    function L(b) {
      for (var o = new Array(b.bitLength()), h = 0; h < o.length; h++) {
        var d = h / 26 | 0, g = h % 26;
        o[h] = b.words[d] >>> g & 1;
      }
      return o;
    }
    a(L, "toBitArray"), s.prototype.zeroBits = /* @__PURE__ */ a(function() {
      if (this.isZero())
        return 0;
      for (var o = 0, h = 0; h < this.length; h++) {
        var d = this._zeroBits(this.words[h]);
        if (o += d, d !== 26)
          break;
      }
      return o;
    }, "zeroBits"), s.prototype.byteLength = /* @__PURE__ */ a(function() {
      return Math.ceil(this.bitLength() / 8);
    }, "byteLength"), s.prototype.toTwos = /* @__PURE__ */ a(function(o) {
      return this.negative !== 0 ? this.abs().inotn(o).iaddn(1) : this.clone();
    }, "toTwos"), s.prototype.fromTwos = /* @__PURE__ */ a(function(o) {
      return this.testn(o - 1) ? this.notn(o).iaddn(1).ineg() : this.clone();
    }, "fromTwos"), s.prototype.isNeg = /* @__PURE__ */ a(function() {
      return this.negative !== 0;
    }, "isNeg"), s.prototype.neg = /* @__PURE__ */ a(function() {
      return this.clone().ineg();
    }, "neg"), s.prototype.ineg = /* @__PURE__ */ a(function() {
      return this.isZero() || (this.negative ^= 1), this;
    }, "ineg"), s.prototype.iuor = /* @__PURE__ */ a(function(o) {
      for (; this.length < o.length; )
        this.words[this.length++] = 0;
      for (var h = 0; h < o.length; h++)
        this.words[h] = this.words[h] | o.words[h];
      return this._strip();
    }, "iuor"), s.prototype.ior = /* @__PURE__ */ a(function(o) {
      return r((this.negative | o.negative) === 0), this.iuor(o);
    }, "ior"), s.prototype.or = /* @__PURE__ */ a(function(o) {
      return this.length > o.length ? this.clone().ior(o) : o.clone().ior(this);
    }, "or"), s.prototype.uor = /* @__PURE__ */ a(function(o) {
      return this.length > o.length ? this.clone().iuor(o) : o.clone().iuor(this);
    }, "uor"), s.prototype.iuand = /* @__PURE__ */ a(function(o) {
      var h;
      this.length > o.length ? h = o : h = this;
      for (var d = 0; d < h.length; d++)
        this.words[d] = this.words[d] & o.words[d];
      return this.length = h.length, this._strip();
    }, "iuand"), s.prototype.iand = /* @__PURE__ */ a(function(o) {
      return r((this.negative | o.negative) === 0), this.iuand(o);
    }, "iand"), s.prototype.and = /* @__PURE__ */ a(function(o) {
      return this.length > o.length ? this.clone().iand(o) : o.clone().iand(this);
    }, "and"), s.prototype.uand = /* @__PURE__ */ a(function(o) {
      return this.length > o.length ? this.clone().iuand(o) : o.clone().iuand(this);
    }, "uand"), s.prototype.iuxor = /* @__PURE__ */ a(function(o) {
      var h, d;
      this.length > o.length ? (h = this, d = o) : (h = o, d = this);
      for (var g = 0; g < d.length; g++)
        this.words[g] = h.words[g] ^ d.words[g];
      if (this !== h)
        for (; g < h.length; g++)
          this.words[g] = h.words[g];
      return this.length = h.length, this._strip();
    }, "iuxor"), s.prototype.ixor = /* @__PURE__ */ a(function(o) {
      return r((this.negative | o.negative) === 0), this.iuxor(o);
    }, "ixor"), s.prototype.xor = /* @__PURE__ */ a(function(o) {
      return this.length > o.length ? this.clone().ixor(o) : o.clone().ixor(this);
    }, "xor"), s.prototype.uxor = /* @__PURE__ */ a(function(o) {
      return this.length > o.length ? this.clone().iuxor(o) : o.clone().iuxor(this);
    }, "uxor"), s.prototype.inotn = /* @__PURE__ */ a(function(o) {
      r(typeof o == "number" && o >= 0);
      var h = Math.ceil(o / 26) | 0, d = o % 26;
      this._expand(h), d > 0 && h--;
      for (var g = 0; g < h; g++)
        this.words[g] = ~this.words[g] & 67108863;
      return d > 0 && (this.words[g] = ~this.words[g] & 67108863 >> 26 - d), this._strip();
    }, "inotn"), s.prototype.notn = /* @__PURE__ */ a(function(o) {
      return this.clone().inotn(o);
    }, "notn"), s.prototype.setn = /* @__PURE__ */ a(function(o, h) {
      r(typeof o == "number" && o >= 0);
      var d = o / 26 | 0, g = o % 26;
      return this._expand(d + 1), h ? this.words[d] = this.words[d] | 1 << g : this.words[d] = this.words[d] & ~(1 << g), this._strip();
    }, "setn"), s.prototype.iadd = /* @__PURE__ */ a(function(o) {
      var h;
      if (this.negative !== 0 && o.negative === 0)
        return this.negative = 0, h = this.isub(o), this.negative ^= 1, this._normSign();
      if (this.negative === 0 && o.negative !== 0)
        return o.negative = 0, h = this.isub(o), o.negative = 1, h._normSign();
      var d, g;
      this.length > o.length ? (d = this, g = o) : (d = o, g = this);
      for (var w = 0, M = 0; M < g.length; M++)
        h = (d.words[M] | 0) + (g.words[M] | 0) + w, this.words[M] = h & 67108863, w = h >>> 26;
      for (; w !== 0 && M < d.length; M++)
        h = (d.words[M] | 0) + w, this.words[M] = h & 67108863, w = h >>> 26;
      if (this.length = d.length, w !== 0)
        this.words[this.length] = w, this.length++;
      else if (d !== this)
        for (; M < d.length; M++)
          this.words[M] = d.words[M];
      return this;
    }, "iadd"), s.prototype.add = /* @__PURE__ */ a(function(o) {
      var h;
      return o.negative !== 0 && this.negative === 0 ? (o.negative = 0, h = this.sub(o), o.negative ^= 1, h) : o.negative === 0 && this.negative !== 0 ? (this.negative = 0, h = o.sub(this), this.negative = 1, h) : this.length > o.length ? this.clone().iadd(o) : o.clone().iadd(this);
    }, "add"), s.prototype.isub = /* @__PURE__ */ a(function(o) {
      if (o.negative !== 0) {
        o.negative = 0;
        var h = this.iadd(o);
        return o.negative = 1, h._normSign();
      } else if (this.negative !== 0)
        return this.negative = 0, this.iadd(o), this.negative = 1, this._normSign();
      var d = this.cmp(o);
      if (d === 0)
        return this.negative = 0, this.length = 1, this.words[0] = 0, this;
      var g, w;
      d > 0 ? (g = this, w = o) : (g = o, w = this);
      for (var M = 0, S = 0; S < w.length; S++)
        h = (g.words[S] | 0) - (w.words[S] | 0) + M, M = h >> 26, this.words[S] = h & 67108863;
      for (; M !== 0 && S < g.length; S++)
        h = (g.words[S] | 0) + M, M = h >> 26, this.words[S] = h & 67108863;
      if (M === 0 && S < g.length && g !== this)
        for (; S < g.length; S++)
          this.words[S] = g.words[S];
      return this.length = Math.max(this.length, S), g !== this && (this.negative = 1), this._strip();
    }, "isub"), s.prototype.sub = /* @__PURE__ */ a(function(o) {
      return this.clone().isub(o);
    }, "sub");
    function $(b, o, h) {
      h.negative = o.negative ^ b.negative;
      var d = b.length + o.length | 0;
      h.length = d, d = d - 1 | 0;
      var g = b.words[0] | 0, w = o.words[0] | 0, M = g * w, S = M & 67108863, v = M / 67108864 | 0;
      h.words[0] = S;
      for (var f = 1; f < d; f++) {
        for (var m = v >>> 26, U = v & 67108863, u = Math.min(f, o.length - 1), I = Math.max(0, f - b.length + 1); I <= u; I++) {
          var N = f - I | 0;
          g = b.words[N] | 0, w = o.words[I] | 0, M = g * w + U, m += M / 67108864 | 0, U = M & 67108863;
        }
        h.words[f] = U | 0, v = m | 0;
      }
      return v !== 0 ? h.words[f] = v | 0 : h.length--, h._strip();
    }
    a($, "smallMulTo");
    var j = /* @__PURE__ */ a(function(o, h, d) {
      var g = o.words, w = h.words, M = d.words, S = 0, v, f, m, U = g[0] | 0, u = U & 8191, I = U >>> 13, N = g[1] | 0, F = N & 8191, q = N >>> 13, D = g[2] | 0, C = D & 8191, O = D >>> 13, qe = g[3] | 0, T = qe & 8191, k = qe >>> 13, It = g[4] | 0, ee = It & 8191, te = It >>> 13, Rt = g[5] | 0, re = Rt & 8191, ie = Rt >>> 13, Nt = g[6] | 0, ne = Nt & 8191, se = Nt >>> 13, Ft = g[7] | 0, oe = Ft & 8191, ae = Ft >>> 13, Pt = g[8] | 0, fe = Pt & 8191, he = Pt >>> 13, qt = g[9] | 0, ue = qt & 8191, ce = qt >>> 13, Ot = w[0] | 0, le = Ot & 8191, de = Ot >>> 13, Ct = w[1] | 0, pe = Ct & 8191, ve = Ct >>> 13, Tt = w[2] | 0, ge = Tt & 8191, me = Tt >>> 13, $t = w[3] | 0, ye = $t & 8191, we = $t >>> 13, Lt = w[4] | 0, be = Lt & 8191, xe = Lt >>> 13, Dt = w[5] | 0, _e = Dt & 8191, Me = Dt >>> 13, Ut = w[6] | 0, Se = Ut & 8191, Ae = Ut >>> 13, kt = w[7] | 0, Ee = kt & 8191, Ie = kt >>> 13, zt = w[8] | 0, Re = zt & 8191, Ne = zt >>> 13, Bt = w[9] | 0, Fe = Bt & 8191, Pe = Bt >>> 13;
      d.negative = o.negative ^ h.negative, d.length = 19, v = Math.imul(u, le), f = Math.imul(u, de), f = f + Math.imul(I, le) | 0, m = Math.imul(I, de);
      var vt = (S + v | 0) + ((f & 8191) << 13) | 0;
      S = (m + (f >>> 13) | 0) + (vt >>> 26) | 0, vt &= 67108863, v = Math.imul(F, le), f = Math.imul(F, de), f = f + Math.imul(q, le) | 0, m = Math.imul(q, de), v = v + Math.imul(u, pe) | 0, f = f + Math.imul(u, ve) | 0, f = f + Math.imul(I, pe) | 0, m = m + Math.imul(I, ve) | 0;
      var gt = (S + v | 0) + ((f & 8191) << 13) | 0;
      S = (m + (f >>> 13) | 0) + (gt >>> 26) | 0, gt &= 67108863, v = Math.imul(C, le), f = Math.imul(C, de), f = f + Math.imul(O, le) | 0, m = Math.imul(O, de), v = v + Math.imul(F, pe) | 0, f = f + Math.imul(F, ve) | 0, f = f + Math.imul(q, pe) | 0, m = m + Math.imul(q, ve) | 0, v = v + Math.imul(u, ge) | 0, f = f + Math.imul(u, me) | 0, f = f + Math.imul(I, ge) | 0, m = m + Math.imul(I, me) | 0;
      var mt = (S + v | 0) + ((f & 8191) << 13) | 0;
      S = (m + (f >>> 13) | 0) + (mt >>> 26) | 0, mt &= 67108863, v = Math.imul(T, le), f = Math.imul(T, de), f = f + Math.imul(k, le) | 0, m = Math.imul(k, de), v = v + Math.imul(C, pe) | 0, f = f + Math.imul(C, ve) | 0, f = f + Math.imul(O, pe) | 0, m = m + Math.imul(O, ve) | 0, v = v + Math.imul(F, ge) | 0, f = f + Math.imul(F, me) | 0, f = f + Math.imul(q, ge) | 0, m = m + Math.imul(q, me) | 0, v = v + Math.imul(u, ye) | 0, f = f + Math.imul(u, we) | 0, f = f + Math.imul(I, ye) | 0, m = m + Math.imul(I, we) | 0;
      var yt = (S + v | 0) + ((f & 8191) << 13) | 0;
      S = (m + (f >>> 13) | 0) + (yt >>> 26) | 0, yt &= 67108863, v = Math.imul(ee, le), f = Math.imul(ee, de), f = f + Math.imul(te, le) | 0, m = Math.imul(te, de), v = v + Math.imul(T, pe) | 0, f = f + Math.imul(T, ve) | 0, f = f + Math.imul(k, pe) | 0, m = m + Math.imul(k, ve) | 0, v = v + Math.imul(C, ge) | 0, f = f + Math.imul(C, me) | 0, f = f + Math.imul(O, ge) | 0, m = m + Math.imul(O, me) | 0, v = v + Math.imul(F, ye) | 0, f = f + Math.imul(F, we) | 0, f = f + Math.imul(q, ye) | 0, m = m + Math.imul(q, we) | 0, v = v + Math.imul(u, be) | 0, f = f + Math.imul(u, xe) | 0, f = f + Math.imul(I, be) | 0, m = m + Math.imul(I, xe) | 0;
      var wt = (S + v | 0) + ((f & 8191) << 13) | 0;
      S = (m + (f >>> 13) | 0) + (wt >>> 26) | 0, wt &= 67108863, v = Math.imul(re, le), f = Math.imul(re, de), f = f + Math.imul(ie, le) | 0, m = Math.imul(ie, de), v = v + Math.imul(ee, pe) | 0, f = f + Math.imul(ee, ve) | 0, f = f + Math.imul(te, pe) | 0, m = m + Math.imul(te, ve) | 0, v = v + Math.imul(T, ge) | 0, f = f + Math.imul(T, me) | 0, f = f + Math.imul(k, ge) | 0, m = m + Math.imul(k, me) | 0, v = v + Math.imul(C, ye) | 0, f = f + Math.imul(C, we) | 0, f = f + Math.imul(O, ye) | 0, m = m + Math.imul(O, we) | 0, v = v + Math.imul(F, be) | 0, f = f + Math.imul(F, xe) | 0, f = f + Math.imul(q, be) | 0, m = m + Math.imul(q, xe) | 0, v = v + Math.imul(u, _e) | 0, f = f + Math.imul(u, Me) | 0, f = f + Math.imul(I, _e) | 0, m = m + Math.imul(I, Me) | 0;
      var Vr = (S + v | 0) + ((f & 8191) << 13) | 0;
      S = (m + (f >>> 13) | 0) + (Vr >>> 26) | 0, Vr &= 67108863, v = Math.imul(ne, le), f = Math.imul(ne, de), f = f + Math.imul(se, le) | 0, m = Math.imul(se, de), v = v + Math.imul(re, pe) | 0, f = f + Math.imul(re, ve) | 0, f = f + Math.imul(ie, pe) | 0, m = m + Math.imul(ie, ve) | 0, v = v + Math.imul(ee, ge) | 0, f = f + Math.imul(ee, me) | 0, f = f + Math.imul(te, ge) | 0, m = m + Math.imul(te, me) | 0, v = v + Math.imul(T, ye) | 0, f = f + Math.imul(T, we) | 0, f = f + Math.imul(k, ye) | 0, m = m + Math.imul(k, we) | 0, v = v + Math.imul(C, be) | 0, f = f + Math.imul(C, xe) | 0, f = f + Math.imul(O, be) | 0, m = m + Math.imul(O, xe) | 0, v = v + Math.imul(F, _e) | 0, f = f + Math.imul(F, Me) | 0, f = f + Math.imul(q, _e) | 0, m = m + Math.imul(q, Me) | 0, v = v + Math.imul(u, Se) | 0, f = f + Math.imul(u, Ae) | 0, f = f + Math.imul(I, Se) | 0, m = m + Math.imul(I, Ae) | 0;
      var Kr = (S + v | 0) + ((f & 8191) << 13) | 0;
      S = (m + (f >>> 13) | 0) + (Kr >>> 26) | 0, Kr &= 67108863, v = Math.imul(oe, le), f = Math.imul(oe, de), f = f + Math.imul(ae, le) | 0, m = Math.imul(ae, de), v = v + Math.imul(ne, pe) | 0, f = f + Math.imul(ne, ve) | 0, f = f + Math.imul(se, pe) | 0, m = m + Math.imul(se, ve) | 0, v = v + Math.imul(re, ge) | 0, f = f + Math.imul(re, me) | 0, f = f + Math.imul(ie, ge) | 0, m = m + Math.imul(ie, me) | 0, v = v + Math.imul(ee, ye) | 0, f = f + Math.imul(ee, we) | 0, f = f + Math.imul(te, ye) | 0, m = m + Math.imul(te, we) | 0, v = v + Math.imul(T, be) | 0, f = f + Math.imul(T, xe) | 0, f = f + Math.imul(k, be) | 0, m = m + Math.imul(k, xe) | 0, v = v + Math.imul(C, _e) | 0, f = f + Math.imul(C, Me) | 0, f = f + Math.imul(O, _e) | 0, m = m + Math.imul(O, Me) | 0, v = v + Math.imul(F, Se) | 0, f = f + Math.imul(F, Ae) | 0, f = f + Math.imul(q, Se) | 0, m = m + Math.imul(q, Ae) | 0, v = v + Math.imul(u, Ee) | 0, f = f + Math.imul(u, Ie) | 0, f = f + Math.imul(I, Ee) | 0, m = m + Math.imul(I, Ie) | 0;
      var jr = (S + v | 0) + ((f & 8191) << 13) | 0;
      S = (m + (f >>> 13) | 0) + (jr >>> 26) | 0, jr &= 67108863, v = Math.imul(fe, le), f = Math.imul(fe, de), f = f + Math.imul(he, le) | 0, m = Math.imul(he, de), v = v + Math.imul(oe, pe) | 0, f = f + Math.imul(oe, ve) | 0, f = f + Math.imul(ae, pe) | 0, m = m + Math.imul(ae, ve) | 0, v = v + Math.imul(ne, ge) | 0, f = f + Math.imul(ne, me) | 0, f = f + Math.imul(se, ge) | 0, m = m + Math.imul(se, me) | 0, v = v + Math.imul(re, ye) | 0, f = f + Math.imul(re, we) | 0, f = f + Math.imul(ie, ye) | 0, m = m + Math.imul(ie, we) | 0, v = v + Math.imul(ee, be) | 0, f = f + Math.imul(ee, xe) | 0, f = f + Math.imul(te, be) | 0, m = m + Math.imul(te, xe) | 0, v = v + Math.imul(T, _e) | 0, f = f + Math.imul(T, Me) | 0, f = f + Math.imul(k, _e) | 0, m = m + Math.imul(k, Me) | 0, v = v + Math.imul(C, Se) | 0, f = f + Math.imul(C, Ae) | 0, f = f + Math.imul(O, Se) | 0, m = m + Math.imul(O, Ae) | 0, v = v + Math.imul(F, Ee) | 0, f = f + Math.imul(F, Ie) | 0, f = f + Math.imul(q, Ee) | 0, m = m + Math.imul(q, Ie) | 0, v = v + Math.imul(u, Re) | 0, f = f + Math.imul(u, Ne) | 0, f = f + Math.imul(I, Re) | 0, m = m + Math.imul(I, Ne) | 0;
      var Gr = (S + v | 0) + ((f & 8191) << 13) | 0;
      S = (m + (f >>> 13) | 0) + (Gr >>> 26) | 0, Gr &= 67108863, v = Math.imul(ue, le), f = Math.imul(ue, de), f = f + Math.imul(ce, le) | 0, m = Math.imul(ce, de), v = v + Math.imul(fe, pe) | 0, f = f + Math.imul(fe, ve) | 0, f = f + Math.imul(he, pe) | 0, m = m + Math.imul(he, ve) | 0, v = v + Math.imul(oe, ge) | 0, f = f + Math.imul(oe, me) | 0, f = f + Math.imul(ae, ge) | 0, m = m + Math.imul(ae, me) | 0, v = v + Math.imul(ne, ye) | 0, f = f + Math.imul(ne, we) | 0, f = f + Math.imul(se, ye) | 0, m = m + Math.imul(se, we) | 0, v = v + Math.imul(re, be) | 0, f = f + Math.imul(re, xe) | 0, f = f + Math.imul(ie, be) | 0, m = m + Math.imul(ie, xe) | 0, v = v + Math.imul(ee, _e) | 0, f = f + Math.imul(ee, Me) | 0, f = f + Math.imul(te, _e) | 0, m = m + Math.imul(te, Me) | 0, v = v + Math.imul(T, Se) | 0, f = f + Math.imul(T, Ae) | 0, f = f + Math.imul(k, Se) | 0, m = m + Math.imul(k, Ae) | 0, v = v + Math.imul(C, Ee) | 0, f = f + Math.imul(C, Ie) | 0, f = f + Math.imul(O, Ee) | 0, m = m + Math.imul(O, Ie) | 0, v = v + Math.imul(F, Re) | 0, f = f + Math.imul(F, Ne) | 0, f = f + Math.imul(q, Re) | 0, m = m + Math.imul(q, Ne) | 0, v = v + Math.imul(u, Fe) | 0, f = f + Math.imul(u, Pe) | 0, f = f + Math.imul(I, Fe) | 0, m = m + Math.imul(I, Pe) | 0;
      var Hr = (S + v | 0) + ((f & 8191) << 13) | 0;
      S = (m + (f >>> 13) | 0) + (Hr >>> 26) | 0, Hr &= 67108863, v = Math.imul(ue, pe), f = Math.imul(ue, ve), f = f + Math.imul(ce, pe) | 0, m = Math.imul(ce, ve), v = v + Math.imul(fe, ge) | 0, f = f + Math.imul(fe, me) | 0, f = f + Math.imul(he, ge) | 0, m = m + Math.imul(he, me) | 0, v = v + Math.imul(oe, ye) | 0, f = f + Math.imul(oe, we) | 0, f = f + Math.imul(ae, ye) | 0, m = m + Math.imul(ae, we) | 0, v = v + Math.imul(ne, be) | 0, f = f + Math.imul(ne, xe) | 0, f = f + Math.imul(se, be) | 0, m = m + Math.imul(se, xe) | 0, v = v + Math.imul(re, _e) | 0, f = f + Math.imul(re, Me) | 0, f = f + Math.imul(ie, _e) | 0, m = m + Math.imul(ie, Me) | 0, v = v + Math.imul(ee, Se) | 0, f = f + Math.imul(ee, Ae) | 0, f = f + Math.imul(te, Se) | 0, m = m + Math.imul(te, Ae) | 0, v = v + Math.imul(T, Ee) | 0, f = f + Math.imul(T, Ie) | 0, f = f + Math.imul(k, Ee) | 0, m = m + Math.imul(k, Ie) | 0, v = v + Math.imul(C, Re) | 0, f = f + Math.imul(C, Ne) | 0, f = f + Math.imul(O, Re) | 0, m = m + Math.imul(O, Ne) | 0, v = v + Math.imul(F, Fe) | 0, f = f + Math.imul(F, Pe) | 0, f = f + Math.imul(q, Fe) | 0, m = m + Math.imul(q, Pe) | 0;
      var Jr = (S + v | 0) + ((f & 8191) << 13) | 0;
      S = (m + (f >>> 13) | 0) + (Jr >>> 26) | 0, Jr &= 67108863, v = Math.imul(ue, ge), f = Math.imul(ue, me), f = f + Math.imul(ce, ge) | 0, m = Math.imul(ce, me), v = v + Math.imul(fe, ye) | 0, f = f + Math.imul(fe, we) | 0, f = f + Math.imul(he, ye) | 0, m = m + Math.imul(he, we) | 0, v = v + Math.imul(oe, be) | 0, f = f + Math.imul(oe, xe) | 0, f = f + Math.imul(ae, be) | 0, m = m + Math.imul(ae, xe) | 0, v = v + Math.imul(ne, _e) | 0, f = f + Math.imul(ne, Me) | 0, f = f + Math.imul(se, _e) | 0, m = m + Math.imul(se, Me) | 0, v = v + Math.imul(re, Se) | 0, f = f + Math.imul(re, Ae) | 0, f = f + Math.imul(ie, Se) | 0, m = m + Math.imul(ie, Ae) | 0, v = v + Math.imul(ee, Ee) | 0, f = f + Math.imul(ee, Ie) | 0, f = f + Math.imul(te, Ee) | 0, m = m + Math.imul(te, Ie) | 0, v = v + Math.imul(T, Re) | 0, f = f + Math.imul(T, Ne) | 0, f = f + Math.imul(k, Re) | 0, m = m + Math.imul(k, Ne) | 0, v = v + Math.imul(C, Fe) | 0, f = f + Math.imul(C, Pe) | 0, f = f + Math.imul(O, Fe) | 0, m = m + Math.imul(O, Pe) | 0;
      var Wr = (S + v | 0) + ((f & 8191) << 13) | 0;
      S = (m + (f >>> 13) | 0) + (Wr >>> 26) | 0, Wr &= 67108863, v = Math.imul(ue, ye), f = Math.imul(ue, we), f = f + Math.imul(ce, ye) | 0, m = Math.imul(ce, we), v = v + Math.imul(fe, be) | 0, f = f + Math.imul(fe, xe) | 0, f = f + Math.imul(he, be) | 0, m = m + Math.imul(he, xe) | 0, v = v + Math.imul(oe, _e) | 0, f = f + Math.imul(oe, Me) | 0, f = f + Math.imul(ae, _e) | 0, m = m + Math.imul(ae, Me) | 0, v = v + Math.imul(ne, Se) | 0, f = f + Math.imul(ne, Ae) | 0, f = f + Math.imul(se, Se) | 0, m = m + Math.imul(se, Ae) | 0, v = v + Math.imul(re, Ee) | 0, f = f + Math.imul(re, Ie) | 0, f = f + Math.imul(ie, Ee) | 0, m = m + Math.imul(ie, Ie) | 0, v = v + Math.imul(ee, Re) | 0, f = f + Math.imul(ee, Ne) | 0, f = f + Math.imul(te, Re) | 0, m = m + Math.imul(te, Ne) | 0, v = v + Math.imul(T, Fe) | 0, f = f + Math.imul(T, Pe) | 0, f = f + Math.imul(k, Fe) | 0, m = m + Math.imul(k, Pe) | 0;
      var Xr = (S + v | 0) + ((f & 8191) << 13) | 0;
      S = (m + (f >>> 13) | 0) + (Xr >>> 26) | 0, Xr &= 67108863, v = Math.imul(ue, be), f = Math.imul(ue, xe), f = f + Math.imul(ce, be) | 0, m = Math.imul(ce, xe), v = v + Math.imul(fe, _e) | 0, f = f + Math.imul(fe, Me) | 0, f = f + Math.imul(he, _e) | 0, m = m + Math.imul(he, Me) | 0, v = v + Math.imul(oe, Se) | 0, f = f + Math.imul(oe, Ae) | 0, f = f + Math.imul(ae, Se) | 0, m = m + Math.imul(ae, Ae) | 0, v = v + Math.imul(ne, Ee) | 0, f = f + Math.imul(ne, Ie) | 0, f = f + Math.imul(se, Ee) | 0, m = m + Math.imul(se, Ie) | 0, v = v + Math.imul(re, Re) | 0, f = f + Math.imul(re, Ne) | 0, f = f + Math.imul(ie, Re) | 0, m = m + Math.imul(ie, Ne) | 0, v = v + Math.imul(ee, Fe) | 0, f = f + Math.imul(ee, Pe) | 0, f = f + Math.imul(te, Fe) | 0, m = m + Math.imul(te, Pe) | 0;
      var Yr = (S + v | 0) + ((f & 8191) << 13) | 0;
      S = (m + (f >>> 13) | 0) + (Yr >>> 26) | 0, Yr &= 67108863, v = Math.imul(ue, _e), f = Math.imul(ue, Me), f = f + Math.imul(ce, _e) | 0, m = Math.imul(ce, Me), v = v + Math.imul(fe, Se) | 0, f = f + Math.imul(fe, Ae) | 0, f = f + Math.imul(he, Se) | 0, m = m + Math.imul(he, Ae) | 0, v = v + Math.imul(oe, Ee) | 0, f = f + Math.imul(oe, Ie) | 0, f = f + Math.imul(ae, Ee) | 0, m = m + Math.imul(ae, Ie) | 0, v = v + Math.imul(ne, Re) | 0, f = f + Math.imul(ne, Ne) | 0, f = f + Math.imul(se, Re) | 0, m = m + Math.imul(se, Ne) | 0, v = v + Math.imul(re, Fe) | 0, f = f + Math.imul(re, Pe) | 0, f = f + Math.imul(ie, Fe) | 0, m = m + Math.imul(ie, Pe) | 0;
      var Zr = (S + v | 0) + ((f & 8191) << 13) | 0;
      S = (m + (f >>> 13) | 0) + (Zr >>> 26) | 0, Zr &= 67108863, v = Math.imul(ue, Se), f = Math.imul(ue, Ae), f = f + Math.imul(ce, Se) | 0, m = Math.imul(ce, Ae), v = v + Math.imul(fe, Ee) | 0, f = f + Math.imul(fe, Ie) | 0, f = f + Math.imul(he, Ee) | 0, m = m + Math.imul(he, Ie) | 0, v = v + Math.imul(oe, Re) | 0, f = f + Math.imul(oe, Ne) | 0, f = f + Math.imul(ae, Re) | 0, m = m + Math.imul(ae, Ne) | 0, v = v + Math.imul(ne, Fe) | 0, f = f + Math.imul(ne, Pe) | 0, f = f + Math.imul(se, Fe) | 0, m = m + Math.imul(se, Pe) | 0;
      var Qr = (S + v | 0) + ((f & 8191) << 13) | 0;
      S = (m + (f >>> 13) | 0) + (Qr >>> 26) | 0, Qr &= 67108863, v = Math.imul(ue, Ee), f = Math.imul(ue, Ie), f = f + Math.imul(ce, Ee) | 0, m = Math.imul(ce, Ie), v = v + Math.imul(fe, Re) | 0, f = f + Math.imul(fe, Ne) | 0, f = f + Math.imul(he, Re) | 0, m = m + Math.imul(he, Ne) | 0, v = v + Math.imul(oe, Fe) | 0, f = f + Math.imul(oe, Pe) | 0, f = f + Math.imul(ae, Fe) | 0, m = m + Math.imul(ae, Pe) | 0;
      var ei = (S + v | 0) + ((f & 8191) << 13) | 0;
      S = (m + (f >>> 13) | 0) + (ei >>> 26) | 0, ei &= 67108863, v = Math.imul(ue, Re), f = Math.imul(ue, Ne), f = f + Math.imul(ce, Re) | 0, m = Math.imul(ce, Ne), v = v + Math.imul(fe, Fe) | 0, f = f + Math.imul(fe, Pe) | 0, f = f + Math.imul(he, Fe) | 0, m = m + Math.imul(he, Pe) | 0;
      var ti = (S + v | 0) + ((f & 8191) << 13) | 0;
      S = (m + (f >>> 13) | 0) + (ti >>> 26) | 0, ti &= 67108863, v = Math.imul(ue, Fe), f = Math.imul(ue, Pe), f = f + Math.imul(ce, Fe) | 0, m = Math.imul(ce, Pe);
      var ri = (S + v | 0) + ((f & 8191) << 13) | 0;
      return S = (m + (f >>> 13) | 0) + (ri >>> 26) | 0, ri &= 67108863, M[0] = vt, M[1] = gt, M[2] = mt, M[3] = yt, M[4] = wt, M[5] = Vr, M[6] = Kr, M[7] = jr, M[8] = Gr, M[9] = Hr, M[10] = Jr, M[11] = Wr, M[12] = Xr, M[13] = Yr, M[14] = Zr, M[15] = Qr, M[16] = ei, M[17] = ti, M[18] = ri, S !== 0 && (M[19] = S, d.length++), d;
    }, "comb10MulTo");
    Math.imul || (j = $);
    function J(b, o, h) {
      h.negative = o.negative ^ b.negative, h.length = b.length + o.length;
      for (var d = 0, g = 0, w = 0; w < h.length - 1; w++) {
        var M = g;
        g = 0;
        for (var S = d & 67108863, v = Math.min(w, o.length - 1), f = Math.max(0, w - b.length + 1); f <= v; f++) {
          var m = w - f, U = b.words[m] | 0, u = o.words[f] | 0, I = U * u, N = I & 67108863;
          M = M + (I / 67108864 | 0) | 0, N = N + S | 0, S = N & 67108863, M = M + (N >>> 26) | 0, g += M >>> 26, M &= 67108863;
        }
        h.words[w] = S, d = M, M = g;
      }
      return d !== 0 ? h.words[w] = d : h.length--, h._strip();
    }
    a(J, "bigMulTo");
    function V(b, o, h) {
      return J(b, o, h);
    }
    a(V, "jumboMulTo"), s.prototype.mulTo = /* @__PURE__ */ a(function(o, h) {
      var d, g = this.length + o.length;
      return this.length === 10 && o.length === 10 ? d = j(this, o, h) : g < 63 ? d = $(this, o, h) : g < 1024 ? d = J(this, o, h) : d = V(this, o, h), d;
    }, "mulTo"), s.prototype.mul = /* @__PURE__ */ a(function(o) {
      var h = new s(null);
      return h.words = new Array(this.length + o.length), this.mulTo(o, h);
    }, "mul"), s.prototype.mulf = /* @__PURE__ */ a(function(o) {
      var h = new s(null);
      return h.words = new Array(this.length + o.length), V(this, o, h);
    }, "mulf"), s.prototype.imul = /* @__PURE__ */ a(function(o) {
      return this.clone().mulTo(o, this);
    }, "imul"), s.prototype.imuln = /* @__PURE__ */ a(function(o) {
      var h = o < 0;
      h && (o = -o), r(typeof o == "number"), r(o < 67108864);
      for (var d = 0, g = 0; g < this.length; g++) {
        var w = (this.words[g] | 0) * o, M = (w & 67108863) + (d & 67108863);
        d >>= 26, d += w / 67108864 | 0, d += M >>> 26, this.words[g] = M & 67108863;
      }
      return d !== 0 && (this.words[g] = d, this.length++), h ? this.ineg() : this;
    }, "imuln"), s.prototype.muln = /* @__PURE__ */ a(function(o) {
      return this.clone().imuln(o);
    }, "muln"), s.prototype.sqr = /* @__PURE__ */ a(function() {
      return this.mul(this);
    }, "sqr"), s.prototype.isqr = /* @__PURE__ */ a(function() {
      return this.imul(this.clone());
    }, "isqr"), s.prototype.pow = /* @__PURE__ */ a(function(o) {
      var h = L(o);
      if (h.length === 0)
        return new s(1);
      for (var d = this, g = 0; g < h.length && h[g] === 0; g++, d = d.sqr())
        ;
      if (++g < h.length)
        for (var w = d.sqr(); g < h.length; g++, w = w.sqr())
          h[g] !== 0 && (d = d.mul(w));
      return d;
    }, "pow"), s.prototype.iushln = /* @__PURE__ */ a(function(o) {
      r(typeof o == "number" && o >= 0);
      var h = o % 26, d = (o - h) / 26, g = 67108863 >>> 26 - h << 26 - h, w;
      if (h !== 0) {
        var M = 0;
        for (w = 0; w < this.length; w++) {
          var S = this.words[w] & g, v = (this.words[w] | 0) - S << h;
          this.words[w] = v | M, M = S >>> 26 - h;
        }
        M && (this.words[w] = M, this.length++);
      }
      if (d !== 0) {
        for (w = this.length - 1; w >= 0; w--)
          this.words[w + d] = this.words[w];
        for (w = 0; w < d; w++)
          this.words[w] = 0;
        this.length += d;
      }
      return this._strip();
    }, "iushln"), s.prototype.ishln = /* @__PURE__ */ a(function(o) {
      return r(this.negative === 0), this.iushln(o);
    }, "ishln"), s.prototype.iushrn = /* @__PURE__ */ a(function(o, h, d) {
      r(typeof o == "number" && o >= 0);
      var g;
      h ? g = (h - h % 26) / 26 : g = 0;
      var w = o % 26, M = Math.min((o - w) / 26, this.length), S = 67108863 ^ 67108863 >>> w << w, v = d;
      if (g -= M, g = Math.max(0, g), v) {
        for (var f = 0; f < M; f++)
          v.words[f] = this.words[f];
        v.length = M;
      }
      if (M !== 0)
        if (this.length > M)
          for (this.length -= M, f = 0; f < this.length; f++)
            this.words[f] = this.words[f + M];
        else
          this.words[0] = 0, this.length = 1;
      var m = 0;
      for (f = this.length - 1; f >= 0 && (m !== 0 || f >= g); f--) {
        var U = this.words[f] | 0;
        this.words[f] = m << 26 - w | U >>> w, m = U & S;
      }
      return v && m !== 0 && (v.words[v.length++] = m), this.length === 0 && (this.words[0] = 0, this.length = 1), this._strip();
    }, "iushrn"), s.prototype.ishrn = /* @__PURE__ */ a(function(o, h, d) {
      return r(this.negative === 0), this.iushrn(o, h, d);
    }, "ishrn"), s.prototype.shln = /* @__PURE__ */ a(function(o) {
      return this.clone().ishln(o);
    }, "shln"), s.prototype.ushln = /* @__PURE__ */ a(function(o) {
      return this.clone().iushln(o);
    }, "ushln"), s.prototype.shrn = /* @__PURE__ */ a(function(o) {
      return this.clone().ishrn(o);
    }, "shrn"), s.prototype.ushrn = /* @__PURE__ */ a(function(o) {
      return this.clone().iushrn(o);
    }, "ushrn"), s.prototype.testn = /* @__PURE__ */ a(function(o) {
      r(typeof o == "number" && o >= 0);
      var h = o % 26, d = (o - h) / 26, g = 1 << h;
      if (this.length <= d)
        return !1;
      var w = this.words[d];
      return !!(w & g);
    }, "testn"), s.prototype.imaskn = /* @__PURE__ */ a(function(o) {
      r(typeof o == "number" && o >= 0);
      var h = o % 26, d = (o - h) / 26;
      if (r(this.negative === 0, "imaskn works only with positive numbers"), this.length <= d)
        return this;
      if (h !== 0 && d++, this.length = Math.min(d, this.length), h !== 0) {
        var g = 67108863 ^ 67108863 >>> h << h;
        this.words[this.length - 1] &= g;
      }
      return this._strip();
    }, "imaskn"), s.prototype.maskn = /* @__PURE__ */ a(function(o) {
      return this.clone().imaskn(o);
    }, "maskn"), s.prototype.iaddn = /* @__PURE__ */ a(function(o) {
      return r(typeof o == "number"), r(o < 67108864), o < 0 ? this.isubn(-o) : this.negative !== 0 ? this.length === 1 && (this.words[0] | 0) <= o ? (this.words[0] = o - (this.words[0] | 0), this.negative = 0, this) : (this.negative = 0, this.isubn(o), this.negative = 1, this) : this._iaddn(o);
    }, "iaddn"), s.prototype._iaddn = /* @__PURE__ */ a(function(o) {
      this.words[0] += o;
      for (var h = 0; h < this.length && this.words[h] >= 67108864; h++)
        this.words[h] -= 67108864, h === this.length - 1 ? this.words[h + 1] = 1 : this.words[h + 1]++;
      return this.length = Math.max(this.length, h + 1), this;
    }, "_iaddn"), s.prototype.isubn = /* @__PURE__ */ a(function(o) {
      if (r(typeof o == "number"), r(o < 67108864), o < 0)
        return this.iaddn(-o);
      if (this.negative !== 0)
        return this.negative = 0, this.iaddn(o), this.negative = 1, this;
      if (this.words[0] -= o, this.length === 1 && this.words[0] < 0)
        this.words[0] = -this.words[0], this.negative = 1;
      else
        for (var h = 0; h < this.length && this.words[h] < 0; h++)
          this.words[h] += 67108864, this.words[h + 1] -= 1;
      return this._strip();
    }, "isubn"), s.prototype.addn = /* @__PURE__ */ a(function(o) {
      return this.clone().iaddn(o);
    }, "addn"), s.prototype.subn = /* @__PURE__ */ a(function(o) {
      return this.clone().isubn(o);
    }, "subn"), s.prototype.iabs = /* @__PURE__ */ a(function() {
      return this.negative = 0, this;
    }, "iabs"), s.prototype.abs = /* @__PURE__ */ a(function() {
      return this.clone().iabs();
    }, "abs"), s.prototype._ishlnsubmul = /* @__PURE__ */ a(function(o, h, d) {
      var g = o.length + d, w;
      this._expand(g);
      var M, S = 0;
      for (w = 0; w < o.length; w++) {
        M = (this.words[w + d] | 0) + S;
        var v = (o.words[w] | 0) * h;
        M -= v & 67108863, S = (M >> 26) - (v / 67108864 | 0), this.words[w + d] = M & 67108863;
      }
      for (; w < this.length - d; w++)
        M = (this.words[w + d] | 0) + S, S = M >> 26, this.words[w + d] = M & 67108863;
      if (S === 0)
        return this._strip();
      for (r(S === -1), S = 0, w = 0; w < this.length; w++)
        M = -(this.words[w] | 0) + S, S = M >> 26, this.words[w] = M & 67108863;
      return this.negative = 1, this._strip();
    }, "_ishlnsubmul"), s.prototype._wordDiv = /* @__PURE__ */ a(function(o, h) {
      var d = this.length - o.length, g = this.clone(), w = o, M = w.words[w.length - 1] | 0, S = this._countBits(M);
      d = 26 - S, d !== 0 && (w = w.ushln(d), g.iushln(d), M = w.words[w.length - 1] | 0);
      var v = g.length - w.length, f;
      if (h !== "mod") {
        f = new s(null), f.length = v + 1, f.words = new Array(f.length);
        for (var m = 0; m < f.length; m++)
          f.words[m] = 0;
      }
      var U = g.clone()._ishlnsubmul(w, 1, v);
      U.negative === 0 && (g = U, f && (f.words[v] = 1));
      for (var u = v - 1; u >= 0; u--) {
        var I = (g.words[w.length + u] | 0) * 67108864 + (g.words[w.length + u - 1] | 0);
        for (I = Math.min(I / M | 0, 67108863), g._ishlnsubmul(w, I, u); g.negative !== 0; )
          I--, g.negative = 0, g._ishlnsubmul(w, 1, u), g.isZero() || (g.negative ^= 1);
        f && (f.words[u] = I);
      }
      return f && f._strip(), g._strip(), h !== "div" && d !== 0 && g.iushrn(d), {
        div: f || null,
        mod: g
      };
    }, "_wordDiv"), s.prototype.divmod = /* @__PURE__ */ a(function(o, h, d) {
      if (r(!o.isZero()), this.isZero())
        return {
          div: new s(0),
          mod: new s(0)
        };
      var g, w, M;
      return this.negative !== 0 && o.negative === 0 ? (M = this.neg().divmod(o, h), h !== "mod" && (g = M.div.neg()), h !== "div" && (w = M.mod.neg(), d && w.negative !== 0 && w.iadd(o)), {
        div: g,
        mod: w
      }) : this.negative === 0 && o.negative !== 0 ? (M = this.divmod(o.neg(), h), h !== "mod" && (g = M.div.neg()), {
        div: g,
        mod: M.mod
      }) : this.negative & o.negative ? (M = this.neg().divmod(o.neg(), h), h !== "div" && (w = M.mod.neg(), d && w.negative !== 0 && w.isub(o)), {
        div: M.div,
        mod: w
      }) : o.length > this.length || this.cmp(o) < 0 ? {
        div: new s(0),
        mod: this
      } : o.length === 1 ? h === "div" ? {
        div: this.divn(o.words[0]),
        mod: null
      } : h === "mod" ? {
        div: null,
        mod: new s(this.modrn(o.words[0]))
      } : {
        div: this.divn(o.words[0]),
        mod: new s(this.modrn(o.words[0]))
      } : this._wordDiv(o, h);
    }, "divmod"), s.prototype.div = /* @__PURE__ */ a(function(o) {
      return this.divmod(o, "div", !1).div;
    }, "div"), s.prototype.mod = /* @__PURE__ */ a(function(o) {
      return this.divmod(o, "mod", !1).mod;
    }, "mod"), s.prototype.umod = /* @__PURE__ */ a(function(o) {
      return this.divmod(o, "mod", !0).mod;
    }, "umod"), s.prototype.divRound = /* @__PURE__ */ a(function(o) {
      var h = this.divmod(o);
      if (h.mod.isZero())
        return h.div;
      var d = h.div.negative !== 0 ? h.mod.isub(o) : h.mod, g = o.ushrn(1), w = o.andln(1), M = d.cmp(g);
      return M < 0 || w === 1 && M === 0 ? h.div : h.div.negative !== 0 ? h.div.isubn(1) : h.div.iaddn(1);
    }, "divRound"), s.prototype.modrn = /* @__PURE__ */ a(function(o) {
      var h = o < 0;
      h && (o = -o), r(o <= 67108863);
      for (var d = (1 << 26) % o, g = 0, w = this.length - 1; w >= 0; w--)
        g = (d * g + (this.words[w] | 0)) % o;
      return h ? -g : g;
    }, "modrn"), s.prototype.modn = /* @__PURE__ */ a(function(o) {
      return this.modrn(o);
    }, "modn"), s.prototype.idivn = /* @__PURE__ */ a(function(o) {
      var h = o < 0;
      h && (o = -o), r(o <= 67108863);
      for (var d = 0, g = this.length - 1; g >= 0; g--) {
        var w = (this.words[g] | 0) + d * 67108864;
        this.words[g] = w / o | 0, d = w % o;
      }
      return this._strip(), h ? this.ineg() : this;
    }, "idivn"), s.prototype.divn = /* @__PURE__ */ a(function(o) {
      return this.clone().idivn(o);
    }, "divn"), s.prototype.egcd = /* @__PURE__ */ a(function(o) {
      r(o.negative === 0), r(!o.isZero());
      var h = this, d = o.clone();
      h.negative !== 0 ? h = h.umod(o) : h = h.clone();
      for (var g = new s(1), w = new s(0), M = new s(0), S = new s(1), v = 0; h.isEven() && d.isEven(); )
        h.iushrn(1), d.iushrn(1), ++v;
      for (var f = d.clone(), m = h.clone(); !h.isZero(); ) {
        for (var U = 0, u = 1; !(h.words[0] & u) && U < 26; ++U, u <<= 1)
          ;
        if (U > 0)
          for (h.iushrn(U); U-- > 0; )
            (g.isOdd() || w.isOdd()) && (g.iadd(f), w.isub(m)), g.iushrn(1), w.iushrn(1);
        for (var I = 0, N = 1; !(d.words[0] & N) && I < 26; ++I, N <<= 1)
          ;
        if (I > 0)
          for (d.iushrn(I); I-- > 0; )
            (M.isOdd() || S.isOdd()) && (M.iadd(f), S.isub(m)), M.iushrn(1), S.iushrn(1);
        h.cmp(d) >= 0 ? (h.isub(d), g.isub(M), w.isub(S)) : (d.isub(h), M.isub(g), S.isub(w));
      }
      return {
        a: M,
        b: S,
        gcd: d.iushln(v)
      };
    }, "egcd"), s.prototype._invmp = /* @__PURE__ */ a(function(o) {
      r(o.negative === 0), r(!o.isZero());
      var h = this, d = o.clone();
      h.negative !== 0 ? h = h.umod(o) : h = h.clone();
      for (var g = new s(1), w = new s(0), M = d.clone(); h.cmpn(1) > 0 && d.cmpn(1) > 0; ) {
        for (var S = 0, v = 1; !(h.words[0] & v) && S < 26; ++S, v <<= 1)
          ;
        if (S > 0)
          for (h.iushrn(S); S-- > 0; )
            g.isOdd() && g.iadd(M), g.iushrn(1);
        for (var f = 0, m = 1; !(d.words[0] & m) && f < 26; ++f, m <<= 1)
          ;
        if (f > 0)
          for (d.iushrn(f); f-- > 0; )
            w.isOdd() && w.iadd(M), w.iushrn(1);
        h.cmp(d) >= 0 ? (h.isub(d), g.isub(w)) : (d.isub(h), w.isub(g));
      }
      var U;
      return h.cmpn(1) === 0 ? U = g : U = w, U.cmpn(0) < 0 && U.iadd(o), U;
    }, "_invmp"), s.prototype.gcd = /* @__PURE__ */ a(function(o) {
      if (this.isZero())
        return o.abs();
      if (o.isZero())
        return this.abs();
      var h = this.clone(), d = o.clone();
      h.negative = 0, d.negative = 0;
      for (var g = 0; h.isEven() && d.isEven(); g++)
        h.iushrn(1), d.iushrn(1);
      do {
        for (; h.isEven(); )
          h.iushrn(1);
        for (; d.isEven(); )
          d.iushrn(1);
        var w = h.cmp(d);
        if (w < 0) {
          var M = h;
          h = d, d = M;
        } else if (w === 0 || d.cmpn(1) === 0)
          break;
        h.isub(d);
      } while (!0);
      return d.iushln(g);
    }, "gcd"), s.prototype.invm = /* @__PURE__ */ a(function(o) {
      return this.egcd(o).a.umod(o);
    }, "invm"), s.prototype.isEven = /* @__PURE__ */ a(function() {
      return (this.words[0] & 1) === 0;
    }, "isEven"), s.prototype.isOdd = /* @__PURE__ */ a(function() {
      return (this.words[0] & 1) === 1;
    }, "isOdd"), s.prototype.andln = /* @__PURE__ */ a(function(o) {
      return this.words[0] & o;
    }, "andln"), s.prototype.bincn = /* @__PURE__ */ a(function(o) {
      r(typeof o == "number");
      var h = o % 26, d = (o - h) / 26, g = 1 << h;
      if (this.length <= d)
        return this._expand(d + 1), this.words[d] |= g, this;
      for (var w = g, M = d; w !== 0 && M < this.length; M++) {
        var S = this.words[M] | 0;
        S += w, w = S >>> 26, S &= 67108863, this.words[M] = S;
      }
      return w !== 0 && (this.words[M] = w, this.length++), this;
    }, "bincn"), s.prototype.isZero = /* @__PURE__ */ a(function() {
      return this.length === 1 && this.words[0] === 0;
    }, "isZero"), s.prototype.cmpn = /* @__PURE__ */ a(function(o) {
      var h = o < 0;
      if (this.negative !== 0 && !h)
        return -1;
      if (this.negative === 0 && h)
        return 1;
      this._strip();
      var d;
      if (this.length > 1)
        d = 1;
      else {
        h && (o = -o), r(o <= 67108863, "Number is too big");
        var g = this.words[0] | 0;
        d = g === o ? 0 : g < o ? -1 : 1;
      }
      return this.negative !== 0 ? -d | 0 : d;
    }, "cmpn"), s.prototype.cmp = /* @__PURE__ */ a(function(o) {
      if (this.negative !== 0 && o.negative === 0)
        return -1;
      if (this.negative === 0 && o.negative !== 0)
        return 1;
      var h = this.ucmp(o);
      return this.negative !== 0 ? -h | 0 : h;
    }, "cmp"), s.prototype.ucmp = /* @__PURE__ */ a(function(o) {
      if (this.length > o.length)
        return 1;
      if (this.length < o.length)
        return -1;
      for (var h = 0, d = this.length - 1; d >= 0; d--) {
        var g = this.words[d] | 0, w = o.words[d] | 0;
        if (g !== w) {
          g < w ? h = -1 : g > w && (h = 1);
          break;
        }
      }
      return h;
    }, "ucmp"), s.prototype.gtn = /* @__PURE__ */ a(function(o) {
      return this.cmpn(o) === 1;
    }, "gtn"), s.prototype.gt = /* @__PURE__ */ a(function(o) {
      return this.cmp(o) === 1;
    }, "gt"), s.prototype.gten = /* @__PURE__ */ a(function(o) {
      return this.cmpn(o) >= 0;
    }, "gten"), s.prototype.gte = /* @__PURE__ */ a(function(o) {
      return this.cmp(o) >= 0;
    }, "gte"), s.prototype.ltn = /* @__PURE__ */ a(function(o) {
      return this.cmpn(o) === -1;
    }, "ltn"), s.prototype.lt = /* @__PURE__ */ a(function(o) {
      return this.cmp(o) === -1;
    }, "lt"), s.prototype.lten = /* @__PURE__ */ a(function(o) {
      return this.cmpn(o) <= 0;
    }, "lten"), s.prototype.lte = /* @__PURE__ */ a(function(o) {
      return this.cmp(o) <= 0;
    }, "lte"), s.prototype.eqn = /* @__PURE__ */ a(function(o) {
      return this.cmpn(o) === 0;
    }, "eqn"), s.prototype.eq = /* @__PURE__ */ a(function(o) {
      return this.cmp(o) === 0;
    }, "eq"), s.red = /* @__PURE__ */ a(function(o) {
      return new Q(o);
    }, "red"), s.prototype.toRed = /* @__PURE__ */ a(function(o) {
      return r(!this.red, "Already a number in reduction context"), r(this.negative === 0, "red works only with positives"), o.convertTo(this)._forceRed(o);
    }, "toRed"), s.prototype.fromRed = /* @__PURE__ */ a(function() {
      return r(this.red, "fromRed works only with numbers in reduction context"), this.red.convertFrom(this);
    }, "fromRed"), s.prototype._forceRed = /* @__PURE__ */ a(function(o) {
      return this.red = o, this;
    }, "_forceRed"), s.prototype.forceRed = /* @__PURE__ */ a(function(o) {
      return r(!this.red, "Already a number in reduction context"), this._forceRed(o);
    }, "forceRed"), s.prototype.redAdd = /* @__PURE__ */ a(function(o) {
      return r(this.red, "redAdd works only with red numbers"), this.red.add(this, o);
    }, "redAdd"), s.prototype.redIAdd = /* @__PURE__ */ a(function(o) {
      return r(this.red, "redIAdd works only with red numbers"), this.red.iadd(this, o);
    }, "redIAdd"), s.prototype.redSub = /* @__PURE__ */ a(function(o) {
      return r(this.red, "redSub works only with red numbers"), this.red.sub(this, o);
    }, "redSub"), s.prototype.redISub = /* @__PURE__ */ a(function(o) {
      return r(this.red, "redISub works only with red numbers"), this.red.isub(this, o);
    }, "redISub"), s.prototype.redShl = /* @__PURE__ */ a(function(o) {
      return r(this.red, "redShl works only with red numbers"), this.red.shl(this, o);
    }, "redShl"), s.prototype.redMul = /* @__PURE__ */ a(function(o) {
      return r(this.red, "redMul works only with red numbers"), this.red._verify2(this, o), this.red.mul(this, o);
    }, "redMul"), s.prototype.redIMul = /* @__PURE__ */ a(function(o) {
      return r(this.red, "redMul works only with red numbers"), this.red._verify2(this, o), this.red.imul(this, o);
    }, "redIMul"), s.prototype.redSqr = /* @__PURE__ */ a(function() {
      return r(this.red, "redSqr works only with red numbers"), this.red._verify1(this), this.red.sqr(this);
    }, "redSqr"), s.prototype.redISqr = /* @__PURE__ */ a(function() {
      return r(this.red, "redISqr works only with red numbers"), this.red._verify1(this), this.red.isqr(this);
    }, "redISqr"), s.prototype.redSqrt = /* @__PURE__ */ a(function() {
      return r(this.red, "redSqrt works only with red numbers"), this.red._verify1(this), this.red.sqrt(this);
    }, "redSqrt"), s.prototype.redInvm = /* @__PURE__ */ a(function() {
      return r(this.red, "redInvm works only with red numbers"), this.red._verify1(this), this.red.invm(this);
    }, "redInvm"), s.prototype.redNeg = /* @__PURE__ */ a(function() {
      return r(this.red, "redNeg works only with red numbers"), this.red._verify1(this), this.red.neg(this);
    }, "redNeg"), s.prototype.redPow = /* @__PURE__ */ a(function(o) {
      return r(this.red && !o.red, "redPow(normalNum)"), this.red._verify1(this), this.red.pow(this, o);
    }, "redPow");
    var K = {
      k256: null,
      p224: null,
      p192: null,
      p25519: null
    };
    function G(b, o) {
      this.name = b, this.p = new s(o, 16), this.n = this.p.bitLength(), this.k = new s(1).iushln(this.n).isub(this.p), this.tmp = this._tmp();
    }
    a(G, "MPrime"), G.prototype._tmp = /* @__PURE__ */ a(function() {
      var o = new s(null);
      return o.words = new Array(Math.ceil(this.n / 13)), o;
    }, "_tmp"), G.prototype.ireduce = /* @__PURE__ */ a(function(o) {
      var h = o, d;
      do
        this.split(h, this.tmp), h = this.imulK(h), h = h.iadd(this.tmp), d = h.bitLength();
      while (d > this.n);
      var g = d < this.n ? -1 : h.ucmp(this.p);
      return g === 0 ? (h.words[0] = 0, h.length = 1) : g > 0 ? h.isub(this.p) : h.strip !== void 0 ? h.strip() : h._strip(), h;
    }, "ireduce"), G.prototype.split = /* @__PURE__ */ a(function(o, h) {
      o.iushrn(this.n, 0, h);
    }, "split"), G.prototype.imulK = /* @__PURE__ */ a(function(o) {
      return o.imul(this.k);
    }, "imulK");
    function W() {
      G.call(
        this,
        "k256",
        "ffffffff ffffffff ffffffff ffffffff ffffffff ffffffff fffffffe fffffc2f"
      );
    }
    a(W, "K256"), n(W, G), W.prototype.split = /* @__PURE__ */ a(function(o, h) {
      for (var d = 4194303, g = Math.min(o.length, 9), w = 0; w < g; w++)
        h.words[w] = o.words[w];
      if (h.length = g, o.length <= 9) {
        o.words[0] = 0, o.length = 1;
        return;
      }
      var M = o.words[9];
      for (h.words[h.length++] = M & d, w = 10; w < o.length; w++) {
        var S = o.words[w] | 0;
        o.words[w - 10] = (S & d) << 4 | M >>> 22, M = S;
      }
      M >>>= 22, o.words[w - 10] = M, M === 0 && o.length > 10 ? o.length -= 10 : o.length -= 9;
    }, "split"), W.prototype.imulK = /* @__PURE__ */ a(function(o) {
      o.words[o.length] = 0, o.words[o.length + 1] = 0, o.length += 2;
      for (var h = 0, d = 0; d < o.length; d++) {
        var g = o.words[d] | 0;
        h += g * 977, o.words[d] = h & 67108863, h = g * 64 + (h / 67108864 | 0);
      }
      return o.words[o.length - 1] === 0 && (o.length--, o.words[o.length - 1] === 0 && o.length--), o;
    }, "imulK");
    function Z() {
      G.call(
        this,
        "p224",
        "ffffffff ffffffff ffffffff ffffffff 00000000 00000000 00000001"
      );
    }
    a(Z, "P224"), n(Z, G);
    function $e() {
      G.call(
        this,
        "p192",
        "ffffffff ffffffff ffffffff fffffffe ffffffff ffffffff"
      );
    }
    a($e, "P192"), n($e, G);
    function pt() {
      G.call(
        this,
        "25519",
        "7fffffffffffffff ffffffffffffffff ffffffffffffffff ffffffffffffffed"
      );
    }
    a(pt, "P25519"), n(pt, G), pt.prototype.imulK = /* @__PURE__ */ a(function(o) {
      for (var h = 0, d = 0; d < o.length; d++) {
        var g = (o.words[d] | 0) * 19 + h, w = g & 67108863;
        g >>>= 26, o.words[d] = w, h = g;
      }
      return h !== 0 && (o.words[o.length++] = h), o;
    }, "imulK"), s._prime = /* @__PURE__ */ a(function(o) {
      if (K[o])
        return K[o];
      var h;
      if (o === "k256")
        h = new W();
      else if (o === "p224")
        h = new Z();
      else if (o === "p192")
        h = new $e();
      else if (o === "p25519")
        h = new pt();
      else
        throw new Error("Unknown prime " + o);
      return K[o] = h, h;
    }, "prime");
    function Q(b) {
      if (typeof b == "string") {
        var o = s._prime(b);
        this.m = o.p, this.prime = o;
      } else
        r(b.gtn(1), "modulus must be greater than 1"), this.m = b, this.prime = null;
    }
    a(Q, "Red"), Q.prototype._verify1 = /* @__PURE__ */ a(function(o) {
      r(o.negative === 0, "red works only with positives"), r(o.red, "red works only with red numbers");
    }, "_verify1"), Q.prototype._verify2 = /* @__PURE__ */ a(function(o, h) {
      r((o.negative | h.negative) === 0, "red works only with positives"), r(
        o.red && o.red === h.red,
        "red works only with red numbers"
      );
    }, "_verify2"), Q.prototype.imod = /* @__PURE__ */ a(function(o) {
      return this.prime ? this.prime.ireduce(o)._forceRed(this) : (x(o, o.umod(this.m)._forceRed(this)), o);
    }, "imod"), Q.prototype.neg = /* @__PURE__ */ a(function(o) {
      return o.isZero() ? o.clone() : this.m.sub(o)._forceRed(this);
    }, "neg"), Q.prototype.add = /* @__PURE__ */ a(function(o, h) {
      this._verify2(o, h);
      var d = o.add(h);
      return d.cmp(this.m) >= 0 && d.isub(this.m), d._forceRed(this);
    }, "add"), Q.prototype.iadd = /* @__PURE__ */ a(function(o, h) {
      this._verify2(o, h);
      var d = o.iadd(h);
      return d.cmp(this.m) >= 0 && d.isub(this.m), d;
    }, "iadd"), Q.prototype.sub = /* @__PURE__ */ a(function(o, h) {
      this._verify2(o, h);
      var d = o.sub(h);
      return d.cmpn(0) < 0 && d.iadd(this.m), d._forceRed(this);
    }, "sub"), Q.prototype.isub = /* @__PURE__ */ a(function(o, h) {
      this._verify2(o, h);
      var d = o.isub(h);
      return d.cmpn(0) < 0 && d.iadd(this.m), d;
    }, "isub"), Q.prototype.shl = /* @__PURE__ */ a(function(o, h) {
      return this._verify1(o), this.imod(o.ushln(h));
    }, "shl"), Q.prototype.imul = /* @__PURE__ */ a(function(o, h) {
      return this._verify2(o, h), this.imod(o.imul(h));
    }, "imul"), Q.prototype.mul = /* @__PURE__ */ a(function(o, h) {
      return this._verify2(o, h), this.imod(o.mul(h));
    }, "mul"), Q.prototype.isqr = /* @__PURE__ */ a(function(o) {
      return this.imul(o, o.clone());
    }, "isqr"), Q.prototype.sqr = /* @__PURE__ */ a(function(o) {
      return this.mul(o, o);
    }, "sqr"), Q.prototype.sqrt = /* @__PURE__ */ a(function(o) {
      if (o.isZero())
        return o.clone();
      var h = this.m.andln(3);
      if (r(h % 2 === 1), h === 3) {
        var d = this.m.add(new s(1)).iushrn(2);
        return this.pow(o, d);
      }
      for (var g = this.m.subn(1), w = 0; !g.isZero() && g.andln(1) === 0; )
        w++, g.iushrn(1);
      r(!g.isZero());
      var M = new s(1).toRed(this), S = M.redNeg(), v = this.m.subn(1).iushrn(1), f = this.m.bitLength();
      for (f = new s(2 * f * f).toRed(this); this.pow(f, v).cmp(S) !== 0; )
        f.redIAdd(S);
      for (var m = this.pow(f, g), U = this.pow(o, g.addn(1).iushrn(1)), u = this.pow(o, g), I = w; u.cmp(M) !== 0; ) {
        for (var N = u, F = 0; N.cmp(M) !== 0; F++)
          N = N.redSqr();
        r(F < I);
        var q = this.pow(m, new s(1).iushln(I - F - 1));
        U = U.redMul(q), m = q.redSqr(), u = u.redMul(m), I = F;
      }
      return U;
    }, "sqrt"), Q.prototype.invm = /* @__PURE__ */ a(function(o) {
      var h = o._invmp(this.m);
      return h.negative !== 0 ? (h.negative = 0, this.imod(h).redNeg()) : this.imod(h);
    }, "invm"), Q.prototype.pow = /* @__PURE__ */ a(function(o, h) {
      if (h.isZero())
        return new s(1).toRed(this);
      if (h.cmpn(1) === 0)
        return o.clone();
      var d = 4, g = new Array(1 << d);
      g[0] = new s(1).toRed(this), g[1] = o;
      for (var w = 2; w < g.length; w++)
        g[w] = this.mul(g[w - 1], o);
      var M = g[0], S = 0, v = 0, f = h.bitLength() % 26;
      for (f === 0 && (f = 26), w = h.length - 1; w >= 0; w--) {
        for (var m = h.words[w], U = f - 1; U >= 0; U--) {
          var u = m >> U & 1;
          if (M !== g[0] && (M = this.sqr(M)), u === 0 && S === 0) {
            v = 0;
            continue;
          }
          S <<= 1, S |= u, v++, !(v !== d && (w !== 0 || U !== 0)) && (M = this.mul(M, g[S]), v = 0, S = 0);
        }
        f = 26;
      }
      return M;
    }, "pow"), Q.prototype.convertTo = /* @__PURE__ */ a(function(o) {
      var h = o.umod(this.m);
      return h === o ? h.clone() : h;
    }, "convertTo"), Q.prototype.convertFrom = /* @__PURE__ */ a(function(o) {
      var h = o.clone();
      return h.red = null, h;
    }, "convertFrom"), s.mont = /* @__PURE__ */ a(function(o) {
      return new Ge(o);
    }, "mont");
    function Ge(b) {
      Q.call(this, b), this.shift = this.m.bitLength(), this.shift % 26 !== 0 && (this.shift += 26 - this.shift % 26), this.r = new s(1).iushln(this.shift), this.r2 = this.imod(this.r.sqr()), this.rinv = this.r._invmp(this.m), this.minv = this.rinv.mul(this.r).isubn(1).div(this.m), this.minv = this.minv.umod(this.r), this.minv = this.r.sub(this.minv);
    }
    a(Ge, "Mont"), n(Ge, Q), Ge.prototype.convertTo = /* @__PURE__ */ a(function(o) {
      return this.imod(o.ushln(this.shift));
    }, "convertTo"), Ge.prototype.convertFrom = /* @__PURE__ */ a(function(o) {
      var h = this.imod(o.mul(this.rinv));
      return h.red = null, h;
    }, "convertFrom"), Ge.prototype.imul = /* @__PURE__ */ a(function(o, h) {
      if (o.isZero() || h.isZero())
        return o.words[0] = 0, o.length = 1, o;
      var d = o.imul(h), g = d.maskn(this.shift).mul(this.minv).imaskn(this.shift).mul(this.m), w = d.isub(g).iushrn(this.shift), M = w;
      return w.cmp(this.m) >= 0 ? M = w.isub(this.m) : w.cmpn(0) < 0 && (M = w.iadd(this.m)), M._forceRed(this);
    }, "imul"), Ge.prototype.mul = /* @__PURE__ */ a(function(o, h) {
      if (o.isZero() || h.isZero())
        return new s(0)._forceRed(this);
      var d = o.mul(h), g = d.maskn(this.shift).mul(this.minv).imaskn(this.shift).mul(this.m), w = d.isub(g).iushrn(this.shift), M = w;
      return w.cmp(this.m) >= 0 ? M = w.isub(this.m) : w.cmpn(0) < 0 && (M = w.iadd(this.m)), M._forceRed(this);
    }, "mul"), Ge.prototype.invm = /* @__PURE__ */ a(function(o) {
      var h = this.imod(o._invmp(this.m).mul(this.r2));
      return h._forceRed(this);
    }, "invm");
  })(i, ds);
})(Ji);
var Xo = Ji.exports;
const z = /* @__PURE__ */ Dr(Xo);
var Yo = z.BN;
function Zo(i) {
  return new Yo(i, 36).toString(16);
}
a(Zo, "_base36To16");
const Qo = "strings/5.7.0", ea = new St(Qo);
var qr;
(function(i) {
  i.current = "", i.NFC = "NFC", i.NFD = "NFD", i.NFKC = "NFKC", i.NFKD = "NFKD";
})(qr || (qr = {}));
var Rn;
(function(i) {
  i.UNEXPECTED_CONTINUE = "unexpected continuation byte", i.BAD_PREFIX = "bad codepoint prefix", i.OVERRUN = "string overrun", i.MISSING_CONTINUE = "missing continuation byte", i.OUT_OF_RANGE = "out of UTF-8 range", i.UTF16_SURROGATE = "UTF-16 surrogate", i.OVERLONG = "overlong representation";
})(Rn || (Rn = {}));
function fi(i, t = qr.current) {
  t != qr.current && (ea.checkNormalize(), i = i.normalize(t));
  let e = [];
  for (let r = 0; r < i.length; r++) {
    const n = i.charCodeAt(r);
    if (n < 128)
      e.push(n);
    else if (n < 2048)
      e.push(n >> 6 | 192), e.push(n & 63 | 128);
    else if ((n & 64512) == 55296) {
      r++;
      const s = i.charCodeAt(r);
      if (r >= i.length || (s & 64512) !== 56320)
        throw new Error("invalid utf-8 string");
      const c = 65536 + ((n & 1023) << 10) + (s & 1023);
      e.push(c >> 18 | 240), e.push(c >> 12 & 63 | 128), e.push(c >> 6 & 63 | 128), e.push(c & 63 | 128);
    } else
      e.push(n >> 12 | 224), e.push(n >> 6 & 63 | 128), e.push(n & 63 | 128);
  }
  return Te(e);
}
a(fi, "toUtf8Bytes");
const ta = `Ethereum Signed Message:
`;
function bs(i) {
  return typeof i == "string" && (i = fi(i)), Hi(Ho([
    fi(ta),
    fi(String(i.length)),
    i
  ]));
}
a(bs, "hashMessage");
const ra = "address/5.7.0", vr = new St(ra);
function Nn(i) {
  rt(i, 20) || vr.throwArgumentError("invalid address", "address", i), i = i.toLowerCase();
  const t = i.substring(2).split(""), e = new Uint8Array(40);
  for (let n = 0; n < 40; n++)
    e[n] = t[n].charCodeAt(0);
  const r = Te(Hi(e));
  for (let n = 0; n < 40; n += 2)
    r[n >> 1] >> 4 >= 8 && (t[n] = t[n].toUpperCase()), (r[n >> 1] & 15) >= 8 && (t[n + 1] = t[n + 1].toUpperCase());
  return "0x" + t.join("");
}
a(Nn, "getChecksumAddress");
const ia = 9007199254740991;
function na(i) {
  return Math.log10 ? Math.log10(i) : Math.log(i) / Math.LN10;
}
a(na, "log10");
const Wi = {};
for (let i = 0; i < 10; i++)
  Wi[String(i)] = String(i);
for (let i = 0; i < 26; i++)
  Wi[String.fromCharCode(65 + i)] = String(10 + i);
const Fn = Math.floor(na(ia));
function sa(i) {
  i = i.toUpperCase(), i = i.substring(4) + i.substring(0, 2) + "00";
  let t = i.split("").map((r) => Wi[r]).join("");
  for (; t.length >= Fn; ) {
    let r = t.substring(0, Fn);
    t = parseInt(r, 10) % 97 + t.substring(r.length);
  }
  let e = String(98 - parseInt(t, 10) % 97);
  for (; e.length < 2; )
    e = "0" + e;
  return e;
}
a(sa, "ibanChecksum");
function oa(i) {
  let t = null;
  if (typeof i != "string" && vr.throwArgumentError("invalid address", "address", i), i.match(/^(0x)?[0-9a-fA-F]{40}$/))
    i.substring(0, 2) !== "0x" && (i = "0x" + i), t = Nn(i), i.match(/([A-F].*[a-f])|([a-f].*[A-F])/) && t !== i && vr.throwArgumentError("bad address checksum", "address", i);
  else if (i.match(/^XE[0-9]{2}[0-9A-Za-z]{30,31}$/)) {
    for (i.substring(2, 4) !== sa(i) && vr.throwArgumentError("bad icap checksum", "address", i), t = Zo(i.substring(4)); t.length < 40; )
      t = "0" + t;
    t = Nn("0x" + t);
  } else
    vr.throwArgumentError("invalid address", "address", i);
  return t;
}
a(oa, "getAddress");
globalThis && globalThis.__awaiter;
function hr(i, t, e) {
  Object.defineProperty(i, t, {
    enumerable: !0,
    value: e,
    writable: !1
  });
}
a(hr, "defineReadOnly");
var xs = {}, H = {}, wr = _s;
function _s(i, t) {
  if (!i)
    throw new Error(t || "Assertion failed");
}
a(_s, "assert$b");
_s.equal = /* @__PURE__ */ a(function(t, e, r) {
  if (t != e)
    throw new Error(r || "Assertion failed: " + t + " != " + e);
}, "assertEqual");
var _i = { exports: {} };
typeof Object.create == "function" ? _i.exports = /* @__PURE__ */ a(function(t, e) {
  e && (t.super_ = e, t.prototype = Object.create(e.prototype, {
    constructor: {
      value: t,
      enumerable: !1,
      writable: !0,
      configurable: !0
    }
  }));
}, "inherits") : _i.exports = /* @__PURE__ */ a(function(t, e) {
  if (e) {
    t.super_ = e;
    var r = /* @__PURE__ */ a(function() {
    }, "TempCtor");
    r.prototype = e.prototype, t.prototype = new r(), t.prototype.constructor = t;
  }
}, "inherits");
var aa = _i.exports, fa = wr, ha = aa;
H.inherits = ha;
function ua(i, t) {
  return (i.charCodeAt(t) & 64512) !== 55296 || t < 0 || t + 1 >= i.length ? !1 : (i.charCodeAt(t + 1) & 64512) === 56320;
}
a(ua, "isSurrogatePair");
function ca(i, t) {
  if (Array.isArray(i))
    return i.slice();
  if (!i)
    return [];
  var e = [];
  if (typeof i == "string")
    if (t) {
      if (t === "hex")
        for (i = i.replace(/[^a-z0-9]+/ig, ""), i.length % 2 !== 0 && (i = "0" + i), n = 0; n < i.length; n += 2)
          e.push(parseInt(i[n] + i[n + 1], 16));
    } else
      for (var r = 0, n = 0; n < i.length; n++) {
        var s = i.charCodeAt(n);
        s < 128 ? e[r++] = s : s < 2048 ? (e[r++] = s >> 6 | 192, e[r++] = s & 63 | 128) : ua(i, n) ? (s = 65536 + ((s & 1023) << 10) + (i.charCodeAt(++n) & 1023), e[r++] = s >> 18 | 240, e[r++] = s >> 12 & 63 | 128, e[r++] = s >> 6 & 63 | 128, e[r++] = s & 63 | 128) : (e[r++] = s >> 12 | 224, e[r++] = s >> 6 & 63 | 128, e[r++] = s & 63 | 128);
      }
  else
    for (n = 0; n < i.length; n++)
      e[n] = i[n] | 0;
  return e;
}
a(ca, "toArray");
H.toArray = ca;
function la(i) {
  for (var t = "", e = 0; e < i.length; e++)
    t += Ss(i[e].toString(16));
  return t;
}
a(la, "toHex");
H.toHex = la;
function Ms(i) {
  var t = i >>> 24 | i >>> 8 & 65280 | i << 8 & 16711680 | (i & 255) << 24;
  return t >>> 0;
}
a(Ms, "htonl");
H.htonl = Ms;
function da(i, t) {
  for (var e = "", r = 0; r < i.length; r++) {
    var n = i[r];
    t === "little" && (n = Ms(n)), e += As(n.toString(16));
  }
  return e;
}
a(da, "toHex32");
H.toHex32 = da;
function Ss(i) {
  return i.length === 1 ? "0" + i : i;
}
a(Ss, "zero2");
H.zero2 = Ss;
function As(i) {
  return i.length === 7 ? "0" + i : i.length === 6 ? "00" + i : i.length === 5 ? "000" + i : i.length === 4 ? "0000" + i : i.length === 3 ? "00000" + i : i.length === 2 ? "000000" + i : i.length === 1 ? "0000000" + i : i;
}
a(As, "zero8");
H.zero8 = As;
function pa(i, t, e, r) {
  var n = e - t;
  fa(n % 4 === 0);
  for (var s = new Array(n / 4), c = 0, l = t; c < s.length; c++, l += 4) {
    var p;
    r === "big" ? p = i[l] << 24 | i[l + 1] << 16 | i[l + 2] << 8 | i[l + 3] : p = i[l + 3] << 24 | i[l + 2] << 16 | i[l + 1] << 8 | i[l], s[c] = p >>> 0;
  }
  return s;
}
a(pa, "join32");
H.join32 = pa;
function va(i, t) {
  for (var e = new Array(i.length * 4), r = 0, n = 0; r < i.length; r++, n += 4) {
    var s = i[r];
    t === "big" ? (e[n] = s >>> 24, e[n + 1] = s >>> 16 & 255, e[n + 2] = s >>> 8 & 255, e[n + 3] = s & 255) : (e[n + 3] = s >>> 24, e[n + 2] = s >>> 16 & 255, e[n + 1] = s >>> 8 & 255, e[n] = s & 255);
  }
  return e;
}
a(va, "split32");
H.split32 = va;
function ga(i, t) {
  return i >>> t | i << 32 - t;
}
a(ga, "rotr32$1");
H.rotr32 = ga;
function ma(i, t) {
  return i << t | i >>> 32 - t;
}
a(ma, "rotl32$2");
H.rotl32 = ma;
function ya(i, t) {
  return i + t >>> 0;
}
a(ya, "sum32$3");
H.sum32 = ya;
function wa(i, t, e) {
  return i + t + e >>> 0;
}
a(wa, "sum32_3$1");
H.sum32_3 = wa;
function ba(i, t, e, r) {
  return i + t + e + r >>> 0;
}
a(ba, "sum32_4$2");
H.sum32_4 = ba;
function xa(i, t, e, r, n) {
  return i + t + e + r + n >>> 0;
}
a(xa, "sum32_5$2");
H.sum32_5 = xa;
function _a(i, t, e, r) {
  var n = i[t], s = i[t + 1], c = r + s >>> 0, l = (c < r ? 1 : 0) + e + n;
  i[t] = l >>> 0, i[t + 1] = c;
}
a(_a, "sum64$1");
H.sum64 = _a;
function Ma(i, t, e, r) {
  var n = t + r >>> 0, s = (n < t ? 1 : 0) + i + e;
  return s >>> 0;
}
a(Ma, "sum64_hi$1");
H.sum64_hi = Ma;
function Sa(i, t, e, r) {
  var n = t + r;
  return n >>> 0;
}
a(Sa, "sum64_lo$1");
H.sum64_lo = Sa;
function Aa(i, t, e, r, n, s, c, l) {
  var p = 0, y = t;
  y = y + r >>> 0, p += y < t ? 1 : 0, y = y + s >>> 0, p += y < s ? 1 : 0, y = y + l >>> 0, p += y < l ? 1 : 0;
  var x = i + e + n + c + p;
  return x >>> 0;
}
a(Aa, "sum64_4_hi$1");
H.sum64_4_hi = Aa;
function Ea(i, t, e, r, n, s, c, l) {
  var p = t + r + s + l;
  return p >>> 0;
}
a(Ea, "sum64_4_lo$1");
H.sum64_4_lo = Ea;
function Ia(i, t, e, r, n, s, c, l, p, y) {
  var x = 0, _ = t;
  _ = _ + r >>> 0, x += _ < t ? 1 : 0, _ = _ + s >>> 0, x += _ < s ? 1 : 0, _ = _ + l >>> 0, x += _ < l ? 1 : 0, _ = _ + y >>> 0, x += _ < y ? 1 : 0;
  var E = i + e + n + c + p + x;
  return E >>> 0;
}
a(Ia, "sum64_5_hi$1");
H.sum64_5_hi = Ia;
function Ra(i, t, e, r, n, s, c, l, p, y) {
  var x = t + r + s + l + y;
  return x >>> 0;
}
a(Ra, "sum64_5_lo$1");
H.sum64_5_lo = Ra;
function Na(i, t, e) {
  var r = t << 32 - e | i >>> e;
  return r >>> 0;
}
a(Na, "rotr64_hi$1");
H.rotr64_hi = Na;
function Fa(i, t, e) {
  var r = i << 32 - e | t >>> e;
  return r >>> 0;
}
a(Fa, "rotr64_lo$1");
H.rotr64_lo = Fa;
function Pa(i, t, e) {
  return i >>> e;
}
a(Pa, "shr64_hi$1");
H.shr64_hi = Pa;
function qa(i, t, e) {
  var r = i << 32 - e | t >>> e;
  return r >>> 0;
}
a(qa, "shr64_lo$1");
H.shr64_lo = qa;
var rr = {}, Pn = H, Oa = wr;
function Ur() {
  this.pending = null, this.pendingTotal = 0, this.blockSize = this.constructor.blockSize, this.outSize = this.constructor.outSize, this.hmacStrength = this.constructor.hmacStrength, this.padLength = this.constructor.padLength / 8, this.endian = "big", this._delta8 = this.blockSize / 8, this._delta32 = this.blockSize / 32;
}
a(Ur, "BlockHash$4");
rr.BlockHash = Ur;
Ur.prototype.update = /* @__PURE__ */ a(function(t, e) {
  if (t = Pn.toArray(t, e), this.pending ? this.pending = this.pending.concat(t) : this.pending = t, this.pendingTotal += t.length, this.pending.length >= this._delta8) {
    t = this.pending;
    var r = t.length % this._delta8;
    this.pending = t.slice(t.length - r, t.length), this.pending.length === 0 && (this.pending = null), t = Pn.join32(t, 0, t.length - r, this.endian);
    for (var n = 0; n < t.length; n += this._delta32)
      this._update(t, n, n + this._delta32);
  }
  return this;
}, "update");
Ur.prototype.digest = /* @__PURE__ */ a(function(t) {
  return this.update(this._pad()), Oa(this.pending === null), this._digest(t);
}, "digest");
Ur.prototype._pad = /* @__PURE__ */ a(function() {
  var t = this.pendingTotal, e = this._delta8, r = e - (t + this.padLength) % e, n = new Array(r + this.padLength);
  n[0] = 128;
  for (var s = 1; s < r; s++)
    n[s] = 0;
  if (t <<= 3, this.endian === "big") {
    for (var c = 8; c < this.padLength; c++)
      n[s++] = 0;
    n[s++] = 0, n[s++] = 0, n[s++] = 0, n[s++] = 0, n[s++] = t >>> 24 & 255, n[s++] = t >>> 16 & 255, n[s++] = t >>> 8 & 255, n[s++] = t & 255;
  } else
    for (n[s++] = t & 255, n[s++] = t >>> 8 & 255, n[s++] = t >>> 16 & 255, n[s++] = t >>> 24 & 255, n[s++] = 0, n[s++] = 0, n[s++] = 0, n[s++] = 0, c = 8; c < this.padLength; c++)
      n[s++] = 0;
  return n;
}, "pad");
var ir = {}, ht = {}, Ca = H, it = Ca.rotr32;
function Ta(i, t, e, r) {
  if (i === 0)
    return Es(t, e, r);
  if (i === 1 || i === 3)
    return Rs(t, e, r);
  if (i === 2)
    return Is(t, e, r);
}
a(Ta, "ft_1$1");
ht.ft_1 = Ta;
function Es(i, t, e) {
  return i & t ^ ~i & e;
}
a(Es, "ch32$1");
ht.ch32 = Es;
function Is(i, t, e) {
  return i & t ^ i & e ^ t & e;
}
a(Is, "maj32$1");
ht.maj32 = Is;
function Rs(i, t, e) {
  return i ^ t ^ e;
}
a(Rs, "p32");
ht.p32 = Rs;
function $a(i) {
  return it(i, 2) ^ it(i, 13) ^ it(i, 22);
}
a($a, "s0_256$1");
ht.s0_256 = $a;
function La(i) {
  return it(i, 6) ^ it(i, 11) ^ it(i, 25);
}
a(La, "s1_256$1");
ht.s1_256 = La;
function Da(i) {
  return it(i, 7) ^ it(i, 18) ^ i >>> 3;
}
a(Da, "g0_256$1");
ht.g0_256 = Da;
function Ua(i) {
  return it(i, 17) ^ it(i, 19) ^ i >>> 10;
}
a(Ua, "g1_256$1");
ht.g1_256 = Ua;
var Zt = H, ka = rr, za = ht, hi = Zt.rotl32, ur = Zt.sum32, Ba = Zt.sum32_5, Va = za.ft_1, Ns = ka.BlockHash, Ka = [
  1518500249,
  1859775393,
  2400959708,
  3395469782
];
function ot() {
  if (!(this instanceof ot))
    return new ot();
  Ns.call(this), this.h = [
    1732584193,
    4023233417,
    2562383102,
    271733878,
    3285377520
  ], this.W = new Array(80);
}
a(ot, "SHA1");
Zt.inherits(ot, Ns);
var ja = ot;
ot.blockSize = 512;
ot.outSize = 160;
ot.hmacStrength = 80;
ot.padLength = 64;
ot.prototype._update = /* @__PURE__ */ a(function(t, e) {
  for (var r = this.W, n = 0; n < 16; n++)
    r[n] = t[e + n];
  for (; n < r.length; n++)
    r[n] = hi(r[n - 3] ^ r[n - 8] ^ r[n - 14] ^ r[n - 16], 1);
  var s = this.h[0], c = this.h[1], l = this.h[2], p = this.h[3], y = this.h[4];
  for (n = 0; n < r.length; n++) {
    var x = ~~(n / 20), _ = Ba(hi(s, 5), Va(x, c, l, p), y, r[n], Ka[x]);
    y = p, p = l, l = hi(c, 30), c = s, s = _;
  }
  this.h[0] = ur(this.h[0], s), this.h[1] = ur(this.h[1], c), this.h[2] = ur(this.h[2], l), this.h[3] = ur(this.h[3], p), this.h[4] = ur(this.h[4], y);
}, "_update");
ot.prototype._digest = /* @__PURE__ */ a(function(t) {
  return t === "hex" ? Zt.toHex32(this.h, "big") : Zt.split32(this.h, "big");
}, "digest");
var Qt = H, Ga = rr, nr = ht, Ha = wr, Ye = Qt.sum32, Ja = Qt.sum32_4, Wa = Qt.sum32_5, Xa = nr.ch32, Ya = nr.maj32, Za = nr.s0_256, Qa = nr.s1_256, ef = nr.g0_256, tf = nr.g1_256, Fs = Ga.BlockHash, rf = [
  1116352408,
  1899447441,
  3049323471,
  3921009573,
  961987163,
  1508970993,
  2453635748,
  2870763221,
  3624381080,
  310598401,
  607225278,
  1426881987,
  1925078388,
  2162078206,
  2614888103,
  3248222580,
  3835390401,
  4022224774,
  264347078,
  604807628,
  770255983,
  1249150122,
  1555081692,
  1996064986,
  2554220882,
  2821834349,
  2952996808,
  3210313671,
  3336571891,
  3584528711,
  113926993,
  338241895,
  666307205,
  773529912,
  1294757372,
  1396182291,
  1695183700,
  1986661051,
  2177026350,
  2456956037,
  2730485921,
  2820302411,
  3259730800,
  3345764771,
  3516065817,
  3600352804,
  4094571909,
  275423344,
  430227734,
  506948616,
  659060556,
  883997877,
  958139571,
  1322822218,
  1537002063,
  1747873779,
  1955562222,
  2024104815,
  2227730452,
  2361852424,
  2428436474,
  2756734187,
  3204031479,
  3329325298
];
function at() {
  if (!(this instanceof at))
    return new at();
  Fs.call(this), this.h = [
    1779033703,
    3144134277,
    1013904242,
    2773480762,
    1359893119,
    2600822924,
    528734635,
    1541459225
  ], this.k = rf, this.W = new Array(64);
}
a(at, "SHA256$1");
Qt.inherits(at, Fs);
var Ps = at;
at.blockSize = 512;
at.outSize = 256;
at.hmacStrength = 192;
at.padLength = 64;
at.prototype._update = /* @__PURE__ */ a(function(t, e) {
  for (var r = this.W, n = 0; n < 16; n++)
    r[n] = t[e + n];
  for (; n < r.length; n++)
    r[n] = Ja(tf(r[n - 2]), r[n - 7], ef(r[n - 15]), r[n - 16]);
  var s = this.h[0], c = this.h[1], l = this.h[2], p = this.h[3], y = this.h[4], x = this.h[5], _ = this.h[6], E = this.h[7];
  for (Ha(this.k.length === r.length), n = 0; n < r.length; n++) {
    var R = Wa(E, Qa(y), Xa(y, x, _), this.k[n], r[n]), A = Ye(Za(s), Ya(s, c, l));
    E = _, _ = x, x = y, y = Ye(p, R), p = l, l = c, c = s, s = Ye(R, A);
  }
  this.h[0] = Ye(this.h[0], s), this.h[1] = Ye(this.h[1], c), this.h[2] = Ye(this.h[2], l), this.h[3] = Ye(this.h[3], p), this.h[4] = Ye(this.h[4], y), this.h[5] = Ye(this.h[5], x), this.h[6] = Ye(this.h[6], _), this.h[7] = Ye(this.h[7], E);
}, "_update");
at.prototype._digest = /* @__PURE__ */ a(function(t) {
  return t === "hex" ? Qt.toHex32(this.h, "big") : Qt.split32(this.h, "big");
}, "digest");
var Mi = H, qs = Ps;
function lt() {
  if (!(this instanceof lt))
    return new lt();
  qs.call(this), this.h = [
    3238371032,
    914150663,
    812702999,
    4144912697,
    4290775857,
    1750603025,
    1694076839,
    3204075428
  ];
}
a(lt, "SHA224");
Mi.inherits(lt, qs);
var nf = lt;
lt.blockSize = 512;
lt.outSize = 224;
lt.hmacStrength = 192;
lt.padLength = 64;
lt.prototype._digest = /* @__PURE__ */ a(function(t) {
  return t === "hex" ? Mi.toHex32(this.h.slice(0, 7), "big") : Mi.split32(this.h.slice(0, 7), "big");
}, "digest");
var Ke = H, sf = rr, of = wr, nt = Ke.rotr64_hi, st = Ke.rotr64_lo, Os = Ke.shr64_hi, Cs = Ke.shr64_lo, bt = Ke.sum64, ui = Ke.sum64_hi, ci = Ke.sum64_lo, af = Ke.sum64_4_hi, ff = Ke.sum64_4_lo, hf = Ke.sum64_5_hi, uf = Ke.sum64_5_lo, Ts = sf.BlockHash, cf = [
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
];
function et() {
  if (!(this instanceof et))
    return new et();
  Ts.call(this), this.h = [
    1779033703,
    4089235720,
    3144134277,
    2227873595,
    1013904242,
    4271175723,
    2773480762,
    1595750129,
    1359893119,
    2917565137,
    2600822924,
    725511199,
    528734635,
    4215389547,
    1541459225,
    327033209
  ], this.k = cf, this.W = new Array(160);
}
a(et, "SHA512$1");
Ke.inherits(et, Ts);
var $s = et;
et.blockSize = 1024;
et.outSize = 512;
et.hmacStrength = 192;
et.padLength = 128;
et.prototype._prepareBlock = /* @__PURE__ */ a(function(t, e) {
  for (var r = this.W, n = 0; n < 32; n++)
    r[n] = t[e + n];
  for (; n < r.length; n += 2) {
    var s = _f(r[n - 4], r[n - 3]), c = Mf(r[n - 4], r[n - 3]), l = r[n - 14], p = r[n - 13], y = bf(r[n - 30], r[n - 29]), x = xf(r[n - 30], r[n - 29]), _ = r[n - 32], E = r[n - 31];
    r[n] = af(
      s,
      c,
      l,
      p,
      y,
      x,
      _,
      E
    ), r[n + 1] = ff(
      s,
      c,
      l,
      p,
      y,
      x,
      _,
      E
    );
  }
}, "_prepareBlock");
et.prototype._update = /* @__PURE__ */ a(function(t, e) {
  this._prepareBlock(t, e);
  var r = this.W, n = this.h[0], s = this.h[1], c = this.h[2], l = this.h[3], p = this.h[4], y = this.h[5], x = this.h[6], _ = this.h[7], E = this.h[8], R = this.h[9], A = this.h[10], P = this.h[11], L = this.h[12], $ = this.h[13], j = this.h[14], J = this.h[15];
  of(this.k.length === r.length);
  for (var V = 0; V < r.length; V += 2) {
    var K = j, G = J, W = yf(E, R), Z = wf(E, R), $e = lf(E, R, A, P, L), pt = df(E, R, A, P, L, $), Q = this.k[V], Ge = this.k[V + 1], b = r[V], o = r[V + 1], h = hf(
      K,
      G,
      W,
      Z,
      $e,
      pt,
      Q,
      Ge,
      b,
      o
    ), d = uf(
      K,
      G,
      W,
      Z,
      $e,
      pt,
      Q,
      Ge,
      b,
      o
    );
    K = gf(n, s), G = mf(n, s), W = pf(n, s, c, l, p), Z = vf(n, s, c, l, p, y);
    var g = ui(K, G, W, Z), w = ci(K, G, W, Z);
    j = L, J = $, L = A, $ = P, A = E, P = R, E = ui(x, _, h, d), R = ci(_, _, h, d), x = p, _ = y, p = c, y = l, c = n, l = s, n = ui(h, d, g, w), s = ci(h, d, g, w);
  }
  bt(this.h, 0, n, s), bt(this.h, 2, c, l), bt(this.h, 4, p, y), bt(this.h, 6, x, _), bt(this.h, 8, E, R), bt(this.h, 10, A, P), bt(this.h, 12, L, $), bt(this.h, 14, j, J);
}, "_update");
et.prototype._digest = /* @__PURE__ */ a(function(t) {
  return t === "hex" ? Ke.toHex32(this.h, "big") : Ke.split32(this.h, "big");
}, "digest");
function lf(i, t, e, r, n) {
  var s = i & e ^ ~i & n;
  return s < 0 && (s += 4294967296), s;
}
a(lf, "ch64_hi");
function df(i, t, e, r, n, s) {
  var c = t & r ^ ~t & s;
  return c < 0 && (c += 4294967296), c;
}
a(df, "ch64_lo");
function pf(i, t, e, r, n) {
  var s = i & e ^ i & n ^ e & n;
  return s < 0 && (s += 4294967296), s;
}
a(pf, "maj64_hi");
function vf(i, t, e, r, n, s) {
  var c = t & r ^ t & s ^ r & s;
  return c < 0 && (c += 4294967296), c;
}
a(vf, "maj64_lo");
function gf(i, t) {
  var e = nt(i, t, 28), r = nt(t, i, 2), n = nt(t, i, 7), s = e ^ r ^ n;
  return s < 0 && (s += 4294967296), s;
}
a(gf, "s0_512_hi");
function mf(i, t) {
  var e = st(i, t, 28), r = st(t, i, 2), n = st(t, i, 7), s = e ^ r ^ n;
  return s < 0 && (s += 4294967296), s;
}
a(mf, "s0_512_lo");
function yf(i, t) {
  var e = nt(i, t, 14), r = nt(i, t, 18), n = nt(t, i, 9), s = e ^ r ^ n;
  return s < 0 && (s += 4294967296), s;
}
a(yf, "s1_512_hi");
function wf(i, t) {
  var e = st(i, t, 14), r = st(i, t, 18), n = st(t, i, 9), s = e ^ r ^ n;
  return s < 0 && (s += 4294967296), s;
}
a(wf, "s1_512_lo");
function bf(i, t) {
  var e = nt(i, t, 1), r = nt(i, t, 8), n = Os(i, t, 7), s = e ^ r ^ n;
  return s < 0 && (s += 4294967296), s;
}
a(bf, "g0_512_hi");
function xf(i, t) {
  var e = st(i, t, 1), r = st(i, t, 8), n = Cs(i, t, 7), s = e ^ r ^ n;
  return s < 0 && (s += 4294967296), s;
}
a(xf, "g0_512_lo");
function _f(i, t) {
  var e = nt(i, t, 19), r = nt(t, i, 29), n = Os(i, t, 6), s = e ^ r ^ n;
  return s < 0 && (s += 4294967296), s;
}
a(_f, "g1_512_hi");
function Mf(i, t) {
  var e = st(i, t, 19), r = st(t, i, 29), n = Cs(i, t, 6), s = e ^ r ^ n;
  return s < 0 && (s += 4294967296), s;
}
a(Mf, "g1_512_lo");
var Si = H, Ls = $s;
function dt() {
  if (!(this instanceof dt))
    return new dt();
  Ls.call(this), this.h = [
    3418070365,
    3238371032,
    1654270250,
    914150663,
    2438529370,
    812702999,
    355462360,
    4144912697,
    1731405415,
    4290775857,
    2394180231,
    1750603025,
    3675008525,
    1694076839,
    1203062813,
    3204075428
  ];
}
a(dt, "SHA384");
Si.inherits(dt, Ls);
var Sf = dt;
dt.blockSize = 1024;
dt.outSize = 384;
dt.hmacStrength = 192;
dt.padLength = 128;
dt.prototype._digest = /* @__PURE__ */ a(function(t) {
  return t === "hex" ? Si.toHex32(this.h.slice(0, 12), "big") : Si.split32(this.h.slice(0, 12), "big");
}, "digest");
ir.sha1 = ja;
ir.sha224 = nf;
ir.sha256 = Ps;
ir.sha384 = Sf;
ir.sha512 = $s;
var Ds = {}, jt = H, Af = rr, _r = jt.rotl32, qn = jt.sum32, cr = jt.sum32_3, On = jt.sum32_4, Us = Af.BlockHash;
function ft() {
  if (!(this instanceof ft))
    return new ft();
  Us.call(this), this.h = [1732584193, 4023233417, 2562383102, 271733878, 3285377520], this.endian = "little";
}
a(ft, "RIPEMD160");
jt.inherits(ft, Us);
Ds.ripemd160 = ft;
ft.blockSize = 512;
ft.outSize = 160;
ft.hmacStrength = 192;
ft.padLength = 64;
ft.prototype._update = /* @__PURE__ */ a(function(t, e) {
  for (var r = this.h[0], n = this.h[1], s = this.h[2], c = this.h[3], l = this.h[4], p = r, y = n, x = s, _ = c, E = l, R = 0; R < 80; R++) {
    var A = qn(
      _r(
        On(r, Cn(R, n, s, c), t[Rf[R] + e], Ef(R)),
        Ff[R]
      ),
      l
    );
    r = l, l = c, c = _r(s, 10), s = n, n = A, A = qn(
      _r(
        On(p, Cn(79 - R, y, x, _), t[Nf[R] + e], If(R)),
        Pf[R]
      ),
      E
    ), p = E, E = _, _ = _r(x, 10), x = y, y = A;
  }
  A = cr(this.h[1], s, _), this.h[1] = cr(this.h[2], c, E), this.h[2] = cr(this.h[3], l, p), this.h[3] = cr(this.h[4], r, y), this.h[4] = cr(this.h[0], n, x), this.h[0] = A;
}, "update");
ft.prototype._digest = /* @__PURE__ */ a(function(t) {
  return t === "hex" ? jt.toHex32(this.h, "little") : jt.split32(this.h, "little");
}, "digest");
function Cn(i, t, e, r) {
  return i <= 15 ? t ^ e ^ r : i <= 31 ? t & e | ~t & r : i <= 47 ? (t | ~e) ^ r : i <= 63 ? t & r | e & ~r : t ^ (e | ~r);
}
a(Cn, "f$1");
function Ef(i) {
  return i <= 15 ? 0 : i <= 31 ? 1518500249 : i <= 47 ? 1859775393 : i <= 63 ? 2400959708 : 2840853838;
}
a(Ef, "K$2");
function If(i) {
  return i <= 15 ? 1352829926 : i <= 31 ? 1548603684 : i <= 47 ? 1836072691 : i <= 63 ? 2053994217 : 0;
}
a(If, "Kh");
var Rf = [
  0,
  1,
  2,
  3,
  4,
  5,
  6,
  7,
  8,
  9,
  10,
  11,
  12,
  13,
  14,
  15,
  7,
  4,
  13,
  1,
  10,
  6,
  15,
  3,
  12,
  0,
  9,
  5,
  2,
  14,
  11,
  8,
  3,
  10,
  14,
  4,
  9,
  15,
  8,
  1,
  2,
  7,
  0,
  6,
  13,
  11,
  5,
  12,
  1,
  9,
  11,
  10,
  0,
  8,
  12,
  4,
  13,
  3,
  7,
  15,
  14,
  5,
  6,
  2,
  4,
  0,
  5,
  9,
  7,
  12,
  2,
  10,
  14,
  1,
  3,
  8,
  11,
  6,
  15,
  13
], Nf = [
  5,
  14,
  7,
  0,
  9,
  2,
  11,
  4,
  13,
  6,
  15,
  8,
  1,
  10,
  3,
  12,
  6,
  11,
  3,
  7,
  0,
  13,
  5,
  10,
  14,
  15,
  8,
  12,
  4,
  9,
  1,
  2,
  15,
  5,
  1,
  3,
  7,
  14,
  6,
  9,
  11,
  8,
  12,
  2,
  10,
  0,
  4,
  13,
  8,
  6,
  4,
  1,
  3,
  11,
  15,
  0,
  5,
  12,
  2,
  13,
  9,
  7,
  10,
  14,
  12,
  15,
  10,
  4,
  1,
  5,
  8,
  7,
  6,
  2,
  13,
  14,
  0,
  3,
  9,
  11
], Ff = [
  11,
  14,
  15,
  12,
  5,
  8,
  7,
  9,
  11,
  13,
  14,
  15,
  6,
  7,
  9,
  8,
  7,
  6,
  8,
  13,
  11,
  9,
  7,
  15,
  7,
  12,
  15,
  9,
  11,
  7,
  13,
  12,
  11,
  13,
  6,
  7,
  14,
  9,
  13,
  15,
  14,
  8,
  13,
  6,
  5,
  12,
  7,
  5,
  11,
  12,
  14,
  15,
  14,
  15,
  9,
  8,
  9,
  14,
  5,
  6,
  8,
  6,
  5,
  12,
  9,
  15,
  5,
  11,
  6,
  8,
  13,
  12,
  5,
  12,
  13,
  14,
  11,
  8,
  5,
  6
], Pf = [
  8,
  9,
  9,
  11,
  13,
  15,
  15,
  5,
  7,
  7,
  8,
  11,
  14,
  14,
  12,
  6,
  9,
  13,
  15,
  7,
  12,
  8,
  9,
  11,
  7,
  7,
  12,
  7,
  6,
  15,
  13,
  11,
  9,
  7,
  15,
  11,
  8,
  6,
  6,
  14,
  12,
  13,
  5,
  14,
  13,
  13,
  7,
  5,
  15,
  5,
  8,
  11,
  14,
  14,
  6,
  14,
  6,
  9,
  12,
  9,
  12,
  5,
  15,
  8,
  8,
  5,
  12,
  9,
  12,
  5,
  14,
  6,
  8,
  13,
  6,
  5,
  15,
  13,
  11,
  11
], qf = H, Of = wr;
function er(i, t, e) {
  if (!(this instanceof er))
    return new er(i, t, e);
  this.Hash = i, this.blockSize = i.blockSize / 8, this.outSize = i.outSize / 8, this.inner = null, this.outer = null, this._init(qf.toArray(t, e));
}
a(er, "Hmac");
var Cf = er;
er.prototype._init = /* @__PURE__ */ a(function(t) {
  t.length > this.blockSize && (t = new this.Hash().update(t).digest()), Of(t.length <= this.blockSize);
  for (var e = t.length; e < this.blockSize; e++)
    t.push(0);
  for (e = 0; e < t.length; e++)
    t[e] ^= 54;
  for (this.inner = new this.Hash().update(t), e = 0; e < t.length; e++)
    t[e] ^= 106;
  this.outer = new this.Hash().update(t);
}, "init");
er.prototype.update = /* @__PURE__ */ a(function(t, e) {
  return this.inner.update(t, e), this;
}, "update");
er.prototype.digest = /* @__PURE__ */ a(function(t) {
  return this.outer.update(this.inner.digest()), this.outer.digest(t);
}, "digest");
(function(i) {
  var t = i;
  t.utils = H, t.common = rr, t.sha = ir, t.ripemd = Ds, t.hmac = Cf, t.sha1 = t.sha.sha1, t.sha256 = t.sha.sha256, t.sha224 = t.sha.sha224, t.sha384 = t.sha.sha384, t.sha512 = t.sha.sha512, t.ripemd160 = t.ripemd.ripemd160;
})(xs);
const ct = /* @__PURE__ */ Dr(xs);
function sr(i, t, e) {
  return e = {
    path: t,
    exports: {},
    require: function(r, n) {
      return Tf(r, n ?? e.path);
    }
  }, i(e, e.exports), e.exports;
}
a(sr, "createCommonjsModule");
function Tf() {
  throw new Error("Dynamic requires are not currently supported by @rollup/plugin-commonjs");
}
a(Tf, "commonjsRequire");
var Xi = ks;
function ks(i, t) {
  if (!i)
    throw new Error(t || "Assertion failed");
}
a(ks, "assert");
ks.equal = /* @__PURE__ */ a(function(t, e, r) {
  if (t != e)
    throw new Error(r || "Assertion failed: " + t + " != " + e);
}, "assertEqual");
var Qe = sr(function(i, t) {
  var e = t;
  function r(c, l) {
    if (Array.isArray(c))
      return c.slice();
    if (!c)
      return [];
    var p = [];
    if (typeof c != "string") {
      for (var y = 0; y < c.length; y++)
        p[y] = c[y] | 0;
      return p;
    }
    if (l === "hex") {
      c = c.replace(/[^a-z0-9]+/ig, ""), c.length % 2 !== 0 && (c = "0" + c);
      for (var y = 0; y < c.length; y += 2)
        p.push(parseInt(c[y] + c[y + 1], 16));
    } else
      for (var y = 0; y < c.length; y++) {
        var x = c.charCodeAt(y), _ = x >> 8, E = x & 255;
        _ ? p.push(_, E) : p.push(E);
      }
    return p;
  }
  a(r, "toArray"), e.toArray = r;
  function n(c) {
    return c.length === 1 ? "0" + c : c;
  }
  a(n, "zero2"), e.zero2 = n;
  function s(c) {
    for (var l = "", p = 0; p < c.length; p++)
      l += n(c[p].toString(16));
    return l;
  }
  a(s, "toHex"), e.toHex = s, e.encode = /* @__PURE__ */ a(function(l, p) {
    return p === "hex" ? s(l) : l;
  }, "encode");
}), je = sr(function(i, t) {
  var e = t;
  e.assert = Xi, e.toArray = Qe.toArray, e.zero2 = Qe.zero2, e.toHex = Qe.toHex, e.encode = Qe.encode;
  function r(p, y, x) {
    var _ = new Array(Math.max(p.bitLength(), x) + 1);
    _.fill(0);
    for (var E = 1 << y + 1, R = p.clone(), A = 0; A < _.length; A++) {
      var P, L = R.andln(E - 1);
      R.isOdd() ? (L > (E >> 1) - 1 ? P = (E >> 1) - L : P = L, R.isubn(P)) : P = 0, _[A] = P, R.iushrn(1);
    }
    return _;
  }
  a(r, "getNAF"), e.getNAF = r;
  function n(p, y) {
    var x = [
      [],
      []
    ];
    p = p.clone(), y = y.clone();
    for (var _ = 0, E = 0, R; p.cmpn(-_) > 0 || y.cmpn(-E) > 0; ) {
      var A = p.andln(3) + _ & 3, P = y.andln(3) + E & 3;
      A === 3 && (A = -1), P === 3 && (P = -1);
      var L;
      A & 1 ? (R = p.andln(7) + _ & 7, (R === 3 || R === 5) && P === 2 ? L = -A : L = A) : L = 0, x[0].push(L);
      var $;
      P & 1 ? (R = y.andln(7) + E & 7, (R === 3 || R === 5) && A === 2 ? $ = -P : $ = P) : $ = 0, x[1].push($), 2 * _ === L + 1 && (_ = 1 - _), 2 * E === $ + 1 && (E = 1 - E), p.iushrn(1), y.iushrn(1);
    }
    return x;
  }
  a(n, "getJSF"), e.getJSF = n;
  function s(p, y, x) {
    var _ = "_" + y;
    p.prototype[y] = /* @__PURE__ */ a(function() {
      return this[_] !== void 0 ? this[_] : this[_] = x.call(this);
    }, "cachedProperty");
  }
  a(s, "cachedProperty"), e.cachedProperty = s;
  function c(p) {
    return typeof p == "string" ? e.toArray(p, "hex") : p;
  }
  a(c, "parseBytes"), e.parseBytes = c;
  function l(p) {
    return new z(p, "hex", "le");
  }
  a(l, "intFromLE"), e.intFromLE = l;
}), Or = je.getNAF, $f = je.getJSF, Cr = je.assert;
function Et(i, t) {
  this.type = i, this.p = new z(t.p, 16), this.red = t.prime ? z.red(t.prime) : z.mont(this.p), this.zero = new z(0).toRed(this.red), this.one = new z(1).toRed(this.red), this.two = new z(2).toRed(this.red), this.n = t.n && new z(t.n, 16), this.g = t.g && this.pointFromJSON(t.g, t.gRed), this._wnafT1 = new Array(4), this._wnafT2 = new Array(4), this._wnafT3 = new Array(4), this._wnafT4 = new Array(4), this._bitLength = this.n ? this.n.bitLength() : 0;
  var e = this.n && this.p.div(this.n);
  !e || e.cmpn(100) > 0 ? this.redN = null : (this._maxwellTrick = !0, this.redN = this.n.toRed(this.red));
}
a(Et, "BaseCurve");
var Gt = Et;
Et.prototype.point = /* @__PURE__ */ a(function() {
  throw new Error("Not implemented");
}, "point");
Et.prototype.validate = /* @__PURE__ */ a(function() {
  throw new Error("Not implemented");
}, "validate");
Et.prototype._fixedNafMul = /* @__PURE__ */ a(function(t, e) {
  Cr(t.precomputed);
  var r = t._getDoubles(), n = Or(e, 1, this._bitLength), s = (1 << r.step + 1) - (r.step % 2 === 0 ? 2 : 1);
  s /= 3;
  var c = [], l, p;
  for (l = 0; l < n.length; l += r.step) {
    p = 0;
    for (var y = l + r.step - 1; y >= l; y--)
      p = (p << 1) + n[y];
    c.push(p);
  }
  for (var x = this.jpoint(null, null, null), _ = this.jpoint(null, null, null), E = s; E > 0; E--) {
    for (l = 0; l < c.length; l++)
      p = c[l], p === E ? _ = _.mixedAdd(r.points[l]) : p === -E && (_ = _.mixedAdd(r.points[l].neg()));
    x = x.add(_);
  }
  return x.toP();
}, "_fixedNafMul");
Et.prototype._wnafMul = /* @__PURE__ */ a(function(t, e) {
  var r = 4, n = t._getNAFPoints(r);
  r = n.wnd;
  for (var s = n.points, c = Or(e, r, this._bitLength), l = this.jpoint(null, null, null), p = c.length - 1; p >= 0; p--) {
    for (var y = 0; p >= 0 && c[p] === 0; p--)
      y++;
    if (p >= 0 && y++, l = l.dblp(y), p < 0)
      break;
    var x = c[p];
    Cr(x !== 0), t.type === "affine" ? x > 0 ? l = l.mixedAdd(s[x - 1 >> 1]) : l = l.mixedAdd(s[-x - 1 >> 1].neg()) : x > 0 ? l = l.add(s[x - 1 >> 1]) : l = l.add(s[-x - 1 >> 1].neg());
  }
  return t.type === "affine" ? l.toP() : l;
}, "_wnafMul");
Et.prototype._wnafMulAdd = /* @__PURE__ */ a(function(t, e, r, n, s) {
  var c = this._wnafT1, l = this._wnafT2, p = this._wnafT3, y = 0, x, _, E;
  for (x = 0; x < n; x++) {
    E = e[x];
    var R = E._getNAFPoints(t);
    c[x] = R.wnd, l[x] = R.points;
  }
  for (x = n - 1; x >= 1; x -= 2) {
    var A = x - 1, P = x;
    if (c[A] !== 1 || c[P] !== 1) {
      p[A] = Or(r[A], c[A], this._bitLength), p[P] = Or(r[P], c[P], this._bitLength), y = Math.max(p[A].length, y), y = Math.max(p[P].length, y);
      continue;
    }
    var L = [
      e[A],
      /* 1 */
      null,
      /* 3 */
      null,
      /* 5 */
      e[P]
      /* 7 */
    ];
    e[A].y.cmp(e[P].y) === 0 ? (L[1] = e[A].add(e[P]), L[2] = e[A].toJ().mixedAdd(e[P].neg())) : e[A].y.cmp(e[P].y.redNeg()) === 0 ? (L[1] = e[A].toJ().mixedAdd(e[P]), L[2] = e[A].add(e[P].neg())) : (L[1] = e[A].toJ().mixedAdd(e[P]), L[2] = e[A].toJ().mixedAdd(e[P].neg()));
    var $ = [
      -3,
      /* -1 -1 */
      -1,
      /* -1 0 */
      -5,
      /* -1 1 */
      -7,
      /* 0 -1 */
      0,
      /* 0 0 */
      7,
      /* 0 1 */
      5,
      /* 1 -1 */
      1,
      /* 1 0 */
      3
      /* 1 1 */
    ], j = $f(r[A], r[P]);
    for (y = Math.max(j[0].length, y), p[A] = new Array(y), p[P] = new Array(y), _ = 0; _ < y; _++) {
      var J = j[0][_] | 0, V = j[1][_] | 0;
      p[A][_] = $[(J + 1) * 3 + (V + 1)], p[P][_] = 0, l[A] = L;
    }
  }
  var K = this.jpoint(null, null, null), G = this._wnafT4;
  for (x = y; x >= 0; x--) {
    for (var W = 0; x >= 0; ) {
      var Z = !0;
      for (_ = 0; _ < n; _++)
        G[_] = p[_][x] | 0, G[_] !== 0 && (Z = !1);
      if (!Z)
        break;
      W++, x--;
    }
    if (x >= 0 && W++, K = K.dblp(W), x < 0)
      break;
    for (_ = 0; _ < n; _++) {
      var $e = G[_];
      $e !== 0 && ($e > 0 ? E = l[_][$e - 1 >> 1] : $e < 0 && (E = l[_][-$e - 1 >> 1].neg()), E.type === "affine" ? K = K.mixedAdd(E) : K = K.add(E));
    }
  }
  for (x = 0; x < n; x++)
    l[x] = null;
  return s ? K : K.toP();
}, "_wnafMulAdd");
function Je(i, t) {
  this.curve = i, this.type = t, this.precomputed = null;
}
a(Je, "BasePoint");
Et.BasePoint = Je;
Je.prototype.eq = /* @__PURE__ */ a(function() {
  throw new Error("Not implemented");
}, "eq");
Je.prototype.validate = /* @__PURE__ */ a(function() {
  return this.curve.validate(this);
}, "validate");
Et.prototype.decodePoint = /* @__PURE__ */ a(function(t, e) {
  t = je.toArray(t, e);
  var r = this.p.byteLength();
  if ((t[0] === 4 || t[0] === 6 || t[0] === 7) && t.length - 1 === 2 * r) {
    t[0] === 6 ? Cr(t[t.length - 1] % 2 === 0) : t[0] === 7 && Cr(t[t.length - 1] % 2 === 1);
    var n = this.point(
      t.slice(1, 1 + r),
      t.slice(1 + r, 1 + 2 * r)
    );
    return n;
  } else if ((t[0] === 2 || t[0] === 3) && t.length - 1 === r)
    return this.pointFromX(t.slice(1, 1 + r), t[0] === 3);
  throw new Error("Unknown point format");
}, "decodePoint");
Je.prototype.encodeCompressed = /* @__PURE__ */ a(function(t) {
  return this.encode(t, !0);
}, "encodeCompressed");
Je.prototype._encode = /* @__PURE__ */ a(function(t) {
  var e = this.curve.p.byteLength(), r = this.getX().toArray("be", e);
  return t ? [this.getY().isEven() ? 2 : 3].concat(r) : [4].concat(r, this.getY().toArray("be", e));
}, "_encode");
Je.prototype.encode = /* @__PURE__ */ a(function(t, e) {
  return je.encode(this._encode(e), t);
}, "encode");
Je.prototype.precompute = /* @__PURE__ */ a(function(t) {
  if (this.precomputed)
    return this;
  var e = {
    doubles: null,
    naf: null,
    beta: null
  };
  return e.naf = this._getNAFPoints(8), e.doubles = this._getDoubles(4, t), e.beta = this._getBeta(), this.precomputed = e, this;
}, "precompute");
Je.prototype._hasDoubles = /* @__PURE__ */ a(function(t) {
  if (!this.precomputed)
    return !1;
  var e = this.precomputed.doubles;
  return e ? e.points.length >= Math.ceil((t.bitLength() + 1) / e.step) : !1;
}, "_hasDoubles");
Je.prototype._getDoubles = /* @__PURE__ */ a(function(t, e) {
  if (this.precomputed && this.precomputed.doubles)
    return this.precomputed.doubles;
  for (var r = [this], n = this, s = 0; s < e; s += t) {
    for (var c = 0; c < t; c++)
      n = n.dbl();
    r.push(n);
  }
  return {
    step: t,
    points: r
  };
}, "_getDoubles");
Je.prototype._getNAFPoints = /* @__PURE__ */ a(function(t) {
  if (this.precomputed && this.precomputed.naf)
    return this.precomputed.naf;
  for (var e = [this], r = (1 << t) - 1, n = r === 1 ? null : this.dbl(), s = 1; s < r; s++)
    e[s] = e[s - 1].add(n);
  return {
    wnd: t,
    points: e
  };
}, "_getNAFPoints");
Je.prototype._getBeta = /* @__PURE__ */ a(function() {
  return null;
}, "_getBeta");
Je.prototype.dblp = /* @__PURE__ */ a(function(t) {
  for (var e = this, r = 0; r < t; r++)
    e = e.dbl();
  return e;
}, "dblp");
var Yi = sr(function(i) {
  typeof Object.create == "function" ? i.exports = /* @__PURE__ */ a(function(e, r) {
    r && (e.super_ = r, e.prototype = Object.create(r.prototype, {
      constructor: {
        value: e,
        enumerable: !1,
        writable: !0,
        configurable: !0
      }
    }));
  }, "inherits") : i.exports = /* @__PURE__ */ a(function(e, r) {
    if (r) {
      e.super_ = r;
      var n = /* @__PURE__ */ a(function() {
      }, "TempCtor");
      n.prototype = r.prototype, e.prototype = new n(), e.prototype.constructor = e;
    }
  }, "inherits");
}), Lf = je.assert;
function We(i) {
  Gt.call(this, "short", i), this.a = new z(i.a, 16).toRed(this.red), this.b = new z(i.b, 16).toRed(this.red), this.tinv = this.two.redInvm(), this.zeroA = this.a.fromRed().cmpn(0) === 0, this.threeA = this.a.fromRed().sub(this.p).cmpn(-3) === 0, this.endo = this._getEndomorphism(i), this._endoWnafT1 = new Array(4), this._endoWnafT2 = new Array(4);
}
a(We, "ShortCurve");
Yi(We, Gt);
var Df = We;
We.prototype._getEndomorphism = /* @__PURE__ */ a(function(t) {
  if (!(!this.zeroA || !this.g || !this.n || this.p.modn(3) !== 1)) {
    var e, r;
    if (t.beta)
      e = new z(t.beta, 16).toRed(this.red);
    else {
      var n = this._getEndoRoots(this.p);
      e = n[0].cmp(n[1]) < 0 ? n[0] : n[1], e = e.toRed(this.red);
    }
    if (t.lambda)
      r = new z(t.lambda, 16);
    else {
      var s = this._getEndoRoots(this.n);
      this.g.mul(s[0]).x.cmp(this.g.x.redMul(e)) === 0 ? r = s[0] : (r = s[1], Lf(this.g.mul(r).x.cmp(this.g.x.redMul(e)) === 0));
    }
    var c;
    return t.basis ? c = t.basis.map(function(l) {
      return {
        a: new z(l.a, 16),
        b: new z(l.b, 16)
      };
    }) : c = this._getEndoBasis(r), {
      beta: e,
      lambda: r,
      basis: c
    };
  }
}, "_getEndomorphism");
We.prototype._getEndoRoots = /* @__PURE__ */ a(function(t) {
  var e = t === this.p ? this.red : z.mont(t), r = new z(2).toRed(e).redInvm(), n = r.redNeg(), s = new z(3).toRed(e).redNeg().redSqrt().redMul(r), c = n.redAdd(s).fromRed(), l = n.redSub(s).fromRed();
  return [c, l];
}, "_getEndoRoots");
We.prototype._getEndoBasis = /* @__PURE__ */ a(function(t) {
  for (var e = this.n.ushrn(Math.floor(this.n.bitLength() / 2)), r = t, n = this.n.clone(), s = new z(1), c = new z(0), l = new z(0), p = new z(1), y, x, _, E, R, A, P, L = 0, $, j; r.cmpn(0) !== 0; ) {
    var J = n.div(r);
    $ = n.sub(J.mul(r)), j = l.sub(J.mul(s));
    var V = p.sub(J.mul(c));
    if (!_ && $.cmp(e) < 0)
      y = P.neg(), x = s, _ = $.neg(), E = j;
    else if (_ && ++L === 2)
      break;
    P = $, n = r, r = $, l = s, s = j, p = c, c = V;
  }
  R = $.neg(), A = j;
  var K = _.sqr().add(E.sqr()), G = R.sqr().add(A.sqr());
  return G.cmp(K) >= 0 && (R = y, A = x), _.negative && (_ = _.neg(), E = E.neg()), R.negative && (R = R.neg(), A = A.neg()), [
    { a: _, b: E },
    { a: R, b: A }
  ];
}, "_getEndoBasis");
We.prototype._endoSplit = /* @__PURE__ */ a(function(t) {
  var e = this.endo.basis, r = e[0], n = e[1], s = n.b.mul(t).divRound(this.n), c = r.b.neg().mul(t).divRound(this.n), l = s.mul(r.a), p = c.mul(n.a), y = s.mul(r.b), x = c.mul(n.b), _ = t.sub(l).sub(p), E = y.add(x).neg();
  return { k1: _, k2: E };
}, "_endoSplit");
We.prototype.pointFromX = /* @__PURE__ */ a(function(t, e) {
  t = new z(t, 16), t.red || (t = t.toRed(this.red));
  var r = t.redSqr().redMul(t).redIAdd(t.redMul(this.a)).redIAdd(this.b), n = r.redSqrt();
  if (n.redSqr().redSub(r).cmp(this.zero) !== 0)
    throw new Error("invalid point");
  var s = n.fromRed().isOdd();
  return (e && !s || !e && s) && (n = n.redNeg()), this.point(t, n);
}, "pointFromX");
We.prototype.validate = /* @__PURE__ */ a(function(t) {
  if (t.inf)
    return !0;
  var e = t.x, r = t.y, n = this.a.redMul(e), s = e.redSqr().redMul(e).redIAdd(n).redIAdd(this.b);
  return r.redSqr().redISub(s).cmpn(0) === 0;
}, "validate");
We.prototype._endoWnafMulAdd = /* @__PURE__ */ a(function(t, e, r) {
  for (var n = this._endoWnafT1, s = this._endoWnafT2, c = 0; c < t.length; c++) {
    var l = this._endoSplit(e[c]), p = t[c], y = p._getBeta();
    l.k1.negative && (l.k1.ineg(), p = p.neg(!0)), l.k2.negative && (l.k2.ineg(), y = y.neg(!0)), n[c * 2] = p, n[c * 2 + 1] = y, s[c * 2] = l.k1, s[c * 2 + 1] = l.k2;
  }
  for (var x = this._wnafMulAdd(1, n, s, c * 2, r), _ = 0; _ < c * 2; _++)
    n[_] = null, s[_] = null;
  return x;
}, "_endoWnafMulAdd");
function Le(i, t, e, r) {
  Gt.BasePoint.call(this, i, "affine"), t === null && e === null ? (this.x = null, this.y = null, this.inf = !0) : (this.x = new z(t, 16), this.y = new z(e, 16), r && (this.x.forceRed(this.curve.red), this.y.forceRed(this.curve.red)), this.x.red || (this.x = this.x.toRed(this.curve.red)), this.y.red || (this.y = this.y.toRed(this.curve.red)), this.inf = !1);
}
a(Le, "Point");
Yi(Le, Gt.BasePoint);
We.prototype.point = /* @__PURE__ */ a(function(t, e, r) {
  return new Le(this, t, e, r);
}, "point");
We.prototype.pointFromJSON = /* @__PURE__ */ a(function(t, e) {
  return Le.fromJSON(this, t, e);
}, "pointFromJSON");
Le.prototype._getBeta = /* @__PURE__ */ a(function() {
  if (this.curve.endo) {
    var t = this.precomputed;
    if (t && t.beta)
      return t.beta;
    var e = this.curve.point(this.x.redMul(this.curve.endo.beta), this.y);
    if (t) {
      var r = this.curve, n = /* @__PURE__ */ a(function(s) {
        return r.point(s.x.redMul(r.endo.beta), s.y);
      }, "endoMul");
      t.beta = e, e.precomputed = {
        beta: null,
        naf: t.naf && {
          wnd: t.naf.wnd,
          points: t.naf.points.map(n)
        },
        doubles: t.doubles && {
          step: t.doubles.step,
          points: t.doubles.points.map(n)
        }
      };
    }
    return e;
  }
}, "_getBeta");
Le.prototype.toJSON = /* @__PURE__ */ a(function() {
  return this.precomputed ? [this.x, this.y, this.precomputed && {
    doubles: this.precomputed.doubles && {
      step: this.precomputed.doubles.step,
      points: this.precomputed.doubles.points.slice(1)
    },
    naf: this.precomputed.naf && {
      wnd: this.precomputed.naf.wnd,
      points: this.precomputed.naf.points.slice(1)
    }
  }] : [this.x, this.y];
}, "toJSON");
Le.fromJSON = /* @__PURE__ */ a(function(t, e, r) {
  typeof e == "string" && (e = JSON.parse(e));
  var n = t.point(e[0], e[1], r);
  if (!e[2])
    return n;
  function s(l) {
    return t.point(l[0], l[1], r);
  }
  a(s, "obj2point");
  var c = e[2];
  return n.precomputed = {
    beta: null,
    doubles: c.doubles && {
      step: c.doubles.step,
      points: [n].concat(c.doubles.points.map(s))
    },
    naf: c.naf && {
      wnd: c.naf.wnd,
      points: [n].concat(c.naf.points.map(s))
    }
  }, n;
}, "fromJSON");
Le.prototype.inspect = /* @__PURE__ */ a(function() {
  return this.isInfinity() ? "<EC Point Infinity>" : "<EC Point x: " + this.x.fromRed().toString(16, 2) + " y: " + this.y.fromRed().toString(16, 2) + ">";
}, "inspect");
Le.prototype.isInfinity = /* @__PURE__ */ a(function() {
  return this.inf;
}, "isInfinity");
Le.prototype.add = /* @__PURE__ */ a(function(t) {
  if (this.inf)
    return t;
  if (t.inf)
    return this;
  if (this.eq(t))
    return this.dbl();
  if (this.neg().eq(t))
    return this.curve.point(null, null);
  if (this.x.cmp(t.x) === 0)
    return this.curve.point(null, null);
  var e = this.y.redSub(t.y);
  e.cmpn(0) !== 0 && (e = e.redMul(this.x.redSub(t.x).redInvm()));
  var r = e.redSqr().redISub(this.x).redISub(t.x), n = e.redMul(this.x.redSub(r)).redISub(this.y);
  return this.curve.point(r, n);
}, "add");
Le.prototype.dbl = /* @__PURE__ */ a(function() {
  if (this.inf)
    return this;
  var t = this.y.redAdd(this.y);
  if (t.cmpn(0) === 0)
    return this.curve.point(null, null);
  var e = this.curve.a, r = this.x.redSqr(), n = t.redInvm(), s = r.redAdd(r).redIAdd(r).redIAdd(e).redMul(n), c = s.redSqr().redISub(this.x.redAdd(this.x)), l = s.redMul(this.x.redSub(c)).redISub(this.y);
  return this.curve.point(c, l);
}, "dbl");
Le.prototype.getX = /* @__PURE__ */ a(function() {
  return this.x.fromRed();
}, "getX");
Le.prototype.getY = /* @__PURE__ */ a(function() {
  return this.y.fromRed();
}, "getY");
Le.prototype.mul = /* @__PURE__ */ a(function(t) {
  return t = new z(t, 16), this.isInfinity() ? this : this._hasDoubles(t) ? this.curve._fixedNafMul(this, t) : this.curve.endo ? this.curve._endoWnafMulAdd([this], [t]) : this.curve._wnafMul(this, t);
}, "mul");
Le.prototype.mulAdd = /* @__PURE__ */ a(function(t, e, r) {
  var n = [this, e], s = [t, r];
  return this.curve.endo ? this.curve._endoWnafMulAdd(n, s) : this.curve._wnafMulAdd(1, n, s, 2);
}, "mulAdd");
Le.prototype.jmulAdd = /* @__PURE__ */ a(function(t, e, r) {
  var n = [this, e], s = [t, r];
  return this.curve.endo ? this.curve._endoWnafMulAdd(n, s, !0) : this.curve._wnafMulAdd(1, n, s, 2, !0);
}, "jmulAdd");
Le.prototype.eq = /* @__PURE__ */ a(function(t) {
  return this === t || this.inf === t.inf && (this.inf || this.x.cmp(t.x) === 0 && this.y.cmp(t.y) === 0);
}, "eq");
Le.prototype.neg = /* @__PURE__ */ a(function(t) {
  if (this.inf)
    return this;
  var e = this.curve.point(this.x, this.y.redNeg());
  if (t && this.precomputed) {
    var r = this.precomputed, n = /* @__PURE__ */ a(function(s) {
      return s.neg();
    }, "negate");
    e.precomputed = {
      naf: r.naf && {
        wnd: r.naf.wnd,
        points: r.naf.points.map(n)
      },
      doubles: r.doubles && {
        step: r.doubles.step,
        points: r.doubles.points.map(n)
      }
    };
  }
  return e;
}, "neg");
Le.prototype.toJ = /* @__PURE__ */ a(function() {
  if (this.inf)
    return this.curve.jpoint(null, null, null);
  var t = this.curve.jpoint(this.x, this.y, this.curve.one);
  return t;
}, "toJ");
function Ue(i, t, e, r) {
  Gt.BasePoint.call(this, i, "jacobian"), t === null && e === null && r === null ? (this.x = this.curve.one, this.y = this.curve.one, this.z = new z(0)) : (this.x = new z(t, 16), this.y = new z(e, 16), this.z = new z(r, 16)), this.x.red || (this.x = this.x.toRed(this.curve.red)), this.y.red || (this.y = this.y.toRed(this.curve.red)), this.z.red || (this.z = this.z.toRed(this.curve.red)), this.zOne = this.z === this.curve.one;
}
a(Ue, "JPoint");
Yi(Ue, Gt.BasePoint);
We.prototype.jpoint = /* @__PURE__ */ a(function(t, e, r) {
  return new Ue(this, t, e, r);
}, "jpoint");
Ue.prototype.toP = /* @__PURE__ */ a(function() {
  if (this.isInfinity())
    return this.curve.point(null, null);
  var t = this.z.redInvm(), e = t.redSqr(), r = this.x.redMul(e), n = this.y.redMul(e).redMul(t);
  return this.curve.point(r, n);
}, "toP");
Ue.prototype.neg = /* @__PURE__ */ a(function() {
  return this.curve.jpoint(this.x, this.y.redNeg(), this.z);
}, "neg");
Ue.prototype.add = /* @__PURE__ */ a(function(t) {
  if (this.isInfinity())
    return t;
  if (t.isInfinity())
    return this;
  var e = t.z.redSqr(), r = this.z.redSqr(), n = this.x.redMul(e), s = t.x.redMul(r), c = this.y.redMul(e.redMul(t.z)), l = t.y.redMul(r.redMul(this.z)), p = n.redSub(s), y = c.redSub(l);
  if (p.cmpn(0) === 0)
    return y.cmpn(0) !== 0 ? this.curve.jpoint(null, null, null) : this.dbl();
  var x = p.redSqr(), _ = x.redMul(p), E = n.redMul(x), R = y.redSqr().redIAdd(_).redISub(E).redISub(E), A = y.redMul(E.redISub(R)).redISub(c.redMul(_)), P = this.z.redMul(t.z).redMul(p);
  return this.curve.jpoint(R, A, P);
}, "add");
Ue.prototype.mixedAdd = /* @__PURE__ */ a(function(t) {
  if (this.isInfinity())
    return t.toJ();
  if (t.isInfinity())
    return this;
  var e = this.z.redSqr(), r = this.x, n = t.x.redMul(e), s = this.y, c = t.y.redMul(e).redMul(this.z), l = r.redSub(n), p = s.redSub(c);
  if (l.cmpn(0) === 0)
    return p.cmpn(0) !== 0 ? this.curve.jpoint(null, null, null) : this.dbl();
  var y = l.redSqr(), x = y.redMul(l), _ = r.redMul(y), E = p.redSqr().redIAdd(x).redISub(_).redISub(_), R = p.redMul(_.redISub(E)).redISub(s.redMul(x)), A = this.z.redMul(l);
  return this.curve.jpoint(E, R, A);
}, "mixedAdd");
Ue.prototype.dblp = /* @__PURE__ */ a(function(t) {
  if (t === 0)
    return this;
  if (this.isInfinity())
    return this;
  if (!t)
    return this.dbl();
  var e;
  if (this.curve.zeroA || this.curve.threeA) {
    var r = this;
    for (e = 0; e < t; e++)
      r = r.dbl();
    return r;
  }
  var n = this.curve.a, s = this.curve.tinv, c = this.x, l = this.y, p = this.z, y = p.redSqr().redSqr(), x = l.redAdd(l);
  for (e = 0; e < t; e++) {
    var _ = c.redSqr(), E = x.redSqr(), R = E.redSqr(), A = _.redAdd(_).redIAdd(_).redIAdd(n.redMul(y)), P = c.redMul(E), L = A.redSqr().redISub(P.redAdd(P)), $ = P.redISub(L), j = A.redMul($);
    j = j.redIAdd(j).redISub(R);
    var J = x.redMul(p);
    e + 1 < t && (y = y.redMul(R)), c = L, p = J, x = j;
  }
  return this.curve.jpoint(c, x.redMul(s), p);
}, "dblp");
Ue.prototype.dbl = /* @__PURE__ */ a(function() {
  return this.isInfinity() ? this : this.curve.zeroA ? this._zeroDbl() : this.curve.threeA ? this._threeDbl() : this._dbl();
}, "dbl");
Ue.prototype._zeroDbl = /* @__PURE__ */ a(function() {
  var t, e, r;
  if (this.zOne) {
    var n = this.x.redSqr(), s = this.y.redSqr(), c = s.redSqr(), l = this.x.redAdd(s).redSqr().redISub(n).redISub(c);
    l = l.redIAdd(l);
    var p = n.redAdd(n).redIAdd(n), y = p.redSqr().redISub(l).redISub(l), x = c.redIAdd(c);
    x = x.redIAdd(x), x = x.redIAdd(x), t = y, e = p.redMul(l.redISub(y)).redISub(x), r = this.y.redAdd(this.y);
  } else {
    var _ = this.x.redSqr(), E = this.y.redSqr(), R = E.redSqr(), A = this.x.redAdd(E).redSqr().redISub(_).redISub(R);
    A = A.redIAdd(A);
    var P = _.redAdd(_).redIAdd(_), L = P.redSqr(), $ = R.redIAdd(R);
    $ = $.redIAdd($), $ = $.redIAdd($), t = L.redISub(A).redISub(A), e = P.redMul(A.redISub(t)).redISub($), r = this.y.redMul(this.z), r = r.redIAdd(r);
  }
  return this.curve.jpoint(t, e, r);
}, "_zeroDbl");
Ue.prototype._threeDbl = /* @__PURE__ */ a(function() {
  var t, e, r;
  if (this.zOne) {
    var n = this.x.redSqr(), s = this.y.redSqr(), c = s.redSqr(), l = this.x.redAdd(s).redSqr().redISub(n).redISub(c);
    l = l.redIAdd(l);
    var p = n.redAdd(n).redIAdd(n).redIAdd(this.curve.a), y = p.redSqr().redISub(l).redISub(l);
    t = y;
    var x = c.redIAdd(c);
    x = x.redIAdd(x), x = x.redIAdd(x), e = p.redMul(l.redISub(y)).redISub(x), r = this.y.redAdd(this.y);
  } else {
    var _ = this.z.redSqr(), E = this.y.redSqr(), R = this.x.redMul(E), A = this.x.redSub(_).redMul(this.x.redAdd(_));
    A = A.redAdd(A).redIAdd(A);
    var P = R.redIAdd(R);
    P = P.redIAdd(P);
    var L = P.redAdd(P);
    t = A.redSqr().redISub(L), r = this.y.redAdd(this.z).redSqr().redISub(E).redISub(_);
    var $ = E.redSqr();
    $ = $.redIAdd($), $ = $.redIAdd($), $ = $.redIAdd($), e = A.redMul(P.redISub(t)).redISub($);
  }
  return this.curve.jpoint(t, e, r);
}, "_threeDbl");
Ue.prototype._dbl = /* @__PURE__ */ a(function() {
  var t = this.curve.a, e = this.x, r = this.y, n = this.z, s = n.redSqr().redSqr(), c = e.redSqr(), l = r.redSqr(), p = c.redAdd(c).redIAdd(c).redIAdd(t.redMul(s)), y = e.redAdd(e);
  y = y.redIAdd(y);
  var x = y.redMul(l), _ = p.redSqr().redISub(x.redAdd(x)), E = x.redISub(_), R = l.redSqr();
  R = R.redIAdd(R), R = R.redIAdd(R), R = R.redIAdd(R);
  var A = p.redMul(E).redISub(R), P = r.redAdd(r).redMul(n);
  return this.curve.jpoint(_, A, P);
}, "_dbl");
Ue.prototype.trpl = /* @__PURE__ */ a(function() {
  if (!this.curve.zeroA)
    return this.dbl().add(this);
  var t = this.x.redSqr(), e = this.y.redSqr(), r = this.z.redSqr(), n = e.redSqr(), s = t.redAdd(t).redIAdd(t), c = s.redSqr(), l = this.x.redAdd(e).redSqr().redISub(t).redISub(n);
  l = l.redIAdd(l), l = l.redAdd(l).redIAdd(l), l = l.redISub(c);
  var p = l.redSqr(), y = n.redIAdd(n);
  y = y.redIAdd(y), y = y.redIAdd(y), y = y.redIAdd(y);
  var x = s.redIAdd(l).redSqr().redISub(c).redISub(p).redISub(y), _ = e.redMul(x);
  _ = _.redIAdd(_), _ = _.redIAdd(_);
  var E = this.x.redMul(p).redISub(_);
  E = E.redIAdd(E), E = E.redIAdd(E);
  var R = this.y.redMul(x.redMul(y.redISub(x)).redISub(l.redMul(p)));
  R = R.redIAdd(R), R = R.redIAdd(R), R = R.redIAdd(R);
  var A = this.z.redAdd(l).redSqr().redISub(r).redISub(p);
  return this.curve.jpoint(E, R, A);
}, "trpl");
Ue.prototype.mul = /* @__PURE__ */ a(function(t, e) {
  return t = new z(t, e), this.curve._wnafMul(this, t);
}, "mul");
Ue.prototype.eq = /* @__PURE__ */ a(function(t) {
  if (t.type === "affine")
    return this.eq(t.toJ());
  if (this === t)
    return !0;
  var e = this.z.redSqr(), r = t.z.redSqr();
  if (this.x.redMul(r).redISub(t.x.redMul(e)).cmpn(0) !== 0)
    return !1;
  var n = e.redMul(this.z), s = r.redMul(t.z);
  return this.y.redMul(s).redISub(t.y.redMul(n)).cmpn(0) === 0;
}, "eq");
Ue.prototype.eqXToP = /* @__PURE__ */ a(function(t) {
  var e = this.z.redSqr(), r = t.toRed(this.curve.red).redMul(e);
  if (this.x.cmp(r) === 0)
    return !0;
  for (var n = t.clone(), s = this.curve.redN.redMul(e); ; ) {
    if (n.iadd(this.curve.n), n.cmp(this.curve.p) >= 0)
      return !1;
    if (r.redIAdd(s), this.x.cmp(r) === 0)
      return !0;
  }
}, "eqXToP");
Ue.prototype.inspect = /* @__PURE__ */ a(function() {
  return this.isInfinity() ? "<EC JPoint Infinity>" : "<EC JPoint x: " + this.x.toString(16, 2) + " y: " + this.y.toString(16, 2) + " z: " + this.z.toString(16, 2) + ">";
}, "inspect");
Ue.prototype.isInfinity = /* @__PURE__ */ a(function() {
  return this.z.cmpn(0) === 0;
}, "isInfinity");
var Ir = sr(function(i, t) {
  var e = t;
  e.base = Gt, e.short = Df, e.mont = /*RicMoo:ethers:require(./mont)*/
  null, e.edwards = /*RicMoo:ethers:require(./edwards)*/
  null;
}), Rr = sr(function(i, t) {
  var e = t, r = je.assert;
  function n(l) {
    l.type === "short" ? this.curve = new Ir.short(l) : l.type === "edwards" ? this.curve = new Ir.edwards(l) : this.curve = new Ir.mont(l), this.g = this.curve.g, this.n = this.curve.n, this.hash = l.hash, r(this.g.validate(), "Invalid curve"), r(this.g.mul(this.n).isInfinity(), "Invalid curve, G*N != O");
  }
  a(n, "PresetCurve"), e.PresetCurve = n;
  function s(l, p) {
    Object.defineProperty(e, l, {
      configurable: !0,
      enumerable: !0,
      get: function() {
        var y = new n(p);
        return Object.defineProperty(e, l, {
          configurable: !0,
          enumerable: !0,
          value: y
        }), y;
      }
    });
  }
  a(s, "defineCurve"), s("p192", {
    type: "short",
    prime: "p192",
    p: "ffffffff ffffffff ffffffff fffffffe ffffffff ffffffff",
    a: "ffffffff ffffffff ffffffff fffffffe ffffffff fffffffc",
    b: "64210519 e59c80e7 0fa7e9ab 72243049 feb8deec c146b9b1",
    n: "ffffffff ffffffff ffffffff 99def836 146bc9b1 b4d22831",
    hash: ct.sha256,
    gRed: !1,
    g: [
      "188da80e b03090f6 7cbf20eb 43a18800 f4ff0afd 82ff1012",
      "07192b95 ffc8da78 631011ed 6b24cdd5 73f977a1 1e794811"
    ]
  }), s("p224", {
    type: "short",
    prime: "p224",
    p: "ffffffff ffffffff ffffffff ffffffff 00000000 00000000 00000001",
    a: "ffffffff ffffffff ffffffff fffffffe ffffffff ffffffff fffffffe",
    b: "b4050a85 0c04b3ab f5413256 5044b0b7 d7bfd8ba 270b3943 2355ffb4",
    n: "ffffffff ffffffff ffffffff ffff16a2 e0b8f03e 13dd2945 5c5c2a3d",
    hash: ct.sha256,
    gRed: !1,
    g: [
      "b70e0cbd 6bb4bf7f 321390b9 4a03c1d3 56c21122 343280d6 115c1d21",
      "bd376388 b5f723fb 4c22dfe6 cd4375a0 5a074764 44d58199 85007e34"
    ]
  }), s("p256", {
    type: "short",
    prime: null,
    p: "ffffffff 00000001 00000000 00000000 00000000 ffffffff ffffffff ffffffff",
    a: "ffffffff 00000001 00000000 00000000 00000000 ffffffff ffffffff fffffffc",
    b: "5ac635d8 aa3a93e7 b3ebbd55 769886bc 651d06b0 cc53b0f6 3bce3c3e 27d2604b",
    n: "ffffffff 00000000 ffffffff ffffffff bce6faad a7179e84 f3b9cac2 fc632551",
    hash: ct.sha256,
    gRed: !1,
    g: [
      "6b17d1f2 e12c4247 f8bce6e5 63a440f2 77037d81 2deb33a0 f4a13945 d898c296",
      "4fe342e2 fe1a7f9b 8ee7eb4a 7c0f9e16 2bce3357 6b315ece cbb64068 37bf51f5"
    ]
  }), s("p384", {
    type: "short",
    prime: null,
    p: "ffffffff ffffffff ffffffff ffffffff ffffffff ffffffff ffffffff fffffffe ffffffff 00000000 00000000 ffffffff",
    a: "ffffffff ffffffff ffffffff ffffffff ffffffff ffffffff ffffffff fffffffe ffffffff 00000000 00000000 fffffffc",
    b: "b3312fa7 e23ee7e4 988e056b e3f82d19 181d9c6e fe814112 0314088f 5013875a c656398d 8a2ed19d 2a85c8ed d3ec2aef",
    n: "ffffffff ffffffff ffffffff ffffffff ffffffff ffffffff c7634d81 f4372ddf 581a0db2 48b0a77a ecec196a ccc52973",
    hash: ct.sha384,
    gRed: !1,
    g: [
      "aa87ca22 be8b0537 8eb1c71e f320ad74 6e1d3b62 8ba79b98 59f741e0 82542a38 5502f25d bf55296c 3a545e38 72760ab7",
      "3617de4a 96262c6f 5d9e98bf 9292dc29 f8f41dbd 289a147c e9da3113 b5f0b8c0 0a60b1ce 1d7e819d 7a431d7c 90ea0e5f"
    ]
  }), s("p521", {
    type: "short",
    prime: null,
    p: "000001ff ffffffff ffffffff ffffffff ffffffff ffffffff ffffffff ffffffff ffffffff ffffffff ffffffff ffffffff ffffffff ffffffff ffffffff ffffffff ffffffff",
    a: "000001ff ffffffff ffffffff ffffffff ffffffff ffffffff ffffffff ffffffff ffffffff ffffffff ffffffff ffffffff ffffffff ffffffff ffffffff ffffffff fffffffc",
    b: "00000051 953eb961 8e1c9a1f 929a21a0 b68540ee a2da725b 99b315f3 b8b48991 8ef109e1 56193951 ec7e937b 1652c0bd 3bb1bf07 3573df88 3d2c34f1 ef451fd4 6b503f00",
    n: "000001ff ffffffff ffffffff ffffffff ffffffff ffffffff ffffffff ffffffff fffffffa 51868783 bf2f966b 7fcc0148 f709a5d0 3bb5c9b8 899c47ae bb6fb71e 91386409",
    hash: ct.sha512,
    gRed: !1,
    g: [
      "000000c6 858e06b7 0404e9cd 9e3ecb66 2395b442 9c648139 053fb521 f828af60 6b4d3dba a14b5e77 efe75928 fe1dc127 a2ffa8de 3348b3c1 856a429b f97e7e31 c2e5bd66",
      "00000118 39296a78 9a3bc004 5c8a5fb4 2c7d1bd9 98f54449 579b4468 17afbd17 273e662c 97ee7299 5ef42640 c550b901 3fad0761 353c7086 a272c240 88be9476 9fd16650"
    ]
  }), s("curve25519", {
    type: "mont",
    prime: "p25519",
    p: "7fffffffffffffff ffffffffffffffff ffffffffffffffff ffffffffffffffed",
    a: "76d06",
    b: "1",
    n: "1000000000000000 0000000000000000 14def9dea2f79cd6 5812631a5cf5d3ed",
    hash: ct.sha256,
    gRed: !1,
    g: [
      "9"
    ]
  }), s("ed25519", {
    type: "edwards",
    prime: "p25519",
    p: "7fffffffffffffff ffffffffffffffff ffffffffffffffff ffffffffffffffed",
    a: "-1",
    c: "1",
    // -121665 * (121666^(-1)) (mod P)
    d: "52036cee2b6ffe73 8cc740797779e898 00700a4d4141d8ab 75eb4dca135978a3",
    n: "1000000000000000 0000000000000000 14def9dea2f79cd6 5812631a5cf5d3ed",
    hash: ct.sha256,
    gRed: !1,
    g: [
      "216936d3cd6e53fec0a4e231fdd6dc5c692cc7609525a7b2c9562d608f25d51a",
      // 4/5
      "6666666666666666666666666666666666666666666666666666666666666658"
    ]
  });
  var c;
  try {
    c = /*RicMoo:ethers:require(./precomputed/secp256k1)*/
    null.crash();
  } catch {
    c = void 0;
  }
  s("secp256k1", {
    type: "short",
    prime: "k256",
    p: "ffffffff ffffffff ffffffff ffffffff ffffffff ffffffff fffffffe fffffc2f",
    a: "0",
    b: "7",
    n: "ffffffff ffffffff ffffffff fffffffe baaedce6 af48a03b bfd25e8c d0364141",
    h: "1",
    hash: ct.sha256,
    // Precomputed endomorphism
    beta: "7ae96a2b657c07106e64479eac3434e99cf0497512f58995c1396c28719501ee",
    lambda: "5363ad4cc05c30e0a5261c028812645a122e22ea20816678df02967c1b23bd72",
    basis: [
      {
        a: "3086d221a7d46bcde86c90e49284eb15",
        b: "-e4437ed6010e88286f547fa90abfe4c3"
      },
      {
        a: "114ca50f7a8e2f3f657c1108d9d44cfd8",
        b: "3086d221a7d46bcde86c90e49284eb15"
      }
    ],
    gRed: !1,
    g: [
      "79be667ef9dcbbac55a06295ce870b07029bfcdb2dce28d959f2815b16f81798",
      "483ada7726a3c4655da4fbfc0e1108a8fd17b448a68554199c47d08ffb10d4b8",
      c
    ]
  });
});
function At(i) {
  if (!(this instanceof At))
    return new At(i);
  this.hash = i.hash, this.predResist = !!i.predResist, this.outLen = this.hash.outSize, this.minEntropy = i.minEntropy || this.hash.hmacStrength, this._reseed = null, this.reseedInterval = null, this.K = null, this.V = null;
  var t = Qe.toArray(i.entropy, i.entropyEnc || "hex"), e = Qe.toArray(i.nonce, i.nonceEnc || "hex"), r = Qe.toArray(i.pers, i.persEnc || "hex");
  Xi(
    t.length >= this.minEntropy / 8,
    "Not enough entropy. Minimum is: " + this.minEntropy + " bits"
  ), this._init(t, e, r);
}
a(At, "HmacDRBG");
var zs = At;
At.prototype._init = /* @__PURE__ */ a(function(t, e, r) {
  var n = t.concat(e).concat(r);
  this.K = new Array(this.outLen / 8), this.V = new Array(this.outLen / 8);
  for (var s = 0; s < this.V.length; s++)
    this.K[s] = 0, this.V[s] = 1;
  this._update(n), this._reseed = 1, this.reseedInterval = 281474976710656;
}, "init");
At.prototype._hmac = /* @__PURE__ */ a(function() {
  return new ct.hmac(this.hash, this.K);
}, "hmac");
At.prototype._update = /* @__PURE__ */ a(function(t) {
  var e = this._hmac().update(this.V).update([0]);
  t && (e = e.update(t)), this.K = e.digest(), this.V = this._hmac().update(this.V).digest(), t && (this.K = this._hmac().update(this.V).update([1]).update(t).digest(), this.V = this._hmac().update(this.V).digest());
}, "update");
At.prototype.reseed = /* @__PURE__ */ a(function(t, e, r, n) {
  typeof e != "string" && (n = r, r = e, e = null), t = Qe.toArray(t, e), r = Qe.toArray(r, n), Xi(
    t.length >= this.minEntropy / 8,
    "Not enough entropy. Minimum is: " + this.minEntropy + " bits"
  ), this._update(t.concat(r || [])), this._reseed = 1;
}, "reseed");
At.prototype.generate = /* @__PURE__ */ a(function(t, e, r, n) {
  if (this._reseed > this.reseedInterval)
    throw new Error("Reseed is required");
  typeof e != "string" && (n = r, r = e, e = null), r && (r = Qe.toArray(r, n || "hex"), this._update(r));
  for (var s = []; s.length < t; )
    this.V = this._hmac().update(this.V).digest(), s = s.concat(this.V);
  var c = s.slice(0, t);
  return this._update(r), this._reseed++, Qe.encode(c, e);
}, "generate");
var Ai = je.assert;
function ze(i, t) {
  this.ec = i, this.priv = null, this.pub = null, t.priv && this._importPrivate(t.priv, t.privEnc), t.pub && this._importPublic(t.pub, t.pubEnc);
}
a(ze, "KeyPair");
var Zi = ze;
ze.fromPublic = /* @__PURE__ */ a(function(t, e, r) {
  return e instanceof ze ? e : new ze(t, {
    pub: e,
    pubEnc: r
  });
}, "fromPublic");
ze.fromPrivate = /* @__PURE__ */ a(function(t, e, r) {
  return e instanceof ze ? e : new ze(t, {
    priv: e,
    privEnc: r
  });
}, "fromPrivate");
ze.prototype.validate = /* @__PURE__ */ a(function() {
  var t = this.getPublic();
  return t.isInfinity() ? { result: !1, reason: "Invalid public key" } : t.validate() ? t.mul(this.ec.curve.n).isInfinity() ? { result: !0, reason: null } : { result: !1, reason: "Public key * N != O" } : { result: !1, reason: "Public key is not a point" };
}, "validate");
ze.prototype.getPublic = /* @__PURE__ */ a(function(t, e) {
  return typeof t == "string" && (e = t, t = null), this.pub || (this.pub = this.ec.g.mul(this.priv)), e ? this.pub.encode(e, t) : this.pub;
}, "getPublic");
ze.prototype.getPrivate = /* @__PURE__ */ a(function(t) {
  return t === "hex" ? this.priv.toString(16, 2) : this.priv;
}, "getPrivate");
ze.prototype._importPrivate = /* @__PURE__ */ a(function(t, e) {
  this.priv = new z(t, e || 16), this.priv = this.priv.umod(this.ec.curve.n);
}, "_importPrivate");
ze.prototype._importPublic = /* @__PURE__ */ a(function(t, e) {
  if (t.x || t.y) {
    this.ec.curve.type === "mont" ? Ai(t.x, "Need x coordinate") : (this.ec.curve.type === "short" || this.ec.curve.type === "edwards") && Ai(t.x && t.y, "Need both x and y coordinate"), this.pub = this.ec.curve.point(t.x, t.y);
    return;
  }
  this.pub = this.ec.curve.decodePoint(t, e);
}, "_importPublic");
ze.prototype.derive = /* @__PURE__ */ a(function(t) {
  return t.validate() || Ai(t.validate(), "public point not validated"), t.mul(this.priv).getX();
}, "derive");
ze.prototype.sign = /* @__PURE__ */ a(function(t, e, r) {
  return this.ec.sign(t, this, e, r);
}, "sign");
ze.prototype.verify = /* @__PURE__ */ a(function(t, e) {
  return this.ec.verify(t, e, this);
}, "verify");
ze.prototype.inspect = /* @__PURE__ */ a(function() {
  return "<Key priv: " + (this.priv && this.priv.toString(16, 2)) + " pub: " + (this.pub && this.pub.inspect()) + " >";
}, "inspect");
var Uf = je.assert;
function kr(i, t) {
  if (i instanceof kr)
    return i;
  this._importDER(i, t) || (Uf(i.r && i.s, "Signature without r or s"), this.r = new z(i.r, 16), this.s = new z(i.s, 16), i.recoveryParam === void 0 ? this.recoveryParam = null : this.recoveryParam = i.recoveryParam);
}
a(kr, "Signature");
var zr = kr;
function kf() {
  this.place = 0;
}
a(kf, "Position");
function li(i, t) {
  var e = i[t.place++];
  if (!(e & 128))
    return e;
  var r = e & 15;
  if (r === 0 || r > 4)
    return !1;
  for (var n = 0, s = 0, c = t.place; s < r; s++, c++)
    n <<= 8, n |= i[c], n >>>= 0;
  return n <= 127 ? !1 : (t.place = c, n);
}
a(li, "getLength");
function Tn(i) {
  for (var t = 0, e = i.length - 1; !i[t] && !(i[t + 1] & 128) && t < e; )
    t++;
  return t === 0 ? i : i.slice(t);
}
a(Tn, "rmPadding");
kr.prototype._importDER = /* @__PURE__ */ a(function(t, e) {
  t = je.toArray(t, e);
  var r = new kf();
  if (t[r.place++] !== 48)
    return !1;
  var n = li(t, r);
  if (n === !1 || n + r.place !== t.length || t[r.place++] !== 2)
    return !1;
  var s = li(t, r);
  if (s === !1)
    return !1;
  var c = t.slice(r.place, s + r.place);
  if (r.place += s, t[r.place++] !== 2)
    return !1;
  var l = li(t, r);
  if (l === !1 || t.length !== l + r.place)
    return !1;
  var p = t.slice(r.place, l + r.place);
  if (c[0] === 0)
    if (c[1] & 128)
      c = c.slice(1);
    else
      return !1;
  if (p[0] === 0)
    if (p[1] & 128)
      p = p.slice(1);
    else
      return !1;
  return this.r = new z(c), this.s = new z(p), this.recoveryParam = null, !0;
}, "_importDER");
function di(i, t) {
  if (t < 128) {
    i.push(t);
    return;
  }
  var e = 1 + (Math.log(t) / Math.LN2 >>> 3);
  for (i.push(e | 128); --e; )
    i.push(t >>> (e << 3) & 255);
  i.push(t);
}
a(di, "constructLength");
kr.prototype.toDER = /* @__PURE__ */ a(function(t) {
  var e = this.r.toArray(), r = this.s.toArray();
  for (e[0] & 128 && (e = [0].concat(e)), r[0] & 128 && (r = [0].concat(r)), e = Tn(e), r = Tn(r); !r[0] && !(r[1] & 128); )
    r = r.slice(1);
  var n = [2];
  di(n, e.length), n = n.concat(e), n.push(2), di(n, r.length);
  var s = n.concat(r), c = [48];
  return di(c, s.length), c = c.concat(s), je.encode(c, t);
}, "toDER");
var zf = (
  /*RicMoo:ethers:require(brorand)*/
  /* @__PURE__ */ a(function() {
    throw new Error("unsupported");
  }, "rand")
), Bs = je.assert;
function He(i) {
  if (!(this instanceof He))
    return new He(i);
  typeof i == "string" && (Bs(
    Object.prototype.hasOwnProperty.call(Rr, i),
    "Unknown curve " + i
  ), i = Rr[i]), i instanceof Rr.PresetCurve && (i = { curve: i }), this.curve = i.curve.curve, this.n = this.curve.n, this.nh = this.n.ushrn(1), this.g = this.curve.g, this.g = i.curve.g, this.g.precompute(i.curve.n.bitLength() + 1), this.hash = i.hash || i.curve.hash;
}
a(He, "EC");
var Bf = He;
He.prototype.keyPair = /* @__PURE__ */ a(function(t) {
  return new Zi(this, t);
}, "keyPair");
He.prototype.keyFromPrivate = /* @__PURE__ */ a(function(t, e) {
  return Zi.fromPrivate(this, t, e);
}, "keyFromPrivate");
He.prototype.keyFromPublic = /* @__PURE__ */ a(function(t, e) {
  return Zi.fromPublic(this, t, e);
}, "keyFromPublic");
He.prototype.genKeyPair = /* @__PURE__ */ a(function(t) {
  t || (t = {});
  for (var e = new zs({
    hash: this.hash,
    pers: t.pers,
    persEnc: t.persEnc || "utf8",
    entropy: t.entropy || zf(this.hash.hmacStrength),
    entropyEnc: t.entropy && t.entropyEnc || "utf8",
    nonce: this.n.toArray()
  }), r = this.n.byteLength(), n = this.n.sub(new z(2)); ; ) {
    var s = new z(e.generate(r));
    if (!(s.cmp(n) > 0))
      return s.iaddn(1), this.keyFromPrivate(s);
  }
}, "genKeyPair");
He.prototype._truncateToN = /* @__PURE__ */ a(function(t, e) {
  var r = t.byteLength() * 8 - this.n.bitLength();
  return r > 0 && (t = t.ushrn(r)), !e && t.cmp(this.n) >= 0 ? t.sub(this.n) : t;
}, "_truncateToN");
He.prototype.sign = /* @__PURE__ */ a(function(t, e, r, n) {
  typeof r == "object" && (n = r, r = null), n || (n = {}), e = this.keyFromPrivate(e, r), t = this._truncateToN(new z(t, 16));
  for (var s = this.n.byteLength(), c = e.getPrivate().toArray("be", s), l = t.toArray("be", s), p = new zs({
    hash: this.hash,
    entropy: c,
    nonce: l,
    pers: n.pers,
    persEnc: n.persEnc || "utf8"
  }), y = this.n.sub(new z(1)), x = 0; ; x++) {
    var _ = n.k ? n.k(x) : new z(p.generate(this.n.byteLength()));
    if (_ = this._truncateToN(_, !0), !(_.cmpn(1) <= 0 || _.cmp(y) >= 0)) {
      var E = this.g.mul(_);
      if (!E.isInfinity()) {
        var R = E.getX(), A = R.umod(this.n);
        if (A.cmpn(0) !== 0) {
          var P = _.invm(this.n).mul(A.mul(e.getPrivate()).iadd(t));
          if (P = P.umod(this.n), P.cmpn(0) !== 0) {
            var L = (E.getY().isOdd() ? 1 : 0) | (R.cmp(A) !== 0 ? 2 : 0);
            return n.canonical && P.cmp(this.nh) > 0 && (P = this.n.sub(P), L ^= 1), new zr({ r: A, s: P, recoveryParam: L });
          }
        }
      }
    }
  }
}, "sign");
He.prototype.verify = /* @__PURE__ */ a(function(t, e, r, n) {
  t = this._truncateToN(new z(t, 16)), r = this.keyFromPublic(r, n), e = new zr(e, "hex");
  var s = e.r, c = e.s;
  if (s.cmpn(1) < 0 || s.cmp(this.n) >= 0 || c.cmpn(1) < 0 || c.cmp(this.n) >= 0)
    return !1;
  var l = c.invm(this.n), p = l.mul(t).umod(this.n), y = l.mul(s).umod(this.n), x;
  return this.curve._maxwellTrick ? (x = this.g.jmulAdd(p, r.getPublic(), y), x.isInfinity() ? !1 : x.eqXToP(s)) : (x = this.g.mulAdd(p, r.getPublic(), y), x.isInfinity() ? !1 : x.getX().umod(this.n).cmp(s) === 0);
}, "verify");
He.prototype.recoverPubKey = function(i, t, e, r) {
  Bs((3 & e) === e, "The recovery param is more than two bits"), t = new zr(t, r);
  var n = this.n, s = new z(i), c = t.r, l = t.s, p = e & 1, y = e >> 1;
  if (c.cmp(this.curve.p.umod(this.curve.n)) >= 0 && y)
    throw new Error("Unable to find sencond key candinate");
  y ? c = this.curve.pointFromX(c.add(this.curve.n), p) : c = this.curve.pointFromX(c, p);
  var x = t.r.invm(n), _ = n.sub(s).mul(x).umod(n), E = l.mul(x).umod(n);
  return this.g.mulAdd(_, c, E);
};
He.prototype.getKeyRecoveryParam = function(i, t, e, r) {
  if (t = new zr(t, r), t.recoveryParam !== null)
    return t.recoveryParam;
  for (var n = 0; n < 4; n++) {
    var s;
    try {
      s = this.recoverPubKey(i, t, n);
    } catch {
      continue;
    }
    if (s.eq(e))
      return n;
  }
  throw new Error("Unable to find valid recovery factor");
};
var Vf = sr(function(i, t) {
  var e = t;
  e.version = "6.5.4", e.utils = je, e.rand = /*RicMoo:ethers:require(brorand)*/
  function() {
    throw new Error("unsupported");
  }, e.curve = Ir, e.curves = Rr, e.ec = Bf, e.eddsa = /*RicMoo:ethers:require(./elliptic/eddsa)*/
  null;
}), Kf = Vf.ec;
const jf = "signing-key/5.7.0", Ei = new St(jf);
let pi = null;
function tt() {
  return pi || (pi = new Kf("secp256k1")), pi;
}
a(tt, "getCurve");
const tn = class tn {
  constructor(t) {
    hr(this, "curve", "secp256k1"), hr(this, "privateKey", Ve(t)), Wo(this.privateKey) !== 32 && Ei.throwArgumentError("invalid private key", "privateKey", "[[ REDACTED ]]");
    const e = tt().keyFromPrivate(Te(this.privateKey));
    hr(this, "publicKey", "0x" + e.getPublic(!1, "hex")), hr(this, "compressedPublicKey", "0x" + e.getPublic(!0, "hex")), hr(this, "_isSigningKey", !0);
  }
  _addPoint(t) {
    const e = tt().keyFromPublic(Te(this.publicKey)), r = tt().keyFromPublic(Te(t));
    return "0x" + e.pub.add(r.pub).encodeCompressed("hex");
  }
  signDigest(t) {
    const e = tt().keyFromPrivate(Te(this.privateKey)), r = Te(t);
    r.length !== 32 && Ei.throwArgumentError("bad digest length", "digest", t);
    const n = e.sign(r, { canonical: !0 });
    return ws({
      recoveryParam: n.recoveryParam,
      r: Xt("0x" + n.r.toString(16), 32),
      s: Xt("0x" + n.s.toString(16), 32)
    });
  }
  computeSharedSecret(t) {
    const e = tt().keyFromPrivate(Te(this.privateKey)), r = tt().keyFromPublic(Te(Vs(t)));
    return Xt("0x" + e.derive(r.getPublic()).toString(16), 32);
  }
  static isSigningKey(t) {
    return !!(t && t._isSigningKey);
  }
};
a(tn, "SigningKey");
let Ii = tn;
function Gf(i, t) {
  const e = ws(t), r = { r: Te(e.r), s: Te(e.s) };
  return "0x" + tt().recoverPubKey(Te(i), r, e.recoveryParam).encode("hex", !1);
}
a(Gf, "recoverPublicKey");
function Vs(i, t) {
  const e = Te(i);
  if (e.length === 32) {
    const r = new Ii(e);
    return t ? "0x" + tt().keyFromPrivate(e).getPublic(!0, "hex") : r.publicKey;
  } else {
    if (e.length === 33)
      return t ? Ve(e) : "0x" + tt().keyFromPublic(e).getPublic(!1, "hex");
    if (e.length === 65)
      return t ? "0x" + tt().keyFromPublic(e).getPublic(!0, "hex") : Ve(e);
  }
  return Ei.throwArgumentError("invalid public or private key", "key", "[REDACTED]");
}
a(Vs, "computePublicKey");
var $n;
(function(i) {
  i[i.legacy = 0] = "legacy", i[i.eip2930 = 1] = "eip2930", i[i.eip1559 = 2] = "eip1559";
})($n || ($n = {}));
function Hf(i) {
  const t = Vs(i);
  return oa(In(Hi(In(t, 1)), 12));
}
a(Hf, "computeAddress");
function Jf(i, t) {
  return Hf(Gf(Te(i), t));
}
a(Jf, "recoverAddress");
function Wf(i, t) {
  return t = t || {}, new Promise(function(e, r) {
    var n = new XMLHttpRequest(), s = [], c = [], l = {}, p = /* @__PURE__ */ a(function() {
      return { ok: (n.status / 100 | 0) == 2, statusText: n.statusText, status: n.status, url: n.responseURL, text: function() {
        return Promise.resolve(n.responseText);
      }, json: function() {
        return Promise.resolve(n.responseText).then(JSON.parse);
      }, blob: function() {
        return Promise.resolve(new Blob([n.response]));
      }, clone: p, headers: { keys: function() {
        return s;
      }, entries: function() {
        return c;
      }, get: function(x) {
        return l[x.toLowerCase()];
      }, has: function(x) {
        return x.toLowerCase() in l;
      } } };
    }, "a");
    for (var y in n.open(t.method || "get", i, !0), n.onload = function() {
      n.getAllResponseHeaders().replace(/^(.*?):[^\S\n]*([\s\S]*?)$/gm, function(x, _, E) {
        s.push(_ = _.toLowerCase()), c.push([_, E]), l[_] = l[_] ? l[_] + "," + E : E;
      }), e(p());
    }, n.onerror = r, n.withCredentials = t.credentials == "include", t.headers)
      n.setRequestHeader(y, t.headers[y]);
    n.send(t.body || null);
  });
}
a(Wf, "unfetch_module");
const Xf = /* @__PURE__ */ Object.freeze(/* @__PURE__ */ Object.defineProperty({
  __proto__: null,
  default: Wf
}, Symbol.toStringTag, { value: "Module" })), Ln = /* @__PURE__ */ xo(Xf);
var Yf = self.fetch || (self.fetch = Ln.default || Ln);
const Zf = /* @__PURE__ */ Dr(Yf);
var mr;
let Qf = (mr = class {
  constructor(t) {
    this.client = t;
  }
}, a(mr, "G"), mr);
var yr;
let eh = (yr = class {
  constructor(t) {
    this.opts = t;
  }
}, a(yr, "H"), yr);
const th = "https://rpc.walletconnect.com/v1", Mr = { wc_authRequest: { req: { ttl: X.ONE_DAY, prompt: !0, tag: 3e3 }, res: { ttl: X.ONE_DAY, prompt: !1, tag: 3001 } } }, vi = { min: X.FIVE_MINUTES, max: X.SEVEN_DAYS }, Ks = "wc", rh = 1, ih = "auth", Dn = "authClient", Nr = `${Ks}@1:${ih}:`, gr = `${Nr}:PUB_KEY`;
function Qi(i) {
  return i == null ? void 0 : i.split(":");
}
a(Qi, "z$1");
function nh(i) {
  const t = i && Qi(i);
  if (t)
    return t[3];
}
a(nh, "Ze");
function sh(i) {
  const t = i && Qi(i);
  if (t)
    return t[2] + ":" + t[3];
}
a(sh, "We");
function Un(i) {
  const t = i && Qi(i);
  if (t)
    return t.pop();
}
a(Un, "W$2");
async function oh(i, t, e, r, n) {
  switch (e.t) {
    case "eip191":
      return ah(i, t, e.s);
    case "eip1271":
      return await fh(i, t, e.s, r, n);
    default:
      throw new Error(`verifySignature failed: Attempted to verify CacaoSignature with unknown type: ${e.t}`);
  }
}
a(oh, "et");
function ah(i, t, e) {
  return Jf(bs(t), e).toLowerCase() === i.toLowerCase();
}
a(ah, "tt");
async function fh(i, t, e, r, n) {
  try {
    const s = "0x1626ba7e", c = "0000000000000000000000000000000000000000000000000000000000000040", l = "0000000000000000000000000000000000000000000000000000000000000041", p = e.substring(2), y = bs(t).substring(2), x = s + y + c + l + p, _ = await Zf(`${th}/?chainId=${r}&projectId=${n}`, { method: "POST", body: JSON.stringify({ id: hh(), jsonrpc: "2.0", method: "eth_call", params: [{ to: i, data: x }, "latest"] }) }), { result: E } = await _.json();
    return E ? E.slice(0, s.length).toLowerCase() === s.toLowerCase() : !1;
  } catch (s) {
    return console.error("isValidEip1271Signature: ", s), !1;
  }
}
a(fh, "rt");
function hh() {
  return Date.now() + Math.floor(Math.random() * 1e3);
}
a(hh, "it");
function js(i) {
  return i.getAll().filter((t) => "requester" in t);
}
a(js, "ee");
function Gs(i, t) {
  return js(i).find((e) => e.id === t);
}
a(Gs, "te");
function uh(i) {
  const t = _o(i.aud), e = new RegExp(`${i.domain}`).test(i.aud), r = !!i.nonce, n = i.type ? i.type === "eip4361" : !0, s = i.expiry;
  if (s && !vs(s, vi)) {
    const { message: c } = B("MISSING_OR_INVALID", `request() expiry: ${s}. Expiry must be a number (in seconds) between ${vi.min} and ${vi.max}`);
    throw new Error(c);
  }
  return !!(t && e && r && n);
}
a(uh, "nt");
function ch(i, t) {
  return !!Gs(t, i.id);
}
a(ch, "st");
function lh(i = 0) {
  return globalThis.Buffer != null && globalThis.Buffer.allocUnsafe != null ? globalThis.Buffer.allocUnsafe(i) : new Uint8Array(i);
}
a(lh, "ot");
function dh(i, t) {
  if (i.length >= 255)
    throw new TypeError("Alphabet too long");
  for (var e = new Uint8Array(256), r = 0; r < e.length; r++)
    e[r] = 255;
  for (var n = 0; n < i.length; n++) {
    var s = i.charAt(n), c = s.charCodeAt(0);
    if (e[c] !== 255)
      throw new TypeError(s + " is ambiguous");
    e[c] = n;
  }
  var l = i.length, p = i.charAt(0), y = Math.log(l) / Math.log(256), x = Math.log(256) / Math.log(l);
  function _(A) {
    if (A instanceof Uint8Array || (ArrayBuffer.isView(A) ? A = new Uint8Array(A.buffer, A.byteOffset, A.byteLength) : Array.isArray(A) && (A = Uint8Array.from(A))), !(A instanceof Uint8Array))
      throw new TypeError("Expected Uint8Array");
    if (A.length === 0)
      return "";
    for (var P = 0, L = 0, $ = 0, j = A.length; $ !== j && A[$] === 0; )
      $++, P++;
    for (var J = (j - $) * x + 1 >>> 0, V = new Uint8Array(J); $ !== j; ) {
      for (var K = A[$], G = 0, W = J - 1; (K !== 0 || G < L) && W !== -1; W--, G++)
        K += 256 * V[W] >>> 0, V[W] = K % l >>> 0, K = K / l >>> 0;
      if (K !== 0)
        throw new Error("Non-zero carry");
      L = G, $++;
    }
    for (var Z = J - L; Z !== J && V[Z] === 0; )
      Z++;
    for (var $e = p.repeat(P); Z < J; ++Z)
      $e += i.charAt(V[Z]);
    return $e;
  }
  a(_, "f");
  function E(A) {
    if (typeof A != "string")
      throw new TypeError("Expected String");
    if (A.length === 0)
      return new Uint8Array();
    var P = 0;
    if (A[P] !== " ") {
      for (var L = 0, $ = 0; A[P] === p; )
        L++, P++;
      for (var j = (A.length - P) * y + 1 >>> 0, J = new Uint8Array(j); A[P]; ) {
        var V = e[A.charCodeAt(P)];
        if (V === 255)
          return;
        for (var K = 0, G = j - 1; (V !== 0 || K < $) && G !== -1; G--, K++)
          V += l * J[G] >>> 0, J[G] = V % 256 >>> 0, V = V / 256 >>> 0;
        if (V !== 0)
          throw new Error("Non-zero carry");
        $ = K, P++;
      }
      if (A[P] !== " ") {
        for (var W = j - $; W !== j && J[W] === 0; )
          W++;
        for (var Z = new Uint8Array(L + (j - W)), $e = L; W !== j; )
          Z[$e++] = J[W++];
        return Z;
      }
    }
  }
  a(E, "p");
  function R(A) {
    var P = E(A);
    if (P)
      return P;
    throw new Error(`Non-${t} character`);
  }
  return a(R, "A"), { encode: _, decodeUnsafe: E, decode: R };
}
a(dh, "ut");
var ph = dh, vh = ph;
const Hs = /* @__PURE__ */ a((i) => {
  if (i instanceof Uint8Array && i.constructor.name === "Uint8Array")
    return i;
  if (i instanceof ArrayBuffer)
    return new Uint8Array(i);
  if (ArrayBuffer.isView(i))
    return new Uint8Array(i.buffer, i.byteOffset, i.byteLength);
  throw new Error("Unknown type, must be binary type");
}, "re"), gh = /* @__PURE__ */ a((i) => new TextEncoder().encode(i), "ct"), mh = /* @__PURE__ */ a((i) => new TextDecoder().decode(i), "ht"), rn = class rn {
  constructor(t, e, r) {
    this.name = t, this.prefix = e, this.baseEncode = r;
  }
  encode(t) {
    if (t instanceof Uint8Array)
      return `${this.prefix}${this.baseEncode(t)}`;
    throw Error("Unknown type, must be binary type");
  }
};
a(rn, "lt");
let Ri = rn;
const nn = class nn {
  constructor(t, e, r) {
    if (this.name = t, this.prefix = e, e.codePointAt(0) === void 0)
      throw new Error("Invalid prefix character");
    this.prefixCodePoint = e.codePointAt(0), this.baseDecode = r;
  }
  decode(t) {
    if (typeof t == "string") {
      if (t.codePointAt(0) !== this.prefixCodePoint)
        throw Error(`Unable to decode multibase string ${JSON.stringify(t)}, ${this.name} decoder only supports inputs prefixed with ${this.prefix}`);
      return this.baseDecode(t.slice(this.prefix.length));
    } else
      throw Error("Can only multibase decode strings");
  }
  or(t) {
    return Js(this, t);
  }
};
a(nn, "dt");
let Ni = nn;
const sn = class sn {
  constructor(t) {
    this.decoders = t;
  }
  or(t) {
    return Js(this, t);
  }
  decode(t) {
    const e = t[0], r = this.decoders[e];
    if (r)
      return r.decode(t);
    throw RangeError(`Unable to decode multibase string ${JSON.stringify(t)}, only inputs prefixed with ${Object.keys(this.decoders)} are supported`);
  }
};
a(sn, "pt");
let Fi = sn;
const Js = /* @__PURE__ */ a((i, t) => new Fi({ ...i.decoders || { [i.prefix]: i }, ...t.decoders || { [t.prefix]: t } }), "ie"), on = class on {
  constructor(t, e, r, n) {
    this.name = t, this.prefix = e, this.baseEncode = r, this.baseDecode = n, this.encoder = new Ri(t, e, r), this.decoder = new Ni(t, e, n);
  }
  encode(t) {
    return this.encoder.encode(t);
  }
  decode(t) {
    return this.decoder.decode(t);
  }
};
a(on, "ft");
let Pi = on;
const Br = /* @__PURE__ */ a(({ name: i, prefix: t, encode: e, decode: r }) => new Pi(i, t, e, r), "O$1"), br = /* @__PURE__ */ a(({ prefix: i, name: t, alphabet: e }) => {
  const { encode: r, decode: n } = vh(e, t);
  return Br({ prefix: i, name: t, encode: r, decode: (s) => Hs(n(s)) });
}, "T$1"), yh = /* @__PURE__ */ a((i, t, e, r) => {
  const n = {};
  for (let x = 0; x < t.length; ++x)
    n[t[x]] = x;
  let s = i.length;
  for (; i[s - 1] === "="; )
    --s;
  const c = new Uint8Array(s * e / 8 | 0);
  let l = 0, p = 0, y = 0;
  for (let x = 0; x < s; ++x) {
    const _ = n[i[x]];
    if (_ === void 0)
      throw new SyntaxError(`Non-${r} character`);
    p = p << e | _, l += e, l >= 8 && (l -= 8, c[y++] = 255 & p >> l);
  }
  if (l >= e || 255 & p << 8 - l)
    throw new SyntaxError("Unexpected end of data");
  return c;
}, "gt"), wh = /* @__PURE__ */ a((i, t, e) => {
  const r = t[t.length - 1] === "=", n = (1 << e) - 1;
  let s = "", c = 0, l = 0;
  for (let p = 0; p < i.length; ++p)
    for (l = l << 8 | i[p], c += 8; c > e; )
      c -= e, s += t[n & l >> c];
  if (c && (s += t[n & l << e - c]), r)
    for (; s.length * e & 7; )
      s += "=";
  return s;
}, "Et"), ke = /* @__PURE__ */ a(({ name: i, prefix: t, bitsPerChar: e, alphabet: r }) => Br({ prefix: t, name: i, encode(n) {
  return wh(n, r, e);
}, decode(n) {
  return yh(n, r, e, i);
} }), "d$1"), bh = Br({ prefix: "\0", name: "identity", encode: (i) => mh(i), decode: (i) => gh(i) });
var xh = Object.freeze({ __proto__: null, identity: bh });
const _h = ke({ prefix: "0", name: "base2", alphabet: "01", bitsPerChar: 1 });
var Mh = Object.freeze({ __proto__: null, base2: _h });
const Sh = ke({ prefix: "7", name: "base8", alphabet: "01234567", bitsPerChar: 3 });
var Ah = Object.freeze({ __proto__: null, base8: Sh });
const Eh = br({ prefix: "9", name: "base10", alphabet: "0123456789" });
var Ih = Object.freeze({ __proto__: null, base10: Eh });
const Rh = ke({ prefix: "f", name: "base16", alphabet: "0123456789abcdef", bitsPerChar: 4 }), Nh = ke({ prefix: "F", name: "base16upper", alphabet: "0123456789ABCDEF", bitsPerChar: 4 });
var Fh = Object.freeze({ __proto__: null, base16: Rh, base16upper: Nh });
const Ph = ke({ prefix: "b", name: "base32", alphabet: "abcdefghijklmnopqrstuvwxyz234567", bitsPerChar: 5 }), qh = ke({ prefix: "B", name: "base32upper", alphabet: "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567", bitsPerChar: 5 }), Oh = ke({ prefix: "c", name: "base32pad", alphabet: "abcdefghijklmnopqrstuvwxyz234567=", bitsPerChar: 5 }), Ch = ke({ prefix: "C", name: "base32padupper", alphabet: "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567=", bitsPerChar: 5 }), Th = ke({ prefix: "v", name: "base32hex", alphabet: "0123456789abcdefghijklmnopqrstuv", bitsPerChar: 5 }), $h = ke({ prefix: "V", name: "base32hexupper", alphabet: "0123456789ABCDEFGHIJKLMNOPQRSTUV", bitsPerChar: 5 }), Lh = ke({ prefix: "t", name: "base32hexpad", alphabet: "0123456789abcdefghijklmnopqrstuv=", bitsPerChar: 5 }), Dh = ke({ prefix: "T", name: "base32hexpadupper", alphabet: "0123456789ABCDEFGHIJKLMNOPQRSTUV=", bitsPerChar: 5 }), Uh = ke({ prefix: "h", name: "base32z", alphabet: "ybndrfg8ejkmcpqxot1uwisza345h769", bitsPerChar: 5 });
var kh = Object.freeze({ __proto__: null, base32: Ph, base32upper: qh, base32pad: Oh, base32padupper: Ch, base32hex: Th, base32hexupper: $h, base32hexpad: Lh, base32hexpadupper: Dh, base32z: Uh });
const zh = br({ prefix: "k", name: "base36", alphabet: "0123456789abcdefghijklmnopqrstuvwxyz" }), Bh = br({ prefix: "K", name: "base36upper", alphabet: "0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ" });
var Vh = Object.freeze({ __proto__: null, base36: zh, base36upper: Bh });
const Kh = br({ name: "base58btc", prefix: "z", alphabet: "123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz" }), jh = br({ name: "base58flickr", prefix: "Z", alphabet: "123456789abcdefghijkmnopqrstuvwxyzABCDEFGHJKLMNPQRSTUVWXYZ" });
var Gh = Object.freeze({ __proto__: null, base58btc: Kh, base58flickr: jh });
const Hh = ke({ prefix: "m", name: "base64", alphabet: "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/", bitsPerChar: 6 }), Jh = ke({ prefix: "M", name: "base64pad", alphabet: "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/=", bitsPerChar: 6 }), Wh = ke({ prefix: "u", name: "base64url", alphabet: "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_", bitsPerChar: 6 }), Xh = ke({ prefix: "U", name: "base64urlpad", alphabet: "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_=", bitsPerChar: 6 });
var Yh = Object.freeze({ __proto__: null, base64: Hh, base64pad: Jh, base64url: Wh, base64urlpad: Xh });
const Ws = Array.from("🚀🪐☄🛰🌌🌑🌒🌓🌔🌕🌖🌗🌘🌍🌏🌎🐉☀💻🖥💾💿😂❤😍🤣😊🙏💕😭😘👍😅👏😁🔥🥰💔💖💙😢🤔😆🙄💪😉☺👌🤗💜😔😎😇🌹🤦🎉💞✌✨🤷😱😌🌸🙌😋💗💚😏💛🙂💓🤩😄😀🖤😃💯🙈👇🎶😒🤭❣😜💋👀😪😑💥🙋😞😩😡🤪👊🥳😥🤤👉💃😳✋😚😝😴🌟😬🙃🍀🌷😻😓⭐✅🥺🌈😈🤘💦✔😣🏃💐☹🎊💘😠☝😕🌺🎂🌻😐🖕💝🙊😹🗣💫💀👑🎵🤞😛🔴😤🌼😫⚽🤙☕🏆🤫👈😮🙆🍻🍃🐶💁😲🌿🧡🎁⚡🌞🎈❌✊👋😰🤨😶🤝🚶💰🍓💢🤟🙁🚨💨🤬✈🎀🍺🤓😙💟🌱😖👶🥴▶➡❓💎💸⬇😨🌚🦋😷🕺⚠🙅😟😵👎🤲🤠🤧📌🔵💅🧐🐾🍒😗🤑🌊🤯🐷☎💧😯💆👆🎤🙇🍑❄🌴💣🐸💌📍🥀🤢👅💡💩👐📸👻🤐🤮🎼🥵🚩🍎🍊👼💍📣🥂"), Zh = Ws.reduce((i, t, e) => (i[e] = t, i), []), Qh = Ws.reduce((i, t, e) => (i[t.codePointAt(0)] = e, i), []);
function eu(i) {
  return i.reduce((t, e) => (t += Zh[e], t), "");
}
a(eu, "Zt");
function tu(i) {
  const t = [];
  for (const e of i) {
    const r = Qh[e.codePointAt(0)];
    if (r === void 0)
      throw new Error(`Non-base256emoji character: ${e}`);
    t.push(r);
  }
  return new Uint8Array(t);
}
a(tu, "Wt");
const ru = Br({ prefix: "🚀", name: "base256emoji", encode: eu, decode: tu });
var iu = Object.freeze({ __proto__: null, base256emoji: ru }), nu = Xs, kn = 128, su = 127, ou = ~su, au = Math.pow(2, 31);
function Xs(i, t, e) {
  t = t || [], e = e || 0;
  for (var r = e; i >= au; )
    t[e++] = i & 255 | kn, i /= 128;
  for (; i & ou; )
    t[e++] = i & 255 | kn, i >>>= 7;
  return t[e] = i | 0, Xs.bytes = e - r + 1, t;
}
a(Xs, "oe$1");
var fu = qi, hu = 128, zn = 127;
function qi(i, r) {
  var e = 0, r = r || 0, n = 0, s = r, c, l = i.length;
  do {
    if (s >= l)
      throw qi.bytes = 0, new RangeError("Could not decode varint");
    c = i[s++], e += n < 28 ? (c & zn) << n : (c & zn) * Math.pow(2, n), n += 7;
  } while (c >= hu);
  return qi.bytes = s - r, e;
}
a(qi, "j$1");
var uu = Math.pow(2, 7), cu = Math.pow(2, 14), lu = Math.pow(2, 21), du = Math.pow(2, 28), pu = Math.pow(2, 35), vu = Math.pow(2, 42), gu = Math.pow(2, 49), mu = Math.pow(2, 56), yu = Math.pow(2, 63), wu = /* @__PURE__ */ a(function(i) {
  return i < uu ? 1 : i < cu ? 2 : i < lu ? 3 : i < du ? 4 : i < pu ? 5 : i < vu ? 6 : i < gu ? 7 : i < mu ? 8 : i < yu ? 9 : 10;
}, "Er"), bu = { encode: nu, decode: fu, encodingLength: wu }, Ys = bu;
const Bn = /* @__PURE__ */ a((i, t, e = 0) => (Ys.encode(i, t, e), t), "De"), Vn = /* @__PURE__ */ a((i) => Ys.encodingLength(i), "ce$1"), Oi = /* @__PURE__ */ a((i, t) => {
  const e = t.byteLength, r = Vn(i), n = r + Vn(e), s = new Uint8Array(n + e);
  return Bn(i, s, 0), Bn(e, s, r), s.set(t, n), new Ci(i, e, t, s);
}, "M$2"), an = class an {
  constructor(t, e, r, n) {
    this.code = t, this.size = e, this.digest = r, this.bytes = n;
  }
};
a(an, "yr");
let Ci = an;
const Zs = /* @__PURE__ */ a(({ name: i, code: t, encode: e }) => new Ti(i, t, e), "he$1"), fn = class fn {
  constructor(t, e, r) {
    this.name = t, this.code = e, this.encode = r;
  }
  digest(t) {
    if (t instanceof Uint8Array) {
      const e = this.encode(t);
      return e instanceof Uint8Array ? Oi(this.code, e) : e.then((r) => Oi(this.code, r));
    } else
      throw Error("Unknown type, must be binary type");
  }
};
a(fn, "wr");
let Ti = fn;
const Qs = /* @__PURE__ */ a((i) => async (t) => new Uint8Array(await crypto.subtle.digest(i, t)), "le$1"), xu = Zs({ name: "sha2-256", code: 18, encode: Qs("SHA-256") }), _u = Zs({ name: "sha2-512", code: 19, encode: Qs("SHA-512") });
var Mu = Object.freeze({ __proto__: null, sha256: xu, sha512: _u });
const eo = 0, Su = "identity", to = Hs, Au = /* @__PURE__ */ a((i) => Oi(eo, to(i)), "_r"), Eu = { code: eo, name: Su, encode: to, digest: Au };
var Iu = Object.freeze({ __proto__: null, identity: Eu });
new TextEncoder(), new TextDecoder();
const Kn = { ...xh, ...Mh, ...Ah, ...Ih, ...Fh, ...kh, ...Vh, ...Gh, ...Yh, ...iu };
({ ...Mu, ...Iu });
function ro(i, t, e, r) {
  return { name: i, prefix: t, encoder: { name: i, prefix: t, encode: e }, decoder: { decode: r } };
}
a(ro, "ge");
const jn = ro("utf8", "u", (i) => "u" + new TextDecoder("utf8").decode(i), (i) => new TextEncoder().encode(i.substring(1))), gi = ro("ascii", "a", (i) => {
  let t = "a";
  for (let e = 0; e < i.length; e++)
    t += String.fromCharCode(i[e]);
  return t;
}, (i) => {
  i = i.substring(1);
  const t = lh(i.length);
  for (let e = 0; e < i.length; e++)
    t[e] = i.charCodeAt(e);
  return t;
}), io = { utf8: jn, "utf-8": jn, hex: Kn.base16, latin1: gi, ascii: gi, binary: gi, ...Kn };
function Ru(i, t = "utf8") {
  const e = io[t];
  if (!e)
    throw new Error(`Unsupported encoding "${t}"`);
  return (t === "utf8" || t === "utf-8") && globalThis.Buffer != null && globalThis.Buffer.from != null ? globalThis.Buffer.from(i, "utf8") : e.decoder.decode(`${e.prefix}${i}`);
}
a(Ru, "Fr");
function Nu(i, t = "utf8") {
  const e = io[t];
  if (!e)
    throw new Error(`Unsupported encoding "${t}"`);
  return (t === "utf8" || t === "utf-8") && globalThis.Buffer != null && globalThis.Buffer.from != null ? globalThis.Buffer.from(i.buffer, i.byteOffset, i.byteLength).toString("utf8") : e.encoder.encode(i).substring(1);
}
a(Nu, "Tr");
const Fu = "base16", Pu = "utf8";
function Gn(i) {
  const t = Mo.hash(Ru(i, Pu));
  return Nu(t, Fu);
}
a(Gn, "K$1");
var qu = Object.defineProperty, Ou = Object.defineProperties, Cu = Object.getOwnPropertyDescriptors, Hn = Object.getOwnPropertySymbols, Tu = Object.prototype.hasOwnProperty, $u = Object.prototype.propertyIsEnumerable, Jn = /* @__PURE__ */ a((i, t, e) => t in i ? qu(i, t, { enumerable: !0, configurable: !0, writable: !0, value: e }) : i[t] = e, "me"), lr = /* @__PURE__ */ a((i, t) => {
  for (var e in t || (t = {}))
    Tu.call(t, e) && Jn(i, e, t[e]);
  if (Hn)
    for (var e of Hn(t))
      $u.call(t, e) && Jn(i, e, t[e]);
  return i;
}, "I$2"), mi = /* @__PURE__ */ a((i, t) => Ou(i, Cu(t)), "V$1");
const hn = class hn extends Qf {
  constructor(t) {
    super(t), this.initialized = !1, this.name = "authEngine", this.init = () => {
      this.initialized || (this.registerRelayerEvents(), this.registerPairingEvents(), this.client.core.pairing.register({ methods: Object.keys(Mr) }), this.initialized = !0);
    }, this.request = async (e, r) => {
      if (this.isInitialized(), !uh(e))
        throw new Error("Invalid request");
      if (r != null && r.topic)
        return await this.requestOnKnownPairing(r.topic, e);
      const { chainId: n, statement: s, aud: c, domain: l, nonce: p, type: y, exp: x, nbf: _ } = e, { topic: E, uri: R } = await this.client.core.pairing.create();
      this.client.logger.info({ message: "Generated new pairing", pairing: { topic: E, uri: R } });
      const A = await this.client.core.crypto.generateKeyPair(), P = yn(A);
      await this.client.authKeys.set(gr, { responseTopic: P, publicKey: A }), await this.client.pairingTopics.set(P, { topic: P, pairingTopic: E }), await this.client.core.relayer.subscribe(P), this.client.logger.info(`sending request to new pairing topic: ${E}`);
      const L = await this.sendRequest(E, "wc_authRequest", { payloadParams: { type: y ?? "eip4361", chainId: n, statement: s, aud: c, domain: l, version: "1", nonce: p, iat: (/* @__PURE__ */ new Date()).toISOString(), exp: x, nbf: _ }, requester: { publicKey: A, metadata: this.client.metadata } }, {}, e.expiry);
      return this.client.logger.info(`sent request to new pairing topic: ${E}`), { uri: R, id: L };
    }, this.respond = async (e, r) => {
      if (this.isInitialized(), !ch(e, this.client.requests))
        throw new Error("Invalid response");
      const n = Gs(this.client.requests, e.id);
      if (!n)
        throw new Error(`Could not find pending auth request with id ${e.id}`);
      const s = n.requester.publicKey, c = await this.client.core.crypto.generateKeyPair(), l = yn(s), p = { type: gs, receiverPublicKey: s, senderPublicKey: c };
      if ("error" in e) {
        await this.sendError(n.id, l, e, p);
        return;
      }
      const y = { h: { t: "eip4361" }, p: mi(lr({}, n.cacaoPayload), { iss: r }), s: e.signature };
      await this.sendResult(n.id, l, y, p), await this.client.core.pairing.activate({ topic: n.pairingTopic }), await this.client.requests.update(n.id, lr({}, y));
    }, this.getPendingRequests = () => js(this.client.requests), this.formatMessage = (e, r) => {
      this.client.logger.debug(`formatMessage, cacao is: ${JSON.stringify(e)}`);
      const n = `${e.domain} wants you to sign in with your Ethereum account:`, s = Un(r), c = e.statement, l = `URI: ${e.aud}`, p = `Version: ${e.version}`, y = `Chain ID: ${nh(r)}`, x = `Nonce: ${e.nonce}`, _ = `Issued At: ${e.iat}`, E = e.exp ? `Expiry: ${e.exp}` : void 0, R = e.resources && e.resources.length > 0 ? `Resources:
${e.resources.map((A) => `- ${A}`).join(`
`)}` : void 0;
      return [n, s, "", c, "", l, p, y, x, _, E, R].filter((A) => A != null).join(`
`);
    }, this.setExpiry = async (e, r) => {
      this.client.core.pairing.pairings.keys.includes(e) && await this.client.core.pairing.updateExpiry({ topic: e, expiry: r }), this.client.core.expirer.set(e, r);
    }, this.sendRequest = async (e, r, n, s, c) => {
      const l = Ar(r, n), p = await this.client.core.crypto.encode(e, l, s), y = Mr[r].req;
      if (c && (y.ttl = c), this.client.core.history.set(e, l), ps()) {
        const x = Gn(JSON.stringify(l));
        this.client.core.verify.register({ attestationId: x });
      }
      return await this.client.core.relayer.publish(e, p, mi(lr({}, y), { internal: { throwOnFailedPublish: !0 } })), l.id;
    }, this.sendResult = async (e, r, n, s) => {
      const c = ls(e, n), l = await this.client.core.crypto.encode(r, c, s), p = await this.client.core.history.get(r, e), y = Mr[p.request.method].res;
      return await this.client.core.relayer.publish(r, l, mi(lr({}, y), { internal: { throwOnFailedPublish: !0 } })), await this.client.core.history.resolve(c), c.id;
    }, this.sendError = async (e, r, n, s) => {
      const c = fs(e, n.error), l = await this.client.core.crypto.encode(r, c, s), p = await this.client.core.history.get(r, e), y = Mr[p.request.method].res;
      return await this.client.core.relayer.publish(r, l, y), await this.client.core.history.resolve(c), c.id;
    }, this.requestOnKnownPairing = async (e, r) => {
      const n = this.client.core.pairing.pairings.getAll({ active: !0 }).find((R) => R.topic === e);
      if (!n)
        throw new Error(`Could not find pairing for provided topic ${e}`);
      const { publicKey: s } = this.client.authKeys.get(gr), { chainId: c, statement: l, aud: p, domain: y, nonce: x, type: _ } = r, E = await this.sendRequest(n.topic, "wc_authRequest", { payloadParams: { type: _ ?? "eip4361", chainId: c, statement: l, aud: p, domain: y, version: "1", nonce: x, iat: (/* @__PURE__ */ new Date()).toISOString() }, requester: { publicKey: s, metadata: this.client.metadata } }, {}, r.expiry);
      return this.client.logger.info(`sent request to known pairing topic: ${n.topic}`), { id: E };
    }, this.onPairingCreated = (e) => {
      const r = this.getPendingRequests();
      if (r) {
        const n = Object.values(r).find((s) => s.pairingTopic === e.topic);
        n && this.handleAuthRequest(n);
      }
    }, this.onRelayEventRequest = (e) => {
      const { topic: r, payload: n } = e, s = n.method;
      switch (s) {
        case "wc_authRequest":
          return this.onAuthRequest(r, n);
        default:
          return this.client.logger.info(`Unsupported request method ${s}`);
      }
    }, this.onRelayEventResponse = async (e) => {
      const { topic: r, payload: n } = e, s = (await this.client.core.history.get(r, n.id)).request.method;
      switch (s) {
        case "wc_authRequest":
          return this.onAuthResponse(r, n);
        default:
          return this.client.logger.info(`Unsupported response method ${s}`);
      }
    }, this.onAuthRequest = async (e, r) => {
      const { requester: n, payloadParams: s } = r.params;
      this.client.logger.info({ type: "onAuthRequest", topic: e, payload: r });
      const c = Gn(JSON.stringify(r)), l = await this.getVerifyContext(c, this.client.metadata), p = { requester: n, pairingTopic: e, id: r.id, cacaoPayload: s, verifyContext: l };
      await this.client.requests.set(r.id, p), this.handleAuthRequest(p);
    }, this.handleAuthRequest = async (e) => {
      const { id: r, pairingTopic: n, requester: s, cacaoPayload: c, verifyContext: l } = e;
      try {
        this.client.emit("auth_request", { id: r, topic: n, params: { requester: s, cacaoPayload: c }, verifyContext: l });
      } catch (p) {
        await this.sendError(e.id, e.pairingTopic, p), this.client.logger.error(p);
      }
    }, this.onAuthResponse = async (e, r) => {
      const { id: n } = r;
      if (this.client.logger.info({ type: "onAuthResponse", topic: e, response: r }), xt(r)) {
        const { pairingTopic: s } = this.client.pairingTopics.get(e);
        await this.client.core.pairing.activate({ topic: s });
        const { s: c, p: l } = r.result;
        await this.client.requests.set(n, lr({ id: n, pairingTopic: s }, r.result));
        const p = this.formatMessage(l, l.iss);
        this.client.logger.debug(`reconstructed message:
`, JSON.stringify(p)), this.client.logger.debug("payload.iss:", l.iss), this.client.logger.debug("signature:", c);
        const y = Un(l.iss), x = sh(l.iss);
        if (!y)
          throw new Error("Could not derive address from `payload.iss`");
        if (!x)
          throw new Error("Could not derive chainId from `payload.iss`");
        this.client.logger.debug("walletAddress extracted from `payload.iss`:", y), await oh(y, p, c, x, this.client.projectId) ? this.client.emit("auth_response", { id: n, topic: e, params: r }) : this.client.emit("auth_response", { id: n, topic: e, params: { message: "Invalid signature", code: -1 } });
      } else
        _t(r) && this.client.emit("auth_response", { id: n, topic: e, params: r });
    }, this.getVerifyContext = async (e, r) => {
      const n = { verified: { verifyUrl: r.verifyUrl || "", validation: "UNKNOWN", origin: r.url || "" } };
      try {
        const s = await this.client.core.verify.resolve({ attestationId: e, verifyUrl: r.verifyUrl });
        s && (n.verified.origin = s.origin, n.verified.isScam = s.isScam, n.verified.validation = origin === new URL(r.url).origin ? "VALID" : "INVALID");
      } catch (s) {
        this.client.logger.error(s);
      }
      return this.client.logger.info(`Verify context: ${JSON.stringify(n)}`), n;
    };
  }
  isInitialized() {
    if (!this.initialized) {
      const { message: t } = B("NOT_INITIALIZED", this.name);
      throw new Error(t);
    }
  }
  registerRelayerEvents() {
    this.client.core.relayer.on(bi.message, async (t) => {
      const { topic: e, message: r } = t, { responseTopic: n, publicKey: s } = this.client.authKeys.keys.includes(gr) ? this.client.authKeys.get(gr) : { responseTopic: void 0, publicKey: void 0 };
      if (n && e !== n) {
        this.client.logger.debug("[Auth] Ignoring message from unknown topic", e);
        return;
      }
      const c = await this.client.core.crypto.decode(e, r, { receiverPublicKey: s });
      hs(c) ? (this.client.core.history.set(e, c), this.onRelayEventRequest({ topic: e, payload: c })) : us(c) && (await this.client.core.history.resolve(c), this.onRelayEventResponse({ topic: e, payload: c }));
    });
  }
  registerPairingEvents() {
    this.client.core.pairing.events.on(cs.create, (t) => this.onPairingCreated(t));
  }
};
a(hn, "Br");
let $i = hn;
var tr;
let Lu = (tr = class extends eh {
  constructor(t) {
    super(t), this.protocol = Ks, this.version = rh, this.name = Dn, this.events = new os.EventEmitter(), this.emit = (r, n) => this.events.emit(r, n), this.on = (r, n) => this.events.on(r, n), this.once = (r, n) => this.events.once(r, n), this.off = (r, n) => this.events.off(r, n), this.removeListener = (r, n) => this.events.removeListener(r, n), this.request = async (r, n) => {
      try {
        return await this.engine.request(r, n);
      } catch (s) {
        throw this.logger.error(s.message), s;
      }
    }, this.respond = async (r, n) => {
      try {
        return await this.engine.respond(r, n);
      } catch (s) {
        throw this.logger.error(s.message), s;
      }
    }, this.getPendingRequests = () => {
      try {
        return this.engine.getPendingRequests();
      } catch (r) {
        throw this.logger.error(r.message), r;
      }
    }, this.formatMessage = (r, n) => {
      try {
        return this.engine.formatMessage(r, n);
      } catch (s) {
        throw this.logger.error(s.message), s;
      }
    };
    const e = typeof t.logger < "u" && typeof t.logger != "string" ? t.logger : Mt.pino(Mt.getDefaultLoggerOptions({ level: t.logger || "error" }));
    this.name = (t == null ? void 0 : t.name) || Dn, this.metadata = t.metadata, this.projectId = t.projectId, this.core = t.core || new as(t), this.logger = Mt.generateChildLogger(e, this.name), this.authKeys = new Jt(this.core, this.logger, "authKeys", Nr, () => gr), this.pairingTopics = new Jt(this.core, this.logger, "pairingTopics", Nr), this.requests = new Jt(this.core, this.logger, "requests", Nr, (r) => r.id), this.engine = new $i(this);
  }
  static async init(t) {
    const e = new tr(t);
    return await e.initialize(), e;
  }
  get context() {
    return Mt.getLoggerContext(this.logger);
  }
  async initialize() {
    this.logger.trace("Initialized");
    try {
      await this.core.start(), await this.authKeys.init(), await this.requests.init(), await this.pairingTopics.init(), await this.engine.init(), this.logger.info("AuthClient Initialization Success"), this.logger.info({ authClient: this });
    } catch (t) {
      throw this.logger.info("AuthClient Initialization Failure"), this.logger.error(t.message), t;
    }
  }
}, a(tr, "S"), tr);
const Du = Lu, no = "wc", so = 2, oo = "client", en = `${no}@${so}:${oo}:`, yi = { name: oo, logger: "error", controller: !1, relayUrl: "wss://relay.walletconnect.com" }, Wn = "WALLETCONNECT_DEEPLINK_CHOICE", Uu = "proposal", ku = "Proposal expired", zu = "session", Sr = X.SEVEN_DAYS, Bu = "engine", dr = { wc_sessionPropose: { req: { ttl: X.FIVE_MINUTES, prompt: !0, tag: 1100 }, res: { ttl: X.FIVE_MINUTES, prompt: !1, tag: 1101 } }, wc_sessionSettle: { req: { ttl: X.FIVE_MINUTES, prompt: !1, tag: 1102 }, res: { ttl: X.FIVE_MINUTES, prompt: !1, tag: 1103 } }, wc_sessionUpdate: { req: { ttl: X.ONE_DAY, prompt: !1, tag: 1104 }, res: { ttl: X.ONE_DAY, prompt: !1, tag: 1105 } }, wc_sessionExtend: { req: { ttl: X.ONE_DAY, prompt: !1, tag: 1106 }, res: { ttl: X.ONE_DAY, prompt: !1, tag: 1107 } }, wc_sessionRequest: { req: { ttl: X.FIVE_MINUTES, prompt: !0, tag: 1108 }, res: { ttl: X.FIVE_MINUTES, prompt: !1, tag: 1109 } }, wc_sessionEvent: { req: { ttl: X.FIVE_MINUTES, prompt: !0, tag: 1110 }, res: { ttl: X.FIVE_MINUTES, prompt: !1, tag: 1111 } }, wc_sessionDelete: { req: { ttl: X.ONE_DAY, prompt: !1, tag: 1112 }, res: { ttl: X.ONE_DAY, prompt: !1, tag: 1113 } }, wc_sessionPing: { req: { ttl: X.THIRTY_SECONDS, prompt: !1, tag: 1114 }, res: { ttl: X.THIRTY_SECONDS, prompt: !1, tag: 1115 } } }, wi = { min: X.FIVE_MINUTES, max: X.SEVEN_DAYS }, ut = { idle: "IDLE", active: "ACTIVE" }, Vu = "request", Ku = ["wc_sessionPropose", "wc_sessionRequest", "wc_authRequest"];
var ju = Object.defineProperty, Gu = Object.defineProperties, Hu = Object.getOwnPropertyDescriptors, Xn = Object.getOwnPropertySymbols, Ju = Object.prototype.hasOwnProperty, Wu = Object.prototype.propertyIsEnumerable, Yn = /* @__PURE__ */ a((i, t, e) => t in i ? ju(i, t, { enumerable: !0, configurable: !0, writable: !0, value: e }) : i[t] = e, "de"), Be = /* @__PURE__ */ a((i, t) => {
  for (var e in t || (t = {}))
    Ju.call(t, e) && Yn(i, e, t[e]);
  if (Xn)
    for (var e of Xn(t))
      Wu.call(t, e) && Yn(i, e, t[e]);
  return i;
}, "g$1"), pr = /* @__PURE__ */ a((i, t) => Gu(i, Hu(t)), "b$1");
const un = class un extends po {
  constructor(t) {
    super(t), this.name = Bu, this.events = new vo(), this.initialized = !1, this.ignoredPayloadTypes = [gs], this.requestQueue = { state: ut.idle, queue: [] }, this.sessionRequestQueue = { state: ut.idle, queue: [] }, this.requestQueueDelay = X.ONE_SECOND, this.init = async () => {
      this.initialized || (await this.cleanup(), this.registerRelayerEvents(), this.registerExpirerEvents(), this.registerPairingEvents(), this.client.core.pairing.register({ methods: Object.keys(dr) }), this.initialized = !0, setTimeout(() => {
        this.sessionRequestQueue.queue = this.getPendingSessionRequests(), this.processSessionRequestQueue();
      }, X.toMiliseconds(this.requestQueueDelay)));
    }, this.connect = async (e) => {
      await this.isInitialized();
      const r = pr(Be({}, e), { requiredNamespaces: e.requiredNamespaces || {}, optionalNamespaces: e.optionalNamespaces || {} });
      await this.isValidConnect(r);
      const { pairingTopic: n, requiredNamespaces: s, optionalNamespaces: c, sessionProperties: l, relays: p } = r;
      let y = n, x, _ = !1;
      if (y && (_ = this.client.core.pairing.pairings.get(y).active), !y || !_) {
        const { topic: J, uri: V } = await this.client.core.pairing.create();
        y = J, x = V;
      }
      const E = await this.client.core.crypto.generateKeyPair(), R = Be({ requiredNamespaces: s, optionalNamespaces: c, relays: p ?? [{ protocol: go }], proposer: { publicKey: E, metadata: this.client.metadata } }, l && { sessionProperties: l }), { reject: A, resolve: P, done: L } = or(X.FIVE_MINUTES, ku);
      if (this.events.once(De("session_connect"), async ({ error: J, session: V }) => {
        if (J)
          A(J);
        else if (V) {
          V.self.publicKey = E;
          const K = pr(Be({}, V), { requiredNamespaces: V.requiredNamespaces, optionalNamespaces: V.optionalNamespaces });
          await this.client.session.set(V.topic, K), await this.setExpiry(V.topic, V.expiry), y && await this.client.core.pairing.updateMetadata({ topic: y, metadata: V.peer.metadata }), P(K);
        }
      }), !y) {
        const { message: J } = B("NO_MATCHING_KEY", `connect() pairing topic: ${y}`);
        throw new Error(J);
      }
      const $ = await this.sendRequest({ topic: y, method: "wc_sessionPropose", params: R }), j = Vt(X.FIVE_MINUTES);
      return await this.setProposal($, Be({ id: $, expiry: j }, R)), { uri: x, approval: L };
    }, this.pair = async (e) => (await this.isInitialized(), await this.client.core.pairing.pair(e)), this.approve = async (e) => {
      await this.isInitialized(), await this.isValidApprove(e);
      const { id: r, relayProtocol: n, namespaces: s, sessionProperties: c } = e, l = this.client.proposal.get(r);
      let { pairingTopic: p, proposer: y, requiredNamespaces: x, optionalNamespaces: _ } = l;
      p = p || "", ii(x) || (x = Ao(s, "approve()"));
      const E = await this.client.core.crypto.generateKeyPair(), R = y.publicKey, A = await this.client.core.crypto.generateSharedKey(E, R);
      p && r && (await this.client.core.pairing.updateMetadata({ topic: p, metadata: y.metadata }), await this.sendResult({ id: r, topic: p, result: { relay: { protocol: n ?? "irn" }, responderPublicKey: E } }), await this.client.proposal.delete(r, Kt("USER_DISCONNECTED")), await this.client.core.pairing.activate({ topic: p }));
      const P = Be({ relay: { protocol: n ?? "irn" }, namespaces: s, requiredNamespaces: x, optionalNamespaces: _, pairingTopic: p, controller: { publicKey: E, metadata: this.client.metadata }, expiry: Vt(Sr) }, c && { sessionProperties: c });
      await this.client.core.relayer.subscribe(A), await this.sendRequest({ topic: A, method: "wc_sessionSettle", params: P, throwOnFailedPublish: !0 });
      const L = pr(Be({}, P), { topic: A, pairingTopic: p, acknowledged: !1, self: P.controller, peer: { publicKey: y.publicKey, metadata: y.metadata }, controller: E });
      return await this.client.session.set(A, L), await this.setExpiry(A, Vt(Sr)), { topic: A, acknowledged: () => new Promise(($) => setTimeout(() => $(this.client.session.get(A)), 500)) };
    }, this.reject = async (e) => {
      await this.isInitialized(), await this.isValidReject(e);
      const { id: r, reason: n } = e, { pairingTopic: s } = this.client.proposal.get(r);
      s && (await this.sendError(r, s, n), await this.client.proposal.delete(r, Kt("USER_DISCONNECTED")));
    }, this.update = async (e) => {
      await this.isInitialized(), await this.isValidUpdate(e);
      const { topic: r, namespaces: n } = e, s = await this.sendRequest({ topic: r, method: "wc_sessionUpdate", params: { namespaces: n } }), { done: c, resolve: l, reject: p } = or();
      return this.events.once(De("session_update", s), ({ error: y }) => {
        y ? p(y) : l();
      }), await this.client.session.update(r, { namespaces: n }), { acknowledged: c };
    }, this.extend = async (e) => {
      await this.isInitialized(), await this.isValidExtend(e);
      const { topic: r } = e, n = await this.sendRequest({ topic: r, method: "wc_sessionExtend", params: {} }), { done: s, resolve: c, reject: l } = or();
      return this.events.once(De("session_extend", n), ({ error: p }) => {
        p ? l(p) : c();
      }), await this.setExpiry(r, Vt(Sr)), { acknowledged: s };
    }, this.request = async (e) => {
      await this.isInitialized(), await this.isValidRequest(e);
      const { chainId: r, request: n, topic: s, expiry: c } = e, l = wo(), { done: p, resolve: y, reject: x } = or(c, "Request expired. Please try again.");
      return this.events.once(De("session_request", l), ({ error: _, result: E }) => {
        _ ? x(_) : y(E);
      }), await Promise.all([new Promise(async (_) => {
        await this.sendRequest({ clientRpcId: l, topic: s, method: "wc_sessionRequest", params: { request: n, chainId: r }, expiry: c, throwOnFailedPublish: !0 }).catch((E) => x(E)), this.client.events.emit("session_request_sent", { topic: s, request: n, chainId: r, id: l }), _();
      }), new Promise(async (_) => {
        const E = await Eo(this.client.core.storage, Wn);
        Io({ id: l, topic: s, wcDeepLink: E }), _();
      }), p()]).then((_) => _[2]);
    }, this.respond = async (e) => {
      await this.isInitialized(), await this.isValidRespond(e);
      const { topic: r, response: n } = e, { id: s } = n;
      xt(n) ? await this.sendResult({ id: s, topic: r, result: n.result, throwOnFailedPublish: !0 }) : _t(n) && await this.sendError(s, r, n.error), this.cleanupAfterResponse(e);
    }, this.ping = async (e) => {
      await this.isInitialized(), await this.isValidPing(e);
      const { topic: r } = e;
      if (this.client.session.keys.includes(r)) {
        const n = await this.sendRequest({ topic: r, method: "wc_sessionPing", params: {} }), { done: s, resolve: c, reject: l } = or();
        this.events.once(De("session_ping", n), ({ error: p }) => {
          p ? l(p) : c();
        }), await s();
      } else
        this.client.core.pairing.pairings.keys.includes(r) && await this.client.core.pairing.ping({ topic: r });
    }, this.emit = async (e) => {
      await this.isInitialized(), await this.isValidEmit(e);
      const { topic: r, event: n, chainId: s } = e;
      await this.sendRequest({ topic: r, method: "wc_sessionEvent", params: { event: n, chainId: s } });
    }, this.disconnect = async (e) => {
      await this.isInitialized(), await this.isValidDisconnect(e);
      const { topic: r } = e;
      this.client.session.keys.includes(r) ? (await this.sendRequest({ topic: r, method: "wc_sessionDelete", params: Kt("USER_DISCONNECTED"), throwOnFailedPublish: !0 }), await this.deleteSession(r)) : await this.client.core.pairing.disconnect({ topic: r });
    }, this.find = (e) => (this.isInitialized(), this.client.session.getAll().filter((r) => Ro(r, e))), this.getPendingSessionRequests = () => (this.isInitialized(), this.client.pendingRequest.getAll()), this.cleanupDuplicatePairings = async (e) => {
      if (e.pairingTopic)
        try {
          const r = this.client.core.pairing.pairings.get(e.pairingTopic), n = this.client.core.pairing.pairings.getAll().filter((s) => {
            var c, l;
            return ((c = s.peerMetadata) == null ? void 0 : c.url) && ((l = s.peerMetadata) == null ? void 0 : l.url) === e.peer.metadata.url && s.topic && s.topic !== r.topic;
          });
          if (n.length === 0)
            return;
          this.client.logger.info(`Cleaning up ${n.length} duplicate pairing(s)`), await Promise.all(n.map((s) => this.client.core.pairing.disconnect({ topic: s.topic }))), this.client.logger.info("Duplicate pairings clean up finished");
        } catch (r) {
          this.client.logger.error(r);
        }
    }, this.deleteSession = async (e, r) => {
      const { self: n } = this.client.session.get(e);
      await this.client.core.relayer.unsubscribe(e), this.client.session.delete(e, Kt("USER_DISCONNECTED")), this.client.core.crypto.keychain.has(n.publicKey) && await this.client.core.crypto.deleteKeyPair(n.publicKey), this.client.core.crypto.keychain.has(e) && await this.client.core.crypto.deleteSymKey(e), r || this.client.core.expirer.del(e), this.client.core.storage.removeItem(Wn).catch((s) => this.client.logger.warn(s));
    }, this.deleteProposal = async (e, r) => {
      await Promise.all([this.client.proposal.delete(e, Kt("USER_DISCONNECTED")), r ? Promise.resolve() : this.client.core.expirer.del(e)]);
    }, this.deletePendingSessionRequest = async (e, r, n = !1) => {
      await Promise.all([this.client.pendingRequest.delete(e, r), n ? Promise.resolve() : this.client.core.expirer.del(e)]), this.sessionRequestQueue.queue = this.sessionRequestQueue.queue.filter((s) => s.id !== e), n && (this.sessionRequestQueue.state = ut.idle);
    }, this.setExpiry = async (e, r) => {
      this.client.session.keys.includes(e) && await this.client.session.update(e, { expiry: r }), this.client.core.expirer.set(e, r);
    }, this.setProposal = async (e, r) => {
      await this.client.proposal.set(e, r), this.client.core.expirer.set(e, r.expiry);
    }, this.setPendingSessionRequest = async (e) => {
      const r = dr.wc_sessionRequest.req.ttl, { id: n, topic: s, params: c, verifyContext: l } = e;
      await this.client.pendingRequest.set(n, { id: n, topic: s, params: c, verifyContext: l }), r && this.client.core.expirer.set(n, Vt(r));
    }, this.sendRequest = async (e) => {
      const { topic: r, method: n, params: s, expiry: c, relayRpcId: l, clientRpcId: p, throwOnFailedPublish: y } = e, x = Ar(n, s, p);
      if (ps() && Ku.includes(n)) {
        const R = ni(JSON.stringify(x));
        this.client.core.verify.register({ attestationId: R });
      }
      const _ = await this.client.core.crypto.encode(r, x), E = dr[n].req;
      return c && (E.ttl = c), l && (E.id = l), this.client.core.history.set(r, x), y ? (E.internal = pr(Be({}, E.internal), { throwOnFailedPublish: !0 }), await this.client.core.relayer.publish(r, _, E)) : this.client.core.relayer.publish(r, _, E).catch((R) => this.client.logger.error(R)), x.id;
    }, this.sendResult = async (e) => {
      const { id: r, topic: n, result: s, throwOnFailedPublish: c } = e, l = ls(r, s), p = await this.client.core.crypto.encode(n, l), y = await this.client.core.history.get(n, r), x = dr[y.request.method].res;
      c ? (x.internal = pr(Be({}, x.internal), { throwOnFailedPublish: !0 }), await this.client.core.relayer.publish(n, p, x)) : this.client.core.relayer.publish(n, p, x).catch((_) => this.client.logger.error(_)), await this.client.core.history.resolve(l);
    }, this.sendError = async (e, r, n) => {
      const s = fs(e, n), c = await this.client.core.crypto.encode(r, s), l = await this.client.core.history.get(r, e), p = dr[l.request.method].res;
      this.client.core.relayer.publish(r, c, p), await this.client.core.history.resolve(s);
    }, this.cleanup = async () => {
      const e = [], r = [];
      this.client.session.getAll().forEach((n) => {
        Ht(n.expiry) && e.push(n.topic);
      }), this.client.proposal.getAll().forEach((n) => {
        Ht(n.expiry) && r.push(n.id);
      }), await Promise.all([...e.map((n) => this.deleteSession(n)), ...r.map((n) => this.deleteProposal(n))]);
    }, this.onRelayEventRequest = async (e) => {
      this.requestQueue.queue.push(e), await this.processRequestsQueue();
    }, this.processRequestsQueue = async () => {
      if (this.requestQueue.state === ut.active) {
        this.client.logger.info("Request queue already active, skipping...");
        return;
      }
      for (this.client.logger.info(`Request queue starting with ${this.requestQueue.queue.length} requests`); this.requestQueue.queue.length > 0; ) {
        this.requestQueue.state = ut.active;
        const e = this.requestQueue.queue.shift();
        if (e)
          try {
            this.processRequest(e), await new Promise((r) => setTimeout(r, 300));
          } catch (r) {
            this.client.logger.warn(r);
          }
      }
      this.requestQueue.state = ut.idle;
    }, this.processRequest = (e) => {
      const { topic: r, payload: n } = e, s = n.method;
      switch (s) {
        case "wc_sessionPropose":
          return this.onSessionProposeRequest(r, n);
        case "wc_sessionSettle":
          return this.onSessionSettleRequest(r, n);
        case "wc_sessionUpdate":
          return this.onSessionUpdateRequest(r, n);
        case "wc_sessionExtend":
          return this.onSessionExtendRequest(r, n);
        case "wc_sessionPing":
          return this.onSessionPingRequest(r, n);
        case "wc_sessionDelete":
          return this.onSessionDeleteRequest(r, n);
        case "wc_sessionRequest":
          return this.onSessionRequest(r, n);
        case "wc_sessionEvent":
          return this.onSessionEventRequest(r, n);
        default:
          return this.client.logger.info(`Unsupported request method ${s}`);
      }
    }, this.onRelayEventResponse = async (e) => {
      const { topic: r, payload: n } = e, s = (await this.client.core.history.get(r, n.id)).request.method;
      switch (s) {
        case "wc_sessionPropose":
          return this.onSessionProposeResponse(r, n);
        case "wc_sessionSettle":
          return this.onSessionSettleResponse(r, n);
        case "wc_sessionUpdate":
          return this.onSessionUpdateResponse(r, n);
        case "wc_sessionExtend":
          return this.onSessionExtendResponse(r, n);
        case "wc_sessionPing":
          return this.onSessionPingResponse(r, n);
        case "wc_sessionRequest":
          return this.onSessionRequestResponse(r, n);
        default:
          return this.client.logger.info(`Unsupported response method ${s}`);
      }
    }, this.onRelayEventUnknownPayload = (e) => {
      const { topic: r } = e, { message: n } = B("MISSING_OR_INVALID", `Decoded payload on topic ${r} is not identifiable as a JSON-RPC request or a response.`);
      throw new Error(n);
    }, this.onSessionProposeRequest = async (e, r) => {
      const { params: n, id: s } = r;
      try {
        this.isValidConnect(Be({}, r.params));
        const c = Vt(X.FIVE_MINUTES), l = Be({ id: s, pairingTopic: e, expiry: c }, n);
        await this.setProposal(s, l);
        const p = ni(JSON.stringify(r)), y = await this.getVerifyContext(p, l.proposer.metadata);
        this.client.events.emit("session_proposal", { id: s, params: l, verifyContext: y });
      } catch (c) {
        await this.sendError(s, e, c), this.client.logger.error(c);
      }
    }, this.onSessionProposeResponse = async (e, r) => {
      const { id: n } = r;
      if (xt(r)) {
        const { result: s } = r;
        this.client.logger.trace({ type: "method", method: "onSessionProposeResponse", result: s });
        const c = this.client.proposal.get(n);
        this.client.logger.trace({ type: "method", method: "onSessionProposeResponse", proposal: c });
        const l = c.proposer.publicKey;
        this.client.logger.trace({ type: "method", method: "onSessionProposeResponse", selfPublicKey: l });
        const p = s.responderPublicKey;
        this.client.logger.trace({ type: "method", method: "onSessionProposeResponse", peerPublicKey: p });
        const y = await this.client.core.crypto.generateSharedKey(l, p);
        this.client.logger.trace({ type: "method", method: "onSessionProposeResponse", sessionTopic: y });
        const x = await this.client.core.relayer.subscribe(y);
        this.client.logger.trace({ type: "method", method: "onSessionProposeResponse", subscriptionId: x }), await this.client.core.pairing.activate({ topic: e });
      } else
        _t(r) && (await this.client.proposal.delete(n, Kt("USER_DISCONNECTED")), this.events.emit(De("session_connect"), { error: r.error }));
    }, this.onSessionSettleRequest = async (e, r) => {
      const { id: n, params: s } = r;
      try {
        this.isValidSessionSettleRequest(s);
        const { relay: c, controller: l, expiry: p, namespaces: y, requiredNamespaces: x, optionalNamespaces: _, sessionProperties: E, pairingTopic: R } = r.params, A = Be({ topic: e, relay: c, expiry: p, namespaces: y, acknowledged: !0, pairingTopic: R, requiredNamespaces: x, optionalNamespaces: _, controller: l.publicKey, self: { publicKey: "", metadata: this.client.metadata }, peer: { publicKey: l.publicKey, metadata: l.metadata } }, E && { sessionProperties: E });
        await this.sendResult({ id: r.id, topic: e, result: !0 }), this.events.emit(De("session_connect"), { session: A }), this.cleanupDuplicatePairings(A);
      } catch (c) {
        await this.sendError(n, e, c), this.client.logger.error(c);
      }
    }, this.onSessionSettleResponse = async (e, r) => {
      const { id: n } = r;
      xt(r) ? (await this.client.session.update(e, { acknowledged: !0 }), this.events.emit(De("session_approve", n), {})) : _t(r) && (await this.client.session.delete(e, Kt("USER_DISCONNECTED")), this.events.emit(De("session_approve", n), { error: r.error }));
    }, this.onSessionUpdateRequest = async (e, r) => {
      const { params: n, id: s } = r;
      try {
        const c = `${e}_session_update`, l = xr.get(c);
        if (l && this.isRequestOutOfSync(l, s)) {
          this.client.logger.info(`Discarding out of sync request - ${s}`);
          return;
        }
        this.isValidUpdate(Be({ topic: e }, n)), await this.client.session.update(e, { namespaces: n.namespaces }), await this.sendResult({ id: s, topic: e, result: !0 }), this.client.events.emit("session_update", { id: s, topic: e, params: n }), xr.set(c, s);
      } catch (c) {
        await this.sendError(s, e, c), this.client.logger.error(c);
      }
    }, this.isRequestOutOfSync = (e, r) => parseInt(r.toString().slice(0, -3)) <= parseInt(e.toString().slice(0, -3)), this.onSessionUpdateResponse = (e, r) => {
      const { id: n } = r;
      xt(r) ? this.events.emit(De("session_update", n), {}) : _t(r) && this.events.emit(De("session_update", n), { error: r.error });
    }, this.onSessionExtendRequest = async (e, r) => {
      const { id: n } = r;
      try {
        this.isValidExtend({ topic: e }), await this.setExpiry(e, Vt(Sr)), await this.sendResult({ id: n, topic: e, result: !0 }), this.client.events.emit("session_extend", { id: n, topic: e });
      } catch (s) {
        await this.sendError(n, e, s), this.client.logger.error(s);
      }
    }, this.onSessionExtendResponse = (e, r) => {
      const { id: n } = r;
      xt(r) ? this.events.emit(De("session_extend", n), {}) : _t(r) && this.events.emit(De("session_extend", n), { error: r.error });
    }, this.onSessionPingRequest = async (e, r) => {
      const { id: n } = r;
      try {
        this.isValidPing({ topic: e }), await this.sendResult({ id: n, topic: e, result: !0 }), this.client.events.emit("session_ping", { id: n, topic: e });
      } catch (s) {
        await this.sendError(n, e, s), this.client.logger.error(s);
      }
    }, this.onSessionPingResponse = (e, r) => {
      const { id: n } = r;
      setTimeout(() => {
        xt(r) ? this.events.emit(De("session_ping", n), {}) : _t(r) && this.events.emit(De("session_ping", n), { error: r.error });
      }, 500);
    }, this.onSessionDeleteRequest = async (e, r) => {
      const { id: n } = r;
      try {
        this.isValidDisconnect({ topic: e, reason: r.params }), await Promise.all([new Promise((s) => {
          this.client.core.relayer.once(bi.publish, async () => {
            s(await this.deleteSession(e));
          });
        }), this.sendResult({ id: n, topic: e, result: !0 })]), this.client.events.emit("session_delete", { id: n, topic: e });
      } catch (s) {
        this.client.logger.error(s);
      }
    }, this.onSessionRequest = async (e, r) => {
      const { id: n, params: s } = r;
      try {
        this.isValidRequest(Be({ topic: e }, s));
        const c = ni(JSON.stringify(Ar("wc_sessionRequest", s, n))), l = this.client.session.get(e), p = await this.getVerifyContext(c, l.peer.metadata), y = { id: n, topic: e, params: s, verifyContext: p };
        await this.setPendingSessionRequest(y), this.addSessionRequestToSessionRequestQueue(y), this.processSessionRequestQueue();
      } catch (c) {
        await this.sendError(n, e, c), this.client.logger.error(c);
      }
    }, this.onSessionRequestResponse = (e, r) => {
      const { id: n } = r;
      xt(r) ? this.events.emit(De("session_request", n), { result: r.result }) : _t(r) && this.events.emit(De("session_request", n), { error: r.error });
    }, this.onSessionEventRequest = async (e, r) => {
      const { id: n, params: s } = r;
      try {
        const c = `${e}_session_event_${s.event.name}`, l = xr.get(c);
        if (l && this.isRequestOutOfSync(l, n)) {
          this.client.logger.info(`Discarding out of sync request - ${n}`);
          return;
        }
        this.isValidEmit(Be({ topic: e }, s)), this.client.events.emit("session_event", { id: n, topic: e, params: s }), xr.set(c, n);
      } catch (c) {
        await this.sendError(n, e, c), this.client.logger.error(c);
      }
    }, this.addSessionRequestToSessionRequestQueue = (e) => {
      this.sessionRequestQueue.queue.push(e);
    }, this.cleanupAfterResponse = (e) => {
      this.deletePendingSessionRequest(e.response.id, { message: "fulfilled", code: 0 }), setTimeout(() => {
        this.sessionRequestQueue.state = ut.idle, this.processSessionRequestQueue();
      }, X.toMiliseconds(this.requestQueueDelay));
    }, this.processSessionRequestQueue = () => {
      if (this.sessionRequestQueue.state === ut.active) {
        this.client.logger.info("session request queue is already active.");
        return;
      }
      const e = this.sessionRequestQueue.queue[0];
      if (!e) {
        this.client.logger.info("session request queue is empty.");
        return;
      }
      try {
        this.sessionRequestQueue.state = ut.active, this.client.events.emit("session_request", e);
      } catch (r) {
        this.client.logger.error(r);
      }
    }, this.onPairingCreated = (e) => {
      if (e.active)
        return;
      const r = this.client.proposal.getAll().find((n) => n.pairingTopic === e.topic);
      r && this.onSessionProposeRequest(e.topic, Ar("wc_sessionPropose", { requiredNamespaces: r.requiredNamespaces, optionalNamespaces: r.optionalNamespaces, relays: r.relays, proposer: r.proposer, sessionProperties: r.sessionProperties }, r.id));
    }, this.isValidConnect = async (e) => {
      if (!Xe(e)) {
        const { message: p } = B("MISSING_OR_INVALID", `connect() params: ${JSON.stringify(e)}`);
        throw new Error(p);
      }
      const { pairingTopic: r, requiredNamespaces: n, optionalNamespaces: s, sessionProperties: c, relays: l } = e;
      if (ar(r) || await this.isValidPairingTopic(r), !No(l, !0)) {
        const { message: p } = B("MISSING_OR_INVALID", `connect() relays: ${l}`);
        throw new Error(p);
      }
      !ar(n) && ii(n) !== 0 && this.validateNamespaces(n, "requiredNamespaces"), !ar(s) && ii(s) !== 0 && this.validateNamespaces(s, "optionalNamespaces"), ar(c) || this.validateSessionProps(c, "sessionProperties");
    }, this.validateNamespaces = (e, r) => {
      const n = Fo(e, "connect()", r);
      if (n)
        throw new Error(n.message);
    }, this.isValidApprove = async (e) => {
      if (!Xe(e))
        throw new Error(B("MISSING_OR_INVALID", `approve() params: ${e}`).message);
      const { id: r, namespaces: n, relayProtocol: s, sessionProperties: c } = e;
      await this.isValidProposalId(r);
      const l = this.client.proposal.get(r), p = si(n, "approve()");
      if (p)
        throw new Error(p.message);
      const y = wn(l.requiredNamespaces, n, "approve()");
      if (y)
        throw new Error(y.message);
      if (!fr(s, !0)) {
        const { message: x } = B("MISSING_OR_INVALID", `approve() relayProtocol: ${s}`);
        throw new Error(x);
      }
      ar(c) || this.validateSessionProps(c, "sessionProperties");
    }, this.isValidReject = async (e) => {
      if (!Xe(e)) {
        const { message: s } = B("MISSING_OR_INVALID", `reject() params: ${e}`);
        throw new Error(s);
      }
      const { id: r, reason: n } = e;
      if (await this.isValidProposalId(r), !Po(n)) {
        const { message: s } = B("MISSING_OR_INVALID", `reject() reason: ${JSON.stringify(n)}`);
        throw new Error(s);
      }
    }, this.isValidSessionSettleRequest = (e) => {
      if (!Xe(e)) {
        const { message: y } = B("MISSING_OR_INVALID", `onSessionSettleRequest() params: ${e}`);
        throw new Error(y);
      }
      const { relay: r, controller: n, namespaces: s, expiry: c } = e;
      if (!qo(r)) {
        const { message: y } = B("MISSING_OR_INVALID", "onSessionSettleRequest() relay protocol should be a string");
        throw new Error(y);
      }
      const l = Oo(n, "onSessionSettleRequest()");
      if (l)
        throw new Error(l.message);
      const p = si(s, "onSessionSettleRequest()");
      if (p)
        throw new Error(p.message);
      if (Ht(c)) {
        const { message: y } = B("EXPIRED", "onSessionSettleRequest()");
        throw new Error(y);
      }
    }, this.isValidUpdate = async (e) => {
      if (!Xe(e)) {
        const { message: p } = B("MISSING_OR_INVALID", `update() params: ${e}`);
        throw new Error(p);
      }
      const { topic: r, namespaces: n } = e;
      await this.isValidSessionTopic(r);
      const s = this.client.session.get(r), c = si(n, "update()");
      if (c)
        throw new Error(c.message);
      const l = wn(s.requiredNamespaces, n, "update()");
      if (l)
        throw new Error(l.message);
    }, this.isValidExtend = async (e) => {
      if (!Xe(e)) {
        const { message: n } = B("MISSING_OR_INVALID", `extend() params: ${e}`);
        throw new Error(n);
      }
      const { topic: r } = e;
      await this.isValidSessionTopic(r);
    }, this.isValidRequest = async (e) => {
      if (!Xe(e)) {
        const { message: p } = B("MISSING_OR_INVALID", `request() params: ${e}`);
        throw new Error(p);
      }
      const { topic: r, request: n, chainId: s, expiry: c } = e;
      await this.isValidSessionTopic(r);
      const { namespaces: l } = this.client.session.get(r);
      if (!bn(l, s)) {
        const { message: p } = B("MISSING_OR_INVALID", `request() chainId: ${s}`);
        throw new Error(p);
      }
      if (!Co(n)) {
        const { message: p } = B("MISSING_OR_INVALID", `request() ${JSON.stringify(n)}`);
        throw new Error(p);
      }
      if (!To(l, s, n.method)) {
        const { message: p } = B("MISSING_OR_INVALID", `request() method: ${n.method}`);
        throw new Error(p);
      }
      if (c && !vs(c, wi)) {
        const { message: p } = B("MISSING_OR_INVALID", `request() expiry: ${c}. Expiry must be a number (in seconds) between ${wi.min} and ${wi.max}`);
        throw new Error(p);
      }
    }, this.isValidRespond = async (e) => {
      if (!Xe(e)) {
        const { message: s } = B("MISSING_OR_INVALID", `respond() params: ${e}`);
        throw new Error(s);
      }
      const { topic: r, response: n } = e;
      if (await this.isValidSessionTopic(r), !$o(n)) {
        const { message: s } = B("MISSING_OR_INVALID", `respond() response: ${JSON.stringify(n)}`);
        throw new Error(s);
      }
    }, this.isValidPing = async (e) => {
      if (!Xe(e)) {
        const { message: n } = B("MISSING_OR_INVALID", `ping() params: ${e}`);
        throw new Error(n);
      }
      const { topic: r } = e;
      await this.isValidSessionOrPairingTopic(r);
    }, this.isValidEmit = async (e) => {
      if (!Xe(e)) {
        const { message: l } = B("MISSING_OR_INVALID", `emit() params: ${e}`);
        throw new Error(l);
      }
      const { topic: r, event: n, chainId: s } = e;
      await this.isValidSessionTopic(r);
      const { namespaces: c } = this.client.session.get(r);
      if (!bn(c, s)) {
        const { message: l } = B("MISSING_OR_INVALID", `emit() chainId: ${s}`);
        throw new Error(l);
      }
      if (!Lo(n)) {
        const { message: l } = B("MISSING_OR_INVALID", `emit() event: ${JSON.stringify(n)}`);
        throw new Error(l);
      }
      if (!Do(c, s, n.name)) {
        const { message: l } = B("MISSING_OR_INVALID", `emit() event: ${JSON.stringify(n)}`);
        throw new Error(l);
      }
    }, this.isValidDisconnect = async (e) => {
      if (!Xe(e)) {
        const { message: n } = B("MISSING_OR_INVALID", `disconnect() params: ${e}`);
        throw new Error(n);
      }
      const { topic: r } = e;
      await this.isValidSessionOrPairingTopic(r);
    }, this.getVerifyContext = async (e, r) => {
      const n = { verified: { verifyUrl: r.verifyUrl || mo, validation: "UNKNOWN", origin: r.url || "" } };
      try {
        const s = await this.client.core.verify.resolve({ attestationId: e, verifyUrl: r.verifyUrl });
        s && (n.verified.origin = s.origin, n.verified.isScam = s.isScam, n.verified.validation = s.origin === new URL(r.url).origin ? "VALID" : "INVALID");
      } catch (s) {
        this.client.logger.info(s);
      }
      return this.client.logger.info(`Verify context: ${JSON.stringify(n)}`), n;
    }, this.validateSessionProps = (e, r) => {
      Object.values(e).forEach((n) => {
        if (!fr(n, !1)) {
          const { message: s } = B("MISSING_OR_INVALID", `${r} must be in Record<string, string> format. Received: ${JSON.stringify(n)}`);
          throw new Error(s);
        }
      });
    };
  }
  async isInitialized() {
    if (!this.initialized) {
      const { message: t } = B("NOT_INITIALIZED", this.name);
      throw new Error(t);
    }
    await this.client.core.relayer.confirmOnlineStateOrThrow();
  }
  registerRelayerEvents() {
    this.client.core.relayer.on(bi.message, async (t) => {
      const { topic: e, message: r } = t;
      if (this.ignoredPayloadTypes.includes(this.client.core.crypto.getPayloadType(r)))
        return;
      const n = await this.client.core.crypto.decode(e, r);
      try {
        hs(n) ? (this.client.core.history.set(e, n), this.onRelayEventRequest({ topic: e, payload: n })) : us(n) ? (await this.client.core.history.resolve(n), await this.onRelayEventResponse({ topic: e, payload: n }), this.client.core.history.delete(e, n.id)) : this.onRelayEventUnknownPayload({ topic: e, payload: n });
      } catch (s) {
        this.client.logger.error(s);
      }
    });
  }
  registerExpirerEvents() {
    this.client.core.expirer.on(yo.expired, async (t) => {
      const { topic: e, id: r } = Uo(t.target);
      if (r && this.client.pendingRequest.keys.includes(r))
        return await this.deletePendingSessionRequest(r, B("EXPIRED"), !0);
      e ? this.client.session.keys.includes(e) && (await this.deleteSession(e, !0), this.client.events.emit("session_expire", { topic: e })) : r && (await this.deleteProposal(r, !0), this.client.events.emit("proposal_expire", { id: r }));
    });
  }
  registerPairingEvents() {
    this.client.core.pairing.events.on(cs.create, (t) => this.onPairingCreated(t));
  }
  isValidPairingTopic(t) {
    if (!fr(t, !1)) {
      const { message: e } = B("MISSING_OR_INVALID", `pairing topic should be a string: ${t}`);
      throw new Error(e);
    }
    if (!this.client.core.pairing.pairings.keys.includes(t)) {
      const { message: e } = B("NO_MATCHING_KEY", `pairing topic doesn't exist: ${t}`);
      throw new Error(e);
    }
    if (Ht(this.client.core.pairing.pairings.get(t).expiry)) {
      const { message: e } = B("EXPIRED", `pairing topic: ${t}`);
      throw new Error(e);
    }
  }
  async isValidSessionTopic(t) {
    if (!fr(t, !1)) {
      const { message: e } = B("MISSING_OR_INVALID", `session topic should be a string: ${t}`);
      throw new Error(e);
    }
    if (!this.client.session.keys.includes(t)) {
      const { message: e } = B("NO_MATCHING_KEY", `session topic doesn't exist: ${t}`);
      throw new Error(e);
    }
    if (Ht(this.client.session.get(t).expiry)) {
      await this.deleteSession(t);
      const { message: e } = B("EXPIRED", `session topic: ${t}`);
      throw new Error(e);
    }
  }
  async isValidSessionOrPairingTopic(t) {
    if (this.client.session.keys.includes(t))
      await this.isValidSessionTopic(t);
    else if (this.client.core.pairing.pairings.keys.includes(t))
      this.isValidPairingTopic(t);
    else if (fr(t, !1)) {
      const { message: e } = B("NO_MATCHING_KEY", `session or pairing topic doesn't exist: ${t}`);
      throw new Error(e);
    } else {
      const { message: e } = B("MISSING_OR_INVALID", `session or pairing topic should be a string: ${t}`);
      throw new Error(e);
    }
  }
  async isValidProposalId(t) {
    if (!ko(t)) {
      const { message: e } = B("MISSING_OR_INVALID", `proposal id should be a number: ${t}`);
      throw new Error(e);
    }
    if (!this.client.proposal.keys.includes(t)) {
      const { message: e } = B("NO_MATCHING_KEY", `proposal id doesn't exist: ${t}`);
      throw new Error(e);
    }
    if (Ht(this.client.proposal.get(t).expiry)) {
      await this.deleteProposal(t);
      const { message: e } = B("EXPIRED", `proposal id: ${t}`);
      throw new Error(e);
    }
  }
};
a(un, "hs");
let Li = un;
const cn = class cn extends Jt {
  constructor(t, e) {
    super(t, e, Uu, en), this.core = t, this.logger = e;
  }
};
a(cn, "ds");
let Di = cn;
const ln = class ln extends Jt {
  constructor(t, e) {
    super(t, e, zu, en), this.core = t, this.logger = e;
  }
};
a(ln, "us");
let Ui = ln;
const dn = class dn extends Jt {
  constructor(t, e) {
    super(t, e, Vu, en, (r) => r.id), this.core = t, this.logger = e;
  }
};
a(dn, "gs");
let ki = dn;
const $r = class $r extends lo {
  constructor(t) {
    super(t), this.protocol = no, this.version = so, this.name = yi.name, this.events = new os.EventEmitter(), this.on = (r, n) => this.events.on(r, n), this.once = (r, n) => this.events.once(r, n), this.off = (r, n) => this.events.off(r, n), this.removeListener = (r, n) => this.events.removeListener(r, n), this.removeAllListeners = (r) => this.events.removeAllListeners(r), this.connect = async (r) => {
      try {
        return await this.engine.connect(r);
      } catch (n) {
        throw this.logger.error(n.message), n;
      }
    }, this.pair = async (r) => {
      try {
        return await this.engine.pair(r);
      } catch (n) {
        throw this.logger.error(n.message), n;
      }
    }, this.approve = async (r) => {
      try {
        return await this.engine.approve(r);
      } catch (n) {
        throw this.logger.error(n.message), n;
      }
    }, this.reject = async (r) => {
      try {
        return await this.engine.reject(r);
      } catch (n) {
        throw this.logger.error(n.message), n;
      }
    }, this.update = async (r) => {
      try {
        return await this.engine.update(r);
      } catch (n) {
        throw this.logger.error(n.message), n;
      }
    }, this.extend = async (r) => {
      try {
        return await this.engine.extend(r);
      } catch (n) {
        throw this.logger.error(n.message), n;
      }
    }, this.request = async (r) => {
      try {
        return await this.engine.request(r);
      } catch (n) {
        throw this.logger.error(n.message), n;
      }
    }, this.respond = async (r) => {
      try {
        return await this.engine.respond(r);
      } catch (n) {
        throw this.logger.error(n.message), n;
      }
    }, this.ping = async (r) => {
      try {
        return await this.engine.ping(r);
      } catch (n) {
        throw this.logger.error(n.message), n;
      }
    }, this.emit = async (r) => {
      try {
        return await this.engine.emit(r);
      } catch (n) {
        throw this.logger.error(n.message), n;
      }
    }, this.disconnect = async (r) => {
      try {
        return await this.engine.disconnect(r);
      } catch (n) {
        throw this.logger.error(n.message), n;
      }
    }, this.find = (r) => {
      try {
        return this.engine.find(r);
      } catch (n) {
        throw this.logger.error(n.message), n;
      }
    }, this.getPendingSessionRequests = () => {
      try {
        return this.engine.getPendingSessionRequests();
      } catch (r) {
        throw this.logger.error(r.message), r;
      }
    }, this.name = (t == null ? void 0 : t.name) || yi.name, this.metadata = (t == null ? void 0 : t.metadata) || So();
    const e = typeof (t == null ? void 0 : t.logger) < "u" && typeof (t == null ? void 0 : t.logger) != "string" ? t.logger : Mt.pino(Mt.getDefaultLoggerOptions({ level: (t == null ? void 0 : t.logger) || yi.logger }));
    this.core = (t == null ? void 0 : t.core) || new as(t), this.logger = Mt.generateChildLogger(e, this.name), this.session = new Ui(this.core, this.logger), this.proposal = new Di(this.core, this.logger), this.pendingRequest = new ki(this.core, this.logger), this.engine = new Li(this);
  }
  static async init(t) {
    const e = new $r(t);
    return await e.initialize(), e;
  }
  get context() {
    return Mt.getLoggerContext(this.logger);
  }
  get pairing() {
    return this.core.pairing.pairings;
  }
  async initialize() {
    this.logger.trace("Initialized");
    try {
      await this.core.start(), await this.session.init(), await this.proposal.init(), await this.pendingRequest.init(), await this.engine.init(), this.core.verify.init({ verifyUrl: this.metadata.verifyUrl }), this.logger.info("SignClient Initialization Success");
    } catch (t) {
      throw this.logger.info("SignClient Initialization Failure"), this.logger.error(t.message), t;
    }
  }
};
a($r, "Q");
let zi = $r;
const Xu = zi;
var Tr = { exports: {} }, Yt = typeof Reflect == "object" ? Reflect : null, Zn = Yt && typeof Yt.apply == "function" ? Yt.apply : function(i, t, e) {
  return Function.prototype.apply.call(i, t, e);
}, Fr;
Yt && typeof Yt.ownKeys == "function" ? Fr = Yt.ownKeys : Object.getOwnPropertySymbols ? Fr = /* @__PURE__ */ a(function(i) {
  return Object.getOwnPropertyNames(i).concat(Object.getOwnPropertySymbols(i));
}, "f") : Fr = /* @__PURE__ */ a(function(i) {
  return Object.getOwnPropertyNames(i);
}, "f");
function Yu(i) {
  console && console.warn && console.warn(i);
}
a(Yu, "T");
var Qn = Number.isNaN || function(i) {
  return i !== i;
};
function Y() {
  Y.init.call(this);
}
a(Y, "o");
Tr.exports = Y, Tr.exports.once = t0, Y.EventEmitter = Y, Y.prototype._events = void 0, Y.prototype._eventsCount = 0, Y.prototype._maxListeners = void 0;
var es = 10;
function Pr(i) {
  if (typeof i != "function")
    throw new TypeError('The "listener" argument must be of type Function. Received type ' + typeof i);
}
a(Pr, "g");
Object.defineProperty(Y, "defaultMaxListeners", { enumerable: !0, get: function() {
  return es;
}, set: function(i) {
  if (typeof i != "number" || i < 0 || Qn(i))
    throw new RangeError('The value of "defaultMaxListeners" is out of range. It must be a non-negative number. Received ' + i + ".");
  es = i;
} }), Y.init = function() {
  (this._events === void 0 || this._events === Object.getPrototypeOf(this)._events) && (this._events = /* @__PURE__ */ Object.create(null), this._eventsCount = 0), this._maxListeners = this._maxListeners || void 0;
}, Y.prototype.setMaxListeners = function(i) {
  if (typeof i != "number" || i < 0 || Qn(i))
    throw new RangeError('The value of "n" is out of range. It must be a non-negative number. Received ' + i + ".");
  return this._maxListeners = i, this;
};
function ao(i) {
  return i._maxListeners === void 0 ? Y.defaultMaxListeners : i._maxListeners;
}
a(ao, "L");
Y.prototype.getMaxListeners = function() {
  return ao(this);
}, Y.prototype.emit = function(i) {
  for (var t = [], e = 1; e < arguments.length; e++)
    t.push(arguments[e]);
  var r = i === "error", n = this._events;
  if (n !== void 0)
    r = r && n.error === void 0;
  else if (!r)
    return !1;
  if (r) {
    var s;
    if (t.length > 0 && (s = t[0]), s instanceof Error)
      throw s;
    var c = new Error("Unhandled error." + (s ? " (" + s.message + ")" : ""));
    throw c.context = s, c;
  }
  var l = n[i];
  if (l === void 0)
    return !1;
  if (typeof l == "function")
    Zn(l, this, t);
  else
    for (var p = l.length, y = fo(l, p), e = 0; e < p; ++e)
      Zn(y[e], this, t);
  return !0;
};
function ts(i, t, e, r) {
  var n, s, c;
  if (Pr(e), s = i._events, s === void 0 ? (s = i._events = /* @__PURE__ */ Object.create(null), i._eventsCount = 0) : (s.newListener !== void 0 && (i.emit("newListener", t, e.listener ? e.listener : e), s = i._events), c = s[t]), c === void 0)
    c = s[t] = e, ++i._eventsCount;
  else if (typeof c == "function" ? c = s[t] = r ? [e, c] : [c, e] : r ? c.unshift(e) : c.push(e), n = ao(i), n > 0 && c.length > n && !c.warned) {
    c.warned = !0;
    var l = new Error("Possible EventEmitter memory leak detected. " + c.length + " " + String(t) + " listeners added. Use emitter.setMaxListeners() to increase limit");
    l.name = "MaxListenersExceededWarning", l.emitter = i, l.type = t, l.count = c.length, Yu(l);
  }
  return i;
}
a(ts, "_");
Y.prototype.addListener = function(i, t) {
  return ts(this, i, t, !1);
}, Y.prototype.on = Y.prototype.addListener, Y.prototype.prependListener = function(i, t) {
  return ts(this, i, t, !0);
};
function Zu() {
  if (!this.fired)
    return this.target.removeListener(this.type, this.wrapFn), this.fired = !0, arguments.length === 0 ? this.listener.call(this.target) : this.listener.apply(this.target, arguments);
}
a(Zu, "j");
function rs(i, t, e) {
  var r = { fired: !1, wrapFn: void 0, target: i, type: t, listener: e }, n = Zu.bind(r);
  return n.listener = e, r.wrapFn = n, n;
}
a(rs, "S");
Y.prototype.once = function(i, t) {
  return Pr(t), this.on(i, rs(this, i, t)), this;
}, Y.prototype.prependOnceListener = function(i, t) {
  return Pr(t), this.prependListener(i, rs(this, i, t)), this;
}, Y.prototype.removeListener = function(i, t) {
  var e, r, n, s, c;
  if (Pr(t), r = this._events, r === void 0)
    return this;
  if (e = r[i], e === void 0)
    return this;
  if (e === t || e.listener === t)
    --this._eventsCount === 0 ? this._events = /* @__PURE__ */ Object.create(null) : (delete r[i], r.removeListener && this.emit("removeListener", i, e.listener || t));
  else if (typeof e != "function") {
    for (n = -1, s = e.length - 1; s >= 0; s--)
      if (e[s] === t || e[s].listener === t) {
        c = e[s].listener, n = s;
        break;
      }
    if (n < 0)
      return this;
    n === 0 ? e.shift() : Qu(e, n), e.length === 1 && (r[i] = e[0]), r.removeListener !== void 0 && this.emit("removeListener", i, c || t);
  }
  return this;
}, Y.prototype.off = Y.prototype.removeListener, Y.prototype.removeAllListeners = function(i) {
  var t, e, r;
  if (e = this._events, e === void 0)
    return this;
  if (e.removeListener === void 0)
    return arguments.length === 0 ? (this._events = /* @__PURE__ */ Object.create(null), this._eventsCount = 0) : e[i] !== void 0 && (--this._eventsCount === 0 ? this._events = /* @__PURE__ */ Object.create(null) : delete e[i]), this;
  if (arguments.length === 0) {
    var n = Object.keys(e), s;
    for (r = 0; r < n.length; ++r)
      s = n[r], s !== "removeListener" && this.removeAllListeners(s);
    return this.removeAllListeners("removeListener"), this._events = /* @__PURE__ */ Object.create(null), this._eventsCount = 0, this;
  }
  if (t = e[i], typeof t == "function")
    this.removeListener(i, t);
  else if (t !== void 0)
    for (r = t.length - 1; r >= 0; r--)
      this.removeListener(i, t[r]);
  return this;
};
function is(i, t, e) {
  var r = i._events;
  if (r === void 0)
    return [];
  var n = r[t];
  return n === void 0 ? [] : typeof n == "function" ? e ? [n.listener || n] : [n] : e ? e0(n) : fo(n, n.length);
}
a(is, "C");
Y.prototype.listeners = function(i) {
  return is(this, i, !0);
}, Y.prototype.rawListeners = function(i) {
  return is(this, i, !1);
}, Y.listenerCount = function(i, t) {
  return typeof i.listenerCount == "function" ? i.listenerCount(t) : ns.call(i, t);
}, Y.prototype.listenerCount = ns;
function ns(i) {
  var t = this._events;
  if (t !== void 0) {
    var e = t[i];
    if (typeof e == "function")
      return 1;
    if (e !== void 0)
      return e.length;
  }
  return 0;
}
a(ns, "E");
Y.prototype.eventNames = function() {
  return this._eventsCount > 0 ? Fr(this._events) : [];
};
function fo(i, t) {
  for (var e = new Array(t), r = 0; r < t; ++r)
    e[r] = i[r];
  return e;
}
a(fo, "b");
function Qu(i, t) {
  for (; t + 1 < i.length; t++)
    i[t] = i[t + 1];
  i.pop();
}
a(Qu, "I");
function e0(i) {
  for (var t = new Array(i.length), e = 0; e < t.length; ++e)
    t[e] = i[e].listener || i[e];
  return t;
}
a(e0, "W");
function t0(i, t) {
  return new Promise(function(e, r) {
    function n(c) {
      i.removeListener(t, s), r(c);
    }
    a(n, "i");
    function s() {
      typeof i.removeListener == "function" && i.removeListener("error", n), e([].slice.call(arguments));
    }
    a(s, "a"), ho(i, t, s, { once: !0 }), t !== "error" && r0(i, n, { once: !0 });
  });
}
a(t0, "M");
function r0(i, t, e) {
  typeof i.on == "function" && ho(i, "error", t, e);
}
a(r0, "z");
function ho(i, t, e, r) {
  if (typeof i.on == "function")
    r.once ? i.once(t, e) : i.on(t, e);
  else if (typeof i.addEventListener == "function")
    i.addEventListener(t, /* @__PURE__ */ a(function n(s) {
      r.once && i.removeEventListener(t, n), e(s);
    }, "i"));
  else
    throw new TypeError('The "emitter" argument must be of type EventEmitter. Received type ' + typeof i);
}
a(ho, "R");
const i0 = "wc", a0 = 2, uo = "Web3Wallet", f0 = `${i0}@2:${uo}:`, h0 = { database: ":memory:" }, u0 = "request", pn = class pn extends Tr.exports {
  constructor() {
    super();
  }
};
a(pn, "X");
let ss = pn;
const vn = class vn {
  constructor(t) {
    this.opts = t;
  }
};
a(vn, "x");
let Bi = vn;
const gn = class gn {
  constructor(t) {
    this.client = t;
  }
};
a(gn, "P");
let Vi = gn;
const mn = class mn extends Vi {
  constructor(t) {
    super(t), this.init = async () => {
      this.signClient = await Xu.init({ core: this.client.core, metadata: this.client.metadata }), this.authClient = await Du.init({ core: this.client.core, projectId: "", metadata: this.client.metadata }), this.initializeEventListeners();
    }, this.pair = async (e) => {
      await this.client.core.pairing.pair(e);
    }, this.approveSession = async (e) => {
      const { topic: r, acknowledged: n } = await this.signClient.approve({ id: e.id, namespaces: e.namespaces });
      return await n(), this.signClient.session.get(r);
    }, this.rejectSession = async (e) => await this.signClient.reject(e), this.updateSession = async (e) => await (await this.signClient.update(e)).acknowledged(), this.extendSession = async (e) => await (await this.signClient.extend(e)).acknowledged(), this.respondSessionRequest = async (e) => await this.signClient.respond(e), this.disconnectSession = async (e) => await this.signClient.disconnect(e), this.emitSessionEvent = async (e) => await this.signClient.emit(e), this.getActiveSessions = () => this.signClient.session.getAll().reduce((e, r) => (e[r.topic] = r, e), {}), this.getPendingSessionProposals = () => this.signClient.proposal.getAll(), this.getPendingSessionRequests = () => this.signClient.getPendingSessionRequests(), this.respondAuthRequest = async (e, r) => await this.authClient.respond(e, r), this.getPendingAuthRequests = () => this.authClient.requests.getAll().filter((e) => "requester" in e), this.formatMessage = (e, r) => this.authClient.formatMessage(e, r), this.onSessionRequest = (e) => {
      this.client.events.emit("session_request", e);
    }, this.onSessionProposal = (e) => {
      this.client.events.emit("session_proposal", e);
    }, this.onSessionDelete = (e) => {
      this.client.events.emit("session_delete", e);
    }, this.onAuthRequest = (e) => {
      this.client.events.emit("auth_request", e);
    }, this.initializeEventListeners = () => {
      this.signClient.events.on("session_proposal", this.onSessionProposal), this.signClient.events.on("session_request", this.onSessionRequest), this.signClient.events.on("session_delete", this.onSessionDelete), this.authClient.on("auth_request", this.onAuthRequest);
    }, this.signClient = {}, this.authClient = {};
  }
};
a(mn, "D");
let Ki = mn;
const Lr = class Lr extends Bi {
  constructor(t) {
    super(t), this.events = new Tr.exports(), this.on = (e, r) => this.events.on(e, r), this.once = (e, r) => this.events.once(e, r), this.off = (e, r) => this.events.off(e, r), this.removeListener = (e, r) => this.events.removeListener(e, r), this.pair = async (e) => {
      try {
        return await this.engine.pair(e);
      } catch (r) {
        throw this.logger.error(r.message), r;
      }
    }, this.approveSession = async (e) => {
      try {
        return await this.engine.approveSession(e);
      } catch (r) {
        throw this.logger.error(r.message), r;
      }
    }, this.rejectSession = async (e) => {
      try {
        return await this.engine.rejectSession(e);
      } catch (r) {
        throw this.logger.error(r.message), r;
      }
    }, this.updateSession = async (e) => {
      try {
        return await this.engine.updateSession(e);
      } catch (r) {
        throw this.logger.error(r.message), r;
      }
    }, this.extendSession = async (e) => {
      try {
        return await this.engine.extendSession(e);
      } catch (r) {
        throw this.logger.error(r.message), r;
      }
    }, this.respondSessionRequest = async (e) => {
      try {
        return await this.engine.respondSessionRequest(e);
      } catch (r) {
        throw this.logger.error(r.message), r;
      }
    }, this.disconnectSession = async (e) => {
      try {
        return await this.engine.disconnectSession(e);
      } catch (r) {
        throw this.logger.error(r.message), r;
      }
    }, this.emitSessionEvent = async (e) => {
      try {
        return await this.engine.emitSessionEvent(e);
      } catch (r) {
        throw this.logger.error(r.message), r;
      }
    }, this.getActiveSessions = () => {
      try {
        return this.engine.getActiveSessions();
      } catch (e) {
        throw this.logger.error(e.message), e;
      }
    }, this.getPendingSessionProposals = () => {
      try {
        return this.engine.getPendingSessionProposals();
      } catch (e) {
        throw this.logger.error(e.message), e;
      }
    }, this.getPendingSessionRequests = () => {
      try {
        return this.engine.getPendingSessionRequests();
      } catch (e) {
        throw this.logger.error(e.message), e;
      }
    }, this.respondAuthRequest = async (e, r) => {
      try {
        return await this.engine.respondAuthRequest(e, r);
      } catch (n) {
        throw this.logger.error(n.message), n;
      }
    }, this.getPendingAuthRequests = () => {
      try {
        return this.engine.getPendingAuthRequests();
      } catch (e) {
        throw this.logger.error(e.message), e;
      }
    }, this.formatMessage = (e, r) => {
      try {
        return this.engine.formatMessage(e, r);
      } catch (n) {
        throw this.logger.error(n.message), n;
      }
    }, this.metadata = t.metadata, this.name = t.name || uo, this.core = t.core, this.logger = this.core.logger, this.engine = new Ki(this);
  }
  static async init(t) {
    const e = new Lr(t);
    return await e.initialize(), e;
  }
  async initialize() {
    this.logger.trace("Initialized");
    try {
      await this.engine.init(), this.logger.info("Web3Wallet Initialization Success");
    } catch (t) {
      throw this.logger.info("Web3Wallet Initialization Failure"), this.logger.error(t.message), t;
    }
  }
};
a(Lr, "p");
let ji = Lr;
const c0 = ji;
export {
  uo as CLIENT_CONTEXT,
  h0 as CLIENT_STORAGE_OPTIONS,
  f0 as CLIENT_STORAGE_PREFIX,
  Bi as IWeb3Wallet,
  Vi as IWeb3WalletEngine,
  ss as IWeb3WalletEvents,
  i0 as PROTOCOL,
  a0 as PROTOCOL_VERSION,
  u0 as REQUEST_CONTEXT,
  c0 as Web3Wallet,
  ji as default
};
