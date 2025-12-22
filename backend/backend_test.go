// SPDX-License-Identifier: Apache-2.0

package backend

import (
	"context"
	"math/big"
	"net/http"
	"os"
	"testing"
	"time"

	"github.com/BitBoxSwiss/bitbox-wallet-app/backend/accounts"
	accountsMocks "github.com/BitBoxSwiss/bitbox-wallet-app/backend/accounts/mocks"
	"github.com/BitBoxSwiss/bitbox-wallet-app/backend/arguments"
	"github.com/BitBoxSwiss/bitbox-wallet-app/backend/coins/btc"
	"github.com/BitBoxSwiss/bitbox-wallet-app/backend/coins/btc/addresses"
	"github.com/BitBoxSwiss/bitbox-wallet-app/backend/coins/btc/blockchain"
	blockchainMocks "github.com/BitBoxSwiss/bitbox-wallet-app/backend/coins/btc/blockchain/mocks"
	"github.com/BitBoxSwiss/bitbox-wallet-app/backend/coins/btc/types"
	coinpkg "github.com/BitBoxSwiss/bitbox-wallet-app/backend/coins/coin"
	"github.com/BitBoxSwiss/bitbox-wallet-app/backend/coins/eth"
	"github.com/BitBoxSwiss/bitbox-wallet-app/backend/coins/eth/erc20"
	"github.com/BitBoxSwiss/bitbox-wallet-app/backend/coins/eth/rpcclient/mocks"
	"github.com/BitBoxSwiss/bitbox-wallet-app/backend/devices/usb"
	keystoremock "github.com/BitBoxSwiss/bitbox-wallet-app/backend/keystore/mocks"
	"github.com/BitBoxSwiss/bitbox-wallet-app/backend/keystore/software"
	"github.com/BitBoxSwiss/bitbox-wallet-app/backend/signing"
	"github.com/BitBoxSwiss/bitbox-wallet-app/util/observable"
	"github.com/BitBoxSwiss/bitbox-wallet-app/util/test"
	"github.com/ethereum/go-ethereum"
	"github.com/ethereum/go-ethereum/common"
	"github.com/ethereum/go-ethereum/crypto"
	"github.com/sirupsen/logrus"
	"github.com/stretchr/testify/require"
)

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

func keystoreHelper1() *software.Keystore {
	// From mnemonic: wisdom minute home employ west tail liquid mad deal catalog narrow mistake
	rootKey := test.TstMustXKey("xprv9s21ZrQH143K3gie3VFLgx8JcmqZNsBcBc6vAdJrsf4bPRhx69U8qZe3EYAyvRWyQdEfz7ZpyYtL8jW2d2Lfkfh6g2zivq8JdZPQqxoxLwB")
	return software.NewKeystore(rootKey)
}

func keystoreHelper2() *software.Keystore {
	// From mnemonic: lava scare swap mystery lawsuit army rubber clean mean bronze keen volcano
	rootKey := test.TstMustXKey("xprv9s21ZrQH143K3cfe2832UrUDA5jmFWvm3acoempvZofxin26VdqjosJfTjHsVgjgszDYHiEgepM7J7U9N7HpayNZDRPUoxGKQbJCuHzgnuy")
	return software.NewKeystore(rootKey)
}

var rootFingerprint1 = []byte{0x55, 0x55, 0x55, 0x55}

var rootFingerprint2 = []byte{0x66, 0x66, 0x66, 0x66}

// A keystore with a similar config to a BitBox02 Multi - supporting unified and multiple accounts,
// no legacy P2PKH.
func makeBitBox02Multi() *keystoremock.KeystoreMock {
	ksHelper := keystoreHelper1()
	return &keystoremock.KeystoreMock{
		NameFunc: func() (string, error) {
			return "Mock name", nil
		},
		RootFingerprintFunc: func() ([]byte, error) {
			return rootFingerprint1, nil
		},
		SupportsCoinFunc: func(coin coinpkg.Coin) bool {
			return true
		},
		SupportsAccountFunc: func(coin coinpkg.Coin, meta interface{}) bool {
			switch coin.(type) {
			case *btc.Coin:
				scriptType := meta.(signing.ScriptType)
				return scriptType != signing.ScriptTypeP2PKH
			default:
				return true
			}
		},
		SupportsMultipleAccountsFunc: func() bool {
			return true
		},
		ExtendedPublicKeyFunc: ksHelper.ExtendedPublicKey,
		BTCXPubsFunc:          ksHelper.BTCXPubs,
	}
}

