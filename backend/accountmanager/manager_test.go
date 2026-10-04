// SPDX-License-Identifier: Apache-2.0

package accountmanager

import (
	"errors"
	"os"
	"testing"

	"github.com/BitBoxSwiss/bitbox-wallet-app/backend/accounts"
	accountsMocks "github.com/BitBoxSwiss/bitbox-wallet-app/backend/accounts/mocks"
	accountsTypes "github.com/BitBoxSwiss/bitbox-wallet-app/backend/accounts/types"
	"github.com/BitBoxSwiss/bitbox-wallet-app/backend/coins/btc"
	coinpkg "github.com/BitBoxSwiss/bitbox-wallet-app/backend/coins/coin"
	"github.com/BitBoxSwiss/bitbox-wallet-app/backend/coins/eth"
	"github.com/BitBoxSwiss/bitbox-wallet-app/backend/coins/eth/erc20"
	"github.com/BitBoxSwiss/bitbox-wallet-app/backend/config"
	keystoremock "github.com/BitBoxSwiss/bitbox-wallet-app/backend/keystore/mocks"
	"github.com/BitBoxSwiss/bitbox-wallet-app/backend/signing"
	"github.com/BitBoxSwiss/bitbox-wallet-app/util/errp"
	"github.com/BitBoxSwiss/bitbox-wallet-app/util/logging"
	"github.com/BitBoxSwiss/bitbox-wallet-app/util/observable"
	"github.com/BitBoxSwiss/bitbox-wallet-app/util/socksproxy"
	"github.com/BitBoxSwiss/bitbox-wallet-app/util/test"
	"github.com/btcsuite/btcd/chaincfg/v2"
	"github.com/ethereum/go-ethereum/params"
	"github.com/stretchr/testify/require"
)

const hardenedKeystart = 0x80000000

var rootFingerprint1 = []byte{0x55, 0x55, 0x55, 0x55}
var rootFingerprint2 = []byte{0x66, 0x66, 0x66, 0x66}

func TestMain(m *testing.M) {
	test.TstSetupLogging()
	os.Exit(m.Run())
}

func mustKeypath(keypath string) signing.AbsoluteKeypath {
	kp, err := signing.NewAbsoluteKeypath(keypath)
	if err != nil {
		panic(err)
	}
	return kp
}

func newTestAccountManager() *Manager {
	coins := map[coinpkg.Code]coinpkg.Coin{
		coinpkg.CodeBTC: btc.NewCoin(coinpkg.CodeBTC, "Bitcoin", "BTC", coinpkg.BtcUnitDefault,
			&chaincfg.MainNetParams, "", nil, "", "", socksproxy.SocksProxy{}),
		coinpkg.CodeTBTC: btc.NewCoin(coinpkg.CodeTBTC, "Bitcoin Testnet", "TBTC", coinpkg.BtcUnitDefault,
			&chaincfg.TestNet3Params, "", nil, "", "", socksproxy.SocksProxy{}),
		coinpkg.CodeRBTC: btc.NewCoin(coinpkg.CodeRBTC, "Bitcoin Regtest", "RBTC", coinpkg.BtcUnitDefault,
			&chaincfg.RegressionNetParams, "", nil, "", "", socksproxy.SocksProxy{}),
		coinpkg.CodeETH: eth.NewCoin(nil, coinpkg.CodeETH, "Ethereum", "ETH", "ETH",
			params.MainnetChainConfig, "", nil, nil),
	}
	for _, code := range []coinpkg.Code{"eth-erc20-bat", "eth-erc20-usdt"} {
		coins[code] = eth.NewCoin(nil, code, string(code), string(code), "ETH",
			params.MainnetChainConfig, "", nil, erc20.NewToken("0x1111111111111111111111111111111111111111", 18))
	}
	return New(Options{
		CoinEnabled: func(coinpkg.Code) bool { return true },
		Coin: func(code coinpkg.Code) (coinpkg.Coin, error) {
			if coin, ok := coins[code]; ok {
				return coin, nil
			}
			return nil, errp.Newf("unknown coin code %s", code)
		},
		MakeAccount: func(coin coinpkg.Coin, record *config.Account, options LoadOptions) accounts.Interface {
			account, _ := newRegistryAccount(func() error { return nil }, func(func(observable.Event)) {})
			account.ConfigFunc = func() *accounts.AccountConfig {
				return &accounts.AccountConfig{
					Code:                  record.Code,
					SigningConfigurations: record.SigningConfigurations,
					SkipInitialSync:       options.SkipETHInitialSync,
				}
			}
			account.CoinFunc = func() coinpkg.Coin { return coin }
			return account
		},
		Log: logging.Get().WithGroup("account-manager-test"),
	})
}

