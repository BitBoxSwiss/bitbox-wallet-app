// Copyright (c) 2019 Arista Networks, Inc.
// Use of this source code is governed by the Apache License 2.0
// that can be found in the COPYING file.

package flag

import (
	"flag"
	"fmt"
	"io"
	"sort"
	"strings"
)

// FormatOptions writes a mapping of options to usage information
// that looks like standard Go help information. The header should
// end with a colon if options are provided.
func FormatOptions(w io.Writer, header string, usageMap map[string]string) {
	ops := []string{}
	for k := range usageMap {
		ops = append(ops, k)
	}
	sort.Strings(ops)
	fmt.Fprintf(w, "%v\n", header)
	for _, o := range ops {
		fmt.Fprintf(w, "  %v\n\t%v\n", o, usageMap[o])
	}
}

// AddHelp adds indented documentation to flag.Usage.
func AddHelp(seperator, help string) {
	result := []string{}
	s := strings.Split(help, "\n")
	for _, line := range s {
		result = append(result, "  "+line)
	}
	old := flag.Usage
	flag.Usage = func() {
		old()
		fmt.Println(seperator)
		fmt.Print(strings.TrimRight(strings.Join(result, "\n"), " "))
	}
}
