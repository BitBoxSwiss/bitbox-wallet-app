// SPDX-License-Identifier: Apache-2.0

package swapkit

import (
	"context"
	"encoding/binary"
	"encoding/hex"
	"encoding/json"
	"net/http"
	"os"
	"strings"
	"testing"

	coinpkg "github.com/BitBoxSwiss/bitbox-wallet-app/backend/coins/coin"
	"github.com/BitBoxSwiss/bitbox-wallet-app/backend/paymentrequest"
	"github.com/BitBoxSwiss/bitbox-wallet-app/backend/util"
	"github.com/BitBoxSwiss/bitbox02-api-go/api/firmware"
	"github.com/BitBoxSwiss/bitbox02-api-go/api/firmware/messages"
	"github.com/btcsuite/btcd/btcec/v2"
	"github.com/btcsuite/btcd/btcec/v2/ecdsa"
	"github.com/stretchr/testify/require"
)

const (
	swapKitPaymentRequestPubKeyHex = "02bf5740a2b794b33d73358d7313e9cb260058f3ac6c886fcc388d9f3f0b48a90d"
	swapKitProvidersURL            = "https://swapkit.shiftcrypto.io/providers"
)

var swapKitLiveTestChainIDs = map[coinpkg.Code]string{
	coinpkg.CodeBTC: "bitcoin",
	coinpkg.CodeETH: "1",
	coinpkg.CodeLTC: "bitcoin",
}

type swapKitLiveTestCase struct {
	name               string
	sellCoin           coinpkg.Coin
	buyCoin            coinpkg.Coin
	sellAmount         string
	sourceAddress      string
	destinationAddress string
	slip44             uint32
}

type swapKitProvider struct {
	Provider        string   `json:"provider"`
	EnabledChainIDs []string `json:"enabledChainIds"`
}

type swapKitNextActionPayload struct {
	RouteID string `json:"routeId"`
}

func TestSwapKitLiveSlip24(t *testing.T) {
	if os.Getenv("SWAPKIT_LIVE_TEST") != "1" {
		t.Skip("set SWAPKIT_LIVE_TEST=1 to run the live SwapKit smoke test")
	}

	trustedPubKey := trustedSwapKitPaymentRequestPubKey(t)
	nearEnabledChainIDs := nearProviderEnabledChainIDs(t, http.DefaultClient)
	for _, testCase := range []swapKitLiveTestCase{
		{
			name:               "btc-to-eth",
			sellCoin:           newQuoteCoin(coinpkg.CodeBTC, "BTC"),
			buyCoin:            newQuoteCoin(coinpkg.CodeETH, "ETH"),
			sellAmount:         "1",
			sourceAddress:      "1PuJjnF476W3zXfVYmJfGnouzFDAXakkL4",
			destinationAddress: "0x171A32C3Dcbc92fD74026cBA6e3f9cB2c2bb938e",
			slip44:             0,
		},
		{
			name:               "eth-to-btc",
			sellCoin:           newQuoteCoin(coinpkg.CodeETH, "ETH"),
			buyCoin:            newQuoteCoin(coinpkg.CodeBTC, "BTC"),
			sellAmount:         "1",
			sourceAddress:      "0x171A32C3Dcbc92fD74026cBA6e3f9cB2c2bb938e",
			destinationAddress: "1PuJjnF476W3zXfVYmJfGnouzFDAXakkL4",
			slip44:             60,
		},
		{
			name:               "ltc-to-eth",
			sellCoin:           newQuoteCoin(coinpkg.CodeLTC, "LTC"),
			buyCoin:            newQuoteCoin(coinpkg.CodeETH, "ETH"),
			sellAmount:         "100",
			sourceAddress:      "ltc1qzudr9s7uhjf06aqzdjaxu0uuktpthyuwy0vkyr",
			destinationAddress: "0x171A32C3Dcbc92fD74026cBA6e3f9cB2c2bb938e",
			slip44:             2,
		},
		{
			name:               "usdc-to-eth",
			sellCoin:           newQuoteCoin(coinpkg.Code("eth-erc20-usdc"), "USDC"),
			buyCoin:            newQuoteCoin(coinpkg.CodeETH, "ETH"),
			sellAmount:         "1000",
			sourceAddress:      "0x171A32C3Dcbc92fD74026cBA6e3f9cB2c2bb938e",
			destinationAddress: "0x171A32C3Dcbc92fD74026cBA6e3f9cB2c2bb938e",
			slip44:             60,
		},
	} {
		t.Run(testCase.name, func(t *testing.T) {
			sellChainID := swapKitSellCoinChainID(t, testCase.sellCoin)
			if _, ok := nearEnabledChainIDs[sellChainID]; !ok {
				t.Skipf("NEAR provider does not currently enable sell chain %q for sell coin %q", sellChainID, testCase.sellCoin.Code())
			}
			runSwapKitLiveTestCase(t, context.Background(), http.DefaultClient, trustedPubKey, testCase)
		})
	}
}

