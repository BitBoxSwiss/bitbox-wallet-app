// SPDX-License-Identifier: Apache-2.0

package backend

import (
	"slices"
	"testing"

	"github.com/BitBoxSwiss/bitbox-wallet-app/backend/accounts"
	accountsMocks "github.com/BitBoxSwiss/bitbox-wallet-app/backend/accounts/mocks"
	accountsTypes "github.com/BitBoxSwiss/bitbox-wallet-app/backend/accounts/types"
	"github.com/BitBoxSwiss/bitbox-wallet-app/backend/coins/btc"
	coinpkg "github.com/BitBoxSwiss/bitbox-wallet-app/backend/coins/coin"
	"github.com/BitBoxSwiss/bitbox-wallet-app/backend/paymentrequest"
	"github.com/BitBoxSwiss/bitbox-wallet-app/util/socksproxy"
	"github.com/btcsuite/btcd/chaincfg"
	"github.com/stretchr/testify/require"
)

func TestSwapBuyAccountsRequireConnectedKeystore(t *testing.T) {
	b := newBackend(t, testnetDisabled, regtestDisabled)
	defer b.Close()

	allSwapAccounts, err := b.SwapAccounts()
	require.NoError(t, err)
	require.Len(t, allSwapAccounts.SellAccounts, 0)
	require.Len(t, allSwapAccounts.BuyAccounts, 0)
}

func TestSwapBuyAccountsExcludeDisconnectedWatchonlyAccounts(t *testing.T) {
	b := newBackend(t, testnetDisabled, regtestDisabled)
	defer b.Close()

	ks := makeBitBox02Multi()
	rootFingerprint, err := ks.RootFingerprint()
	require.NoError(t, err)

	b.registerKeystore(ks)
	_, swapAccounts, err := b.swapAccounts()
	require.NoError(t, err)
	require.NotEmpty(t, swapAccounts)

	require.NoError(t, b.SetWatchonly(rootFingerprint, true))
	b.DeregisterKeystore()

	allSwapAccounts, err := b.SwapAccounts()
	require.NoError(t, err)
	require.Len(t, allSwapAccounts.SellAccounts, 0)
	require.Len(t, allSwapAccounts.BuyAccounts, 0)
}

func TestSwapAccountsSellAccountsExcludeInactiveAccounts(t *testing.T) {
	b := newBackend(t, testnetDisabled, regtestDisabled)
	defer b.Close()

	ks := makeBitBox02Multi()
	ks.RootFingerprintFunc = func() ([]byte, error) {
		return rootFingerprint1, nil
	}
	b.registerKeystore(ks)
	zeroAllAccountBalances(t, b)

	btcAccountCode := accountsTypes.Code("v0-55555555-btc-0")
	require.NoError(t, b.SetAccountActive(btcAccountCode, false))
	zeroAllAccountBalances(t, b)

	swapAccounts, err := b.SwapAccounts()
	require.NoError(t, err)
	sellAccountCodes := make([]accountsTypes.Code, 0, len(swapAccounts.SellAccounts))
	for _, account := range swapAccounts.SellAccounts {
		sellAccountCodes = append(sellAccountCodes, account.AccountConfig.Code)
	}
	require.NotContains(t, sellAccountCodes, btcAccountCode)

	buyAccountCodes := make([]accountsTypes.Code, 0, len(swapAccounts.BuyAccounts))
	for _, account := range swapAccounts.BuyAccounts {
		buyAccountCodes = append(buyAccountCodes, account.AccountConfig.Code)
	}
	require.Contains(t, buyAccountCodes, btcAccountCode)
}

func TestSwapBuyAccountsExcludeHiddenUnusedAccounts(t *testing.T) {
	b := newBackend(t, testnetDisabled, regtestDisabled)
	defer b.Close()

	ks := makeBitBox02Multi()
	ks.RootFingerprintFunc = func() ([]byte, error) {
		return rootFingerprint1, nil
	}
	b.registerKeystore(ks)

	btcAccountCode := accountsTypes.Code("v0-55555555-btc-0")
	cfg := b.Config().AccountsConfig().Lookup(btcAccountCode)
	cfg.HiddenBecauseUnused = true

	_, swapAccounts, err := b.swapAccounts()
	require.NoError(t, err)
	buyAccountCodes := make([]accountsTypes.Code, 0, len(swapAccounts))
	for _, account := range swapAccounts {
		buyAccountCodes = append(buyAccountCodes, account.AccountConfig.Code)
	}
	require.NotContains(t, buyAccountCodes, btcAccountCode)
}

func TestSwapBuyAccountsSortOrder(t *testing.T) {
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

	_, swapAccounts, err := b.swapAccounts()
	require.NoError(t, err)
	actualCodes := make([]accountsTypes.Code, 0, len(swapAccounts))
	for _, account := range swapAccounts {
		actualCodes = append(actualCodes, account.AccountConfig.Code)
	}

	require.Equal(t, expectedCodes, actualCodes)
}

