// SPDX-License-Identifier: Apache-2.0

package paymentrequest

import (
	"encoding/base64"
	"encoding/json"
	"testing"

	"github.com/stretchr/testify/require"
)

// SwapKit's refund object and numeric output amount decode without local derivation metadata.
func TestSwapKitRefundPayload(t *testing.T) {
	const payload = `{
  "recipientName": "SWAPKIT (NEAR)",
  "nonce": null, "coinType": 0,
  "memos": [
    {"type": "coinPurchase", "coinPurchase": {"coinType": 60, "amount": "0.035285128918156535 ETH", "address": "0x171A32C3Dcbc92fD74026cBA6e3f9cB2c2bb938e"}},
    {"type": "refund", "refund": {"address": "bc1qq6hag67dl53wl99vzg42z8eyzfz2xlkvxechjp"}}
  ],
  "outputs": [{"amount": 100000, "address": "bc1qaz6lphpyysqhpwl42nezgt3qyk42d9lc9tdrpw"}],
  "signature": "9xBtaGu5Pdq/sNfh+ws1p9At9At91BqBSvVfoEbWhsVvdsMNLjalJLwg65ksHg4yrnR9RKh4qK5NLFIQ2+w/3A=="
}`
	var decoded Slip24
	require.NoError(t, json.Unmarshal([]byte(payload), &decoded))
	require.Equal(t, []Slip24Out{{Amount: "100000", Address: "bc1qaz6lphpyysqhpwl42nezgt3qyk42d9lc9tdrpw"}}, decoded.Outputs)
	require.Len(t, decoded.Memos, 2)
	require.NotNil(t, decoded.Memos[1].Refund)
	require.Nil(t, decoded.Memos[1].Refund.AddressDerivation)
	encodedRefund, err := json.Marshal(decoded.Memos[1])
	require.NoError(t, err)
	require.JSONEq(t, `{"type":"refund","refund":{"address":"bc1qq6hag67dl53wl99vzg42z8eyzfz2xlkvxechjp"}}`, string(encodedRefund))

	request, err := decoded.ToRequest()
	require.NoError(t, err)
	require.Equal(t, "SWAPKIT (NEAR)", request.RecipientName)
	require.Nil(t, request.Nonce)
	require.Equal(t, "100000", request.TotalAmount.String())
	require.Len(t, request.Signature, 64)
	require.Equal(t, decoded.Signature, base64.StdEncoding.EncodeToString(request.Signature))
	require.Equal(t, []Memo{
		{CoinPurchase: &CoinPurchaseMemo{
			CoinType: 60,
			Amount:   "0.035285128918156535 ETH",
			Address:  "0x171A32C3Dcbc92fD74026cBA6e3f9cB2c2bb938e",
		}},
		{Refund: &RefundMemo{Address: "bc1qq6hag67dl53wl99vzg42z8eyzfz2xlkvxechjp"}},
	}, request.Memos)
}

// Refund addresses and local derivation metadata survive the frontend JSON round trip unchanged.
func TestRefundMemoRoundTrip(t *testing.T) {
	for _, derivation := range []*Slip24AddressDerivation{
		{Eth: &Slip24EthAddressDerivation{Keypath: []uint32{44, 60, 0, 0, 0}}},
		{Btc: &Slip24BtcAddressDerivation{Keypath: []uint32{84, 0, 0, 0, 3}, ScriptType: "p2wpkh"}},
	} {
		payload := &Slip24{
			RecipientName: "SWAPKIT (NEAR)",
			Memos: []Slip24Memo{
				{Type: "text", Text: "swap"},
				{Type: "refund", Refund: &Slip24Refund{Address: "signed-address", AddressDerivation: derivation}},
			},
			Outputs:   []Slip24Out{{Amount: "55000000000000000000", Address: "deposit"}},
			Signature: "c2ln",
		}
		encoded, err := json.Marshal(payload)
		require.NoError(t, err)
		var decoded Slip24
		require.NoError(t, json.Unmarshal(encoded, &decoded))
		require.Equal(t, payload, &decoded)
		request, err := decoded.ToRequest()
		require.NoError(t, err)
		require.Equal(t, "signed-address", request.Memos[1].Refund.Address)
		require.Equal(t, []byte("sig"), request.Signature)
		if derivation.Eth != nil {
			require.Equal(t, derivation.Eth.Keypath, request.Memos[1].Refund.EthAddressDerivation.Keypath)
			require.Nil(t, request.Memos[1].Refund.BtcAddressDerivation)
		} else {
			require.Equal(t, derivation.Btc.Keypath, request.Memos[1].Refund.BtcAddressDerivation.Keypath)
			require.Equal(t, derivation.Btc.ScriptType, string(request.Memos[1].Refund.BtcAddressDerivation.ScriptType))
			require.Nil(t, request.Memos[1].Refund.EthAddressDerivation)
		}
	}
}

