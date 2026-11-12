// SPDX-License-Identifier: Apache-2.0

package eth

import (
	"strings"
	"testing"

	"github.com/BitBoxSwiss/bitbox-wallet-app/backend/accounts/errors"
	"github.com/BitBoxSwiss/bitbox-wallet-app/backend/coins/coin"
	"github.com/BitBoxSwiss/bitbox-wallet-app/backend/coins/eth/erc20"
	"github.com/ethereum/go-ethereum/params"
	"github.com/stretchr/testify/require"
)

// testNativeRecipient comes from the native payment example in ERC-681:
// https://eips.ethereum.org/EIPS/eip-681#semantics
const testNativeRecipient = "0xfb6916095ca1df60bb79ce92ce3ea74c37c5d359"

// Bare addresses are accepted for native and token accounts without contacting a node.
func TestParsePaymentInputBareAddress(t *testing.T) {
	for _, token := range []*erc20.Token{nil, erc20.NewToken("0x89205a3a3b2a69de6dbf7f01ed13b2108b2c43e7", 6)} {
		accountCoin := newPaymentInputTestCoin(token)
		parsedInput, err := accountCoin.ParsePaymentInput(" \n" + testNativeRecipient + "\t")
		require.NoError(t, err)
		require.Equal(t, &coin.ParsedPaymentInput{Recipient: testNativeRecipient}, parsedInput)
	}
}

// Invalid bare addresses parse successfully and carry a field error with the input for correction.
func TestParsePaymentInputInvalidBareAddress(t *testing.T) {
	accountCoin := newPaymentInputTestCoin(nil)
	for _, input := range []string{"", "not-an-address", "0x1234", "0xFb6916095ca1df60bb79Ce92ce3ea74c37c5d359", testNativeRecipient + "?value=1"} {
		parsedInput, err := accountCoin.ParsePaymentInput(input)
		require.NoError(t, err)
		require.Equal(t, &coin.ParsedPaymentInput{Recipient: input, ValidationError: errors.ErrInvalidAddress}, parsedInput)
	}
}

func TestParsePaymentInputAddress(t *testing.T) {
	accountCoin := newPaymentInputTestCoin(nil)

	parsedInput, err := accountCoin.ParsePaymentInput(
		"ethereum:" + testNativeRecipient,
	)
	require.NoError(t, err)
	require.Equal(t, &coin.ParsedPaymentInput{
		Recipient: testNativeRecipient,
	}, parsedInput)

	tokenCoin := newPaymentInputTestCoin(erc20.NewToken(
		"0x89205a3a3b2a69de6dbf7f01ed13b2108b2c43e7",
		6,
	))
	parsedInput, err = tokenCoin.ParsePaymentInput(
		"ethereum:" + testNativeRecipient,
	)
	require.NoError(t, err)
	require.Equal(t, &coin.ParsedPaymentInput{
		Recipient: testNativeRecipient,
	}, parsedInput)
}

func TestParsePaymentInputNativeValue(t *testing.T) {
	accountCoin := newPaymentInputTestCoin(nil)
	amount := "2.014"

	parsedInput, err := accountCoin.ParsePaymentInput(
		"ethereum:pay-" + testNativeRecipient + "@01?value=2.014e18",
	)
	require.NoError(t, err)
	require.Equal(t, &coin.ParsedPaymentInput{
		Recipient: testNativeRecipient,
		Amount:    &amount,
	}, parsedInput)
}

func TestParsePaymentInputUint256Bounds(t *testing.T) {
	accountCoin := newPaymentInputTestCoin(nil)

	parsedInput, err := accountCoin.ParsePaymentInput(
		"ethereum:" + testNativeRecipient +
			"?value=115792089237316195423570985008687907853269984665640564039457584007913129639935",
	)
	require.NoError(t, err)
	amount := "115792089237316195423570985008687907853269984665640564039457.584007913129639935"
	require.Equal(t, &amount, parsedInput.Amount)

	parsedInput, err = accountCoin.ParsePaymentInput(
		"ethereum:" + testNativeRecipient +
			"?value=115792089237316195423570985008687907853269984665640564039457584007913129639936",
	)
	require.ErrorIs(t, err, coin.ErrInvalidPaymentInput)
	require.Nil(t, parsedInput)
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
	for _, value := range []string{
		"1e78",
		"1.20e1",
		strings.Repeat("9", 79),
	} {
		_, ok := parsePaymentRequestAtomicAmount(value)
		require.False(t, ok, value)
	}
}