func testManagerAccount(code string, coinCode coinpkg.Code, fingerprint []byte, number uint32) *config.Account {
	account := &config.Account{
		Code:     accountsTypes.Code(code),
		CoinCode: coinCode,
		SigningConfigurations: signing.Configurations{
			signing.NewBitcoinConfiguration(signing.ScriptTypeP2WPKH, fingerprint,
				signing.NewAbsoluteKeypathFromUint32(84+hardenedKeystart, hardenedKeystart, number+hardenedKeystart),
				test.TstMustXKey("xpub6Cxa67Bfe1Aw5VvLM1Ppua9x28CXH1zUYoAuBzFRjR6hWnA6aUcny84KYkeVcZWnWXxKSkxCEyMA8xic54ydBPWm5oziXpsXq6nX8FELMQn")),
		},
	}
	account.Name = code
	if coinCode == coinpkg.CodeETH {
		account.SigningConfigurations = signing.Configurations{
			signing.NewEthereumConfiguration(fingerprint, signing.NewAbsoluteKeypathFromUint32(
				44+hardenedKeystart, 60+hardenedKeystart, hardenedKeystart, 0, number,
			), account.SigningConfigurations[0].ExtendedPublicKey()),
		}
	}
	return account
}

func TestReconcilePreservesInstancesOnMetadataChanges(t *testing.T) {
	manager := newTestAccountManager()
	btcRecord := testManagerAccount("btc", coinpkg.CodeBTC, rootFingerprint1, 0)
	ethRecord := testManagerAccount("eth", coinpkg.CodeETH, rootFingerprint1, 0)
	ethRecord.ActiveTokens = []string{"eth-erc20-bat"}
	snapshot := config.AccountsConfig{
		Accounts: []*config.Account{btcRecord, ethRecord},
		Keystores: []*config.Keystore{
			{RootFingerprint: rootFingerprint1, Watchonly: true, Name: "Wallet"},
		},
	}
	result := manager.Reconcile(snapshot, nil)
	require.Equal(t, Result{MembershipChanged: true, ETHMembershipChanged: true}, result)
	loaded := manager.Accounts()
	require.Len(t, loaded, 3)
	for _, account := range loaded {
		require.True(t, account.Config().SkipInitialSync)
	}

	// Metadata changes preserve the runtime accounts and their initialization state.
	updatedBTC, updatedETH, updatedKeystore := *btcRecord, *ethRecord, *snapshot.Keystores[0]
	updatedBTC.Name = "Renamed Bitcoin"
	updatedBTC.Inactive = true
	updatedETH.InsuranceStatus = "active"
	updatedKeystore.Name = "Renamed wallet"
	updated := config.AccountsConfig{
		Accounts:  []*config.Account{&updatedBTC, &updatedETH},
		Keystores: []*config.Keystore{&updatedKeystore},
	}
	require.Equal(t, Result{}, manager.Reconcile(updated, nil))
	for _, account := range loaded {
		require.Same(t, account, manager.registry.lookup(account.Config().Code))
		mock := account.(*accountsMocks.InterfaceMock)
		require.Len(t, mock.InitializeCalls(), 1)
		require.Empty(t, mock.CloseCalls())
	}

}

