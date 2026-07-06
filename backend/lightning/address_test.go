// SPDX-License-Identifier: Apache-2.0

package lightning

import (
	"bytes"
	"errors"
	"regexp"
	"testing"

	"github.com/BitBoxSwiss/bitbox-wallet-app/backend/config"
	"github.com/BitBoxSwiss/bitbox-wallet-app/util/observable"
	"github.com/BitBoxSwiss/bitbox-wallet-app/util/observable/action"
	"github.com/breez/breez-sdk-spark-go/breez_sdk_spark"
	"github.com/stretchr/testify/require"
)

func TestGenerateLightningAddressUsername(t *testing.T) {
	username, err := generateLightningAddressUsername(bytes.NewReader([]byte{
		0x00, 0x00, 0x00, 0x00, 0x00, 0x00,
	}))

	require.NoError(t, err)
	require.Equal(t, "amberanchor0000", username)
	require.Regexp(t, regexp.MustCompile(`^[a-z]+[0-9]{4}$`), username)
}

func TestGenerateLightningAddressUsernameRandomFailure(t *testing.T) {
	username, err := generateLightningAddressUsername(bytes.NewReader([]byte{0xde}))

	require.Empty(t, username)
	require.Error(t, err)
}

func TestLightningAddressString(t *testing.T) {
	require.Nil(t, lightningAddressString(nil))

	address := lightningAddressString(&breez_sdk_spark.LightningAddressInfo{
		LightningAddress: "username@example.com",
	})

	require.NotNil(t, address)
	require.Equal(t, "username@example.com", *address)
}

func activateLightningAddressTest(t *testing.T, lightning *Lightning) {
	t.Helper()

	require.NoError(t, lightning.SetAccount(&config.LightningAccountConfig{
		Seed:            "test mnemonic",
		RootFingerprint: []byte{0xde, 0xad, 0xbe, 0xef},
		Code:            "v0-deadbeef-ln-0",
		Number:          0,
	}))
}

type testBreezSDK struct {
	breezSDK

	getLightningAddress            func() (*breez_sdk_spark.LightningAddressInfo, error)
	checkLightningAddressAvailable func(breez_sdk_spark.CheckLightningAddressRequest) (bool, error)
	registerLightningAddress       func(breez_sdk_spark.RegisterLightningAddressRequest) (breez_sdk_spark.LightningAddressInfo, error)
}

func (sdk *testBreezSDK) GetLightningAddress() (*breez_sdk_spark.LightningAddressInfo, error) {
	return sdk.getLightningAddress()
}

func (sdk *testBreezSDK) CheckLightningAddressAvailable(
	request breez_sdk_spark.CheckLightningAddressRequest,
) (bool, error) {
	return sdk.checkLightningAddressAvailable(request)
}

func (sdk *testBreezSDK) RegisterLightningAddress(
	request breez_sdk_spark.RegisterLightningAddressRequest,
) (breez_sdk_spark.LightningAddressInfo, error) {
	return sdk.registerLightningAddress(request)
}

func TestEnsureLightningAddressExistingAddress(t *testing.T) {
	lightning := newTestLightning(t, nil)
	activateLightningAddressTest(t, lightning)

	lightning.sdkService = &testBreezSDK{
		getLightningAddress: func() (*breez_sdk_spark.LightningAddressInfo, error) {
			return &breez_sdk_spark.LightningAddressInfo{
				LightningAddress: "existing@example.com",
			}, nil
		},
		checkLightningAddressAvailable: func(breez_sdk_spark.CheckLightningAddressRequest) (bool, error) {
			t.Fatal("availability should not be checked when an address exists")
			return false, nil
		},
		registerLightningAddress: func(breez_sdk_spark.RegisterLightningAddressRequest) (breez_sdk_spark.LightningAddressInfo, error) {
			t.Fatal("address should not be registered when one already exists")
			return breez_sdk_spark.LightningAddressInfo{}, nil
		},
	}

	address, err := lightning.ensureLightningAddress()
	require.NoError(t, err)
	require.NotNil(t, address)
	require.Equal(t, "existing@example.com", *address)
}

