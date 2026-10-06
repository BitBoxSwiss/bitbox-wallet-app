// SPDX-License-Identifier: Apache-2.0

package backend

import (
	"testing"

	"github.com/BitBoxSwiss/bitbox-wallet-app/backend/lightning"
	"github.com/BitBoxSwiss/bitbox-wallet-app/util/logging"
	"github.com/stretchr/testify/require"
)

func TestHandleLightningURI(t *testing.T) {
	for _, test := range []struct{ uri, input string }{
		{"lightning:lnbc1invoice", "lnbc1invoice"},
		{"lightning://lnbc1invoice", "lnbc1invoice"},
		{"LIGHTNING://LNBC1INVOICE", "LNBC1INVOICE"},
		{"LiGhTnInG:lnurl1request", "lnurl1request"},
		{"lightning:donate@bitcoin.org.hk", "donate@bitcoin.org.hk"},
		{"lightning://Alice+tips@Example.com", "Alice+tips@Example.com"},
		{"lightning:invalid", "invalid"},
		{"lightning:", ""},
	} {
		t.Run(test.uri, func(t *testing.T) {
			b := &Backend{lightning: &lightning.Lightning{}, log: logging.Get().WithGroup("test")}
			b.HandleURI(test.uri)
			require.NotNil(t, b.Lightning().URI().Input)
			require.Equal(t, test.input, *b.Lightning().URI().Input)
		})
	}
	for _, uri := range []string{"https://example.com", ":invalid"} {
		t.Run(uri, func(t *testing.T) {
			b := &Backend{lightning: &lightning.Lightning{}, log: logging.Get().WithGroup("test")}
			b.HandleURI(uri)
			require.Nil(t, b.Lightning().URI().Input)
		})
	}
}
