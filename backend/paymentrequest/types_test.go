// SPDX-License-Identifier: Apache-2.0

package paymentrequest

import (
	"encoding/json"
	"math/big"
	"testing"

	"github.com/stretchr/testify/require"
)

func TestSlip24OutLargeAmountJSONRoundTrip(t *testing.T) {
	var output Slip24Out
	require.NoError(t, json.Unmarshal(
		[]byte(`{"amount":55000000000000000000,"address":"0x1234"}`),
		&output,
	))
	require.Equal(t, "55000000000000000000", output.Amount)

	encoded, err := json.Marshal(output)
	require.NoError(t, err)
	require.JSONEq(t, `{"amount":"55000000000000000000","address":"0x1234"}`, string(encoded))

	var decoded Slip24Out
	require.NoError(t, json.Unmarshal(encoded, &decoded))
	require.Equal(t, output, decoded)
}

func TestSlip24OutRejectsInvalidAmounts(t *testing.T) {
	for _, testCase := range []struct {
		amount string
		error  string
	}{
		{amount: "null", error: `invalid payment request output amount "null"`},
		{amount: `""`, error: `invalid payment request output amount ""`},
		{amount: `"-1"`, error: `invalid payment request output amount "-1"`},
		{amount: "1.5", error: `invalid payment request output amount "1.5"`},
		{amount: "1e18", error: `invalid payment request output amount "1e18"`},
	} {
		t.Run(testCase.amount, func(t *testing.T) {
			var output Slip24Out
			err := json.Unmarshal([]byte(`{"amount":`+testCase.amount+`,"address":"0x1234"}`), &output)
			require.EqualError(t, err, testCase.error)
		})
	}
}

func TestSlip24ToRequestPreservesLargeAmount(t *testing.T) {
	slip24 := &Slip24{
		Outputs: []Slip24Out{{
			Amount:  "55000000000000000000",
			Address: "0x1234",
		}},
	}

	request, err := slip24.ToRequest()
	require.NoError(t, err)
	expected, ok := new(big.Int).SetString("55000000000000000000", 10)
	require.True(t, ok)
	require.Equal(t, expected, request.TotalAmount)
}
