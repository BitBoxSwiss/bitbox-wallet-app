// Copyright 2021 Shift Crypto AG
//
// Licensed under the Apache License, Version 2.0 (the "License");
// you may not use this file except in compliance with the License.
// You may obtain a copy of the License at
//
//      http://www.apache.org/licenses/LICENSE-2.0
//
// Unless required by applicable law or agreed to in writing, software
// distributed under the License is distributed on an "AS IS" BASIS,
// WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
// See the License for the specific language governing permissions and
// limitations under the License.

package backend

import (
	"testing"

	"github.com/digitalbitbox/bitbox-wallet-app/backend/accounts"
	accountsTypes "github.com/digitalbitbox/bitbox-wallet-app/backend/accounts/types"
	"github.com/digitalbitbox/bitbox-wallet-app/backend/coins/btc"
	coinpkg "github.com/digitalbitbox/bitbox-wallet-app/backend/coins/coin"
	keystoremock "github.com/digitalbitbox/bitbox-wallet-app/backend/keystore/mocks"
	"github.com/digitalbitbox/bitbox-wallet-app/backend/keystore/software"
	"github.com/digitalbitbox/bitbox-wallet-app/backend/signing"
	"github.com/stretchr/testify/require"
)

func TestRegisterKeystore(t *testing.T) {
	// From mnemonic: wisdom minute home employ west tail liquid mad deal catalog narrow mistake
	rootKey1 := mustXKey("xprv9s21ZrQH143K3gie3VFLgx8JcmqZNsBcBc6vAdJrsf4bPRhx69U8qZe3EYAyvRWyQdEfz7ZpyYtL8jW2d2Lfkfh6g2zivq8JdZPQqxoxLwB")
	keystoreHelper1 := software.NewKeystore(rootKey1)
	// From mnemonic: lava scare swap mystery lawsuit army rubber clean mean bronze keen volcano
	rootKey2 := mustXKey("xprv9s21ZrQH143K3cfe2832UrUDA5jmFWvm3acoempvZofxin26VdqjosJfTjHsVgjgszDYHiEgepM7J7U9N7HpayNZDRPUoxGKQbJCuHzgnuy")
	keystoreHelper2 := software.NewKeystore(rootKey2)

	// A keystore with a similar config to a BitBox02 - supporting unified accounts, no legacy
	// P2PKH.
	ks1 := &keystoremock.KeystoreMock{
		RootFingerprintFunc: func() ([]byte, error) {
			return []byte{0x55, 0x055, 0x55, 0x55}, nil
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
		SupportsUnifiedAccountsFunc: func() bool {
			return true
		},
		ExtendedPublicKeyFunc: keystoreHelper1.ExtendedPublicKey,
	}
	ks2 := &keystoremock.KeystoreMock{
		RootFingerprintFunc: func() ([]byte, error) {
			return []byte{0x66, 0x066, 0x66, 0x66}, nil
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
		SupportsUnifiedAccountsFunc: func() bool {
			return true
		},
		ExtendedPublicKeyFunc: keystoreHelper2.ExtendedPublicKey,
	}

	b := newBackend(t, testnetDisabled, regtestDisabled)
	defer b.Close()

	require.Len(t, b.Accounts(), 0)
	require.Len(t, b.Config().AccountsConfig().Accounts, 0)

	// Registering a new keystore persists a set of initial default accounts.
	b.registerKeystore(ks1)
	require.Equal(t, ks1, b.Keystore())
	require.Len(t, b.Accounts(), 3)
	require.Len(t, b.Config().AccountsConfig().Accounts, 3)
	require.NotNil(t, b.Config().AccountsConfig().Lookup("v0-55555555-btc-0"))
	require.NotNil(t, b.Config().AccountsConfig().Lookup("v0-55555555-ltc-0"))
	require.NotNil(t, b.Config().AccountsConfig().Lookup("v0-55555555-eth-0"))
	require.Equal(t, "Bitcoin", b.Config().AccountsConfig().Accounts[0].Name)
	require.Equal(t, "Litecoin", b.Config().AccountsConfig().Accounts[1].Name)
	require.Equal(t, "Ethereum", b.Config().AccountsConfig().Accounts[2].Name)

	// Deregistering the keystore removes the loaded accounts, but not the persisted accounts.
	b.DeregisterKeystore()
	require.Len(t, b.Accounts(), 0)
	require.Len(t, b.Config().AccountsConfig().Accounts, 3)

	// Registering the same keystore again loads the previously persisted accounts and does not
	// automatically persist more accounts.
	b.DeregisterKeystore()
	b.registerKeystore(ks1)
	require.Len(t, b.Accounts(), 3)
	require.Len(t, b.Config().AccountsConfig().Accounts, 3)

	// Registering another keystore persists a set of initial default accounts and loads them.
	b.DeregisterKeystore()
	b.registerKeystore(ks2)
	require.Len(t, b.Accounts(), 3)
	require.Len(t, b.Config().AccountsConfig().Accounts, 6)
	require.NotNil(t, b.Config().AccountsConfig().Lookup("v0-66666666-btc-0"))
	require.NotNil(t, b.Config().AccountsConfig().Lookup("v0-66666666-ltc-0"))
	require.NotNil(t, b.Config().AccountsConfig().Lookup("v0-66666666-eth-0"))
}

func lookup(accts []accounts.Interface, code accountsTypes.Code) accounts.Interface {
	for _, acct := range accts {
		if acct.Config().Config.Code == code {
			return acct
		}
	}
	return nil
}

// TestAccounts performs a series of typical actions related accounts.
// 1) Register a keystore, which automatically adds some default accounts
// 2) Add a second BTC account
// 3) Activate some ETH tokens
// 4) Deactivate an ETH token
// 5) Rename an account
// 6) Deactivate an account.
// 7) Rename an inactive account.
func TestAccounts(t *testing.T) {
	// From mnemonic: wisdom minute home employ west tail liquid mad deal catalog narrow mistake
	rootKey := mustXKey("xprv9s21ZrQH143K3gie3VFLgx8JcmqZNsBcBc6vAdJrsf4bPRhx69U8qZe3EYAyvRWyQdEfz7ZpyYtL8jW2d2Lfkfh6g2zivq8JdZPQqxoxLwB")
	keystoreHelper := software.NewKeystore(rootKey)

	ks := &keystoremock.KeystoreMock{
		RootFingerprintFunc: func() ([]byte, error) {
			return []byte{0x55, 0x055, 0x55, 0x55}, nil
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
		SupportsUnifiedAccountsFunc: func() bool {
			return true
		},
		SupportsMultipleAccountsFunc: func() bool {
			return true
		},
		ExtendedPublicKeyFunc: keystoreHelper.ExtendedPublicKey,
	}

	b := newBackend(t, testnetDisabled, regtestDisabled)
	defer b.Close()

	require.Len(t, b.Accounts(), 0)
	require.Len(t, b.Config().AccountsConfig().Accounts, 0)

	// 1) Registering a new keystore persists a set of initial default accounts.
	b.registerKeystore(ks)
	require.Len(t, b.Accounts(), 3)
	require.Len(t, b.Config().AccountsConfig().Accounts, 3)
	require.NotNil(t, b.Config().AccountsConfig().Lookup("v0-55555555-btc-0"))
	require.NotNil(t, b.Config().AccountsConfig().Lookup("v0-55555555-ltc-0"))
	require.NotNil(t, b.Config().AccountsConfig().Lookup("v0-55555555-eth-0"))

	// 2) Add a second BTC account
	acctCode, err := b.CreateAndPersistAccountConfig(coinpkg.CodeBTC, "A second Bitcoin account", ks)
	require.NoError(t, err)
	require.Equal(t, accountsTypes.Code("v0-55555555-btc-1"), acctCode)
	require.Len(t, b.Accounts(), 4)
	require.Len(t, b.Config().AccountsConfig().Accounts, 4)

	// 3) Activate some ETH tokens
	require.NoError(t, b.SetTokenActive("v0-55555555-eth-0", "eth-erc20-usdt", true))
	require.NoError(t, b.SetTokenActive("v0-55555555-eth-0", "eth-erc20-bat", true))
	require.Equal(t,
		[]string{"eth-erc20-usdt", "eth-erc20-bat"},
		b.Config().AccountsConfig().Lookup("v0-55555555-eth-0").ActiveTokens,
	)
	require.Len(t, b.Accounts(), 6)
	require.Equal(t, accountsTypes.Code("v0-55555555-eth-0-eth-erc20-bat"), b.Accounts()[4].Config().Config.Code)
	require.Equal(t, accountsTypes.Code("v0-55555555-eth-0-eth-erc20-usdt"), b.Accounts()[5].Config().Config.Code)

	// 4) Deactivate an ETH token
	require.NoError(t, b.SetTokenActive("v0-55555555-eth-0", "eth-erc20-usdt", false))
	require.Equal(t,
		[]string{"eth-erc20-bat"},
		b.Config().AccountsConfig().Lookup("v0-55555555-eth-0").ActiveTokens,
	)
	require.Len(t, b.Accounts(), 5)
	require.Equal(t, accountsTypes.Code("v0-55555555-eth-0-eth-erc20-bat"), b.Accounts()[4].Config().Config.Code)

	// 5) Rename an account
	require.NoError(t, b.RenameAccount("v0-55555555-eth-0", "My ETH"))
	require.Equal(t, "My ETH", b.Config().AccountsConfig().Lookup("v0-55555555-eth-0").Name)
	require.Equal(t, "My ETH", lookup(b.Accounts(), "v0-55555555-eth-0").Config().Config.Name)

	// 6) Deactivate an ETH account - it also deactivates the tokens.
	require.NoError(t, b.SetAccountActive("v0-55555555-eth-0", false))
	require.True(t, lookup(b.Accounts(), "v0-55555555-eth-0").Config().Config.Inactive)

	// 7) Rename an inactive account.
	require.NoError(t, b.RenameAccount("v0-55555555-eth-0", "My ETH Renamed"))
	require.Equal(t, "My ETH Renamed", b.Config().AccountsConfig().Lookup("v0-55555555-eth-0").Name)
	require.Equal(t, "My ETH Renamed", lookup(b.Accounts(), "v0-55555555-eth-0").Config().Config.Name)
}
