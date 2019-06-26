// Copyright (c) 2019 Arista Networks, Inc.
// Use of this source code is governed by the Apache License 2.0
// that can be found in the COPYING file.

package flag

import "fmt"

// StringArrayOption is a type used to provide string options via command line flags.
type StringArrayOption []string

// String is the method to format the flag's value, part of the flag.Value interface.
// The String method's output will be used in diagnostics.
func (a *StringArrayOption) String() string {
	return fmt.Sprintf("%#v", *a)
}

// Set is the method to set the flag value, part of the flag.Value interface.
// Set's argument is a string to be parsed to set the flag.
func (a *StringArrayOption) Set(value string) error {
	*a = append(*a, value)
	return nil
}
