// SPDX-License-Identifier: Apache-2.0

package lightning

import (
	"encoding/base64"
	"errors"
	"net/http"
	"strings"
	"testing"

	"github.com/BitBoxSwiss/bitbox-wallet-app/backend/config"
	"github.com/BitBoxSwiss/bitbox-wallet-app/backend/keystore"
	"github.com/BitBoxSwiss/bitbox-wallet-app/util/errp"
	"github.com/BitBoxSwiss/bitbox-wallet-app/util/test"
	"github.com/breez/breez-sdk-spark-go/breez_sdk_spark"
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
	return newTestLightningWithConfigFilename(t, environment, test.TstTempFile("lightningConfig"))
}

func newTestLightningWithConfigFilename(
	t *testing.T,
	environment environment,
	lightningConfigFilename string,
) *Lightning {
	t.Helper()

	appConfigFilename := test.TstTempFile("appConfig")
	accountsConfigFilename := test.TstTempFile("accountsConfig")

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
		false,
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
		Seed:            "test mnemonic",
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

func TestReady(t *testing.T) {
	lightning := newTestLightning(t, nil)
	require.False(t, lightning.Ready())

	require.NoError(t, lightning.SetAccount(&config.LightningAccountConfig{
		Seed:            "test mnemonic",
		RootFingerprint: []byte{0xde, 0xad, 0xbe, 0xef},
		Code:            "v0-deadbeef-ln-0",
		Number:          0,
	}))
	require.False(t, lightning.Ready())

	lightning.sdkService = &breez_sdk_spark.BreezSdk{}
	require.True(t, lightning.Ready())

	require.NoError(t, lightning.SetAccount(nil))
	require.False(t, lightning.Ready())
}

func TestLnurlDomain(t *testing.T) {
	require.Equal(t, lnurlDomainProd, newTestLightning(t, nil).lnurlDomain())

	lightning := newTestLightning(t, nil)
	lightning.devServers = true
	require.Equal(t, lnurlDomainDev, lightning.lnurlDomain())
}

func TestServiceStatus(t *testing.T) {
	tests := []struct {
		name     string
		status   breez_sdk_spark.ServiceStatus
		expected string
	}{
		{name: "operational", status: breez_sdk_spark.ServiceStatusOperational, expected: "operational"},
		{name: "degraded", status: breez_sdk_spark.ServiceStatusDegraded, expected: "degraded"},
		{name: "partial", status: breez_sdk_spark.ServiceStatusPartial, expected: "partial"},
		{name: "major", status: breez_sdk_spark.ServiceStatusMajor, expected: "major"},
		{name: "unknown", status: breez_sdk_spark.ServiceStatusUnknown, expected: "unknown"},
		{name: "unrecognized", status: breez_sdk_spark.ServiceStatus(99), expected: "unknown"},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			require.Equal(t, tt.expected, serviceStatus(tt.status))
		})
	}
}

func TestSparkStatus(t *testing.T) {
	lightning := &Lightning{
		sparkStatus: func() (breez_sdk_spark.SparkStatus, error) {
			return breez_sdk_spark.SparkStatus{
				Status: breez_sdk_spark.ServiceStatusPartial,
			}, nil
		},
	}

	status, err := lightning.SparkStatus()
	require.NoError(t, err)
	require.Equal(t, &SparkStatus{
		Status: "partial",
	}, status)
}

func TestSparkStatus_Error(t *testing.T) {
	sdkErr := errors.New("boom")
	lightning := &Lightning{
		sparkStatus: func() (breez_sdk_spark.SparkStatus, error) {
			return breez_sdk_spark.SparkStatus{}, sdkErr
		},
	}

	status, err := lightning.SparkStatus()
	require.Nil(t, status)
	require.Error(t, err)
	require.Equal(t, sdkErr, errp.Cause(err))
}

func TestSealAndUnsealMnemonicEncrypted(t *testing.T) {
	env := &testEnvironment{canEncrypt: true}
	lightning := newTestLightning(t, env)

	sealedMnemonic, err := lightning.sealMnemonic("v0-deadbeef-ln-0", "test mnemonic")
	require.NoError(t, err)
	require.NotEqual(t, "test mnemonic", sealedMnemonic)
	require.True(t, strings.HasPrefix(sealedMnemonic, encryptedMnemonicV1Prefix))

	mnemonic, err := lightning.unsealMnemonic(&config.LightningAccountConfig{
		Code: "v0-deadbeef-ln-0",
		Seed: sealedMnemonic,
	})
	require.NoError(t, err)
	require.Equal(t, "test mnemonic", mnemonic)
	require.Equal(t, 1, env.loadCalls)

	mnemonic, err = lightning.unsealMnemonic(&config.LightningAccountConfig{
		Code: "v0-deadbeef-ln-0",
		Seed: sealedMnemonic,
	})
	require.NoError(t, err)
	require.Equal(t, "test mnemonic", mnemonic)
	require.Equal(t, 2, env.loadCalls)
}

func TestUnsealMnemonicUnsupportedFormat(t *testing.T) {
	env := &testEnvironment{
		canEncrypt: true,
		keys: map[string]string{
			"v0-deadbeef-ln-0": base64.StdEncoding.EncodeToString(make([]byte, 32)),
		},
	}
	lightning := newTestLightning(t, env)

	mnemonic, err := lightning.unsealMnemonic(&config.LightningAccountConfig{
		Code: "v0-deadbeef-ln-0",
		Seed: "unversioned",
	})
	require.Empty(t, mnemonic)
	require.ErrorContains(t, err, "unsupported encrypted mnemonic format")
}
