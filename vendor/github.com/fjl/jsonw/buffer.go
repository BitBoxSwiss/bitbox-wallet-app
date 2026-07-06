/*
Package jsonw implements a JSON encoder.

To create a JSON output, create a [Buffer] and call methods on it.
*/
package jsonw

import (
	"bytes"
	"encoding/hex"
	"encoding/json"
	"math"
	"math/big"
	"strconv"
)

type bufferState byte

const (
	initial bufferState = iota
	objectKey
	objectKeyFirst
	objectValue
	arrayFirst
	arrayRest
)

// Buffer is a JSON encoder buffer.
type Buffer struct {
	buf   []byte
	enc   *json.Encoder
	encw  *encWriter
	state bufferState
}

func (b *Buffer) Reset() {
	b.buf = b.buf[:0]
	b.state = initial
}

// NewBuffer creates a buffer with the given capacity.
func NewBuffer(cap int) *Buffer {
	return &Buffer{
		buf: make([]byte, 0, cap),
	}
}

// Output returns the written JSON bytes.
//
// This can only be called at the top-level encoding context.
// Using Output from within a call to Array or Object will panic.
//
// The return value aliases the internal buffer, and may change content
// after Reset and/or future calls to encoder methods.
func (b *Buffer) Output() []byte {
	if b.state != initial {
		panic("Output called in array or object context")
	}
	return b.buf[:len(b.buf):len(b.buf)]
}

// RawValue appends a pre-encoded value.
// Note there are no validity checks on the value, except that it must not be empty.
func (b *Buffer) RawValue(v []byte) {
	v = bytes.TrimSpace(v)
	if len(v) == 0 {
		panic("RawValue called with empty value")
	}
	b.beginValue()
	defer b.endValue()
	b.buf = append(b.buf, v...)
}

// Null appends a JSON null.
func (b *Buffer) Null() {
	b.beginValue()
	defer b.endValue()
	b.buf = append(b.buf, "null"...)
}

// Bool appends a JSON boolean.
func (b *Buffer) Bool(v bool) {
	b.beginValue()
	defer b.endValue()
	if v {
		b.buf = append(b.buf, "true"...)
	} else {
		b.buf = append(b.buf, "false"...)
	}
}

// String appends a JSON string value.
func (b *Buffer) String(s string) {
	b.beginValue()
	defer b.endValue()
	b.buf = AppendQuotedString(b.buf, s)
}

// HexBytes appends a hex-string as bytes.
func (b *Buffer) HexBytes(v []byte) {
	b.beginValue()
	defer b.endValue()

	b.buf = append(b.buf, `"0x`...)
	start := len(b.buf)
	b.buf = append(b.buf, make([]byte, hex.EncodedLen(len(v)))...)
	hex.Encode(b.buf[start:], v)
	b.buf = append(b.buf, `"`...)
}

// HexUint64 appends an integer as a hex-encoded string.
func (b *Buffer) HexUint64(v uint64) {
	b.beginValue()
	defer b.endValue()

	b.buf = append(b.buf, `"0x`...)
	b.buf = strconv.AppendUint(b.buf, v, 16)
	b.buf = append(b.buf, '"')
}

// Uint64 appends a decimal integer.
func (b *Buffer) Uint64(v uint64) {
	b.beginValue()
	defer b.endValue()
	b.buf = strconv.AppendUint(b.buf, v, 10)
}

// Int64 appends a decimal integer.
func (b *Buffer) Int64(v int64) {
	b.beginValue()
	defer b.endValue()
	b.buf = strconv.AppendInt(b.buf, v, 10)
}

