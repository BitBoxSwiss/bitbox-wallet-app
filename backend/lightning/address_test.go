// SPDX-License-Identifier: Apache-2.0

package lightning

import (
	"bytes"
	"errors"
	"net/http"
	"os"
	"path/filepath"
	"regexp"
	"testing"
	"time"

	"github.com/BitBoxSwiss/bitbox-wallet-app/backend/config"
	"github.com/BitBoxSwiss/bitbox-wallet-app/util/errp"
	"github.com/BitBoxSwiss/bitbox-wallet-app/util/observable"
	"github.com/BitBoxSwiss/bitbox-wallet-app/util/observable/action"
	"github.com/breez/breez-sdk-spark-go/breez_sdk_spark"
	"github.com/stretchr/testify/require"
)

func withLightningAddressNow(t *testing.T, now time.Time) {
	t.Helper()

	previous := lightningAddressNow
	lightningAddressNow = func() time.Time {
		return now
	}
	t.Cleanup(func() {
		lightningAddressNow = previous
	})
}

func TestGenerateAddressUsername(t *testing.T) {
	username, err := generateLightningAddressUsername(bytes.NewReader([]byte{
		0x00, 0x00, 0x00, 0x00, 0x00, 0x00,
	}))

	require.NoError(t, err)
	require.Equal(t, "amberanchor0000", username)
	require.Regexp(t, regexp.MustCompile(`^[a-z]+[0-9]{4}$`), username)
}

