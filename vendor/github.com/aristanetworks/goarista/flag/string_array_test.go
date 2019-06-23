// Copyright (c) 2019 Arista Networks, Inc.
// Use of this source code is governed by the Apache License 2.0
// that can be found in the COPYING file.

package flag

import (
	"testing"
)

func TestStringArrayFlag(t *testing.T) {

	var excludePathPrefixes = StringArrayOption{}
	if len(excludePathPrefixes) != 0 {
		t.Fatalf("Expected length 0, saw %d", len(excludePathPrefixes))
	}

	if err := excludePathPrefixes.Set("arg1"); err != nil {
		t.Fatal(err)
	}
	if len(excludePathPrefixes) != 1 {
		t.Fatalf("Expected length 1, saw %d", len(excludePathPrefixes))
	}
}
