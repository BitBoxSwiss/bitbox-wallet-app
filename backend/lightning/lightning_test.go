// SPDX-License-Identifier: Apache-2.0

package lightning

import (
	"errors"
	"net/http"
	"testing"

	"github.com/BitBoxSwiss/bitbox-wallet-app/backend/config"
	"github.com/BitBoxSwiss/bitbox-wallet-app/backend/keystore"
	"github.com/BitBoxSwiss/bitbox-wallet-app/util/errp"
	"github.com/BitBoxSwiss/bitbox-wallet-app/util/test"
	"github.com/breez/breez-sdk-spark-go/breez_sdk_spark"
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