func TestSwapSellAccountsIncludeOnlyActiveERC20Accounts(t *testing.T) {
	b := newBackend(t, testnetDisabled, regtestDisabled)
	defer b.Close()

	ks := makeBitBox02Multi()
	ks.RootFingerprintFunc = func() ([]byte, error) {
		return rootFingerprint1, nil
	}
	b.registerKeystore(ks)

	ethAccountCode := accountsTypes.Code("v0-55555555-eth-0")
	activeTokenCode := string(ERC20Tokens()[0].Code)
	inactiveTokenCode := string(ERC20Tokens()[1].Code)

	require.NoError(t, b.SetTokenActive(ethAccountCode, activeTokenCode, true))
	require.NoError(t, b.SetTokenActive(ethAccountCode, inactiveTokenCode, false))

	swapAccounts, _, err := b.swapAccounts()
	require.NoError(t, err)

	actualCodes := make([]accountsTypes.Code, 0, len(swapAccounts))
	for _, account := range swapAccounts {
		actualCodes = append(actualCodes, account.AccountConfig.Code)
	}

	require.Contains(t, actualCodes, Erc20AccountCode(ethAccountCode, activeTokenCode))
	require.NotContains(t, actualCodes, Erc20AccountCode(ethAccountCode, inactiveTokenCode))
}

func TestPrepareSwapActivatesInactiveAccount(t *testing.T) {
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

	require.NoError(t, b.activateSwapBuyAccount(btcAccountCode))
	require.False(t, b.Config().AccountsConfig().Lookup(btcAccountCode).Inactive)
}

func TestPrepareSwapActivatesParentOfTokenDestination(t *testing.T) {
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

	require.NoError(t, b.activateSwapBuyAccount(tokenAccountCode))
	require.False(t, b.Config().AccountsConfig().Lookup(ethAccountCode).Inactive)
	require.Contains(t, b.Config().AccountsConfig().Lookup(ethAccountCode).ActiveTokens, tokenCode)
}

func TestPrepareSwapActivatesInactiveTokenDestination(t *testing.T) {
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

	require.NoError(t, b.activateSwapBuyAccount(tokenAccountCode))
	require.False(t, b.Config().AccountsConfig().Lookup(ethAccountCode).Inactive)
	require.Contains(t, b.Config().AccountsConfig().Lookup(ethAccountCode).ActiveTokens, tokenCode)
}

func TestPrepareSwapReturnsErrorForUnknownAccount(t *testing.T) {
	b := newBackend(t, testnetDisabled, regtestDisabled)
	defer b.Close()

	err := b.activateSwapBuyAccount(accountsTypes.Code("missing-account"))
	require.Error(t, err)
}

func TestValidateSwapAccountSupportedAcceptsMainnetSwapAccounts(t *testing.T) {
	b := newBackend(t, testnetDisabled, regtestDisabled)
	defer b.Close()

	ks := makeBitBox02Multi()
	ks.RootFingerprintFunc = func() ([]byte, error) {
		return rootFingerprint1, nil
	}
	b.registerKeystore(ks)

	require.NoError(t, b.SetTokenActive("v0-55555555-eth-0", "eth-erc20-bat", true))

	testCases := []accountsTypes.Code{
		"v0-55555555-btc-0",
		"v0-55555555-eth-0",
		"v0-55555555-eth-0-eth-erc20-bat",
	}
	for _, accountCode := range testCases {
		account := b.Accounts().lookup(accountCode)
		require.NotNil(t, account)
		require.NoError(t, validateSwapAccountSupported(account))
	}
}

func TestValidateSwapAccountSupportedRejectsUnsupportedMainnetAccount(t *testing.T) {
	b := newBackend(t, testnetDisabled, regtestDisabled)
	defer b.Close()

	ks := makeBitBox02Multi()
	ks.RootFingerprintFunc = func() ([]byte, error) {
		return rootFingerprint1, nil
	}
	b.registerKeystore(ks)

	account := b.Accounts().lookup("v0-55555555-ltc-0")
	require.NotNil(t, account)
	require.EqualError(
		t,
		validateSwapAccountSupported(account),
		"Only supported mainnet BTC/ETH/ERC20 accounts are currently supported",
	)
}