func nearProviderEnabledChainIDs(t *testing.T, httpClient *http.Client) map[string]struct{} {
	t.Helper()

	var providers []swapKitProvider
	_, err := util.APIGet(httpClient, swapKitProvidersURL, "", 1000000, &providers)
	require.NoError(t, err, "call /providers")
	nearProviders := []swapKitProvider{}
	for _, provider := range providers {
		if provider.Provider == "NEAR" {
			nearProviders = append(nearProviders, provider)
		}
	}
	require.Len(t, nearProviders, 1, "NEAR providers")
	require.NotEmpty(t, nearProviders[0].EnabledChainIDs, "NEAR enabledChainIds")

	enabledChainIDs := map[string]struct{}{}
	for _, chainID := range nearProviders[0].EnabledChainIDs {
		enabledChainIDs[chainID] = struct{}{}
	}
	return enabledChainIDs
}

func swapKitSellCoinChainID(t *testing.T, sellCoin coinpkg.Coin) string {
	t.Helper()

	if strings.HasPrefix(string(sellCoin.Code()), "eth-erc20-") {
		return swapKitLiveTestChainIDs[coinpkg.CodeETH]
	}
	chainID, ok := swapKitLiveTestChainIDs[sellCoin.Code()]
	require.Truef(t, ok, "missing SwapKit chain ID mapping for coin %q", sellCoin.Code())
	return chainID
}

func trustedSwapKitPaymentRequestPubKey(t *testing.T) *btcec.PublicKey {
	t.Helper()

	pubKeyBytes, err := hex.DecodeString(swapKitPaymentRequestPubKeyHex)
	require.NoError(t, err, "decode trusted pubkey")
	pubKey, err := btcec.ParsePubKey(pubKeyBytes)
	require.NoError(t, err, "parse trusted pubkey")
	return pubKey
}

func runSwapKitLiveTestCase(t *testing.T, ctx context.Context, httpClient *http.Client, trustedPubKey *btcec.PublicKey, testCase swapKitLiveTestCase) {
	t.Helper()

	quote, apiError := NewQuoteFromCoinCode(
		ctx,
		httpClient,
		testCase.sellCoin,
		testCase.buyCoin,
		testCase.sellAmount,
	)
	require.Nil(t, apiError, "quote failed: %+v", apiError)
	require.NotNil(t, quote, "quote response")
	require.NotEmpty(
		t,
		quote.Routes,
		"quote returned no route for %s -> %s",
		testCase.sellCoin.Code(),
		testCase.buyCoin.Code(),
	)

	route := quote.Routes[0]
	require.NotEmpty(t, route.NextActions, "quote route returned no nextActions")
	action := route.NextActions[0]
	require.Equal(t, http.MethodPost, action.Method, "nextActions[0].method")
	require.Equal(t, "/swap", action.URL, "nextActions[0].url")

	var actionPayload swapKitNextActionPayload
	require.NoError(t, json.Unmarshal(action.Payload, &actionPayload), "decode nextActions[0].payload")
	require.NotEmpty(t, actionPayload.RouteID, "nextActions[0].payload.routeId is empty")

	swap, apiError := NewSwap(
		ctx,
		httpClient,
		string(testCase.sellCoin.Code()),
		string(testCase.buyCoin.Code()),
		testCase.sellAmount,
		actionPayload.RouteID,
		testCase.sourceAddress,
		testCase.destinationAddress,
	)
	require.Nil(t, apiError, "swap failed: %+v", apiError)
	require.NotNil(t, swap, "swap response")
	require.Empty(t, swap.Error, "swap returned error")

	slip24 := swap.PaymentRequest()
	require.NotNil(t, slip24, "swap response missing meta.slip24: %+v", swap)
	verifySwapKitSlip24(t, slip24, trustedPubKey, testCase)
}

