// SPDX-License-Identifier: Apache-2.0

package coin

import (
	"encoding/json"
	"testing"

	"github.com/BitBoxSwiss/bitbox-wallet-app/backend/accounts/errors"
	"github.com/stretchr/testify/require"
)

// JSON must distinguish keeping the entered amount, clearing an invalid one, and setting zero.
// The handler embeds this result directly, so omitting an empty string would reuse a stale amount.
func TestParsedPaymentInputJSON(t *testing.T) {
	zero := "0"
	for _, tc := range []struct {
		name  string
		input ParsedPaymentInput
		want  string
	}{
		{
			name:  "keep amount",
			input: ParsedPaymentInput{Recipient: "recipient"},
			want:  `{"recipient":"recipient"}`,
		},
		{
			name:  "clear amount",
			input: ParsedPaymentInput{Recipient: "recipient", Amount: new(string), ValidationError: errors.ErrInvalidAmount},
			want:  `{"recipient":"recipient","amount":"","validationError":"invalidAmount"}`,
		},
		{
			name:  "set zero",
			input: ParsedPaymentInput{Recipient: "recipient", Amount: &zero},
			want:  `{"recipient":"recipient","amount":"0"}`,
		},
	} {
		t.Run(tc.name, func(t *testing.T) {
			encoded, err := json.Marshal(tc.input)
			require.NoError(t, err)
			require.JSONEq(t, tc.want, string(encoded))
		})
	}
}
