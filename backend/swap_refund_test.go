// SPDX-License-Identifier: Apache-2.0

package backend

import (
	"encoding/json"
	"io"
	"net/http"
	"strings"
	"testing"

	"github.com/BitBoxSwiss/bitbox-wallet-app/backend/accounts"
	accountsMocks "github.com/BitBoxSwiss/bitbox-wallet-app/backend/accounts/mocks"
	accountsTypes "github.com/BitBoxSwiss/bitbox-wallet-app/backend/accounts/types"
	"github.com/BitBoxSwiss/bitbox-wallet-app/backend/market/swapkit"
	"github.com/BitBoxSwiss/bitbox-wallet-app/backend/paymentrequest"
	"github.com/stretchr/testify/require"
)

// Preparation selects the refund address once and uses local ownership metadata for each sell chain.
func TestPrepareSwapRefundRoundTrip(t *testing.T) {
	b := newBackend(t, testnetDisabled, regtestDisabled)
	defer b.Close()
	b.registerKeystore(makeBitBox02Multi())
	require.NoError(t, b.SetTokenActive("v0-55555555-eth-0", "eth-erc20-bat", true))
	for _, sellCode := range []accountsTypes.Code{
		"v0-55555555-btc-0", "v0-55555555-ltc-0", "v0-55555555-eth-0", "v0-55555555-eth-0-eth-erc20-bat",
	} {
		t.Run(string(sellCode), func(t *testing.T) {
			buyCode := accountsTypes.Code("v0-55555555-btc-0")
			purchaseAmount, purchaseCoinType := "1 BTC", uint32(0)
			if sellCode == buyCode {
				buyCode = "v0-55555555-eth-0"
				purchaseAmount, purchaseCoinType = "1 ETH", 60
			}
			sellAccount, err := b.GetAccountFromCode(sellCode)
			require.NoError(t, err)
			expectedAddress, expectedDerivation, err := swapReceiveAddress(sellAccount)
			require.NoError(t, err)
			mock := sellAccount.(*accountsMocks.InterfaceMock)
			original := mock.GetUnusedReceiveAddressesFunc
			defer func() { mock.GetUnusedReceiveAddressesFunc = original }()
			calls := 0
			mock.GetUnusedReceiveAddressesFunc = func() ([]accounts.AddressList, error) {
				calls++
				require.Equal(t, 1, calls, "refund address must not be selected again after requesting the swap")
				return original()
			}
			var signedRequest paymentrequest.Slip24
			b.httpClient = &http.Client{Transport: swapQuoteTransport(func(request *http.Request) (*http.Response, error) {
				var body swapkit.SwapRequest
				require.NoError(t, json.NewDecoder(request.Body).Decode(&body))
				require.Equal(t, expectedAddress, body.SourceAddress)
				// A provider's derivation metadata is untrusted and must be replaced locally.
				signedRequest = paymentrequest.Slip24{
					RecipientName: "SWAPKIT (NEAR)", Signature: "c2ln",
					Outputs: []paymentrequest.Slip24Out{{Amount: "100000", Address: body.SourceAddress}},
					Memos: []paymentrequest.Slip24Memo{
						{Type: "refund", Refund: &paymentrequest.Slip24Refund{
							Address:           body.SourceAddress,
							AddressDerivation: &paymentrequest.Slip24AddressDerivation{Eth: &paymentrequest.Slip24EthAddressDerivation{Keypath: []uint32{123}}},
						}},
						{Type: "coinPurchase", CoinPurchase: &paymentrequest.Slip24CoinPurchase{CoinType: purchaseCoinType, Amount: purchaseAmount, Address: body.DestinationAddress}},
					},
				}
				response, err := json.Marshal(swapkit.SwapResponse{Meta: swapkit.SwapMeta{Slip24: &signedRequest}})
				require.NoError(t, err)
				return &http.Response{StatusCode: http.StatusOK, Body: io.NopCloser(strings.NewReader(string(response)))}, nil
			})}
			result, err := b.PrepareSwap(buyCode, sellCode, "route", "1")
			require.NoError(t, err)
			require.Equal(t, 1, calls)
			prepared := result.TxInput.PaymentRequest
			require.Equal(t, signedRequest.Signature, prepared.Signature)
			require.Equal(t, signedRequest.Outputs, prepared.Outputs)
			require.Equal(t, signedRequest.Memos[0].Refund.Address, prepared.Memos[0].Refund.Address)
			require.Equal(t, expectedDerivation, prepared.Memos[0].Refund.AddressDerivation)
			require.Equal(t, signedRequest.Memos[1].CoinPurchase.Address, prepared.Memos[1].CoinPurchase.Address)
			encoded, err := json.Marshal(result.TxInput)
			require.NoError(t, err)
			var returned SwapSignTxInput
			require.NoError(t, json.Unmarshal(encoded, &returned))
			converted, err := returned.PaymentRequest.ToRequest()
			require.NoError(t, err)
			require.Equal(t, expectedAddress, converted.Memos[0].Refund.Address)
			if expectedDerivation.Btc != nil {
				require.Equal(t, expectedDerivation.Btc.Keypath, converted.Memos[0].Refund.BtcAddressDerivation.Keypath)
			} else {
				require.Equal(t, expectedDerivation.Eth.Keypath, converted.Memos[0].Refund.EthAddressDerivation.Keypath)
			}
		})
	}
}

