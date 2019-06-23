// Copyright (c) 2018 Arista Networks, Inc.
// Use of this source code is governed by the Apache License 2.0
// that can be found in the COPYING file.

package key

import (
	"fmt"
	"strings"
)

// Path represents a path decomposed into elements where each
// element is a Key. A Path can be interpreted as either
// absolute or relative depending on how it is used.
type Path []Key

// String returns the Path as an absolute path string.
func (p Path) String() string {
	if len(p) == 0 {
		return "/"
	}
	var b strings.Builder
	for _, element := range p {
		b.WriteByte('/')
		// Use StringifyInterface instead of element.String() because
		// that will escape any invalid UTF-8.
		s, err := StringifyInterface(element.Key())
		if err != nil {
			panic(fmt.Errorf("unable to stringify %#v: %s", element, err))
		}
		b.WriteString(s)
	}
	return b.String()
}

// MarshalJSON marshals a Path to JSON.
func (p Path) MarshalJSON() ([]byte, error) {
	return []byte(fmt.Sprintf(`{"_path":%q}`, p)), nil
}

// Equal returns whether a Path is equal to @other.
func (p Path) Equal(other interface{}) bool {
	o, ok := other.(Path)
	return ok && pathEqual(p, o)
}

func pathEqual(a, b Path) bool {
	if len(a) != len(b) {
		return false
	}
	for i := range a {
		if !a[i].Equal(b[i]) {
			return false
		}
	}
	return true
}
