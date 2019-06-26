// Copyright (c) 2019 Arista Networks, Inc.
// Use of this source code is governed by the Apache License 2.0
// that can be found in the COPYING file.

package flag

import (
	"flag"
	"fmt"
	"os"
)

// CheckNoArgs checks if any positional arguments were provided and if so, exit with error.
func CheckNoArgs() error {
	if !flag.Parsed() {
		panic("CheckNoArgs must be called after flags have been parsed")
	}

	if flag.NArg() == 0 {
		return nil
	}
	return fmt.Errorf("%s doesn't accept positional arguments: %s", os.Args[0], flag.Arg(0))
}
