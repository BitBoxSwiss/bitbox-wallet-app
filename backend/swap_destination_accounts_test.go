// SPDX-License-Identifier: Apache-2.0

package backend

import (
	"slices"
	"testing"

	accountsTypes "github.com/BitBoxSwiss/bitbox-wallet-app/backend/accounts/types"
	"github.com/BitBoxSwiss/bitbox-wallet-app/backend/coins/btc"
	coinpkg "github.com/BitBoxSwiss/bitbox-wallet-app/backend/coins/coin"
	"github.com/BitBoxSwiss/bitbox-wallet-app/backend/paymentrequest"
	"github.com/BitBoxSwiss/bitbox-wallet-app/util/socksproxy"
	"github.com/btcsuite/btcd/chaincfg"
	"github.com/stretchr/testify/require"
)

func TestSwapDestinationAccountsSortOrder(t *testing.T) {
	b := newBackend(t, testnetDisabled, regtestDisabled)
	defer b.Close()

	ks := makeBitBox02Multi()
	ks.RootFingerprintFunc = func() ([]byte, error) {
		return rootFingerprint1, nil
	}

	b.registerKeystore(ks)

	btcAccount2Code, err := b.CreateAndPersistAccountConfig(coinpkg.CodeBTC, "Bitcoin account name 2", ks)
	require.NoError(t, err)

	ltcAccount2Code, err := b.CreateAndPersistAccountConfig(coinpkg.CodeLTC, "Litecoin account name 2", ks)
	require.NoError(t, err)

	ethAccount2Code, err := b.CreateAndPersistAccountConfig(coinpkg.CodeETH, "Ethereum account name 2", ks)
	require.NoError(t, err)

	tokenCodes := make([]string, 0, len(ERC20Tokens()))
	for _, token := range ERC20Tokens() {
		tokenCodes = append(tokenCodes, string(token.Code))
	}
	slices.Sort(tokenCodes)

	ethAccount1Code := accountsTypes.Code("v0-55555555-eth-0")
	expectedCodes := []accountsTypes.Code{
		"v0-55555555-btc-0",
		btcAccount2Code,
		"v0-55555555-ltc-0",
		ltcAccount2Code,
		ethAccount1Code,
	}
	for _, tokenCode := range tokenCodes {
		expectedCodes = append(expectedCodes, Erc20AccountCode(ethAccount1Code, tokenCode))
	}
	expectedCodes = append(expectedCodes, ethAccount2Code)
	for _, tokenCode := range tokenCodes {
		expectedCodes = append(expectedCodes, Erc20AccountCode(ethAccount2Code, tokenCode))
	}

	swapAccounts := b.SwapDestinationAccounts()
	actualCodes := make([]accountsTypes.Code, 0, len(swapAccounts))
	for _, account := range swapAccounts {
		actualCodes = append(actualCodes, account.AccountConfig.Code)
	}

	require.Equal(t, expectedCodes, actualCodes)
}

func TestSignSwapActivatesInactiveAccount(t *testing.T) {
	b := newBackend(t, testnetDisabled, regtestDisabled)
	defer b.Close()

	ks := makeBitBox02Multi()
	ks.RootFingerprintFunc = func() ([]byte, error) {
		return rootFingerprint1, nil
	}
	b.registerKeystore(ks)

	btcAccountCode := accountsTypes.Code("v0-55555555-btc-0")
	require.NoError(t, b.SetAccountActive(btcAccountCode, false))
	require.True(t, b.Config().AccountsConfig().Lookup(btcAccountCode).Inactive)

	require.NoError(t, b.activateSwapDestinationAccount(btcAccountCode))
	require.False(t, b.Config().AccountsConfig().Lookup(btcAccountCode).Inactive)
}

func TestSignSwapActivatesParentOfTokenDestination(t *testing.T) {
	b := newBackend(t, testnetDisabled, regtestDisabled)
	defer b.Close()

	ks := makeBitBox02Multi()
	ks.RootFingerprintFunc = func() ([]byte, error) {
		return rootFingerprint1, nil
	}
	b.registerKeystore(ks)

	ethAccountCode := accountsTypes.Code("v0-55555555-eth-0")
	tokenCode := "eth-erc20-bat"
	tokenAccountCode := Erc20AccountCode(ethAccountCode, tokenCode)

	require.NoError(t, b.SetTokenActive(ethAccountCode, tokenCode, true))
	require.NoError(t, b.SetAccountActive(ethAccountCode, false))
	require.True(t, b.Config().AccountsConfig().Lookup(ethAccountCode).Inactive)
	require.Contains(t, b.Config().AccountsConfig().Lookup(ethAccountCode).ActiveTokens, tokenCode)

	require.NoError(t, b.activateSwapDestinationAccount(tokenAccountCode))
	require.False(t, b.Config().AccountsConfig().Lookup(ethAccountCode).Inactive)
	require.Contains(t, b.Config().AccountsConfig().Lookup(ethAccountCode).ActiveTokens, tokenCode)
}

