package jsonw

import (
	"encoding/binary"
	"math/bits"
	"unicode/utf8"
	"unsafe"
)

// AppendQuotedString encodes a JSON string, appending it to `b`.
func AppendQuotedString(b []byte, str string) []byte {
	data := unsafe.Slice(unsafe.StringData(str), len(str))
	return AppendQuoted(b, data)
}

// AppendQuoted encodes a JSON string, appending it to `b`.
func AppendQuoted(buf []byte, str []byte) []byte {
	buf = append(buf, '"')
	n := len(str)
	if n == 0 {
		buf = append(buf, '"')
		return buf
	}

	i := 0
	start := 0
	for i < n {
		c := str[i]
		// Special bytes are dispatched without entering SWAR. This keeps the
		// per-byte cost low when escapes or multi-byte UTF-8 dominate.
		if c < 0x20 || c == '"' || c == '\\' {
			if i > start {
				buf = append(buf, str[start:i]...)
			}
			buf = appendASCIIEscape(buf, c)
			i++
			start = i
			continue
		}
		if c >= 0x80 {
			r, size := utf8.DecodeRune(str[i:])
			if r == utf8.RuneError && size == 1 {
				if i > start {
					buf = append(buf, str[start:i]...)
				}
				buf = append(buf, `\ufffd`...)
				i++
				start = i
			} else {
				i += size
			}
			continue
		}
		// Safe ASCII byte: skip ahead 8 bytes at a time using SWAR.
		i++
		for n-i >= 8 {
			v := binary.LittleEndian.Uint64(str[i:])
			m := swarMask(v)
			if m != 0 {
				i += bits.TrailingZeros64(m) >> 3
				break
			}
			i += 8
		}
		// Scalar advance over any safe bytes left in the tail.
		for i < n {
			cc := str[i]
			if cc < 0x20 || cc == '"' || cc == '\\' || cc >= 0x80 {
				break
			}
			i++
		}
	}
	if start < n {
		buf = append(buf, str[start:]...)
	}
	return append(buf, '"')
}

// JSON string escaping.
//
// The hot loop uses SWAR (SIMD-within-a-register) to scan eight input bytes
// per uint64 load. A byte needs special handling iff it is < 0x20, '"', '\\',
// or >= 0x80. The mask tricks below (hasLess, hasByte) come from the standard
// Bit Twiddling Hacks. On runs of safe bytes the loop skips eight bytes at a
// time without touching memory; the safe run is flushed to the output buffer
// in one append when the next escape byte is found.
//
// All bytes 0x00-0x1F are escaped (short forms \b \t \n \f \r, otherwise
// \u00XX), as are '"' and '\\'. Valid multi-byte UTF-8 is passed through
// unchanged; invalid UTF-8 bytes are replaced with the \ufffd escape,
// matching encoding/json.

const (
	swarLSB = 0x0101010101010101
	swarMSB = 0x8080808080808080
)

// swarMask returns a uint64 where the high bit of each byte indicates whether
// the corresponding byte of v needs special handling: byte < 0x20, == '"'
// (0x22), == '\\' (0x5C), or >= 0x80.
//
// Subtraction borrows from low bytes can set extra bits in higher byte
// positions, but the lowest set bit in the mask always corresponds to a true
// escape byte (any false-positive byte must have a true escape byte below it
// in memory order). So locating the first byte to handle via
// bits.TrailingZeros64 on a little-endian load is always correct.
func swarMask(v uint64) uint64 {
	lt := (v - swarLSB*0x20) &^ v & swarMSB
	x1 := v ^ (swarLSB * 0x22)
	e1 := (x1 - swarLSB) &^ x1 & swarMSB
	x2 := v ^ (swarLSB * 0x5C)
	e2 := (x2 - swarLSB) &^ x2 & swarMSB
	hi := v & swarMSB
	return lt | e1 | e2 | hi
}

func appendASCIIEscape(buf []byte, c byte) []byte {
	switch c {
	case '"':
		return append(buf, '\\', '"')
	case '\\':
		return append(buf, '\\', '\\')
	case '\b':
		return append(buf, '\\', 'b')
	case '\t':
		return append(buf, '\\', 't')
	case '\n':
		return append(buf, '\\', 'n')
	case '\f':
		return append(buf, '\\', 'f')
	case '\r':
		return append(buf, '\\', 'r')
	default:
		const hex = "0123456789abcdef"
		return append(buf, '\\', 'u', '0', '0', hex[c>>4], hex[c&0xF])
	}
}
