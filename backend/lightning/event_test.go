// SPDX-License-Identifier: Apache-2.0

package lightning

import (
	"bytes"
	"errors"
	"testing"

	"github.com/BitBoxSwiss/bitbox-wallet-app/backend/config"
	"github.com/BitBoxSwiss/bitbox-wallet-app/util/observable"
	"github.com/breez/breez-sdk-spark-go/breez_sdk_spark"
	"github.com/sirupsen/logrus"
	"github.com/stretchr/testify/require"
)

func TestNotifyBalanceReloadNotReady(t *testing.T) {
	tests := []struct {
		name      string
		configure func(*testing.T, *Lightning)
	}{
		{
			name: "no account",
		},
		{
			name: "SDK disconnected",
			configure: func(t *testing.T, lightning *Lightning) {
				t.Helper()
				require.NoError(t, lightning.SetAccount(&config.LightningAccountConfig{
					Code: "v0-deadbeef-ln-0",
				}))
			},
		},
	}

	for _, test := range tests {
		t.Run(test.name, func(t *testing.T) {
			lightning := newTestLightning(t, nil)
			if test.configure != nil {
				test.configure(t, lightning)
			}

			var logOutput bytes.Buffer
			logger := logrus.New()
			logger.SetOutput(&logOutput)
			lightning.log = logrus.NewEntry(logger)

			var events []observable.Event
			lightning.Observe(func(event observable.Event) {
				events = append(events, event)
			})

			lightning.NotifyBalanceReload()

			require.Empty(t, events)
			require.Empty(t, logOutput.String())
		})
	}
}

func TestNotifyBalanceReloadLogsReadyFailure(t *testing.T) {
	lightning := newTestLightning(t, nil)
	require.NoError(t, lightning.SetAccount(&config.LightningAccountConfig{
		Code: "v0-deadbeef-ln-0",
	}))
	lightning.sdkService = &testBreezSDK{
		getInfo: func(breez_sdk_spark.GetInfoRequest) (breez_sdk_spark.GetInfoResponse, error) {
			return breez_sdk_spark.GetInfoResponse{}, errors.New("get info failed")
		},
	}
	lightning.setSDKStatus(SDKStatusReady)

	var logOutput bytes.Buffer
	logger := logrus.New()
	logger.SetOutput(&logOutput)
	lightning.log = logrus.NewEntry(logger)

	var events []observable.Event
	lightning.Observe(func(event observable.Event) {
		events = append(events, event)
	})

	lightning.NotifyBalanceReload()

	require.Empty(t, events)
	require.Contains(t, logOutput.String(), "failed to compute lightning balance for notification")
	require.Contains(t, logOutput.String(), "get info failed")
}
