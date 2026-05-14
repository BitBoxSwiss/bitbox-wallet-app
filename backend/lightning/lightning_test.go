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

type testEnvironment struct {
	canEncrypt bool
	keys       map[string]string
	storeErr   error
	loadErr    error
	deleteErr  error
	loadCalls  int
}

func (e *testEnvironment) CanEncryptLightningMnemonic() bool {
	return e.canEncrypt
}

func (e *testEnvironment) StoreLightningEncryptionKey(accountCode string, encryptionKey string) error {
	if e.storeErr != nil {
		return e.storeErr
	}
	if e.keys == nil {
		e.keys = map[string]string{}
	}
	e.keys[accountCode] = encryptionKey
	return nil
}

func (e *testEnvironment) LoadLightningEncryptionKey(accountCode string) (string, error) {
	e.loadCalls++
	if e.loadErr != nil {
		return "", e.loadErr
	}
	return e.keys[accountCode], nil
}

func (e *testEnvironment) DeleteLightningEncryptionKey(accountCode string) error {
	if e.deleteErr != nil {
		return e.deleteErr
	}
	delete(e.keys, accountCode)
	return nil
}

func newTestLightning(t *testing.T, environment environment) *Lightning {
	t.Helper()

	appConfigFilename := test.TstTempFile("appConfig")
	accountsConfigFilename := test.TstTempFile("accountsConfig")
	lightningConfigFilename := test.TstTempFile("lightningConfig")

	cfg, err := config.NewConfig(appConfigFilename, accountsConfigFilename, lightningConfigFilename)
	require.NoError(t, err)

	if environment == nil {
		environment = &testEnvironment{}
	}

	return NewLightning(
		cfg,
		test.TstTempDir("lightning-cache"),
		environment,
		func() keystore.Keystore { return nil },
		&http.Client{},
		nil,
		nil,
	)
}

func TestAccount(t *testing.T) {
	lightning := newTestLightning(t, nil)
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
	lightning := newTestLightning(t, nil)

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

func TestSealAndUnsealMnemonicEncrypted(t *testing.T) {
	env := &testEnvironment{canEncrypt: true}
	lightning := newTestLightning(t, env)

	sealedMnemonic, err := lightning.sealMnemonic("v0-deadbeef-ln-0", "test mnemonic")
	require.NoError(t, err)
	require.NotEqual(t, "test mnemonic", sealedMnemonic)

	mnemonic, err := lightning.unsealMnemonic(&config.LightningAccountConfig{
		Code:     "v0-deadbeef-ln-0",
		Mnemonic: sealedMnemonic,
	})
	require.NoError(t, err)
	require.Equal(t, "test mnemonic", mnemonic)
	require.Equal(t, 1, env.loadCalls)

	mnemonic, err = lightning.unsealMnemonic(&config.LightningAccountConfig{
		Code:     "v0-deadbeef-ln-0",
		Mnemonic: sealedMnemonic,
	})
	require.NoError(t, err)
	require.Equal(t, "test mnemonic", mnemonic)
	require.Equal(t, 2, env.loadCalls)
}