// Reject malformed refund payloads without making refunds mandatory for ordinary payments.
func TestRefundMemoConversionValidation(t *testing.T) {
	for _, test := range []struct {
		name      string
		memo      Slip24Memo
		wantError string
	}{
		{"missing payload", Slip24Memo{Type: "refund"}, "Payment request refund memo missing payload"},
		{"missing address", Slip24Memo{Type: "refund", Refund: &Slip24Refund{}}, "Payment request refund memo missing address"},
		{"blank address", Slip24Memo{Type: "refund", Refund: &Slip24Refund{Address: "  "}}, "Payment request refund memo missing address"},
		{"ambiguous derivation", Slip24Memo{Type: "refund", Refund: &Slip24Refund{Address: "address", AddressDerivation: &Slip24AddressDerivation{Eth: &Slip24EthAddressDerivation{}, Btc: &Slip24BtcAddressDerivation{}}}}, "Payment request refund derivation is ambiguous"},
		{"provider payload without local metadata", Slip24Memo{Type: "refund", Refund: &Slip24Refund{Address: "address"}}, ""},
		{"ordinary payment", Slip24Memo{Type: "text", Text: "payment"}, ""},
	} {
		t.Run(test.name, func(t *testing.T) {
			payload := &Slip24{Outputs: []Slip24Out{{Amount: "1", Address: "deposit"}}, Memos: []Slip24Memo{test.memo}}
			_, err := payload.ToRequest()
			if test.wantError != "" {
				require.EqualError(t, err, test.wantError)
			} else {
				require.NoError(t, err)
			}
		})
	}
}

// Coin purchases may omit a refund; duplicate purchase/refund memos are rejected and signed order is preserved.
func TestCoinPurchasePaymentRequestMemos(t *testing.T) {
	purchase := Slip24Memo{Type: "coinPurchase", CoinPurchase: &Slip24CoinPurchase{CoinType: 60, Amount: "1 ETH", Address: "destination"}}
	refund := Slip24Memo{Type: "refund", Refund: &Slip24Refund{Address: "refund-address"}}
	for _, test := range []struct {
		name  string
		memos []Slip24Memo
		valid bool
	}{
		{"without refund", []Slip24Memo{purchase}, true},
		{"without refund with text", []Slip24Memo{{Type: "text", Text: "payment"}, purchase}, true},
		{"duplicate refund", []Slip24Memo{purchase, refund, refund}, false},
		{"duplicate purchase", []Slip24Memo{purchase, purchase, refund}, false},
		{"refund first", []Slip24Memo{refund, purchase}, true},
		{"purchase first", []Slip24Memo{purchase, refund}, true},
	} {
		t.Run(test.name, func(t *testing.T) {
			request, err := (&Slip24{Memos: test.memos, Outputs: []Slip24Out{{Amount: "1", Address: "deposit"}}}).ToRequest()
			if test.valid {
				require.NoError(t, err)
				require.Len(t, request.Memos, len(test.memos))
				for i, memo := range test.memos {
					switch memo.Type {
					case "refund":
						require.Equal(t, &RefundMemo{Address: memo.Refund.Address}, request.Memos[i].Refund)
					case "coinPurchase":
						require.Equal(t, &CoinPurchaseMemo{
							CoinType: memo.CoinPurchase.CoinType,
							Amount:   memo.CoinPurchase.Amount,
							Address:  memo.CoinPurchase.Address,
						}, request.Memos[i].CoinPurchase)
						require.Nil(t, request.Memos[i].Refund)
					case "text":
						require.Equal(t, &TextMemo{Note: memo.Text}, request.Memos[i].Text)
					}
				}
			} else {
				require.EqualError(t, err, "Payment request contains duplicate coinPurchase or refund memos")
				require.Nil(t, request)
			}
		})
	}
}
