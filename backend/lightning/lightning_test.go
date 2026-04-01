// SPDX-License-Identifier: Apache-2.0

package lightning

import (
	"net/http"
	"testing"

	"github.com/BitBoxSwiss/bitbox-wallet-app/backend/config"
	"github.com/BitBoxSwiss/bitbox-wallet-app/backend/keystore"
	"github.com/BitBoxSwiss/bitbox-wallet-app/util/test"
	"github.com/stretchr/testify/require"
)

func newTestLightning(t *testing.T) *Lightning {
	t.Helper()

	appConfigFilename := test.TstTempFile("appConfig")
	accountsConfigFilename := test.TstTempFile("accountsConfig")
	lightningConfigFilename := test.TstTempFile("lightningConfig")

	cfg, err := config.NewConfig(appConfigFilename, accountsConfigFilename, lightningConfigFilename)
	require.NoError(t, err)

	return NewLightning(
		cfg,
		test.TstTempDir("lightning-cache"),
		func() keystore.Keystore { return nil },
		&http.Client{},
		nil,
		nil,
	)
}

func TestAccount(t *testing.T) {
	lightning := newTestLightning(t)
	require.Nil(t, lightning.Account())

	require.NoError(t, lightning.backendConfig.ModifyLightningConfig(func(cfg *config.LightningConfig) error {
		cfg.Accounts = []*config.LightningAccountConfig{
			{Code: "v0-first-ln-0", Number: 0},
			{Code: "v0-second-ln-1", Number: 1},
		}
		return nil
	}))

	account := lightning.Account()
	require.NotNil(t, account)
	require.Equal(t, "v0-first-ln-0", string(account.Code))
}

func TestSetAccount(t *testing.T) {
	lightning := newTestLightning(t)

	account := &config.LightningAccountConfig{
		Mnemonic:        "test mnemonic",
		RootFingerprint: []byte{0xde, 0xad, 0xbe, 0xef},
		Code:            "v0-deadbeef-ln-0",
		Number:          0,
	}
	require.NoError(t, lightning.SetAccount(account))

	storedAccount := lightning.Account()
	require.NotNil(t, storedAccount)
	require.NotSame(t, account, storedAccount)
	require.Equal(t, account, storedAccount)
	require.Len(t, lightning.backendConfig.LightningConfig().Accounts, 1)

	account.Code = "mutated"
	require.Equal(t, "v0-deadbeef-ln-0", string(lightning.Account().Code))

	require.NoError(t, lightning.SetAccount(nil))
	require.Nil(t, lightning.Account())
	require.Empty(t, lightning.backendConfig.LightningConfig().Accounts)
}