func TestAccountManagerReconcileTokenFamily(t *testing.T) {
	manager := newTestAccountManager()
	first := testManagerAccount("first", coinpkg.CodeETH, rootFingerprint1, 0)
	second := testManagerAccount("second", coinpkg.CodeETH, rootFingerprint1, 1)
	first.ActiveTokens = []string{"eth-erc20-usdt"}
	second.ActiveTokens = []string{"eth-erc20-usdt"}
	snapshot := config.AccountsConfig{
		Accounts: []*config.Account{first, second},
		Keystores: []*config.Keystore{
			{RootFingerprint: rootFingerprint1, Watchonly: true},
		},
	}
	manager.Reconcile(snapshot, nil)
	firstAccount := manager.registry.lookup(first.Code)
	secondAccount := manager.registry.lookup(second.Code)
	removedToken := manager.registry.lookup(accountsTypes.Erc20AccountCode(first.Code, "eth-erc20-usdt")).(*accountsMocks.InterfaceMock)
	retainedToken := manager.registry.lookup(accountsTypes.Erc20AccountCode(second.Code, "eth-erc20-usdt"))
	var events []string
	manager.registry.lifecycle = accountRegistryLifecycle{
		onInitialized: func(account accounts.Interface) {
			events = append(events, "init:"+string(account.Config().Code))
		},
		onUninitialized: func(account accounts.Interface) {
			events = append(events, "close:"+string(account.Config().Code))
		},
	}

	first.ActiveTokens = []string{"eth-erc20-bat"}
	result := manager.ReconcileFamily(snapshot, first.Code, nil)
	require.Equal(t, Result{MembershipChanged: true, ETHMembershipChanged: true}, result)
	require.Equal(t, []string{"close:first-eth-erc20-usdt", "init:first-eth-erc20-bat"}, events)
	require.Nil(t, manager.registry.lookup(removedToken.Config().Code))
	require.Len(t, removedToken.CloseCalls(), 1)
	require.Same(t, firstAccount, manager.registry.lookup(first.Code))
	require.Same(t, secondAccount, manager.registry.lookup(second.Code))
	require.Same(t, retainedToken, manager.registry.lookup(retainedToken.Config().Code))
	addedToken := manager.registry.lookup(accountsTypes.Erc20AccountCode(first.Code, "eth-erc20-bat")).(*accountsMocks.InterfaceMock)
	require.False(t, addedToken.Config().SkipInitialSync)
	require.Equal(t, first.SigningConfigurations, addedToken.Config().SigningConfigurations)
	require.Equal(t, Result{}, manager.ReconcileFamily(snapshot, first.Code, nil))
	require.Len(t, events, 2)

	// A full snapshot also removes accounts whose persisted records have been deleted.
	snapshot.Accounts = []*config.Account{second}
	result = manager.Reconcile(snapshot, nil)
	require.Equal(t, Result{MembershipChanged: true, ETHMembershipChanged: true}, result)
	require.Nil(t, manager.registry.lookup(first.Code))
	require.Len(t, addedToken.CloseCalls(), 1)
	require.Len(t, manager.Accounts(), 2)
	require.Same(t, secondAccount, manager.registry.lookup(second.Code))
	require.Same(t, retainedToken, manager.registry.lookup(retainedToken.Config().Code))
}

func TestAccountManagerKeystoreChanges(t *testing.T) {
	manager := newTestAccountManager()
	btcRecord := testManagerAccount("btc", coinpkg.CodeBTC, rootFingerprint1, 0)
	ethRecord := testManagerAccount("eth", coinpkg.CodeETH, rootFingerprint1, 0)
	watchRecord := testManagerAccount("watch", coinpkg.CodeBTC, rootFingerprint2, 0)
	btcRecord.SigningConfigurations = append(btcRecord.SigningConfigurations,
		signing.NewBitcoinConfiguration(signing.ScriptTypeP2TR, rootFingerprint1,
			mustKeypath("m/86'/0'/0'"), btcRecord.SigningConfigurations[0].ExtendedPublicKey()))
	snapshot := config.AccountsConfig{
		Accounts: []*config.Account{btcRecord, ethRecord, watchRecord},
		Keystores: []*config.Keystore{
			{RootFingerprint: rootFingerprint1},
			{RootFingerprint: rootFingerprint2, Watchonly: true},
		},
	}
	btcOnly := &keystoremock.KeystoreMock{
		RootFingerprintFunc: func() ([]byte, error) { return rootFingerprint1, nil },
		SupportsAccountFunc: func(coin coinpkg.Coin, meta interface{}) bool {
			return coin.Code() == coinpkg.CodeBTC && meta == signing.ScriptTypeP2WPKH
		},
	}
	result := manager.Reconcile(snapshot, btcOnly)
	require.Equal(t, Result{MembershipChanged: true}, result)
	btcAccount := manager.registry.lookup(btcRecord.Code)
	watchAccount := manager.registry.lookup(watchRecord.Code)
	require.Len(t, manager.Accounts(), 2)
	// A partially supported BTC account retains all configurations for balances and history.
	require.Equal(t, btcRecord.SigningConfigurations, btcAccount.Config().SigningConfigurations)

	multi := &keystoremock.KeystoreMock{
		RootFingerprintFunc: func() ([]byte, error) { return rootFingerprint1, nil },
		SupportsAccountFunc: func(coinpkg.Coin, interface{}) bool { return true },
	}
	result = manager.Reconcile(snapshot, multi)
	require.Equal(t, Result{MembershipChanged: true, ETHMembershipChanged: true}, result)
	require.Same(t, btcAccount, manager.registry.lookup(btcRecord.Code))
	require.Same(t, watchAccount, manager.registry.lookup(watchRecord.Code))
	require.NotNil(t, manager.registry.lookup(ethRecord.Code))

	result = manager.Reconcile(snapshot, nil)
	require.Equal(t, Result{MembershipChanged: true, ETHMembershipChanged: true}, result)
	require.Len(t, manager.Accounts(), 1)
	require.Same(t, watchAccount, manager.registry.lookup(watchRecord.Code))
	require.Len(t, btcAccount.(*accountsMocks.InterfaceMock).CloseCalls(), 1)
	require.Empty(t, watchAccount.(*accountsMocks.InterfaceMock).CloseCalls())
	require.Equal(t, Result{}, manager.Reconcile(snapshot, nil))
}

