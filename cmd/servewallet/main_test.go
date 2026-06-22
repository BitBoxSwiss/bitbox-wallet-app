// SPDX-License-Identifier: Apache-2.0

package main

import "testing"

func TestNormalizeAppleSeparator(t *testing.T) {
	for _, tc := range []struct {
		name string
		in   string
	}{
		{
			name: "double backslash lowercase",
			in:   `\\U202f`,
		},
		{
			name: "double backslash uppercase",
			in:   `\\U202F`,
		},
		{
			name: "single backslash lowercase",
			in:   `\U202f`,
		},
		{
			name: "single backslash uppercase",
			in:   `\U202F`,
		},
	} {
		t.Run(tc.name, func(t *testing.T) {
			if got := normalizeAppleSeparator(tc.in); got != "\u202f" {
				t.Fatalf("got %q, want %q", got, "\u202f")
			}
		})
	}
}
