// SPDX-License-Identifier: Apache-2.0

package eth

import (
	"strings"
	"testing"

	"github.com/BitBoxSwiss/bitbox-wallet-app/backend/coins/coin"
	"github.com/BitBoxSwiss/bitbox-wallet-app/backend/coins/eth/erc20"
	"github.com/ethereum/go-ethereum/params"
	"github.com/stretchr/testify/require"
)

// testNativeRecipient comes from the native payment example in ERC-681:
// https://eips.ethereum.org/EIPS/eip-681#semantics
const testNativeRecipient = "0xfb6916095ca1df60bb79ce92ce3ea74c37c5d359"

func TestParsePaymentRequestAddress(t *testing.T) {
	accountCoin := newPaymentRequestTestCoin(nil)

	request, err := accountCoin.ParsePaymentRequest(
		"ethereum:" + testNativeRecipient,
	)
	require.NoError(t, err)
	require.Equal(t, &PaymentRequest{
		Recipient: testNativeRecipient,
	}, request)

	tokenCoin := newPaymentRequestTestCoin(erc20.NewToken(
		"0x89205a3a3b2a69de6dbf7f01ed13b2108b2c43e7",
		6,
	))
	request, err = tokenCoin.ParsePaymentRequest(
		"ethereum:" + testNativeRecipient,
	)
	require.NoError(t, err)
	require.Equal(t, &PaymentRequest{
		Recipient: testNativeRecipient,
	}, request)
}

func TestParsePaymentRequestNativeValue(t *testing.T) {
	accountCoin := newPaymentRequestTestCoin(nil)

	request, err := accountCoin.ParsePaymentRequest(
		"ethereum:pay-" + testNativeRecipient + "@01?value=2.014e18",
	)
	require.NoError(t, err)
	require.Equal(t, &PaymentRequest{
		Recipient: testNativeRecipient,
		Amount:    "2.014",
	}, request)
}

func TestParsePaymentRequestUint256Bounds(t *testing.T) {
	accountCoin := newPaymentRequestTestCoin(nil)

	request, err := accountCoin.ParsePaymentRequest(
		"ethereum:" + testNativeRecipient +
			"?value=115792089237316195423570985008687907853269984665640564039457584007913129639935",
	)
	require.NoError(t, err)
	require.Equal(t,
		"115792089237316195423570985008687907853269984665640564039457.584007913129639935",
		request.Amount,
	)

	request, err = accountCoin.ParsePaymentRequest(
		"ethereum:" + testNativeRecipient +
			"?value=115792089237316195423570985008687907853269984665640564039457584007913129639936",
	)
	require.ErrorIs(t, err, errInvalidPaymentRequest)
	require.Nil(t, request)
}

func TestParsePaymentRequestAtomicAmount(t *testing.T) {
	for value, expected := range map[string]string{
		"0e18446744073709551615": "0",
		"0.0001e81":              "1" + strings.Repeat("0", 77),
		"1e77":                   "1" + strings.Repeat("0", 77),
	} {
		amount, ok := parsePaymentRequestAtomicAmount(value)
		require.True(t, ok, value)
		require.Equal(t, expected, amount.BigInt().String(), value)
	}
	for _, value := range []string{"1e78", "1.20e1"} {
		_, ok := parsePaymentRequestAtomicAmount(value)
		require.False(t, ok, value)
	}
}

func TestParsePaymentRequestERC20Transfer(t *testing.T) {
	accountCoin := newPaymentRequestTestCoin(erc20.NewToken(
		"0x89205a3a3b2a69de6dbf7f01ed13b2108b2c43e7",
		6,
	))

	request, err := accountCoin.ParsePaymentRequest(
		"ethereum:0x89205A3A3B2A69DE6DBF7F01ED13B2108B2C43E7@1/transfer" +
			"?address=0x8e23ee67d1332ad560396262c48ffbb01f93d052&uint256=1.2e6",
	)
	require.NoError(t, err)
	require.Equal(t, &PaymentRequest{
		Recipient: "0x8e23ee67d1332ad560396262c48ffbb01f93d052",
		Amount:    "1.2",
	}, request)

	request, err = accountCoin.ParsePaymentRequest(
		"ethereum:0x89205a3a3b2a69de6dbf7f01ed13b2108b2c43e7/transfer" +
			"?address=0x8e23ee67d1332ad560396262c48ffbb01f93d052",
	)
	require.NoError(t, err)
	require.Equal(t, &PaymentRequest{
		Recipient: "0x8e23ee67d1332ad560396262c48ffbb01f93d052",
	}, request)
}

