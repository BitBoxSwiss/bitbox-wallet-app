import { e as eventsExports, c as cjs, N as Nr$1, M as Mt$1, f as formatJsonRpcError, i as isJsonRpcResult, a as isJsonRpcError, D as D$2, b as isJsonRpcRequest, d as isJsonRpcResponse, V as V$2, g as formatJsonRpcRequest, h as formatJsonRpcResult, j as b$2, S as S$2, Y as Ye, k as ht$1, $ as $$1, v, p as payloadId } from "./index.es.js";
import { c as commonjsGlobal, g as getDefaultExportFromCjs, r as require$$0$1, a as getAugmentedNamespace, K as Kn, D as D$1, N, b as cjs$1, k as kt$1, X as Xt$1, s as sha256, _ as _$1, Q as Qn, d as at$1, y as yt$1, p as pt$1, B as B$1, j as jt$1, U as U$3, e as gt$1, h as ht$2, f as Dt$1, L as Ln, m as mt$1, t as tr$1, H as Ht$1, w as w$1, x as xt$1, i as Lt$1, u as un, l as dn, n as h, q as qt$1, o as ln, v as Kt$1, z as zt$1, A as Bt$1, Y as Yt$1, G as Gt$1, W as Wt$1, J as Jt$1, C as ft$1, F as Ft$1 } from "./index.js";
var sha3$1 = { exports: {} };
/**
 * [js-sha3]{@link https://github.com/emn178/js-sha3}
 *
 * @version 0.8.0
 * @author Chen, Yi-Cyuan [emn178@gmail.com]
 * @copyright Chen, Yi-Cyuan 2015-2018
 * @license MIT
 */
(function(module) {
  (function() {
    var INPUT_ERROR = "input is invalid type";
    var FINALIZE_ERROR = "finalize already called";
    var WINDOW = typeof window === "object";
    var root = WINDOW ? window : {};
    if (root.JS_SHA3_NO_WINDOW) {
      WINDOW = false;
    }
    var WEB_WORKER = !WINDOW && typeof self === "object";
    var NODE_JS = !root.JS_SHA3_NO_NODE_JS && typeof process === "object" && process.versions && process.versions.node;
    if (NODE_JS) {
      root = commonjsGlobal;
    } else if (WEB_WORKER) {
      root = self;
    }
    var COMMON_JS = !root.JS_SHA3_NO_COMMON_JS && true && module.exports;
    var ARRAY_BUFFER = !root.JS_SHA3_NO_ARRAY_BUFFER && typeof ArrayBuffer !== "undefined";
    var HEX_CHARS = "0123456789abcdef".split("");
    var SHAKE_PADDING = [31, 7936, 2031616, 520093696];
    var CSHAKE_PADDING = [4, 1024, 262144, 67108864];
    var KECCAK_PADDING = [1, 256, 65536, 16777216];
    var PADDING = [6, 1536, 393216, 100663296];
    var SHIFT = [0, 8, 16, 24];
    var RC = [
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
    ];
    var BITS = [224, 256, 384, 512];
    var SHAKE_BITS = [128, 256];
    var OUTPUT_TYPES = ["hex", "buffer", "arrayBuffer", "array", "digest"];
    var CSHAKE_BYTEPAD = {
      "128": 168,
      "256": 136
    };
    if (root.JS_SHA3_NO_NODE_JS || !Array.isArray) {
      Array.isArray = function(obj) {
        return Object.prototype.toString.call(obj) === "[object Array]";
      };
    }
    if (ARRAY_BUFFER && (root.JS_SHA3_NO_ARRAY_BUFFER_IS_VIEW || !ArrayBuffer.isView)) {
      ArrayBuffer.isView = function(obj) {
        return typeof obj === "object" && obj.buffer && obj.buffer.constructor === ArrayBuffer;
      };
    }
    var createOutputMethod = function(bits2, padding, outputType) {
      return function(message) {
        return new Keccak(bits2, padding, bits2).update(message)[outputType]();
      };
    };
    var createShakeOutputMethod = function(bits2, padding, outputType) {
      return function(message, outputBits) {
        return new Keccak(bits2, padding, outputBits).update(message)[outputType]();
      };
    };
    var createCshakeOutputMethod = function(bits2, padding, outputType) {
      return function(message, outputBits, n, s2) {
        return methods["cshake" + bits2].update(message, outputBits, n, s2)[outputType]();
      };
    };
    var createKmacOutputMethod = function(bits2, padding, outputType) {
      return function(key2, message, outputBits, s2) {
        return methods["kmac" + bits2].update(key2, message, outputBits, s2)[outputType]();
      };
    };
    var createOutputMethods = function(method, createMethod2, bits2, padding) {
      for (var i2 = 0; i2 < OUTPUT_TYPES.length; ++i2) {
        var type = OUTPUT_TYPES[i2];
        method[type] = createMethod2(bits2, padding, type);
      }
      return method;
    };
    var createMethod = function(bits2, padding) {
      var method = createOutputMethod(bits2, padding, "hex");
      method.create = function() {
        return new Keccak(bits2, padding, bits2);
      };
      method.update = function(message) {
        return method.create().update(message);
      };
      return createOutputMethods(method, createOutputMethod, bits2, padding);
    };
    var createShakeMethod = function(bits2, padding) {
      var method = createShakeOutputMethod(bits2, padding, "hex");
      method.create = function(outputBits) {
        return new Keccak(bits2, padding, outputBits);
      };
      method.update = function(message, outputBits) {
        return method.create(outputBits).update(message);
      };
      return createOutputMethods(method, createShakeOutputMethod, bits2, padding);
    };
    var createCshakeMethod = function(bits2, padding) {
      var w2 = CSHAKE_BYTEPAD[bits2];
      var method = createCshakeOutputMethod(bits2, padding, "hex");
      method.create = function(outputBits, n, s2) {
        if (!n && !s2) {
          return methods["shake" + bits2].create(outputBits);
        } else {
          return new Keccak(bits2, padding, outputBits).bytepad([n, s2], w2);
        }
      };
      method.update = function(message, outputBits, n, s2) {
        return method.create(outputBits, n, s2).update(message);
      };
      return createOutputMethods(method, createCshakeOutputMethod, bits2, padding);
    };
    var createKmacMethod = function(bits2, padding) {
      var w2 = CSHAKE_BYTEPAD[bits2];
      var method = createKmacOutputMethod(bits2, padding, "hex");
      method.create = function(key2, outputBits, s2) {
        return new Kmac(bits2, padding, outputBits).bytepad(["KMAC", s2], w2).bytepad([key2], w2);
      };
      method.update = function(key2, message, outputBits, s2) {
        return method.create(key2, outputBits, s2).update(message);
      };
      return createOutputMethods(method, createKmacOutputMethod, bits2, padding);
    };
    var algorithms = [
      { name: "keccak", padding: KECCAK_PADDING, bits: BITS, createMethod },
      { name: "sha3", padding: PADDING, bits: BITS, createMethod },
      { name: "shake", padding: SHAKE_PADDING, bits: SHAKE_BITS, createMethod: createShakeMethod },
      { name: "cshake", padding: CSHAKE_PADDING, bits: SHAKE_BITS, createMethod: createCshakeMethod },
      { name: "kmac", padding: CSHAKE_PADDING, bits: SHAKE_BITS, createMethod: createKmacMethod }
    ];
    var methods = {}, methodNames = [];
    for (var i = 0; i < algorithms.length; ++i) {
      var algorithm = algorithms[i];
      var bits = algorithm.bits;
      for (var j2 = 0; j2 < bits.length; ++j2) {
        var methodName = algorithm.name + "_" + bits[j2];
        methodNames.push(methodName);
        methods[methodName] = algorithm.createMethod(bits[j2], algorithm.padding);
        if (algorithm.name !== "sha3") {
          var newMethodName = algorithm.name + bits[j2];
          methodNames.push(newMethodName);
          methods[newMethodName] = methods[methodName];
        }
      }
    }
    function Keccak(bits2, padding, outputBits) {
      this.blocks = [];
      this.s = [];
      this.padding = padding;
      this.outputBits = outputBits;
      this.reset = true;
      this.finalized = false;
      this.block = 0;
      this.start = 0;
      this.blockCount = 1600 - (bits2 << 1) >> 5;
      this.byteCount = this.blockCount << 2;
      this.outputBlocks = outputBits >> 5;
      this.extraBytes = (outputBits & 31) >> 3;
      for (var i2 = 0; i2 < 50; ++i2) {
        this.s[i2] = 0;
      }
    }
    Keccak.prototype.update = function(message) {
      if (this.finalized) {
        throw new Error(FINALIZE_ERROR);
      }
      var notString, type = typeof message;
      if (type !== "string") {
        if (type === "object") {
          if (message === null) {
            throw new Error(INPUT_ERROR);
          } else if (ARRAY_BUFFER && message.constructor === ArrayBuffer) {
            message = new Uint8Array(message);
          } else if (!Array.isArray(message)) {
            if (!ARRAY_BUFFER || !ArrayBuffer.isView(message)) {
              throw new Error(INPUT_ERROR);
            }
          }
        } else {
          throw new Error(INPUT_ERROR);
        }
        notString = true;
      }
      var blocks = this.blocks, byteCount = this.byteCount, length = message.length, blockCount = this.blockCount, index = 0, s2 = this.s, i2, code;
      while (index < length) {
        if (this.reset) {
          this.reset = false;
          blocks[0] = this.block;
          for (i2 = 1; i2 < blockCount + 1; ++i2) {
            blocks[i2] = 0;
          }
        }
        if (notString) {
          for (i2 = this.start; index < length && i2 < byteCount; ++index) {
            blocks[i2 >> 2] |= message[index] << SHIFT[i2++ & 3];
          }
        } else {
          for (i2 = this.start; index < length && i2 < byteCount; ++index) {
            code = message.charCodeAt(index);
            if (code < 128) {
              blocks[i2 >> 2] |= code << SHIFT[i2++ & 3];
            } else if (code < 2048) {
              blocks[i2 >> 2] |= (192 | code >> 6) << SHIFT[i2++ & 3];
              blocks[i2 >> 2] |= (128 | code & 63) << SHIFT[i2++ & 3];
            } else if (code < 55296 || code >= 57344) {
              blocks[i2 >> 2] |= (224 | code >> 12) << SHIFT[i2++ & 3];
              blocks[i2 >> 2] |= (128 | code >> 6 & 63) << SHIFT[i2++ & 3];
              blocks[i2 >> 2] |= (128 | code & 63) << SHIFT[i2++ & 3];
            } else {
              code = 65536 + ((code & 1023) << 10 | message.charCodeAt(++index) & 1023);
              blocks[i2 >> 2] |= (240 | code >> 18) << SHIFT[i2++ & 3];
              blocks[i2 >> 2] |= (128 | code >> 12 & 63) << SHIFT[i2++ & 3];
              blocks[i2 >> 2] |= (128 | code >> 6 & 63) << SHIFT[i2++ & 3];
              blocks[i2 >> 2] |= (128 | code & 63) << SHIFT[i2++ & 3];
            }
          }
        }
        this.lastByteIndex = i2;
        if (i2 >= byteCount) {
          this.start = i2 - byteCount;
          this.block = blocks[blockCount];
          for (i2 = 0; i2 < blockCount; ++i2) {
            s2[i2] ^= blocks[i2];
          }
          f2(s2);
          this.reset = true;
        } else {
          this.start = i2;
        }
      }
      return this;
    };
    Keccak.prototype.encode = function(x2, right) {
      var o2 = x2 & 255, n = 1;
      var bytes = [o2];
      x2 = x2 >> 8;
      o2 = x2 & 255;
      while (o2 > 0) {
        bytes.unshift(o2);
        x2 = x2 >> 8;
        o2 = x2 & 255;
        ++n;
      }
      if (right) {
        bytes.push(n);
      } else {
        bytes.unshift(n);
      }
      this.update(bytes);
      return bytes.length;
    };
    Keccak.prototype.encodeString = function(str) {
      var notString, type = typeof str;
      if (type !== "string") {
        if (type === "object") {
          if (str === null) {
            throw new Error(INPUT_ERROR);
          } else if (ARRAY_BUFFER && str.constructor === ArrayBuffer) {
            str = new Uint8Array(str);
          } else if (!Array.isArray(str)) {
            if (!ARRAY_BUFFER || !ArrayBuffer.isView(str)) {
              throw new Error(INPUT_ERROR);
            }
          }
        } else {
          throw new Error(INPUT_ERROR);
        }
        notString = true;
      }
      var bytes = 0, length = str.length;
      if (notString) {
        bytes = length;
      } else {
        for (var i2 = 0; i2 < str.length; ++i2) {
          var code = str.charCodeAt(i2);
          if (code < 128) {
            bytes += 1;
          } else if (code < 2048) {
            bytes += 2;
          } else if (code < 55296 || code >= 57344) {
            bytes += 3;
          } else {
            code = 65536 + ((code & 1023) << 10 | str.charCodeAt(++i2) & 1023);
            bytes += 4;
          }
        }
      }
      bytes += this.encode(bytes * 8);
      this.update(str);
      return bytes;
    };
    Keccak.prototype.bytepad = function(strs, w2) {
      var bytes = this.encode(w2);
      for (var i2 = 0; i2 < strs.length; ++i2) {
        bytes += this.encodeString(strs[i2]);
      }
      var paddingBytes = w2 - bytes % w2;
      var zeros = [];
      zeros.length = paddingBytes;
      this.update(zeros);
      return this;
    };
    Keccak.prototype.finalize = function() {
      if (this.finalized) {
        return;
      }
      this.finalized = true;
      var blocks = this.blocks, i2 = this.lastByteIndex, blockCount = this.blockCount, s2 = this.s;
      blocks[i2 >> 2] |= this.padding[i2 & 3];
      if (this.lastByteIndex === this.byteCount) {
        blocks[0] = blocks[blockCount];
        for (i2 = 1; i2 < blockCount + 1; ++i2) {
          blocks[i2] = 0;
        }
      }
      blocks[blockCount - 1] |= 2147483648;
      for (i2 = 0; i2 < blockCount; ++i2) {
        s2[i2] ^= blocks[i2];
      }
      f2(s2);
    };
    Keccak.prototype.toString = Keccak.prototype.hex = function() {
      this.finalize();
      var blockCount = this.blockCount, s2 = this.s, outputBlocks = this.outputBlocks, extraBytes = this.extraBytes, i2 = 0, j3 = 0;
      var hex = "", block;
      while (j3 < outputBlocks) {
        for (i2 = 0; i2 < blockCount && j3 < outputBlocks; ++i2, ++j3) {
          block = s2[i2];
          hex += HEX_CHARS[block >> 4 & 15] + HEX_CHARS[block & 15] + HEX_CHARS[block >> 12 & 15] + HEX_CHARS[block >> 8 & 15] + HEX_CHARS[block >> 20 & 15] + HEX_CHARS[block >> 16 & 15] + HEX_CHARS[block >> 28 & 15] + HEX_CHARS[block >> 24 & 15];
        }
        if (j3 % blockCount === 0) {
          f2(s2);
          i2 = 0;
        }
      }
      if (extraBytes) {
        block = s2[i2];
        hex += HEX_CHARS[block >> 4 & 15] + HEX_CHARS[block & 15];
        if (extraBytes > 1) {
          hex += HEX_CHARS[block >> 12 & 15] + HEX_CHARS[block >> 8 & 15];
        }
        if (extraBytes > 2) {
          hex += HEX_CHARS[block >> 20 & 15] + HEX_CHARS[block >> 16 & 15];
        }
      }
      return hex;
    };
    Keccak.prototype.arrayBuffer = function() {
      this.finalize();
      var blockCount = this.blockCount, s2 = this.s, outputBlocks = this.outputBlocks, extraBytes = this.extraBytes, i2 = 0, j3 = 0;
      var bytes = this.outputBits >> 3;
      var buffer;
      if (extraBytes) {
        buffer = new ArrayBuffer(outputBlocks + 1 << 2);
      } else {
        buffer = new ArrayBuffer(bytes);
      }
      var array = new Uint32Array(buffer);
      while (j3 < outputBlocks) {
        for (i2 = 0; i2 < blockCount && j3 < outputBlocks; ++i2, ++j3) {
          array[j3] = s2[i2];
        }
        if (j3 % blockCount === 0) {
          f2(s2);
        }
      }
      if (extraBytes) {
        array[i2] = s2[i2];
        buffer = buffer.slice(0, bytes);
      }
      return buffer;
    };
    Keccak.prototype.buffer = Keccak.prototype.arrayBuffer;
    Keccak.prototype.digest = Keccak.prototype.array = function() {
      this.finalize();
      var blockCount = this.blockCount, s2 = this.s, outputBlocks = this.outputBlocks, extraBytes = this.extraBytes, i2 = 0, j3 = 0;
      var array = [], offset, block;
      while (j3 < outputBlocks) {
        for (i2 = 0; i2 < blockCount && j3 < outputBlocks; ++i2, ++j3) {
          offset = j3 << 2;
          block = s2[i2];
          array[offset] = block & 255;
          array[offset + 1] = block >> 8 & 255;
          array[offset + 2] = block >> 16 & 255;
          array[offset + 3] = block >> 24 & 255;
        }
        if (j3 % blockCount === 0) {
          f2(s2);
        }
      }
      if (extraBytes) {
        offset = j3 << 2;
        block = s2[i2];
        array[offset] = block & 255;
        if (extraBytes > 1) {
          array[offset + 1] = block >> 8 & 255;
        }
        if (extraBytes > 2) {
          array[offset + 2] = block >> 16 & 255;
        }
      }
      return array;
    };
    function Kmac(bits2, padding, outputBits) {
      Keccak.call(this, bits2, padding, outputBits);
    }
    Kmac.prototype = new Keccak();
    Kmac.prototype.finalize = function() {
      this.encode(this.outputBits, true);
      return Keccak.prototype.finalize.call(this);
    };
    var f2 = function(s2) {
      var h2, l2, n, c0, c1, c2, c3, c4, c5, c6, c7, c8, c9, b0, b1, b2, b3, b4, b5, b6, b7, b8, b9, b10, b11, b12, b13, b14, b15, b16, b17, b18, b19, b20, b21, b22, b23, b24, b25, b26, b27, b28, b29, b30, b31, b32, b33, b34, b35, b36, b37, b38, b39, b40, b41, b42, b43, b44, b45, b46, b47, b48, b49;
      for (n = 0; n < 48; n += 2) {
        c0 = s2[0] ^ s2[10] ^ s2[20] ^ s2[30] ^ s2[40];
        c1 = s2[1] ^ s2[11] ^ s2[21] ^ s2[31] ^ s2[41];
        c2 = s2[2] ^ s2[12] ^ s2[22] ^ s2[32] ^ s2[42];
        c3 = s2[3] ^ s2[13] ^ s2[23] ^ s2[33] ^ s2[43];
        c4 = s2[4] ^ s2[14] ^ s2[24] ^ s2[34] ^ s2[44];
        c5 = s2[5] ^ s2[15] ^ s2[25] ^ s2[35] ^ s2[45];
        c6 = s2[6] ^ s2[16] ^ s2[26] ^ s2[36] ^ s2[46];
        c7 = s2[7] ^ s2[17] ^ s2[27] ^ s2[37] ^ s2[47];
        c8 = s2[8] ^ s2[18] ^ s2[28] ^ s2[38] ^ s2[48];
        c9 = s2[9] ^ s2[19] ^ s2[29] ^ s2[39] ^ s2[49];
        h2 = c8 ^ (c2 << 1 | c3 >>> 31);
        l2 = c9 ^ (c3 << 1 | c2 >>> 31);
        s2[0] ^= h2;
        s2[1] ^= l2;
        s2[10] ^= h2;
        s2[11] ^= l2;
        s2[20] ^= h2;
        s2[21] ^= l2;
        s2[30] ^= h2;
        s2[31] ^= l2;
        s2[40] ^= h2;
        s2[41] ^= l2;
        h2 = c0 ^ (c4 << 1 | c5 >>> 31);
        l2 = c1 ^ (c5 << 1 | c4 >>> 31);
        s2[2] ^= h2;
        s2[3] ^= l2;
        s2[12] ^= h2;
        s2[13] ^= l2;
        s2[22] ^= h2;
        s2[23] ^= l2;
        s2[32] ^= h2;
        s2[33] ^= l2;
        s2[42] ^= h2;
        s2[43] ^= l2;
        h2 = c2 ^ (c6 << 1 | c7 >>> 31);
        l2 = c3 ^ (c7 << 1 | c6 >>> 31);
        s2[4] ^= h2;
        s2[5] ^= l2;
        s2[14] ^= h2;
        s2[15] ^= l2;
        s2[24] ^= h2;
        s2[25] ^= l2;
        s2[34] ^= h2;
        s2[35] ^= l2;
        s2[44] ^= h2;
        s2[45] ^= l2;
        h2 = c4 ^ (c8 << 1 | c9 >>> 31);
        l2 = c5 ^ (c9 << 1 | c8 >>> 31);
        s2[6] ^= h2;
        s2[7] ^= l2;
        s2[16] ^= h2;
        s2[17] ^= l2;
        s2[26] ^= h2;
        s2[27] ^= l2;
        s2[36] ^= h2;
        s2[37] ^= l2;
        s2[46] ^= h2;
        s2[47] ^= l2;
        h2 = c6 ^ (c0 << 1 | c1 >>> 31);
        l2 = c7 ^ (c1 << 1 | c0 >>> 31);
        s2[8] ^= h2;
        s2[9] ^= l2;
        s2[18] ^= h2;
        s2[19] ^= l2;
        s2[28] ^= h2;
        s2[29] ^= l2;
        s2[38] ^= h2;
        s2[39] ^= l2;
        s2[48] ^= h2;
        s2[49] ^= l2;
        b0 = s2[0];
        b1 = s2[1];
        b32 = s2[11] << 4 | s2[10] >>> 28;
        b33 = s2[10] << 4 | s2[11] >>> 28;
        b14 = s2[20] << 3 | s2[21] >>> 29;
        b15 = s2[21] << 3 | s2[20] >>> 29;
        b46 = s2[31] << 9 | s2[30] >>> 23;
        b47 = s2[30] << 9 | s2[31] >>> 23;
        b28 = s2[40] << 18 | s2[41] >>> 14;
        b29 = s2[41] << 18 | s2[40] >>> 14;
        b20 = s2[2] << 1 | s2[3] >>> 31;
        b21 = s2[3] << 1 | s2[2] >>> 31;
        b2 = s2[13] << 12 | s2[12] >>> 20;
        b3 = s2[12] << 12 | s2[13] >>> 20;
        b34 = s2[22] << 10 | s2[23] >>> 22;
        b35 = s2[23] << 10 | s2[22] >>> 22;
        b16 = s2[33] << 13 | s2[32] >>> 19;
        b17 = s2[32] << 13 | s2[33] >>> 19;
        b48 = s2[42] << 2 | s2[43] >>> 30;
        b49 = s2[43] << 2 | s2[42] >>> 30;
        b40 = s2[5] << 30 | s2[4] >>> 2;
        b41 = s2[4] << 30 | s2[5] >>> 2;
        b22 = s2[14] << 6 | s2[15] >>> 26;
        b23 = s2[15] << 6 | s2[14] >>> 26;
        b4 = s2[25] << 11 | s2[24] >>> 21;
        b5 = s2[24] << 11 | s2[25] >>> 21;
        b36 = s2[34] << 15 | s2[35] >>> 17;
        b37 = s2[35] << 15 | s2[34] >>> 17;
        b18 = s2[45] << 29 | s2[44] >>> 3;
        b19 = s2[44] << 29 | s2[45] >>> 3;
        b10 = s2[6] << 28 | s2[7] >>> 4;
        b11 = s2[7] << 28 | s2[6] >>> 4;
        b42 = s2[17] << 23 | s2[16] >>> 9;
        b43 = s2[16] << 23 | s2[17] >>> 9;
        b24 = s2[26] << 25 | s2[27] >>> 7;
        b25 = s2[27] << 25 | s2[26] >>> 7;
        b6 = s2[36] << 21 | s2[37] >>> 11;
        b7 = s2[37] << 21 | s2[36] >>> 11;
        b38 = s2[47] << 24 | s2[46] >>> 8;
        b39 = s2[46] << 24 | s2[47] >>> 8;
        b30 = s2[8] << 27 | s2[9] >>> 5;
        b31 = s2[9] << 27 | s2[8] >>> 5;
        b12 = s2[18] << 20 | s2[19] >>> 12;
        b13 = s2[19] << 20 | s2[18] >>> 12;
        b44 = s2[29] << 7 | s2[28] >>> 25;
        b45 = s2[28] << 7 | s2[29] >>> 25;
        b26 = s2[38] << 8 | s2[39] >>> 24;
        b27 = s2[39] << 8 | s2[38] >>> 24;
        b8 = s2[48] << 14 | s2[49] >>> 18;
        b9 = s2[49] << 14 | s2[48] >>> 18;
        s2[0] = b0 ^ ~b2 & b4;
        s2[1] = b1 ^ ~b3 & b5;
        s2[10] = b10 ^ ~b12 & b14;
        s2[11] = b11 ^ ~b13 & b15;
        s2[20] = b20 ^ ~b22 & b24;
        s2[21] = b21 ^ ~b23 & b25;
        s2[30] = b30 ^ ~b32 & b34;
        s2[31] = b31 ^ ~b33 & b35;
        s2[40] = b40 ^ ~b42 & b44;
        s2[41] = b41 ^ ~b43 & b45;
        s2[2] = b2 ^ ~b4 & b6;
        s2[3] = b3 ^ ~b5 & b7;
        s2[12] = b12 ^ ~b14 & b16;
        s2[13] = b13 ^ ~b15 & b17;
        s2[22] = b22 ^ ~b24 & b26;
        s2[23] = b23 ^ ~b25 & b27;
        s2[32] = b32 ^ ~b34 & b36;
        s2[33] = b33 ^ ~b35 & b37;
        s2[42] = b42 ^ ~b44 & b46;
        s2[43] = b43 ^ ~b45 & b47;
        s2[4] = b4 ^ ~b6 & b8;
        s2[5] = b5 ^ ~b7 & b9;
        s2[14] = b14 ^ ~b16 & b18;
        s2[15] = b15 ^ ~b17 & b19;
        s2[24] = b24 ^ ~b26 & b28;
        s2[25] = b25 ^ ~b27 & b29;
        s2[34] = b34 ^ ~b36 & b38;
        s2[35] = b35 ^ ~b37 & b39;
        s2[44] = b44 ^ ~b46 & b48;
        s2[45] = b45 ^ ~b47 & b49;
        s2[6] = b6 ^ ~b8 & b0;
        s2[7] = b7 ^ ~b9 & b1;
        s2[16] = b16 ^ ~b18 & b10;
        s2[17] = b17 ^ ~b19 & b11;
        s2[26] = b26 ^ ~b28 & b20;
        s2[27] = b27 ^ ~b29 & b21;
        s2[36] = b36 ^ ~b38 & b30;
        s2[37] = b37 ^ ~b39 & b31;
        s2[46] = b46 ^ ~b48 & b40;
        s2[47] = b47 ^ ~b49 & b41;
        s2[8] = b8 ^ ~b0 & b2;
        s2[9] = b9 ^ ~b1 & b3;
        s2[18] = b18 ^ ~b10 & b12;
        s2[19] = b19 ^ ~b11 & b13;
        s2[28] = b28 ^ ~b20 & b22;
        s2[29] = b29 ^ ~b21 & b23;
        s2[38] = b38 ^ ~b30 & b32;
        s2[39] = b39 ^ ~b31 & b33;
        s2[48] = b48 ^ ~b40 & b42;
        s2[49] = b49 ^ ~b41 & b43;
        s2[0] ^= RC[n];
        s2[1] ^= RC[n + 1];
      }
    };
    if (COMMON_JS) {
      module.exports = methods;
    } else {
      for (i = 0; i < methodNames.length; ++i) {
        root[methodNames[i]] = methods[methodNames[i]];
      }
    }
  })();
})(sha3$1);
var sha3Exports = sha3$1.exports;
const sha3 = /* @__PURE__ */ getDefaultExportFromCjs(sha3Exports);
const version$4 = "logger/5.7.0";
let _permanentCensorErrors = false;
let _censorErrors = false;
const LogLevels = { debug: 1, "default": 2, info: 2, warning: 3, error: 4, off: 5 };
let _logLevel = LogLevels["default"];
let _globalLogger = null;
function _checkNormalize() {
  try {
    const missing = [];
    ["NFD", "NFC", "NFKD", "NFKC"].forEach((form) => {
      try {
        if ("test".normalize(form) !== "test") {
          throw new Error("bad normalize");
        }
        ;
      } catch (error) {
        missing.push(form);
      }
    });
    if (missing.length) {
      throw new Error("missing " + missing.join(", "));
    }
    if (String.fromCharCode(233).normalize("NFD") !== String.fromCharCode(101, 769)) {
      throw new Error("broken implementation");
    }
  } catch (error) {
    return error.message;
  }
  return null;
}
const _normalizeError = _checkNormalize();
var LogLevel;
(function(LogLevel2) {
  LogLevel2["DEBUG"] = "DEBUG";
  LogLevel2["INFO"] = "INFO";
  LogLevel2["WARNING"] = "WARNING";
  LogLevel2["ERROR"] = "ERROR";
  LogLevel2["OFF"] = "OFF";
})(LogLevel || (LogLevel = {}));
var ErrorCode;
(function(ErrorCode2) {
  ErrorCode2["UNKNOWN_ERROR"] = "UNKNOWN_ERROR";
  ErrorCode2["NOT_IMPLEMENTED"] = "NOT_IMPLEMENTED";
  ErrorCode2["UNSUPPORTED_OPERATION"] = "UNSUPPORTED_OPERATION";
  ErrorCode2["NETWORK_ERROR"] = "NETWORK_ERROR";
  ErrorCode2["SERVER_ERROR"] = "SERVER_ERROR";
  ErrorCode2["TIMEOUT"] = "TIMEOUT";
  ErrorCode2["BUFFER_OVERRUN"] = "BUFFER_OVERRUN";
  ErrorCode2["NUMERIC_FAULT"] = "NUMERIC_FAULT";
  ErrorCode2["MISSING_NEW"] = "MISSING_NEW";
  ErrorCode2["INVALID_ARGUMENT"] = "INVALID_ARGUMENT";
  ErrorCode2["MISSING_ARGUMENT"] = "MISSING_ARGUMENT";
  ErrorCode2["UNEXPECTED_ARGUMENT"] = "UNEXPECTED_ARGUMENT";
  ErrorCode2["CALL_EXCEPTION"] = "CALL_EXCEPTION";
  ErrorCode2["INSUFFICIENT_FUNDS"] = "INSUFFICIENT_FUNDS";
  ErrorCode2["NONCE_EXPIRED"] = "NONCE_EXPIRED";
  ErrorCode2["REPLACEMENT_UNDERPRICED"] = "REPLACEMENT_UNDERPRICED";
  ErrorCode2["UNPREDICTABLE_GAS_LIMIT"] = "UNPREDICTABLE_GAS_LIMIT";
  ErrorCode2["TRANSACTION_REPLACED"] = "TRANSACTION_REPLACED";
  ErrorCode2["ACTION_REJECTED"] = "ACTION_REJECTED";
})(ErrorCode || (ErrorCode = {}));
const HEX = "0123456789abcdef";
class Logger {
  constructor(version2) {
    Object.defineProperty(this, "version", {
      enumerable: true,
      value: version2,
      writable: false
    });
  }
  _log(logLevel, args) {
    const level = logLevel.toLowerCase();
    if (LogLevels[level] == null) {
      this.throwArgumentError("invalid log level name", "logLevel", logLevel);
    }
    if (_logLevel > LogLevels[level]) {
      return;
    }
    console.log.apply(console, args);
  }
  debug(...args) {
    this._log(Logger.levels.DEBUG, args);
  }
  info(...args) {
    this._log(Logger.levels.INFO, args);
  }
  warn(...args) {
    this._log(Logger.levels.WARNING, args);
  }
  makeError(message, code, params) {
    if (_censorErrors) {
      return this.makeError("censored error", code, {});
    }
    if (!code) {
      code = Logger.errors.UNKNOWN_ERROR;
    }
    if (!params) {
      params = {};
    }
    const messageDetails = [];
    Object.keys(params).forEach((key2) => {
      const value = params[key2];
      try {
        if (value instanceof Uint8Array) {
          let hex = "";
          for (let i = 0; i < value.length; i++) {
            hex += HEX[value[i] >> 4];
            hex += HEX[value[i] & 15];
          }
          messageDetails.push(key2 + "=Uint8Array(0x" + hex + ")");
        } else {
          messageDetails.push(key2 + "=" + JSON.stringify(value));
        }
      } catch (error2) {
        messageDetails.push(key2 + "=" + JSON.stringify(params[key2].toString()));
      }
    });
    messageDetails.push(`code=${code}`);
    messageDetails.push(`version=${this.version}`);
    const reason = message;
    let url = "";
    switch (code) {
      case ErrorCode.NUMERIC_FAULT: {
        url = "NUMERIC_FAULT";
        const fault = message;
        switch (fault) {
          case "overflow":
          case "underflow":
          case "division-by-zero":
            url += "-" + fault;
            break;
          case "negative-power":
          case "negative-width":
            url += "-unsupported";
            break;
          case "unbound-bitwise-result":
            url += "-unbound-result";
            break;
        }
        break;
      }
      case ErrorCode.CALL_EXCEPTION:
      case ErrorCode.INSUFFICIENT_FUNDS:
      case ErrorCode.MISSING_NEW:
      case ErrorCode.NONCE_EXPIRED:
      case ErrorCode.REPLACEMENT_UNDERPRICED:
      case ErrorCode.TRANSACTION_REPLACED:
      case ErrorCode.UNPREDICTABLE_GAS_LIMIT:
        url = code;
        break;
    }
    if (url) {
      message += " [ See: https://links.ethers.org/v5-errors-" + url + " ]";
    }
    if (messageDetails.length) {
      message += " (" + messageDetails.join(", ") + ")";
    }
    const error = new Error(message);
    error.reason = reason;
    error.code = code;
    Object.keys(params).forEach(function(key2) {
      error[key2] = params[key2];
    });
    return error;
  }
  throwError(message, code, params) {
    throw this.makeError(message, code, params);
  }
  throwArgumentError(message, name, value) {
    return this.throwError(message, Logger.errors.INVALID_ARGUMENT, {
      argument: name,
      value
    });
  }
  assert(condition, message, code, params) {
    if (!!condition) {
      return;
    }
    this.throwError(message, code, params);
  }
  assertArgument(condition, message, name, value) {
    if (!!condition) {
      return;
    }
    this.throwArgumentError(message, name, value);
  }
  checkNormalize(message) {
    if (_normalizeError) {
      this.throwError("platform missing String.prototype.normalize", Logger.errors.UNSUPPORTED_OPERATION, {
        operation: "String.prototype.normalize",
        form: _normalizeError
      });
    }
  }
  checkSafeUint53(value, message) {
    if (typeof value !== "number") {
      return;
    }
    if (message == null) {
      message = "value not safe";
    }
    if (value < 0 || value >= 9007199254740991) {
      this.throwError(message, Logger.errors.NUMERIC_FAULT, {
        operation: "checkSafeInteger",
        fault: "out-of-safe-range",
        value
      });
    }
    if (value % 1) {
      this.throwError(message, Logger.errors.NUMERIC_FAULT, {
        operation: "checkSafeInteger",
        fault: "non-integer",
        value
      });
    }
  }
  checkArgumentCount(count, expectedCount, message) {
    if (message) {
      message = ": " + message;
    } else {
      message = "";
    }
    if (count < expectedCount) {
      this.throwError("missing argument" + message, Logger.errors.MISSING_ARGUMENT, {
        count,
        expectedCount
      });
    }
    if (count > expectedCount) {
      this.throwError("too many arguments" + message, Logger.errors.UNEXPECTED_ARGUMENT, {
        count,
        expectedCount
      });
    }
  }
  checkNew(target, kind) {
    if (target === Object || target == null) {
      this.throwError("missing new", Logger.errors.MISSING_NEW, { name: kind.name });
    }
  }
  checkAbstract(target, kind) {
    if (target === kind) {
      this.throwError("cannot instantiate abstract class " + JSON.stringify(kind.name) + " directly; use a sub-class", Logger.errors.UNSUPPORTED_OPERATION, { name: target.name, operation: "new" });
    } else if (target === Object || target == null) {
      this.throwError("missing new", Logger.errors.MISSING_NEW, { name: kind.name });
    }
  }
  static globalLogger() {
    if (!_globalLogger) {
      _globalLogger = new Logger(version$4);
    }
    return _globalLogger;
  }
  static setCensorship(censorship, permanent) {
    if (!censorship && permanent) {
      this.globalLogger().throwError("cannot permanently disable censorship", Logger.errors.UNSUPPORTED_OPERATION, {
        operation: "setCensorship"
      });
    }
    if (_permanentCensorErrors) {
      if (!censorship) {
        return;
      }
      this.globalLogger().throwError("error censorship permanent", Logger.errors.UNSUPPORTED_OPERATION, {
        operation: "setCensorship"
      });
    }
    _censorErrors = !!censorship;
    _permanentCensorErrors = !!permanent;
  }
  static setLogLevel(logLevel) {
    const level = LogLevels[logLevel.toLowerCase()];
    if (level == null) {
      Logger.globalLogger().warn("invalid log level - " + logLevel);
      return;
    }
    _logLevel = level;
  }
  static from(version2) {
    return new Logger(version2);
  }
}
Logger.errors = ErrorCode;
Logger.levels = LogLevel;
const version$3 = "bytes/5.7.0";
const logger$3 = new Logger(version$3);
function isHexable(value) {
  return !!value.toHexString;
}
function addSlice(array) {
  if (array.slice) {
    return array;
  }
  array.slice = function() {
    const args = Array.prototype.slice.call(arguments);
    return addSlice(new Uint8Array(Array.prototype.slice.apply(array, args)));
  };
  return array;
}
function isBytesLike(value) {
  return isHexString(value) && !(value.length % 2) || isBytes(value);
}
function isInteger(value) {
  return typeof value === "number" && value == value && value % 1 === 0;
}
function isBytes(value) {
  if (value == null) {
    return false;
  }
  if (value.constructor === Uint8Array) {
    return true;
  }
  if (typeof value === "string") {
    return false;
  }
  if (!isInteger(value.length) || value.length < 0) {
    return false;
  }
  for (let i = 0; i < value.length; i++) {
    const v2 = value[i];
    if (!isInteger(v2) || v2 < 0 || v2 >= 256) {
      return false;
    }
  }
  return true;
}
function arrayify(value, options) {
  if (!options) {
    options = {};
  }
  if (typeof value === "number") {
    logger$3.checkSafeUint53(value, "invalid arrayify value");
    const result = [];
    while (value) {
      result.unshift(value & 255);
      value = parseInt(String(value / 256));
    }
    if (result.length === 0) {
      result.push(0);
    }
    return addSlice(new Uint8Array(result));
  }
  if (options.allowMissingPrefix && typeof value === "string" && value.substring(0, 2) !== "0x") {
    value = "0x" + value;
  }
  if (isHexable(value)) {
    value = value.toHexString();
  }
  if (isHexString(value)) {
    let hex = value.substring(2);
    if (hex.length % 2) {
      if (options.hexPad === "left") {
        hex = "0" + hex;
      } else if (options.hexPad === "right") {
        hex += "0";
      } else {
        logger$3.throwArgumentError("hex data is odd-length", "value", value);
      }
    }
    const result = [];
    for (let i = 0; i < hex.length; i += 2) {
      result.push(parseInt(hex.substring(i, i + 2), 16));
    }
    return addSlice(new Uint8Array(result));
  }
  if (isBytes(value)) {
    return addSlice(new Uint8Array(value));
  }
  return logger$3.throwArgumentError("invalid arrayify value", "value", value);
}
function concat(items) {
  const objects = items.map((item) => arrayify(item));
  const length = objects.reduce((accum, item) => accum + item.length, 0);
  const result = new Uint8Array(length);
  objects.reduce((offset, object) => {
    result.set(object, offset);
    return offset + object.length;
  }, 0);
  return addSlice(result);
}
function zeroPad(value, length) {
  value = arrayify(value);
  if (value.length > length) {
    logger$3.throwArgumentError("value out of range", "value", arguments[0]);
  }
  const result = new Uint8Array(length);
  result.set(value, length - value.length);
  return addSlice(result);
}
function isHexString(value, length) {
  if (typeof value !== "string" || !value.match(/^0x[0-9A-Fa-f]*$/)) {
    return false;
  }
  if (length && value.length !== 2 + 2 * length) {
    return false;
  }
  return true;
}
const HexCharacters = "0123456789abcdef";
function hexlify(value, options) {
  if (!options) {
    options = {};
  }
  if (typeof value === "number") {
    logger$3.checkSafeUint53(value, "invalid hexlify value");
    let hex = "";
    while (value) {
      hex = HexCharacters[value & 15] + hex;
      value = Math.floor(value / 16);
    }
    if (hex.length) {
      if (hex.length % 2) {
        hex = "0" + hex;
      }
      return "0x" + hex;
    }
    return "0x00";
  }
  if (typeof value === "bigint") {
    value = value.toString(16);
    if (value.length % 2) {
      return "0x0" + value;
    }
    return "0x" + value;
  }
  if (options.allowMissingPrefix && typeof value === "string" && value.substring(0, 2) !== "0x") {
    value = "0x" + value;
  }
  if (isHexable(value)) {
    return value.toHexString();
  }
  if (isHexString(value)) {
    if (value.length % 2) {
      if (options.hexPad === "left") {
        value = "0x0" + value.substring(2);
      } else if (options.hexPad === "right") {
        value += "0";
      } else {
        logger$3.throwArgumentError("hex data is odd-length", "value", value);
      }
    }
    return value.toLowerCase();
  }
  if (isBytes(value)) {
    let result = "0x";
    for (let i = 0; i < value.length; i++) {
      let v2 = value[i];
      result += HexCharacters[(v2 & 240) >> 4] + HexCharacters[v2 & 15];
    }
    return result;
  }
  return logger$3.throwArgumentError("invalid hexlify value", "value", value);
}
function hexDataLength(data) {
  if (typeof data !== "string") {
    data = hexlify(data);
  } else if (!isHexString(data) || data.length % 2) {
    return null;
  }
  return (data.length - 2) / 2;
}
function hexDataSlice(data, offset, endOffset) {
  if (typeof data !== "string") {
    data = hexlify(data);
  } else if (!isHexString(data) || data.length % 2) {
    logger$3.throwArgumentError("invalid hexData", "value", data);
  }
  offset = 2 + 2 * offset;
  if (endOffset != null) {
    return "0x" + data.substring(offset, 2 + 2 * endOffset);
  }
  return "0x" + data.substring(offset);
}
function hexZeroPad(value, length) {
  if (typeof value !== "string") {
    value = hexlify(value);
  } else if (!isHexString(value)) {
    logger$3.throwArgumentError("invalid hex string", "value", value);
  }
  if (value.length > 2 * length + 2) {
    logger$3.throwArgumentError("value out of range", "value", arguments[1]);
  }
  while (value.length < 2 * length + 2) {
    value = "0x0" + value.substring(2);
  }
  return value;
}
function splitSignature(signature2) {
  const result = {
    r: "0x",
    s: "0x",
    _vs: "0x",
    recoveryParam: 0,
    v: 0,
    yParityAndS: "0x",
    compact: "0x"
  };
  if (isBytesLike(signature2)) {
    let bytes = arrayify(signature2);
    if (bytes.length === 64) {
      result.v = 27 + (bytes[32] >> 7);
      bytes[32] &= 127;
      result.r = hexlify(bytes.slice(0, 32));
      result.s = hexlify(bytes.slice(32, 64));
    } else if (bytes.length === 65) {
      result.r = hexlify(bytes.slice(0, 32));
      result.s = hexlify(bytes.slice(32, 64));
      result.v = bytes[64];
    } else {
      logger$3.throwArgumentError("invalid signature string", "signature", signature2);
    }
    if (result.v < 27) {
      if (result.v === 0 || result.v === 1) {
        result.v += 27;
      } else {
        logger$3.throwArgumentError("signature invalid v byte", "signature", signature2);
      }
    }
    result.recoveryParam = 1 - result.v % 2;
    if (result.recoveryParam) {
      bytes[32] |= 128;
    }
    result._vs = hexlify(bytes.slice(32, 64));
  } else {
    result.r = signature2.r;
    result.s = signature2.s;
    result.v = signature2.v;
    result.recoveryParam = signature2.recoveryParam;
    result._vs = signature2._vs;
    if (result._vs != null) {
      const vs2 = zeroPad(arrayify(result._vs), 32);
      result._vs = hexlify(vs2);
      const recoveryParam = vs2[0] >= 128 ? 1 : 0;
      if (result.recoveryParam == null) {
        result.recoveryParam = recoveryParam;
      } else if (result.recoveryParam !== recoveryParam) {
        logger$3.throwArgumentError("signature recoveryParam mismatch _vs", "signature", signature2);
      }
      vs2[0] &= 127;
      const s2 = hexlify(vs2);
      if (result.s == null) {
        result.s = s2;
      } else if (result.s !== s2) {
        logger$3.throwArgumentError("signature v mismatch _vs", "signature", signature2);
      }
    }
    if (result.recoveryParam == null) {
      if (result.v == null) {
        logger$3.throwArgumentError("signature missing v and recoveryParam", "signature", signature2);
      } else if (result.v === 0 || result.v === 1) {
        result.recoveryParam = result.v;
      } else {
        result.recoveryParam = 1 - result.v % 2;
      }
    } else {
      if (result.v == null) {
        result.v = 27 + result.recoveryParam;
      } else {
        const recId = result.v === 0 || result.v === 1 ? result.v : 1 - result.v % 2;
        if (result.recoveryParam !== recId) {
          logger$3.throwArgumentError("signature recoveryParam mismatch v", "signature", signature2);
        }
      }
    }
    if (result.r == null || !isHexString(result.r)) {
      logger$3.throwArgumentError("signature missing or invalid r", "signature", signature2);
    } else {
      result.r = hexZeroPad(result.r, 32);
    }
    if (result.s == null || !isHexString(result.s)) {
      logger$3.throwArgumentError("signature missing or invalid s", "signature", signature2);
    } else {
      result.s = hexZeroPad(result.s, 32);
    }
    const vs = arrayify(result.s);
    if (vs[0] >= 128) {
      logger$3.throwArgumentError("signature s out of range", "signature", signature2);
    }
    if (result.recoveryParam) {
      vs[0] |= 128;
    }
    const _vs = hexlify(vs);
    if (result._vs) {
      if (!isHexString(result._vs)) {
        logger$3.throwArgumentError("signature invalid _vs", "signature", signature2);
      }
      result._vs = hexZeroPad(result._vs, 32);
    }
    if (result._vs == null) {
      result._vs = _vs;
    } else if (result._vs !== _vs) {
      logger$3.throwArgumentError("signature _vs mismatch v and s", "signature", signature2);
    }
  }
  result.yParityAndS = result._vs;
  result.compact = result.r + result.yParityAndS.substring(2);
  return result;
}
function keccak256(data) {
  return "0x" + sha3.keccak_256(arrayify(data));
}
var bn = { exports: {} };
bn.exports;
(function(module) {
  (function(module2, exports) {
    function assert2(val, msg) {
      if (!val)
        throw new Error(msg || "Assertion failed");
    }
    function inherits2(ctor, superCtor) {
      ctor.super_ = superCtor;
      var TempCtor = function() {
      };
      TempCtor.prototype = superCtor.prototype;
      ctor.prototype = new TempCtor();
      ctor.prototype.constructor = ctor;
    }
    function BN2(number, base2, endian) {
      if (BN2.isBN(number)) {
        return number;
      }
      this.negative = 0;
      this.words = null;
      this.length = 0;
      this.red = null;
      if (number !== null) {
        if (base2 === "le" || base2 === "be") {
          endian = base2;
          base2 = 10;
        }
        this._init(number || 0, base2 || 10, endian || "be");
      }
    }
    if (typeof module2 === "object") {
      module2.exports = BN2;
    } else {
      exports.BN = BN2;
    }
    BN2.BN = BN2;
    BN2.wordSize = 26;
    var Buffer;
    try {
      if (typeof window !== "undefined" && typeof window.Buffer !== "undefined") {
        Buffer = window.Buffer;
      } else {
        Buffer = require$$0$1.Buffer;
      }
    } catch (e) {
    }
    BN2.isBN = function isBN(num) {
      if (num instanceof BN2) {
        return true;
      }
      return num !== null && typeof num === "object" && num.constructor.wordSize === BN2.wordSize && Array.isArray(num.words);
    };
    BN2.max = function max(left, right) {
      if (left.cmp(right) > 0)
        return left;
      return right;
    };
    BN2.min = function min(left, right) {
      if (left.cmp(right) < 0)
        return left;
      return right;
    };
    BN2.prototype._init = function init3(number, base2, endian) {
      if (typeof number === "number") {
        return this._initNumber(number, base2, endian);
      }
      if (typeof number === "object") {
        return this._initArray(number, base2, endian);
      }
      if (base2 === "hex") {
        base2 = 16;
      }
      assert2(base2 === (base2 | 0) && base2 >= 2 && base2 <= 36);
      number = number.toString().replace(/\s+/g, "");
      var start = 0;
      if (number[0] === "-") {
        start++;
        this.negative = 1;
      }
      if (start < number.length) {
        if (base2 === 16) {
          this._parseHex(number, start, endian);
        } else {
          this._parseBase(number, base2, start);
          if (endian === "le") {
            this._initArray(this.toArray(), base2, endian);
          }
        }
      }
    };
    BN2.prototype._initNumber = function _initNumber(number, base2, endian) {
      if (number < 0) {
        this.negative = 1;
        number = -number;
      }
      if (number < 67108864) {
        this.words = [number & 67108863];
        this.length = 1;
      } else if (number < 4503599627370496) {
        this.words = [
          number & 67108863,
          number / 67108864 & 67108863
        ];
        this.length = 2;
      } else {
        assert2(number < 9007199254740992);
        this.words = [
          number & 67108863,
          number / 67108864 & 67108863,
          1
        ];
        this.length = 3;
      }
      if (endian !== "le")
        return;
      this._initArray(this.toArray(), base2, endian);
    };
    BN2.prototype._initArray = function _initArray(number, base2, endian) {
      assert2(typeof number.length === "number");
      if (number.length <= 0) {
        this.words = [0];
        this.length = 1;
        return this;
      }
      this.length = Math.ceil(number.length / 3);
      this.words = new Array(this.length);
      for (var i = 0; i < this.length; i++) {
        this.words[i] = 0;
      }
      var j2, w2;
      var off = 0;
      if (endian === "be") {
        for (i = number.length - 1, j2 = 0; i >= 0; i -= 3) {
          w2 = number[i] | number[i - 1] << 8 | number[i - 2] << 16;
          this.words[j2] |= w2 << off & 67108863;
          this.words[j2 + 1] = w2 >>> 26 - off & 67108863;
          off += 24;
          if (off >= 26) {
            off -= 26;
            j2++;
          }
        }
      } else if (endian === "le") {
        for (i = 0, j2 = 0; i < number.length; i += 3) {
          w2 = number[i] | number[i + 1] << 8 | number[i + 2] << 16;
          this.words[j2] |= w2 << off & 67108863;
          this.words[j2 + 1] = w2 >>> 26 - off & 67108863;
          off += 24;
          if (off >= 26) {
            off -= 26;
            j2++;
          }
        }
      }
      return this._strip();
    };
    function parseHex4Bits(string, index) {
      var c = string.charCodeAt(index);
      if (c >= 48 && c <= 57) {
        return c - 48;
      } else if (c >= 65 && c <= 70) {
        return c - 55;
      } else if (c >= 97 && c <= 102) {
        return c - 87;
      } else {
        assert2(false, "Invalid character in " + string);
      }
    }
    function parseHexByte(string, lowerBound, index) {
      var r2 = parseHex4Bits(string, index);
      if (index - 1 >= lowerBound) {
        r2 |= parseHex4Bits(string, index - 1) << 4;
      }
      return r2;
    }
    BN2.prototype._parseHex = function _parseHex(number, start, endian) {
      this.length = Math.ceil((number.length - start) / 6);
      this.words = new Array(this.length);
      for (var i = 0; i < this.length; i++) {
        this.words[i] = 0;
      }
      var off = 0;
      var j2 = 0;
      var w2;
      if (endian === "be") {
        for (i = number.length - 1; i >= start; i -= 2) {
          w2 = parseHexByte(number, start, i) << off;
          this.words[j2] |= w2 & 67108863;
          if (off >= 18) {
            off -= 18;
            j2 += 1;
            this.words[j2] |= w2 >>> 26;
          } else {
            off += 8;
          }
        }
      } else {
        var parseLength = number.length - start;
        for (i = parseLength % 2 === 0 ? start + 1 : start; i < number.length; i += 2) {
          w2 = parseHexByte(number, start, i) << off;
          this.words[j2] |= w2 & 67108863;
          if (off >= 18) {
            off -= 18;
            j2 += 1;
            this.words[j2] |= w2 >>> 26;
          } else {
            off += 8;
          }
        }
      }
      this._strip();
    };
    function parseBase(str, start, end, mul3) {
      var r2 = 0;
      var b2 = 0;
      var len = Math.min(str.length, end);
      for (var i = start; i < len; i++) {
        var c = str.charCodeAt(i) - 48;
        r2 *= mul3;
        if (c >= 49) {
          b2 = c - 49 + 10;
        } else if (c >= 17) {
          b2 = c - 17 + 10;
        } else {
          b2 = c;
        }
        assert2(c >= 0 && b2 < mul3, "Invalid character");
        r2 += b2;
      }
      return r2;
    }
    BN2.prototype._parseBase = function _parseBase(number, base2, start) {
      this.words = [0];
      this.length = 1;
      for (var limbLen = 0, limbPow = 1; limbPow <= 67108863; limbPow *= base2) {
        limbLen++;
      }
      limbLen--;
      limbPow = limbPow / base2 | 0;
      var total = number.length - start;
      var mod = total % limbLen;
      var end = Math.min(total, total - mod) + start;
      var word = 0;
      for (var i = start; i < end; i += limbLen) {
        word = parseBase(number, i, i + limbLen, base2);
        this.imuln(limbPow);
        if (this.words[0] + word < 67108864) {
          this.words[0] += word;
        } else {
          this._iaddn(word);
        }
      }
      if (mod !== 0) {
        var pow = 1;
        word = parseBase(number, i, number.length, base2);
        for (i = 0; i < mod; i++) {
          pow *= base2;
        }
        this.imuln(pow);
        if (this.words[0] + word < 67108864) {
          this.words[0] += word;
        } else {
          this._iaddn(word);
        }
      }
      this._strip();
    };
    BN2.prototype.copy = function copy(dest) {
      dest.words = new Array(this.length);
      for (var i = 0; i < this.length; i++) {
        dest.words[i] = this.words[i];
      }
      dest.length = this.length;
      dest.negative = this.negative;
      dest.red = this.red;
    };
    function move(dest, src) {
      dest.words = src.words;
      dest.length = src.length;
      dest.negative = src.negative;
      dest.red = src.red;
    }
    BN2.prototype._move = function _move(dest) {
      move(dest, this);
    };
    BN2.prototype.clone = function clone() {
      var r2 = new BN2(null);
      this.copy(r2);
      return r2;
    };
    BN2.prototype._expand = function _expand(size) {
      while (this.length < size) {
        this.words[this.length++] = 0;
      }
      return this;
    };
    BN2.prototype._strip = function strip() {
      while (this.length > 1 && this.words[this.length - 1] === 0) {
        this.length--;
      }
      return this._normSign();
    };
    BN2.prototype._normSign = function _normSign() {
      if (this.length === 1 && this.words[0] === 0) {
        this.negative = 0;
      }
      return this;
    };
    if (typeof Symbol !== "undefined" && typeof Symbol.for === "function") {
      try {
        BN2.prototype[Symbol.for("nodejs.util.inspect.custom")] = inspect4;
      } catch (e) {
        BN2.prototype.inspect = inspect4;
      }
    } else {
      BN2.prototype.inspect = inspect4;
    }
    function inspect4() {
      return (this.red ? "<BN-R: " : "<BN: ") + this.toString(16) + ">";
    }
    var zeros = [
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
    ];
    var groupSizes = [
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
    ];
    var groupBases = [
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
    BN2.prototype.toString = function toString(base2, padding) {
      base2 = base2 || 10;
      padding = padding | 0 || 1;
      var out;
      if (base2 === 16 || base2 === "hex") {
        out = "";
        var off = 0;
        var carry = 0;
        for (var i = 0; i < this.length; i++) {
          var w2 = this.words[i];
          var word = ((w2 << off | carry) & 16777215).toString(16);
          carry = w2 >>> 24 - off & 16777215;
          off += 2;
          if (off >= 26) {
            off -= 26;
            i--;
          }
          if (carry !== 0 || i !== this.length - 1) {
            out = zeros[6 - word.length] + word + out;
          } else {
            out = word + out;
          }
        }
        if (carry !== 0) {
          out = carry.toString(16) + out;
        }
        while (out.length % padding !== 0) {
          out = "0" + out;
        }
        if (this.negative !== 0) {
          out = "-" + out;
        }
        return out;
      }
      if (base2 === (base2 | 0) && base2 >= 2 && base2 <= 36) {
        var groupSize = groupSizes[base2];
        var groupBase = groupBases[base2];
        out = "";
        var c = this.clone();
        c.negative = 0;
        while (!c.isZero()) {
          var r2 = c.modrn(groupBase).toString(base2);
          c = c.idivn(groupBase);
          if (!c.isZero()) {
            out = zeros[groupSize - r2.length] + r2 + out;
          } else {
            out = r2 + out;
          }
        }
        if (this.isZero()) {
          out = "0" + out;
        }
        while (out.length % padding !== 0) {
          out = "0" + out;
        }
        if (this.negative !== 0) {
          out = "-" + out;
        }
        return out;
      }
      assert2(false, "Base should be between 2 and 36");
    };
    BN2.prototype.toNumber = function toNumber() {
      var ret = this.words[0];
      if (this.length === 2) {
        ret += this.words[1] * 67108864;
      } else if (this.length === 3 && this.words[2] === 1) {
        ret += 4503599627370496 + this.words[1] * 67108864;
      } else if (this.length > 2) {
        assert2(false, "Number can only safely store up to 53 bits");
      }
      return this.negative !== 0 ? -ret : ret;
    };
    BN2.prototype.toJSON = function toJSON2() {
      return this.toString(16, 2);
    };
    if (Buffer) {
      BN2.prototype.toBuffer = function toBuffer(endian, length) {
        return this.toArrayLike(Buffer, endian, length);
      };
    }
    BN2.prototype.toArray = function toArray2(endian, length) {
      return this.toArrayLike(Array, endian, length);
    };
    var allocate = function allocate2(ArrayType, size) {
      if (ArrayType.allocUnsafe) {
        return ArrayType.allocUnsafe(size);
      }
      return new ArrayType(size);
    };
    BN2.prototype.toArrayLike = function toArrayLike(ArrayType, endian, length) {
      this._strip();
      var byteLength = this.byteLength();
      var reqLength = length || Math.max(1, byteLength);
      assert2(byteLength <= reqLength, "byte array longer than desired length");
      assert2(reqLength > 0, "Requested array length <= 0");
      var res = allocate(ArrayType, reqLength);
      var postfix = endian === "le" ? "LE" : "BE";
      this["_toArrayLike" + postfix](res, byteLength);
      return res;
    };
    BN2.prototype._toArrayLikeLE = function _toArrayLikeLE(res, byteLength) {
      var position = 0;
      var carry = 0;
      for (var i = 0, shift = 0; i < this.length; i++) {
        var word = this.words[i] << shift | carry;
        res[position++] = word & 255;
        if (position < res.length) {
          res[position++] = word >> 8 & 255;
        }
        if (position < res.length) {
          res[position++] = word >> 16 & 255;
        }
        if (shift === 6) {
          if (position < res.length) {
            res[position++] = word >> 24 & 255;
          }
          carry = 0;
          shift = 0;
        } else {
          carry = word >>> 24;
          shift += 2;
        }
      }
      if (position < res.length) {
        res[position++] = carry;
        while (position < res.length) {
          res[position++] = 0;
        }
      }
    };
    BN2.prototype._toArrayLikeBE = function _toArrayLikeBE(res, byteLength) {
      var position = res.length - 1;
      var carry = 0;
      for (var i = 0, shift = 0; i < this.length; i++) {
        var word = this.words[i] << shift | carry;
        res[position--] = word & 255;
        if (position >= 0) {
          res[position--] = word >> 8 & 255;
        }
        if (position >= 0) {
          res[position--] = word >> 16 & 255;
        }
        if (shift === 6) {
          if (position >= 0) {
            res[position--] = word >> 24 & 255;
          }
          carry = 0;
          shift = 0;
        } else {
          carry = word >>> 24;
          shift += 2;
        }
      }
      if (position >= 0) {
        res[position--] = carry;
        while (position >= 0) {
          res[position--] = 0;
        }
      }
    };
    if (Math.clz32) {
      BN2.prototype._countBits = function _countBits(w2) {
        return 32 - Math.clz32(w2);
      };
    } else {
      BN2.prototype._countBits = function _countBits(w2) {
        var t = w2;
        var r2 = 0;
        if (t >= 4096) {
          r2 += 13;
          t >>>= 13;
        }
        if (t >= 64) {
          r2 += 7;
          t >>>= 7;
        }
        if (t >= 8) {
          r2 += 4;
          t >>>= 4;
        }
        if (t >= 2) {
          r2 += 2;
          t >>>= 2;
        }
        return r2 + t;
      };
    }
    BN2.prototype._zeroBits = function _zeroBits(w2) {
      if (w2 === 0)
        return 26;
      var t = w2;
      var r2 = 0;
      if ((t & 8191) === 0) {
        r2 += 13;
        t >>>= 13;
      }
      if ((t & 127) === 0) {
        r2 += 7;
        t >>>= 7;
      }
      if ((t & 15) === 0) {
        r2 += 4;
        t >>>= 4;
      }
      if ((t & 3) === 0) {
        r2 += 2;
        t >>>= 2;
      }
      if ((t & 1) === 0) {
        r2++;
      }
      return r2;
    };
    BN2.prototype.bitLength = function bitLength() {
      var w2 = this.words[this.length - 1];
      var hi = this._countBits(w2);
      return (this.length - 1) * 26 + hi;
    };
    function toBitArray(num) {
      var w2 = new Array(num.bitLength());
      for (var bit = 0; bit < w2.length; bit++) {
        var off = bit / 26 | 0;
        var wbit = bit % 26;
        w2[bit] = num.words[off] >>> wbit & 1;
      }
      return w2;
    }
    BN2.prototype.zeroBits = function zeroBits() {
      if (this.isZero())
        return 0;
      var r2 = 0;
      for (var i = 0; i < this.length; i++) {
        var b2 = this._zeroBits(this.words[i]);
        r2 += b2;
        if (b2 !== 26)
          break;
      }
      return r2;
    };
    BN2.prototype.byteLength = function byteLength() {
      return Math.ceil(this.bitLength() / 8);
    };
    BN2.prototype.toTwos = function toTwos(width) {
      if (this.negative !== 0) {
        return this.abs().inotn(width).iaddn(1);
      }
      return this.clone();
    };
    BN2.prototype.fromTwos = function fromTwos(width) {
      if (this.testn(width - 1)) {
        return this.notn(width).iaddn(1).ineg();
      }
      return this.clone();
    };
    BN2.prototype.isNeg = function isNeg() {
      return this.negative !== 0;
    };
    BN2.prototype.neg = function neg3() {
      return this.clone().ineg();
    };
    BN2.prototype.ineg = function ineg() {
      if (!this.isZero()) {
        this.negative ^= 1;
      }
      return this;
    };
    BN2.prototype.iuor = function iuor(num) {
      while (this.length < num.length) {
        this.words[this.length++] = 0;
      }
      for (var i = 0; i < num.length; i++) {
        this.words[i] = this.words[i] | num.words[i];
      }
      return this._strip();
    };
    BN2.prototype.ior = function ior(num) {
      assert2((this.negative | num.negative) === 0);
      return this.iuor(num);
    };
    BN2.prototype.or = function or2(num) {
      if (this.length > num.length)
        return this.clone().ior(num);
      return num.clone().ior(this);
    };
    BN2.prototype.uor = function uor(num) {
      if (this.length > num.length)
        return this.clone().iuor(num);
      return num.clone().iuor(this);
    };
    BN2.prototype.iuand = function iuand(num) {
      var b2;
      if (this.length > num.length) {
        b2 = num;
      } else {
        b2 = this;
      }
      for (var i = 0; i < b2.length; i++) {
        this.words[i] = this.words[i] & num.words[i];
      }
      this.length = b2.length;
      return this._strip();
    };
    BN2.prototype.iand = function iand(num) {
      assert2((this.negative | num.negative) === 0);
      return this.iuand(num);
    };
    BN2.prototype.and = function and(num) {
      if (this.length > num.length)
        return this.clone().iand(num);
      return num.clone().iand(this);
    };
    BN2.prototype.uand = function uand(num) {
      if (this.length > num.length)
        return this.clone().iuand(num);
      return num.clone().iuand(this);
    };
    BN2.prototype.iuxor = function iuxor(num) {
      var a;
      var b2;
      if (this.length > num.length) {
        a = this;
        b2 = num;
      } else {
        a = num;
        b2 = this;
      }
      for (var i = 0; i < b2.length; i++) {
        this.words[i] = a.words[i] ^ b2.words[i];
      }
      if (this !== a) {
        for (; i < a.length; i++) {
          this.words[i] = a.words[i];
        }
      }
      this.length = a.length;
      return this._strip();
    };
    BN2.prototype.ixor = function ixor(num) {
      assert2((this.negative | num.negative) === 0);
      return this.iuxor(num);
    };
    BN2.prototype.xor = function xor(num) {
      if (this.length > num.length)
        return this.clone().ixor(num);
      return num.clone().ixor(this);
    };
    BN2.prototype.uxor = function uxor(num) {
      if (this.length > num.length)
        return this.clone().iuxor(num);
      return num.clone().iuxor(this);
    };
    BN2.prototype.inotn = function inotn(width) {
      assert2(typeof width === "number" && width >= 0);
      var bytesNeeded = Math.ceil(width / 26) | 0;
      var bitsLeft = width % 26;
      this._expand(bytesNeeded);
      if (bitsLeft > 0) {
        bytesNeeded--;
      }
      for (var i = 0; i < bytesNeeded; i++) {
        this.words[i] = ~this.words[i] & 67108863;
      }
      if (bitsLeft > 0) {
        this.words[i] = ~this.words[i] & 67108863 >> 26 - bitsLeft;
      }
      return this._strip();
    };
    BN2.prototype.notn = function notn(width) {
      return this.clone().inotn(width);
    };
    BN2.prototype.setn = function setn(bit, val) {
      assert2(typeof bit === "number" && bit >= 0);
      var off = bit / 26 | 0;
      var wbit = bit % 26;
      this._expand(off + 1);
      if (val) {
        this.words[off] = this.words[off] | 1 << wbit;
      } else {
        this.words[off] = this.words[off] & ~(1 << wbit);
      }
      return this._strip();
    };
    BN2.prototype.iadd = function iadd(num) {
      var r2;
      if (this.negative !== 0 && num.negative === 0) {
        this.negative = 0;
        r2 = this.isub(num);
        this.negative ^= 1;
        return this._normSign();
      } else if (this.negative === 0 && num.negative !== 0) {
        num.negative = 0;
        r2 = this.isub(num);
        num.negative = 1;
        return r2._normSign();
      }
      var a, b2;
      if (this.length > num.length) {
        a = this;
        b2 = num;
      } else {
        a = num;
        b2 = this;
      }
      var carry = 0;
      for (var i = 0; i < b2.length; i++) {
        r2 = (a.words[i] | 0) + (b2.words[i] | 0) + carry;
        this.words[i] = r2 & 67108863;
        carry = r2 >>> 26;
      }
      for (; carry !== 0 && i < a.length; i++) {
        r2 = (a.words[i] | 0) + carry;
        this.words[i] = r2 & 67108863;
        carry = r2 >>> 26;
      }
      this.length = a.length;
      if (carry !== 0) {
        this.words[this.length] = carry;
        this.length++;
      } else if (a !== this) {
        for (; i < a.length; i++) {
          this.words[i] = a.words[i];
        }
      }
      return this;
    };
    BN2.prototype.add = function add3(num) {
      var res;
      if (num.negative !== 0 && this.negative === 0) {
        num.negative = 0;
        res = this.sub(num);
        num.negative ^= 1;
        return res;
      } else if (num.negative === 0 && this.negative !== 0) {
        this.negative = 0;
        res = num.sub(this);
        this.negative = 1;
        return res;
      }
      if (this.length > num.length)
        return this.clone().iadd(num);
      return num.clone().iadd(this);
    };
    BN2.prototype.isub = function isub(num) {
      if (num.negative !== 0) {
        num.negative = 0;
        var r2 = this.iadd(num);
        num.negative = 1;
        return r2._normSign();
      } else if (this.negative !== 0) {
        this.negative = 0;
        this.iadd(num);
        this.negative = 1;
        return this._normSign();
      }
      var cmp = this.cmp(num);
      if (cmp === 0) {
        this.negative = 0;
        this.length = 1;
        this.words[0] = 0;
        return this;
      }
      var a, b2;
      if (cmp > 0) {
        a = this;
        b2 = num;
      } else {
        a = num;
        b2 = this;
      }
      var carry = 0;
      for (var i = 0; i < b2.length; i++) {
        r2 = (a.words[i] | 0) - (b2.words[i] | 0) + carry;
        carry = r2 >> 26;
        this.words[i] = r2 & 67108863;
      }
      for (; carry !== 0 && i < a.length; i++) {
        r2 = (a.words[i] | 0) + carry;
        carry = r2 >> 26;
        this.words[i] = r2 & 67108863;
      }
      if (carry === 0 && i < a.length && a !== this) {
        for (; i < a.length; i++) {
          this.words[i] = a.words[i];
        }
      }
      this.length = Math.max(this.length, i);
      if (a !== this) {
        this.negative = 1;
      }
      return this._strip();
    };
    BN2.prototype.sub = function sub(num) {
      return this.clone().isub(num);
    };
    function smallMulTo(self2, num, out) {
      out.negative = num.negative ^ self2.negative;
      var len = self2.length + num.length | 0;
      out.length = len;
      len = len - 1 | 0;
      var a = self2.words[0] | 0;
      var b2 = num.words[0] | 0;
      var r2 = a * b2;
      var lo = r2 & 67108863;
      var carry = r2 / 67108864 | 0;
      out.words[0] = lo;
      for (var k2 = 1; k2 < len; k2++) {
        var ncarry = carry >>> 26;
        var rword = carry & 67108863;
        var maxJ = Math.min(k2, num.length - 1);
        for (var j2 = Math.max(0, k2 - self2.length + 1); j2 <= maxJ; j2++) {
          var i = k2 - j2 | 0;
          a = self2.words[i] | 0;
          b2 = num.words[j2] | 0;
          r2 = a * b2 + rword;
          ncarry += r2 / 67108864 | 0;
          rword = r2 & 67108863;
        }
        out.words[k2] = rword | 0;
        carry = ncarry | 0;
      }
      if (carry !== 0) {
        out.words[k2] = carry | 0;
      } else {
        out.length--;
      }
      return out._strip();
    }
    var comb10MulTo = function comb10MulTo2(self2, num, out) {
      var a = self2.words;
      var b2 = num.words;
      var o2 = out.words;
      var c = 0;
      var lo;
      var mid;
      var hi;
      var a0 = a[0] | 0;
      var al0 = a0 & 8191;
      var ah0 = a0 >>> 13;
      var a1 = a[1] | 0;
      var al1 = a1 & 8191;
      var ah1 = a1 >>> 13;
      var a2 = a[2] | 0;
      var al2 = a2 & 8191;
      var ah2 = a2 >>> 13;
      var a3 = a[3] | 0;
      var al3 = a3 & 8191;
      var ah3 = a3 >>> 13;
      var a4 = a[4] | 0;
      var al4 = a4 & 8191;
      var ah4 = a4 >>> 13;
      var a5 = a[5] | 0;
      var al5 = a5 & 8191;
      var ah5 = a5 >>> 13;
      var a6 = a[6] | 0;
      var al6 = a6 & 8191;
      var ah6 = a6 >>> 13;
      var a7 = a[7] | 0;
      var al7 = a7 & 8191;
      var ah7 = a7 >>> 13;
      var a8 = a[8] | 0;
      var al8 = a8 & 8191;
      var ah8 = a8 >>> 13;
      var a9 = a[9] | 0;
      var al9 = a9 & 8191;
      var ah9 = a9 >>> 13;
      var b0 = b2[0] | 0;
      var bl0 = b0 & 8191;
      var bh0 = b0 >>> 13;
      var b1 = b2[1] | 0;
      var bl1 = b1 & 8191;
      var bh1 = b1 >>> 13;
      var b22 = b2[2] | 0;
      var bl2 = b22 & 8191;
      var bh2 = b22 >>> 13;
      var b3 = b2[3] | 0;
      var bl3 = b3 & 8191;
      var bh3 = b3 >>> 13;
      var b4 = b2[4] | 0;
      var bl4 = b4 & 8191;
      var bh4 = b4 >>> 13;
      var b5 = b2[5] | 0;
      var bl5 = b5 & 8191;
      var bh5 = b5 >>> 13;
      var b6 = b2[6] | 0;
      var bl6 = b6 & 8191;
      var bh6 = b6 >>> 13;
      var b7 = b2[7] | 0;
      var bl7 = b7 & 8191;
      var bh7 = b7 >>> 13;
      var b8 = b2[8] | 0;
      var bl8 = b8 & 8191;
      var bh8 = b8 >>> 13;
      var b9 = b2[9] | 0;
      var bl9 = b9 & 8191;
      var bh9 = b9 >>> 13;
      out.negative = self2.negative ^ num.negative;
      out.length = 19;
      lo = Math.imul(al0, bl0);
      mid = Math.imul(al0, bh0);
      mid = mid + Math.imul(ah0, bl0) | 0;
      hi = Math.imul(ah0, bh0);
      var w0 = (c + lo | 0) + ((mid & 8191) << 13) | 0;
      c = (hi + (mid >>> 13) | 0) + (w0 >>> 26) | 0;
      w0 &= 67108863;
      lo = Math.imul(al1, bl0);
      mid = Math.imul(al1, bh0);
      mid = mid + Math.imul(ah1, bl0) | 0;
      hi = Math.imul(ah1, bh0);
      lo = lo + Math.imul(al0, bl1) | 0;
      mid = mid + Math.imul(al0, bh1) | 0;
      mid = mid + Math.imul(ah0, bl1) | 0;
      hi = hi + Math.imul(ah0, bh1) | 0;
      var w1 = (c + lo | 0) + ((mid & 8191) << 13) | 0;
      c = (hi + (mid >>> 13) | 0) + (w1 >>> 26) | 0;
      w1 &= 67108863;
      lo = Math.imul(al2, bl0);
      mid = Math.imul(al2, bh0);
      mid = mid + Math.imul(ah2, bl0) | 0;
      hi = Math.imul(ah2, bh0);
      lo = lo + Math.imul(al1, bl1) | 0;
      mid = mid + Math.imul(al1, bh1) | 0;
      mid = mid + Math.imul(ah1, bl1) | 0;
      hi = hi + Math.imul(ah1, bh1) | 0;
      lo = lo + Math.imul(al0, bl2) | 0;
      mid = mid + Math.imul(al0, bh2) | 0;
      mid = mid + Math.imul(ah0, bl2) | 0;
      hi = hi + Math.imul(ah0, bh2) | 0;
      var w2 = (c + lo | 0) + ((mid & 8191) << 13) | 0;
      c = (hi + (mid >>> 13) | 0) + (w2 >>> 26) | 0;
      w2 &= 67108863;
      lo = Math.imul(al3, bl0);
      mid = Math.imul(al3, bh0);
      mid = mid + Math.imul(ah3, bl0) | 0;
      hi = Math.imul(ah3, bh0);
      lo = lo + Math.imul(al2, bl1) | 0;
      mid = mid + Math.imul(al2, bh1) | 0;
      mid = mid + Math.imul(ah2, bl1) | 0;
      hi = hi + Math.imul(ah2, bh1) | 0;
      lo = lo + Math.imul(al1, bl2) | 0;
      mid = mid + Math.imul(al1, bh2) | 0;
      mid = mid + Math.imul(ah1, bl2) | 0;
      hi = hi + Math.imul(ah1, bh2) | 0;
      lo = lo + Math.imul(al0, bl3) | 0;
      mid = mid + Math.imul(al0, bh3) | 0;
      mid = mid + Math.imul(ah0, bl3) | 0;
      hi = hi + Math.imul(ah0, bh3) | 0;
      var w3 = (c + lo | 0) + ((mid & 8191) << 13) | 0;
      c = (hi + (mid >>> 13) | 0) + (w3 >>> 26) | 0;
      w3 &= 67108863;
      lo = Math.imul(al4, bl0);
      mid = Math.imul(al4, bh0);
      mid = mid + Math.imul(ah4, bl0) | 0;
      hi = Math.imul(ah4, bh0);
      lo = lo + Math.imul(al3, bl1) | 0;
      mid = mid + Math.imul(al3, bh1) | 0;
      mid = mid + Math.imul(ah3, bl1) | 0;
      hi = hi + Math.imul(ah3, bh1) | 0;
      lo = lo + Math.imul(al2, bl2) | 0;
      mid = mid + Math.imul(al2, bh2) | 0;
      mid = mid + Math.imul(ah2, bl2) | 0;
      hi = hi + Math.imul(ah2, bh2) | 0;
      lo = lo + Math.imul(al1, bl3) | 0;
      mid = mid + Math.imul(al1, bh3) | 0;
      mid = mid + Math.imul(ah1, bl3) | 0;
      hi = hi + Math.imul(ah1, bh3) | 0;
      lo = lo + Math.imul(al0, bl4) | 0;
      mid = mid + Math.imul(al0, bh4) | 0;
      mid = mid + Math.imul(ah0, bl4) | 0;
      hi = hi + Math.imul(ah0, bh4) | 0;
      var w4 = (c + lo | 0) + ((mid & 8191) << 13) | 0;
      c = (hi + (mid >>> 13) | 0) + (w4 >>> 26) | 0;
      w4 &= 67108863;
      lo = Math.imul(al5, bl0);
      mid = Math.imul(al5, bh0);
      mid = mid + Math.imul(ah5, bl0) | 0;
      hi = Math.imul(ah5, bh0);
      lo = lo + Math.imul(al4, bl1) | 0;
      mid = mid + Math.imul(al4, bh1) | 0;
      mid = mid + Math.imul(ah4, bl1) | 0;
      hi = hi + Math.imul(ah4, bh1) | 0;
      lo = lo + Math.imul(al3, bl2) | 0;
      mid = mid + Math.imul(al3, bh2) | 0;
      mid = mid + Math.imul(ah3, bl2) | 0;
      hi = hi + Math.imul(ah3, bh2) | 0;
      lo = lo + Math.imul(al2, bl3) | 0;
      mid = mid + Math.imul(al2, bh3) | 0;
      mid = mid + Math.imul(ah2, bl3) | 0;
      hi = hi + Math.imul(ah2, bh3) | 0;
      lo = lo + Math.imul(al1, bl4) | 0;
      mid = mid + Math.imul(al1, bh4) | 0;
      mid = mid + Math.imul(ah1, bl4) | 0;
      hi = hi + Math.imul(ah1, bh4) | 0;
      lo = lo + Math.imul(al0, bl5) | 0;
      mid = mid + Math.imul(al0, bh5) | 0;
      mid = mid + Math.imul(ah0, bl5) | 0;
      hi = hi + Math.imul(ah0, bh5) | 0;
      var w5 = (c + lo | 0) + ((mid & 8191) << 13) | 0;
      c = (hi + (mid >>> 13) | 0) + (w5 >>> 26) | 0;
      w5 &= 67108863;
      lo = Math.imul(al6, bl0);
      mid = Math.imul(al6, bh0);
      mid = mid + Math.imul(ah6, bl0) | 0;
      hi = Math.imul(ah6, bh0);
      lo = lo + Math.imul(al5, bl1) | 0;
      mid = mid + Math.imul(al5, bh1) | 0;
      mid = mid + Math.imul(ah5, bl1) | 0;
      hi = hi + Math.imul(ah5, bh1) | 0;
      lo = lo + Math.imul(al4, bl2) | 0;
      mid = mid + Math.imul(al4, bh2) | 0;
      mid = mid + Math.imul(ah4, bl2) | 0;
      hi = hi + Math.imul(ah4, bh2) | 0;
      lo = lo + Math.imul(al3, bl3) | 0;
      mid = mid + Math.imul(al3, bh3) | 0;
      mid = mid + Math.imul(ah3, bl3) | 0;
      hi = hi + Math.imul(ah3, bh3) | 0;
      lo = lo + Math.imul(al2, bl4) | 0;
      mid = mid + Math.imul(al2, bh4) | 0;
      mid = mid + Math.imul(ah2, bl4) | 0;
      hi = hi + Math.imul(ah2, bh4) | 0;
      lo = lo + Math.imul(al1, bl5) | 0;
      mid = mid + Math.imul(al1, bh5) | 0;
      mid = mid + Math.imul(ah1, bl5) | 0;
      hi = hi + Math.imul(ah1, bh5) | 0;
      lo = lo + Math.imul(al0, bl6) | 0;
      mid = mid + Math.imul(al0, bh6) | 0;
      mid = mid + Math.imul(ah0, bl6) | 0;
      hi = hi + Math.imul(ah0, bh6) | 0;
      var w6 = (c + lo | 0) + ((mid & 8191) << 13) | 0;
      c = (hi + (mid >>> 13) | 0) + (w6 >>> 26) | 0;
      w6 &= 67108863;
      lo = Math.imul(al7, bl0);
      mid = Math.imul(al7, bh0);
      mid = mid + Math.imul(ah7, bl0) | 0;
      hi = Math.imul(ah7, bh0);
      lo = lo + Math.imul(al6, bl1) | 0;
      mid = mid + Math.imul(al6, bh1) | 0;
      mid = mid + Math.imul(ah6, bl1) | 0;
      hi = hi + Math.imul(ah6, bh1) | 0;
      lo = lo + Math.imul(al5, bl2) | 0;
      mid = mid + Math.imul(al5, bh2) | 0;
      mid = mid + Math.imul(ah5, bl2) | 0;
      hi = hi + Math.imul(ah5, bh2) | 0;
      lo = lo + Math.imul(al4, bl3) | 0;
      mid = mid + Math.imul(al4, bh3) | 0;
      mid = mid + Math.imul(ah4, bl3) | 0;
      hi = hi + Math.imul(ah4, bh3) | 0;
      lo = lo + Math.imul(al3, bl4) | 0;
      mid = mid + Math.imul(al3, bh4) | 0;
      mid = mid + Math.imul(ah3, bl4) | 0;
      hi = hi + Math.imul(ah3, bh4) | 0;
      lo = lo + Math.imul(al2, bl5) | 0;
      mid = mid + Math.imul(al2, bh5) | 0;
      mid = mid + Math.imul(ah2, bl5) | 0;
      hi = hi + Math.imul(ah2, bh5) | 0;
      lo = lo + Math.imul(al1, bl6) | 0;
      mid = mid + Math.imul(al1, bh6) | 0;
      mid = mid + Math.imul(ah1, bl6) | 0;
      hi = hi + Math.imul(ah1, bh6) | 0;
      lo = lo + Math.imul(al0, bl7) | 0;
      mid = mid + Math.imul(al0, bh7) | 0;
      mid = mid + Math.imul(ah0, bl7) | 0;
      hi = hi + Math.imul(ah0, bh7) | 0;
      var w7 = (c + lo | 0) + ((mid & 8191) << 13) | 0;
      c = (hi + (mid >>> 13) | 0) + (w7 >>> 26) | 0;
      w7 &= 67108863;
      lo = Math.imul(al8, bl0);
      mid = Math.imul(al8, bh0);
      mid = mid + Math.imul(ah8, bl0) | 0;
      hi = Math.imul(ah8, bh0);
      lo = lo + Math.imul(al7, bl1) | 0;
      mid = mid + Math.imul(al7, bh1) | 0;
      mid = mid + Math.imul(ah7, bl1) | 0;
      hi = hi + Math.imul(ah7, bh1) | 0;
      lo = lo + Math.imul(al6, bl2) | 0;
      mid = mid + Math.imul(al6, bh2) | 0;
      mid = mid + Math.imul(ah6, bl2) | 0;
      hi = hi + Math.imul(ah6, bh2) | 0;
      lo = lo + Math.imul(al5, bl3) | 0;
      mid = mid + Math.imul(al5, bh3) | 0;
      mid = mid + Math.imul(ah5, bl3) | 0;
      hi = hi + Math.imul(ah5, bh3) | 0;
      lo = lo + Math.imul(al4, bl4) | 0;
      mid = mid + Math.imul(al4, bh4) | 0;
      mid = mid + Math.imul(ah4, bl4) | 0;
      hi = hi + Math.imul(ah4, bh4) | 0;
      lo = lo + Math.imul(al3, bl5) | 0;
      mid = mid + Math.imul(al3, bh5) | 0;
      mid = mid + Math.imul(ah3, bl5) | 0;
      hi = hi + Math.imul(ah3, bh5) | 0;
      lo = lo + Math.imul(al2, bl6) | 0;
      mid = mid + Math.imul(al2, bh6) | 0;
      mid = mid + Math.imul(ah2, bl6) | 0;
      hi = hi + Math.imul(ah2, bh6) | 0;
      lo = lo + Math.imul(al1, bl7) | 0;
      mid = mid + Math.imul(al1, bh7) | 0;
      mid = mid + Math.imul(ah1, bl7) | 0;
      hi = hi + Math.imul(ah1, bh7) | 0;
      lo = lo + Math.imul(al0, bl8) | 0;
      mid = mid + Math.imul(al0, bh8) | 0;
      mid = mid + Math.imul(ah0, bl8) | 0;
      hi = hi + Math.imul(ah0, bh8) | 0;
      var w8 = (c + lo | 0) + ((mid & 8191) << 13) | 0;
      c = (hi + (mid >>> 13) | 0) + (w8 >>> 26) | 0;
      w8 &= 67108863;
      lo = Math.imul(al9, bl0);
      mid = Math.imul(al9, bh0);
      mid = mid + Math.imul(ah9, bl0) | 0;
      hi = Math.imul(ah9, bh0);
      lo = lo + Math.imul(al8, bl1) | 0;
      mid = mid + Math.imul(al8, bh1) | 0;
      mid = mid + Math.imul(ah8, bl1) | 0;
      hi = hi + Math.imul(ah8, bh1) | 0;
      lo = lo + Math.imul(al7, bl2) | 0;
      mid = mid + Math.imul(al7, bh2) | 0;
      mid = mid + Math.imul(ah7, bl2) | 0;
      hi = hi + Math.imul(ah7, bh2) | 0;
      lo = lo + Math.imul(al6, bl3) | 0;
      mid = mid + Math.imul(al6, bh3) | 0;
      mid = mid + Math.imul(ah6, bl3) | 0;
      hi = hi + Math.imul(ah6, bh3) | 0;
      lo = lo + Math.imul(al5, bl4) | 0;
      mid = mid + Math.imul(al5, bh4) | 0;
      mid = mid + Math.imul(ah5, bl4) | 0;
      hi = hi + Math.imul(ah5, bh4) | 0;
      lo = lo + Math.imul(al4, bl5) | 0;
      mid = mid + Math.imul(al4, bh5) | 0;
      mid = mid + Math.imul(ah4, bl5) | 0;
      hi = hi + Math.imul(ah4, bh5) | 0;
      lo = lo + Math.imul(al3, bl6) | 0;
      mid = mid + Math.imul(al3, bh6) | 0;
      mid = mid + Math.imul(ah3, bl6) | 0;
      hi = hi + Math.imul(ah3, bh6) | 0;
      lo = lo + Math.imul(al2, bl7) | 0;
      mid = mid + Math.imul(al2, bh7) | 0;
      mid = mid + Math.imul(ah2, bl7) | 0;
      hi = hi + Math.imul(ah2, bh7) | 0;
      lo = lo + Math.imul(al1, bl8) | 0;
      mid = mid + Math.imul(al1, bh8) | 0;
      mid = mid + Math.imul(ah1, bl8) | 0;
      hi = hi + Math.imul(ah1, bh8) | 0;
      lo = lo + Math.imul(al0, bl9) | 0;
      mid = mid + Math.imul(al0, bh9) | 0;
      mid = mid + Math.imul(ah0, bl9) | 0;
      hi = hi + Math.imul(ah0, bh9) | 0;
      var w9 = (c + lo | 0) + ((mid & 8191) << 13) | 0;
      c = (hi + (mid >>> 13) | 0) + (w9 >>> 26) | 0;
      w9 &= 67108863;
      lo = Math.imul(al9, bl1);
      mid = Math.imul(al9, bh1);
      mid = mid + Math.imul(ah9, bl1) | 0;
      hi = Math.imul(ah9, bh1);
      lo = lo + Math.imul(al8, bl2) | 0;
      mid = mid + Math.imul(al8, bh2) | 0;
      mid = mid + Math.imul(ah8, bl2) | 0;
      hi = hi + Math.imul(ah8, bh2) | 0;
      lo = lo + Math.imul(al7, bl3) | 0;
      mid = mid + Math.imul(al7, bh3) | 0;
      mid = mid + Math.imul(ah7, bl3) | 0;
      hi = hi + Math.imul(ah7, bh3) | 0;
      lo = lo + Math.imul(al6, bl4) | 0;
      mid = mid + Math.imul(al6, bh4) | 0;
      mid = mid + Math.imul(ah6, bl4) | 0;
      hi = hi + Math.imul(ah6, bh4) | 0;
      lo = lo + Math.imul(al5, bl5) | 0;
      mid = mid + Math.imul(al5, bh5) | 0;
      mid = mid + Math.imul(ah5, bl5) | 0;
      hi = hi + Math.imul(ah5, bh5) | 0;
      lo = lo + Math.imul(al4, bl6) | 0;
      mid = mid + Math.imul(al4, bh6) | 0;
      mid = mid + Math.imul(ah4, bl6) | 0;
      hi = hi + Math.imul(ah4, bh6) | 0;
      lo = lo + Math.imul(al3, bl7) | 0;
      mid = mid + Math.imul(al3, bh7) | 0;
      mid = mid + Math.imul(ah3, bl7) | 0;
      hi = hi + Math.imul(ah3, bh7) | 0;
      lo = lo + Math.imul(al2, bl8) | 0;
      mid = mid + Math.imul(al2, bh8) | 0;
      mid = mid + Math.imul(ah2, bl8) | 0;
      hi = hi + Math.imul(ah2, bh8) | 0;
      lo = lo + Math.imul(al1, bl9) | 0;
      mid = mid + Math.imul(al1, bh9) | 0;
      mid = mid + Math.imul(ah1, bl9) | 0;
      hi = hi + Math.imul(ah1, bh9) | 0;
      var w10 = (c + lo | 0) + ((mid & 8191) << 13) | 0;
      c = (hi + (mid >>> 13) | 0) + (w10 >>> 26) | 0;
      w10 &= 67108863;
      lo = Math.imul(al9, bl2);
      mid = Math.imul(al9, bh2);
      mid = mid + Math.imul(ah9, bl2) | 0;
      hi = Math.imul(ah9, bh2);
      lo = lo + Math.imul(al8, bl3) | 0;
      mid = mid + Math.imul(al8, bh3) | 0;
      mid = mid + Math.imul(ah8, bl3) | 0;
      hi = hi + Math.imul(ah8, bh3) | 0;
      lo = lo + Math.imul(al7, bl4) | 0;
      mid = mid + Math.imul(al7, bh4) | 0;
      mid = mid + Math.imul(ah7, bl4) | 0;
      hi = hi + Math.imul(ah7, bh4) | 0;
      lo = lo + Math.imul(al6, bl5) | 0;
      mid = mid + Math.imul(al6, bh5) | 0;
      mid = mid + Math.imul(ah6, bl5) | 0;
      hi = hi + Math.imul(ah6, bh5) | 0;
      lo = lo + Math.imul(al5, bl6) | 0;
      mid = mid + Math.imul(al5, bh6) | 0;
      mid = mid + Math.imul(ah5, bl6) | 0;
      hi = hi + Math.imul(ah5, bh6) | 0;
      lo = lo + Math.imul(al4, bl7) | 0;
      mid = mid + Math.imul(al4, bh7) | 0;
      mid = mid + Math.imul(ah4, bl7) | 0;
      hi = hi + Math.imul(ah4, bh7) | 0;
      lo = lo + Math.imul(al3, bl8) | 0;
      mid = mid + Math.imul(al3, bh8) | 0;
      mid = mid + Math.imul(ah3, bl8) | 0;
      hi = hi + Math.imul(ah3, bh8) | 0;
      lo = lo + Math.imul(al2, bl9) | 0;
      mid = mid + Math.imul(al2, bh9) | 0;
      mid = mid + Math.imul(ah2, bl9) | 0;
      hi = hi + Math.imul(ah2, bh9) | 0;
      var w11 = (c + lo | 0) + ((mid & 8191) << 13) | 0;
      c = (hi + (mid >>> 13) | 0) + (w11 >>> 26) | 0;
      w11 &= 67108863;
      lo = Math.imul(al9, bl3);
      mid = Math.imul(al9, bh3);
      mid = mid + Math.imul(ah9, bl3) | 0;
      hi = Math.imul(ah9, bh3);
      lo = lo + Math.imul(al8, bl4) | 0;
      mid = mid + Math.imul(al8, bh4) | 0;
      mid = mid + Math.imul(ah8, bl4) | 0;
      hi = hi + Math.imul(ah8, bh4) | 0;
      lo = lo + Math.imul(al7, bl5) | 0;
      mid = mid + Math.imul(al7, bh5) | 0;
      mid = mid + Math.imul(ah7, bl5) | 0;
      hi = hi + Math.imul(ah7, bh5) | 0;
      lo = lo + Math.imul(al6, bl6) | 0;
      mid = mid + Math.imul(al6, bh6) | 0;
      mid = mid + Math.imul(ah6, bl6) | 0;
      hi = hi + Math.imul(ah6, bh6) | 0;
      lo = lo + Math.imul(al5, bl7) | 0;
      mid = mid + Math.imul(al5, bh7) | 0;
      mid = mid + Math.imul(ah5, bl7) | 0;
      hi = hi + Math.imul(ah5, bh7) | 0;
      lo = lo + Math.imul(al4, bl8) | 0;
      mid = mid + Math.imul(al4, bh8) | 0;
      mid = mid + Math.imul(ah4, bl8) | 0;
      hi = hi + Math.imul(ah4, bh8) | 0;
      lo = lo + Math.imul(al3, bl9) | 0;
      mid = mid + Math.imul(al3, bh9) | 0;
      mid = mid + Math.imul(ah3, bl9) | 0;
      hi = hi + Math.imul(ah3, bh9) | 0;
      var w12 = (c + lo | 0) + ((mid & 8191) << 13) | 0;
      c = (hi + (mid >>> 13) | 0) + (w12 >>> 26) | 0;
      w12 &= 67108863;
      lo = Math.imul(al9, bl4);
      mid = Math.imul(al9, bh4);
      mid = mid + Math.imul(ah9, bl4) | 0;
      hi = Math.imul(ah9, bh4);
      lo = lo + Math.imul(al8, bl5) | 0;
      mid = mid + Math.imul(al8, bh5) | 0;
      mid = mid + Math.imul(ah8, bl5) | 0;
      hi = hi + Math.imul(ah8, bh5) | 0;
      lo = lo + Math.imul(al7, bl6) | 0;
      mid = mid + Math.imul(al7, bh6) | 0;
      mid = mid + Math.imul(ah7, bl6) | 0;
      hi = hi + Math.imul(ah7, bh6) | 0;
      lo = lo + Math.imul(al6, bl7) | 0;
      mid = mid + Math.imul(al6, bh7) | 0;
      mid = mid + Math.imul(ah6, bl7) | 0;
      hi = hi + Math.imul(ah6, bh7) | 0;
      lo = lo + Math.imul(al5, bl8) | 0;
      mid = mid + Math.imul(al5, bh8) | 0;
      mid = mid + Math.imul(ah5, bl8) | 0;
      hi = hi + Math.imul(ah5, bh8) | 0;
      lo = lo + Math.imul(al4, bl9) | 0;
      mid = mid + Math.imul(al4, bh9) | 0;
      mid = mid + Math.imul(ah4, bl9) | 0;
      hi = hi + Math.imul(ah4, bh9) | 0;
      var w13 = (c + lo | 0) + ((mid & 8191) << 13) | 0;
      c = (hi + (mid >>> 13) | 0) + (w13 >>> 26) | 0;
      w13 &= 67108863;
      lo = Math.imul(al9, bl5);
      mid = Math.imul(al9, bh5);
      mid = mid + Math.imul(ah9, bl5) | 0;
      hi = Math.imul(ah9, bh5);
      lo = lo + Math.imul(al8, bl6) | 0;
      mid = mid + Math.imul(al8, bh6) | 0;
      mid = mid + Math.imul(ah8, bl6) | 0;
      hi = hi + Math.imul(ah8, bh6) | 0;
      lo = lo + Math.imul(al7, bl7) | 0;
      mid = mid + Math.imul(al7, bh7) | 0;
      mid = mid + Math.imul(ah7, bl7) | 0;
      hi = hi + Math.imul(ah7, bh7) | 0;
      lo = lo + Math.imul(al6, bl8) | 0;
      mid = mid + Math.imul(al6, bh8) | 0;
      mid = mid + Math.imul(ah6, bl8) | 0;
      hi = hi + Math.imul(ah6, bh8) | 0;
      lo = lo + Math.imul(al5, bl9) | 0;
      mid = mid + Math.imul(al5, bh9) | 0;
      mid = mid + Math.imul(ah5, bl9) | 0;
      hi = hi + Math.imul(ah5, bh9) | 0;
      var w14 = (c + lo | 0) + ((mid & 8191) << 13) | 0;
      c = (hi + (mid >>> 13) | 0) + (w14 >>> 26) | 0;
      w14 &= 67108863;
      lo = Math.imul(al9, bl6);
      mid = Math.imul(al9, bh6);
      mid = mid + Math.imul(ah9, bl6) | 0;
      hi = Math.imul(ah9, bh6);
      lo = lo + Math.imul(al8, bl7) | 0;
      mid = mid + Math.imul(al8, bh7) | 0;
      mid = mid + Math.imul(ah8, bl7) | 0;
      hi = hi + Math.imul(ah8, bh7) | 0;
      lo = lo + Math.imul(al7, bl8) | 0;
      mid = mid + Math.imul(al7, bh8) | 0;
      mid = mid + Math.imul(ah7, bl8) | 0;
      hi = hi + Math.imul(ah7, bh8) | 0;
      lo = lo + Math.imul(al6, bl9) | 0;
      mid = mid + Math.imul(al6, bh9) | 0;
      mid = mid + Math.imul(ah6, bl9) | 0;
      hi = hi + Math.imul(ah6, bh9) | 0;
      var w15 = (c + lo | 0) + ((mid & 8191) << 13) | 0;
      c = (hi + (mid >>> 13) | 0) + (w15 >>> 26) | 0;
      w15 &= 67108863;
      lo = Math.imul(al9, bl7);
      mid = Math.imul(al9, bh7);
      mid = mid + Math.imul(ah9, bl7) | 0;
      hi = Math.imul(ah9, bh7);
      lo = lo + Math.imul(al8, bl8) | 0;
      mid = mid + Math.imul(al8, bh8) | 0;
      mid = mid + Math.imul(ah8, bl8) | 0;
      hi = hi + Math.imul(ah8, bh8) | 0;
      lo = lo + Math.imul(al7, bl9) | 0;
      mid = mid + Math.imul(al7, bh9) | 0;
      mid = mid + Math.imul(ah7, bl9) | 0;
      hi = hi + Math.imul(ah7, bh9) | 0;
      var w16 = (c + lo | 0) + ((mid & 8191) << 13) | 0;
      c = (hi + (mid >>> 13) | 0) + (w16 >>> 26) | 0;
      w16 &= 67108863;
      lo = Math.imul(al9, bl8);
      mid = Math.imul(al9, bh8);
      mid = mid + Math.imul(ah9, bl8) | 0;
      hi = Math.imul(ah9, bh8);
      lo = lo + Math.imul(al8, bl9) | 0;
      mid = mid + Math.imul(al8, bh9) | 0;
      mid = mid + Math.imul(ah8, bl9) | 0;
      hi = hi + Math.imul(ah8, bh9) | 0;
      var w17 = (c + lo | 0) + ((mid & 8191) << 13) | 0;
      c = (hi + (mid >>> 13) | 0) + (w17 >>> 26) | 0;
      w17 &= 67108863;
      lo = Math.imul(al9, bl9);
      mid = Math.imul(al9, bh9);
      mid = mid + Math.imul(ah9, bl9) | 0;
      hi = Math.imul(ah9, bh9);
      var w18 = (c + lo | 0) + ((mid & 8191) << 13) | 0;
      c = (hi + (mid >>> 13) | 0) + (w18 >>> 26) | 0;
      w18 &= 67108863;
      o2[0] = w0;
      o2[1] = w1;
      o2[2] = w2;
      o2[3] = w3;
      o2[4] = w4;
      o2[5] = w5;
      o2[6] = w6;
      o2[7] = w7;
      o2[8] = w8;
      o2[9] = w9;
      o2[10] = w10;
      o2[11] = w11;
      o2[12] = w12;
      o2[13] = w13;
      o2[14] = w14;
      o2[15] = w15;
      o2[16] = w16;
      o2[17] = w17;
      o2[18] = w18;
      if (c !== 0) {
        o2[19] = c;
        out.length++;
      }
      return out;
    };
    if (!Math.imul) {
      comb10MulTo = smallMulTo;
    }
    function bigMulTo(self2, num, out) {
      out.negative = num.negative ^ self2.negative;
      out.length = self2.length + num.length;
      var carry = 0;
      var hncarry = 0;
      for (var k2 = 0; k2 < out.length - 1; k2++) {
        var ncarry = hncarry;
        hncarry = 0;
        var rword = carry & 67108863;
        var maxJ = Math.min(k2, num.length - 1);
        for (var j2 = Math.max(0, k2 - self2.length + 1); j2 <= maxJ; j2++) {
          var i = k2 - j2;
          var a = self2.words[i] | 0;
          var b2 = num.words[j2] | 0;
          var r2 = a * b2;
          var lo = r2 & 67108863;
          ncarry = ncarry + (r2 / 67108864 | 0) | 0;
          lo = lo + rword | 0;
          rword = lo & 67108863;
          ncarry = ncarry + (lo >>> 26) | 0;
          hncarry += ncarry >>> 26;
          ncarry &= 67108863;
        }
        out.words[k2] = rword;
        carry = ncarry;
        ncarry = hncarry;
      }
      if (carry !== 0) {
        out.words[k2] = carry;
      } else {
        out.length--;
      }
      return out._strip();
    }
    function jumboMulTo(self2, num, out) {
      return bigMulTo(self2, num, out);
    }
    BN2.prototype.mulTo = function mulTo(num, out) {
      var res;
      var len = this.length + num.length;
      if (this.length === 10 && num.length === 10) {
        res = comb10MulTo(this, num, out);
      } else if (len < 63) {
        res = smallMulTo(this, num, out);
      } else if (len < 1024) {
        res = bigMulTo(this, num, out);
      } else {
        res = jumboMulTo(this, num, out);
      }
      return res;
    };
    BN2.prototype.mul = function mul3(num) {
      var out = new BN2(null);
      out.words = new Array(this.length + num.length);
      return this.mulTo(num, out);
    };
    BN2.prototype.mulf = function mulf(num) {
      var out = new BN2(null);
      out.words = new Array(this.length + num.length);
      return jumboMulTo(this, num, out);
    };
    BN2.prototype.imul = function imul(num) {
      return this.clone().mulTo(num, this);
    };
    BN2.prototype.imuln = function imuln(num) {
      var isNegNum = num < 0;
      if (isNegNum)
        num = -num;
      assert2(typeof num === "number");
      assert2(num < 67108864);
      var carry = 0;
      for (var i = 0; i < this.length; i++) {
        var w2 = (this.words[i] | 0) * num;
        var lo = (w2 & 67108863) + (carry & 67108863);
        carry >>= 26;
        carry += w2 / 67108864 | 0;
        carry += lo >>> 26;
        this.words[i] = lo & 67108863;
      }
      if (carry !== 0) {
        this.words[i] = carry;
        this.length++;
      }
      return isNegNum ? this.ineg() : this;
    };
    BN2.prototype.muln = function muln(num) {
      return this.clone().imuln(num);
    };
    BN2.prototype.sqr = function sqr() {
      return this.mul(this);
    };
    BN2.prototype.isqr = function isqr() {
      return this.imul(this.clone());
    };
    BN2.prototype.pow = function pow(num) {
      var w2 = toBitArray(num);
      if (w2.length === 0)
        return new BN2(1);
      var res = this;
      for (var i = 0; i < w2.length; i++, res = res.sqr()) {
        if (w2[i] !== 0)
          break;
      }
      if (++i < w2.length) {
        for (var q = res.sqr(); i < w2.length; i++, q = q.sqr()) {
          if (w2[i] === 0)
            continue;
          res = res.mul(q);
        }
      }
      return res;
    };
    BN2.prototype.iushln = function iushln(bits) {
      assert2(typeof bits === "number" && bits >= 0);
      var r2 = bits % 26;
      var s2 = (bits - r2) / 26;
      var carryMask = 67108863 >>> 26 - r2 << 26 - r2;
      var i;
      if (r2 !== 0) {
        var carry = 0;
        for (i = 0; i < this.length; i++) {
          var newCarry = this.words[i] & carryMask;
          var c = (this.words[i] | 0) - newCarry << r2;
          this.words[i] = c | carry;
          carry = newCarry >>> 26 - r2;
        }
        if (carry) {
          this.words[i] = carry;
          this.length++;
        }
      }
      if (s2 !== 0) {
        for (i = this.length - 1; i >= 0; i--) {
          this.words[i + s2] = this.words[i];
        }
        for (i = 0; i < s2; i++) {
          this.words[i] = 0;
        }
        this.length += s2;
      }
      return this._strip();
    };
    BN2.prototype.ishln = function ishln(bits) {
      assert2(this.negative === 0);
      return this.iushln(bits);
    };
    BN2.prototype.iushrn = function iushrn(bits, hint, extended) {
      assert2(typeof bits === "number" && bits >= 0);
      var h2;
      if (hint) {
        h2 = (hint - hint % 26) / 26;
      } else {
        h2 = 0;
      }
      var r2 = bits % 26;
      var s2 = Math.min((bits - r2) / 26, this.length);
      var mask = 67108863 ^ 67108863 >>> r2 << r2;
      var maskedWords = extended;
      h2 -= s2;
      h2 = Math.max(0, h2);
      if (maskedWords) {
        for (var i = 0; i < s2; i++) {
          maskedWords.words[i] = this.words[i];
        }
        maskedWords.length = s2;
      }
      if (s2 === 0)
        ;
      else if (this.length > s2) {
        this.length -= s2;
        for (i = 0; i < this.length; i++) {
          this.words[i] = this.words[i + s2];
        }
      } else {
        this.words[0] = 0;
        this.length = 1;
      }
      var carry = 0;
      for (i = this.length - 1; i >= 0 && (carry !== 0 || i >= h2); i--) {
        var word = this.words[i] | 0;
        this.words[i] = carry << 26 - r2 | word >>> r2;
        carry = word & mask;
      }
      if (maskedWords && carry !== 0) {
        maskedWords.words[maskedWords.length++] = carry;
      }
      if (this.length === 0) {
        this.words[0] = 0;
        this.length = 1;
      }
      return this._strip();
    };
    BN2.prototype.ishrn = function ishrn(bits, hint, extended) {
      assert2(this.negative === 0);
      return this.iushrn(bits, hint, extended);
    };
    BN2.prototype.shln = function shln(bits) {
      return this.clone().ishln(bits);
    };
    BN2.prototype.ushln = function ushln(bits) {
      return this.clone().iushln(bits);
    };
    BN2.prototype.shrn = function shrn(bits) {
      return this.clone().ishrn(bits);
    };
    BN2.prototype.ushrn = function ushrn(bits) {
      return this.clone().iushrn(bits);
    };
    BN2.prototype.testn = function testn(bit) {
      assert2(typeof bit === "number" && bit >= 0);
      var r2 = bit % 26;
      var s2 = (bit - r2) / 26;
      var q = 1 << r2;
      if (this.length <= s2)
        return false;
      var w2 = this.words[s2];
      return !!(w2 & q);
    };
    BN2.prototype.imaskn = function imaskn(bits) {
      assert2(typeof bits === "number" && bits >= 0);
      var r2 = bits % 26;
      var s2 = (bits - r2) / 26;
      assert2(this.negative === 0, "imaskn works only with positive numbers");
      if (this.length <= s2) {
        return this;
      }
      if (r2 !== 0) {
        s2++;
      }
      this.length = Math.min(s2, this.length);
      if (r2 !== 0) {
        var mask = 67108863 ^ 67108863 >>> r2 << r2;
        this.words[this.length - 1] &= mask;
      }
      return this._strip();
    };
    BN2.prototype.maskn = function maskn(bits) {
      return this.clone().imaskn(bits);
    };
    BN2.prototype.iaddn = function iaddn(num) {
      assert2(typeof num === "number");
      assert2(num < 67108864);
      if (num < 0)
        return this.isubn(-num);
      if (this.negative !== 0) {
        if (this.length === 1 && (this.words[0] | 0) <= num) {
          this.words[0] = num - (this.words[0] | 0);
          this.negative = 0;
          return this;
        }
        this.negative = 0;
        this.isubn(num);
        this.negative = 1;
        return this;
      }
      return this._iaddn(num);
    };
    BN2.prototype._iaddn = function _iaddn(num) {
      this.words[0] += num;
      for (var i = 0; i < this.length && this.words[i] >= 67108864; i++) {
        this.words[i] -= 67108864;
        if (i === this.length - 1) {
          this.words[i + 1] = 1;
        } else {
          this.words[i + 1]++;
        }
      }
      this.length = Math.max(this.length, i + 1);
      return this;
    };
    BN2.prototype.isubn = function isubn(num) {
      assert2(typeof num === "number");
      assert2(num < 67108864);
      if (num < 0)
        return this.iaddn(-num);
      if (this.negative !== 0) {
        this.negative = 0;
        this.iaddn(num);
        this.negative = 1;
        return this;
      }
      this.words[0] -= num;
      if (this.length === 1 && this.words[0] < 0) {
        this.words[0] = -this.words[0];
        this.negative = 1;
      } else {
        for (var i = 0; i < this.length && this.words[i] < 0; i++) {
          this.words[i] += 67108864;
          this.words[i + 1] -= 1;
        }
      }
      return this._strip();
    };
    BN2.prototype.addn = function addn(num) {
      return this.clone().iaddn(num);
    };
    BN2.prototype.subn = function subn(num) {
      return this.clone().isubn(num);
    };
    BN2.prototype.iabs = function iabs() {
      this.negative = 0;
      return this;
    };
    BN2.prototype.abs = function abs() {
      return this.clone().iabs();
    };
    BN2.prototype._ishlnsubmul = function _ishlnsubmul(num, mul3, shift) {
      var len = num.length + shift;
      var i;
      this._expand(len);
      var w2;
      var carry = 0;
      for (i = 0; i < num.length; i++) {
        w2 = (this.words[i + shift] | 0) + carry;
        var right = (num.words[i] | 0) * mul3;
        w2 -= right & 67108863;
        carry = (w2 >> 26) - (right / 67108864 | 0);
        this.words[i + shift] = w2 & 67108863;
      }
      for (; i < this.length - shift; i++) {
        w2 = (this.words[i + shift] | 0) + carry;
        carry = w2 >> 26;
        this.words[i + shift] = w2 & 67108863;
      }
      if (carry === 0)
        return this._strip();
      assert2(carry === -1);
      carry = 0;
      for (i = 0; i < this.length; i++) {
        w2 = -(this.words[i] | 0) + carry;
        carry = w2 >> 26;
        this.words[i] = w2 & 67108863;
      }
      this.negative = 1;
      return this._strip();
    };
    BN2.prototype._wordDiv = function _wordDiv(num, mode) {
      var shift = this.length - num.length;
      var a = this.clone();
      var b2 = num;
      var bhi = b2.words[b2.length - 1] | 0;
      var bhiBits = this._countBits(bhi);
      shift = 26 - bhiBits;
      if (shift !== 0) {
        b2 = b2.ushln(shift);
        a.iushln(shift);
        bhi = b2.words[b2.length - 1] | 0;
      }
      var m2 = a.length - b2.length;
      var q;
      if (mode !== "mod") {
        q = new BN2(null);
        q.length = m2 + 1;
        q.words = new Array(q.length);
        for (var i = 0; i < q.length; i++) {
          q.words[i] = 0;
        }
      }
      var diff = a.clone()._ishlnsubmul(b2, 1, m2);
      if (diff.negative === 0) {
        a = diff;
        if (q) {
          q.words[m2] = 1;
        }
      }
      for (var j2 = m2 - 1; j2 >= 0; j2--) {
        var qj = (a.words[b2.length + j2] | 0) * 67108864 + (a.words[b2.length + j2 - 1] | 0);
        qj = Math.min(qj / bhi | 0, 67108863);
        a._ishlnsubmul(b2, qj, j2);
        while (a.negative !== 0) {
          qj--;
          a.negative = 0;
          a._ishlnsubmul(b2, 1, j2);
          if (!a.isZero()) {
            a.negative ^= 1;
          }
        }
        if (q) {
          q.words[j2] = qj;
        }
      }
      if (q) {
        q._strip();
      }
      a._strip();
      if (mode !== "div" && shift !== 0) {
        a.iushrn(shift);
      }
      return {
        div: q || null,
        mod: a
      };
    };
    BN2.prototype.divmod = function divmod(num, mode, positive) {
      assert2(!num.isZero());
      if (this.isZero()) {
        return {
          div: new BN2(0),
          mod: new BN2(0)
        };
      }
      var div, mod, res;
      if (this.negative !== 0 && num.negative === 0) {
        res = this.neg().divmod(num, mode);
        if (mode !== "mod") {
          div = res.div.neg();
        }
        if (mode !== "div") {
          mod = res.mod.neg();
          if (positive && mod.negative !== 0) {
            mod.iadd(num);
          }
        }
        return {
          div,
          mod
        };
      }
      if (this.negative === 0 && num.negative !== 0) {
        res = this.divmod(num.neg(), mode);
        if (mode !== "mod") {
          div = res.div.neg();
        }
        return {
          div,
          mod: res.mod
        };
      }
      if ((this.negative & num.negative) !== 0) {
        res = this.neg().divmod(num.neg(), mode);
        if (mode !== "div") {
          mod = res.mod.neg();
          if (positive && mod.negative !== 0) {
            mod.isub(num);
          }
        }
        return {
          div: res.div,
          mod
        };
      }
      if (num.length > this.length || this.cmp(num) < 0) {
        return {
          div: new BN2(0),
          mod: this
        };
      }
      if (num.length === 1) {
        if (mode === "div") {
          return {
            div: this.divn(num.words[0]),
            mod: null
          };
        }
        if (mode === "mod") {
          return {
            div: null,
            mod: new BN2(this.modrn(num.words[0]))
          };
        }
        return {
          div: this.divn(num.words[0]),
          mod: new BN2(this.modrn(num.words[0]))
        };
      }
      return this._wordDiv(num, mode);
    };
    BN2.prototype.div = function div(num) {
      return this.divmod(num, "div", false).div;
    };
    BN2.prototype.mod = function mod(num) {
      return this.divmod(num, "mod", false).mod;
    };
    BN2.prototype.umod = function umod(num) {
      return this.divmod(num, "mod", true).mod;
    };
    BN2.prototype.divRound = function divRound(num) {
      var dm = this.divmod(num);
      if (dm.mod.isZero())
        return dm.div;
      var mod = dm.div.negative !== 0 ? dm.mod.isub(num) : dm.mod;
      var half = num.ushrn(1);
      var r2 = num.andln(1);
      var cmp = mod.cmp(half);
      if (cmp < 0 || r2 === 1 && cmp === 0)
        return dm.div;
      return dm.div.negative !== 0 ? dm.div.isubn(1) : dm.div.iaddn(1);
    };
    BN2.prototype.modrn = function modrn(num) {
      var isNegNum = num < 0;
      if (isNegNum)
        num = -num;
      assert2(num <= 67108863);
      var p2 = (1 << 26) % num;
      var acc = 0;
      for (var i = this.length - 1; i >= 0; i--) {
        acc = (p2 * acc + (this.words[i] | 0)) % num;
      }
      return isNegNum ? -acc : acc;
    };
    BN2.prototype.modn = function modn(num) {
      return this.modrn(num);
    };
    BN2.prototype.idivn = function idivn(num) {
      var isNegNum = num < 0;
      if (isNegNum)
        num = -num;
      assert2(num <= 67108863);
      var carry = 0;
      for (var i = this.length - 1; i >= 0; i--) {
        var w2 = (this.words[i] | 0) + carry * 67108864;
        this.words[i] = w2 / num | 0;
        carry = w2 % num;
      }
      this._strip();
      return isNegNum ? this.ineg() : this;
    };
    BN2.prototype.divn = function divn(num) {
      return this.clone().idivn(num);
    };
    BN2.prototype.egcd = function egcd(p2) {
      assert2(p2.negative === 0);
      assert2(!p2.isZero());
      var x2 = this;
      var y2 = p2.clone();
      if (x2.negative !== 0) {
        x2 = x2.umod(p2);
      } else {
        x2 = x2.clone();
      }
      var A2 = new BN2(1);
      var B2 = new BN2(0);
      var C2 = new BN2(0);
      var D2 = new BN2(1);
      var g2 = 0;
      while (x2.isEven() && y2.isEven()) {
        x2.iushrn(1);
        y2.iushrn(1);
        ++g2;
      }
      var yp = y2.clone();
      var xp = x2.clone();
      while (!x2.isZero()) {
        for (var i = 0, im = 1; (x2.words[0] & im) === 0 && i < 26; ++i, im <<= 1)
          ;
        if (i > 0) {
          x2.iushrn(i);
          while (i-- > 0) {
            if (A2.isOdd() || B2.isOdd()) {
              A2.iadd(yp);
              B2.isub(xp);
            }
            A2.iushrn(1);
            B2.iushrn(1);
          }
        }
        for (var j2 = 0, jm = 1; (y2.words[0] & jm) === 0 && j2 < 26; ++j2, jm <<= 1)
          ;
        if (j2 > 0) {
          y2.iushrn(j2);
          while (j2-- > 0) {
            if (C2.isOdd() || D2.isOdd()) {
              C2.iadd(yp);
              D2.isub(xp);
            }
            C2.iushrn(1);
            D2.iushrn(1);
          }
        }
        if (x2.cmp(y2) >= 0) {
          x2.isub(y2);
          A2.isub(C2);
          B2.isub(D2);
        } else {
          y2.isub(x2);
          C2.isub(A2);
          D2.isub(B2);
        }
      }
      return {
        a: C2,
        b: D2,
        gcd: y2.iushln(g2)
      };
    };
    BN2.prototype._invmp = function _invmp(p2) {
      assert2(p2.negative === 0);
      assert2(!p2.isZero());
      var a = this;
      var b2 = p2.clone();
      if (a.negative !== 0) {
        a = a.umod(p2);
      } else {
        a = a.clone();
      }
      var x1 = new BN2(1);
      var x2 = new BN2(0);
      var delta = b2.clone();
      while (a.cmpn(1) > 0 && b2.cmpn(1) > 0) {
        for (var i = 0, im = 1; (a.words[0] & im) === 0 && i < 26; ++i, im <<= 1)
          ;
        if (i > 0) {
          a.iushrn(i);
          while (i-- > 0) {
            if (x1.isOdd()) {
              x1.iadd(delta);
            }
            x1.iushrn(1);
          }
        }
        for (var j2 = 0, jm = 1; (b2.words[0] & jm) === 0 && j2 < 26; ++j2, jm <<= 1)
          ;
        if (j2 > 0) {
          b2.iushrn(j2);
          while (j2-- > 0) {
            if (x2.isOdd()) {
              x2.iadd(delta);
            }
            x2.iushrn(1);
          }
        }
        if (a.cmp(b2) >= 0) {
          a.isub(b2);
          x1.isub(x2);
        } else {
          b2.isub(a);
          x2.isub(x1);
        }
      }
      var res;
      if (a.cmpn(1) === 0) {
        res = x1;
      } else {
        res = x2;
      }
      if (res.cmpn(0) < 0) {
        res.iadd(p2);
      }
      return res;
    };
    BN2.prototype.gcd = function gcd(num) {
      if (this.isZero())
        return num.abs();
      if (num.isZero())
        return this.abs();
      var a = this.clone();
      var b2 = num.clone();
      a.negative = 0;
      b2.negative = 0;
      for (var shift = 0; a.isEven() && b2.isEven(); shift++) {
        a.iushrn(1);
        b2.iushrn(1);
      }
      do {
        while (a.isEven()) {
          a.iushrn(1);
        }
        while (b2.isEven()) {
          b2.iushrn(1);
        }
        var r2 = a.cmp(b2);
        if (r2 < 0) {
          var t = a;
          a = b2;
          b2 = t;
        } else if (r2 === 0 || b2.cmpn(1) === 0) {
          break;
        }
        a.isub(b2);
      } while (true);
      return b2.iushln(shift);
    };
    BN2.prototype.invm = function invm(num) {
      return this.egcd(num).a.umod(num);
    };
    BN2.prototype.isEven = function isEven() {
      return (this.words[0] & 1) === 0;
    };
    BN2.prototype.isOdd = function isOdd() {
      return (this.words[0] & 1) === 1;
    };
    BN2.prototype.andln = function andln(num) {
      return this.words[0] & num;
    };
    BN2.prototype.bincn = function bincn(bit) {
      assert2(typeof bit === "number");
      var r2 = bit % 26;
      var s2 = (bit - r2) / 26;
      var q = 1 << r2;
      if (this.length <= s2) {
        this._expand(s2 + 1);
        this.words[s2] |= q;
        return this;
      }
      var carry = q;
      for (var i = s2; carry !== 0 && i < this.length; i++) {
        var w2 = this.words[i] | 0;
        w2 += carry;
        carry = w2 >>> 26;
        w2 &= 67108863;
        this.words[i] = w2;
      }
      if (carry !== 0) {
        this.words[i] = carry;
        this.length++;
      }
      return this;
    };
    BN2.prototype.isZero = function isZero() {
      return this.length === 1 && this.words[0] === 0;
    };
    BN2.prototype.cmpn = function cmpn(num) {
      var negative = num < 0;
      if (this.negative !== 0 && !negative)
        return -1;
      if (this.negative === 0 && negative)
        return 1;
      this._strip();
      var res;
      if (this.length > 1) {
        res = 1;
      } else {
        if (negative) {
          num = -num;
        }
        assert2(num <= 67108863, "Number is too big");
        var w2 = this.words[0] | 0;
        res = w2 === num ? 0 : w2 < num ? -1 : 1;
      }
      if (this.negative !== 0)
        return -res | 0;
      return res;
    };
    BN2.prototype.cmp = function cmp(num) {
      if (this.negative !== 0 && num.negative === 0)
        return -1;
      if (this.negative === 0 && num.negative !== 0)
        return 1;
      var res = this.ucmp(num);
      if (this.negative !== 0)
        return -res | 0;
      return res;
    };
    BN2.prototype.ucmp = function ucmp(num) {
      if (this.length > num.length)
        return 1;
      if (this.length < num.length)
        return -1;
      var res = 0;
      for (var i = this.length - 1; i >= 0; i--) {
        var a = this.words[i] | 0;
        var b2 = num.words[i] | 0;
        if (a === b2)
          continue;
        if (a < b2) {
          res = -1;
        } else if (a > b2) {
          res = 1;
        }
        break;
      }
      return res;
    };
    BN2.prototype.gtn = function gtn(num) {
      return this.cmpn(num) === 1;
    };
    BN2.prototype.gt = function gt2(num) {
      return this.cmp(num) === 1;
    };
    BN2.prototype.gten = function gten(num) {
      return this.cmpn(num) >= 0;
    };
    BN2.prototype.gte = function gte(num) {
      return this.cmp(num) >= 0;
    };
    BN2.prototype.ltn = function ltn(num) {
      return this.cmpn(num) === -1;
    };
    BN2.prototype.lt = function lt2(num) {
      return this.cmp(num) === -1;
    };
    BN2.prototype.lten = function lten(num) {
      return this.cmpn(num) <= 0;
    };
    BN2.prototype.lte = function lte(num) {
      return this.cmp(num) <= 0;
    };
    BN2.prototype.eqn = function eqn(num) {
      return this.cmpn(num) === 0;
    };
    BN2.prototype.eq = function eq4(num) {
      return this.cmp(num) === 0;
    };
    BN2.red = function red(num) {
      return new Red(num);
    };
    BN2.prototype.toRed = function toRed(ctx) {
      assert2(!this.red, "Already a number in reduction context");
      assert2(this.negative === 0, "red works only with positives");
      return ctx.convertTo(this)._forceRed(ctx);
    };
    BN2.prototype.fromRed = function fromRed() {
      assert2(this.red, "fromRed works only with numbers in reduction context");
      return this.red.convertFrom(this);
    };
    BN2.prototype._forceRed = function _forceRed(ctx) {
      this.red = ctx;
      return this;
    };
    BN2.prototype.forceRed = function forceRed(ctx) {
      assert2(!this.red, "Already a number in reduction context");
      return this._forceRed(ctx);
    };
    BN2.prototype.redAdd = function redAdd(num) {
      assert2(this.red, "redAdd works only with red numbers");
      return this.red.add(this, num);
    };
    BN2.prototype.redIAdd = function redIAdd(num) {
      assert2(this.red, "redIAdd works only with red numbers");
      return this.red.iadd(this, num);
    };
    BN2.prototype.redSub = function redSub(num) {
      assert2(this.red, "redSub works only with red numbers");
      return this.red.sub(this, num);
    };
    BN2.prototype.redISub = function redISub(num) {
      assert2(this.red, "redISub works only with red numbers");
      return this.red.isub(this, num);
    };
    BN2.prototype.redShl = function redShl(num) {
      assert2(this.red, "redShl works only with red numbers");
      return this.red.shl(this, num);
    };
    BN2.prototype.redMul = function redMul(num) {
      assert2(this.red, "redMul works only with red numbers");
      this.red._verify2(this, num);
      return this.red.mul(this, num);
    };
    BN2.prototype.redIMul = function redIMul(num) {
      assert2(this.red, "redMul works only with red numbers");
      this.red._verify2(this, num);
      return this.red.imul(this, num);
    };
    BN2.prototype.redSqr = function redSqr() {
      assert2(this.red, "redSqr works only with red numbers");
      this.red._verify1(this);
      return this.red.sqr(this);
    };
    BN2.prototype.redISqr = function redISqr() {
      assert2(this.red, "redISqr works only with red numbers");
      this.red._verify1(this);
      return this.red.isqr(this);
    };
    BN2.prototype.redSqrt = function redSqrt() {
      assert2(this.red, "redSqrt works only with red numbers");
      this.red._verify1(this);
      return this.red.sqrt(this);
    };
    BN2.prototype.redInvm = function redInvm() {
      assert2(this.red, "redInvm works only with red numbers");
      this.red._verify1(this);
      return this.red.invm(this);
    };
    BN2.prototype.redNeg = function redNeg() {
      assert2(this.red, "redNeg works only with red numbers");
      this.red._verify1(this);
      return this.red.neg(this);
    };
    BN2.prototype.redPow = function redPow(num) {
      assert2(this.red && !num.red, "redPow(normalNum)");
      this.red._verify1(this);
      return this.red.pow(this, num);
    };
    var primes = {
      k256: null,
      p224: null,
      p192: null,
      p25519: null
    };
    function MPrime(name, p2) {
      this.name = name;
      this.p = new BN2(p2, 16);
      this.n = this.p.bitLength();
      this.k = new BN2(1).iushln(this.n).isub(this.p);
      this.tmp = this._tmp();
    }
    MPrime.prototype._tmp = function _tmp() {
      var tmp = new BN2(null);
      tmp.words = new Array(Math.ceil(this.n / 13));
      return tmp;
    };
    MPrime.prototype.ireduce = function ireduce(num) {
      var r2 = num;
      var rlen;
      do {
        this.split(r2, this.tmp);
        r2 = this.imulK(r2);
        r2 = r2.iadd(this.tmp);
        rlen = r2.bitLength();
      } while (rlen > this.n);
      var cmp = rlen < this.n ? -1 : r2.ucmp(this.p);
      if (cmp === 0) {
        r2.words[0] = 0;
        r2.length = 1;
      } else if (cmp > 0) {
        r2.isub(this.p);
      } else {
        if (r2.strip !== void 0) {
          r2.strip();
        } else {
          r2._strip();
        }
      }
      return r2;
    };
    MPrime.prototype.split = function split(input, out) {
      input.iushrn(this.n, 0, out);
    };
    MPrime.prototype.imulK = function imulK(num) {
      return num.imul(this.k);
    };
    function K256() {
      MPrime.call(
        this,
        "k256",
        "ffffffff ffffffff ffffffff ffffffff ffffffff ffffffff fffffffe fffffc2f"
      );
    }
    inherits2(K256, MPrime);
    K256.prototype.split = function split(input, output) {
      var mask = 4194303;
      var outLen = Math.min(input.length, 9);
      for (var i = 0; i < outLen; i++) {
        output.words[i] = input.words[i];
      }
      output.length = outLen;
      if (input.length <= 9) {
        input.words[0] = 0;
        input.length = 1;
        return;
      }
      var prev = input.words[9];
      output.words[output.length++] = prev & mask;
      for (i = 10; i < input.length; i++) {
        var next = input.words[i] | 0;
        input.words[i - 10] = (next & mask) << 4 | prev >>> 22;
        prev = next;
      }
      prev >>>= 22;
      input.words[i - 10] = prev;
      if (prev === 0 && input.length > 10) {
        input.length -= 10;
      } else {
        input.length -= 9;
      }
    };
    K256.prototype.imulK = function imulK(num) {
      num.words[num.length] = 0;
      num.words[num.length + 1] = 0;
      num.length += 2;
      var lo = 0;
      for (var i = 0; i < num.length; i++) {
        var w2 = num.words[i] | 0;
        lo += w2 * 977;
        num.words[i] = lo & 67108863;
        lo = w2 * 64 + (lo / 67108864 | 0);
      }
      if (num.words[num.length - 1] === 0) {
        num.length--;
        if (num.words[num.length - 1] === 0) {
          num.length--;
        }
      }
      return num;
    };
    function P224() {
      MPrime.call(
        this,
        "p224",
        "ffffffff ffffffff ffffffff ffffffff 00000000 00000000 00000001"
      );
    }
    inherits2(P224, MPrime);
    function P192() {
      MPrime.call(
        this,
        "p192",
        "ffffffff ffffffff ffffffff fffffffe ffffffff ffffffff"
      );
    }
    inherits2(P192, MPrime);
    function P25519() {
      MPrime.call(
        this,
        "25519",
        "7fffffffffffffff ffffffffffffffff ffffffffffffffff ffffffffffffffed"
      );
    }
    inherits2(P25519, MPrime);
    P25519.prototype.imulK = function imulK(num) {
      var carry = 0;
      for (var i = 0; i < num.length; i++) {
        var hi = (num.words[i] | 0) * 19 + carry;
        var lo = hi & 67108863;
        hi >>>= 26;
        num.words[i] = lo;
        carry = hi;
      }
      if (carry !== 0) {
        num.words[num.length++] = carry;
      }
      return num;
    };
    BN2._prime = function prime(name) {
      if (primes[name])
        return primes[name];
      var prime2;
      if (name === "k256") {
        prime2 = new K256();
      } else if (name === "p224") {
        prime2 = new P224();
      } else if (name === "p192") {
        prime2 = new P192();
      } else if (name === "p25519") {
        prime2 = new P25519();
      } else {
        throw new Error("Unknown prime " + name);
      }
      primes[name] = prime2;
      return prime2;
    };
    function Red(m2) {
      if (typeof m2 === "string") {
        var prime = BN2._prime(m2);
        this.m = prime.p;
        this.prime = prime;
      } else {
        assert2(m2.gtn(1), "modulus must be greater than 1");
        this.m = m2;
        this.prime = null;
      }
    }
    Red.prototype._verify1 = function _verify1(a) {
      assert2(a.negative === 0, "red works only with positives");
      assert2(a.red, "red works only with red numbers");
    };
    Red.prototype._verify2 = function _verify2(a, b2) {
      assert2((a.negative | b2.negative) === 0, "red works only with positives");
      assert2(
        a.red && a.red === b2.red,
        "red works only with red numbers"
      );
    };
    Red.prototype.imod = function imod(a) {
      if (this.prime)
        return this.prime.ireduce(a)._forceRed(this);
      move(a, a.umod(this.m)._forceRed(this));
      return a;
    };
    Red.prototype.neg = function neg3(a) {
      if (a.isZero()) {
        return a.clone();
      }
      return this.m.sub(a)._forceRed(this);
    };
    Red.prototype.add = function add3(a, b2) {
      this._verify2(a, b2);
      var res = a.add(b2);
      if (res.cmp(this.m) >= 0) {
        res.isub(this.m);
      }
      return res._forceRed(this);
    };
    Red.prototype.iadd = function iadd(a, b2) {
      this._verify2(a, b2);
      var res = a.iadd(b2);
      if (res.cmp(this.m) >= 0) {
        res.isub(this.m);
      }
      return res;
    };
    Red.prototype.sub = function sub(a, b2) {
      this._verify2(a, b2);
      var res = a.sub(b2);
      if (res.cmpn(0) < 0) {
        res.iadd(this.m);
      }
      return res._forceRed(this);
    };
    Red.prototype.isub = function isub(a, b2) {
      this._verify2(a, b2);
      var res = a.isub(b2);
      if (res.cmpn(0) < 0) {
        res.iadd(this.m);
      }
      return res;
    };
    Red.prototype.shl = function shl(a, num) {
      this._verify1(a);
      return this.imod(a.ushln(num));
    };
    Red.prototype.imul = function imul(a, b2) {
      this._verify2(a, b2);
      return this.imod(a.imul(b2));
    };
    Red.prototype.mul = function mul3(a, b2) {
      this._verify2(a, b2);
      return this.imod(a.mul(b2));
    };
    Red.prototype.isqr = function isqr(a) {
      return this.imul(a, a.clone());
    };
    Red.prototype.sqr = function sqr(a) {
      return this.mul(a, a);
    };
    Red.prototype.sqrt = function sqrt(a) {
      if (a.isZero())
        return a.clone();
      var mod3 = this.m.andln(3);
      assert2(mod3 % 2 === 1);
      if (mod3 === 3) {
        var pow = this.m.add(new BN2(1)).iushrn(2);
        return this.pow(a, pow);
      }
      var q = this.m.subn(1);
      var s2 = 0;
      while (!q.isZero() && q.andln(1) === 0) {
        s2++;
        q.iushrn(1);
      }
      assert2(!q.isZero());
      var one = new BN2(1).toRed(this);
      var nOne = one.redNeg();
      var lpow = this.m.subn(1).iushrn(1);
      var z2 = this.m.bitLength();
      z2 = new BN2(2 * z2 * z2).toRed(this);
      while (this.pow(z2, lpow).cmp(nOne) !== 0) {
        z2.redIAdd(nOne);
      }
      var c = this.pow(z2, q);
      var r2 = this.pow(a, q.addn(1).iushrn(1));
      var t = this.pow(a, q);
      var m2 = s2;
      while (t.cmp(one) !== 0) {
        var tmp = t;
        for (var i = 0; tmp.cmp(one) !== 0; i++) {
          tmp = tmp.redSqr();
        }
        assert2(i < m2);
        var b2 = this.pow(c, new BN2(1).iushln(m2 - i - 1));
        r2 = r2.redMul(b2);
        c = b2.redSqr();
        t = t.redMul(c);
        m2 = i;
      }
      return r2;
    };
    Red.prototype.invm = function invm(a) {
      var inv = a._invmp(this.m);
      if (inv.negative !== 0) {
        inv.negative = 0;
        return this.imod(inv).redNeg();
      } else {
        return this.imod(inv);
      }
    };
    Red.prototype.pow = function pow(a, num) {
      if (num.isZero())
        return new BN2(1).toRed(this);
      if (num.cmpn(1) === 0)
        return a.clone();
      var windowSize = 4;
      var wnd = new Array(1 << windowSize);
      wnd[0] = new BN2(1).toRed(this);
      wnd[1] = a;
      for (var i = 2; i < wnd.length; i++) {
        wnd[i] = this.mul(wnd[i - 1], a);
      }
      var res = wnd[0];
      var current = 0;
      var currentLen = 0;
      var start = num.bitLength() % 26;
      if (start === 0) {
        start = 26;
      }
      for (i = num.length - 1; i >= 0; i--) {
        var word = num.words[i];
        for (var j2 = start - 1; j2 >= 0; j2--) {
          var bit = word >> j2 & 1;
          if (res !== wnd[0]) {
            res = this.sqr(res);
          }
          if (bit === 0 && current === 0) {
            currentLen = 0;
            continue;
          }
          current <<= 1;
          current |= bit;
          currentLen++;
          if (currentLen !== windowSize && (i !== 0 || j2 !== 0))
            continue;
          res = this.mul(res, wnd[current]);
          currentLen = 0;
          current = 0;
        }
        start = 26;
      }
      return res;
    };
    Red.prototype.convertTo = function convertTo(num) {
      var r2 = num.umod(this.m);
      return r2 === num ? r2.clone() : r2;
    };
    Red.prototype.convertFrom = function convertFrom(num) {
      var res = num.clone();
      res.red = null;
      return res;
    };
    BN2.mont = function mont(num) {
      return new Mont(num);
    };
    function Mont(m2) {
      Red.call(this, m2);
      this.shift = this.m.bitLength();
      if (this.shift % 26 !== 0) {
        this.shift += 26 - this.shift % 26;
      }
      this.r = new BN2(1).iushln(this.shift);
      this.r2 = this.imod(this.r.sqr());
      this.rinv = this.r._invmp(this.m);
      this.minv = this.rinv.mul(this.r).isubn(1).div(this.m);
      this.minv = this.minv.umod(this.r);
      this.minv = this.r.sub(this.minv);
    }
    inherits2(Mont, Red);
    Mont.prototype.convertTo = function convertTo(num) {
      return this.imod(num.ushln(this.shift));
    };
    Mont.prototype.convertFrom = function convertFrom(num) {
      var r2 = this.imod(num.mul(this.rinv));
      r2.red = null;
      return r2;
    };
    Mont.prototype.imul = function imul(a, b2) {
      if (a.isZero() || b2.isZero()) {
        a.words[0] = 0;
        a.length = 1;
        return a;
      }
      var t = a.imul(b2);
      var c = t.maskn(this.shift).mul(this.minv).imaskn(this.shift).mul(this.m);
      var u2 = t.isub(c).iushrn(this.shift);
      var res = u2;
      if (u2.cmp(this.m) >= 0) {
        res = u2.isub(this.m);
      } else if (u2.cmpn(0) < 0) {
        res = u2.iadd(this.m);
      }
      return res._forceRed(this);
    };
    Mont.prototype.mul = function mul3(a, b2) {
      if (a.isZero() || b2.isZero())
        return new BN2(0)._forceRed(this);
      var t = a.mul(b2);
      var c = t.maskn(this.shift).mul(this.minv).imaskn(this.shift).mul(this.m);
      var u2 = t.isub(c).iushrn(this.shift);
      var res = u2;
      if (u2.cmp(this.m) >= 0) {
        res = u2.isub(this.m);
      } else if (u2.cmpn(0) < 0) {
        res = u2.iadd(this.m);
      }
      return res._forceRed(this);
    };
    Mont.prototype.invm = function invm(a) {
      var res = this.imod(a._invmp(this.m).mul(this.r2));
      return res._forceRed(this);
    };
  })(module, commonjsGlobal);
})(bn);
var bnExports = bn.exports;
const BN$1 = /* @__PURE__ */ getDefaultExportFromCjs(bnExports);
var BN = BN$1.BN;
function _base36To16(value) {
  return new BN(value, 36).toString(16);
}
const version$2 = "strings/5.7.0";
const logger$2 = new Logger(version$2);
var UnicodeNormalizationForm;
(function(UnicodeNormalizationForm2) {
  UnicodeNormalizationForm2["current"] = "";
  UnicodeNormalizationForm2["NFC"] = "NFC";
  UnicodeNormalizationForm2["NFD"] = "NFD";
  UnicodeNormalizationForm2["NFKC"] = "NFKC";
  UnicodeNormalizationForm2["NFKD"] = "NFKD";
})(UnicodeNormalizationForm || (UnicodeNormalizationForm = {}));
var Utf8ErrorReason;
(function(Utf8ErrorReason2) {
  Utf8ErrorReason2["UNEXPECTED_CONTINUE"] = "unexpected continuation byte";
  Utf8ErrorReason2["BAD_PREFIX"] = "bad codepoint prefix";
  Utf8ErrorReason2["OVERRUN"] = "string overrun";
  Utf8ErrorReason2["MISSING_CONTINUE"] = "missing continuation byte";
  Utf8ErrorReason2["OUT_OF_RANGE"] = "out of UTF-8 range";
  Utf8ErrorReason2["UTF16_SURROGATE"] = "UTF-16 surrogate";
  Utf8ErrorReason2["OVERLONG"] = "overlong representation";
})(Utf8ErrorReason || (Utf8ErrorReason = {}));
function toUtf8Bytes(str, form = UnicodeNormalizationForm.current) {
  if (form != UnicodeNormalizationForm.current) {
    logger$2.checkNormalize();
    str = str.normalize(form);
  }
  let result = [];
  for (let i = 0; i < str.length; i++) {
    const c = str.charCodeAt(i);
    if (c < 128) {
      result.push(c);
    } else if (c < 2048) {
      result.push(c >> 6 | 192);
      result.push(c & 63 | 128);
    } else if ((c & 64512) == 55296) {
      i++;
      const c2 = str.charCodeAt(i);
      if (i >= str.length || (c2 & 64512) !== 56320) {
        throw new Error("invalid utf-8 string");
      }
      const pair = 65536 + ((c & 1023) << 10) + (c2 & 1023);
      result.push(pair >> 18 | 240);
      result.push(pair >> 12 & 63 | 128);
      result.push(pair >> 6 & 63 | 128);
      result.push(pair & 63 | 128);
    } else {
      result.push(c >> 12 | 224);
      result.push(c >> 6 & 63 | 128);
      result.push(c & 63 | 128);
    }
  }
  return arrayify(result);
}
const messagePrefix = "Ethereum Signed Message:\n";
function hashMessage(message) {
  if (typeof message === "string") {
    message = toUtf8Bytes(message);
  }
  return keccak256(concat([
    toUtf8Bytes(messagePrefix),
    toUtf8Bytes(String(message.length)),
    message
  ]));
}
const version$1 = "address/5.7.0";
const logger$1 = new Logger(version$1);
function getChecksumAddress(address) {
  if (!isHexString(address, 20)) {
    logger$1.throwArgumentError("invalid address", "address", address);
  }
  address = address.toLowerCase();
  const chars = address.substring(2).split("");
  const expanded = new Uint8Array(40);
  for (let i = 0; i < 40; i++) {
    expanded[i] = chars[i].charCodeAt(0);
  }
  const hashed = arrayify(keccak256(expanded));
  for (let i = 0; i < 40; i += 2) {
    if (hashed[i >> 1] >> 4 >= 8) {
      chars[i] = chars[i].toUpperCase();
    }
    if ((hashed[i >> 1] & 15) >= 8) {
      chars[i + 1] = chars[i + 1].toUpperCase();
    }
  }
  return "0x" + chars.join("");
}
const MAX_SAFE_INTEGER = 9007199254740991;
function log10(x2) {
  if (Math.log10) {
    return Math.log10(x2);
  }
  return Math.log(x2) / Math.LN10;
}
const ibanLookup = {};
for (let i = 0; i < 10; i++) {
  ibanLookup[String(i)] = String(i);
}
for (let i = 0; i < 26; i++) {
  ibanLookup[String.fromCharCode(65 + i)] = String(10 + i);
}
const safeDigits = Math.floor(log10(MAX_SAFE_INTEGER));
function ibanChecksum(address) {
  address = address.toUpperCase();
  address = address.substring(4) + address.substring(0, 2) + "00";
  let expanded = address.split("").map((c) => {
    return ibanLookup[c];
  }).join("");
  while (expanded.length >= safeDigits) {
    let block = expanded.substring(0, safeDigits);
    expanded = parseInt(block, 10) % 97 + expanded.substring(block.length);
  }
  let checksum = String(98 - parseInt(expanded, 10) % 97);
  while (checksum.length < 2) {
    checksum = "0" + checksum;
  }
  return checksum;
}
function getAddress(address) {
  let result = null;
  if (typeof address !== "string") {
    logger$1.throwArgumentError("invalid address", "address", address);
  }
  if (address.match(/^(0x)?[0-9a-fA-F]{40}$/)) {
    if (address.substring(0, 2) !== "0x") {
      address = "0x" + address;
    }
    result = getChecksumAddress(address);
    if (address.match(/([A-F].*[a-f])|([a-f].*[A-F])/) && result !== address) {
      logger$1.throwArgumentError("bad address checksum", "address", address);
    }
  } else if (address.match(/^XE[0-9]{2}[0-9A-Za-z]{30,31}$/)) {
    if (address.substring(2, 4) !== ibanChecksum(address)) {
      logger$1.throwArgumentError("bad icap checksum", "address", address);
    }
    result = _base36To16(address.substring(4));
    while (result.length < 40) {
      result = "0" + result;
    }
    result = getChecksumAddress("0x" + result);
  } else {
    logger$1.throwArgumentError("invalid address", "address", address);
  }
  return result;
}
globalThis && globalThis.__awaiter || function(thisArg, _arguments, P2, generator) {
  function adopt(value) {
    return value instanceof P2 ? value : new P2(function(resolve) {
      resolve(value);
    });
  }
  return new (P2 || (P2 = Promise))(function(resolve, reject) {
    function fulfilled(value) {
      try {
        step(generator.next(value));
      } catch (e) {
        reject(e);
      }
    }
    function rejected(value) {
      try {
        step(generator["throw"](value));
      } catch (e) {
        reject(e);
      }
    }
    function step(result) {
      result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected);
    }
    step((generator = generator.apply(thisArg, _arguments || [])).next());
  });
};
function defineReadOnly(object, name, value) {
  Object.defineProperty(object, name, {
    enumerable: true,
    value,
    writable: false
  });
}
var hash$1 = {};
var utils$9 = {};
var minimalisticAssert$1 = assert$b;
function assert$b(val, msg) {
  if (!val)
    throw new Error(msg || "Assertion failed");
}
assert$b.equal = function assertEqual(l2, r2, msg) {
  if (l2 != r2)
    throw new Error(msg || "Assertion failed: " + l2 + " != " + r2);
};
var inherits_browser$1 = { exports: {} };
if (typeof Object.create === "function") {
  inherits_browser$1.exports = function inherits2(ctor, superCtor) {
    if (superCtor) {
      ctor.super_ = superCtor;
      ctor.prototype = Object.create(superCtor.prototype, {
        constructor: {
          value: ctor,
          enumerable: false,
          writable: true,
          configurable: true
        }
      });
    }
  };
} else {
  inherits_browser$1.exports = function inherits2(ctor, superCtor) {
    if (superCtor) {
      ctor.super_ = superCtor;
      var TempCtor = function() {
      };
      TempCtor.prototype = superCtor.prototype;
      ctor.prototype = new TempCtor();
      ctor.prototype.constructor = ctor;
    }
  };
}
var inherits_browserExports = inherits_browser$1.exports;
var assert$a = minimalisticAssert$1;
var inherits = inherits_browserExports;
utils$9.inherits = inherits;
function isSurrogatePair(msg, i) {
  if ((msg.charCodeAt(i) & 64512) !== 55296) {
    return false;
  }
  if (i < 0 || i + 1 >= msg.length) {
    return false;
  }
  return (msg.charCodeAt(i + 1) & 64512) === 56320;
}
function toArray(msg, enc) {
  if (Array.isArray(msg))
    return msg.slice();
  if (!msg)
    return [];
  var res = [];
  if (typeof msg === "string") {
    if (!enc) {
      var p2 = 0;
      for (var i = 0; i < msg.length; i++) {
        var c = msg.charCodeAt(i);
        if (c < 128) {
          res[p2++] = c;
        } else if (c < 2048) {
          res[p2++] = c >> 6 | 192;
          res[p2++] = c & 63 | 128;
        } else if (isSurrogatePair(msg, i)) {
          c = 65536 + ((c & 1023) << 10) + (msg.charCodeAt(++i) & 1023);
          res[p2++] = c >> 18 | 240;
          res[p2++] = c >> 12 & 63 | 128;
          res[p2++] = c >> 6 & 63 | 128;
          res[p2++] = c & 63 | 128;
        } else {
          res[p2++] = c >> 12 | 224;
          res[p2++] = c >> 6 & 63 | 128;
          res[p2++] = c & 63 | 128;
        }
      }
    } else if (enc === "hex") {
      msg = msg.replace(/[^a-z0-9]+/ig, "");
      if (msg.length % 2 !== 0)
        msg = "0" + msg;
      for (i = 0; i < msg.length; i += 2)
        res.push(parseInt(msg[i] + msg[i + 1], 16));
    }
  } else {
    for (i = 0; i < msg.length; i++)
      res[i] = msg[i] | 0;
  }
  return res;
}
utils$9.toArray = toArray;
function toHex(msg) {
  var res = "";
  for (var i = 0; i < msg.length; i++)
    res += zero2(msg[i].toString(16));
  return res;
}
utils$9.toHex = toHex;
function htonl(w2) {
  var res = w2 >>> 24 | w2 >>> 8 & 65280 | w2 << 8 & 16711680 | (w2 & 255) << 24;
  return res >>> 0;
}
utils$9.htonl = htonl;
function toHex32(msg, endian) {
  var res = "";
  for (var i = 0; i < msg.length; i++) {
    var w2 = msg[i];
    if (endian === "little")
      w2 = htonl(w2);
    res += zero8(w2.toString(16));
  }
  return res;
}
utils$9.toHex32 = toHex32;
function zero2(word) {
  if (word.length === 1)
    return "0" + word;
  else
    return word;
}
utils$9.zero2 = zero2;
function zero8(word) {
  if (word.length === 7)
    return "0" + word;
  else if (word.length === 6)
    return "00" + word;
  else if (word.length === 5)
    return "000" + word;
  else if (word.length === 4)
    return "0000" + word;
  else if (word.length === 3)
    return "00000" + word;
  else if (word.length === 2)
    return "000000" + word;
  else if (word.length === 1)
    return "0000000" + word;
  else
    return word;
}
utils$9.zero8 = zero8;
function join32(msg, start, end, endian) {
  var len = end - start;
  assert$a(len % 4 === 0);
  var res = new Array(len / 4);
  for (var i = 0, k2 = start; i < res.length; i++, k2 += 4) {
    var w2;
    if (endian === "big")
      w2 = msg[k2] << 24 | msg[k2 + 1] << 16 | msg[k2 + 2] << 8 | msg[k2 + 3];
    else
      w2 = msg[k2 + 3] << 24 | msg[k2 + 2] << 16 | msg[k2 + 1] << 8 | msg[k2];
    res[i] = w2 >>> 0;
  }
  return res;
}
utils$9.join32 = join32;
function split32(msg, endian) {
  var res = new Array(msg.length * 4);
  for (var i = 0, k2 = 0; i < msg.length; i++, k2 += 4) {
    var m2 = msg[i];
    if (endian === "big") {
      res[k2] = m2 >>> 24;
      res[k2 + 1] = m2 >>> 16 & 255;
      res[k2 + 2] = m2 >>> 8 & 255;
      res[k2 + 3] = m2 & 255;
    } else {
      res[k2 + 3] = m2 >>> 24;
      res[k2 + 2] = m2 >>> 16 & 255;
      res[k2 + 1] = m2 >>> 8 & 255;
      res[k2] = m2 & 255;
    }
  }
  return res;
}
utils$9.split32 = split32;
function rotr32$1(w2, b2) {
  return w2 >>> b2 | w2 << 32 - b2;
}
utils$9.rotr32 = rotr32$1;
function rotl32$2(w2, b2) {
  return w2 << b2 | w2 >>> 32 - b2;
}
utils$9.rotl32 = rotl32$2;
function sum32$3(a, b2) {
  return a + b2 >>> 0;
}
utils$9.sum32 = sum32$3;
function sum32_3$1(a, b2, c) {
  return a + b2 + c >>> 0;
}
utils$9.sum32_3 = sum32_3$1;
function sum32_4$2(a, b2, c, d2) {
  return a + b2 + c + d2 >>> 0;
}
utils$9.sum32_4 = sum32_4$2;
function sum32_5$2(a, b2, c, d2, e) {
  return a + b2 + c + d2 + e >>> 0;
}
utils$9.sum32_5 = sum32_5$2;
function sum64$1(buf, pos, ah, al) {
  var bh = buf[pos];
  var bl = buf[pos + 1];
  var lo = al + bl >>> 0;
  var hi = (lo < al ? 1 : 0) + ah + bh;
  buf[pos] = hi >>> 0;
  buf[pos + 1] = lo;
}
utils$9.sum64 = sum64$1;
function sum64_hi$1(ah, al, bh, bl) {
  var lo = al + bl >>> 0;
  var hi = (lo < al ? 1 : 0) + ah + bh;
  return hi >>> 0;
}
utils$9.sum64_hi = sum64_hi$1;
function sum64_lo$1(ah, al, bh, bl) {
  var lo = al + bl;
  return lo >>> 0;
}
utils$9.sum64_lo = sum64_lo$1;
function sum64_4_hi$1(ah, al, bh, bl, ch, cl, dh, dl) {
  var carry = 0;
  var lo = al;
  lo = lo + bl >>> 0;
  carry += lo < al ? 1 : 0;
  lo = lo + cl >>> 0;
  carry += lo < cl ? 1 : 0;
  lo = lo + dl >>> 0;
  carry += lo < dl ? 1 : 0;
  var hi = ah + bh + ch + dh + carry;
  return hi >>> 0;
}
utils$9.sum64_4_hi = sum64_4_hi$1;
function sum64_4_lo$1(ah, al, bh, bl, ch, cl, dh, dl) {
  var lo = al + bl + cl + dl;
  return lo >>> 0;
}
utils$9.sum64_4_lo = sum64_4_lo$1;
function sum64_5_hi$1(ah, al, bh, bl, ch, cl, dh, dl, eh, el) {
  var carry = 0;
  var lo = al;
  lo = lo + bl >>> 0;
  carry += lo < al ? 1 : 0;
  lo = lo + cl >>> 0;
  carry += lo < cl ? 1 : 0;
  lo = lo + dl >>> 0;
  carry += lo < dl ? 1 : 0;
  lo = lo + el >>> 0;
  carry += lo < el ? 1 : 0;
  var hi = ah + bh + ch + dh + eh + carry;
  return hi >>> 0;
}
utils$9.sum64_5_hi = sum64_5_hi$1;
function sum64_5_lo$1(ah, al, bh, bl, ch, cl, dh, dl, eh, el) {
  var lo = al + bl + cl + dl + el;
  return lo >>> 0;
}
utils$9.sum64_5_lo = sum64_5_lo$1;
function rotr64_hi$1(ah, al, num) {
  var r2 = al << 32 - num | ah >>> num;
  return r2 >>> 0;
}
utils$9.rotr64_hi = rotr64_hi$1;
function rotr64_lo$1(ah, al, num) {
  var r2 = ah << 32 - num | al >>> num;
  return r2 >>> 0;
}
utils$9.rotr64_lo = rotr64_lo$1;
function shr64_hi$1(ah, al, num) {
  return ah >>> num;
}
utils$9.shr64_hi = shr64_hi$1;
function shr64_lo$1(ah, al, num) {
  var r2 = ah << 32 - num | al >>> num;
  return r2 >>> 0;
}
utils$9.shr64_lo = shr64_lo$1;
var common$5 = {};
var utils$8 = utils$9;
var assert$9 = minimalisticAssert$1;
function BlockHash$4() {
  this.pending = null;
  this.pendingTotal = 0;
  this.blockSize = this.constructor.blockSize;
  this.outSize = this.constructor.outSize;
  this.hmacStrength = this.constructor.hmacStrength;
  this.padLength = this.constructor.padLength / 8;
  this.endian = "big";
  this._delta8 = this.blockSize / 8;
  this._delta32 = this.blockSize / 32;
}
common$5.BlockHash = BlockHash$4;
BlockHash$4.prototype.update = function update(msg, enc) {
  msg = utils$8.toArray(msg, enc);
  if (!this.pending)
    this.pending = msg;
  else
    this.pending = this.pending.concat(msg);
  this.pendingTotal += msg.length;
  if (this.pending.length >= this._delta8) {
    msg = this.pending;
    var r2 = msg.length % this._delta8;
    this.pending = msg.slice(msg.length - r2, msg.length);
    if (this.pending.length === 0)
      this.pending = null;
    msg = utils$8.join32(msg, 0, msg.length - r2, this.endian);
    for (var i = 0; i < msg.length; i += this._delta32)
      this._update(msg, i, i + this._delta32);
  }
  return this;
};
BlockHash$4.prototype.digest = function digest(enc) {
  this.update(this._pad());
  assert$9(this.pending === null);
  return this._digest(enc);
};
BlockHash$4.prototype._pad = function pad() {
  var len = this.pendingTotal;
  var bytes = this._delta8;
  var k2 = bytes - (len + this.padLength) % bytes;
  var res = new Array(k2 + this.padLength);
  res[0] = 128;
  for (var i = 1; i < k2; i++)
    res[i] = 0;
  len <<= 3;
  if (this.endian === "big") {
    for (var t = 8; t < this.padLength; t++)
      res[i++] = 0;
    res[i++] = 0;
    res[i++] = 0;
    res[i++] = 0;
    res[i++] = 0;
    res[i++] = len >>> 24 & 255;
    res[i++] = len >>> 16 & 255;
    res[i++] = len >>> 8 & 255;
    res[i++] = len & 255;
  } else {
    res[i++] = len & 255;
    res[i++] = len >>> 8 & 255;
    res[i++] = len >>> 16 & 255;
    res[i++] = len >>> 24 & 255;
    res[i++] = 0;
    res[i++] = 0;
    res[i++] = 0;
    res[i++] = 0;
    for (t = 8; t < this.padLength; t++)
      res[i++] = 0;
  }
  return res;
};
var sha = {};
var common$4 = {};
var utils$7 = utils$9;
var rotr32 = utils$7.rotr32;
function ft_1$1(s2, x2, y2, z2) {
  if (s2 === 0)
    return ch32$1(x2, y2, z2);
  if (s2 === 1 || s2 === 3)
    return p32(x2, y2, z2);
  if (s2 === 2)
    return maj32$1(x2, y2, z2);
}
common$4.ft_1 = ft_1$1;
function ch32$1(x2, y2, z2) {
  return x2 & y2 ^ ~x2 & z2;
}
common$4.ch32 = ch32$1;
function maj32$1(x2, y2, z2) {
  return x2 & y2 ^ x2 & z2 ^ y2 & z2;
}
common$4.maj32 = maj32$1;
function p32(x2, y2, z2) {
  return x2 ^ y2 ^ z2;
}
common$4.p32 = p32;
function s0_256$1(x2) {
  return rotr32(x2, 2) ^ rotr32(x2, 13) ^ rotr32(x2, 22);
}
common$4.s0_256 = s0_256$1;
function s1_256$1(x2) {
  return rotr32(x2, 6) ^ rotr32(x2, 11) ^ rotr32(x2, 25);
}
common$4.s1_256 = s1_256$1;
function g0_256$1(x2) {
  return rotr32(x2, 7) ^ rotr32(x2, 18) ^ x2 >>> 3;
}
common$4.g0_256 = g0_256$1;
function g1_256$1(x2) {
  return rotr32(x2, 17) ^ rotr32(x2, 19) ^ x2 >>> 10;
}
common$4.g1_256 = g1_256$1;
var utils$6 = utils$9;
var common$3 = common$5;
var shaCommon$1 = common$4;
var rotl32$1 = utils$6.rotl32;
var sum32$2 = utils$6.sum32;
var sum32_5$1 = utils$6.sum32_5;
var ft_1 = shaCommon$1.ft_1;
var BlockHash$3 = common$3.BlockHash;
var sha1_K = [
  1518500249,
  1859775393,
  2400959708,
  3395469782
];
function SHA1() {
  if (!(this instanceof SHA1))
    return new SHA1();
  BlockHash$3.call(this);
  this.h = [
    1732584193,
    4023233417,
    2562383102,
    271733878,
    3285377520
  ];
  this.W = new Array(80);
}
utils$6.inherits(SHA1, BlockHash$3);
var _1 = SHA1;
SHA1.blockSize = 512;
SHA1.outSize = 160;
SHA1.hmacStrength = 80;
SHA1.padLength = 64;
SHA1.prototype._update = function _update(msg, start) {
  var W2 = this.W;
  for (var i = 0; i < 16; i++)
    W2[i] = msg[start + i];
  for (; i < W2.length; i++)
    W2[i] = rotl32$1(W2[i - 3] ^ W2[i - 8] ^ W2[i - 14] ^ W2[i - 16], 1);
  var a = this.h[0];
  var b2 = this.h[1];
  var c = this.h[2];
  var d2 = this.h[3];
  var e = this.h[4];
  for (i = 0; i < W2.length; i++) {
    var s2 = ~~(i / 20);
    var t = sum32_5$1(rotl32$1(a, 5), ft_1(s2, b2, c, d2), e, W2[i], sha1_K[s2]);
    e = d2;
    d2 = c;
    c = rotl32$1(b2, 30);
    b2 = a;
    a = t;
  }
  this.h[0] = sum32$2(this.h[0], a);
  this.h[1] = sum32$2(this.h[1], b2);
  this.h[2] = sum32$2(this.h[2], c);
  this.h[3] = sum32$2(this.h[3], d2);
  this.h[4] = sum32$2(this.h[4], e);
};
SHA1.prototype._digest = function digest2(enc) {
  if (enc === "hex")
    return utils$6.toHex32(this.h, "big");
  else
    return utils$6.split32(this.h, "big");
};
var utils$5 = utils$9;
var common$2 = common$5;
var shaCommon = common$4;
var assert$8 = minimalisticAssert$1;
var sum32$1 = utils$5.sum32;
var sum32_4$1 = utils$5.sum32_4;
var sum32_5 = utils$5.sum32_5;
var ch32 = shaCommon.ch32;
var maj32 = shaCommon.maj32;
var s0_256 = shaCommon.s0_256;
var s1_256 = shaCommon.s1_256;
var g0_256 = shaCommon.g0_256;
var g1_256 = shaCommon.g1_256;
var BlockHash$2 = common$2.BlockHash;
var sha256_K = [
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
function SHA256$1() {
  if (!(this instanceof SHA256$1))
    return new SHA256$1();
  BlockHash$2.call(this);
  this.h = [
    1779033703,
    3144134277,
    1013904242,
    2773480762,
    1359893119,
    2600822924,
    528734635,
    1541459225
  ];
  this.k = sha256_K;
  this.W = new Array(64);
}
utils$5.inherits(SHA256$1, BlockHash$2);
var _256 = SHA256$1;
SHA256$1.blockSize = 512;
SHA256$1.outSize = 256;
SHA256$1.hmacStrength = 192;
SHA256$1.padLength = 64;
SHA256$1.prototype._update = function _update2(msg, start) {
  var W2 = this.W;
  for (var i = 0; i < 16; i++)
    W2[i] = msg[start + i];
  for (; i < W2.length; i++)
    W2[i] = sum32_4$1(g1_256(W2[i - 2]), W2[i - 7], g0_256(W2[i - 15]), W2[i - 16]);
  var a = this.h[0];
  var b2 = this.h[1];
  var c = this.h[2];
  var d2 = this.h[3];
  var e = this.h[4];
  var f2 = this.h[5];
  var g2 = this.h[6];
  var h2 = this.h[7];
  assert$8(this.k.length === W2.length);
  for (i = 0; i < W2.length; i++) {
    var T1 = sum32_5(h2, s1_256(e), ch32(e, f2, g2), this.k[i], W2[i]);
    var T2 = sum32$1(s0_256(a), maj32(a, b2, c));
    h2 = g2;
    g2 = f2;
    f2 = e;
    e = sum32$1(d2, T1);
    d2 = c;
    c = b2;
    b2 = a;
    a = sum32$1(T1, T2);
  }
  this.h[0] = sum32$1(this.h[0], a);
  this.h[1] = sum32$1(this.h[1], b2);
  this.h[2] = sum32$1(this.h[2], c);
  this.h[3] = sum32$1(this.h[3], d2);
  this.h[4] = sum32$1(this.h[4], e);
  this.h[5] = sum32$1(this.h[5], f2);
  this.h[6] = sum32$1(this.h[6], g2);
  this.h[7] = sum32$1(this.h[7], h2);
};
SHA256$1.prototype._digest = function digest3(enc) {
  if (enc === "hex")
    return utils$5.toHex32(this.h, "big");
  else
    return utils$5.split32(this.h, "big");
};
var utils$4 = utils$9;
var SHA256 = _256;
function SHA224() {
  if (!(this instanceof SHA224))
    return new SHA224();
  SHA256.call(this);
  this.h = [
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
utils$4.inherits(SHA224, SHA256);
var _224 = SHA224;
SHA224.blockSize = 512;
SHA224.outSize = 224;
SHA224.hmacStrength = 192;
SHA224.padLength = 64;
SHA224.prototype._digest = function digest4(enc) {
  if (enc === "hex")
    return utils$4.toHex32(this.h.slice(0, 7), "big");
  else
    return utils$4.split32(this.h.slice(0, 7), "big");
};
var utils$3 = utils$9;
var common$1 = common$5;
var assert$7 = minimalisticAssert$1;
var rotr64_hi = utils$3.rotr64_hi;
var rotr64_lo = utils$3.rotr64_lo;
var shr64_hi = utils$3.shr64_hi;
var shr64_lo = utils$3.shr64_lo;
var sum64 = utils$3.sum64;
var sum64_hi = utils$3.sum64_hi;
var sum64_lo = utils$3.sum64_lo;
var sum64_4_hi = utils$3.sum64_4_hi;
var sum64_4_lo = utils$3.sum64_4_lo;
var sum64_5_hi = utils$3.sum64_5_hi;
var sum64_5_lo = utils$3.sum64_5_lo;
var BlockHash$1 = common$1.BlockHash;
var sha512_K = [
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
function SHA512$1() {
  if (!(this instanceof SHA512$1))
    return new SHA512$1();
  BlockHash$1.call(this);
  this.h = [
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
  ];
  this.k = sha512_K;
  this.W = new Array(160);
}
utils$3.inherits(SHA512$1, BlockHash$1);
var _512 = SHA512$1;
SHA512$1.blockSize = 1024;
SHA512$1.outSize = 512;
SHA512$1.hmacStrength = 192;
SHA512$1.padLength = 128;
SHA512$1.prototype._prepareBlock = function _prepareBlock(msg, start) {
  var W2 = this.W;
  for (var i = 0; i < 32; i++)
    W2[i] = msg[start + i];
  for (; i < W2.length; i += 2) {
    var c0_hi = g1_512_hi(W2[i - 4], W2[i - 3]);
    var c0_lo = g1_512_lo(W2[i - 4], W2[i - 3]);
    var c1_hi = W2[i - 14];
    var c1_lo = W2[i - 13];
    var c2_hi = g0_512_hi(W2[i - 30], W2[i - 29]);
    var c2_lo = g0_512_lo(W2[i - 30], W2[i - 29]);
    var c3_hi = W2[i - 32];
    var c3_lo = W2[i - 31];
    W2[i] = sum64_4_hi(
      c0_hi,
      c0_lo,
      c1_hi,
      c1_lo,
      c2_hi,
      c2_lo,
      c3_hi,
      c3_lo
    );
    W2[i + 1] = sum64_4_lo(
      c0_hi,
      c0_lo,
      c1_hi,
      c1_lo,
      c2_hi,
      c2_lo,
      c3_hi,
      c3_lo
    );
  }
};
SHA512$1.prototype._update = function _update3(msg, start) {
  this._prepareBlock(msg, start);
  var W2 = this.W;
  var ah = this.h[0];
  var al = this.h[1];
  var bh = this.h[2];
  var bl = this.h[3];
  var ch = this.h[4];
  var cl = this.h[5];
  var dh = this.h[6];
  var dl = this.h[7];
  var eh = this.h[8];
  var el = this.h[9];
  var fh = this.h[10];
  var fl = this.h[11];
  var gh = this.h[12];
  var gl = this.h[13];
  var hh = this.h[14];
  var hl = this.h[15];
  assert$7(this.k.length === W2.length);
  for (var i = 0; i < W2.length; i += 2) {
    var c0_hi = hh;
    var c0_lo = hl;
    var c1_hi = s1_512_hi(eh, el);
    var c1_lo = s1_512_lo(eh, el);
    var c2_hi = ch64_hi(eh, el, fh, fl, gh);
    var c2_lo = ch64_lo(eh, el, fh, fl, gh, gl);
    var c3_hi = this.k[i];
    var c3_lo = this.k[i + 1];
    var c4_hi = W2[i];
    var c4_lo = W2[i + 1];
    var T1_hi = sum64_5_hi(
      c0_hi,
      c0_lo,
      c1_hi,
      c1_lo,
      c2_hi,
      c2_lo,
      c3_hi,
      c3_lo,
      c4_hi,
      c4_lo
    );
    var T1_lo = sum64_5_lo(
      c0_hi,
      c0_lo,
      c1_hi,
      c1_lo,
      c2_hi,
      c2_lo,
      c3_hi,
      c3_lo,
      c4_hi,
      c4_lo
    );
    c0_hi = s0_512_hi(ah, al);
    c0_lo = s0_512_lo(ah, al);
    c1_hi = maj64_hi(ah, al, bh, bl, ch);
    c1_lo = maj64_lo(ah, al, bh, bl, ch, cl);
    var T2_hi = sum64_hi(c0_hi, c0_lo, c1_hi, c1_lo);
    var T2_lo = sum64_lo(c0_hi, c0_lo, c1_hi, c1_lo);
    hh = gh;
    hl = gl;
    gh = fh;
    gl = fl;
    fh = eh;
    fl = el;
    eh = sum64_hi(dh, dl, T1_hi, T1_lo);
    el = sum64_lo(dl, dl, T1_hi, T1_lo);
    dh = ch;
    dl = cl;
    ch = bh;
    cl = bl;
    bh = ah;
    bl = al;
    ah = sum64_hi(T1_hi, T1_lo, T2_hi, T2_lo);
    al = sum64_lo(T1_hi, T1_lo, T2_hi, T2_lo);
  }
  sum64(this.h, 0, ah, al);
  sum64(this.h, 2, bh, bl);
  sum64(this.h, 4, ch, cl);
  sum64(this.h, 6, dh, dl);
  sum64(this.h, 8, eh, el);
  sum64(this.h, 10, fh, fl);
  sum64(this.h, 12, gh, gl);
  sum64(this.h, 14, hh, hl);
};
SHA512$1.prototype._digest = function digest5(enc) {
  if (enc === "hex")
    return utils$3.toHex32(this.h, "big");
  else
    return utils$3.split32(this.h, "big");
};
function ch64_hi(xh, xl, yh, yl, zh) {
  var r2 = xh & yh ^ ~xh & zh;
  if (r2 < 0)
    r2 += 4294967296;
  return r2;
}
function ch64_lo(xh, xl, yh, yl, zh, zl) {
  var r2 = xl & yl ^ ~xl & zl;
  if (r2 < 0)
    r2 += 4294967296;
  return r2;
}
function maj64_hi(xh, xl, yh, yl, zh) {
  var r2 = xh & yh ^ xh & zh ^ yh & zh;
  if (r2 < 0)
    r2 += 4294967296;
  return r2;
}
function maj64_lo(xh, xl, yh, yl, zh, zl) {
  var r2 = xl & yl ^ xl & zl ^ yl & zl;
  if (r2 < 0)
    r2 += 4294967296;
  return r2;
}
function s0_512_hi(xh, xl) {
  var c0_hi = rotr64_hi(xh, xl, 28);
  var c1_hi = rotr64_hi(xl, xh, 2);
  var c2_hi = rotr64_hi(xl, xh, 7);
  var r2 = c0_hi ^ c1_hi ^ c2_hi;
  if (r2 < 0)
    r2 += 4294967296;
  return r2;
}
function s0_512_lo(xh, xl) {
  var c0_lo = rotr64_lo(xh, xl, 28);
  var c1_lo = rotr64_lo(xl, xh, 2);
  var c2_lo = rotr64_lo(xl, xh, 7);
  var r2 = c0_lo ^ c1_lo ^ c2_lo;
  if (r2 < 0)
    r2 += 4294967296;
  return r2;
}
function s1_512_hi(xh, xl) {
  var c0_hi = rotr64_hi(xh, xl, 14);
  var c1_hi = rotr64_hi(xh, xl, 18);
  var c2_hi = rotr64_hi(xl, xh, 9);
  var r2 = c0_hi ^ c1_hi ^ c2_hi;
  if (r2 < 0)
    r2 += 4294967296;
  return r2;
}
function s1_512_lo(xh, xl) {
  var c0_lo = rotr64_lo(xh, xl, 14);
  var c1_lo = rotr64_lo(xh, xl, 18);
  var c2_lo = rotr64_lo(xl, xh, 9);
  var r2 = c0_lo ^ c1_lo ^ c2_lo;
  if (r2 < 0)
    r2 += 4294967296;
  return r2;
}
function g0_512_hi(xh, xl) {
  var c0_hi = rotr64_hi(xh, xl, 1);
  var c1_hi = rotr64_hi(xh, xl, 8);
  var c2_hi = shr64_hi(xh, xl, 7);
  var r2 = c0_hi ^ c1_hi ^ c2_hi;
  if (r2 < 0)
    r2 += 4294967296;
  return r2;
}
function g0_512_lo(xh, xl) {
  var c0_lo = rotr64_lo(xh, xl, 1);
  var c1_lo = rotr64_lo(xh, xl, 8);
  var c2_lo = shr64_lo(xh, xl, 7);
  var r2 = c0_lo ^ c1_lo ^ c2_lo;
  if (r2 < 0)
    r2 += 4294967296;
  return r2;
}
function g1_512_hi(xh, xl) {
  var c0_hi = rotr64_hi(xh, xl, 19);
  var c1_hi = rotr64_hi(xl, xh, 29);
  var c2_hi = shr64_hi(xh, xl, 6);
  var r2 = c0_hi ^ c1_hi ^ c2_hi;
  if (r2 < 0)
    r2 += 4294967296;
  return r2;
}
function g1_512_lo(xh, xl) {
  var c0_lo = rotr64_lo(xh, xl, 19);
  var c1_lo = rotr64_lo(xl, xh, 29);
  var c2_lo = shr64_lo(xh, xl, 6);
  var r2 = c0_lo ^ c1_lo ^ c2_lo;
  if (r2 < 0)
    r2 += 4294967296;
  return r2;
}
var utils$2 = utils$9;
var SHA512 = _512;
function SHA384() {
  if (!(this instanceof SHA384))
    return new SHA384();
  SHA512.call(this);
  this.h = [
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
utils$2.inherits(SHA384, SHA512);
var _384 = SHA384;
SHA384.blockSize = 1024;
SHA384.outSize = 384;
SHA384.hmacStrength = 192;
SHA384.padLength = 128;
SHA384.prototype._digest = function digest6(enc) {
  if (enc === "hex")
    return utils$2.toHex32(this.h.slice(0, 12), "big");
  else
    return utils$2.split32(this.h.slice(0, 12), "big");
};
sha.sha1 = _1;
sha.sha224 = _224;
sha.sha256 = _256;
sha.sha384 = _384;
sha.sha512 = _512;
var ripemd = {};
var utils$1 = utils$9;
var common = common$5;
var rotl32 = utils$1.rotl32;
var sum32 = utils$1.sum32;
var sum32_3 = utils$1.sum32_3;
var sum32_4 = utils$1.sum32_4;
var BlockHash = common.BlockHash;
function RIPEMD160() {
  if (!(this instanceof RIPEMD160))
    return new RIPEMD160();
  BlockHash.call(this);
  this.h = [1732584193, 4023233417, 2562383102, 271733878, 3285377520];
  this.endian = "little";
}
utils$1.inherits(RIPEMD160, BlockHash);
ripemd.ripemd160 = RIPEMD160;
RIPEMD160.blockSize = 512;
RIPEMD160.outSize = 160;
RIPEMD160.hmacStrength = 192;
RIPEMD160.padLength = 64;
RIPEMD160.prototype._update = function update2(msg, start) {
  var A2 = this.h[0];
  var B2 = this.h[1];
  var C2 = this.h[2];
  var D2 = this.h[3];
  var E2 = this.h[4];
  var Ah = A2;
  var Bh = B2;
  var Ch = C2;
  var Dh = D2;
  var Eh = E2;
  for (var j2 = 0; j2 < 80; j2++) {
    var T2 = sum32(
      rotl32(
        sum32_4(A2, f$1(j2, B2, C2, D2), msg[r[j2] + start], K$2(j2)),
        s[j2]
      ),
      E2
    );
    A2 = E2;
    E2 = D2;
    D2 = rotl32(C2, 10);
    C2 = B2;
    B2 = T2;
    T2 = sum32(
      rotl32(
        sum32_4(Ah, f$1(79 - j2, Bh, Ch, Dh), msg[rh[j2] + start], Kh(j2)),
        sh[j2]
      ),
      Eh
    );
    Ah = Eh;
    Eh = Dh;
    Dh = rotl32(Ch, 10);
    Ch = Bh;
    Bh = T2;
  }
  T2 = sum32_3(this.h[1], C2, Dh);
  this.h[1] = sum32_3(this.h[2], D2, Eh);
  this.h[2] = sum32_3(this.h[3], E2, Ah);
  this.h[3] = sum32_3(this.h[4], A2, Bh);
  this.h[4] = sum32_3(this.h[0], B2, Ch);
  this.h[0] = T2;
};
RIPEMD160.prototype._digest = function digest7(enc) {
  if (enc === "hex")
    return utils$1.toHex32(this.h, "little");
  else
    return utils$1.split32(this.h, "little");
};
function f$1(j2, x2, y2, z2) {
  if (j2 <= 15)
    return x2 ^ y2 ^ z2;
  else if (j2 <= 31)
    return x2 & y2 | ~x2 & z2;
  else if (j2 <= 47)
    return (x2 | ~y2) ^ z2;
  else if (j2 <= 63)
    return x2 & z2 | y2 & ~z2;
  else
    return x2 ^ (y2 | ~z2);
}
function K$2(j2) {
  if (j2 <= 15)
    return 0;
  else if (j2 <= 31)
    return 1518500249;
  else if (j2 <= 47)
    return 1859775393;
  else if (j2 <= 63)
    return 2400959708;
  else
    return 2840853838;
}
function Kh(j2) {
  if (j2 <= 15)
    return 1352829926;
  else if (j2 <= 31)
    return 1548603684;
  else if (j2 <= 47)
    return 1836072691;
  else if (j2 <= 63)
    return 2053994217;
  else
    return 0;
}
var r = [
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
];
var rh = [
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
];
var s = [
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
];
var sh = [
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
];
var utils = utils$9;
var assert$6 = minimalisticAssert$1;
function Hmac(hash2, key2, enc) {
  if (!(this instanceof Hmac))
    return new Hmac(hash2, key2, enc);
  this.Hash = hash2;
  this.blockSize = hash2.blockSize / 8;
  this.outSize = hash2.outSize / 8;
  this.inner = null;
  this.outer = null;
  this._init(utils.toArray(key2, enc));
}
var hmac = Hmac;
Hmac.prototype._init = function init(key2) {
  if (key2.length > this.blockSize)
    key2 = new this.Hash().update(key2).digest();
  assert$6(key2.length <= this.blockSize);
  for (var i = key2.length; i < this.blockSize; i++)
    key2.push(0);
  for (i = 0; i < key2.length; i++)
    key2[i] ^= 54;
  this.inner = new this.Hash().update(key2);
  for (i = 0; i < key2.length; i++)
    key2[i] ^= 106;
  this.outer = new this.Hash().update(key2);
};
Hmac.prototype.update = function update3(msg, enc) {
  this.inner.update(msg, enc);
  return this;
};
Hmac.prototype.digest = function digest8(enc) {
  this.outer.update(this.inner.digest());
  return this.outer.digest(enc);
};
(function(exports) {
  var hash2 = exports;
  hash2.utils = utils$9;
  hash2.common = common$5;
  hash2.sha = sha;
  hash2.ripemd = ripemd;
  hash2.hmac = hmac;
  hash2.sha1 = hash2.sha.sha1;
  hash2.sha256 = hash2.sha.sha256;
  hash2.sha224 = hash2.sha.sha224;
  hash2.sha384 = hash2.sha.sha384;
  hash2.sha512 = hash2.sha.sha512;
  hash2.ripemd160 = hash2.ripemd.ripemd160;
})(hash$1);
const hash = /* @__PURE__ */ getDefaultExportFromCjs(hash$1);
function createCommonjsModule(fn, basedir, module) {
  return module = {
    path: basedir,
    exports: {},
    require: function(path, base2) {
      return commonjsRequire(path, base2 === void 0 || base2 === null ? module.path : base2);
    }
  }, fn(module, module.exports), module.exports;
}
function commonjsRequire() {
  throw new Error("Dynamic requires are not currently supported by @rollup/plugin-commonjs");
}
var minimalisticAssert = assert;
function assert(val, msg) {
  if (!val)
    throw new Error(msg || "Assertion failed");
}
assert.equal = function assertEqual2(l2, r2, msg) {
  if (l2 != r2)
    throw new Error(msg || "Assertion failed: " + l2 + " != " + r2);
};
var utils_1 = createCommonjsModule(function(module, exports) {
  var utils2 = exports;
  function toArray2(msg, enc) {
    if (Array.isArray(msg))
      return msg.slice();
    if (!msg)
      return [];
    var res = [];
    if (typeof msg !== "string") {
      for (var i = 0; i < msg.length; i++)
        res[i] = msg[i] | 0;
      return res;
    }
    if (enc === "hex") {
      msg = msg.replace(/[^a-z0-9]+/ig, "");
      if (msg.length % 2 !== 0)
        msg = "0" + msg;
      for (var i = 0; i < msg.length; i += 2)
        res.push(parseInt(msg[i] + msg[i + 1], 16));
    } else {
      for (var i = 0; i < msg.length; i++) {
        var c = msg.charCodeAt(i);
        var hi = c >> 8;
        var lo = c & 255;
        if (hi)
          res.push(hi, lo);
        else
          res.push(lo);
      }
    }
    return res;
  }
  utils2.toArray = toArray2;
  function zero22(word) {
    if (word.length === 1)
      return "0" + word;
    else
      return word;
  }
  utils2.zero2 = zero22;
  function toHex2(msg) {
    var res = "";
    for (var i = 0; i < msg.length; i++)
      res += zero22(msg[i].toString(16));
    return res;
  }
  utils2.toHex = toHex2;
  utils2.encode = function encode2(arr, enc) {
    if (enc === "hex")
      return toHex2(arr);
    else
      return arr;
  };
});
var utils_1$1 = createCommonjsModule(function(module, exports) {
  var utils2 = exports;
  utils2.assert = minimalisticAssert;
  utils2.toArray = utils_1.toArray;
  utils2.zero2 = utils_1.zero2;
  utils2.toHex = utils_1.toHex;
  utils2.encode = utils_1.encode;
  function getNAF2(num, w2, bits) {
    var naf = new Array(Math.max(num.bitLength(), bits) + 1);
    naf.fill(0);
    var ws = 1 << w2 + 1;
    var k2 = num.clone();
    for (var i = 0; i < naf.length; i++) {
      var z2;
      var mod = k2.andln(ws - 1);
      if (k2.isOdd()) {
        if (mod > (ws >> 1) - 1)
          z2 = (ws >> 1) - mod;
        else
          z2 = mod;
        k2.isubn(z2);
      } else {
        z2 = 0;
      }
      naf[i] = z2;
      k2.iushrn(1);
    }
    return naf;
  }
  utils2.getNAF = getNAF2;
  function getJSF2(k1, k2) {
    var jsf = [
      [],
      []
    ];
    k1 = k1.clone();
    k2 = k2.clone();
    var d1 = 0;
    var d2 = 0;
    var m8;
    while (k1.cmpn(-d1) > 0 || k2.cmpn(-d2) > 0) {
      var m14 = k1.andln(3) + d1 & 3;
      var m24 = k2.andln(3) + d2 & 3;
      if (m14 === 3)
        m14 = -1;
      if (m24 === 3)
        m24 = -1;
      var u1;
      if ((m14 & 1) === 0) {
        u1 = 0;
      } else {
        m8 = k1.andln(7) + d1 & 7;
        if ((m8 === 3 || m8 === 5) && m24 === 2)
          u1 = -m14;
        else
          u1 = m14;
      }
      jsf[0].push(u1);
      var u2;
      if ((m24 & 1) === 0) {
        u2 = 0;
      } else {
        m8 = k2.andln(7) + d2 & 7;
        if ((m8 === 3 || m8 === 5) && m14 === 2)
          u2 = -m24;
        else
          u2 = m24;
      }
      jsf[1].push(u2);
      if (2 * d1 === u1 + 1)
        d1 = 1 - d1;
      if (2 * d2 === u2 + 1)
        d2 = 1 - d2;
      k1.iushrn(1);
      k2.iushrn(1);
    }
    return jsf;
  }
  utils2.getJSF = getJSF2;
  function cachedProperty(obj, name, computer) {
    var key2 = "_" + name;
    obj.prototype[name] = function cachedProperty2() {
      return this[key2] !== void 0 ? this[key2] : this[key2] = computer.call(this);
    };
  }
  utils2.cachedProperty = cachedProperty;
  function parseBytes(bytes) {
    return typeof bytes === "string" ? utils2.toArray(bytes, "hex") : bytes;
  }
  utils2.parseBytes = parseBytes;
  function intFromLE(bytes) {
    return new BN$1(bytes, "hex", "le");
  }
  utils2.intFromLE = intFromLE;
});
var getNAF = utils_1$1.getNAF;
var getJSF = utils_1$1.getJSF;
var assert$1 = utils_1$1.assert;
function BaseCurve(type, conf) {
  this.type = type;
  this.p = new BN$1(conf.p, 16);
  this.red = conf.prime ? BN$1.red(conf.prime) : BN$1.mont(this.p);
  this.zero = new BN$1(0).toRed(this.red);
  this.one = new BN$1(1).toRed(this.red);
  this.two = new BN$1(2).toRed(this.red);
  this.n = conf.n && new BN$1(conf.n, 16);
  this.g = conf.g && this.pointFromJSON(conf.g, conf.gRed);
  this._wnafT1 = new Array(4);
  this._wnafT2 = new Array(4);
  this._wnafT3 = new Array(4);
  this._wnafT4 = new Array(4);
  this._bitLength = this.n ? this.n.bitLength() : 0;
  var adjustCount = this.n && this.p.div(this.n);
  if (!adjustCount || adjustCount.cmpn(100) > 0) {
    this.redN = null;
  } else {
    this._maxwellTrick = true;
    this.redN = this.n.toRed(this.red);
  }
}
var base = BaseCurve;
BaseCurve.prototype.point = function point() {
  throw new Error("Not implemented");
};
BaseCurve.prototype.validate = function validate() {
  throw new Error("Not implemented");
};
BaseCurve.prototype._fixedNafMul = function _fixedNafMul(p2, k2) {
  assert$1(p2.precomputed);
  var doubles = p2._getDoubles();
  var naf = getNAF(k2, 1, this._bitLength);
  var I2 = (1 << doubles.step + 1) - (doubles.step % 2 === 0 ? 2 : 1);
  I2 /= 3;
  var repr = [];
  var j2;
  var nafW;
  for (j2 = 0; j2 < naf.length; j2 += doubles.step) {
    nafW = 0;
    for (var l2 = j2 + doubles.step - 1; l2 >= j2; l2--)
      nafW = (nafW << 1) + naf[l2];
    repr.push(nafW);
  }
  var a = this.jpoint(null, null, null);
  var b2 = this.jpoint(null, null, null);
  for (var i = I2; i > 0; i--) {
    for (j2 = 0; j2 < repr.length; j2++) {
      nafW = repr[j2];
      if (nafW === i)
        b2 = b2.mixedAdd(doubles.points[j2]);
      else if (nafW === -i)
        b2 = b2.mixedAdd(doubles.points[j2].neg());
    }
    a = a.add(b2);
  }
  return a.toP();
};
BaseCurve.prototype._wnafMul = function _wnafMul(p2, k2) {
  var w2 = 4;
  var nafPoints = p2._getNAFPoints(w2);
  w2 = nafPoints.wnd;
  var wnd = nafPoints.points;
  var naf = getNAF(k2, w2, this._bitLength);
  var acc = this.jpoint(null, null, null);
  for (var i = naf.length - 1; i >= 0; i--) {
    for (var l2 = 0; i >= 0 && naf[i] === 0; i--)
      l2++;
    if (i >= 0)
      l2++;
    acc = acc.dblp(l2);
    if (i < 0)
      break;
    var z2 = naf[i];
    assert$1(z2 !== 0);
    if (p2.type === "affine") {
      if (z2 > 0)
        acc = acc.mixedAdd(wnd[z2 - 1 >> 1]);
      else
        acc = acc.mixedAdd(wnd[-z2 - 1 >> 1].neg());
    } else {
      if (z2 > 0)
        acc = acc.add(wnd[z2 - 1 >> 1]);
      else
        acc = acc.add(wnd[-z2 - 1 >> 1].neg());
    }
  }
  return p2.type === "affine" ? acc.toP() : acc;
};
BaseCurve.prototype._wnafMulAdd = function _wnafMulAdd(defW, points, coeffs, len, jacobianResult) {
  var wndWidth = this._wnafT1;
  var wnd = this._wnafT2;
  var naf = this._wnafT3;
  var max = 0;
  var i;
  var j2;
  var p2;
  for (i = 0; i < len; i++) {
    p2 = points[i];
    var nafPoints = p2._getNAFPoints(defW);
    wndWidth[i] = nafPoints.wnd;
    wnd[i] = nafPoints.points;
  }
  for (i = len - 1; i >= 1; i -= 2) {
    var a = i - 1;
    var b2 = i;
    if (wndWidth[a] !== 1 || wndWidth[b2] !== 1) {
      naf[a] = getNAF(coeffs[a], wndWidth[a], this._bitLength);
      naf[b2] = getNAF(coeffs[b2], wndWidth[b2], this._bitLength);
      max = Math.max(naf[a].length, max);
      max = Math.max(naf[b2].length, max);
      continue;
    }
    var comb = [
      points[a],
      /* 1 */
      null,
      /* 3 */
      null,
      /* 5 */
      points[b2]
      /* 7 */
    ];
    if (points[a].y.cmp(points[b2].y) === 0) {
      comb[1] = points[a].add(points[b2]);
      comb[2] = points[a].toJ().mixedAdd(points[b2].neg());
    } else if (points[a].y.cmp(points[b2].y.redNeg()) === 0) {
      comb[1] = points[a].toJ().mixedAdd(points[b2]);
      comb[2] = points[a].add(points[b2].neg());
    } else {
      comb[1] = points[a].toJ().mixedAdd(points[b2]);
      comb[2] = points[a].toJ().mixedAdd(points[b2].neg());
    }
    var index = [
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
    ];
    var jsf = getJSF(coeffs[a], coeffs[b2]);
    max = Math.max(jsf[0].length, max);
    naf[a] = new Array(max);
    naf[b2] = new Array(max);
    for (j2 = 0; j2 < max; j2++) {
      var ja = jsf[0][j2] | 0;
      var jb = jsf[1][j2] | 0;
      naf[a][j2] = index[(ja + 1) * 3 + (jb + 1)];
      naf[b2][j2] = 0;
      wnd[a] = comb;
    }
  }
  var acc = this.jpoint(null, null, null);
  var tmp = this._wnafT4;
  for (i = max; i >= 0; i--) {
    var k2 = 0;
    while (i >= 0) {
      var zero = true;
      for (j2 = 0; j2 < len; j2++) {
        tmp[j2] = naf[j2][i] | 0;
        if (tmp[j2] !== 0)
          zero = false;
      }
      if (!zero)
        break;
      k2++;
      i--;
    }
    if (i >= 0)
      k2++;
    acc = acc.dblp(k2);
    if (i < 0)
      break;
    for (j2 = 0; j2 < len; j2++) {
      var z2 = tmp[j2];
      if (z2 === 0)
        continue;
      else if (z2 > 0)
        p2 = wnd[j2][z2 - 1 >> 1];
      else if (z2 < 0)
        p2 = wnd[j2][-z2 - 1 >> 1].neg();
      if (p2.type === "affine")
        acc = acc.mixedAdd(p2);
      else
        acc = acc.add(p2);
    }
  }
  for (i = 0; i < len; i++)
    wnd[i] = null;
  if (jacobianResult)
    return acc;
  else
    return acc.toP();
};
function BasePoint(curve, type) {
  this.curve = curve;
  this.type = type;
  this.precomputed = null;
}
BaseCurve.BasePoint = BasePoint;
BasePoint.prototype.eq = function eq() {
  throw new Error("Not implemented");
};
BasePoint.prototype.validate = function validate2() {
  return this.curve.validate(this);
};
BaseCurve.prototype.decodePoint = function decodePoint(bytes, enc) {
  bytes = utils_1$1.toArray(bytes, enc);
  var len = this.p.byteLength();
  if ((bytes[0] === 4 || bytes[0] === 6 || bytes[0] === 7) && bytes.length - 1 === 2 * len) {
    if (bytes[0] === 6)
      assert$1(bytes[bytes.length - 1] % 2 === 0);
    else if (bytes[0] === 7)
      assert$1(bytes[bytes.length - 1] % 2 === 1);
    var res = this.point(
      bytes.slice(1, 1 + len),
      bytes.slice(1 + len, 1 + 2 * len)
    );
    return res;
  } else if ((bytes[0] === 2 || bytes[0] === 3) && bytes.length - 1 === len) {
    return this.pointFromX(bytes.slice(1, 1 + len), bytes[0] === 3);
  }
  throw new Error("Unknown point format");
};
BasePoint.prototype.encodeCompressed = function encodeCompressed(enc) {
  return this.encode(enc, true);
};
BasePoint.prototype._encode = function _encode(compact) {
  var len = this.curve.p.byteLength();
  var x2 = this.getX().toArray("be", len);
  if (compact)
    return [this.getY().isEven() ? 2 : 3].concat(x2);
  return [4].concat(x2, this.getY().toArray("be", len));
};
BasePoint.prototype.encode = function encode(enc, compact) {
  return utils_1$1.encode(this._encode(compact), enc);
};
BasePoint.prototype.precompute = function precompute(power) {
  if (this.precomputed)
    return this;
  var precomputed = {
    doubles: null,
    naf: null,
    beta: null
  };
  precomputed.naf = this._getNAFPoints(8);
  precomputed.doubles = this._getDoubles(4, power);
  precomputed.beta = this._getBeta();
  this.precomputed = precomputed;
  return this;
};
BasePoint.prototype._hasDoubles = function _hasDoubles(k2) {
  if (!this.precomputed)
    return false;
  var doubles = this.precomputed.doubles;
  if (!doubles)
    return false;
  return doubles.points.length >= Math.ceil((k2.bitLength() + 1) / doubles.step);
};
BasePoint.prototype._getDoubles = function _getDoubles(step, power) {
  if (this.precomputed && this.precomputed.doubles)
    return this.precomputed.doubles;
  var doubles = [this];
  var acc = this;
  for (var i = 0; i < power; i += step) {
    for (var j2 = 0; j2 < step; j2++)
      acc = acc.dbl();
    doubles.push(acc);
  }
  return {
    step,
    points: doubles
  };
};
BasePoint.prototype._getNAFPoints = function _getNAFPoints(wnd) {
  if (this.precomputed && this.precomputed.naf)
    return this.precomputed.naf;
  var res = [this];
  var max = (1 << wnd) - 1;
  var dbl3 = max === 1 ? null : this.dbl();
  for (var i = 1; i < max; i++)
    res[i] = res[i - 1].add(dbl3);
  return {
    wnd,
    points: res
  };
};
BasePoint.prototype._getBeta = function _getBeta() {
  return null;
};
BasePoint.prototype.dblp = function dblp(k2) {
  var r2 = this;
  for (var i = 0; i < k2; i++)
    r2 = r2.dbl();
  return r2;
};
var inherits_browser = createCommonjsModule(function(module) {
  if (typeof Object.create === "function") {
    module.exports = function inherits2(ctor, superCtor) {
      if (superCtor) {
        ctor.super_ = superCtor;
        ctor.prototype = Object.create(superCtor.prototype, {
          constructor: {
            value: ctor,
            enumerable: false,
            writable: true,
            configurable: true
          }
        });
      }
    };
  } else {
    module.exports = function inherits2(ctor, superCtor) {
      if (superCtor) {
        ctor.super_ = superCtor;
        var TempCtor = function() {
        };
        TempCtor.prototype = superCtor.prototype;
        ctor.prototype = new TempCtor();
        ctor.prototype.constructor = ctor;
      }
    };
  }
});
var assert$2 = utils_1$1.assert;
function ShortCurve(conf) {
  base.call(this, "short", conf);
  this.a = new BN$1(conf.a, 16).toRed(this.red);
  this.b = new BN$1(conf.b, 16).toRed(this.red);
  this.tinv = this.two.redInvm();
  this.zeroA = this.a.fromRed().cmpn(0) === 0;
  this.threeA = this.a.fromRed().sub(this.p).cmpn(-3) === 0;
  this.endo = this._getEndomorphism(conf);
  this._endoWnafT1 = new Array(4);
  this._endoWnafT2 = new Array(4);
}
inherits_browser(ShortCurve, base);
var short_1 = ShortCurve;
ShortCurve.prototype._getEndomorphism = function _getEndomorphism(conf) {
  if (!this.zeroA || !this.g || !this.n || this.p.modn(3) !== 1)
    return;
  var beta;
  var lambda;
  if (conf.beta) {
    beta = new BN$1(conf.beta, 16).toRed(this.red);
  } else {
    var betas = this._getEndoRoots(this.p);
    beta = betas[0].cmp(betas[1]) < 0 ? betas[0] : betas[1];
    beta = beta.toRed(this.red);
  }
  if (conf.lambda) {
    lambda = new BN$1(conf.lambda, 16);
  } else {
    var lambdas = this._getEndoRoots(this.n);
    if (this.g.mul(lambdas[0]).x.cmp(this.g.x.redMul(beta)) === 0) {
      lambda = lambdas[0];
    } else {
      lambda = lambdas[1];
      assert$2(this.g.mul(lambda).x.cmp(this.g.x.redMul(beta)) === 0);
    }
  }
  var basis;
  if (conf.basis) {
    basis = conf.basis.map(function(vec) {
      return {
        a: new BN$1(vec.a, 16),
        b: new BN$1(vec.b, 16)
      };
    });
  } else {
    basis = this._getEndoBasis(lambda);
  }
  return {
    beta,
    lambda,
    basis
  };
};
ShortCurve.prototype._getEndoRoots = function _getEndoRoots(num) {
  var red = num === this.p ? this.red : BN$1.mont(num);
  var tinv = new BN$1(2).toRed(red).redInvm();
  var ntinv = tinv.redNeg();
  var s2 = new BN$1(3).toRed(red).redNeg().redSqrt().redMul(tinv);
  var l1 = ntinv.redAdd(s2).fromRed();
  var l2 = ntinv.redSub(s2).fromRed();
  return [l1, l2];
};
ShortCurve.prototype._getEndoBasis = function _getEndoBasis(lambda) {
  var aprxSqrt = this.n.ushrn(Math.floor(this.n.bitLength() / 2));
  var u2 = lambda;
  var v2 = this.n.clone();
  var x1 = new BN$1(1);
  var y1 = new BN$1(0);
  var x2 = new BN$1(0);
  var y2 = new BN$1(1);
  var a0;
  var b0;
  var a1;
  var b1;
  var a2;
  var b2;
  var prevR;
  var i = 0;
  var r2;
  var x3;
  while (u2.cmpn(0) !== 0) {
    var q = v2.div(u2);
    r2 = v2.sub(q.mul(u2));
    x3 = x2.sub(q.mul(x1));
    var y3 = y2.sub(q.mul(y1));
    if (!a1 && r2.cmp(aprxSqrt) < 0) {
      a0 = prevR.neg();
      b0 = x1;
      a1 = r2.neg();
      b1 = x3;
    } else if (a1 && ++i === 2) {
      break;
    }
    prevR = r2;
    v2 = u2;
    u2 = r2;
    x2 = x1;
    x1 = x3;
    y2 = y1;
    y1 = y3;
  }
  a2 = r2.neg();
  b2 = x3;
  var len1 = a1.sqr().add(b1.sqr());
  var len2 = a2.sqr().add(b2.sqr());
  if (len2.cmp(len1) >= 0) {
    a2 = a0;
    b2 = b0;
  }
  if (a1.negative) {
    a1 = a1.neg();
    b1 = b1.neg();
  }
  if (a2.negative) {
    a2 = a2.neg();
    b2 = b2.neg();
  }
  return [
    { a: a1, b: b1 },
    { a: a2, b: b2 }
  ];
};
ShortCurve.prototype._endoSplit = function _endoSplit(k2) {
  var basis = this.endo.basis;
  var v1 = basis[0];
  var v2 = basis[1];
  var c1 = v2.b.mul(k2).divRound(this.n);
  var c2 = v1.b.neg().mul(k2).divRound(this.n);
  var p1 = c1.mul(v1.a);
  var p2 = c2.mul(v2.a);
  var q1 = c1.mul(v1.b);
  var q2 = c2.mul(v2.b);
  var k1 = k2.sub(p1).sub(p2);
  var k22 = q1.add(q2).neg();
  return { k1, k2: k22 };
};
ShortCurve.prototype.pointFromX = function pointFromX(x2, odd) {
  x2 = new BN$1(x2, 16);
  if (!x2.red)
    x2 = x2.toRed(this.red);
  var y2 = x2.redSqr().redMul(x2).redIAdd(x2.redMul(this.a)).redIAdd(this.b);
  var y3 = y2.redSqrt();
  if (y3.redSqr().redSub(y2).cmp(this.zero) !== 0)
    throw new Error("invalid point");
  var isOdd = y3.fromRed().isOdd();
  if (odd && !isOdd || !odd && isOdd)
    y3 = y3.redNeg();
  return this.point(x2, y3);
};
ShortCurve.prototype.validate = function validate3(point3) {
  if (point3.inf)
    return true;
  var x2 = point3.x;
  var y2 = point3.y;
  var ax = this.a.redMul(x2);
  var rhs = x2.redSqr().redMul(x2).redIAdd(ax).redIAdd(this.b);
  return y2.redSqr().redISub(rhs).cmpn(0) === 0;
};
ShortCurve.prototype._endoWnafMulAdd = function _endoWnafMulAdd(points, coeffs, jacobianResult) {
  var npoints = this._endoWnafT1;
  var ncoeffs = this._endoWnafT2;
  for (var i = 0; i < points.length; i++) {
    var split = this._endoSplit(coeffs[i]);
    var p2 = points[i];
    var beta = p2._getBeta();
    if (split.k1.negative) {
      split.k1.ineg();
      p2 = p2.neg(true);
    }
    if (split.k2.negative) {
      split.k2.ineg();
      beta = beta.neg(true);
    }
    npoints[i * 2] = p2;
    npoints[i * 2 + 1] = beta;
    ncoeffs[i * 2] = split.k1;
    ncoeffs[i * 2 + 1] = split.k2;
  }
  var res = this._wnafMulAdd(1, npoints, ncoeffs, i * 2, jacobianResult);
  for (var j2 = 0; j2 < i * 2; j2++) {
    npoints[j2] = null;
    ncoeffs[j2] = null;
  }
  return res;
};
function Point(curve, x2, y2, isRed) {
  base.BasePoint.call(this, curve, "affine");
  if (x2 === null && y2 === null) {
    this.x = null;
    this.y = null;
    this.inf = true;
  } else {
    this.x = new BN$1(x2, 16);
    this.y = new BN$1(y2, 16);
    if (isRed) {
      this.x.forceRed(this.curve.red);
      this.y.forceRed(this.curve.red);
    }
    if (!this.x.red)
      this.x = this.x.toRed(this.curve.red);
    if (!this.y.red)
      this.y = this.y.toRed(this.curve.red);
    this.inf = false;
  }
}
inherits_browser(Point, base.BasePoint);
ShortCurve.prototype.point = function point2(x2, y2, isRed) {
  return new Point(this, x2, y2, isRed);
};
ShortCurve.prototype.pointFromJSON = function pointFromJSON(obj, red) {
  return Point.fromJSON(this, obj, red);
};
Point.prototype._getBeta = function _getBeta2() {
  if (!this.curve.endo)
    return;
  var pre = this.precomputed;
  if (pre && pre.beta)
    return pre.beta;
  var beta = this.curve.point(this.x.redMul(this.curve.endo.beta), this.y);
  if (pre) {
    var curve = this.curve;
    var endoMul = function(p2) {
      return curve.point(p2.x.redMul(curve.endo.beta), p2.y);
    };
    pre.beta = beta;
    beta.precomputed = {
      beta: null,
      naf: pre.naf && {
        wnd: pre.naf.wnd,
        points: pre.naf.points.map(endoMul)
      },
      doubles: pre.doubles && {
        step: pre.doubles.step,
        points: pre.doubles.points.map(endoMul)
      }
    };
  }
  return beta;
};
Point.prototype.toJSON = function toJSON() {
  if (!this.precomputed)
    return [this.x, this.y];
  return [this.x, this.y, this.precomputed && {
    doubles: this.precomputed.doubles && {
      step: this.precomputed.doubles.step,
      points: this.precomputed.doubles.points.slice(1)
    },
    naf: this.precomputed.naf && {
      wnd: this.precomputed.naf.wnd,
      points: this.precomputed.naf.points.slice(1)
    }
  }];
};
Point.fromJSON = function fromJSON(curve, obj, red) {
  if (typeof obj === "string")
    obj = JSON.parse(obj);
  var res = curve.point(obj[0], obj[1], red);
  if (!obj[2])
    return res;
  function obj2point(obj2) {
    return curve.point(obj2[0], obj2[1], red);
  }
  var pre = obj[2];
  res.precomputed = {
    beta: null,
    doubles: pre.doubles && {
      step: pre.doubles.step,
      points: [res].concat(pre.doubles.points.map(obj2point))
    },
    naf: pre.naf && {
      wnd: pre.naf.wnd,
      points: [res].concat(pre.naf.points.map(obj2point))
    }
  };
  return res;
};
Point.prototype.inspect = function inspect() {
  if (this.isInfinity())
    return "<EC Point Infinity>";
  return "<EC Point x: " + this.x.fromRed().toString(16, 2) + " y: " + this.y.fromRed().toString(16, 2) + ">";
};
Point.prototype.isInfinity = function isInfinity() {
  return this.inf;
};
Point.prototype.add = function add(p2) {
  if (this.inf)
    return p2;
  if (p2.inf)
    return this;
  if (this.eq(p2))
    return this.dbl();
  if (this.neg().eq(p2))
    return this.curve.point(null, null);
  if (this.x.cmp(p2.x) === 0)
    return this.curve.point(null, null);
  var c = this.y.redSub(p2.y);
  if (c.cmpn(0) !== 0)
    c = c.redMul(this.x.redSub(p2.x).redInvm());
  var nx = c.redSqr().redISub(this.x).redISub(p2.x);
  var ny = c.redMul(this.x.redSub(nx)).redISub(this.y);
  return this.curve.point(nx, ny);
};
Point.prototype.dbl = function dbl() {
  if (this.inf)
    return this;
  var ys1 = this.y.redAdd(this.y);
  if (ys1.cmpn(0) === 0)
    return this.curve.point(null, null);
  var a = this.curve.a;
  var x2 = this.x.redSqr();
  var dyinv = ys1.redInvm();
  var c = x2.redAdd(x2).redIAdd(x2).redIAdd(a).redMul(dyinv);
  var nx = c.redSqr().redISub(this.x.redAdd(this.x));
  var ny = c.redMul(this.x.redSub(nx)).redISub(this.y);
  return this.curve.point(nx, ny);
};
Point.prototype.getX = function getX() {
  return this.x.fromRed();
};
Point.prototype.getY = function getY() {
  return this.y.fromRed();
};
Point.prototype.mul = function mul(k2) {
  k2 = new BN$1(k2, 16);
  if (this.isInfinity())
    return this;
  else if (this._hasDoubles(k2))
    return this.curve._fixedNafMul(this, k2);
  else if (this.curve.endo)
    return this.curve._endoWnafMulAdd([this], [k2]);
  else
    return this.curve._wnafMul(this, k2);
};
Point.prototype.mulAdd = function mulAdd(k1, p2, k2) {
  var points = [this, p2];
  var coeffs = [k1, k2];
  if (this.curve.endo)
    return this.curve._endoWnafMulAdd(points, coeffs);
  else
    return this.curve._wnafMulAdd(1, points, coeffs, 2);
};
Point.prototype.jmulAdd = function jmulAdd(k1, p2, k2) {
  var points = [this, p2];
  var coeffs = [k1, k2];
  if (this.curve.endo)
    return this.curve._endoWnafMulAdd(points, coeffs, true);
  else
    return this.curve._wnafMulAdd(1, points, coeffs, 2, true);
};
Point.prototype.eq = function eq2(p2) {
  return this === p2 || this.inf === p2.inf && (this.inf || this.x.cmp(p2.x) === 0 && this.y.cmp(p2.y) === 0);
};
Point.prototype.neg = function neg(_precompute) {
  if (this.inf)
    return this;
  var res = this.curve.point(this.x, this.y.redNeg());
  if (_precompute && this.precomputed) {
    var pre = this.precomputed;
    var negate = function(p2) {
      return p2.neg();
    };
    res.precomputed = {
      naf: pre.naf && {
        wnd: pre.naf.wnd,
        points: pre.naf.points.map(negate)
      },
      doubles: pre.doubles && {
        step: pre.doubles.step,
        points: pre.doubles.points.map(negate)
      }
    };
  }
  return res;
};
Point.prototype.toJ = function toJ() {
  if (this.inf)
    return this.curve.jpoint(null, null, null);
  var res = this.curve.jpoint(this.x, this.y, this.curve.one);
  return res;
};
function JPoint(curve, x2, y2, z2) {
  base.BasePoint.call(this, curve, "jacobian");
  if (x2 === null && y2 === null && z2 === null) {
    this.x = this.curve.one;
    this.y = this.curve.one;
    this.z = new BN$1(0);
  } else {
    this.x = new BN$1(x2, 16);
    this.y = new BN$1(y2, 16);
    this.z = new BN$1(z2, 16);
  }
  if (!this.x.red)
    this.x = this.x.toRed(this.curve.red);
  if (!this.y.red)
    this.y = this.y.toRed(this.curve.red);
  if (!this.z.red)
    this.z = this.z.toRed(this.curve.red);
  this.zOne = this.z === this.curve.one;
}
inherits_browser(JPoint, base.BasePoint);
ShortCurve.prototype.jpoint = function jpoint(x2, y2, z2) {
  return new JPoint(this, x2, y2, z2);
};
JPoint.prototype.toP = function toP() {
  if (this.isInfinity())
    return this.curve.point(null, null);
  var zinv = this.z.redInvm();
  var zinv2 = zinv.redSqr();
  var ax = this.x.redMul(zinv2);
  var ay = this.y.redMul(zinv2).redMul(zinv);
  return this.curve.point(ax, ay);
};
JPoint.prototype.neg = function neg2() {
  return this.curve.jpoint(this.x, this.y.redNeg(), this.z);
};
JPoint.prototype.add = function add2(p2) {
  if (this.isInfinity())
    return p2;
  if (p2.isInfinity())
    return this;
  var pz2 = p2.z.redSqr();
  var z2 = this.z.redSqr();
  var u1 = this.x.redMul(pz2);
  var u2 = p2.x.redMul(z2);
  var s1 = this.y.redMul(pz2.redMul(p2.z));
  var s2 = p2.y.redMul(z2.redMul(this.z));
  var h2 = u1.redSub(u2);
  var r2 = s1.redSub(s2);
  if (h2.cmpn(0) === 0) {
    if (r2.cmpn(0) !== 0)
      return this.curve.jpoint(null, null, null);
    else
      return this.dbl();
  }
  var h22 = h2.redSqr();
  var h3 = h22.redMul(h2);
  var v2 = u1.redMul(h22);
  var nx = r2.redSqr().redIAdd(h3).redISub(v2).redISub(v2);
  var ny = r2.redMul(v2.redISub(nx)).redISub(s1.redMul(h3));
  var nz = this.z.redMul(p2.z).redMul(h2);
  return this.curve.jpoint(nx, ny, nz);
};
JPoint.prototype.mixedAdd = function mixedAdd(p2) {
  if (this.isInfinity())
    return p2.toJ();
  if (p2.isInfinity())
    return this;
  var z2 = this.z.redSqr();
  var u1 = this.x;
  var u2 = p2.x.redMul(z2);
  var s1 = this.y;
  var s2 = p2.y.redMul(z2).redMul(this.z);
  var h2 = u1.redSub(u2);
  var r2 = s1.redSub(s2);
  if (h2.cmpn(0) === 0) {
    if (r2.cmpn(0) !== 0)
      return this.curve.jpoint(null, null, null);
    else
      return this.dbl();
  }
  var h22 = h2.redSqr();
  var h3 = h22.redMul(h2);
  var v2 = u1.redMul(h22);
  var nx = r2.redSqr().redIAdd(h3).redISub(v2).redISub(v2);
  var ny = r2.redMul(v2.redISub(nx)).redISub(s1.redMul(h3));
  var nz = this.z.redMul(h2);
  return this.curve.jpoint(nx, ny, nz);
};
JPoint.prototype.dblp = function dblp2(pow) {
  if (pow === 0)
    return this;
  if (this.isInfinity())
    return this;
  if (!pow)
    return this.dbl();
  var i;
  if (this.curve.zeroA || this.curve.threeA) {
    var r2 = this;
    for (i = 0; i < pow; i++)
      r2 = r2.dbl();
    return r2;
  }
  var a = this.curve.a;
  var tinv = this.curve.tinv;
  var jx = this.x;
  var jy = this.y;
  var jz = this.z;
  var jz4 = jz.redSqr().redSqr();
  var jyd = jy.redAdd(jy);
  for (i = 0; i < pow; i++) {
    var jx2 = jx.redSqr();
    var jyd2 = jyd.redSqr();
    var jyd4 = jyd2.redSqr();
    var c = jx2.redAdd(jx2).redIAdd(jx2).redIAdd(a.redMul(jz4));
    var t1 = jx.redMul(jyd2);
    var nx = c.redSqr().redISub(t1.redAdd(t1));
    var t2 = t1.redISub(nx);
    var dny = c.redMul(t2);
    dny = dny.redIAdd(dny).redISub(jyd4);
    var nz = jyd.redMul(jz);
    if (i + 1 < pow)
      jz4 = jz4.redMul(jyd4);
    jx = nx;
    jz = nz;
    jyd = dny;
  }
  return this.curve.jpoint(jx, jyd.redMul(tinv), jz);
};
JPoint.prototype.dbl = function dbl2() {
  if (this.isInfinity())
    return this;
  if (this.curve.zeroA)
    return this._zeroDbl();
  else if (this.curve.threeA)
    return this._threeDbl();
  else
    return this._dbl();
};
JPoint.prototype._zeroDbl = function _zeroDbl() {
  var nx;
  var ny;
  var nz;
  if (this.zOne) {
    var xx = this.x.redSqr();
    var yy = this.y.redSqr();
    var yyyy = yy.redSqr();
    var s2 = this.x.redAdd(yy).redSqr().redISub(xx).redISub(yyyy);
    s2 = s2.redIAdd(s2);
    var m2 = xx.redAdd(xx).redIAdd(xx);
    var t = m2.redSqr().redISub(s2).redISub(s2);
    var yyyy8 = yyyy.redIAdd(yyyy);
    yyyy8 = yyyy8.redIAdd(yyyy8);
    yyyy8 = yyyy8.redIAdd(yyyy8);
    nx = t;
    ny = m2.redMul(s2.redISub(t)).redISub(yyyy8);
    nz = this.y.redAdd(this.y);
  } else {
    var a = this.x.redSqr();
    var b2 = this.y.redSqr();
    var c = b2.redSqr();
    var d2 = this.x.redAdd(b2).redSqr().redISub(a).redISub(c);
    d2 = d2.redIAdd(d2);
    var e = a.redAdd(a).redIAdd(a);
    var f2 = e.redSqr();
    var c8 = c.redIAdd(c);
    c8 = c8.redIAdd(c8);
    c8 = c8.redIAdd(c8);
    nx = f2.redISub(d2).redISub(d2);
    ny = e.redMul(d2.redISub(nx)).redISub(c8);
    nz = this.y.redMul(this.z);
    nz = nz.redIAdd(nz);
  }
  return this.curve.jpoint(nx, ny, nz);
};
JPoint.prototype._threeDbl = function _threeDbl() {
  var nx;
  var ny;
  var nz;
  if (this.zOne) {
    var xx = this.x.redSqr();
    var yy = this.y.redSqr();
    var yyyy = yy.redSqr();
    var s2 = this.x.redAdd(yy).redSqr().redISub(xx).redISub(yyyy);
    s2 = s2.redIAdd(s2);
    var m2 = xx.redAdd(xx).redIAdd(xx).redIAdd(this.curve.a);
    var t = m2.redSqr().redISub(s2).redISub(s2);
    nx = t;
    var yyyy8 = yyyy.redIAdd(yyyy);
    yyyy8 = yyyy8.redIAdd(yyyy8);
    yyyy8 = yyyy8.redIAdd(yyyy8);
    ny = m2.redMul(s2.redISub(t)).redISub(yyyy8);
    nz = this.y.redAdd(this.y);
  } else {
    var delta = this.z.redSqr();
    var gamma = this.y.redSqr();
    var beta = this.x.redMul(gamma);
    var alpha = this.x.redSub(delta).redMul(this.x.redAdd(delta));
    alpha = alpha.redAdd(alpha).redIAdd(alpha);
    var beta4 = beta.redIAdd(beta);
    beta4 = beta4.redIAdd(beta4);
    var beta8 = beta4.redAdd(beta4);
    nx = alpha.redSqr().redISub(beta8);
    nz = this.y.redAdd(this.z).redSqr().redISub(gamma).redISub(delta);
    var ggamma8 = gamma.redSqr();
    ggamma8 = ggamma8.redIAdd(ggamma8);
    ggamma8 = ggamma8.redIAdd(ggamma8);
    ggamma8 = ggamma8.redIAdd(ggamma8);
    ny = alpha.redMul(beta4.redISub(nx)).redISub(ggamma8);
  }
  return this.curve.jpoint(nx, ny, nz);
};
JPoint.prototype._dbl = function _dbl() {
  var a = this.curve.a;
  var jx = this.x;
  var jy = this.y;
  var jz = this.z;
  var jz4 = jz.redSqr().redSqr();
  var jx2 = jx.redSqr();
  var jy2 = jy.redSqr();
  var c = jx2.redAdd(jx2).redIAdd(jx2).redIAdd(a.redMul(jz4));
  var jxd4 = jx.redAdd(jx);
  jxd4 = jxd4.redIAdd(jxd4);
  var t1 = jxd4.redMul(jy2);
  var nx = c.redSqr().redISub(t1.redAdd(t1));
  var t2 = t1.redISub(nx);
  var jyd8 = jy2.redSqr();
  jyd8 = jyd8.redIAdd(jyd8);
  jyd8 = jyd8.redIAdd(jyd8);
  jyd8 = jyd8.redIAdd(jyd8);
  var ny = c.redMul(t2).redISub(jyd8);
  var nz = jy.redAdd(jy).redMul(jz);
  return this.curve.jpoint(nx, ny, nz);
};
JPoint.prototype.trpl = function trpl() {
  if (!this.curve.zeroA)
    return this.dbl().add(this);
  var xx = this.x.redSqr();
  var yy = this.y.redSqr();
  var zz = this.z.redSqr();
  var yyyy = yy.redSqr();
  var m2 = xx.redAdd(xx).redIAdd(xx);
  var mm = m2.redSqr();
  var e = this.x.redAdd(yy).redSqr().redISub(xx).redISub(yyyy);
  e = e.redIAdd(e);
  e = e.redAdd(e).redIAdd(e);
  e = e.redISub(mm);
  var ee2 = e.redSqr();
  var t = yyyy.redIAdd(yyyy);
  t = t.redIAdd(t);
  t = t.redIAdd(t);
  t = t.redIAdd(t);
  var u2 = m2.redIAdd(e).redSqr().redISub(mm).redISub(ee2).redISub(t);
  var yyu4 = yy.redMul(u2);
  yyu4 = yyu4.redIAdd(yyu4);
  yyu4 = yyu4.redIAdd(yyu4);
  var nx = this.x.redMul(ee2).redISub(yyu4);
  nx = nx.redIAdd(nx);
  nx = nx.redIAdd(nx);
  var ny = this.y.redMul(u2.redMul(t.redISub(u2)).redISub(e.redMul(ee2)));
  ny = ny.redIAdd(ny);
  ny = ny.redIAdd(ny);
  ny = ny.redIAdd(ny);
  var nz = this.z.redAdd(e).redSqr().redISub(zz).redISub(ee2);
  return this.curve.jpoint(nx, ny, nz);
};
JPoint.prototype.mul = function mul2(k2, kbase) {
  k2 = new BN$1(k2, kbase);
  return this.curve._wnafMul(this, k2);
};
JPoint.prototype.eq = function eq3(p2) {
  if (p2.type === "affine")
    return this.eq(p2.toJ());
  if (this === p2)
    return true;
  var z2 = this.z.redSqr();
  var pz2 = p2.z.redSqr();
  if (this.x.redMul(pz2).redISub(p2.x.redMul(z2)).cmpn(0) !== 0)
    return false;
  var z3 = z2.redMul(this.z);
  var pz3 = pz2.redMul(p2.z);
  return this.y.redMul(pz3).redISub(p2.y.redMul(z3)).cmpn(0) === 0;
};
JPoint.prototype.eqXToP = function eqXToP(x2) {
  var zs = this.z.redSqr();
  var rx = x2.toRed(this.curve.red).redMul(zs);
  if (this.x.cmp(rx) === 0)
    return true;
  var xc = x2.clone();
  var t = this.curve.redN.redMul(zs);
  for (; ; ) {
    xc.iadd(this.curve.n);
    if (xc.cmp(this.curve.p) >= 0)
      return false;
    rx.redIAdd(t);
    if (this.x.cmp(rx) === 0)
      return true;
  }
};
JPoint.prototype.inspect = function inspect2() {
  if (this.isInfinity())
    return "<EC JPoint Infinity>";
  return "<EC JPoint x: " + this.x.toString(16, 2) + " y: " + this.y.toString(16, 2) + " z: " + this.z.toString(16, 2) + ">";
};
JPoint.prototype.isInfinity = function isInfinity2() {
  return this.z.cmpn(0) === 0;
};
var curve_1 = createCommonjsModule(function(module, exports) {
  var curve = exports;
  curve.base = base;
  curve.short = short_1;
  curve.mont = /*RicMoo:ethers:require(./mont)*/
  null;
  curve.edwards = /*RicMoo:ethers:require(./edwards)*/
  null;
});
var curves_1 = createCommonjsModule(function(module, exports) {
  var curves = exports;
  var assert2 = utils_1$1.assert;
  function PresetCurve(options) {
    if (options.type === "short")
      this.curve = new curve_1.short(options);
    else if (options.type === "edwards")
      this.curve = new curve_1.edwards(options);
    else
      this.curve = new curve_1.mont(options);
    this.g = this.curve.g;
    this.n = this.curve.n;
    this.hash = options.hash;
    assert2(this.g.validate(), "Invalid curve");
    assert2(this.g.mul(this.n).isInfinity(), "Invalid curve, G*N != O");
  }
  curves.PresetCurve = PresetCurve;
  function defineCurve(name, options) {
    Object.defineProperty(curves, name, {
      configurable: true,
      enumerable: true,
      get: function() {
        var curve = new PresetCurve(options);
        Object.defineProperty(curves, name, {
          configurable: true,
          enumerable: true,
          value: curve
        });
        return curve;
      }
    });
  }
  defineCurve("p192", {
    type: "short",
    prime: "p192",
    p: "ffffffff ffffffff ffffffff fffffffe ffffffff ffffffff",
    a: "ffffffff ffffffff ffffffff fffffffe ffffffff fffffffc",
    b: "64210519 e59c80e7 0fa7e9ab 72243049 feb8deec c146b9b1",
    n: "ffffffff ffffffff ffffffff 99def836 146bc9b1 b4d22831",
    hash: hash.sha256,
    gRed: false,
    g: [
      "188da80e b03090f6 7cbf20eb 43a18800 f4ff0afd 82ff1012",
      "07192b95 ffc8da78 631011ed 6b24cdd5 73f977a1 1e794811"
    ]
  });
  defineCurve("p224", {
    type: "short",
    prime: "p224",
    p: "ffffffff ffffffff ffffffff ffffffff 00000000 00000000 00000001",
    a: "ffffffff ffffffff ffffffff fffffffe ffffffff ffffffff fffffffe",
    b: "b4050a85 0c04b3ab f5413256 5044b0b7 d7bfd8ba 270b3943 2355ffb4",
    n: "ffffffff ffffffff ffffffff ffff16a2 e0b8f03e 13dd2945 5c5c2a3d",
    hash: hash.sha256,
    gRed: false,
    g: [
      "b70e0cbd 6bb4bf7f 321390b9 4a03c1d3 56c21122 343280d6 115c1d21",
      "bd376388 b5f723fb 4c22dfe6 cd4375a0 5a074764 44d58199 85007e34"
    ]
  });
  defineCurve("p256", {
    type: "short",
    prime: null,
    p: "ffffffff 00000001 00000000 00000000 00000000 ffffffff ffffffff ffffffff",
    a: "ffffffff 00000001 00000000 00000000 00000000 ffffffff ffffffff fffffffc",
    b: "5ac635d8 aa3a93e7 b3ebbd55 769886bc 651d06b0 cc53b0f6 3bce3c3e 27d2604b",
    n: "ffffffff 00000000 ffffffff ffffffff bce6faad a7179e84 f3b9cac2 fc632551",
    hash: hash.sha256,
    gRed: false,
    g: [
      "6b17d1f2 e12c4247 f8bce6e5 63a440f2 77037d81 2deb33a0 f4a13945 d898c296",
      "4fe342e2 fe1a7f9b 8ee7eb4a 7c0f9e16 2bce3357 6b315ece cbb64068 37bf51f5"
    ]
  });
  defineCurve("p384", {
    type: "short",
    prime: null,
    p: "ffffffff ffffffff ffffffff ffffffff ffffffff ffffffff ffffffff fffffffe ffffffff 00000000 00000000 ffffffff",
    a: "ffffffff ffffffff ffffffff ffffffff ffffffff ffffffff ffffffff fffffffe ffffffff 00000000 00000000 fffffffc",
    b: "b3312fa7 e23ee7e4 988e056b e3f82d19 181d9c6e fe814112 0314088f 5013875a c656398d 8a2ed19d 2a85c8ed d3ec2aef",
    n: "ffffffff ffffffff ffffffff ffffffff ffffffff ffffffff c7634d81 f4372ddf 581a0db2 48b0a77a ecec196a ccc52973",
    hash: hash.sha384,
    gRed: false,
    g: [
      "aa87ca22 be8b0537 8eb1c71e f320ad74 6e1d3b62 8ba79b98 59f741e0 82542a38 5502f25d bf55296c 3a545e38 72760ab7",
      "3617de4a 96262c6f 5d9e98bf 9292dc29 f8f41dbd 289a147c e9da3113 b5f0b8c0 0a60b1ce 1d7e819d 7a431d7c 90ea0e5f"
    ]
  });
  defineCurve("p521", {
    type: "short",
    prime: null,
    p: "000001ff ffffffff ffffffff ffffffff ffffffff ffffffff ffffffff ffffffff ffffffff ffffffff ffffffff ffffffff ffffffff ffffffff ffffffff ffffffff ffffffff",
    a: "000001ff ffffffff ffffffff ffffffff ffffffff ffffffff ffffffff ffffffff ffffffff ffffffff ffffffff ffffffff ffffffff ffffffff ffffffff ffffffff fffffffc",
    b: "00000051 953eb961 8e1c9a1f 929a21a0 b68540ee a2da725b 99b315f3 b8b48991 8ef109e1 56193951 ec7e937b 1652c0bd 3bb1bf07 3573df88 3d2c34f1 ef451fd4 6b503f00",
    n: "000001ff ffffffff ffffffff ffffffff ffffffff ffffffff ffffffff ffffffff fffffffa 51868783 bf2f966b 7fcc0148 f709a5d0 3bb5c9b8 899c47ae bb6fb71e 91386409",
    hash: hash.sha512,
    gRed: false,
    g: [
      "000000c6 858e06b7 0404e9cd 9e3ecb66 2395b442 9c648139 053fb521 f828af60 6b4d3dba a14b5e77 efe75928 fe1dc127 a2ffa8de 3348b3c1 856a429b f97e7e31 c2e5bd66",
      "00000118 39296a78 9a3bc004 5c8a5fb4 2c7d1bd9 98f54449 579b4468 17afbd17 273e662c 97ee7299 5ef42640 c550b901 3fad0761 353c7086 a272c240 88be9476 9fd16650"
    ]
  });
  defineCurve("curve25519", {
    type: "mont",
    prime: "p25519",
    p: "7fffffffffffffff ffffffffffffffff ffffffffffffffff ffffffffffffffed",
    a: "76d06",
    b: "1",
    n: "1000000000000000 0000000000000000 14def9dea2f79cd6 5812631a5cf5d3ed",
    hash: hash.sha256,
    gRed: false,
    g: [
      "9"
    ]
  });
  defineCurve("ed25519", {
    type: "edwards",
    prime: "p25519",
    p: "7fffffffffffffff ffffffffffffffff ffffffffffffffff ffffffffffffffed",
    a: "-1",
    c: "1",
    // -121665 * (121666^(-1)) (mod P)
    d: "52036cee2b6ffe73 8cc740797779e898 00700a4d4141d8ab 75eb4dca135978a3",
    n: "1000000000000000 0000000000000000 14def9dea2f79cd6 5812631a5cf5d3ed",
    hash: hash.sha256,
    gRed: false,
    g: [
      "216936d3cd6e53fec0a4e231fdd6dc5c692cc7609525a7b2c9562d608f25d51a",
      // 4/5
      "6666666666666666666666666666666666666666666666666666666666666658"
    ]
  });
  var pre;
  try {
    pre = /*RicMoo:ethers:require(./precomputed/secp256k1)*/
    null.crash();
  } catch (e) {
    pre = void 0;
  }
  defineCurve("secp256k1", {
    type: "short",
    prime: "k256",
    p: "ffffffff ffffffff ffffffff ffffffff ffffffff ffffffff fffffffe fffffc2f",
    a: "0",
    b: "7",
    n: "ffffffff ffffffff ffffffff fffffffe baaedce6 af48a03b bfd25e8c d0364141",
    h: "1",
    hash: hash.sha256,
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
    gRed: false,
    g: [
      "79be667ef9dcbbac55a06295ce870b07029bfcdb2dce28d959f2815b16f81798",
      "483ada7726a3c4655da4fbfc0e1108a8fd17b448a68554199c47d08ffb10d4b8",
      pre
    ]
  });
});
function HmacDRBG(options) {
  if (!(this instanceof HmacDRBG))
    return new HmacDRBG(options);
  this.hash = options.hash;
  this.predResist = !!options.predResist;
  this.outLen = this.hash.outSize;
  this.minEntropy = options.minEntropy || this.hash.hmacStrength;
  this._reseed = null;
  this.reseedInterval = null;
  this.K = null;
  this.V = null;
  var entropy = utils_1.toArray(options.entropy, options.entropyEnc || "hex");
  var nonce = utils_1.toArray(options.nonce, options.nonceEnc || "hex");
  var pers = utils_1.toArray(options.pers, options.persEnc || "hex");
  minimalisticAssert(
    entropy.length >= this.minEntropy / 8,
    "Not enough entropy. Minimum is: " + this.minEntropy + " bits"
  );
  this._init(entropy, nonce, pers);
}
var hmacDrbg = HmacDRBG;
HmacDRBG.prototype._init = function init2(entropy, nonce, pers) {
  var seed = entropy.concat(nonce).concat(pers);
  this.K = new Array(this.outLen / 8);
  this.V = new Array(this.outLen / 8);
  for (var i = 0; i < this.V.length; i++) {
    this.K[i] = 0;
    this.V[i] = 1;
  }
  this._update(seed);
  this._reseed = 1;
  this.reseedInterval = 281474976710656;
};
HmacDRBG.prototype._hmac = function hmac2() {
  return new hash.hmac(this.hash, this.K);
};
HmacDRBG.prototype._update = function update4(seed) {
  var kmac = this._hmac().update(this.V).update([0]);
  if (seed)
    kmac = kmac.update(seed);
  this.K = kmac.digest();
  this.V = this._hmac().update(this.V).digest();
  if (!seed)
    return;
  this.K = this._hmac().update(this.V).update([1]).update(seed).digest();
  this.V = this._hmac().update(this.V).digest();
};
HmacDRBG.prototype.reseed = function reseed(entropy, entropyEnc, add3, addEnc) {
  if (typeof entropyEnc !== "string") {
    addEnc = add3;
    add3 = entropyEnc;
    entropyEnc = null;
  }
  entropy = utils_1.toArray(entropy, entropyEnc);
  add3 = utils_1.toArray(add3, addEnc);
  minimalisticAssert(
    entropy.length >= this.minEntropy / 8,
    "Not enough entropy. Minimum is: " + this.minEntropy + " bits"
  );
  this._update(entropy.concat(add3 || []));
  this._reseed = 1;
};
HmacDRBG.prototype.generate = function generate(len, enc, add3, addEnc) {
  if (this._reseed > this.reseedInterval)
    throw new Error("Reseed is required");
  if (typeof enc !== "string") {
    addEnc = add3;
    add3 = enc;
    enc = null;
  }
  if (add3) {
    add3 = utils_1.toArray(add3, addEnc || "hex");
    this._update(add3);
  }
  var temp = [];
  while (temp.length < len) {
    this.V = this._hmac().update(this.V).digest();
    temp = temp.concat(this.V);
  }
  var res = temp.slice(0, len);
  this._update(add3);
  this._reseed++;
  return utils_1.encode(res, enc);
};
var assert$3 = utils_1$1.assert;
function KeyPair(ec2, options) {
  this.ec = ec2;
  this.priv = null;
  this.pub = null;
  if (options.priv)
    this._importPrivate(options.priv, options.privEnc);
  if (options.pub)
    this._importPublic(options.pub, options.pubEnc);
}
var key = KeyPair;
KeyPair.fromPublic = function fromPublic(ec2, pub, enc) {
  if (pub instanceof KeyPair)
    return pub;
  return new KeyPair(ec2, {
    pub,
    pubEnc: enc
  });
};
KeyPair.fromPrivate = function fromPrivate(ec2, priv, enc) {
  if (priv instanceof KeyPair)
    return priv;
  return new KeyPair(ec2, {
    priv,
    privEnc: enc
  });
};
KeyPair.prototype.validate = function validate4() {
  var pub = this.getPublic();
  if (pub.isInfinity())
    return { result: false, reason: "Invalid public key" };
  if (!pub.validate())
    return { result: false, reason: "Public key is not a point" };
  if (!pub.mul(this.ec.curve.n).isInfinity())
    return { result: false, reason: "Public key * N != O" };
  return { result: true, reason: null };
};
KeyPair.prototype.getPublic = function getPublic(compact, enc) {
  if (typeof compact === "string") {
    enc = compact;
    compact = null;
  }
  if (!this.pub)
    this.pub = this.ec.g.mul(this.priv);
  if (!enc)
    return this.pub;
  return this.pub.encode(enc, compact);
};
KeyPair.prototype.getPrivate = function getPrivate(enc) {
  if (enc === "hex")
    return this.priv.toString(16, 2);
  else
    return this.priv;
};
KeyPair.prototype._importPrivate = function _importPrivate(key2, enc) {
  this.priv = new BN$1(key2, enc || 16);
  this.priv = this.priv.umod(this.ec.curve.n);
};
KeyPair.prototype._importPublic = function _importPublic(key2, enc) {
  if (key2.x || key2.y) {
    if (this.ec.curve.type === "mont") {
      assert$3(key2.x, "Need x coordinate");
    } else if (this.ec.curve.type === "short" || this.ec.curve.type === "edwards") {
      assert$3(key2.x && key2.y, "Need both x and y coordinate");
    }
    this.pub = this.ec.curve.point(key2.x, key2.y);
    return;
  }
  this.pub = this.ec.curve.decodePoint(key2, enc);
};
KeyPair.prototype.derive = function derive(pub) {
  if (!pub.validate()) {
    assert$3(pub.validate(), "public point not validated");
  }
  return pub.mul(this.priv).getX();
};
KeyPair.prototype.sign = function sign(msg, enc, options) {
  return this.ec.sign(msg, this, enc, options);
};
KeyPair.prototype.verify = function verify(msg, signature2) {
  return this.ec.verify(msg, signature2, this);
};
KeyPair.prototype.inspect = function inspect3() {
  return "<Key priv: " + (this.priv && this.priv.toString(16, 2)) + " pub: " + (this.pub && this.pub.inspect()) + " >";
};
var assert$4 = utils_1$1.assert;
function Signature(options, enc) {
  if (options instanceof Signature)
    return options;
  if (this._importDER(options, enc))
    return;
  assert$4(options.r && options.s, "Signature without r or s");
  this.r = new BN$1(options.r, 16);
  this.s = new BN$1(options.s, 16);
  if (options.recoveryParam === void 0)
    this.recoveryParam = null;
  else
    this.recoveryParam = options.recoveryParam;
}
var signature = Signature;
function Position() {
  this.place = 0;
}
function getLength(buf, p2) {
  var initial = buf[p2.place++];
  if (!(initial & 128)) {
    return initial;
  }
  var octetLen = initial & 15;
  if (octetLen === 0 || octetLen > 4) {
    return false;
  }
  var val = 0;
  for (var i = 0, off = p2.place; i < octetLen; i++, off++) {
    val <<= 8;
    val |= buf[off];
    val >>>= 0;
  }
  if (val <= 127) {
    return false;
  }
  p2.place = off;
  return val;
}
function rmPadding(buf) {
  var i = 0;
  var len = buf.length - 1;
  while (!buf[i] && !(buf[i + 1] & 128) && i < len) {
    i++;
  }
  if (i === 0) {
    return buf;
  }
  return buf.slice(i);
}
Signature.prototype._importDER = function _importDER(data, enc) {
  data = utils_1$1.toArray(data, enc);
  var p2 = new Position();
  if (data[p2.place++] !== 48) {
    return false;
  }
  var len = getLength(data, p2);
  if (len === false) {
    return false;
  }
  if (len + p2.place !== data.length) {
    return false;
  }
  if (data[p2.place++] !== 2) {
    return false;
  }
  var rlen = getLength(data, p2);
  if (rlen === false) {
    return false;
  }
  var r2 = data.slice(p2.place, rlen + p2.place);
  p2.place += rlen;
  if (data[p2.place++] !== 2) {
    return false;
  }
  var slen = getLength(data, p2);
  if (slen === false) {
    return false;
  }
  if (data.length !== slen + p2.place) {
    return false;
  }
  var s2 = data.slice(p2.place, slen + p2.place);
  if (r2[0] === 0) {
    if (r2[1] & 128) {
      r2 = r2.slice(1);
    } else {
      return false;
    }
  }
  if (s2[0] === 0) {
    if (s2[1] & 128) {
      s2 = s2.slice(1);
    } else {
      return false;
    }
  }
  this.r = new BN$1(r2);
  this.s = new BN$1(s2);
  this.recoveryParam = null;
  return true;
};
function constructLength(arr, len) {
  if (len < 128) {
    arr.push(len);
    return;
  }
  var octets = 1 + (Math.log(len) / Math.LN2 >>> 3);
  arr.push(octets | 128);
  while (--octets) {
    arr.push(len >>> (octets << 3) & 255);
  }
  arr.push(len);
}
Signature.prototype.toDER = function toDER(enc) {
  var r2 = this.r.toArray();
  var s2 = this.s.toArray();
  if (r2[0] & 128)
    r2 = [0].concat(r2);
  if (s2[0] & 128)
    s2 = [0].concat(s2);
  r2 = rmPadding(r2);
  s2 = rmPadding(s2);
  while (!s2[0] && !(s2[1] & 128)) {
    s2 = s2.slice(1);
  }
  var arr = [2];
  constructLength(arr, r2.length);
  arr = arr.concat(r2);
  arr.push(2);
  constructLength(arr, s2.length);
  var backHalf = arr.concat(s2);
  var res = [48];
  constructLength(res, backHalf.length);
  res = res.concat(backHalf);
  return utils_1$1.encode(res, enc);
};
var rand = (
  /*RicMoo:ethers:require(brorand)*/
  function() {
    throw new Error("unsupported");
  }
);
var assert$5 = utils_1$1.assert;
function EC(options) {
  if (!(this instanceof EC))
    return new EC(options);
  if (typeof options === "string") {
    assert$5(
      Object.prototype.hasOwnProperty.call(curves_1, options),
      "Unknown curve " + options
    );
    options = curves_1[options];
  }
  if (options instanceof curves_1.PresetCurve)
    options = { curve: options };
  this.curve = options.curve.curve;
  this.n = this.curve.n;
  this.nh = this.n.ushrn(1);
  this.g = this.curve.g;
  this.g = options.curve.g;
  this.g.precompute(options.curve.n.bitLength() + 1);
  this.hash = options.hash || options.curve.hash;
}
var ec = EC;
EC.prototype.keyPair = function keyPair(options) {
  return new key(this, options);
};
EC.prototype.keyFromPrivate = function keyFromPrivate(priv, enc) {
  return key.fromPrivate(this, priv, enc);
};
EC.prototype.keyFromPublic = function keyFromPublic(pub, enc) {
  return key.fromPublic(this, pub, enc);
};
EC.prototype.genKeyPair = function genKeyPair(options) {
  if (!options)
    options = {};
  var drbg = new hmacDrbg({
    hash: this.hash,
    pers: options.pers,
    persEnc: options.persEnc || "utf8",
    entropy: options.entropy || rand(this.hash.hmacStrength),
    entropyEnc: options.entropy && options.entropyEnc || "utf8",
    nonce: this.n.toArray()
  });
  var bytes = this.n.byteLength();
  var ns2 = this.n.sub(new BN$1(2));
  for (; ; ) {
    var priv = new BN$1(drbg.generate(bytes));
    if (priv.cmp(ns2) > 0)
      continue;
    priv.iaddn(1);
    return this.keyFromPrivate(priv);
  }
};
EC.prototype._truncateToN = function _truncateToN(msg, truncOnly) {
  var delta = msg.byteLength() * 8 - this.n.bitLength();
  if (delta > 0)
    msg = msg.ushrn(delta);
  if (!truncOnly && msg.cmp(this.n) >= 0)
    return msg.sub(this.n);
  else
    return msg;
};
EC.prototype.sign = function sign2(msg, key2, enc, options) {
  if (typeof enc === "object") {
    options = enc;
    enc = null;
  }
  if (!options)
    options = {};
  key2 = this.keyFromPrivate(key2, enc);
  msg = this._truncateToN(new BN$1(msg, 16));
  var bytes = this.n.byteLength();
  var bkey = key2.getPrivate().toArray("be", bytes);
  var nonce = msg.toArray("be", bytes);
  var drbg = new hmacDrbg({
    hash: this.hash,
    entropy: bkey,
    nonce,
    pers: options.pers,
    persEnc: options.persEnc || "utf8"
  });
  var ns1 = this.n.sub(new BN$1(1));
  for (var iter = 0; ; iter++) {
    var k2 = options.k ? options.k(iter) : new BN$1(drbg.generate(this.n.byteLength()));
    k2 = this._truncateToN(k2, true);
    if (k2.cmpn(1) <= 0 || k2.cmp(ns1) >= 0)
      continue;
    var kp = this.g.mul(k2);
    if (kp.isInfinity())
      continue;
    var kpX = kp.getX();
    var r2 = kpX.umod(this.n);
    if (r2.cmpn(0) === 0)
      continue;
    var s2 = k2.invm(this.n).mul(r2.mul(key2.getPrivate()).iadd(msg));
    s2 = s2.umod(this.n);
    if (s2.cmpn(0) === 0)
      continue;
    var recoveryParam = (kp.getY().isOdd() ? 1 : 0) | (kpX.cmp(r2) !== 0 ? 2 : 0);
    if (options.canonical && s2.cmp(this.nh) > 0) {
      s2 = this.n.sub(s2);
      recoveryParam ^= 1;
    }
    return new signature({ r: r2, s: s2, recoveryParam });
  }
};
EC.prototype.verify = function verify2(msg, signature$1, key2, enc) {
  msg = this._truncateToN(new BN$1(msg, 16));
  key2 = this.keyFromPublic(key2, enc);
  signature$1 = new signature(signature$1, "hex");
  var r2 = signature$1.r;
  var s2 = signature$1.s;
  if (r2.cmpn(1) < 0 || r2.cmp(this.n) >= 0)
    return false;
  if (s2.cmpn(1) < 0 || s2.cmp(this.n) >= 0)
    return false;
  var sinv = s2.invm(this.n);
  var u1 = sinv.mul(msg).umod(this.n);
  var u2 = sinv.mul(r2).umod(this.n);
  var p2;
  if (!this.curve._maxwellTrick) {
    p2 = this.g.mulAdd(u1, key2.getPublic(), u2);
    if (p2.isInfinity())
      return false;
    return p2.getX().umod(this.n).cmp(r2) === 0;
  }
  p2 = this.g.jmulAdd(u1, key2.getPublic(), u2);
  if (p2.isInfinity())
    return false;
  return p2.eqXToP(r2);
};
EC.prototype.recoverPubKey = function(msg, signature$1, j2, enc) {
  assert$5((3 & j2) === j2, "The recovery param is more than two bits");
  signature$1 = new signature(signature$1, enc);
  var n = this.n;
  var e = new BN$1(msg);
  var r2 = signature$1.r;
  var s2 = signature$1.s;
  var isYOdd = j2 & 1;
  var isSecondKey = j2 >> 1;
  if (r2.cmp(this.curve.p.umod(this.curve.n)) >= 0 && isSecondKey)
    throw new Error("Unable to find sencond key candinate");
  if (isSecondKey)
    r2 = this.curve.pointFromX(r2.add(this.curve.n), isYOdd);
  else
    r2 = this.curve.pointFromX(r2, isYOdd);
  var rInv = signature$1.r.invm(n);
  var s1 = n.sub(e).mul(rInv).umod(n);
  var s22 = s2.mul(rInv).umod(n);
  return this.g.mulAdd(s1, r2, s22);
};
EC.prototype.getKeyRecoveryParam = function(e, signature$1, Q2, enc) {
  signature$1 = new signature(signature$1, enc);
  if (signature$1.recoveryParam !== null)
    return signature$1.recoveryParam;
  for (var i = 0; i < 4; i++) {
    var Qprime;
    try {
      Qprime = this.recoverPubKey(e, signature$1, i);
    } catch (e2) {
      continue;
    }
    if (Qprime.eq(Q2))
      return i;
  }
  throw new Error("Unable to find valid recovery factor");
};
var elliptic_1 = createCommonjsModule(function(module, exports) {
  var elliptic = exports;
  elliptic.version = /*RicMoo:ethers*/
  { version: "6.5.4" }.version;
  elliptic.utils = utils_1$1;
  elliptic.rand = /*RicMoo:ethers:require(brorand)*/
  function() {
    throw new Error("unsupported");
  };
  elliptic.curve = curve_1;
  elliptic.curves = curves_1;
  elliptic.ec = ec;
  elliptic.eddsa = /*RicMoo:ethers:require(./elliptic/eddsa)*/
  null;
});
var EC$1 = elliptic_1.ec;
const version = "signing-key/5.7.0";
const logger = new Logger(version);
let _curve = null;
function getCurve() {
  if (!_curve) {
    _curve = new EC$1("secp256k1");
  }
  return _curve;
}
class SigningKey {
  constructor(privateKey) {
    defineReadOnly(this, "curve", "secp256k1");
    defineReadOnly(this, "privateKey", hexlify(privateKey));
    if (hexDataLength(this.privateKey) !== 32) {
      logger.throwArgumentError("invalid private key", "privateKey", "[[ REDACTED ]]");
    }
    const keyPair2 = getCurve().keyFromPrivate(arrayify(this.privateKey));
    defineReadOnly(this, "publicKey", "0x" + keyPair2.getPublic(false, "hex"));
    defineReadOnly(this, "compressedPublicKey", "0x" + keyPair2.getPublic(true, "hex"));
    defineReadOnly(this, "_isSigningKey", true);
  }
  _addPoint(other) {
    const p0 = getCurve().keyFromPublic(arrayify(this.publicKey));
    const p1 = getCurve().keyFromPublic(arrayify(other));
    return "0x" + p0.pub.add(p1.pub).encodeCompressed("hex");
  }
  signDigest(digest9) {
    const keyPair2 = getCurve().keyFromPrivate(arrayify(this.privateKey));
    const digestBytes = arrayify(digest9);
    if (digestBytes.length !== 32) {
      logger.throwArgumentError("bad digest length", "digest", digest9);
    }
    const signature2 = keyPair2.sign(digestBytes, { canonical: true });
    return splitSignature({
      recoveryParam: signature2.recoveryParam,
      r: hexZeroPad("0x" + signature2.r.toString(16), 32),
      s: hexZeroPad("0x" + signature2.s.toString(16), 32)
    });
  }
  computeSharedSecret(otherKey) {
    const keyPair2 = getCurve().keyFromPrivate(arrayify(this.privateKey));
    const otherKeyPair = getCurve().keyFromPublic(arrayify(computePublicKey(otherKey)));
    return hexZeroPad("0x" + keyPair2.derive(otherKeyPair.getPublic()).toString(16), 32);
  }
  static isSigningKey(value) {
    return !!(value && value._isSigningKey);
  }
}
function recoverPublicKey(digest9, signature2) {
  const sig = splitSignature(signature2);
  const rs = { r: arrayify(sig.r), s: arrayify(sig.s) };
  return "0x" + getCurve().recoverPubKey(arrayify(digest9), rs, sig.recoveryParam).encode("hex", false);
}
function computePublicKey(key2, compressed) {
  const bytes = arrayify(key2);
  if (bytes.length === 32) {
    const signingKey = new SigningKey(bytes);
    if (compressed) {
      return "0x" + getCurve().keyFromPrivate(bytes).getPublic(true, "hex");
    }
    return signingKey.publicKey;
  } else if (bytes.length === 33) {
    if (compressed) {
      return hexlify(bytes);
    }
    return "0x" + getCurve().keyFromPublic(bytes).getPublic(false, "hex");
  } else if (bytes.length === 65) {
    if (!compressed) {
      return hexlify(bytes);
    }
    return "0x" + getCurve().keyFromPublic(bytes).getPublic(true, "hex");
  }
  return logger.throwArgumentError("invalid public or private key", "key", "[REDACTED]");
}
var TransactionTypes;
(function(TransactionTypes2) {
  TransactionTypes2[TransactionTypes2["legacy"] = 0] = "legacy";
  TransactionTypes2[TransactionTypes2["eip2930"] = 1] = "eip2930";
  TransactionTypes2[TransactionTypes2["eip1559"] = 2] = "eip1559";
})(TransactionTypes || (TransactionTypes = {}));
function computeAddress(key2) {
  const publicKey = computePublicKey(key2);
  return getAddress(hexDataSlice(keccak256(hexDataSlice(publicKey, 1)), 12));
}
function recoverAddress(digest9, signature2) {
  return computeAddress(recoverPublicKey(arrayify(digest9), signature2));
}
function unfetch_module(e, n) {
  return n = n || {}, new Promise(function(t, r2) {
    var s2 = new XMLHttpRequest(), o2 = [], u2 = [], i = {}, a = function() {
      return { ok: 2 == (s2.status / 100 | 0), statusText: s2.statusText, status: s2.status, url: s2.responseURL, text: function() {
        return Promise.resolve(s2.responseText);
      }, json: function() {
        return Promise.resolve(s2.responseText).then(JSON.parse);
      }, blob: function() {
        return Promise.resolve(new Blob([s2.response]));
      }, clone: a, headers: { keys: function() {
        return o2;
      }, entries: function() {
        return u2;
      }, get: function(e2) {
        return i[e2.toLowerCase()];
      }, has: function(e2) {
        return e2.toLowerCase() in i;
      } } };
    };
    for (var l2 in s2.open(n.method || "get", e, true), s2.onload = function() {
      s2.getAllResponseHeaders().replace(/^(.*?):[^\S\n]*([\s\S]*?)$/gm, function(e2, n2, t2) {
        o2.push(n2 = n2.toLowerCase()), u2.push([n2, t2]), i[n2] = i[n2] ? i[n2] + "," + t2 : t2;
      }), t(a());
    }, s2.onerror = r2, s2.withCredentials = "include" == n.credentials, n.headers)
      s2.setRequestHeader(l2, n.headers[l2]);
    s2.send(n.body || null);
  });
}
const unfetch_module$1 = /* @__PURE__ */ Object.freeze(/* @__PURE__ */ Object.defineProperty({
  __proto__: null,
  default: unfetch_module
}, Symbol.toStringTag, { value: "Module" }));
const require$$0 = /* @__PURE__ */ getAugmentedNamespace(unfetch_module$1);
var browser = self.fetch || (self.fetch = require$$0.default || require$$0);
const ke = /* @__PURE__ */ getDefaultExportFromCjs(browser);
let G$2 = class G {
  constructor(t) {
    this.client = t;
  }
};
let H$1 = class H {
  constructor(t) {
    this.opts = t;
  }
};
const Y = "https://rpc.walletconnect.com/v1", R$1 = { wc_authRequest: { req: { ttl: cjs$1.ONE_DAY, prompt: true, tag: 3e3 }, res: { ttl: cjs$1.ONE_DAY, prompt: false, tag: 3001 } } }, U$2 = { min: cjs$1.FIVE_MINUTES, max: cjs$1.SEVEN_DAYS }, $ = "wc", Q$1 = 1, Z = "auth", B = "authClient", F$2 = `${$}@${1}:${Z}:`, x$1 = `${F$2}:PUB_KEY`;
function z$1(r2) {
  return r2 == null ? void 0 : r2.split(":");
}
function Ze(r2) {
  const t = r2 && z$1(r2);
  if (t)
    return t[3];
}
function We(r2) {
  const t = r2 && z$1(r2);
  if (t)
    return t[2] + ":" + t[3];
}
function W$2(r2) {
  const t = r2 && z$1(r2);
  if (t)
    return t.pop();
}
async function et(r2, t, e, i, n) {
  switch (e.t) {
    case "eip191":
      return tt(r2, t, e.s);
    case "eip1271":
      return await rt(r2, t, e.s, i, n);
    default:
      throw new Error(`verifySignature failed: Attempted to verify CacaoSignature with unknown type: ${e.t}`);
  }
}
function tt(r2, t, e) {
  return recoverAddress(hashMessage(t), e).toLowerCase() === r2.toLowerCase();
}
async function rt(r2, t, e, i, n) {
  try {
    const s2 = "0x1626ba7e", o2 = "0000000000000000000000000000000000000000000000000000000000000040", u2 = "0000000000000000000000000000000000000000000000000000000000000041", a = e.substring(2), c = hashMessage(t).substring(2), h2 = s2 + c + o2 + u2 + a, f2 = await ke(`${Y}/?chainId=${i}&projectId=${n}`, { method: "POST", body: JSON.stringify({ id: it(), jsonrpc: "2.0", method: "eth_call", params: [{ to: r2, data: h2 }, "latest"] }) }), { result: p2 } = await f2.json();
    return p2 ? p2.slice(0, s2.length).toLowerCase() === s2.toLowerCase() : false;
  } catch (s2) {
    return console.error("isValidEip1271Signature: ", s2), false;
  }
}
function it() {
  return Date.now() + Math.floor(Math.random() * 1e3);
}
function ee(r2) {
  return r2.getAll().filter((t) => "requester" in t);
}
function te(r2, t) {
  return ee(r2).find((e) => e.id === t);
}
function nt(r2) {
  const t = kt$1(r2.aud), e = new RegExp(`${r2.domain}`).test(r2.aud), i = !!r2.nonce, n = r2.type ? r2.type === "eip4361" : true, s2 = r2.expiry;
  if (s2 && !Xt$1(s2, U$2)) {
    const { message: o2 } = N("MISSING_OR_INVALID", `request() expiry: ${s2}. Expiry must be a number (in seconds) between ${U$2.min} and ${U$2.max}`);
    throw new Error(o2);
  }
  return !!(t && e && i && n);
}
function st(r2, t) {
  return !!te(t, r2.id);
}
function ot(r2 = 0) {
  return globalThis.Buffer != null && globalThis.Buffer.allocUnsafe != null ? globalThis.Buffer.allocUnsafe(r2) : new Uint8Array(r2);
}
function ut(r2, t) {
  if (r2.length >= 255)
    throw new TypeError("Alphabet too long");
  for (var e = new Uint8Array(256), i = 0; i < e.length; i++)
    e[i] = 255;
  for (var n = 0; n < r2.length; n++) {
    var s2 = r2.charAt(n), o2 = s2.charCodeAt(0);
    if (e[o2] !== 255)
      throw new TypeError(s2 + " is ambiguous");
    e[o2] = n;
  }
  var u2 = r2.length, a = r2.charAt(0), c = Math.log(u2) / Math.log(256), h2 = Math.log(256) / Math.log(u2);
  function f2(D2) {
    if (D2 instanceof Uint8Array || (ArrayBuffer.isView(D2) ? D2 = new Uint8Array(D2.buffer, D2.byteOffset, D2.byteLength) : Array.isArray(D2) && (D2 = Uint8Array.from(D2))), !(D2 instanceof Uint8Array))
      throw new TypeError("Expected Uint8Array");
    if (D2.length === 0)
      return "";
    for (var l2 = 0, m2 = 0, E2 = 0, y2 = D2.length; E2 !== y2 && D2[E2] === 0; )
      E2++, l2++;
    for (var w2 = (y2 - E2) * h2 + 1 >>> 0, g2 = new Uint8Array(w2); E2 !== y2; ) {
      for (var C2 = D2[E2], _2 = 0, b2 = w2 - 1; (C2 !== 0 || _2 < m2) && b2 !== -1; b2--, _2++)
        C2 += 256 * g2[b2] >>> 0, g2[b2] = C2 % u2 >>> 0, C2 = C2 / u2 >>> 0;
      if (C2 !== 0)
        throw new Error("Non-zero carry");
      m2 = _2, E2++;
    }
    for (var v2 = w2 - m2; v2 !== w2 && g2[v2] === 0; )
      v2++;
    for (var q = a.repeat(l2); v2 < w2; ++v2)
      q += r2.charAt(g2[v2]);
    return q;
  }
  function p2(D2) {
    if (typeof D2 != "string")
      throw new TypeError("Expected String");
    if (D2.length === 0)
      return new Uint8Array();
    var l2 = 0;
    if (D2[l2] !== " ") {
      for (var m2 = 0, E2 = 0; D2[l2] === a; )
        m2++, l2++;
      for (var y2 = (D2.length - l2) * c + 1 >>> 0, w2 = new Uint8Array(y2); D2[l2]; ) {
        var g2 = e[D2.charCodeAt(l2)];
        if (g2 === 255)
          return;
        for (var C2 = 0, _2 = y2 - 1; (g2 !== 0 || C2 < E2) && _2 !== -1; _2--, C2++)
          g2 += u2 * w2[_2] >>> 0, w2[_2] = g2 % 256 >>> 0, g2 = g2 / 256 >>> 0;
        if (g2 !== 0)
          throw new Error("Non-zero carry");
        E2 = C2, l2++;
      }
      if (D2[l2] !== " ") {
        for (var b2 = y2 - E2; b2 !== y2 && w2[b2] === 0; )
          b2++;
        for (var v2 = new Uint8Array(m2 + (y2 - b2)), q = m2; b2 !== y2; )
          v2[q++] = w2[b2++];
        return v2;
      }
    }
  }
  function A2(D2) {
    var l2 = p2(D2);
    if (l2)
      return l2;
    throw new Error(`Non-${t} character`);
  }
  return { encode: f2, decodeUnsafe: p2, decode: A2 };
}
var at = ut, Dt = at;
const re = (r2) => {
  if (r2 instanceof Uint8Array && r2.constructor.name === "Uint8Array")
    return r2;
  if (r2 instanceof ArrayBuffer)
    return new Uint8Array(r2);
  if (ArrayBuffer.isView(r2))
    return new Uint8Array(r2.buffer, r2.byteOffset, r2.byteLength);
  throw new Error("Unknown type, must be binary type");
}, ct = (r2) => new TextEncoder().encode(r2), ht = (r2) => new TextDecoder().decode(r2);
class lt {
  constructor(t, e, i) {
    this.name = t, this.prefix = e, this.baseEncode = i;
  }
  encode(t) {
    if (t instanceof Uint8Array)
      return `${this.prefix}${this.baseEncode(t)}`;
    throw Error("Unknown type, must be binary type");
  }
}
class dt {
  constructor(t, e, i) {
    if (this.name = t, this.prefix = e, e.codePointAt(0) === void 0)
      throw new Error("Invalid prefix character");
    this.prefixCodePoint = e.codePointAt(0), this.baseDecode = i;
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
    return ie(this, t);
  }
}
class pt {
  constructor(t) {
    this.decoders = t;
  }
  or(t) {
    return ie(this, t);
  }
  decode(t) {
    const e = t[0], i = this.decoders[e];
    if (i)
      return i.decode(t);
    throw RangeError(`Unable to decode multibase string ${JSON.stringify(t)}, only inputs prefixed with ${Object.keys(this.decoders)} are supported`);
  }
}
const ie = (r2, t) => new pt({ ...r2.decoders || { [r2.prefix]: r2 }, ...t.decoders || { [t.prefix]: t } });
class ft {
  constructor(t, e, i, n) {
    this.name = t, this.prefix = e, this.baseEncode = i, this.baseDecode = n, this.encoder = new lt(t, e, i), this.decoder = new dt(t, e, n);
  }
  encode(t) {
    return this.encoder.encode(t);
  }
  decode(t) {
    return this.decoder.decode(t);
  }
}
const O$1 = ({ name: r2, prefix: t, encode: e, decode: i }) => new ft(r2, t, e, i), T$1 = ({ prefix: r2, name: t, alphabet: e }) => {
  const { encode: i, decode: n } = Dt(e, t);
  return O$1({ prefix: r2, name: t, encode: i, decode: (s2) => re(n(s2)) });
}, gt = (r2, t, e, i) => {
  const n = {};
  for (let h2 = 0; h2 < t.length; ++h2)
    n[t[h2]] = h2;
  let s2 = r2.length;
  for (; r2[s2 - 1] === "="; )
    --s2;
  const o2 = new Uint8Array(s2 * e / 8 | 0);
  let u2 = 0, a = 0, c = 0;
  for (let h2 = 0; h2 < s2; ++h2) {
    const f2 = n[r2[h2]];
    if (f2 === void 0)
      throw new SyntaxError(`Non-${i} character`);
    a = a << e | f2, u2 += e, u2 >= 8 && (u2 -= 8, o2[c++] = 255 & a >> u2);
  }
  if (u2 >= e || 255 & a << 8 - u2)
    throw new SyntaxError("Unexpected end of data");
  return o2;
}, Et = (r2, t, e) => {
  const i = t[t.length - 1] === "=", n = (1 << e) - 1;
  let s2 = "", o2 = 0, u2 = 0;
  for (let a = 0; a < r2.length; ++a)
    for (u2 = u2 << 8 | r2[a], o2 += 8; o2 > e; )
      o2 -= e, s2 += t[n & u2 >> o2];
  if (o2 && (s2 += t[n & u2 << e - o2]), i)
    for (; s2.length * e & 7; )
      s2 += "=";
  return s2;
}, d$1 = ({ name: r2, prefix: t, bitsPerChar: e, alphabet: i }) => O$1({ prefix: t, name: r2, encode(n) {
  return Et(n, i, e);
}, decode(n) {
  return gt(n, i, e, r2);
} }), bt = O$1({ prefix: "\0", name: "identity", encode: (r2) => ht(r2), decode: (r2) => ct(r2) });
var yt = Object.freeze({ __proto__: null, identity: bt });
const wt = d$1({ prefix: "0", name: "base2", alphabet: "01", bitsPerChar: 1 });
var Ct = Object.freeze({ __proto__: null, base2: wt });
const mt = d$1({ prefix: "7", name: "base8", alphabet: "01234567", bitsPerChar: 3 });
var vt = Object.freeze({ __proto__: null, base8: mt });
const At = T$1({ prefix: "9", name: "base10", alphabet: "0123456789" });
var _t = Object.freeze({ __proto__: null, base10: At });
const xt = d$1({ prefix: "f", name: "base16", alphabet: "0123456789abcdef", bitsPerChar: 4 }), Rt = d$1({ prefix: "F", name: "base16upper", alphabet: "0123456789ABCDEF", bitsPerChar: 4 });
var Ft = Object.freeze({ __proto__: null, base16: xt, base16upper: Rt });
const Tt = d$1({ prefix: "b", name: "base32", alphabet: "abcdefghijklmnopqrstuvwxyz234567", bitsPerChar: 5 }), It = d$1({ prefix: "B", name: "base32upper", alphabet: "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567", bitsPerChar: 5 }), qt = d$1({ prefix: "c", name: "base32pad", alphabet: "abcdefghijklmnopqrstuvwxyz234567=", bitsPerChar: 5 }), Ut = d$1({ prefix: "C", name: "base32padupper", alphabet: "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567=", bitsPerChar: 5 }), Ot = d$1({ prefix: "v", name: "base32hex", alphabet: "0123456789abcdefghijklmnopqrstuv", bitsPerChar: 5 }), St = d$1({ prefix: "V", name: "base32hexupper", alphabet: "0123456789ABCDEFGHIJKLMNOPQRSTUV", bitsPerChar: 5 }), Pt = d$1({ prefix: "t", name: "base32hexpad", alphabet: "0123456789abcdefghijklmnopqrstuv=", bitsPerChar: 5 }), Nt = d$1({ prefix: "T", name: "base32hexpadupper", alphabet: "0123456789ABCDEFGHIJKLMNOPQRSTUV=", bitsPerChar: 5 }), $t = d$1({ prefix: "h", name: "base32z", alphabet: "ybndrfg8ejkmcpqxot1uwisza345h769", bitsPerChar: 5 });
var Bt = Object.freeze({ __proto__: null, base32: Tt, base32upper: It, base32pad: qt, base32padupper: Ut, base32hex: Ot, base32hexupper: St, base32hexpad: Pt, base32hexpadupper: Nt, base32z: $t });
const zt = T$1({ prefix: "k", name: "base36", alphabet: "0123456789abcdefghijklmnopqrstuvwxyz" }), jt = T$1({ prefix: "K", name: "base36upper", alphabet: "0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ" });
var Mt = Object.freeze({ __proto__: null, base36: zt, base36upper: jt });
const Lt = T$1({ name: "base58btc", prefix: "z", alphabet: "123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz" }), Kt = T$1({ name: "base58flickr", prefix: "Z", alphabet: "123456789abcdefghijkmnopqrstuvwxyzABCDEFGHJKLMNPQRSTUVWXYZ" });
var Vt = Object.freeze({ __proto__: null, base58btc: Lt, base58flickr: Kt });
const kt = d$1({ prefix: "m", name: "base64", alphabet: "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/", bitsPerChar: 6 }), Jt = d$1({ prefix: "M", name: "base64pad", alphabet: "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/=", bitsPerChar: 6 }), Xt = d$1({ prefix: "u", name: "base64url", alphabet: "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_", bitsPerChar: 6 }), Gt = d$1({ prefix: "U", name: "base64urlpad", alphabet: "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_=", bitsPerChar: 6 });
var Ht = Object.freeze({ __proto__: null, base64: kt, base64pad: Jt, base64url: Xt, base64urlpad: Gt });
const ne$1 = Array.from("🚀🪐☄🛰🌌🌑🌒🌓🌔🌕🌖🌗🌘🌍🌏🌎🐉☀💻🖥💾💿😂❤😍🤣😊🙏💕😭😘👍😅👏😁🔥🥰💔💖💙😢🤔😆🙄💪😉☺👌🤗💜😔😎😇🌹🤦🎉💞✌✨🤷😱😌🌸🙌😋💗💚😏💛🙂💓🤩😄😀🖤😃💯🙈👇🎶😒🤭❣😜💋👀😪😑💥🙋😞😩😡🤪👊🥳😥🤤👉💃😳✋😚😝😴🌟😬🙃🍀🌷😻😓⭐✅🥺🌈😈🤘💦✔😣🏃💐☹🎊💘😠☝😕🌺🎂🌻😐🖕💝🙊😹🗣💫💀👑🎵🤞😛🔴😤🌼😫⚽🤙☕🏆🤫👈😮🙆🍻🍃🐶💁😲🌿🧡🎁⚡🌞🎈❌✊👋😰🤨😶🤝🚶💰🍓💢🤟🙁🚨💨🤬✈🎀🍺🤓😙💟🌱😖👶🥴▶➡❓💎💸⬇😨🌚🦋😷🕺⚠🙅😟😵👎🤲🤠🤧📌🔵💅🧐🐾🍒😗🤑🌊🤯🐷☎💧😯💆👆🎤🙇🍑❄🌴💣🐸💌📍🥀🤢👅💡💩👐📸👻🤐🤮🎼🥵🚩🍎🍊👼💍📣🥂"), Yt = ne$1.reduce((r2, t, e) => (r2[e] = t, r2), []), Qt = ne$1.reduce((r2, t, e) => (r2[t.codePointAt(0)] = e, r2), []);
function Zt(r2) {
  return r2.reduce((t, e) => (t += Yt[e], t), "");
}
function Wt(r2) {
  const t = [];
  for (const e of r2) {
    const i = Qt[e.codePointAt(0)];
    if (i === void 0)
      throw new Error(`Non-base256emoji character: ${e}`);
    t.push(i);
  }
  return new Uint8Array(t);
}
const er = O$1({ prefix: "🚀", name: "base256emoji", encode: Zt, decode: Wt });
var tr = Object.freeze({ __proto__: null, base256emoji: er }), rr = oe$1, se = 128, ir = 127, nr = ~ir, sr = Math.pow(2, 31);
function oe$1(r2, t, e) {
  t = t || [], e = e || 0;
  for (var i = e; r2 >= sr; )
    t[e++] = r2 & 255 | se, r2 /= 128;
  for (; r2 & nr; )
    t[e++] = r2 & 255 | se, r2 >>>= 7;
  return t[e] = r2 | 0, oe$1.bytes = e - i + 1, t;
}
var or = j$1, ur = 128, ue = 127;
function j$1(r2, i) {
  var e = 0, i = i || 0, n = 0, s2 = i, o2, u2 = r2.length;
  do {
    if (s2 >= u2)
      throw j$1.bytes = 0, new RangeError("Could not decode varint");
    o2 = r2[s2++], e += n < 28 ? (o2 & ue) << n : (o2 & ue) * Math.pow(2, n), n += 7;
  } while (o2 >= ur);
  return j$1.bytes = s2 - i, e;
}
var ar = Math.pow(2, 7), Dr = Math.pow(2, 14), cr = Math.pow(2, 21), hr = Math.pow(2, 28), lr = Math.pow(2, 35), dr = Math.pow(2, 42), pr = Math.pow(2, 49), fr = Math.pow(2, 56), gr = Math.pow(2, 63), Er = function(r2) {
  return r2 < ar ? 1 : r2 < Dr ? 2 : r2 < cr ? 3 : r2 < hr ? 4 : r2 < lr ? 5 : r2 < dr ? 6 : r2 < pr ? 7 : r2 < fr ? 8 : r2 < gr ? 9 : 10;
}, br = { encode: rr, decode: or, encodingLength: Er }, ae$1 = br;
const De = (r2, t, e = 0) => (ae$1.encode(r2, t, e), t), ce$1 = (r2) => ae$1.encodingLength(r2), M$2 = (r2, t) => {
  const e = t.byteLength, i = ce$1(r2), n = i + ce$1(e), s2 = new Uint8Array(n + e);
  return De(r2, s2, 0), De(e, s2, i), s2.set(t, n), new yr(r2, e, t, s2);
};
class yr {
  constructor(t, e, i, n) {
    this.code = t, this.size = e, this.digest = i, this.bytes = n;
  }
}
const he$1 = ({ name: r2, code: t, encode: e }) => new wr(r2, t, e);
class wr {
  constructor(t, e, i) {
    this.name = t, this.code = e, this.encode = i;
  }
  digest(t) {
    if (t instanceof Uint8Array) {
      const e = this.encode(t);
      return e instanceof Uint8Array ? M$2(this.code, e) : e.then((i) => M$2(this.code, i));
    } else
      throw Error("Unknown type, must be binary type");
  }
}
const le$1 = (r2) => async (t) => new Uint8Array(await crypto.subtle.digest(r2, t)), Cr = he$1({ name: "sha2-256", code: 18, encode: le$1("SHA-256") }), mr = he$1({ name: "sha2-512", code: 19, encode: le$1("SHA-512") });
var vr = Object.freeze({ __proto__: null, sha256: Cr, sha512: mr });
const de$1 = 0, Ar = "identity", pe$1 = re, _r = (r2) => M$2(de$1, pe$1(r2)), xr = { code: de$1, name: Ar, encode: pe$1, digest: _r };
var Rr = Object.freeze({ __proto__: null, identity: xr });
new TextEncoder(), new TextDecoder();
const fe = { ...yt, ...Ct, ...vt, ..._t, ...Ft, ...Bt, ...Mt, ...Vt, ...Ht, ...tr };
({ ...vr, ...Rr });
function ge(r2, t, e, i) {
  return { name: r2, prefix: t, encoder: { name: r2, prefix: t, encode: e }, decoder: { decode: i } };
}
const Ee = ge("utf8", "u", (r2) => "u" + new TextDecoder("utf8").decode(r2), (r2) => new TextEncoder().encode(r2.substring(1))), L$1 = ge("ascii", "a", (r2) => {
  let t = "a";
  for (let e = 0; e < r2.length; e++)
    t += String.fromCharCode(r2[e]);
  return t;
}, (r2) => {
  r2 = r2.substring(1);
  const t = ot(r2.length);
  for (let e = 0; e < r2.length; e++)
    t[e] = r2.charCodeAt(e);
  return t;
}), be = { utf8: Ee, "utf-8": Ee, hex: fe.base16, latin1: L$1, ascii: L$1, binary: L$1, ...fe };
function Fr(r2, t = "utf8") {
  const e = be[t];
  if (!e)
    throw new Error(`Unsupported encoding "${t}"`);
  return (t === "utf8" || t === "utf-8") && globalThis.Buffer != null && globalThis.Buffer.from != null ? globalThis.Buffer.from(r2, "utf8") : e.decoder.decode(`${e.prefix}${r2}`);
}
function Tr(r2, t = "utf8") {
  const e = be[t];
  if (!e)
    throw new Error(`Unsupported encoding "${t}"`);
  return (t === "utf8" || t === "utf-8") && globalThis.Buffer != null && globalThis.Buffer.from != null ? globalThis.Buffer.from(r2.buffer, r2.byteOffset, r2.byteLength).toString("utf8") : e.encoder.encode(r2).substring(1);
}
const ye = "base16", we = "utf8";
function K$1(r2) {
  const t = sha256.hash(Fr(r2, we));
  return Tr(t, ye);
}
var Or = Object.defineProperty, Sr = Object.defineProperties, Pr = Object.getOwnPropertyDescriptors, Ce = Object.getOwnPropertySymbols, Nr = Object.prototype.hasOwnProperty, $r = Object.prototype.propertyIsEnumerable, me = (r2, t, e) => t in r2 ? Or(r2, t, { enumerable: true, configurable: true, writable: true, value: e }) : r2[t] = e, I$2 = (r2, t) => {
  for (var e in t || (t = {}))
    Nr.call(t, e) && me(r2, e, t[e]);
  if (Ce)
    for (var e of Ce(t))
      $r.call(t, e) && me(r2, e, t[e]);
  return r2;
}, V$1 = (r2, t) => Sr(r2, Pr(t));
class Br extends G$2 {
  constructor(t) {
    super(t), this.initialized = false, this.name = "authEngine", this.init = () => {
      this.initialized || (this.registerRelayerEvents(), this.registerPairingEvents(), this.client.core.pairing.register({ methods: Object.keys(R$1) }), this.initialized = true);
    }, this.request = async (e, i) => {
      if (this.isInitialized(), !nt(e))
        throw new Error("Invalid request");
      if (i != null && i.topic)
        return await this.requestOnKnownPairing(i.topic, e);
      const { chainId: n, statement: s2, aud: o2, domain: u2, nonce: a, type: c, exp: h2, nbf: f2 } = e, { topic: p2, uri: A2 } = await this.client.core.pairing.create();
      this.client.logger.info({ message: "Generated new pairing", pairing: { topic: p2, uri: A2 } });
      const D2 = await this.client.core.crypto.generateKeyPair(), l2 = Kn(D2);
      await this.client.authKeys.set(x$1, { responseTopic: l2, publicKey: D2 }), await this.client.pairingTopics.set(l2, { topic: l2, pairingTopic: p2 }), await this.client.core.relayer.subscribe(l2), this.client.logger.info(`sending request to new pairing topic: ${p2}`);
      const m2 = await this.sendRequest(p2, "wc_authRequest", { payloadParams: { type: c ?? "eip4361", chainId: n, statement: s2, aud: o2, domain: u2, version: "1", nonce: a, iat: (/* @__PURE__ */ new Date()).toISOString(), exp: h2, nbf: f2 }, requester: { publicKey: D2, metadata: this.client.metadata } }, {}, e.expiry);
      return this.client.logger.info(`sent request to new pairing topic: ${p2}`), { uri: A2, id: m2 };
    }, this.respond = async (e, i) => {
      if (this.isInitialized(), !st(e, this.client.requests))
        throw new Error("Invalid response");
      const n = te(this.client.requests, e.id);
      if (!n)
        throw new Error(`Could not find pending auth request with id ${e.id}`);
      const s2 = n.requester.publicKey, o2 = await this.client.core.crypto.generateKeyPair(), u2 = Kn(s2), a = { type: _$1, receiverPublicKey: s2, senderPublicKey: o2 };
      if ("error" in e) {
        await this.sendError(n.id, u2, e, a);
        return;
      }
      const c = { h: { t: "eip4361" }, p: V$1(I$2({}, n.cacaoPayload), { iss: i }), s: e.signature };
      await this.sendResult(n.id, u2, c, a), await this.client.core.pairing.activate({ topic: n.pairingTopic }), await this.client.requests.update(n.id, I$2({}, c));
    }, this.getPendingRequests = () => ee(this.client.requests), this.formatMessage = (e, i) => {
      this.client.logger.debug(`formatMessage, cacao is: ${JSON.stringify(e)}`);
      const n = `${e.domain} wants you to sign in with your Ethereum account:`, s2 = W$2(i), o2 = e.statement, u2 = `URI: ${e.aud}`, a = `Version: ${e.version}`, c = `Chain ID: ${Ze(i)}`, h2 = `Nonce: ${e.nonce}`, f2 = `Issued At: ${e.iat}`, p2 = e.exp ? `Expiry: ${e.exp}` : void 0, A2 = e.resources && e.resources.length > 0 ? `Resources:
${e.resources.map((D2) => `- ${D2}`).join(`
`)}` : void 0;
      return [n, s2, "", o2, "", u2, a, c, h2, f2, p2, A2].filter((D2) => D2 != null).join(`
`);
    }, this.setExpiry = async (e, i) => {
      this.client.core.pairing.pairings.keys.includes(e) && await this.client.core.pairing.updateExpiry({ topic: e, expiry: i }), this.client.core.expirer.set(e, i);
    }, this.sendRequest = async (e, i, n, s2, o2) => {
      const u2 = formatJsonRpcRequest(i, n), a = await this.client.core.crypto.encode(e, u2, s2), c = R$1[i].req;
      if (o2 && (c.ttl = o2), this.client.core.history.set(e, u2), D$1()) {
        const h2 = K$1(JSON.stringify(u2));
        this.client.core.verify.register({ attestationId: h2 });
      }
      return await this.client.core.relayer.publish(e, a, V$1(I$2({}, c), { internal: { throwOnFailedPublish: true } })), u2.id;
    }, this.sendResult = async (e, i, n, s2) => {
      const o2 = formatJsonRpcResult(e, n), u2 = await this.client.core.crypto.encode(i, o2, s2), a = await this.client.core.history.get(i, e), c = R$1[a.request.method].res;
      return await this.client.core.relayer.publish(i, u2, V$1(I$2({}, c), { internal: { throwOnFailedPublish: true } })), await this.client.core.history.resolve(o2), o2.id;
    }, this.sendError = async (e, i, n, s2) => {
      const o2 = formatJsonRpcError(e, n.error), u2 = await this.client.core.crypto.encode(i, o2, s2), a = await this.client.core.history.get(i, e), c = R$1[a.request.method].res;
      return await this.client.core.relayer.publish(i, u2, c), await this.client.core.history.resolve(o2), o2.id;
    }, this.requestOnKnownPairing = async (e, i) => {
      const n = this.client.core.pairing.pairings.getAll({ active: true }).find((A2) => A2.topic === e);
      if (!n)
        throw new Error(`Could not find pairing for provided topic ${e}`);
      const { publicKey: s2 } = this.client.authKeys.get(x$1), { chainId: o2, statement: u2, aud: a, domain: c, nonce: h2, type: f2 } = i, p2 = await this.sendRequest(n.topic, "wc_authRequest", { payloadParams: { type: f2 ?? "eip4361", chainId: o2, statement: u2, aud: a, domain: c, version: "1", nonce: h2, iat: (/* @__PURE__ */ new Date()).toISOString() }, requester: { publicKey: s2, metadata: this.client.metadata } }, {}, i.expiry);
      return this.client.logger.info(`sent request to known pairing topic: ${n.topic}`), { id: p2 };
    }, this.onPairingCreated = (e) => {
      const i = this.getPendingRequests();
      if (i) {
        const n = Object.values(i).find((s2) => s2.pairingTopic === e.topic);
        n && this.handleAuthRequest(n);
      }
    }, this.onRelayEventRequest = (e) => {
      const { topic: i, payload: n } = e, s2 = n.method;
      switch (s2) {
        case "wc_authRequest":
          return this.onAuthRequest(i, n);
        default:
          return this.client.logger.info(`Unsupported request method ${s2}`);
      }
    }, this.onRelayEventResponse = async (e) => {
      const { topic: i, payload: n } = e, s2 = (await this.client.core.history.get(i, n.id)).request.method;
      switch (s2) {
        case "wc_authRequest":
          return this.onAuthResponse(i, n);
        default:
          return this.client.logger.info(`Unsupported response method ${s2}`);
      }
    }, this.onAuthRequest = async (e, i) => {
      const { requester: n, payloadParams: s2 } = i.params;
      this.client.logger.info({ type: "onAuthRequest", topic: e, payload: i });
      const o2 = K$1(JSON.stringify(i)), u2 = await this.getVerifyContext(o2, this.client.metadata), a = { requester: n, pairingTopic: e, id: i.id, cacaoPayload: s2, verifyContext: u2 };
      await this.client.requests.set(i.id, a), this.handleAuthRequest(a);
    }, this.handleAuthRequest = async (e) => {
      const { id: i, pairingTopic: n, requester: s2, cacaoPayload: o2, verifyContext: u2 } = e;
      try {
        this.client.emit("auth_request", { id: i, topic: n, params: { requester: s2, cacaoPayload: o2 }, verifyContext: u2 });
      } catch (a) {
        await this.sendError(e.id, e.pairingTopic, a), this.client.logger.error(a);
      }
    }, this.onAuthResponse = async (e, i) => {
      const { id: n } = i;
      if (this.client.logger.info({ type: "onAuthResponse", topic: e, response: i }), isJsonRpcResult(i)) {
        const { pairingTopic: s2 } = this.client.pairingTopics.get(e);
        await this.client.core.pairing.activate({ topic: s2 });
        const { s: o2, p: u2 } = i.result;
        await this.client.requests.set(n, I$2({ id: n, pairingTopic: s2 }, i.result));
        const a = this.formatMessage(u2, u2.iss);
        this.client.logger.debug(`reconstructed message:
`, JSON.stringify(a)), this.client.logger.debug("payload.iss:", u2.iss), this.client.logger.debug("signature:", o2);
        const c = W$2(u2.iss), h2 = We(u2.iss);
        if (!c)
          throw new Error("Could not derive address from `payload.iss`");
        if (!h2)
          throw new Error("Could not derive chainId from `payload.iss`");
        this.client.logger.debug("walletAddress extracted from `payload.iss`:", c), await et(c, a, o2, h2, this.client.projectId) ? this.client.emit("auth_response", { id: n, topic: e, params: i }) : this.client.emit("auth_response", { id: n, topic: e, params: { message: "Invalid signature", code: -1 } });
      } else
        isJsonRpcError(i) && this.client.emit("auth_response", { id: n, topic: e, params: i });
    }, this.getVerifyContext = async (e, i) => {
      const n = { verified: { verifyUrl: i.verifyUrl || "", validation: "UNKNOWN", origin: i.url || "" } };
      try {
        const s2 = await this.client.core.verify.resolve({ attestationId: e, verifyUrl: i.verifyUrl });
        s2 && (n.verified.origin = s2.origin, n.verified.isScam = s2.isScam, n.verified.validation = origin === new URL(i.url).origin ? "VALID" : "INVALID");
      } catch (s2) {
        this.client.logger.error(s2);
      }
      return this.client.logger.info(`Verify context: ${JSON.stringify(n)}`), n;
    };
  }
  isInitialized() {
    if (!this.initialized) {
      const { message: t } = N("NOT_INITIALIZED", this.name);
      throw new Error(t);
    }
  }
  registerRelayerEvents() {
    this.client.core.relayer.on(D$2.message, async (t) => {
      const { topic: e, message: i } = t, { responseTopic: n, publicKey: s2 } = this.client.authKeys.keys.includes(x$1) ? this.client.authKeys.get(x$1) : { responseTopic: void 0, publicKey: void 0 };
      if (n && e !== n) {
        this.client.logger.debug("[Auth] Ignoring message from unknown topic", e);
        return;
      }
      const o2 = await this.client.core.crypto.decode(e, i, { receiverPublicKey: s2 });
      isJsonRpcRequest(o2) ? (this.client.core.history.set(e, o2), this.onRelayEventRequest({ topic: e, payload: o2 })) : isJsonRpcResponse(o2) && (await this.client.core.history.resolve(o2), this.onRelayEventResponse({ topic: e, payload: o2 }));
    });
  }
  registerPairingEvents() {
    this.client.core.pairing.events.on(V$2.create, (t) => this.onPairingCreated(t));
  }
}
let S$1 = class S extends H$1 {
  constructor(t) {
    super(t), this.protocol = $, this.version = Q$1, this.name = B, this.events = new eventsExports.EventEmitter(), this.emit = (i, n) => this.events.emit(i, n), this.on = (i, n) => this.events.on(i, n), this.once = (i, n) => this.events.once(i, n), this.off = (i, n) => this.events.off(i, n), this.removeListener = (i, n) => this.events.removeListener(i, n), this.request = async (i, n) => {
      try {
        return await this.engine.request(i, n);
      } catch (s2) {
        throw this.logger.error(s2.message), s2;
      }
    }, this.respond = async (i, n) => {
      try {
        return await this.engine.respond(i, n);
      } catch (s2) {
        throw this.logger.error(s2.message), s2;
      }
    }, this.getPendingRequests = () => {
      try {
        return this.engine.getPendingRequests();
      } catch (i) {
        throw this.logger.error(i.message), i;
      }
    }, this.formatMessage = (i, n) => {
      try {
        return this.engine.formatMessage(i, n);
      } catch (s2) {
        throw this.logger.error(s2.message), s2;
      }
    };
    const e = typeof t.logger < "u" && typeof t.logger != "string" ? t.logger : cjs.pino(cjs.getDefaultLoggerOptions({ level: t.logger || "error" }));
    this.name = (t == null ? void 0 : t.name) || B, this.metadata = t.metadata, this.projectId = t.projectId, this.core = t.core || new Nr$1(t), this.logger = cjs.generateChildLogger(e, this.name), this.authKeys = new Mt$1(this.core, this.logger, "authKeys", F$2, () => x$1), this.pairingTopics = new Mt$1(this.core, this.logger, "pairingTopics", F$2), this.requests = new Mt$1(this.core, this.logger, "requests", F$2, (i) => i.id), this.engine = new Br(this);
  }
  static async init(t) {
    const e = new S(t);
    return await e.initialize(), e;
  }
  get context() {
    return cjs.getLoggerContext(this.logger);
  }
  async initialize() {
    this.logger.trace("Initialized");
    try {
      await this.core.start(), await this.authKeys.init(), await this.requests.init(), await this.pairingTopics.init(), await this.engine.init(), this.logger.info("AuthClient Initialization Success"), this.logger.info({ authClient: this });
    } catch (t) {
      throw this.logger.info("AuthClient Initialization Failure"), this.logger.error(t.message), t;
    }
  }
};
const zr = S$1;
const X$1 = "wc", F$1 = 2, H2 = "client", G$1 = `${X$1}@${F$1}:${H2}:`, M$1 = { name: H2, logger: "error", controller: false, relayUrl: "wss://relay.walletconnect.com" }, W$1 = "WALLETCONNECT_DEEPLINK_CHOICE", ne = "proposal", oe = "Proposal expired", ae = "session", A = cjs$1.SEVEN_DAYS, ce = "engine", V = { wc_sessionPropose: { req: { ttl: cjs$1.FIVE_MINUTES, prompt: true, tag: 1100 }, res: { ttl: cjs$1.FIVE_MINUTES, prompt: false, tag: 1101 } }, wc_sessionSettle: { req: { ttl: cjs$1.FIVE_MINUTES, prompt: false, tag: 1102 }, res: { ttl: cjs$1.FIVE_MINUTES, prompt: false, tag: 1103 } }, wc_sessionUpdate: { req: { ttl: cjs$1.ONE_DAY, prompt: false, tag: 1104 }, res: { ttl: cjs$1.ONE_DAY, prompt: false, tag: 1105 } }, wc_sessionExtend: { req: { ttl: cjs$1.ONE_DAY, prompt: false, tag: 1106 }, res: { ttl: cjs$1.ONE_DAY, prompt: false, tag: 1107 } }, wc_sessionRequest: { req: { ttl: cjs$1.FIVE_MINUTES, prompt: true, tag: 1108 }, res: { ttl: cjs$1.FIVE_MINUTES, prompt: false, tag: 1109 } }, wc_sessionEvent: { req: { ttl: cjs$1.FIVE_MINUTES, prompt: true, tag: 1110 }, res: { ttl: cjs$1.FIVE_MINUTES, prompt: false, tag: 1111 } }, wc_sessionDelete: { req: { ttl: cjs$1.ONE_DAY, prompt: false, tag: 1112 }, res: { ttl: cjs$1.ONE_DAY, prompt: false, tag: 1113 } }, wc_sessionPing: { req: { ttl: cjs$1.THIRTY_SECONDS, prompt: false, tag: 1114 }, res: { ttl: cjs$1.THIRTY_SECONDS, prompt: false, tag: 1115 } } }, U$1 = { min: cjs$1.FIVE_MINUTES, max: cjs$1.SEVEN_DAYS }, I$1 = { idle: "IDLE", active: "ACTIVE" }, le = "request", pe = ["wc_sessionPropose", "wc_sessionRequest", "wc_authRequest"];
var os = Object.defineProperty, as = Object.defineProperties, cs = Object.getOwnPropertyDescriptors, he = Object.getOwnPropertySymbols, ls = Object.prototype.hasOwnProperty, ps = Object.prototype.propertyIsEnumerable, de = (m2, r2, e) => r2 in m2 ? os(m2, r2, { enumerable: true, configurable: true, writable: true, value: e }) : m2[r2] = e, g$1 = (m2, r2) => {
  for (var e in r2 || (r2 = {}))
    ls.call(r2, e) && de(m2, e, r2[e]);
  if (he)
    for (var e of he(r2))
      ps.call(r2, e) && de(m2, e, r2[e]);
  return m2;
}, b$1 = (m2, r2) => as(m2, cs(r2));
class hs extends S$2 {
  constructor(r2) {
    super(r2), this.name = ce, this.events = new Ye(), this.initialized = false, this.ignoredPayloadTypes = [_$1], this.requestQueue = { state: I$1.idle, queue: [] }, this.sessionRequestQueue = { state: I$1.idle, queue: [] }, this.requestQueueDelay = cjs$1.ONE_SECOND, this.init = async () => {
      this.initialized || (await this.cleanup(), this.registerRelayerEvents(), this.registerExpirerEvents(), this.registerPairingEvents(), this.client.core.pairing.register({ methods: Object.keys(V) }), this.initialized = true, setTimeout(() => {
        this.sessionRequestQueue.queue = this.getPendingSessionRequests(), this.processSessionRequestQueue();
      }, cjs$1.toMiliseconds(this.requestQueueDelay)));
    }, this.connect = async (e) => {
      await this.isInitialized();
      const s2 = b$1(g$1({}, e), { requiredNamespaces: e.requiredNamespaces || {}, optionalNamespaces: e.optionalNamespaces || {} });
      await this.isValidConnect(s2);
      const { pairingTopic: t, requiredNamespaces: i, optionalNamespaces: n, sessionProperties: o2, relays: a } = s2;
      let c = t, p2, d2 = false;
      if (c && (d2 = this.client.core.pairing.pairings.get(c).active), !c || !d2) {
        const { topic: v2, uri: S3 } = await this.client.core.pairing.create();
        c = v2, p2 = S3;
      }
      const h2 = await this.client.core.crypto.generateKeyPair(), R2 = g$1({ requiredNamespaces: i, optionalNamespaces: n, relays: a ?? [{ protocol: ht$1 }], proposer: { publicKey: h2, metadata: this.client.metadata } }, o2 && { sessionProperties: o2 }), { reject: w2, resolve: T2, done: K2 } = at$1(cjs$1.FIVE_MINUTES, oe);
      if (this.events.once(yt$1("session_connect"), async ({ error: v2, session: S3 }) => {
        if (v2)
          w2(v2);
        else if (S3) {
          S3.self.publicKey = h2;
          const B2 = b$1(g$1({}, S3), { requiredNamespaces: S3.requiredNamespaces, optionalNamespaces: S3.optionalNamespaces });
          await this.client.session.set(S3.topic, B2), await this.setExpiry(S3.topic, S3.expiry), c && await this.client.core.pairing.updateMetadata({ topic: c, metadata: S3.peer.metadata }), T2(B2);
        }
      }), !c) {
        const { message: v2 } = N("NO_MATCHING_KEY", `connect() pairing topic: ${c}`);
        throw new Error(v2);
      }
      const L2 = await this.sendRequest({ topic: c, method: "wc_sessionPropose", params: R2 }), ue2 = pt$1(cjs$1.FIVE_MINUTES);
      return await this.setProposal(L2, g$1({ id: L2, expiry: ue2 }, R2)), { uri: p2, approval: K2 };
    }, this.pair = async (e) => (await this.isInitialized(), await this.client.core.pairing.pair(e)), this.approve = async (e) => {
      await this.isInitialized(), await this.isValidApprove(e);
      const { id: s2, relayProtocol: t, namespaces: i, sessionProperties: n } = e, o2 = this.client.proposal.get(s2);
      let { pairingTopic: a, proposer: c, requiredNamespaces: p2, optionalNamespaces: d2 } = o2;
      a = a || "", B$1(p2) || (p2 = jt$1(i, "approve()"));
      const h2 = await this.client.core.crypto.generateKeyPair(), R2 = c.publicKey, w2 = await this.client.core.crypto.generateSharedKey(h2, R2);
      a && s2 && (await this.client.core.pairing.updateMetadata({ topic: a, metadata: c.metadata }), await this.sendResult({ id: s2, topic: a, result: { relay: { protocol: t ?? "irn" }, responderPublicKey: h2 } }), await this.client.proposal.delete(s2, U$3("USER_DISCONNECTED")), await this.client.core.pairing.activate({ topic: a }));
      const T2 = g$1({ relay: { protocol: t ?? "irn" }, namespaces: i, requiredNamespaces: p2, optionalNamespaces: d2, pairingTopic: a, controller: { publicKey: h2, metadata: this.client.metadata }, expiry: pt$1(A) }, n && { sessionProperties: n });
      await this.client.core.relayer.subscribe(w2), await this.sendRequest({ topic: w2, method: "wc_sessionSettle", params: T2, throwOnFailedPublish: true });
      const K2 = b$1(g$1({}, T2), { topic: w2, pairingTopic: a, acknowledged: false, self: T2.controller, peer: { publicKey: c.publicKey, metadata: c.metadata }, controller: h2 });
      return await this.client.session.set(w2, K2), await this.setExpiry(w2, pt$1(A)), { topic: w2, acknowledged: () => new Promise((L2) => setTimeout(() => L2(this.client.session.get(w2)), 500)) };
    }, this.reject = async (e) => {
      await this.isInitialized(), await this.isValidReject(e);
      const { id: s2, reason: t } = e, { pairingTopic: i } = this.client.proposal.get(s2);
      i && (await this.sendError(s2, i, t), await this.client.proposal.delete(s2, U$3("USER_DISCONNECTED")));
    }, this.update = async (e) => {
      await this.isInitialized(), await this.isValidUpdate(e);
      const { topic: s2, namespaces: t } = e, i = await this.sendRequest({ topic: s2, method: "wc_sessionUpdate", params: { namespaces: t } }), { done: n, resolve: o2, reject: a } = at$1();
      return this.events.once(yt$1("session_update", i), ({ error: c }) => {
        c ? a(c) : o2();
      }), await this.client.session.update(s2, { namespaces: t }), { acknowledged: n };
    }, this.extend = async (e) => {
      await this.isInitialized(), await this.isValidExtend(e);
      const { topic: s2 } = e, t = await this.sendRequest({ topic: s2, method: "wc_sessionExtend", params: {} }), { done: i, resolve: n, reject: o2 } = at$1();
      return this.events.once(yt$1("session_extend", t), ({ error: a }) => {
        a ? o2(a) : n();
      }), await this.setExpiry(s2, pt$1(A)), { acknowledged: i };
    }, this.request = async (e) => {
      await this.isInitialized(), await this.isValidRequest(e);
      const { chainId: s2, request: t, topic: i, expiry: n } = e, o2 = payloadId(), { done: a, resolve: c, reject: p2 } = at$1(n, "Request expired. Please try again.");
      return this.events.once(yt$1("session_request", o2), ({ error: d2, result: h2 }) => {
        d2 ? p2(d2) : c(h2);
      }), await Promise.all([new Promise(async (d2) => {
        await this.sendRequest({ clientRpcId: o2, topic: i, method: "wc_sessionRequest", params: { request: t, chainId: s2 }, expiry: n, throwOnFailedPublish: true }).catch((h2) => p2(h2)), this.client.events.emit("session_request_sent", { topic: i, request: t, chainId: s2, id: o2 }), d2();
      }), new Promise(async (d2) => {
        const h2 = await gt$1(this.client.core.storage, W$1);
        ht$2({ id: o2, topic: i, wcDeepLink: h2 }), d2();
      }), a()]).then((d2) => d2[2]);
    }, this.respond = async (e) => {
      await this.isInitialized(), await this.isValidRespond(e);
      const { topic: s2, response: t } = e, { id: i } = t;
      isJsonRpcResult(t) ? await this.sendResult({ id: i, topic: s2, result: t.result, throwOnFailedPublish: true }) : isJsonRpcError(t) && await this.sendError(i, s2, t.error), this.cleanupAfterResponse(e);
    }, this.ping = async (e) => {
      await this.isInitialized(), await this.isValidPing(e);
      const { topic: s2 } = e;
      if (this.client.session.keys.includes(s2)) {
        const t = await this.sendRequest({ topic: s2, method: "wc_sessionPing", params: {} }), { done: i, resolve: n, reject: o2 } = at$1();
        this.events.once(yt$1("session_ping", t), ({ error: a }) => {
          a ? o2(a) : n();
        }), await i();
      } else
        this.client.core.pairing.pairings.keys.includes(s2) && await this.client.core.pairing.ping({ topic: s2 });
    }, this.emit = async (e) => {
      await this.isInitialized(), await this.isValidEmit(e);
      const { topic: s2, event: t, chainId: i } = e;
      await this.sendRequest({ topic: s2, method: "wc_sessionEvent", params: { event: t, chainId: i } });
    }, this.disconnect = async (e) => {
      await this.isInitialized(), await this.isValidDisconnect(e);
      const { topic: s2 } = e;
      this.client.session.keys.includes(s2) ? (await this.sendRequest({ topic: s2, method: "wc_sessionDelete", params: U$3("USER_DISCONNECTED"), throwOnFailedPublish: true }), await this.deleteSession(s2)) : await this.client.core.pairing.disconnect({ topic: s2 });
    }, this.find = (e) => (this.isInitialized(), this.client.session.getAll().filter((s2) => Dt$1(s2, e))), this.getPendingSessionRequests = () => (this.isInitialized(), this.client.pendingRequest.getAll()), this.cleanupDuplicatePairings = async (e) => {
      if (e.pairingTopic)
        try {
          const s2 = this.client.core.pairing.pairings.get(e.pairingTopic), t = this.client.core.pairing.pairings.getAll().filter((i) => {
            var n, o2;
            return ((n = i.peerMetadata) == null ? void 0 : n.url) && ((o2 = i.peerMetadata) == null ? void 0 : o2.url) === e.peer.metadata.url && i.topic && i.topic !== s2.topic;
          });
          if (t.length === 0)
            return;
          this.client.logger.info(`Cleaning up ${t.length} duplicate pairing(s)`), await Promise.all(t.map((i) => this.client.core.pairing.disconnect({ topic: i.topic }))), this.client.logger.info("Duplicate pairings clean up finished");
        } catch (s2) {
          this.client.logger.error(s2);
        }
    }, this.deleteSession = async (e, s2) => {
      const { self: t } = this.client.session.get(e);
      await this.client.core.relayer.unsubscribe(e), this.client.session.delete(e, U$3("USER_DISCONNECTED")), this.client.core.crypto.keychain.has(t.publicKey) && await this.client.core.crypto.deleteKeyPair(t.publicKey), this.client.core.crypto.keychain.has(e) && await this.client.core.crypto.deleteSymKey(e), s2 || this.client.core.expirer.del(e), this.client.core.storage.removeItem(W$1).catch((i) => this.client.logger.warn(i));
    }, this.deleteProposal = async (e, s2) => {
      await Promise.all([this.client.proposal.delete(e, U$3("USER_DISCONNECTED")), s2 ? Promise.resolve() : this.client.core.expirer.del(e)]);
    }, this.deletePendingSessionRequest = async (e, s2, t = false) => {
      await Promise.all([this.client.pendingRequest.delete(e, s2), t ? Promise.resolve() : this.client.core.expirer.del(e)]), this.sessionRequestQueue.queue = this.sessionRequestQueue.queue.filter((i) => i.id !== e), t && (this.sessionRequestQueue.state = I$1.idle);
    }, this.setExpiry = async (e, s2) => {
      this.client.session.keys.includes(e) && await this.client.session.update(e, { expiry: s2 }), this.client.core.expirer.set(e, s2);
    }, this.setProposal = async (e, s2) => {
      await this.client.proposal.set(e, s2), this.client.core.expirer.set(e, s2.expiry);
    }, this.setPendingSessionRequest = async (e) => {
      const s2 = V.wc_sessionRequest.req.ttl, { id: t, topic: i, params: n, verifyContext: o2 } = e;
      await this.client.pendingRequest.set(t, { id: t, topic: i, params: n, verifyContext: o2 }), s2 && this.client.core.expirer.set(t, pt$1(s2));
    }, this.sendRequest = async (e) => {
      const { topic: s2, method: t, params: i, expiry: n, relayRpcId: o2, clientRpcId: a, throwOnFailedPublish: c } = e, p2 = formatJsonRpcRequest(t, i, a);
      if (D$1() && pe.includes(t)) {
        const R2 = Ln(JSON.stringify(p2));
        this.client.core.verify.register({ attestationId: R2 });
      }
      const d2 = await this.client.core.crypto.encode(s2, p2), h2 = V[t].req;
      return n && (h2.ttl = n), o2 && (h2.id = o2), this.client.core.history.set(s2, p2), c ? (h2.internal = b$1(g$1({}, h2.internal), { throwOnFailedPublish: true }), await this.client.core.relayer.publish(s2, d2, h2)) : this.client.core.relayer.publish(s2, d2, h2).catch((R2) => this.client.logger.error(R2)), p2.id;
    }, this.sendResult = async (e) => {
      const { id: s2, topic: t, result: i, throwOnFailedPublish: n } = e, o2 = formatJsonRpcResult(s2, i), a = await this.client.core.crypto.encode(t, o2), c = await this.client.core.history.get(t, s2), p2 = V[c.request.method].res;
      n ? (p2.internal = b$1(g$1({}, p2.internal), { throwOnFailedPublish: true }), await this.client.core.relayer.publish(t, a, p2)) : this.client.core.relayer.publish(t, a, p2).catch((d2) => this.client.logger.error(d2)), await this.client.core.history.resolve(o2);
    }, this.sendError = async (e, s2, t) => {
      const i = formatJsonRpcError(e, t), n = await this.client.core.crypto.encode(s2, i), o2 = await this.client.core.history.get(s2, e), a = V[o2.request.method].res;
      this.client.core.relayer.publish(s2, n, a), await this.client.core.history.resolve(i);
    }, this.cleanup = async () => {
      const e = [], s2 = [];
      this.client.session.getAll().forEach((t) => {
        mt$1(t.expiry) && e.push(t.topic);
      }), this.client.proposal.getAll().forEach((t) => {
        mt$1(t.expiry) && s2.push(t.id);
      }), await Promise.all([...e.map((t) => this.deleteSession(t)), ...s2.map((t) => this.deleteProposal(t))]);
    }, this.onRelayEventRequest = async (e) => {
      this.requestQueue.queue.push(e), await this.processRequestsQueue();
    }, this.processRequestsQueue = async () => {
      if (this.requestQueue.state === I$1.active) {
        this.client.logger.info("Request queue already active, skipping...");
        return;
      }
      for (this.client.logger.info(`Request queue starting with ${this.requestQueue.queue.length} requests`); this.requestQueue.queue.length > 0; ) {
        this.requestQueue.state = I$1.active;
        const e = this.requestQueue.queue.shift();
        if (e)
          try {
            this.processRequest(e), await new Promise((s2) => setTimeout(s2, 300));
          } catch (s2) {
            this.client.logger.warn(s2);
          }
      }
      this.requestQueue.state = I$1.idle;
    }, this.processRequest = (e) => {
      const { topic: s2, payload: t } = e, i = t.method;
      switch (i) {
        case "wc_sessionPropose":
          return this.onSessionProposeRequest(s2, t);
        case "wc_sessionSettle":
          return this.onSessionSettleRequest(s2, t);
        case "wc_sessionUpdate":
          return this.onSessionUpdateRequest(s2, t);
        case "wc_sessionExtend":
          return this.onSessionExtendRequest(s2, t);
        case "wc_sessionPing":
          return this.onSessionPingRequest(s2, t);
        case "wc_sessionDelete":
          return this.onSessionDeleteRequest(s2, t);
        case "wc_sessionRequest":
          return this.onSessionRequest(s2, t);
        case "wc_sessionEvent":
          return this.onSessionEventRequest(s2, t);
        default:
          return this.client.logger.info(`Unsupported request method ${i}`);
      }
    }, this.onRelayEventResponse = async (e) => {
      const { topic: s2, payload: t } = e, i = (await this.client.core.history.get(s2, t.id)).request.method;
      switch (i) {
        case "wc_sessionPropose":
          return this.onSessionProposeResponse(s2, t);
        case "wc_sessionSettle":
          return this.onSessionSettleResponse(s2, t);
        case "wc_sessionUpdate":
          return this.onSessionUpdateResponse(s2, t);
        case "wc_sessionExtend":
          return this.onSessionExtendResponse(s2, t);
        case "wc_sessionPing":
          return this.onSessionPingResponse(s2, t);
        case "wc_sessionRequest":
          return this.onSessionRequestResponse(s2, t);
        default:
          return this.client.logger.info(`Unsupported response method ${i}`);
      }
    }, this.onRelayEventUnknownPayload = (e) => {
      const { topic: s2 } = e, { message: t } = N("MISSING_OR_INVALID", `Decoded payload on topic ${s2} is not identifiable as a JSON-RPC request or a response.`);
      throw new Error(t);
    }, this.onSessionProposeRequest = async (e, s2) => {
      const { params: t, id: i } = s2;
      try {
        this.isValidConnect(g$1({}, s2.params));
        const n = pt$1(cjs$1.FIVE_MINUTES), o2 = g$1({ id: i, pairingTopic: e, expiry: n }, t);
        await this.setProposal(i, o2);
        const a = Ln(JSON.stringify(s2)), c = await this.getVerifyContext(a, o2.proposer.metadata);
        this.client.events.emit("session_proposal", { id: i, params: o2, verifyContext: c });
      } catch (n) {
        await this.sendError(i, e, n), this.client.logger.error(n);
      }
    }, this.onSessionProposeResponse = async (e, s2) => {
      const { id: t } = s2;
      if (isJsonRpcResult(s2)) {
        const { result: i } = s2;
        this.client.logger.trace({ type: "method", method: "onSessionProposeResponse", result: i });
        const n = this.client.proposal.get(t);
        this.client.logger.trace({ type: "method", method: "onSessionProposeResponse", proposal: n });
        const o2 = n.proposer.publicKey;
        this.client.logger.trace({ type: "method", method: "onSessionProposeResponse", selfPublicKey: o2 });
        const a = i.responderPublicKey;
        this.client.logger.trace({ type: "method", method: "onSessionProposeResponse", peerPublicKey: a });
        const c = await this.client.core.crypto.generateSharedKey(o2, a);
        this.client.logger.trace({ type: "method", method: "onSessionProposeResponse", sessionTopic: c });
        const p2 = await this.client.core.relayer.subscribe(c);
        this.client.logger.trace({ type: "method", method: "onSessionProposeResponse", subscriptionId: p2 }), await this.client.core.pairing.activate({ topic: e });
      } else
        isJsonRpcError(s2) && (await this.client.proposal.delete(t, U$3("USER_DISCONNECTED")), this.events.emit(yt$1("session_connect"), { error: s2.error }));
    }, this.onSessionSettleRequest = async (e, s2) => {
      const { id: t, params: i } = s2;
      try {
        this.isValidSessionSettleRequest(i);
        const { relay: n, controller: o2, expiry: a, namespaces: c, requiredNamespaces: p2, optionalNamespaces: d2, sessionProperties: h2, pairingTopic: R2 } = s2.params, w2 = g$1({ topic: e, relay: n, expiry: a, namespaces: c, acknowledged: true, pairingTopic: R2, requiredNamespaces: p2, optionalNamespaces: d2, controller: o2.publicKey, self: { publicKey: "", metadata: this.client.metadata }, peer: { publicKey: o2.publicKey, metadata: o2.metadata } }, h2 && { sessionProperties: h2 });
        await this.sendResult({ id: s2.id, topic: e, result: true }), this.events.emit(yt$1("session_connect"), { session: w2 }), this.cleanupDuplicatePairings(w2);
      } catch (n) {
        await this.sendError(t, e, n), this.client.logger.error(n);
      }
    }, this.onSessionSettleResponse = async (e, s2) => {
      const { id: t } = s2;
      isJsonRpcResult(s2) ? (await this.client.session.update(e, { acknowledged: true }), this.events.emit(yt$1("session_approve", t), {})) : isJsonRpcError(s2) && (await this.client.session.delete(e, U$3("USER_DISCONNECTED")), this.events.emit(yt$1("session_approve", t), { error: s2.error }));
    }, this.onSessionUpdateRequest = async (e, s2) => {
      const { params: t, id: i } = s2;
      try {
        const n = `${e}_session_update`, o2 = tr$1.get(n);
        if (o2 && this.isRequestOutOfSync(o2, i)) {
          this.client.logger.info(`Discarding out of sync request - ${i}`);
          return;
        }
        this.isValidUpdate(g$1({ topic: e }, t)), await this.client.session.update(e, { namespaces: t.namespaces }), await this.sendResult({ id: i, topic: e, result: true }), this.client.events.emit("session_update", { id: i, topic: e, params: t }), tr$1.set(n, i);
      } catch (n) {
        await this.sendError(i, e, n), this.client.logger.error(n);
      }
    }, this.isRequestOutOfSync = (e, s2) => parseInt(s2.toString().slice(0, -3)) <= parseInt(e.toString().slice(0, -3)), this.onSessionUpdateResponse = (e, s2) => {
      const { id: t } = s2;
      isJsonRpcResult(s2) ? this.events.emit(yt$1("session_update", t), {}) : isJsonRpcError(s2) && this.events.emit(yt$1("session_update", t), { error: s2.error });
    }, this.onSessionExtendRequest = async (e, s2) => {
      const { id: t } = s2;
      try {
        this.isValidExtend({ topic: e }), await this.setExpiry(e, pt$1(A)), await this.sendResult({ id: t, topic: e, result: true }), this.client.events.emit("session_extend", { id: t, topic: e });
      } catch (i) {
        await this.sendError(t, e, i), this.client.logger.error(i);
      }
    }, this.onSessionExtendResponse = (e, s2) => {
      const { id: t } = s2;
      isJsonRpcResult(s2) ? this.events.emit(yt$1("session_extend", t), {}) : isJsonRpcError(s2) && this.events.emit(yt$1("session_extend", t), { error: s2.error });
    }, this.onSessionPingRequest = async (e, s2) => {
      const { id: t } = s2;
      try {
        this.isValidPing({ topic: e }), await this.sendResult({ id: t, topic: e, result: true }), this.client.events.emit("session_ping", { id: t, topic: e });
      } catch (i) {
        await this.sendError(t, e, i), this.client.logger.error(i);
      }
    }, this.onSessionPingResponse = (e, s2) => {
      const { id: t } = s2;
      setTimeout(() => {
        isJsonRpcResult(s2) ? this.events.emit(yt$1("session_ping", t), {}) : isJsonRpcError(s2) && this.events.emit(yt$1("session_ping", t), { error: s2.error });
      }, 500);
    }, this.onSessionDeleteRequest = async (e, s2) => {
      const { id: t } = s2;
      try {
        this.isValidDisconnect({ topic: e, reason: s2.params }), await Promise.all([new Promise((i) => {
          this.client.core.relayer.once(D$2.publish, async () => {
            i(await this.deleteSession(e));
          });
        }), this.sendResult({ id: t, topic: e, result: true })]), this.client.events.emit("session_delete", { id: t, topic: e });
      } catch (i) {
        this.client.logger.error(i);
      }
    }, this.onSessionRequest = async (e, s2) => {
      const { id: t, params: i } = s2;
      try {
        this.isValidRequest(g$1({ topic: e }, i));
        const n = Ln(JSON.stringify(formatJsonRpcRequest("wc_sessionRequest", i, t))), o2 = this.client.session.get(e), a = await this.getVerifyContext(n, o2.peer.metadata), c = { id: t, topic: e, params: i, verifyContext: a };
        await this.setPendingSessionRequest(c), this.addSessionRequestToSessionRequestQueue(c), this.processSessionRequestQueue();
      } catch (n) {
        await this.sendError(t, e, n), this.client.logger.error(n);
      }
    }, this.onSessionRequestResponse = (e, s2) => {
      const { id: t } = s2;
      isJsonRpcResult(s2) ? this.events.emit(yt$1("session_request", t), { result: s2.result }) : isJsonRpcError(s2) && this.events.emit(yt$1("session_request", t), { error: s2.error });
    }, this.onSessionEventRequest = async (e, s2) => {
      const { id: t, params: i } = s2;
      try {
        const n = `${e}_session_event_${i.event.name}`, o2 = tr$1.get(n);
        if (o2 && this.isRequestOutOfSync(o2, t)) {
          this.client.logger.info(`Discarding out of sync request - ${t}`);
          return;
        }
        this.isValidEmit(g$1({ topic: e }, i)), this.client.events.emit("session_event", { id: t, topic: e, params: i }), tr$1.set(n, t);
      } catch (n) {
        await this.sendError(t, e, n), this.client.logger.error(n);
      }
    }, this.addSessionRequestToSessionRequestQueue = (e) => {
      this.sessionRequestQueue.queue.push(e);
    }, this.cleanupAfterResponse = (e) => {
      this.deletePendingSessionRequest(e.response.id, { message: "fulfilled", code: 0 }), setTimeout(() => {
        this.sessionRequestQueue.state = I$1.idle, this.processSessionRequestQueue();
      }, cjs$1.toMiliseconds(this.requestQueueDelay));
    }, this.processSessionRequestQueue = () => {
      if (this.sessionRequestQueue.state === I$1.active) {
        this.client.logger.info("session request queue is already active.");
        return;
      }
      const e = this.sessionRequestQueue.queue[0];
      if (!e) {
        this.client.logger.info("session request queue is empty.");
        return;
      }
      try {
        this.sessionRequestQueue.state = I$1.active, this.client.events.emit("session_request", e);
      } catch (s2) {
        this.client.logger.error(s2);
      }
    }, this.onPairingCreated = (e) => {
      if (e.active)
        return;
      const s2 = this.client.proposal.getAll().find((t) => t.pairingTopic === e.topic);
      s2 && this.onSessionProposeRequest(e.topic, formatJsonRpcRequest("wc_sessionPropose", { requiredNamespaces: s2.requiredNamespaces, optionalNamespaces: s2.optionalNamespaces, relays: s2.relays, proposer: s2.proposer, sessionProperties: s2.sessionProperties }, s2.id));
    }, this.isValidConnect = async (e) => {
      if (!Ht$1(e)) {
        const { message: a } = N("MISSING_OR_INVALID", `connect() params: ${JSON.stringify(e)}`);
        throw new Error(a);
      }
      const { pairingTopic: s2, requiredNamespaces: t, optionalNamespaces: i, sessionProperties: n, relays: o2 } = e;
      if (w$1(s2) || await this.isValidPairingTopic(s2), !xt$1(o2, true)) {
        const { message: a } = N("MISSING_OR_INVALID", `connect() relays: ${o2}`);
        throw new Error(a);
      }
      !w$1(t) && B$1(t) !== 0 && this.validateNamespaces(t, "requiredNamespaces"), !w$1(i) && B$1(i) !== 0 && this.validateNamespaces(i, "optionalNamespaces"), w$1(n) || this.validateSessionProps(n, "sessionProperties");
    }, this.validateNamespaces = (e, s2) => {
      const t = Lt$1(e, "connect()", s2);
      if (t)
        throw new Error(t.message);
    }, this.isValidApprove = async (e) => {
      if (!Ht$1(e))
        throw new Error(N("MISSING_OR_INVALID", `approve() params: ${e}`).message);
      const { id: s2, namespaces: t, relayProtocol: i, sessionProperties: n } = e;
      await this.isValidProposalId(s2);
      const o2 = this.client.proposal.get(s2), a = un(t, "approve()");
      if (a)
        throw new Error(a.message);
      const c = dn(o2.requiredNamespaces, t, "approve()");
      if (c)
        throw new Error(c.message);
      if (!h(i, true)) {
        const { message: p2 } = N("MISSING_OR_INVALID", `approve() relayProtocol: ${i}`);
        throw new Error(p2);
      }
      w$1(n) || this.validateSessionProps(n, "sessionProperties");
    }, this.isValidReject = async (e) => {
      if (!Ht$1(e)) {
        const { message: i } = N("MISSING_OR_INVALID", `reject() params: ${e}`);
        throw new Error(i);
      }
      const { id: s2, reason: t } = e;
      if (await this.isValidProposalId(s2), !qt$1(t)) {
        const { message: i } = N("MISSING_OR_INVALID", `reject() reason: ${JSON.stringify(t)}`);
        throw new Error(i);
      }
    }, this.isValidSessionSettleRequest = (e) => {
      if (!Ht$1(e)) {
        const { message: c } = N("MISSING_OR_INVALID", `onSessionSettleRequest() params: ${e}`);
        throw new Error(c);
      }
      const { relay: s2, controller: t, namespaces: i, expiry: n } = e;
      if (!ln(s2)) {
        const { message: c } = N("MISSING_OR_INVALID", "onSessionSettleRequest() relay protocol should be a string");
        throw new Error(c);
      }
      const o2 = Kt$1(t, "onSessionSettleRequest()");
      if (o2)
        throw new Error(o2.message);
      const a = un(i, "onSessionSettleRequest()");
      if (a)
        throw new Error(a.message);
      if (mt$1(n)) {
        const { message: c } = N("EXPIRED", "onSessionSettleRequest()");
        throw new Error(c);
      }
    }, this.isValidUpdate = async (e) => {
      if (!Ht$1(e)) {
        const { message: a } = N("MISSING_OR_INVALID", `update() params: ${e}`);
        throw new Error(a);
      }
      const { topic: s2, namespaces: t } = e;
      await this.isValidSessionTopic(s2);
      const i = this.client.session.get(s2), n = un(t, "update()");
      if (n)
        throw new Error(n.message);
      const o2 = dn(i.requiredNamespaces, t, "update()");
      if (o2)
        throw new Error(o2.message);
    }, this.isValidExtend = async (e) => {
      if (!Ht$1(e)) {
        const { message: t } = N("MISSING_OR_INVALID", `extend() params: ${e}`);
        throw new Error(t);
      }
      const { topic: s2 } = e;
      await this.isValidSessionTopic(s2);
    }, this.isValidRequest = async (e) => {
      if (!Ht$1(e)) {
        const { message: a } = N("MISSING_OR_INVALID", `request() params: ${e}`);
        throw new Error(a);
      }
      const { topic: s2, request: t, chainId: i, expiry: n } = e;
      await this.isValidSessionTopic(s2);
      const { namespaces: o2 } = this.client.session.get(s2);
      if (!zt$1(o2, i)) {
        const { message: a } = N("MISSING_OR_INVALID", `request() chainId: ${i}`);
        throw new Error(a);
      }
      if (!Bt$1(t)) {
        const { message: a } = N("MISSING_OR_INVALID", `request() ${JSON.stringify(t)}`);
        throw new Error(a);
      }
      if (!Yt$1(o2, i, t.method)) {
        const { message: a } = N("MISSING_OR_INVALID", `request() method: ${t.method}`);
        throw new Error(a);
      }
      if (n && !Xt$1(n, U$1)) {
        const { message: a } = N("MISSING_OR_INVALID", `request() expiry: ${n}. Expiry must be a number (in seconds) between ${U$1.min} and ${U$1.max}`);
        throw new Error(a);
      }
    }, this.isValidRespond = async (e) => {
      if (!Ht$1(e)) {
        const { message: i } = N("MISSING_OR_INVALID", `respond() params: ${e}`);
        throw new Error(i);
      }
      const { topic: s2, response: t } = e;
      if (await this.isValidSessionTopic(s2), !Gt$1(t)) {
        const { message: i } = N("MISSING_OR_INVALID", `respond() response: ${JSON.stringify(t)}`);
        throw new Error(i);
      }
    }, this.isValidPing = async (e) => {
      if (!Ht$1(e)) {
        const { message: t } = N("MISSING_OR_INVALID", `ping() params: ${e}`);
        throw new Error(t);
      }
      const { topic: s2 } = e;
      await this.isValidSessionOrPairingTopic(s2);
    }, this.isValidEmit = async (e) => {
      if (!Ht$1(e)) {
        const { message: o2 } = N("MISSING_OR_INVALID", `emit() params: ${e}`);
        throw new Error(o2);
      }
      const { topic: s2, event: t, chainId: i } = e;
      await this.isValidSessionTopic(s2);
      const { namespaces: n } = this.client.session.get(s2);
      if (!zt$1(n, i)) {
        const { message: o2 } = N("MISSING_OR_INVALID", `emit() chainId: ${i}`);
        throw new Error(o2);
      }
      if (!Wt$1(t)) {
        const { message: o2 } = N("MISSING_OR_INVALID", `emit() event: ${JSON.stringify(t)}`);
        throw new Error(o2);
      }
      if (!Jt$1(n, i, t.name)) {
        const { message: o2 } = N("MISSING_OR_INVALID", `emit() event: ${JSON.stringify(t)}`);
        throw new Error(o2);
      }
    }, this.isValidDisconnect = async (e) => {
      if (!Ht$1(e)) {
        const { message: t } = N("MISSING_OR_INVALID", `disconnect() params: ${e}`);
        throw new Error(t);
      }
      const { topic: s2 } = e;
      await this.isValidSessionOrPairingTopic(s2);
    }, this.getVerifyContext = async (e, s2) => {
      const t = { verified: { verifyUrl: s2.verifyUrl || $$1, validation: "UNKNOWN", origin: s2.url || "" } };
      try {
        const i = await this.client.core.verify.resolve({ attestationId: e, verifyUrl: s2.verifyUrl });
        i && (t.verified.origin = i.origin, t.verified.isScam = i.isScam, t.verified.validation = i.origin === new URL(s2.url).origin ? "VALID" : "INVALID");
      } catch (i) {
        this.client.logger.info(i);
      }
      return this.client.logger.info(`Verify context: ${JSON.stringify(t)}`), t;
    }, this.validateSessionProps = (e, s2) => {
      Object.values(e).forEach((t) => {
        if (!h(t, false)) {
          const { message: i } = N("MISSING_OR_INVALID", `${s2} must be in Record<string, string> format. Received: ${JSON.stringify(t)}`);
          throw new Error(i);
        }
      });
    };
  }
  async isInitialized() {
    if (!this.initialized) {
      const { message: r2 } = N("NOT_INITIALIZED", this.name);
      throw new Error(r2);
    }
    await this.client.core.relayer.confirmOnlineStateOrThrow();
  }
  registerRelayerEvents() {
    this.client.core.relayer.on(D$2.message, async (r2) => {
      const { topic: e, message: s2 } = r2;
      if (this.ignoredPayloadTypes.includes(this.client.core.crypto.getPayloadType(s2)))
        return;
      const t = await this.client.core.crypto.decode(e, s2);
      try {
        isJsonRpcRequest(t) ? (this.client.core.history.set(e, t), this.onRelayEventRequest({ topic: e, payload: t })) : isJsonRpcResponse(t) ? (await this.client.core.history.resolve(t), await this.onRelayEventResponse({ topic: e, payload: t }), this.client.core.history.delete(e, t.id)) : this.onRelayEventUnknownPayload({ topic: e, payload: t });
      } catch (i) {
        this.client.logger.error(i);
      }
    });
  }
  registerExpirerEvents() {
    this.client.core.expirer.on(v.expired, async (r2) => {
      const { topic: e, id: s2 } = ft$1(r2.target);
      if (s2 && this.client.pendingRequest.keys.includes(s2))
        return await this.deletePendingSessionRequest(s2, N("EXPIRED"), true);
      e ? this.client.session.keys.includes(e) && (await this.deleteSession(e, true), this.client.events.emit("session_expire", { topic: e })) : s2 && (await this.deleteProposal(s2, true), this.client.events.emit("proposal_expire", { id: s2 }));
    });
  }
  registerPairingEvents() {
    this.client.core.pairing.events.on(V$2.create, (r2) => this.onPairingCreated(r2));
  }
  isValidPairingTopic(r2) {
    if (!h(r2, false)) {
      const { message: e } = N("MISSING_OR_INVALID", `pairing topic should be a string: ${r2}`);
      throw new Error(e);
    }
    if (!this.client.core.pairing.pairings.keys.includes(r2)) {
      const { message: e } = N("NO_MATCHING_KEY", `pairing topic doesn't exist: ${r2}`);
      throw new Error(e);
    }
    if (mt$1(this.client.core.pairing.pairings.get(r2).expiry)) {
      const { message: e } = N("EXPIRED", `pairing topic: ${r2}`);
      throw new Error(e);
    }
  }
  async isValidSessionTopic(r2) {
    if (!h(r2, false)) {
      const { message: e } = N("MISSING_OR_INVALID", `session topic should be a string: ${r2}`);
      throw new Error(e);
    }
    if (!this.client.session.keys.includes(r2)) {
      const { message: e } = N("NO_MATCHING_KEY", `session topic doesn't exist: ${r2}`);
      throw new Error(e);
    }
    if (mt$1(this.client.session.get(r2).expiry)) {
      await this.deleteSession(r2);
      const { message: e } = N("EXPIRED", `session topic: ${r2}`);
      throw new Error(e);
    }
  }
  async isValidSessionOrPairingTopic(r2) {
    if (this.client.session.keys.includes(r2))
      await this.isValidSessionTopic(r2);
    else if (this.client.core.pairing.pairings.keys.includes(r2))
      this.isValidPairingTopic(r2);
    else if (h(r2, false)) {
      const { message: e } = N("NO_MATCHING_KEY", `session or pairing topic doesn't exist: ${r2}`);
      throw new Error(e);
    } else {
      const { message: e } = N("MISSING_OR_INVALID", `session or pairing topic should be a string: ${r2}`);
      throw new Error(e);
    }
  }
  async isValidProposalId(r2) {
    if (!Ft$1(r2)) {
      const { message: e } = N("MISSING_OR_INVALID", `proposal id should be a number: ${r2}`);
      throw new Error(e);
    }
    if (!this.client.proposal.keys.includes(r2)) {
      const { message: e } = N("NO_MATCHING_KEY", `proposal id doesn't exist: ${r2}`);
      throw new Error(e);
    }
    if (mt$1(this.client.proposal.get(r2).expiry)) {
      await this.deleteProposal(r2);
      const { message: e } = N("EXPIRED", `proposal id: ${r2}`);
      throw new Error(e);
    }
  }
}
class ds extends Mt$1 {
  constructor(r2, e) {
    super(r2, e, ne, G$1), this.core = r2, this.logger = e;
  }
}
class us extends Mt$1 {
  constructor(r2, e) {
    super(r2, e, ae, G$1), this.core = r2, this.logger = e;
  }
}
class gs extends Mt$1 {
  constructor(r2, e) {
    super(r2, e, le, G$1, (s2) => s2.id), this.core = r2, this.logger = e;
  }
}
class Q extends b$2 {
  constructor(r2) {
    super(r2), this.protocol = X$1, this.version = F$1, this.name = M$1.name, this.events = new eventsExports.EventEmitter(), this.on = (s2, t) => this.events.on(s2, t), this.once = (s2, t) => this.events.once(s2, t), this.off = (s2, t) => this.events.off(s2, t), this.removeListener = (s2, t) => this.events.removeListener(s2, t), this.removeAllListeners = (s2) => this.events.removeAllListeners(s2), this.connect = async (s2) => {
      try {
        return await this.engine.connect(s2);
      } catch (t) {
        throw this.logger.error(t.message), t;
      }
    }, this.pair = async (s2) => {
      try {
        return await this.engine.pair(s2);
      } catch (t) {
        throw this.logger.error(t.message), t;
      }
    }, this.approve = async (s2) => {
      try {
        return await this.engine.approve(s2);
      } catch (t) {
        throw this.logger.error(t.message), t;
      }
    }, this.reject = async (s2) => {
      try {
        return await this.engine.reject(s2);
      } catch (t) {
        throw this.logger.error(t.message), t;
      }
    }, this.update = async (s2) => {
      try {
        return await this.engine.update(s2);
      } catch (t) {
        throw this.logger.error(t.message), t;
      }
    }, this.extend = async (s2) => {
      try {
        return await this.engine.extend(s2);
      } catch (t) {
        throw this.logger.error(t.message), t;
      }
    }, this.request = async (s2) => {
      try {
        return await this.engine.request(s2);
      } catch (t) {
        throw this.logger.error(t.message), t;
      }
    }, this.respond = async (s2) => {
      try {
        return await this.engine.respond(s2);
      } catch (t) {
        throw this.logger.error(t.message), t;
      }
    }, this.ping = async (s2) => {
      try {
        return await this.engine.ping(s2);
      } catch (t) {
        throw this.logger.error(t.message), t;
      }
    }, this.emit = async (s2) => {
      try {
        return await this.engine.emit(s2);
      } catch (t) {
        throw this.logger.error(t.message), t;
      }
    }, this.disconnect = async (s2) => {
      try {
        return await this.engine.disconnect(s2);
      } catch (t) {
        throw this.logger.error(t.message), t;
      }
    }, this.find = (s2) => {
      try {
        return this.engine.find(s2);
      } catch (t) {
        throw this.logger.error(t.message), t;
      }
    }, this.getPendingSessionRequests = () => {
      try {
        return this.engine.getPendingSessionRequests();
      } catch (s2) {
        throw this.logger.error(s2.message), s2;
      }
    }, this.name = (r2 == null ? void 0 : r2.name) || M$1.name, this.metadata = (r2 == null ? void 0 : r2.metadata) || Qn();
    const e = typeof (r2 == null ? void 0 : r2.logger) < "u" && typeof (r2 == null ? void 0 : r2.logger) != "string" ? r2.logger : cjs.pino(cjs.getDefaultLoggerOptions({ level: (r2 == null ? void 0 : r2.logger) || M$1.logger }));
    this.core = (r2 == null ? void 0 : r2.core) || new Nr$1(r2), this.logger = cjs.generateChildLogger(e, this.name), this.session = new us(this.core, this.logger), this.proposal = new ds(this.core, this.logger), this.pendingRequest = new gs(this.core, this.logger), this.engine = new hs(this);
  }
  static async init(r2) {
    const e = new Q(r2);
    return await e.initialize(), e;
  }
  get context() {
    return cjs.getLoggerContext(this.logger);
  }
  get pairing() {
    return this.core.pairing.pairings;
  }
  async initialize() {
    this.logger.trace("Initialized");
    try {
      await this.core.start(), await this.session.init(), await this.proposal.init(), await this.pendingRequest.init(), await this.engine.init(), this.core.verify.init({ verifyUrl: this.metadata.verifyUrl }), this.logger.info("SignClient Initialization Success");
    } catch (r2) {
      throw this.logger.info("SignClient Initialization Failure"), this.logger.error(r2.message), r2;
    }
  }
}
const ms = Q;
var l = { exports: {} }, u = typeof Reflect == "object" ? Reflect : null, m = u && typeof u.apply == "function" ? u.apply : function(t, e, n) {
  return Function.prototype.apply.call(t, e, n);
}, f;
u && typeof u.ownKeys == "function" ? f = u.ownKeys : Object.getOwnPropertySymbols ? f = function(t) {
  return Object.getOwnPropertyNames(t).concat(Object.getOwnPropertySymbols(t));
} : f = function(t) {
  return Object.getOwnPropertyNames(t);
};
function T(s2) {
  console && console.warn && console.warn(s2);
}
var y = Number.isNaN || function(t) {
  return t !== t;
};
function o() {
  o.init.call(this);
}
l.exports = o, l.exports.once = M, o.EventEmitter = o, o.prototype._events = void 0, o.prototype._eventsCount = 0, o.prototype._maxListeners = void 0;
var w = 10;
function g(s2) {
  if (typeof s2 != "function")
    throw new TypeError('The "listener" argument must be of type Function. Received type ' + typeof s2);
}
Object.defineProperty(o, "defaultMaxListeners", { enumerable: true, get: function() {
  return w;
}, set: function(s2) {
  if (typeof s2 != "number" || s2 < 0 || y(s2))
    throw new RangeError('The value of "defaultMaxListeners" is out of range. It must be a non-negative number. Received ' + s2 + ".");
  w = s2;
} }), o.init = function() {
  (this._events === void 0 || this._events === Object.getPrototypeOf(this)._events) && (this._events = /* @__PURE__ */ Object.create(null), this._eventsCount = 0), this._maxListeners = this._maxListeners || void 0;
}, o.prototype.setMaxListeners = function(t) {
  if (typeof t != "number" || t < 0 || y(t))
    throw new RangeError('The value of "n" is out of range. It must be a non-negative number. Received ' + t + ".");
  return this._maxListeners = t, this;
};
function L(s2) {
  return s2._maxListeners === void 0 ? o.defaultMaxListeners : s2._maxListeners;
}
o.prototype.getMaxListeners = function() {
  return L(this);
}, o.prototype.emit = function(t) {
  for (var e = [], n = 1; n < arguments.length; n++)
    e.push(arguments[n]);
  var i = t === "error", a = this._events;
  if (a !== void 0)
    i = i && a.error === void 0;
  else if (!i)
    return false;
  if (i) {
    var r2;
    if (e.length > 0 && (r2 = e[0]), r2 instanceof Error)
      throw r2;
    var h2 = new Error("Unhandled error." + (r2 ? " (" + r2.message + ")" : ""));
    throw h2.context = r2, h2;
  }
  var c = a[t];
  if (c === void 0)
    return false;
  if (typeof c == "function")
    m(c, this, e);
  else
    for (var v2 = c.length, A2 = b(c, v2), n = 0; n < v2; ++n)
      m(A2[n], this, e);
  return true;
};
function _(s2, t, e, n) {
  var i, a, r2;
  if (g(e), a = s2._events, a === void 0 ? (a = s2._events = /* @__PURE__ */ Object.create(null), s2._eventsCount = 0) : (a.newListener !== void 0 && (s2.emit("newListener", t, e.listener ? e.listener : e), a = s2._events), r2 = a[t]), r2 === void 0)
    r2 = a[t] = e, ++s2._eventsCount;
  else if (typeof r2 == "function" ? r2 = a[t] = n ? [e, r2] : [r2, e] : n ? r2.unshift(e) : r2.push(e), i = L(s2), i > 0 && r2.length > i && !r2.warned) {
    r2.warned = true;
    var h2 = new Error("Possible EventEmitter memory leak detected. " + r2.length + " " + String(t) + " listeners added. Use emitter.setMaxListeners() to increase limit");
    h2.name = "MaxListenersExceededWarning", h2.emitter = s2, h2.type = t, h2.count = r2.length, T(h2);
  }
  return s2;
}
o.prototype.addListener = function(t, e) {
  return _(this, t, e, false);
}, o.prototype.on = o.prototype.addListener, o.prototype.prependListener = function(t, e) {
  return _(this, t, e, true);
};
function j() {
  if (!this.fired)
    return this.target.removeListener(this.type, this.wrapFn), this.fired = true, arguments.length === 0 ? this.listener.call(this.target) : this.listener.apply(this.target, arguments);
}
function S2(s2, t, e) {
  var n = { fired: false, wrapFn: void 0, target: s2, type: t, listener: e }, i = j.bind(n);
  return i.listener = e, n.wrapFn = i, i;
}
o.prototype.once = function(t, e) {
  return g(e), this.on(t, S2(this, t, e)), this;
}, o.prototype.prependOnceListener = function(t, e) {
  return g(e), this.prependListener(t, S2(this, t, e)), this;
}, o.prototype.removeListener = function(t, e) {
  var n, i, a, r2, h2;
  if (g(e), i = this._events, i === void 0)
    return this;
  if (n = i[t], n === void 0)
    return this;
  if (n === e || n.listener === e)
    --this._eventsCount === 0 ? this._events = /* @__PURE__ */ Object.create(null) : (delete i[t], i.removeListener && this.emit("removeListener", t, n.listener || e));
  else if (typeof n != "function") {
    for (a = -1, r2 = n.length - 1; r2 >= 0; r2--)
      if (n[r2] === e || n[r2].listener === e) {
        h2 = n[r2].listener, a = r2;
        break;
      }
    if (a < 0)
      return this;
    a === 0 ? n.shift() : I(n, a), n.length === 1 && (i[t] = n[0]), i.removeListener !== void 0 && this.emit("removeListener", t, h2 || e);
  }
  return this;
}, o.prototype.off = o.prototype.removeListener, o.prototype.removeAllListeners = function(t) {
  var e, n, i;
  if (n = this._events, n === void 0)
    return this;
  if (n.removeListener === void 0)
    return arguments.length === 0 ? (this._events = /* @__PURE__ */ Object.create(null), this._eventsCount = 0) : n[t] !== void 0 && (--this._eventsCount === 0 ? this._events = /* @__PURE__ */ Object.create(null) : delete n[t]), this;
  if (arguments.length === 0) {
    var a = Object.keys(n), r2;
    for (i = 0; i < a.length; ++i)
      r2 = a[i], r2 !== "removeListener" && this.removeAllListeners(r2);
    return this.removeAllListeners("removeListener"), this._events = /* @__PURE__ */ Object.create(null), this._eventsCount = 0, this;
  }
  if (e = n[t], typeof e == "function")
    this.removeListener(t, e);
  else if (e !== void 0)
    for (i = e.length - 1; i >= 0; i--)
      this.removeListener(t, e[i]);
  return this;
};
function C(s2, t, e) {
  var n = s2._events;
  if (n === void 0)
    return [];
  var i = n[t];
  return i === void 0 ? [] : typeof i == "function" ? e ? [i.listener || i] : [i] : e ? W(i) : b(i, i.length);
}
o.prototype.listeners = function(t) {
  return C(this, t, true);
}, o.prototype.rawListeners = function(t) {
  return C(this, t, false);
}, o.listenerCount = function(s2, t) {
  return typeof s2.listenerCount == "function" ? s2.listenerCount(t) : E.call(s2, t);
}, o.prototype.listenerCount = E;
function E(s2) {
  var t = this._events;
  if (t !== void 0) {
    var e = t[s2];
    if (typeof e == "function")
      return 1;
    if (e !== void 0)
      return e.length;
  }
  return 0;
}
o.prototype.eventNames = function() {
  return this._eventsCount > 0 ? f(this._events) : [];
};
function b(s2, t) {
  for (var e = new Array(t), n = 0; n < t; ++n)
    e[n] = s2[n];
  return e;
}
function I(s2, t) {
  for (; t + 1 < s2.length; t++)
    s2[t] = s2[t + 1];
  s2.pop();
}
function W(s2) {
  for (var t = new Array(s2.length), e = 0; e < t.length; ++e)
    t[e] = s2[e].listener || s2[e];
  return t;
}
function M(s2, t) {
  return new Promise(function(e, n) {
    function i(r2) {
      s2.removeListener(t, a), n(r2);
    }
    function a() {
      typeof s2.removeListener == "function" && s2.removeListener("error", i), e([].slice.call(arguments));
    }
    R(s2, t, a, { once: true }), t !== "error" && z(s2, i, { once: true });
  });
}
function z(s2, t, e) {
  typeof s2.on == "function" && R(s2, "error", t, e);
}
function R(s2, t, e, n) {
  if (typeof s2.on == "function")
    n.once ? s2.once(t, e) : s2.on(t, e);
  else if (typeof s2.addEventListener == "function")
    s2.addEventListener(t, function i(a) {
      n.once && s2.removeEventListener(t, i), e(a);
    });
  else
    throw new TypeError('The "emitter" argument must be of type EventEmitter. Received type ' + typeof s2);
}
const O = "wc", F = 2, d = "Web3Wallet", K = `${O}@2:${d}:`, k = { database: ":memory:" }, U = "request";
class X extends l.exports {
  constructor() {
    super();
  }
}
class x {
  constructor(t) {
    this.opts = t;
  }
}
class P {
  constructor(t) {
    this.client = t;
  }
}
class D extends P {
  constructor(t) {
    super(t), this.init = async () => {
      this.signClient = await ms.init({ core: this.client.core, metadata: this.client.metadata }), this.authClient = await zr.init({ core: this.client.core, projectId: "", metadata: this.client.metadata }), this.initializeEventListeners();
    }, this.pair = async (e) => {
      await this.client.core.pairing.pair(e);
    }, this.approveSession = async (e) => {
      const { topic: n, acknowledged: i } = await this.signClient.approve({ id: e.id, namespaces: e.namespaces });
      return await i(), this.signClient.session.get(n);
    }, this.rejectSession = async (e) => await this.signClient.reject(e), this.updateSession = async (e) => await (await this.signClient.update(e)).acknowledged(), this.extendSession = async (e) => await (await this.signClient.extend(e)).acknowledged(), this.respondSessionRequest = async (e) => await this.signClient.respond(e), this.disconnectSession = async (e) => await this.signClient.disconnect(e), this.emitSessionEvent = async (e) => await this.signClient.emit(e), this.getActiveSessions = () => this.signClient.session.getAll().reduce((e, n) => (e[n.topic] = n, e), {}), this.getPendingSessionProposals = () => this.signClient.proposal.getAll(), this.getPendingSessionRequests = () => this.signClient.getPendingSessionRequests(), this.respondAuthRequest = async (e, n) => await this.authClient.respond(e, n), this.getPendingAuthRequests = () => this.authClient.requests.getAll().filter((e) => "requester" in e), this.formatMessage = (e, n) => this.authClient.formatMessage(e, n), this.onSessionRequest = (e) => {
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
}
class p extends x {
  constructor(t) {
    super(t), this.events = new l.exports(), this.on = (e, n) => this.events.on(e, n), this.once = (e, n) => this.events.once(e, n), this.off = (e, n) => this.events.off(e, n), this.removeListener = (e, n) => this.events.removeListener(e, n), this.pair = async (e) => {
      try {
        return await this.engine.pair(e);
      } catch (n) {
        throw this.logger.error(n.message), n;
      }
    }, this.approveSession = async (e) => {
      try {
        return await this.engine.approveSession(e);
      } catch (n) {
        throw this.logger.error(n.message), n;
      }
    }, this.rejectSession = async (e) => {
      try {
        return await this.engine.rejectSession(e);
      } catch (n) {
        throw this.logger.error(n.message), n;
      }
    }, this.updateSession = async (e) => {
      try {
        return await this.engine.updateSession(e);
      } catch (n) {
        throw this.logger.error(n.message), n;
      }
    }, this.extendSession = async (e) => {
      try {
        return await this.engine.extendSession(e);
      } catch (n) {
        throw this.logger.error(n.message), n;
      }
    }, this.respondSessionRequest = async (e) => {
      try {
        return await this.engine.respondSessionRequest(e);
      } catch (n) {
        throw this.logger.error(n.message), n;
      }
    }, this.disconnectSession = async (e) => {
      try {
        return await this.engine.disconnectSession(e);
      } catch (n) {
        throw this.logger.error(n.message), n;
      }
    }, this.emitSessionEvent = async (e) => {
      try {
        return await this.engine.emitSessionEvent(e);
      } catch (n) {
        throw this.logger.error(n.message), n;
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
    }, this.respondAuthRequest = async (e, n) => {
      try {
        return await this.engine.respondAuthRequest(e, n);
      } catch (i) {
        throw this.logger.error(i.message), i;
      }
    }, this.getPendingAuthRequests = () => {
      try {
        return this.engine.getPendingAuthRequests();
      } catch (e) {
        throw this.logger.error(e.message), e;
      }
    }, this.formatMessage = (e, n) => {
      try {
        return this.engine.formatMessage(e, n);
      } catch (i) {
        throw this.logger.error(i.message), i;
      }
    }, this.metadata = t.metadata, this.name = t.name || d, this.core = t.core, this.logger = this.core.logger, this.engine = new D(this);
  }
  static async init(t) {
    const e = new p(t);
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
}
const G2 = p;
export {
  d as CLIENT_CONTEXT,
  k as CLIENT_STORAGE_OPTIONS,
  K as CLIENT_STORAGE_PREFIX,
  x as IWeb3Wallet,
  P as IWeb3WalletEngine,
  X as IWeb3WalletEvents,
  O as PROTOCOL,
  F as PROTOCOL_VERSION,
  U as REQUEST_CONTEXT,
  G2 as Web3Wallet,
  p as default
};
