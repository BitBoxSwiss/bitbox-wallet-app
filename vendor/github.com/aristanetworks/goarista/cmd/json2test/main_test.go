// Copyright (c) 2018 Arista Networks, Inc.
// Use of this source code is governed by the Apache License 2.0
// that can be found in the COPYING file.

package main

import (
	"bytes"
	"io/ioutil"
	"os"
	"testing"

	"github.com/kylelemons/godebug/diff"
)

func TestWriteTestOutput(t *testing.T) {
	for name, tc := range map[string]struct {
		verbose   bool
		inputFile string
		goldFile  string
	}{
		"quiet": {
			verbose:   false,
			inputFile: "testdata/input.txt",
			goldFile:  "testdata/gold-quiet.txt",
		},
		"verbose": {
			verbose:   true,
			inputFile: "testdata/input.txt",
			goldFile:  "testdata/gold-verbose.txt",
		},
	} {
		t.Run(name, func(t *testing.T) {
			input, err := os.Open(tc.inputFile)
			if err != nil {
				t.Fatal(err)
			}
			var out bytes.Buffer
			if err := writeTestOutput(input, &out, tc.verbose); err != errTestFailure {
				t.Error("expected test failure")
			}

			gold, err := os.Open(tc.goldFile)
			if err != nil {
				t.Fatal(err)
			}
			expected, err := ioutil.ReadAll(gold)
			if err != nil {
				t.Fatal(err)
			}

			if !bytes.Equal(out.Bytes(), expected) {
				t.Errorf("output does not match %s", tc.goldFile)
				t.Error("\n" + diff.Diff(string(expected), out.String()))
			}
		})
	}
}