func TestParsePaymentRequestAccountMismatch(t *testing.T) {
	tokenCoin := newPaymentRequestTestCoin(erc20.NewToken(
		"0x89205a3a3b2a69de6dbf7f01ed13b2108b2c43e7",
		6,
	))
	nativeCoin := newPaymentRequestTestCoin(nil)

	for _, test := range []struct {
		name        string
		accountCoin *Coin
		uri         string
	}{
		{
			name:        "different chain",
			accountCoin: nativeCoin,
			uri:         "ethereum:" + testNativeRecipient + "@11155111?value=1e18",
		},
		{
			name:        "different token contract",
			accountCoin: tokenCoin,
			uri: "ethereum:0x0000000000000000000000000000000000000001/transfer" +
				"?address=0x8e23ee67d1332ad560396262c48ffbb01f93d052&uint256=1",
		},
		{
			name:        "token transfer from native account",
			accountCoin: nativeCoin,
			uri: "ethereum:0x89205a3a3b2a69de6dbf7f01ed13b2108b2c43e7/transfer" +
				"?address=0x8e23ee67d1332ad560396262c48ffbb01f93d052&uint256=1",
		},
		{
			name:        "native value from token account",
			accountCoin: tokenCoin,
			uri:         "ethereum:" + testNativeRecipient + "?value=1e18",
		},
	} {
		t.Run(test.name, func(t *testing.T) {
			request, err := test.accountCoin.ParsePaymentRequest(test.uri)
			require.ErrorIs(t, err, ErrPaymentRequestAccountMismatch)
			require.Nil(t, request)
		})
	}
}

func TestParsePaymentRequestRejectsInvalidRequests(t *testing.T) {
	accountCoin := newPaymentRequestTestCoin(nil)

	for _, uri := range []string{
		"https://example.com/payment",
		"ethereum:0x1234?value=1",
		"ethereum:0xFb6916095ca1df60bb79Ce92ce3ea74c37c5d359",
		"ethereum:0xFb6916095ca1df60bb79Ce92ce3ea74c37c5d359/transfer" +
			"?address=0x8e23ee67d1332ad560396262c48ffbb01f93d052&uint256=1",
		"ethereum:" + testNativeRecipient + "?value=1.2",
		"ethereum:" + testNativeRecipient + "?value=1e18446744073709551615",
		"ethereum:" + testNativeRecipient + "?gas=21000",
		"ethereum:" + testNativeRecipient + "?value=1&value=2",
		"ethereum:" + testNativeRecipient + "/approve",
		"ethereum:" + testNativeRecipient + "?value=1#fragment",
	} {
		t.Run(uri, func(t *testing.T) {
			request, err := accountCoin.ParsePaymentRequest(uri)
			require.ErrorIs(t, err, errInvalidPaymentRequest)
			require.Nil(t, request)
		})
	}
}

func TestParsePaymentRequestRejectsInvalidERC20Recipient(t *testing.T) {
	accountCoin := newPaymentRequestTestCoin(erc20.NewToken(
		"0x89205a3a3b2a69de6dbf7f01ed13b2108b2c43e7",
		6,
	))

	request, err := accountCoin.ParsePaymentRequest(
		"ethereum:0x89205a3a3b2a69de6dbf7f01ed13b2108b2c43e7/transfer" +
			"?address=not-an-address&uint256=1",
	)
	require.ErrorIs(t, err, errInvalidPaymentRequest)
	require.Nil(t, request)
}

func newPaymentRequestTestCoin(token *erc20.Token) *Coin {
	return NewCoin(
		nil,
		coin.CodeETH,
		"Ethereum",
		"ETH",
		"ETH",
		params.MainnetChainConfig,
		"",
		nil,
		token,
	)
}
