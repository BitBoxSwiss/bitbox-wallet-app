// SPDX-License-Identifier: Apache-2.0

package backend

import (
	"sync/atomic"
	"testing"

	coinpkg "github.com/BitBoxSwiss/bitbox-wallet-app/backend/coins/coin"
	"github.com/BitBoxSwiss/bitbox-wallet-app/backend/config"
	"github.com/BitBoxSwiss/bitbox-wallet-app/backend/signing"
	"github.com/btcsuite/btcd/btcutil/hdkeychain"
	"github.com/stretchr/testify/require"
)

func accountsSnapshot(t *testing.T, backend *Backend) config.AccountsConfig {
	t.Helper()
	accountsConfig, err := backend.accountsDB.Snapshot()
	require.NoError(t, err)
	return accountsConfig
}

type updateTrackingAccountsDB struct {
	accountsDB
	updating atomic.Bool
}

func (db *updateTrackingAccountsDB) Update(
	update func(*config.AccountsConfig) error,
) error {
	db.updating.Store(true)
	defer db.updating.Store(false)
	return db.accountsDB.Update(update)
}

func TestAccountCreationAccessesHardwareBeforeAccountsDBUpdate(t *testing.T) {
	backend := newBackend(t, testnetDisabled, regtestDisabled)
	defer backend.Close()
	keystore := makeBitBox02Multi()
	rootFingerprint, err := keystore.RootFingerprint()
	require.NoError(t, err)
	require.NoError(t, backend.accountsDB.Update(func(accountsConfig *config.AccountsConfig) error {
		accountsConfig.GetOrAddKeystore(rootFingerprint)
		return nil
	}))
	backend.keystore = keystore

	trackingDB := &updateTrackingAccountsDB{
		accountsDB: backend.accountsDB,
	}
	backend.accountsDB = trackingDB

	rootFingerprintFunc := keystore.RootFingerprintFunc
	keystore.RootFingerprintFunc = func() ([]byte, error) {
		require.False(t, trackingDB.updating.Load())
		return rootFingerprintFunc()
	}
	btcXPubsFunc := keystore.BTCXPubsFunc
	keystore.BTCXPubsFunc = func(
		accountCoin coinpkg.Coin,
		keypaths []signing.AbsoluteKeypath,
	) ([]*hdkeychain.ExtendedKey, error) {
		require.False(t, trackingDB.updating.Load())
		return btcXPubsFunc(accountCoin, keypaths)
	}

	_, err = backend.CreateAndPersistAccountConfig(coinpkg.CodeBTC, "Bitcoin", keystore)
	require.NoError(t, err)
}