func TestReconcileReplacesOnlyRequestedFamilies(t *testing.T) {
	manager := newTestAccountManager()
	btcRecord := testManagerAccount("btc", coinpkg.CodeBTC, rootFingerprint1, 0)
	ethRecord := testManagerAccount("eth", coinpkg.CodeETH, rootFingerprint1, 0)
	ethRecord.ActiveTokens = []string{"eth-erc20-bat"}
	snapshot := config.AccountsConfig{
		Accounts: []*config.Account{btcRecord, ethRecord},
		Keystores: []*config.Keystore{
			{RootFingerprint: rootFingerprint1, Watchonly: true},
		},
	}
	manager.Reconcile(snapshot, nil)
	oldBTC := manager.registry.lookup(btcRecord.Code).(*accountsMocks.InterfaceMock)
	oldETH := manager.registry.lookup(ethRecord.Code).(*accountsMocks.InterfaceMock)
	tokenCode := accountsTypes.Erc20AccountCode(ethRecord.Code, "eth-erc20-bat")
	oldToken := manager.registry.lookup(tokenCode).(*accountsMocks.InterfaceMock)

	upgraded := *btcRecord
	upgraded.SigningConfigurations = append(signing.Configurations{btcRecord.SigningConfigurations[0]},
		signing.NewBitcoinConfiguration(signing.ScriptTypeP2TR, rootFingerprint1,
			mustKeypath("m/86'/0'/0'"), btcRecord.SigningConfigurations[0].ExtendedPublicKey()))
	snapshot.Accounts[0] = &upgraded
	result := manager.Reconcile(snapshot, nil, btcRecord.Code)
	require.Equal(t, Result{MembershipChanged: true}, result)
	newBTC := manager.registry.lookup(btcRecord.Code)
	require.NotSame(t, oldBTC, newBTC)
	require.Equal(t, upgraded.SigningConfigurations, newBTC.Config().SigningConfigurations)
	require.Len(t, oldBTC.CloseCalls(), 1)
	require.Same(t, oldETH, manager.registry.lookup(ethRecord.Code))
	require.Same(t, oldToken, manager.registry.lookup(tokenCode))
	require.Empty(t, oldETH.CloseCalls())
	require.Empty(t, oldToken.CloseCalls())

	// Replacing an ETH family replaces its tokens too, without disturbing other families.
	result = manager.Reconcile(snapshot, nil, ethRecord.Code)
	require.Equal(t, Result{MembershipChanged: true, ETHMembershipChanged: true}, result)
	require.Same(t, newBTC, manager.registry.lookup(btcRecord.Code))
	require.NotSame(t, oldETH, manager.registry.lookup(ethRecord.Code))
	require.NotSame(t, oldToken, manager.registry.lookup(tokenCode))
	require.Len(t, oldETH.CloseCalls(), 1)
	require.Len(t, oldToken.CloseCalls(), 1)
	require.True(t, manager.registry.lookup(tokenCode).Config().SkipInitialSync)
	require.Equal(t, Result{}, manager.Reconcile(snapshot, nil))
}