// A keystore with a similar config to a BitBox02 Bitcon-only - supporting unified and multiple
// accounts, no legacy P2PKH.
func makeBitBox02BTCOnly() *keystoremock.KeystoreMock {
	ks := makeBitBox02Multi()
	ks.SupportsCoinFunc = func(coin coinpkg.Coin) bool {
		return coin.Code() == coinpkg.CodeBTC || coin.Code() == coinpkg.CodeTBTC || coin.Code() == coinpkg.CodeRBTC
	}
	ks.SupportsAccountFunc = func(coin coinpkg.Coin, meta interface{}) bool {
		switch coin.(type) {
		case *btc.Coin:
			scriptType := meta.(signing.ScriptType)
			return coin.Code() == coinpkg.CodeBTC && scriptType != signing.ScriptTypeP2PKH
		default:
			return false
		}
	}
	return ks
}

func MockBtcAccount(t *testing.T, config *accounts.AccountConfig, coin *btc.Coin, gapLimits *types.GapLimits, log *logrus.Entry) *accountsMocks.InterfaceMock {
	t.Helper()
	return &accountsMocks.InterfaceMock{
		ObserveFunc: func(func(observable.Event)) func() {
			return func() {}
		},
		CoinFunc: func() coinpkg.Coin {
			return coin
		},
		ConfigFunc: func() *accounts.AccountConfig {
			return config
		},
		InitializeFunc: func() error {
			return nil
		},
		TransactionsFunc: func() (accounts.OrderedTransactions, error) {
			return nil, nil
		},
		BalanceFunc: func() (*accounts.Balance, error) {
			return &accounts.Balance{}, nil
		},
		FatalErrorFunc: func() bool {
			return false
		},
		GetUnusedReceiveAddressesFunc: func() ([]accounts.AddressList, error) {
			result := []accounts.AddressList{}
			for _, signingConfig := range config.Config.SigningConfigurations {
				addressChain := addresses.NewAddressChain(
					signingConfig,
					coin.Net(), 20, false,
					func(*addresses.AccountAddress) (bool, error) {
						return false, nil
					},
					log)
				addresses, err := addressChain.EnsureAddresses()
				require.NoError(t, err)
				scriptType := signingConfig.ScriptType()
				result = append(result, accounts.AddressList{
					ScriptType: &scriptType,
					Addresses: []accounts.Address{
						addresses[0],
					},
				})

			}
			return result, nil
		},
		CloseFunc:  func() {},
		SyncedFunc: func() bool { return true },
	}
}

func MockEthAccount(config *accounts.AccountConfig, coin *eth.Coin, httpClient *http.Client, log *logrus.Entry) *accountsMocks.InterfaceMock {
	return &accountsMocks.InterfaceMock{
		ObserveFunc: func(func(observable.Event)) func() {
			return func() {}
		},
		CoinFunc: func() coinpkg.Coin {
			return coin
		},
		ConfigFunc: func() *accounts.AccountConfig {
			return config
		},
		InitializeFunc: func() error {
			return nil
		},
		TransactionsFunc: func() (accounts.OrderedTransactions, error) {
			return nil, nil
		},
		FatalErrorFunc: func() bool { return false },
		GetUnusedReceiveAddressesFunc: func() ([]accounts.AddressList, error) {
			return []accounts.AddressList{
				{
					Addresses: []accounts.Address{
						eth.Address{
							Address: crypto.PubkeyToAddress(
								*config.Config.SigningConfigurations[0].PublicKey().ToECDSA()),
						},
					},
				},
			}, nil
		},
		CloseFunc:  func() {},
		SyncedFunc: func() bool { return true },
	}
}

type environment struct{}

func (e environment) NotifyUser(msg string) {
}

func (e environment) DeviceInfos() []usb.DeviceInfo {
	return []usb.DeviceInfo{}
}

func (e environment) SystemOpen(url string) error {
	return nil
}

func (e environment) UsingMobileData() bool {
	return false
}

func (e environment) NativeLocale() string {
	return ""
}

func (e environment) GetSaveFilename(string) string {
	return ""
}

func (e environment) SetDarkTheme(bool) {
	// nothing to do here.
}

func (e environment) DetectDarkTheme() bool {
	return false
}

func (e environment) Auth() {}

func (e environment) OnAuthSettingChanged(bool) {}

func (e environment) BluetoothConnect(string) {}

type mockTransactionsSource struct {
}

func (m *mockTransactionsSource) Transactions(
	blockTipHeight *big.Int,
	address common.Address, endBlock *big.Int, erc20Token *erc20.Token) (
	[]*accounts.TransactionData, error) {
	return []*accounts.TransactionData{}, nil
}

