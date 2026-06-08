// SPDX-License-Identifier: Apache-2.0

package util

import (
	"testing"

	coinpkg "github.com/BitBoxSwiss/bitbox-wallet-app/backend/coins/coin"
)

func TestFormatAddress(t *testing.T) {
	tests := []struct {
		name string
		code coinpkg.Code
		in   string
		want string
	}{
		{name: "empty", code: coinpkg.CodeBTC, in: "", want: ""},
		{name: "short", code: coinpkg.CodeBTC, in: "abc", want: "abc"},
		{name: "exact group", code: coinpkg.CodeBTC, in: "abcd", want: "abcd"},
		{name: "one extra char", code: coinpkg.CodeBTC, in: "abcde", want: "abcd e"},
		{name: "multiple groups", code: coinpkg.CodeBTC, in: "abcdefghijkl", want: "abcd efgh ijkl"},
		{
			name: "eth lower prefix",
			code: coinpkg.CodeETH,
			in:   "0x773A77b9D32589be03f9132AF759e294f7851be9",
			want: "0x 773A 77b9 D325 89be 03f9 132A F759 e294 f785 1be9",
		},
		{
			name: "eth upper prefix",
			code: coinpkg.CodeSEPETH,
			in:   "0X773A77b9D32589be03f9132AF759e294f7851be9",
			want: "0X 773A 77b9 D325 89be 03f9 132A F759 e294 f785 1be9",
		},
		{
			name: "erc20 uses eth formatting",
			code: "eth-erc20-usdt",
			in:   "0x773A77b9D32589be03f9132AF759e294f7851be9",
			want: "0x 773A 77b9 D325 89be 03f9 132A F759 e294 f785 1be9",
		},
	}

	for _, test := range tests {
		t.Run(test.name, func(t *testing.T) {
			if got := FormatAddress(test.code, test.in); got != test.want {
				t.Fatalf("FormatAddress(%q, %q) = %q, want %q", test.code, test.in, got, test.want)
			}
		})
	}
}