func TestParsePaymentInputERC20Transfer(t *testing.T) {
	accountCoin := newPaymentInputTestCoin(erc20.NewToken(
		"0x89205a3a3b2a69de6dbf7f01ed13b2108b2c43e7",
		6,
	))

	parsedInput, err := accountCoin.ParsePaymentInput(
		"ethereum:0x89205A3A3B2A69DE6DBF7F01ED13B2108B2C43E7@1/transfer" +
			"?address=0x8e23ee67d1332ad560396262c48ffbb01f93d052&uint256=1.2e6",
	)
	require.NoError(t, err)
	amount := "1.2"
	require.Equal(t, &coin.ParsedPaymentInput{
		Recipient: "0x8e23ee67d1332ad560396262c48ffbb01f93d052",
		Amount:    &amount,
	}, parsedInput)

	parsedInput, err = accountCoin.ParsePaymentInput(
		"ethereum:0x89205a3a3b2a69de6dbf7f01ed13b2108b2c43e7/transfer" +
			"?address=0x8e23ee67d1332ad560396262c48ffbb01f93d052",
	)
	require.NoError(t, err)
	require.Equal(t, &coin.ParsedPaymentInput{
		Recipient: "0x8e23ee67d1332ad560396262c48ffbb01f93d052",
	}, parsedInput)
}

func TestParsePaymentInputAccountMismatch(t *testing.T) {
	tokenCoin := newPaymentInputTestCoin(erc20.NewToken(
		"0x89205a3a3b2a69de6dbf7f01ed13b2108b2c43e7",
		6,
	))
	nativeCoin := newPaymentInputTestCoin(nil)

	for _, test := range []struct {
		name        string
		accountCoin *Coin
		input       string
	}{
		{
			name:        "different chain",
			accountCoin: nativeCoin,
			input:       "ethereum:" + testNativeRecipient + "@11155111?value=1e18",
		},
		{
			name:        "different token contract",
			accountCoin: tokenCoin,
			input: "ethereum:0x0000000000000000000000000000000000000001/transfer" +
				"?address=0x8e23ee67d1332ad560396262c48ffbb01f93d052&uint256=1",
		},
		{
			name:        "token transfer from native account",
			accountCoin: nativeCoin,
			input: "ethereum:0x89205a3a3b2a69de6dbf7f01ed13b2108b2c43e7/transfer" +
				"?address=0x8e23ee67d1332ad560396262c48ffbb01f93d052&uint256=1",
		},
		{
			name:        "native value from token account",
			accountCoin: tokenCoin,
			input:       "ethereum:" + testNativeRecipient + "?value=1e18",
		},
	} {
		t.Run(test.name, func(t *testing.T) {
			parsedInput, err := test.accountCoin.ParsePaymentInput(test.input)
			require.ErrorIs(t, err, coin.ErrPaymentInputAccountMismatch)
			require.Nil(t, parsedInput)
		})
	}
}

func TestParsePaymentInputRejectsInvalidInputs(t *testing.T) {
	accountCoin := newPaymentInputTestCoin(nil)

	for _, input := range []string{
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
		t.Run(input, func(t *testing.T) {
			parsedInput, err := accountCoin.ParsePaymentInput(input)
			require.ErrorIs(t, err, coin.ErrInvalidPaymentInput)
			require.Nil(t, parsedInput)
		})
	}
}

func TestParsePaymentInputRejectsInvalidERC20Recipient(t *testing.T) {
	accountCoin := newPaymentInputTestCoin(erc20.NewToken(
		"0x89205a3a3b2a69de6dbf7f01ed13b2108b2c43e7",
		6,
	))

	parsedInput, err := accountCoin.ParsePaymentInput(
		"ethereum:0x89205a3a3b2a69de6dbf7f01ed13b2108b2c43e7/transfer" +
			"?address=not-an-address&uint256=1",
	)
	require.ErrorIs(t, err, coin.ErrInvalidPaymentInput)
	require.Nil(t, parsedInput)
}

func newPaymentInputTestCoin(token *erc20.Token) *Coin {
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