// Float64 appends a float64.
//
// NaN and ±Inf have no representation in standard JSON. They are written
// as "NaN", "Infinity", "-Infinity" (like JSON5). The caller must handle these
// values explicitly.
func (b *Buffer) Float64(v float64) {
	b.beginValue()
	defer b.endValue()

	if math.IsInf(v, 0) {
		if v < 0 {
			b.buf = append(b.buf, "-Infinity"...)
		} else {
			b.buf = append(b.buf, "Infinity"...)
		}
		return
	}
	// Match encoding/json and use 'e' for very small or very large magnitudes.
	// However, we don't normalize the exponent to trim zeros.
	abs := math.Abs(v)
	format := byte('f')
	if abs != 0 && (abs < 1e-6 || abs >= 1e21) {
		format = 'e'
	}
	b.buf = strconv.AppendFloat(b.buf, v, format, -1, 64)
}

// BigInt appends a decimal bigint.
func (b *Buffer) BigInt(v *big.Int) {
	b.beginValue()
	defer b.endValue()
	b.buf = v.Append(b.buf, 10)
}

// HexBigInt appends a bigint as a hex-encoded string.
// Negative values are written as "-0x...".
func (b *Buffer) HexBigInt(v *big.Int) {
	b.beginValue()
	defer b.endValue()

	// Reserve placeholder bytes for the "0x" prefix.
	b.buf = append(b.buf, '"', 0, 0)
	mark := len(b.buf) - 2
	b.buf = v.Append(b.buf, 16)
	if v.Sign() < 0 {
		copy(b.buf[mark:], "-0x")
	} else {
		b.buf[mark], b.buf[mark+1] = '0', 'x'
	}
	b.buf = append(b.buf, '"')
}

// Value appends an arbitrary value marshaled by encoding/json.
func (b *Buffer) Value(v any) error {
	// Init writer when b is fresh or was copied from another buffer.
	if b.enc == nil || b.encw.buf != b {
		b.encw = &encWriter{buf: b}
		b.enc = json.NewEncoder(b.encw)
		b.enc.SetEscapeHTML(false)
	}

	mark := len(b.buf)
	b.beginValue()
	if err := b.enc.Encode(v); err != nil {
		b.buf = b.buf[:mark]
		return err
	}
	if len(b.buf) > 0 && b.buf[len(b.buf)-1] == '\n' {
		b.buf = b.buf[:len(b.buf)-1]
	}
	b.endValue()
	return nil
}

// MustValue appends an arbitrary value marshaled by encoding/json.
// This panics if marshaling fails.
func (b *Buffer) MustValue(v any) {
	if err := b.Value(v); err != nil {
		panic(err)
	}
}

type encWriter struct {
	buf *Buffer
}

func (w *encWriter) Write(b []byte) (int, error) {
	w.buf.buf = append(w.buf.buf, b...)
	return len(b), nil
}

func (w *encWriter) WriteByte(b byte) error {
	w.buf.buf = append(w.buf.buf, b)
	return nil
}

// Array writes a JSON array. It invokes the given function to write the
// array elements.
func (b *Buffer) Array(fn func()) {
	b.beginValue()
	st := b.state
	b.state = arrayFirst
	b.buf = append(b.buf, '[')
	fn()
	b.buf = append(b.buf, ']')
	b.state = st
	b.endValue()
}

// Object writes an object. It invokes the given function to write the keys and values of
// the object.
func (b *Buffer) Object(fn func()) {
	b.beginValue()
	st := b.state
	b.state = objectKeyFirst
	b.buf = append(b.buf, '{')
	fn()
	b.buf = append(b.buf, '}')
	b.state = st
	b.endValue()
}

// Key writes an object key. This must be called in between writing object values.
func (b *Buffer) Key(s string) {
	switch b.state {
	case objectKey:
		b.buf = append(b.buf, ',')
		fallthrough
	case objectKeyFirst:
		b.buf = AppendQuotedString(b.buf, s)
		b.buf = append(b.buf, ':')
		b.state = objectValue
	default:
		panic("writing key when value expected")
	}
}

func (b *Buffer) beginValue() {
	switch b.state {
	case objectKeyFirst, objectKey:
		panic("writing value when object key expected")
	case arrayRest:
		b.buf = append(b.buf, ',')
	}
}

func (b *Buffer) endValue() {
	switch b.state {
	case objectValue:
		b.state = objectKey
	case arrayFirst:
		b.state = arrayRest
	}
}