func TestValidateSwapAccountSupportedRejectsTestnetAccounts(t *testing.T) {
	b := newBackend(t, testnetEnabled, regtestDisabled)
	defer b.Close()

	ks := makeBitBox02Multi()
	ks.RootFingerprintFunc = func() ([]byte, error) {
		return rootFingerprint1, nil
	}
	b.registerKeystore(ks)

	testCases := []accountsTypes.Code{
		"v0-55555555-tbtc-0",
		"v0-55555555-sepeth-0",
	}
	for _, accountCode := range testCases {
		account := b.Accounts().lookup(accountCode)
		require.NotNil(t, account)
		require.EqualError(
			t,
			validateSwapAccountSupported(account),
			"Only supported mainnet BTC/ETH/ERC20 accounts are currently supported",
		)
	}
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

func setAccountBalance(t *testing.T, b *Backend, accountCode accountsTypes.Code, amount int64) {
	t.Helper()
	accountMock, ok := b.Accounts().lookup(accountCode).(*accountsMocks.InterfaceMock)
	require.True(t, ok)
	accountMock.BalanceFunc = func() (*accounts.Balance, error) {
		return accounts.NewBalance(coinpkg.NewAmountFromInt64(amount), coinpkg.NewAmountFromInt64(0)), nil
	}
}

func zeroAllAccountBalances(t *testing.T, b *Backend) {
	t.Helper()
	for _, account := range b.Accounts() {
		setAccountBalance(t, b, account.Config().Config.Code, 0)
	}
}

func TestSwapAccountsDefaultSellAndBuyPreferEthAndBtc(t *testing.T) {
	b := newBackend(t, testnetDisabled, regtestDisabled)
	defer b.Close()

	ks := makeBitBox02Multi()
	ks.RootFingerprintFunc = func() ([]byte, error) {
		return rootFingerprint1, nil
	}
	b.registerKeystore(ks)
	zeroAllAccountBalances(t, b)
	setAccountBalance(t, b, accountsTypes.Code("v0-55555555-eth-0"), 1)

	swapAccounts, err := b.SwapAccounts()
	require.NoError(t, err)
	require.NotNil(t, swapAccounts.DefaultSellAccountCode)
	require.NotNil(t, swapAccounts.DefaultBuyAccountCode)
	require.Equal(t, accountsTypes.Code("v0-55555555-eth-0"), *swapAccounts.DefaultSellAccountCode)
	require.Equal(t, accountsTypes.Code("v0-55555555-btc-0"), *swapAccounts.DefaultBuyAccountCode)
}

func TestSwapAccountsDefaultSellFallsBackToFirstNonBtcWithBalance(t *testing.T) {
	b := newBackend(t, testnetDisabled, regtestDisabled)
	defer b.Close()

	ks := makeBitBox02Multi()
	ks.RootFingerprintFunc = func() ([]byte, error) {
		return rootFingerprint1, nil
	}
	b.registerKeystore(ks)
	zeroAllAccountBalances(t, b)

	require.NoError(t, b.SetAccountActive(accountsTypes.Code("v0-55555555-eth-0"), false))
	zeroAllAccountBalances(t, b)
	setAccountBalance(t, b, accountsTypes.Code("v0-55555555-ltc-0"), 1)

	swapAccounts, err := b.SwapAccounts()
	require.NoError(t, err)
	require.NotNil(t, swapAccounts.DefaultSellAccountCode)
	require.Equal(t, accountsTypes.Code("v0-55555555-ltc-0"), *swapAccounts.DefaultSellAccountCode)
	require.NotNil(t, swapAccounts.DefaultBuyAccountCode)
	require.Equal(t, accountsTypes.Code("v0-55555555-btc-0"), *swapAccounts.DefaultBuyAccountCode)
}

func TestSwapAccountsDefaultSellFallsBackToFirstBtcWithBalance(t *testing.T) {
	b := newBackend(t, testnetDisabled, regtestDisabled)
	defer b.Close()

	ks := makeBitBox02Multi()
	ks.RootFingerprintFunc = func() ([]byte, error) {
		return rootFingerprint1, nil
	}
	b.registerKeystore(ks)
	zeroAllAccountBalances(t, b)

	require.NoError(t, b.SetAccountActive(accountsTypes.Code("v0-55555555-eth-0"), false))
	zeroAllAccountBalances(t, b)
	setAccountBalance(t, b, accountsTypes.Code("v0-55555555-btc-0"), 1)

	swapAccounts, err := b.SwapAccounts()
	require.NoError(t, err)
	require.NotNil(t, swapAccounts.DefaultSellAccountCode)
	require.Equal(t, accountsTypes.Code("v0-55555555-btc-0"), *swapAccounts.DefaultSellAccountCode)
	require.NotNil(t, swapAccounts.DefaultBuyAccountCode)
	require.Equal(t, accountsTypes.Code("v0-55555555-eth-0"), *swapAccounts.DefaultBuyAccountCode)
}

func TestSwapAccountsDefaultSellFallsBackToFirstAvailableWhenAllBalancesAreZero(t *testing.T) {
	b := newBackend(t, testnetDisabled, regtestDisabled)
	defer b.Close()

	ks := makeBitBox02Multi()
	ks.RootFingerprintFunc = func() ([]byte, error) {
		return rootFingerprint1, nil
	}
	b.registerKeystore(ks)
	zeroAllAccountBalances(t, b)

	require.NoError(t, b.SetAccountActive(accountsTypes.Code("v0-55555555-eth-0"), false))
	zeroAllAccountBalances(t, b)

	swapAccounts, err := b.SwapAccounts()
	require.NoError(t, err)
	require.NotNil(t, swapAccounts.DefaultSellAccountCode)
	require.Equal(t, accountsTypes.Code("v0-55555555-btc-0"), *swapAccounts.DefaultSellAccountCode)
	require.NotNil(t, swapAccounts.DefaultBuyAccountCode)
	require.Equal(t, accountsTypes.Code("v0-55555555-eth-0"), *swapAccounts.DefaultBuyAccountCode)
}