func newBackend(t *testing.T, testing, regtest bool) *Backend {
	t.Helper()
	b, err := NewBackend(
		arguments.NewArguments(
			test.TstTempDir("appfolder"),
			testing, regtest,
			true,
			&types.GapLimits{Receive: 20, Change: 6}),
		environment{},
	)
	b.tstCheckAccountUsed = func(accounts.Interface) bool {
		return false
	}
	b.ratesUpdater.SetCoingeckoURL("unused") // avoid hitting real API

	b.makeBtcAccount = func(config *accounts.AccountConfig, coin *btc.Coin, gapLimits *types.GapLimits, getAddress func(coinpkg.Code, blockchain.ScriptHashHex) (*addresses.AccountAddress, error), log *logrus.Entry) accounts.Interface {
		return MockBtcAccount(t, config, coin, gapLimits, log)
	}
	b.makeEthAccount = func(config *accounts.AccountConfig, coin *eth.Coin, httpClient *http.Client, log *logrus.Entry) accounts.Interface {
		return MockEthAccount(config, coin, httpClient, log)
	}

	// avoid hitting real API for BTC coins.
	for _, code := range []coinpkg.Code{
		coinpkg.CodeBTC,
		coinpkg.CodeTBTC,
		coinpkg.CodeRBTC,
		coinpkg.CodeLTC,
		coinpkg.CodeTLTC,
	} {
		c, err := b.Coin(code)
		require.NoError(t, err)
		c.(*btc.Coin).TstSetMakeBlockchain(func() blockchain.Interface {
			return &blockchainMocks.BlockchainMock{}
		})
	}

	// avoid hitting real API for ETH coins.
	for _, code := range []coinpkg.Code{
		coinpkg.CodeETH,
		coinpkg.CodeSEPETH,
	} {
		c, err := b.Coin(code)
		require.NoError(t, err)
		c.(*eth.Coin).TstSetClient(&mocks.InterfaceMock{
			EstimateGasFunc: func(ctx context.Context, call ethereum.CallMsg) (uint64, error) {
				return 21000, nil
			},
			BlockNumberFunc: func(ctx context.Context) (*big.Int, error) {
				return big.NewInt(100), nil
			},
			BalanceFunc: func(ctx context.Context, account common.Address) (*big.Int, error) {
				return big.NewInt(1e18), nil
			},
			PendingNonceAtFunc: func(ctx context.Context, account common.Address) (uint64, error) {
				return 0, nil
			},
		})
		c.(*eth.Coin).TstSetTransactionsSource(&mockTransactionsSource{})
	}
	require.NoError(t, err)
	return b
}