// Missing, invalid or unsupported swap memos must fail preparation instead of being dropped or rewritten.
func TestSwapRejectsInvalidRefundMemos(t *testing.T) {
	b := newBackend(t, testnetDisabled, regtestDisabled)
	defer b.Close()
	b.registerKeystore(makeBitBox02Multi())
	account, err := b.GetAccountFromCode("v0-55555555-btc-0")
	require.NoError(t, err)
	address, derivation, err := swapReceiveAddress(account)
	require.NoError(t, err)
	refund := paymentrequest.Slip24Memo{Type: "refund", Refund: &paymentrequest.Slip24Refund{Address: address}}
	purchase := paymentrequest.Slip24Memo{Type: "coinPurchase", CoinPurchase: &paymentrequest.Slip24CoinPurchase{CoinType: 60, Amount: "1 ETH", Address: "destination"}}
	for _, test := range []struct {
		name  string
		memos []paymentrequest.Slip24Memo
	}{
		{"missing refund", []paymentrequest.Slip24Memo{purchase}},
		{"missing purchase", []paymentrequest.Slip24Memo{refund}},
		{"duplicate refund", []paymentrequest.Slip24Memo{purchase, refund, refund}},
		{"duplicate purchase", []paymentrequest.Slip24Memo{purchase, purchase, refund}},
		{"missing refund payload", []paymentrequest.Slip24Memo{purchase, {Type: "refund"}}},
		{"empty refund", []paymentrequest.Slip24Memo{purchase, {Type: "refund", Refund: &paymentrequest.Slip24Refund{}}}},
		{"different refund", []paymentrequest.Slip24Memo{purchase, {Type: "refund", Refund: &paymentrequest.Slip24Refund{Address: "1GqULdYGDRfF3w85yGmEq8LTWecpKn8JMJ"}}}},
		{"wrong chain", []paymentrequest.Slip24Memo{purchase, {Type: "refund", Refund: &paymentrequest.Slip24Refund{Address: "0x986f66F28C6a2BBE939dF3161D1D2b238933895c"}}}},
		{"unknown memo", []paymentrequest.Slip24Memo{purchase, refund, {Type: "unknown"}}},
		{"missing purchase payload", []paymentrequest.Slip24Memo{{Type: "coinPurchase"}, refund}},
	} {
		t.Run(test.name, func(t *testing.T) {
			request := &paymentrequest.Slip24{Memos: test.memos, Outputs: []paymentrequest.Slip24Out{{Amount: "1", Address: "deposit"}}}
			_, err := swapSignTxInput(request, account.Coin(), nil, address, derivation)
			require.Error(t, err)
		})
	}
}

// Case-equivalent ETH addresses compare equal while signed bytes and BTC network boundaries remain intact.
func TestSwapRefundAddressComparison(t *testing.T) {
	b := newBackend(t, testnetDisabled, regtestDisabled)
	defer b.Close()
	b.registerKeystore(makeBitBox02Multi())
	for _, code := range []accountsTypes.Code{"v0-55555555-btc-0", "v0-55555555-ltc-0", "v0-55555555-eth-0"} {
		account, err := b.GetAccountFromCode(code)
		require.NoError(t, err)
		address, derivation, err := swapReceiveAddress(account)
		require.NoError(t, err)
		actual := strings.ToUpper(address)
		if derivation.Eth != nil {
			actual = strings.ToLower(address)
		}
		request := &paymentrequest.Slip24{
			Signature: "c2ln",
			Memos: []paymentrequest.Slip24Memo{
				{Type: "refund", Refund: &paymentrequest.Slip24Refund{Address: actual}},
				{Type: "coinPurchase", CoinPurchase: &paymentrequest.Slip24CoinPurchase{}},
			},
			Outputs: []paymentrequest.Slip24Out{{Amount: "1", Address: "deposit"}},
		}
		result, err := swapSignTxInput(request, account.Coin(), nil, address, derivation)
		require.NoError(t, err)
		require.Equal(t, actual, result.PaymentRequest.Memos[0].Refund.Address)
		require.False(t, swapRefundAddressMatches(account.Coin(), address, "not-an-address"))
	}
}

// A provider response without a signed refund memo must not produce a sendable swap transaction.
func TestPrepareSwapRejectsMissingRefund(t *testing.T) {
	b := newBackend(t, testnetDisabled, regtestDisabled)
	defer b.Close()
	b.registerKeystore(makeBitBox02Multi())
	b.httpClient = &http.Client{Transport: swapQuoteTransport(func(request *http.Request) (*http.Response, error) {
		var body swapkit.SwapRequest
		require.NoError(t, json.NewDecoder(request.Body).Decode(&body))
		paymentRequest := &paymentrequest.Slip24{
			RecipientName: "SWAPKIT (NEAR)", Signature: "c2ln",
			Memos: []paymentrequest.Slip24Memo{{Type: "coinPurchase", CoinPurchase: &paymentrequest.Slip24CoinPurchase{
				CoinType: 60, Amount: "1 ETH", Address: body.DestinationAddress,
			}}},
			Outputs: []paymentrequest.Slip24Out{{Amount: "100000", Address: body.SourceAddress}},
		}
		response, err := json.Marshal(swapkit.SwapResponse{Meta: swapkit.SwapMeta{Slip24: paymentRequest}})
		require.NoError(t, err)
		return &http.Response{StatusCode: http.StatusOK, Body: io.NopCloser(strings.NewReader(string(response)))}, nil
	})}
	result, err := b.PrepareSwap("v0-55555555-eth-0", "v0-55555555-btc-0", "route", "1")
	require.EqualError(t, err, "Swap requires exactly one coinPurchase and one refund memo")
	require.Nil(t, result)
}
