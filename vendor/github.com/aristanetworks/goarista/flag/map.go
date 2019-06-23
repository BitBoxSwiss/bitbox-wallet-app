// Copyright (c) 2019 Arista Networks, Inc.
// Use of this source code is governed by the Apache License 2.0
// that can be found in the COPYING file.

package flag

import (
	"fmt"
	"strings"
)

// Map is a type used to provide mapped options via command line flags.
// It implements the flag.Value interface.
// If a flag is passed without a value, for example: `-option somebool` it will still be
// initialized, so you can use `_, ok := option["somebool"]` to check if it exists.
type Map map[string]string

// String is the method to format the flag's value, part of the flag.Value interface.
// The String method's output is used in diagnostics.
func (o Map) String() string {
	return fmt.Sprintf("%#v", o)
}

// Set is the method to set the flag value, part of the flag.Value interface.
// Set's argument is a string to be parsed to set the flag.
// It still initializes flags that don't explicitly set a string
func (o Map) Set(value string) error {
	var k, v string
	idx := strings.Index(value, "=")
	if idx == -1 {
		k = value
	} else {
		k = value[:idx]
		v = value[idx+1:]
	}
	if _, exists := o[k]; exists {
		return fmt.Errorf("%v is a duplicate option", k)
	}

	o[k] = v
	return nil
}

// Type returns the golang type string. This method is required by pflag library.
func (o Map) Type() string {
	return "Map"
}

// Clone returns a copy of flag options
func (o Map) Clone() Map {
	options := make(Map, len(o))
	for k, v := range o {
		options[k] = v
	}
	return options
}
