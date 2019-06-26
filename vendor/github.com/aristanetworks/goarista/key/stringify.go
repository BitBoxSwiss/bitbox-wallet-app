// Copyright (c) 2015 Arista Networks, Inc.
// Use of this source code is governed by the Apache License 2.0
// that can be found in the COPYING file.

package key

import (
	"encoding/base64"
	"fmt"
	"math"
	"sort"
	"strconv"
	"strings"
	"unicode/utf8"

	"github.com/aristanetworks/goarista/value"
)

// StringifyInterface transforms an arbitrary interface into its string
// representation.  We need to do this because some entities use the string
// representation of their keys as their names.
// Note: this API is deprecated and will be removed.
func StringifyInterface(key interface{}) (string, error) {
	var str string
	switch key := key.(type) {
	case nil:
		return "<nil>", nil
	case bool:
		str = strconv.FormatBool(key)
	case uint8:
		str = strconv.FormatUint(uint64(key), 10)
	case uint16:
		str = strconv.FormatUint(uint64(key), 10)
	case uint32:
		str = strconv.FormatUint(uint64(key), 10)
	case uint64:
		str = strconv.FormatUint(key, 10)
	case int8:
		str = strconv.FormatInt(int64(key), 10)
	case int16:
		str = strconv.FormatInt(int64(key), 10)
	case int32:
		str = strconv.FormatInt(int64(key), 10)
	case int64:
		str = strconv.FormatInt(key, 10)
	case float32:
		str = "f" + strconv.FormatInt(int64(math.Float32bits(key)), 10)
	case float64:
		str = "f" + strconv.FormatInt(int64(math.Float64bits(key)), 10)
	case string:
		str = escape(key)
	case map[string]interface{}:
		keys := SortedKeys(key)
		for i, k := range keys {
			v := key[k]
			keys[i] = stringify(v)
		}
		str = strings.Join(keys, "_")
	case *map[string]interface{}:
		return StringifyInterface(*key)
	case map[Key]interface{}:
		m := make(map[string]interface{}, len(key))
		for k, v := range key {
			m[k.String()] = v
		}
		keys := SortedKeys(m)
		for i, k := range keys {
			keys[i] = stringify(k) + "=" + stringify(m[k])
		}
		str = strings.Join(keys, "_")
	case []interface{}:
		elements := make([]string, len(key))
		for i, element := range key {
			elements[i] = stringify(element)
		}
		str = strings.Join(elements, ",")
	case Pointer:
		return "{" + key.Pointer().String() + "}", nil
	case Path:
		return "[" + key.String() + "]", nil
	case value.Value:
		return key.String(), nil

	default:
		panic(fmt.Errorf("Unable to stringify type %T: %#v", key, key))
	}

	return str, nil
}

// escape checks if the string is a valid utf-8 string.
// If it is, it will return the string as is.
// If it is not, it will return the base64 representation of the byte array string
func escape(str string) string {
	if utf8.ValidString(str) {
		return str
	}
	return base64.StdEncoding.EncodeToString([]byte(str))
}

func stringify(key interface{}) string {
	s, err := StringifyInterface(key)
	if err != nil {
		panic(err)
	}
	return s
}

// StringifyCollection safely returns a string representation of a
// map[Key]interface{} that is similar in form to the standard
// stringification of a map, "map[k1:v1, k2:v2]". This differs from
// StringifyInterface's handling of a map which emits a string to be
// used as key in contexts such as JSON objects.
func StringifyCollection(m map[Key]interface{}) string {
	type kv struct {
		key string
		val string
	}
	var length int
	kvs := make([]kv, 0, len(m))
	for k, v := range m {
		element := kv{
			key: stringifyCollectionHelper(k.Key()),
			val: stringifyCollectionHelper(v),
		}
		kvs = append(kvs, element)
		length += len(element.key) + len(element.val)
	}
	sort.Slice(kvs, func(i, j int) bool {
		return kvs[i].key < kvs[j].key
	})
	var buf strings.Builder
	buf.Grow(length + len("map[]") + 2*len(kvs) /* room for seperators: ", :" */)
	buf.WriteString("map[")
	for i, kv := range kvs {
		if i > 0 {
			buf.WriteString(" ")
		}
		buf.WriteString(kv.key)
		buf.WriteByte(':')
		buf.WriteString(kv.val)
	}
	buf.WriteByte(']')
	return buf.String()
}

// stringifyCollectionHelper is similar to StringifyInterface, but
// optimizes for human readability instead of making a unique string
// key suitable for JSON.
func stringifyCollectionHelper(val interface{}) string {
	switch val := val.(type) {
	case string:
		return escape(val)
	case map[string]interface{}:
		keys := SortedKeys(val)
		for i, k := range keys {
			v := val[k]
			s := stringifyCollectionHelper(v)
			keys[i] = k + ":" + s
		}
		return "map[" + strings.Join(keys, " ") + "]"
	case map[Key]interface{}:
		return StringifyCollection(val)
	case []interface{}:
		elements := make([]string, len(val))
		for i, element := range val {
			elements[i] = stringifyCollectionHelper(element)
		}
		return strings.Join(elements, ",")
	case Pointer:
		return "{" + val.Pointer().String() + "}"
	case Path:
		return "[" + val.String() + "]"
	}

	return fmt.Sprint(val)
}