func TestGenerateAddressUsernameRandomFailure(t *testing.T) {
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
	getInfo                        func(breez_sdk_spark.GetInfoRequest) (breez_sdk_spark.GetInfoResponse, error)
	listPayments                   func(breez_sdk_spark.ListPaymentsRequest) (breez_sdk_spark.ListPaymentsResponse, error)
	listUnclaimedDeposits          func(breez_sdk_spark.ListUnclaimedDepositsRequest) (breez_sdk_spark.ListUnclaimedDepositsResponse, error)
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

func (sdk *testBreezSDK) GetInfo(request breez_sdk_spark.GetInfoRequest) (breez_sdk_spark.GetInfoResponse, error) {
	return sdk.getInfo(request)
}

func (sdk *testBreezSDK) ListPayments(
	request breez_sdk_spark.ListPaymentsRequest,
) (breez_sdk_spark.ListPaymentsResponse, error) {
	return sdk.listPayments(request)
}

func (sdk *testBreezSDK) ListUnclaimedDeposits(
	request breez_sdk_spark.ListUnclaimedDepositsRequest,
) (breez_sdk_spark.ListUnclaimedDepositsResponse, error) {
	return sdk.listUnclaimedDeposits(request)
}

func TestEnsureLightningAddressExistingAddress(t *testing.T) {
	lightning := newTestLightning(t, nil)
	activateLightningAddressTest(t, lightning)

	lightning.sdkService = &testBreezSDK{
		getLightningAddress: func() (*breez_sdk_spark.LightningAddressInfo, error) {
			return &breez_sdk_spark.LightningAddressInfo{
				LightningAddress: "existing@example.com",
				Username:         "existing",
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
	require.Nil(t, lightning.Account().LightningAddressLastChangedAt)
}

func TestEnsureLightningAddressStopsAfterMaxUnavailableUsernames(t *testing.T) {
	lightning := newTestLightning(t, nil)
	activateLightningAddressTest(t, lightning)

	var checkedUsernames []string
	lightning.sdkService = &testBreezSDK{
		getLightningAddress: func() (*breez_sdk_spark.LightningAddressInfo, error) {
			return nil, nil
		},
		checkLightningAddressAvailable: func(request breez_sdk_spark.CheckLightningAddressRequest) (bool, error) {
			checkedUsernames = append(checkedUsernames, request.Username)
			return false, nil
		},
		registerLightningAddress: func(breez_sdk_spark.RegisterLightningAddressRequest) (breez_sdk_spark.LightningAddressInfo, error) {
			t.Fatal("unavailable address should not be registered")
			return breez_sdk_spark.LightningAddressInfo{}, nil
		},
	}

	address, err := lightning.ensureLightningAddress()
	require.Nil(t, address)
	require.Error(t, err)
	require.Len(t, checkedUsernames, maxLightningAddressAttempts)
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

func TestLightningAddressExistingAddress(t *testing.T) {
	lightning := newTestLightning(t, nil)
	activateLightningAddressTest(t, lightning)

	lightning.sdkService = &testBreezSDK{
		getLightningAddress: func() (*breez_sdk_spark.LightningAddressInfo, error) {
			return &breez_sdk_spark.LightningAddressInfo{
				LightningAddress: "existing@example.com",
				Username:         "existing",
			}, nil
		},
		checkLightningAddressAvailable: func(breez_sdk_spark.CheckLightningAddressRequest) (bool, error) {
			t.Fatal("availability should not be checked when only reading the current address")
			return false, nil
		},
		registerLightningAddress: func(breez_sdk_spark.RegisterLightningAddressRequest) (breez_sdk_spark.LightningAddressInfo, error) {
			t.Fatal("address should not be registered when only reading the current address")
			return breez_sdk_spark.LightningAddressInfo{}, nil
		},
	}

	address, err := lightning.LightningAddress()
	require.NoError(t, err)
	require.NotNil(t, address)
	require.Equal(t, "existing@example.com", *address)
}

func TestLightningAddressMissingAddressDoesNotRegister(t *testing.T) {
	lightning := newTestLightning(t, nil)
	activateLightningAddressTest(t, lightning)

	lightning.sdkService = &testBreezSDK{
		getLightningAddress: func() (*breez_sdk_spark.LightningAddressInfo, error) {
			return nil, nil
		},
		checkLightningAddressAvailable: func(breez_sdk_spark.CheckLightningAddressRequest) (bool, error) {
			t.Fatal("availability should not be checked when only reading the current address")
			return false, nil
		},
		registerLightningAddress: func(breez_sdk_spark.RegisterLightningAddressRequest) (breez_sdk_spark.LightningAddressInfo, error) {
			t.Fatal("address should not be registered when only reading the current address")
			return breez_sdk_spark.LightningAddressInfo{}, nil
		},
	}

	address, err := lightning.LightningAddress()
	require.NoError(t, err)
	require.Nil(t, address)
}

func TestNormalizeLightningAddressUsername(t *testing.T) {
	tests := []struct {
		name     string
		username string
		expected string
		err      error
	}{
		{name: "lowercase", username: "username123", expected: "username123"},
		{name: "trim and lowercase", username: " User123 ", expected: "user123"},
		{name: "empty", username: " ", err: errLightningAddressInvalidUsername},
		{name: "hyphen", username: "user-name", err: errLightningAddressInvalidUsername},
		{name: "too long", username: "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa", err: errLightningAddressInvalidUsername},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			username, err := normalizeLightningAddressUsername(tt.username)
			if tt.err != nil {
				require.Equal(t, tt.err, errp.Cause(err))
				require.Empty(t, username)
				return
			}
			require.NoError(t, err)
			require.Equal(t, tt.expected, username)
		})
	}
}

func TestAddressAvailability(t *testing.T) {
	lightning := newTestLightning(t, nil)
	activateLightningAddressTest(t, lightning)

	var checkedUsername string
	lightning.sdkService = &testBreezSDK{
		checkLightningAddressAvailable: func(request breez_sdk_spark.CheckLightningAddressRequest) (bool, error) {
			checkedUsername = request.Username
			return true, nil
		},
	}

	availability, err := lightning.AddressAvailability(" User123 ")
	require.NoError(t, err)
	require.Equal(t, "user123", checkedUsername)
	require.Equal(t, &AddressAvailability{
		GeneratedAddress: GeneratedAddress{
			Username: "user123",
			Address:  "user123@bitbox.pay",
		},
		Available: true,
	}, availability)
}

func TestAddressAvailabilityRejectsInvalidUsernameBeforeSDKCall(t *testing.T) {
	lightning := newTestLightning(t, nil)
	activateLightningAddressTest(t, lightning)

	lightning.sdkService = &testBreezSDK{
		checkLightningAddressAvailable: func(breez_sdk_spark.CheckLightningAddressRequest) (bool, error) {
			t.Fatal("availability should not be checked for invalid usernames")
			return false, nil
		},
	}

	availability, err := lightning.AddressAvailability("user-name")
	require.Nil(t, availability)
	require.Equal(t, errLightningAddressInvalidUsername, errp.Cause(err))
}

func TestGenerateAddressRetriesUnavailableUsernamesWithoutRegistering(t *testing.T) {
	lightning := newTestLightning(t, nil)
	activateLightningAddressTest(t, lightning)

	var checkedUsernames []string
	lightning.sdkService = &testBreezSDK{
		checkLightningAddressAvailable: func(request breez_sdk_spark.CheckLightningAddressRequest) (bool, error) {
			checkedUsernames = append(checkedUsernames, request.Username)
			return len(checkedUsernames) == 2, nil
		},
		registerLightningAddress: func(breez_sdk_spark.RegisterLightningAddressRequest) (breez_sdk_spark.LightningAddressInfo, error) {
			t.Fatal("generated address should not be registered")
			return breez_sdk_spark.LightningAddressInfo{}, nil
		},
	}

	generatedAddress, err := lightning.GenerateAddress()
	require.NoError(t, err)
	require.NotNil(t, generatedAddress)
	require.Len(t, checkedUsernames, 2)
	require.Equal(t, checkedUsernames[1], generatedAddress.Username)
	require.Equal(t, generatedAddress.Username+"@bitbox.pay", generatedAddress.Address)
}

func TestRegisterAddress(t *testing.T) {
	lightning := newTestLightning(t, nil)
	activateLightningAddressTest(t, lightning)
	now := time.Date(2026, 7, 9, 12, 0, 0, 0, time.UTC)
	withLightningAddressNow(t, now)

	var checkedUsername string
	var registeredUsername string
	lightning.sdkService = &testBreezSDK{
		getLightningAddress: func() (*breez_sdk_spark.LightningAddressInfo, error) {
			return nil, nil
		},
		checkLightningAddressAvailable: func(request breez_sdk_spark.CheckLightningAddressRequest) (bool, error) {
			checkedUsername = request.Username
			return true, nil
		},
		registerLightningAddress: func(request breez_sdk_spark.RegisterLightningAddressRequest) (breez_sdk_spark.LightningAddressInfo, error) {
			registeredUsername = request.Username
			require.Equal(t, lightningAddressDescription, *request.Description)
			return breez_sdk_spark.LightningAddressInfo{
				LightningAddress: request.Username + "@example.com",
			}, nil
		},
	}

	address, err := lightning.RegisterAddress(" User123 ")
	require.NoError(t, err)
	require.NotNil(t, address)
	require.Equal(t, "user123", checkedUsername)
	require.Equal(t, "user123", registeredUsername)
	require.Equal(t, "user123@example.com", *address)
	require.NotNil(t, lightning.Account().LightningAddressLastChangedAt)
	require.Equal(t, now, *lightning.Account().LightningAddressLastChangedAt)
}

func TestRegisterAddressReturnsSuccessWhenTimestampPersistenceFails(t *testing.T) {
	configDir := t.TempDir()
	appConfigFilename := filepath.Join(configDir, "app.json")
	accountsConfigFilename := filepath.Join(configDir, "accounts.json")
	lightningConfigFilename := filepath.Join(configDir, "lightning.json")
	cfg, err := config.NewConfig(appConfigFilename, accountsConfigFilename, lightningConfigFilename)
	require.NoError(t, err)

	lightning := NewLightning(cfg, t.TempDir(), nil, nil, nil, &http.Client{}, nil, nil, false)
	activateLightningAddressTest(t, lightning)
	now := time.Date(2026, 7, 9, 12, 0, 0, 0, time.UTC)
	withLightningAddressNow(t, now)

	require.NoError(t, os.Remove(lightningConfigFilename))
	require.NoError(t, os.Mkdir(lightningConfigFilename, 0o755))

	events := make(chan observable.Event, 1)
	lightning.Observe(func(event observable.Event) {
		events <- event
	})

	lightning.sdkService = &testBreezSDK{
		getLightningAddress: func() (*breez_sdk_spark.LightningAddressInfo, error) {
			return nil, nil
		},
		checkLightningAddressAvailable: func(breez_sdk_spark.CheckLightningAddressRequest) (bool, error) {
			return true, nil
		},
		registerLightningAddress: func(request breez_sdk_spark.RegisterLightningAddressRequest) (breez_sdk_spark.LightningAddressInfo, error) {
			return breez_sdk_spark.LightningAddressInfo{
				LightningAddress: request.Username + "@example.com",
			}, nil
		},
	}

	address, err := lightning.RegisterAddress("replacement")
	require.NoError(t, err)
	require.NotNil(t, address)
	require.Equal(t, "replacement@example.com", *address)
	require.NotNil(t, lightning.Account().LightningAddressLastChangedAt)
	require.Equal(t, now, *lightning.Account().LightningAddressLastChangedAt)

	require.Equal(t, observable.Event{
		Subject: "lightning/address",
		Action:  action.Replace,
		Object:  address,
	}, <-events)
}

func TestRegisterAddressUnavailable(t *testing.T) {
	lightning := newTestLightning(t, nil)
	activateLightningAddressTest(t, lightning)

	lightning.sdkService = &testBreezSDK{
		getLightningAddress: func() (*breez_sdk_spark.LightningAddressInfo, error) {
			return nil, nil
		},
		checkLightningAddressAvailable: func(breez_sdk_spark.CheckLightningAddressRequest) (bool, error) {
			return false, nil
		},
		registerLightningAddress: func(breez_sdk_spark.RegisterLightningAddressRequest) (breez_sdk_spark.LightningAddressInfo, error) {
			t.Fatal("unavailable address should not be registered")
			return breez_sdk_spark.LightningAddressInfo{}, nil
		},
	}

	address, err := lightning.RegisterAddress("taken")
	require.Nil(t, address)
	require.Equal(t, errLightningAddressUsernameUnavailable, errp.Cause(err))
}

func TestRegisterAddressCurrentUsernameIsNoop(t *testing.T) {
	lightning := newTestLightning(t, nil)
	activateLightningAddressTest(t, lightning)

	lastChangedAt := time.Date(2026, 7, 9, 12, 0, 0, 0, time.UTC)
	account := *lightning.Account()
	account.LightningAddressLastChangedAt = &lastChangedAt
	require.NoError(t, lightning.SetAccount(&account))

	lightning.sdkService = &testBreezSDK{
		getLightningAddress: func() (*breez_sdk_spark.LightningAddressInfo, error) {
			return &breez_sdk_spark.LightningAddressInfo{
				LightningAddress: "existing@example.com",
				Username:         "existing",
			}, nil
		},
		checkLightningAddressAvailable: func(breez_sdk_spark.CheckLightningAddressRequest) (bool, error) {
			t.Fatal("availability should not be checked when registering the current username")
			return false, nil
		},
		registerLightningAddress: func(breez_sdk_spark.RegisterLightningAddressRequest) (breez_sdk_spark.LightningAddressInfo, error) {
			t.Fatal("current address should not be registered again")
			return breez_sdk_spark.LightningAddressInfo{}, nil
		},
	}

	address, err := lightning.RegisterAddress(" Existing ")
	require.NoError(t, err)
	require.NotNil(t, address)
	require.Equal(t, "existing@example.com", *address)
	require.Equal(t, lastChangedAt, *lightning.Account().LightningAddressLastChangedAt)
}

func TestRegisterAddressCurrentUsernameRepairsMissingTimestamp(t *testing.T) {
	lightning := newTestLightning(t, nil)
	activateLightningAddressTest(t, lightning)
	now := time.Date(2026, 7, 9, 12, 0, 0, 0, time.UTC)
	withLightningAddressNow(t, now)

	lightning.sdkService = &testBreezSDK{
		getLightningAddress: func() (*breez_sdk_spark.LightningAddressInfo, error) {
			return &breez_sdk_spark.LightningAddressInfo{
				LightningAddress: "existing@example.com",
				Username:         "existing",
			}, nil
		},
		checkLightningAddressAvailable: func(breez_sdk_spark.CheckLightningAddressRequest) (bool, error) {
			t.Fatal("availability should not be checked when registering the current username")
			return false, nil
		},
		registerLightningAddress: func(breez_sdk_spark.RegisterLightningAddressRequest) (breez_sdk_spark.LightningAddressInfo, error) {
			t.Fatal("current address should not be registered again")
			return breez_sdk_spark.LightningAddressInfo{}, nil
		},
	}

	address, err := lightning.RegisterAddress(" Existing ")
	require.NoError(t, err)
	require.NotNil(t, address)
	require.Equal(t, "existing@example.com", *address)
	require.NotNil(t, lightning.Account().LightningAddressLastChangedAt)
	require.Equal(t, now, *lightning.Account().LightningAddressLastChangedAt)
}

func TestRegisterAddressCooldown(t *testing.T) {
	lightning := newTestLightning(t, nil)
	activateLightningAddressTest(t, lightning)

	now := time.Date(2026, 7, 9, 12, 0, 0, 0, time.UTC)
	withLightningAddressNow(t, now)
	lastChangedAt := now.Add(-lightningAddressChangeCooldown + time.Second)
	account := *lightning.Account()
	account.LightningAddressLastChangedAt = &lastChangedAt
	require.NoError(t, lightning.SetAccount(&account))

	lightning.sdkService = &testBreezSDK{
		getLightningAddress: func() (*breez_sdk_spark.LightningAddressInfo, error) {
			return &breez_sdk_spark.LightningAddressInfo{
				LightningAddress: "existing@example.com",
				Username:         "existing",
			}, nil
		},
		checkLightningAddressAvailable: func(breez_sdk_spark.CheckLightningAddressRequest) (bool, error) {
			t.Fatal("availability should not be checked during cooldown")
			return false, nil
		},
		registerLightningAddress: func(breez_sdk_spark.RegisterLightningAddressRequest) (breez_sdk_spark.LightningAddressInfo, error) {
			t.Fatal("address should not be registered during cooldown")
			return breez_sdk_spark.LightningAddressInfo{}, nil
		},
	}

	address, err := lightning.RegisterAddress("replacement")
	require.Nil(t, address)
	require.Equal(t, errLightningAddressChangeCooldown, errp.Cause(err))
}

func TestRegisterAddressAfterCooldown(t *testing.T) {
	lightning := newTestLightning(t, nil)
	activateLightningAddressTest(t, lightning)

	now := time.Date(2026, 7, 9, 12, 0, 0, 0, time.UTC)
	withLightningAddressNow(t, now)
	lastChangedAt := now.Add(-lightningAddressChangeCooldown - time.Second)
	account := *lightning.Account()
	account.LightningAddressLastChangedAt = &lastChangedAt
	require.NoError(t, lightning.SetAccount(&account))

	var registeredUsername string
	lightning.sdkService = &testBreezSDK{
		getLightningAddress: func() (*breez_sdk_spark.LightningAddressInfo, error) {
			return &breez_sdk_spark.LightningAddressInfo{
				LightningAddress: "existing@example.com",
				Username:         "existing",
			}, nil
		},
		checkLightningAddressAvailable: func(breez_sdk_spark.CheckLightningAddressRequest) (bool, error) {
			return true, nil
		},
		registerLightningAddress: func(request breez_sdk_spark.RegisterLightningAddressRequest) (breez_sdk_spark.LightningAddressInfo, error) {
			registeredUsername = request.Username
			return breez_sdk_spark.LightningAddressInfo{
				LightningAddress: request.Username + "@example.com",
			}, nil
		},
	}

	address, err := lightning.RegisterAddress("replacement")
	require.NoError(t, err)
	require.NotNil(t, address)
	require.Equal(t, "replacement", registeredUsername)
	require.Equal(t, "replacement@example.com", *address)
	require.Equal(t, now, *lightning.Account().LightningAddressLastChangedAt)
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

func TestDepositEventsReloadPayments(t *testing.T) {
	testCases := []struct {
		name  string
		event breez_sdk_spark.SdkEvent
	}{
		{
			name: "new deposits",
			event: breez_sdk_spark.SdkEventNewDeposits{
				NewDeposits: []breez_sdk_spark.DepositInfo{{Txid: "txid"}},
			},
		},
		{
			name: "unclaimed deposits",
			event: breez_sdk_spark.SdkEventUnclaimedDeposits{
				UnclaimedDeposits: []breez_sdk_spark.DepositInfo{{Txid: "txid"}},
			},
		},
		{
			name: "claimed deposits",
			event: breez_sdk_spark.SdkEventClaimedDeposits{
				ClaimedDeposits: []breez_sdk_spark.DepositInfo{{Txid: "txid"}},
			},
		},
	}

	for _, testCase := range testCases {
		t.Run(testCase.name, func(t *testing.T) {
			lightning := newTestLightning(t, nil)
			events := make(chan observable.Event, 1)
			lightning.Observe(func(event observable.Event) {
				events <- event
			})

			lightning.OnEvent(testCase.event)

			require.Equal(t, observable.Event{
				Subject: "lightning/list-payments",
				Action:  action.Reload,
			}, <-events)
		})
	}
}