func TestEnsureLightningAddressRetriesUnavailableUsernames(t *testing.T) {
	lightning := newTestLightning(t, nil)
	activateLightningAddressTest(t, lightning)

	var checkedUsernames []string
	var registeredUsername string
	lightning.sdkService = &testBreezSDK{
		getLightningAddress: func() (*breez_sdk_spark.LightningAddressInfo, error) {
			return nil, nil
		},
		checkLightningAddressAvailable: func(request breez_sdk_spark.CheckLightningAddressRequest) (bool, error) {
			checkedUsernames = append(checkedUsernames, request.Username)
			return len(checkedUsernames) == 2, nil
		},
		registerLightningAddress: func(request breez_sdk_spark.RegisterLightningAddressRequest) (breez_sdk_spark.LightningAddressInfo, error) {
			registeredUsername = request.Username
			require.Equal(t, lightningAddressDescription, *request.Description)
			return breez_sdk_spark.LightningAddressInfo{
				LightningAddress: request.Username + "@example.com",
			}, nil
		},
	}

	address, err := lightning.ensureLightningAddress()
	require.NoError(t, err)
	require.NotNil(t, address)
	require.Len(t, checkedUsernames, 2)
	require.Equal(t, checkedUsernames[1], registeredUsername)
	require.Equal(t, registeredUsername+"@example.com", *address)
}

func TestEnsureLightningAddressContinuesAfterConcurrentClaim(t *testing.T) {
	lightning := newTestLightning(t, nil)
	activateLightningAddressTest(t, lightning)

	registerErr := errors.New("claimed")
	var checkedUsernames []string
	var registeredUsernames []string
	lightning.sdkService = &testBreezSDK{
		getLightningAddress: func() (*breez_sdk_spark.LightningAddressInfo, error) {
			return nil, nil
		},
		checkLightningAddressAvailable: func(request breez_sdk_spark.CheckLightningAddressRequest) (bool, error) {
			checkedUsernames = append(checkedUsernames, request.Username)
			switch len(checkedUsernames) {
			case 1:
				return true, nil
			case 2:
				return false, nil
			case 3:
				return true, nil
			default:
				t.Fatalf("unexpected availability check %d", len(checkedUsernames))
				return false, nil
			}
		},
		registerLightningAddress: func(request breez_sdk_spark.RegisterLightningAddressRequest) (breez_sdk_spark.LightningAddressInfo, error) {
			registeredUsernames = append(registeredUsernames, request.Username)
			if len(registeredUsernames) == 1 {
				return breez_sdk_spark.LightningAddressInfo{}, registerErr
			}
			return breez_sdk_spark.LightningAddressInfo{
				LightningAddress: request.Username + "@example.com",
			}, nil
		},
	}

	address, err := lightning.ensureLightningAddress()
	require.NoError(t, err)
	require.NotNil(t, address)
	require.Len(t, checkedUsernames, 3)
	require.Equal(t, checkedUsernames[0], checkedUsernames[1])
	require.Equal(t, []string{checkedUsernames[0], checkedUsernames[2]}, registeredUsernames)
	require.Equal(t, registeredUsernames[1]+"@example.com", *address)
}

func TestLightningAddressChangedEventNotifiesSubscribers(t *testing.T) {
	lightning := newTestLightning(t, nil)
	events := make(chan observable.Event, 1)
	lightning.Observe(func(event observable.Event) {
		events <- event
	})

	lightning.OnEvent(breez_sdk_spark.SdkEventLightningAddressChanged{
		LightningAddress: &breez_sdk_spark.LightningAddressInfo{
			LightningAddress: "username@example.com",
		},
	})

	address := "username@example.com"
	require.Equal(t, observable.Event{
		Subject: "lightning/address",
		Action:  action.Replace,
		Object:  &address,
	}, <-events)
}