func verifySwapKitSlip24(t *testing.T, slip24 *paymentrequest.Slip24, trustedPubKey *btcec.PublicKey, testCase swapKitLiveTestCase) {
	t.Helper()

	require.Len(t, slip24.Outputs, 1, "slip24 outputs")

	paymentRequest, err := slip24.ToRequest()
	require.NoError(t, err, "convert slip24")
	require.NotNil(t, paymentRequest, "payment request")
	signature := swapKitECDSASignature(t, paymentRequest.Signature)
	output := slip24.Outputs[0]
	sighash, err := firmware.ComputePaymentRequestSighashBytes(
		btcPaymentRequest(t, paymentRequest),
		testCase.slip44,
		slip24OutputValueBytes(t, testCase.sellCoin, paymentRequest.TotalAmount),
		output.Address,
	)
	require.NoError(t, err)
	require.True(t, signature.Verify(sighash, trustedPubKey), "signature did not match trusted key")
}

func btcPaymentRequest(t *testing.T, paymentRequest *paymentrequest.Request) *messages.BTCPaymentRequestRequest {
	t.Helper()

	memos := make([]*messages.BTCPaymentRequestRequest_Memo, 0, len(paymentRequest.Memos))
	for _, memo := range paymentRequest.Memos {
		switch {
		case memo.Text != nil:
			memos = append(memos, &messages.BTCPaymentRequestRequest_Memo{
				Memo: &messages.BTCPaymentRequestRequest_Memo_TextMemo_{
					TextMemo: &messages.BTCPaymentRequestRequest_Memo_TextMemo{
						Note: memo.Text.Note,
					},
				},
			})
		case memo.CoinPurchase != nil:
			memos = append(memos, &messages.BTCPaymentRequestRequest_Memo{
				Memo: &messages.BTCPaymentRequestRequest_Memo_CoinPurchaseMemo_{
					CoinPurchaseMemo: &messages.BTCPaymentRequestRequest_Memo_CoinPurchaseMemo{
						CoinType: memo.CoinPurchase.CoinType,
						Amount:   memo.CoinPurchase.Amount,
						Address:  memo.CoinPurchase.Address,
					},
				},
			})
		default:
			require.FailNow(t, "payment request memo missing payload")
		}
	}

	return &messages.BTCPaymentRequestRequest{
		RecipientName: paymentRequest.RecipientName,
		Memos:         memos,
		Nonce:         paymentRequest.Nonce,
		TotalAmount:   paymentRequest.TotalAmount,
		Signature:     paymentRequest.Signature,
	}
}

func slip24OutputValueBytes(t *testing.T, sellCoin coinpkg.Coin, amount uint64) []byte {
	t.Helper()

	sellCoinCode := string(sellCoin.Code())
	if sellCoin.Code() == coinpkg.CodeETH || strings.HasPrefix(sellCoinCode, "eth-erc20-") {
		result := make([]byte, 32)
		binary.LittleEndian.PutUint64(result, amount)
		return result
	}
	return binary.LittleEndian.AppendUint64(nil, amount)
}

func swapKitECDSASignature(t *testing.T, sig []byte) *ecdsa.Signature {
	t.Helper()

	require.Len(t, sig, 64, "signature")
	r := new(btcec.ModNScalar)
	r.SetByteSlice(sig[:32])
	s := new(btcec.ModNScalar)
	s.SetByteSlice(sig[32:])
	return ecdsa.NewSignature(r, s)
}
