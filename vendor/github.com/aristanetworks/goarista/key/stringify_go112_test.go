// Copyright (c) 2019 Arista Networks, Inc.
// Use of this source code is governed by the Apache License 2.0
// that can be found in the COPYING file.

// +build go1.12

// Format testing depends on map sorting during print introduced in
// go1.12.

package key

import (
	"fmt"
	"testing"
)

func TestStringifyCollection(t *testing.T) {
	for name, tcase := range map[string]struct {
		input  map[Key]interface{}
		output string
	}{
		"empty": {
			input:  map[Key]interface{}{},
			output: "map[]",
		},
		"single": {
			input: map[Key]interface{}{
				New("foobar"): uint32(42),
			},
			output: "map[foobar:42]",
		},
		"double": {
			input: map[Key]interface{}{
				New("foobar"): uint32(42),
				New("baz"):    uint32(11),
			},
			output: "map[baz:11 foobar:42]",
		},
		"map keys": {
			input: map[Key]interface{}{
				New(map[string]interface{}{"foo": uint32(1), "bar": uint32(2)}): uint32(42),
				New(map[string]interface{}{"foo": uint32(3), "bar": uint32(4)}): uint32(11),
			},
			output: "map[map[bar:2 foo:1]:42 map[bar:4 foo:3]:11]",
		},
		"string map in key map in string map in key map": {
			input: map[Key]interface{}{
				New(map[string]interface{}{"coll": map[Key]interface{}{
					New(map[string]interface{}{"one": "two"}):    uint64(22),
					New(map[string]interface{}{"three": "four"}): uint64(33),
				}}): uint32(42),
			},
			output: "map[map[coll:map[map[one:two]:22 map[three:four]:33]]:42]",
		},
		"mixed types": {
			input: map[Key]interface{}{
				New(uint32(42)):    true,
				New(float64(0.25)): 0.1,
				New(float32(0.5)):  0.2,
				New("foo"):         "bar",
				New(map[string]interface{}{"hello": "world"}): "yolo",
			},
			output: "map[0.25:0.1 0.5:0.2 42:true foo:bar map[hello:world]:yolo]",
		}} {
		t.Run(name, func(t *testing.T) {
			got := StringifyCollection(tcase.input)
			if got != tcase.output {
				t.Errorf("expected: %q\ngot: %q", tcase.output, got)
			}
		})
	}
}

func TestStringifyCollectionSameAsFmt(t *testing.T) {
	keyMap := map[Key]interface{}{
		New("bar"): uint32(2),
		New("foo"): uint32(1),
	}
	strMap := map[string]interface{}{
		"bar": uint32(2),
		"foo": uint32(1),
	}

	got := StringifyCollection(keyMap)
	exp := fmt.Sprint(strMap)

	if got != exp {
		t.Errorf("expected Fmt formatting to match StringifyCollection: exp: %s\ngot:%s", exp, got)
	}
}