func TestAccountManagerLoadEligibility(t *testing.T) {
	for _, test := range []struct {
		name      string
		coin      coinpkg.Code
		disabled  bool
		watchonly bool
		hidden    bool
		keystore  Keystore
		loadable  bool
	}{
		{name: "disconnected", coin: coinpkg.CodeBTC},
		{name: "watchonly", coin: coinpkg.CodeBTC, watchonly: true, loadable: true},
		{name: "hidden watchonly", coin: coinpkg.CodeBTC, watchonly: true, hidden: true},
		{name: "watchonly ignores capabilities", coin: coinpkg.CodeETH, watchonly: true,
			keystore: &keystoremock.KeystoreMock{}, loadable: true},
		{name: "foreign keystore", coin: coinpkg.CodeBTC, keystore: &keystoremock.KeystoreMock{
			RootFingerprintFunc: func() ([]byte, error) { return rootFingerprint2, nil },
		}},
		{name: "fingerprint error", coin: coinpkg.CodeBTC, keystore: &keystoremock.KeystoreMock{
			RootFingerprintFunc: func() ([]byte, error) { return nil, errors.New("fingerprint") },
		}},
		{name: "unsupported account", coin: coinpkg.CodeBTC, keystore: &keystoremock.KeystoreMock{
			RootFingerprintFunc: func() ([]byte, error) { return rootFingerprint1, nil },
			SupportsAccountFunc: func(coinpkg.Coin, interface{}) bool { return false },
		}},
		{name: "disabled testnet coin", coin: coinpkg.CodeTBTC, watchonly: true, disabled: true},
		{name: "enabled testnet coin", coin: coinpkg.CodeTBTC, watchonly: true, loadable: true},
		{name: "disabled mainnet coin", coin: coinpkg.CodeBTC, watchonly: true, disabled: true},
		{name: "enabled regtest coin", coin: coinpkg.CodeRBTC, watchonly: true, loadable: true},
		{name: "disabled regtest coin", coin: coinpkg.CodeRBTC, watchonly: true, disabled: true},
		{name: "unknown coin", coin: "unknown", watchonly: true},
	} {
		t.Run(test.name, func(t *testing.T) {
			manager := newTestAccountManager()
			manager.coinEnabled = func(coinpkg.Code) bool { return !test.disabled }
			record := testManagerAccount("account", test.coin, rootFingerprint1, 0)
			record.HiddenBecauseUnused = test.hidden
			snapshot := config.AccountsConfig{
				Accounts: []*config.Account{record},
				Keystores: []*config.Keystore{
					{RootFingerprint: rootFingerprint1, Watchonly: test.watchonly},
				},
			}
			result := manager.Reconcile(snapshot, test.keystore)
			require.Equal(t, test.loadable, result.MembershipChanged)
			require.Equal(t, test.loadable, manager.registry.lookup(record.Code) != nil)
		})
	}
}

func TestAccountManagerInitializationFailureAndUnknownToken(t *testing.T) {
	manager := newTestAccountManager()
	makeAccount := manager.makeAccount
	manager.makeAccount = func(coin coinpkg.Coin, record *config.Account, options LoadOptions) accounts.Interface {
		account := makeAccount(coin, record, options).(*accountsMocks.InterfaceMock)
		if record.Code == "eth" {
			account.InitializeFunc = func() error { return errors.New("initialize") }
		}
		return account
	}
	var initialized []accountsTypes.Code
	manager.registry.lifecycle.onInitialized = func(account accounts.Interface) {
		initialized = append(initialized, account.Config().Code)
	}
	record := testManagerAccount("eth", coinpkg.CodeETH, rootFingerprint1, 0)
	record.ActiveTokens = []string{"unknown", "eth-erc20-bat"}
	snapshot := config.AccountsConfig{
		Accounts: []*config.Account{record},
		Keystores: []*config.Keystore{
			{RootFingerprint: rootFingerprint1, Watchonly: true},
		},
	}
	result := manager.Reconcile(snapshot, nil)
	require.Equal(t, Result{MembershipChanged: true, ETHMembershipChanged: true}, result)
	account := manager.registry.lookup(record.Code).(*accountsMocks.InterfaceMock)
	require.Len(t, manager.Accounts(), 2)
	require.Equal(t, []accountsTypes.Code{"eth-eth-erc20-bat"}, initialized)
	require.Equal(t, Result{}, manager.Reconcile(snapshot, nil))
	require.Same(t, account, manager.registry.lookup(record.Code))
	require.Len(t, account.InitializeCalls(), 1)
}