func TestSignSwapActivatesInactiveTokenDestination(t *testing.T) {
	b := newBackend(t, testnetDisabled, regtestDisabled)
	defer b.Close()

	ks := makeBitBox02Multi()
	ks.RootFingerprintFunc = func() ([]byte, error) {
		return rootFingerprint1, nil
	}
	b.registerKeystore(ks)

	ethAccountCode := accountsTypes.Code("v0-55555555-eth-0")
	tokenCode := "eth-erc20-bat"
	tokenAccountCode := Erc20AccountCode(ethAccountCode, tokenCode)

	require.NoError(t, b.SetTokenActive(ethAccountCode, tokenCode, false))
	require.False(t, b.Config().AccountsConfig().Lookup(ethAccountCode).Inactive)
	require.NotContains(t, b.Config().AccountsConfig().Lookup(ethAccountCode).ActiveTokens, tokenCode)

	require.NoError(t, b.activateSwapDestinationAccount(tokenAccountCode))
	require.False(t, b.Config().AccountsConfig().Lookup(ethAccountCode).Inactive)
	require.Contains(t, b.Config().AccountsConfig().Lookup(ethAccountCode).ActiveTokens, tokenCode)
}

func TestSignSwapReturnsErrorForUnknownAccount(t *testing.T) {
	b := newBackend(t, testnetDisabled, regtestDisabled)
	defer b.Close()

	err := b.activateSwapDestinationAccount(accountsTypes.Code("missing-account"))
	require.Error(t, err)
}

func TestSwapSignTxInputUsesSignedOutput(t *testing.T) {
	sellCoin := btc.NewCoin(
		coinpkg.CodeBTC,
		"Bitcoin",
		"BTC",
		coinpkg.BtcUnitSats,
		&chaincfg.MainNetParams,
		".",
		nil,
		"",
		socksproxy.NewSocksProxy(false, ""),
	)
	paymentRequest := &paymentrequest.Slip24{
		RecipientName: "SWAPKIT (NEAR)",
		Memos: []paymentrequest.Slip24Memo{
			{
				Type: "coinPurchase",
				CoinPurchase: &paymentrequest.Slip24CoinPurchase{
					CoinType: 60,
					Amount:   "31.99475075012798141 ETH",
					Address:  "0x986f66F28C6a2BBE939dF3161D1D2b238933895c",
				},
			},
		},
		Outputs: []paymentrequest.Slip24Out{
			{
				Amount:  100000000,
				Address: "1GqULdYGDRfF3w85yGmEq8LTWecpKn8JMJ",
			},
		},
		Signature: "sig",
	}

	txInput, err := swapSignTxInput(paymentRequest, sellCoin, &paymentrequest.Slip24AddressDerivation{
		Eth: &paymentrequest.Slip24EthAddressDerivation{
			Keypath: []uint32{2147483692, 2147483708, 2147483648, 0, 0},
		},
	})
	require.NoError(t, err)
	require.Equal(t, "1GqULdYGDRfF3w85yGmEq8LTWecpKn8JMJ", txInput.Address)
	require.Equal(t, "100000000", txInput.Amount)
	require.NotNil(t, txInput.PaymentRequest)
	require.NotNil(t, txInput.PaymentRequest.Memos[0].CoinPurchase)
	require.NotNil(t, txInput.PaymentRequest.Memos[0].CoinPurchase.AddressDerivation)
	require.Equal(
		t,
		[]uint32{2147483692, 2147483708, 2147483648, 0, 0},
		txInput.PaymentRequest.Memos[0].CoinPurchase.AddressDerivation.Eth.Keypath,
	)
}

func TestSwapSignTxInputUsesBTCDestinationDerivation(t *testing.T) {
	sellCoin := btc.NewCoin(
		coinpkg.CodeBTC,
		"Bitcoin",
		"BTC",
		coinpkg.BtcUnitSats,
		&chaincfg.MainNetParams,
		".",
		nil,
		"",
		socksproxy.NewSocksProxy(false, ""),
	)
	paymentRequest := &paymentrequest.Slip24{
		RecipientName: "SWAPKIT (NEAR)",
		Memos: []paymentrequest.Slip24Memo{
			{
				Type: "coinPurchase",
				CoinPurchase: &paymentrequest.Slip24CoinPurchase{
					CoinType: 0,
					Amount:   "0.01 BTC",
					Address:  "bc1qpz7m2szz07ca7vtj3zlce43fscdnv2q8hhs0tx",
				},
			},
		},
		Outputs: []paymentrequest.Slip24Out{
			{
				Amount:  100000000,
				Address: "1GqULdYGDRfF3w85yGmEq8LTWecpKn8JMJ",
			},
		},
		Signature: "sig",
	}

	txInput, err := swapSignTxInput(paymentRequest, sellCoin, &paymentrequest.Slip24AddressDerivation{
		Btc: &paymentrequest.Slip24BtcAddressDerivation{
			Keypath:    []uint32{2147483697, 2147483648, 2147483648, 0, 5},
			ScriptType: "p2wpkh",
		},
	})
	require.NoError(t, err)
	require.NotNil(t, txInput.PaymentRequest)
	require.NotNil(t, txInput.PaymentRequest.Memos[0].CoinPurchase)
	require.NotNil(t, txInput.PaymentRequest.Memos[0].CoinPurchase.AddressDerivation)
	require.Equal(
		t,
		[]uint32{2147483697, 2147483648, 2147483648, 0, 5},
		txInput.PaymentRequest.Memos[0].CoinPurchase.AddressDerivation.Btc.Keypath,
	)
	require.Equal(
		t,
		"p2wpkh",
		txInput.PaymentRequest.Memos[0].CoinPurchase.AddressDerivation.Btc.ScriptType,
	)
}