func TestRegisterKeystore(t *testing.T) {
	// From mnemonic: wisdom minute home employ west tail liquid mad deal catalog narrow mistake
	rootKey1 := test.TstMustXKey("xprv9s21ZrQH143K3gie3VFLgx8JcmqZNsBcBc6vAdJrsf4bPRhx69U8qZe3EYAyvRWyQdEfz7ZpyYtL8jW2d2Lfkfh6g2zivq8JdZPQqxoxLwB")
	keystoreHelper1 := software.NewKeystore(rootKey1)
	// From mnemonic: lava scare swap mystery lawsuit army rubber clean mean bronze keen volcano
	rootKey2 := test.TstMustXKey("xprv9s21ZrQH143K3cfe2832UrUDA5jmFWvm3acoempvZofxin26VdqjosJfTjHsVgjgszDYHiEgepM7J7U9N7HpayNZDRPUoxGKQbJCuHzgnuy")
	keystoreHelper2 := software.NewKeystore(rootKey2)

	rootFingerprint1 := []byte{0x55, 0x055, 0x55, 0x55}
	rootFingerprint2 := []byte{0x66, 0x066, 0x66, 0x66}

	// A keystore with a similar config to a BitBox02 - supporting unified accounts, no legacy
	// P2PKH.
	ks1 := &keystoremock.KeystoreMock{
		NameFunc: func() (string, error) {
			return "Mock keystore 1", nil
		},
		RootFingerprintFunc: func() ([]byte, error) {
			return rootFingerprint1, nil
		},
		SupportsCoinFunc: func(coin coinpkg.Coin) bool {
			return true
		},
		SupportsAccountFunc: func(coin coinpkg.Coin, meta interface{}) bool {
			switch coin.(type) {
			case *btc.Coin:
				scriptType := meta.(signing.ScriptType)
				return scriptType != signing.ScriptTypeP2PKH
			default:
				return true
			}
		},
		ExtendedPublicKeyFunc: keystoreHelper1.ExtendedPublicKey,
		BTCXPubsFunc:          keystoreHelper1.BTCXPubs,
	}
	ks2 := &keystoremock.KeystoreMock{
		NameFunc: func() (string, error) {
			return "Mock keystore 2", nil
		},
		RootFingerprintFunc: func() ([]byte, error) {
			return rootFingerprint2, nil
		},
		SupportsCoinFunc: func(coin coinpkg.Coin) bool {
			return true
		},
		SupportsAccountFunc: func(coin coinpkg.Coin, meta interface{}) bool {
			switch coin.(type) {
			case *btc.Coin:
				scriptType := meta.(signing.ScriptType)
				return scriptType != signing.ScriptTypeP2PKH
			default:
				return true
			}
		},
		ExtendedPublicKeyFunc: keystoreHelper2.ExtendedPublicKey,
		BTCXPubsFunc:          keystoreHelper2.BTCXPubs,
	}

	b := newBackend(t, testnetDisabled, regtestDisabled)
	defer b.Close()

	checkShownAccountsLen(t, b, 0, 0)

	// Registering a new keystore persists a set of initial default accounts and the keystore.
	b.registerKeystore(ks1)
	require.Equal(t, ks1, b.Keystore())
	checkShownAccountsLen(t, b, 3, 3)
	require.NotNil(t, b.Config().AccountsConfig().Lookup("v0-55555555-btc-0"))
	require.NotNil(t, b.Config().AccountsConfig().Lookup("v0-55555555-ltc-0"))
	require.NotNil(t, b.Config().AccountsConfig().Lookup("v0-55555555-eth-0"))
	require.NotNil(t, b.Accounts().lookup("v0-55555555-btc-0"))
	require.NotNil(t, b.Accounts().lookup("v0-55555555-ltc-0"))
	require.NotNil(t, b.Accounts().lookup("v0-55555555-eth-0"))
	require.Equal(t, "Bitcoin", b.Config().AccountsConfig().Accounts[0].Name)
	require.Equal(t, "Litecoin", b.Config().AccountsConfig().Accounts[1].Name)
	require.Equal(t, "Ethereum", b.Config().AccountsConfig().Accounts[2].Name)

	require.Len(t, b.Config().AccountsConfig().Keystores, 1)
	require.Equal(t, "Mock keystore 1", b.Config().AccountsConfig().Keystores[0].Name)
	require.Equal(t, rootFingerprint1, []byte(b.Config().AccountsConfig().Keystores[0].RootFingerprint))
	// LastConnected might not be `time.Now()` anymore as some time may have passed in the unit
	// tests, but we check that it was set and recent.
	require.Less(t, time.Since(b.Config().AccountsConfig().Keystores[0].LastConnected), 10*time.Second)

	// Deregistering the keystore leaves the loaded accounts (watchonly), and leaves the persisted
	// accounts and keystores.
	// Enable watch-only for the keystore.
	require.NoError(t, b.SetWatchonly(rootFingerprint1, true))

	b.DeregisterKeystore()
	checkShownAccountsLen(t, b, 3, 3)
	require.Len(t, b.Config().AccountsConfig().Keystores, 1)

	// Registering the same keystore again loads the previously persisted accounts and does not
	// automatically persist more accounts.
	b.registerKeystore(ks1)
	checkShownAccountsLen(t, b, 3, 3)
	require.Len(t, b.Config().AccountsConfig().Keystores, 1)

	// Registering another keystore persists a set of initial default accounts and loads them.
	b.DeregisterKeystore()
	b.registerKeystore(ks2)
	require.NoError(t, b.SetWatchonly(rootFingerprint2, true))

	checkShownAccountsLen(t, b, 6, 6)
	require.NotNil(t, b.Config().AccountsConfig().Lookup("v0-66666666-btc-0"))
	require.NotNil(t, b.Config().AccountsConfig().Lookup("v0-66666666-ltc-0"))
	require.NotNil(t, b.Config().AccountsConfig().Lookup("v0-66666666-eth-0"))
	require.NotNil(t, b.Accounts().lookup("v0-66666666-btc-0"))
	require.NotNil(t, b.Accounts().lookup("v0-66666666-ltc-0"))
	require.NotNil(t, b.Accounts().lookup("v0-66666666-eth-0"))
	require.Len(t, b.Config().AccountsConfig().Keystores, 2)
	require.Equal(t, "Mock keystore 2", b.Config().AccountsConfig().Keystores[1].Name)
	require.Equal(t, rootFingerprint2, []byte(b.Config().AccountsConfig().Keystores[1].RootFingerprint))

	b.DeregisterKeystore()

	// Stop watching the first keystore while no keystore is connected.
	require.NoError(t, b.SetWatchonly(rootFingerprint1, false))
	checkShownAccountsLen(t, b, 3, 6)
	require.Nil(t, b.Accounts().lookup("v0-55555555-btc-0"))
	require.Nil(t, b.Accounts().lookup("v0-55555555-ltc-0"))
	require.Nil(t, b.Accounts().lookup("v0-55555555-eth-0"))
	require.NotNil(t, b.Accounts().lookup("v0-66666666-btc-0"))
	require.NotNil(t, b.Accounts().lookup("v0-66666666-ltc-0"))
	require.NotNil(t, b.Accounts().lookup("v0-66666666-eth-0"))
}
