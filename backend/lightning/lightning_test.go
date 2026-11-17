// SPDX-License-Identifier: Apache-2.0

package lightning

import (
	"encoding/base64"
	"errors"
	"io"
	"net/http"
	"os"
	"path/filepath"
	"strings"
	"testing"
	"testing/iotest"
	"time"

	"github.com/BitBoxSwiss/bitbox-wallet-app/backend/config"
	"github.com/BitBoxSwiss/bitbox-wallet-app/backend/keystore"
	utilconfig "github.com/BitBoxSwiss/bitbox-wallet-app/util/config"
	"github.com/BitBoxSwiss/bitbox-wallet-app/util/errp"
	"github.com/BitBoxSwiss/bitbox-wallet-app/util/observable"
	"github.com/BitBoxSwiss/bitbox-wallet-app/util/socksproxy"
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
		environment = &testEnvironment{canEncrypt: true}
	}

	return NewLightning(
		cfg,
		test.TstTempDir("lightning-data"),
		t.TempDir(),
		environment,
		func() keystore.Keystore { return nil },
		nil,
		nil,
		&http.Client{},
		socksproxy.NewSocksProxy(false, ""),
		nil,
		nil,
	)
}

func TestActivateUnavailable(t *testing.T) {
	lightning := newTestLightning(t, &testEnvironment{})

	require.EqualError(t, lightning.Activate(), "Lightning is not available in this environment")
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

func TestSDKStatusAndCheckActive(t *testing.T) {
	lightning := newTestLightning(t, nil)
	require.Equal(t, SDKStatusInactive, lightning.SDKStatus())
	require.Error(t, lightning.CheckActive())

	require.NoError(t, lightning.SetAccount(&config.LightningAccountConfig{
		Seed:            "test mnemonic",
		RootFingerprint: []byte{0xde, 0xad, 0xbe, 0xef},
		Code:            "v0-deadbeef-ln-0",
		Number:          0,
	}))
	require.Equal(t, SDKStatusInitializing, lightning.SDKStatus())
	require.Error(t, lightning.CheckActive())

	lightning.sdkService = &breez_sdk_spark.BreezSdk{}
	lightning.setSDKStatus(SDKStatusReady)
	require.Equal(t, SDKStatusReady, lightning.SDKStatus())
	require.NoError(t, lightning.CheckActive())
	require.NoError(t, lightning.SetAccount(lightning.Account()))
	require.Equal(t, SDKStatusReady, lightning.SDKStatus())

	require.NoError(t, lightning.SetAccount(nil))
	require.Equal(t, SDKStatusInactive, lightning.SDKStatus())
	require.Error(t, lightning.CheckActive())
}

func TestSDKStatusNotifications(t *testing.T) {
	lightning := newTestLightning(t, nil)
	var statuses []SDKStatus
	lightning.Observe(func(event observable.Event) {
		if event.Subject == "lightning/sdk-status" {
			statuses = append(statuses, event.Object.(SDKStatus))
		}
	})

	require.NoError(t, lightning.SetAccount(&config.LightningAccountConfig{Code: "v0-test-ln-0"}))
	lightning.setSDKStatus(SDKStatusReady)
	lightning.setSDKStatus(SDKStatusReady)
	lightning.setSDKStatus(SDKStatusFailed)
	require.NoError(t, lightning.SetAccount(nil))

	require.Equal(t, []SDKStatus{
		SDKStatusInitializing,
		SDKStatusReady,
		SDKStatusFailed,
		SDKStatusInactive,
	}, statuses)
}

func TestBalanceFailureDoesNotChangeSDKStatus(t *testing.T) {
	lightning := newTestLightning(t, nil)
	require.NoError(t, lightning.SetAccount(&config.LightningAccountConfig{Code: "v0-test-ln-0"}))
	lightning.sdkService = &testBreezSDK{
		getInfo: func(breez_sdk_spark.GetInfoRequest) (breez_sdk_spark.GetInfoResponse, error) {
			return breez_sdk_spark.GetInfoResponse{}, errors.New("get info failed")
		},
	}
	lightning.setSDKStatus(SDKStatusReady)

	_, err := lightning.Balance()
	require.Error(t, err)
	require.Equal(t, SDKStatusReady, lightning.SDKStatus())
}

func TestAddressDomain(t *testing.T) {
	require.Equal(t, "bitbox.cash", newTestLightning(t, nil).AddressDomain())
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
		sparkStatus: func(request breez_sdk_spark.GetSparkStatusRequest) (breez_sdk_spark.SparkStatus, error) {
			require.Equal(t, breez_sdk_spark.GetSparkStatusRequest{}, request)
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
		sparkStatus: func(breez_sdk_spark.GetSparkStatusRequest) (breez_sdk_spark.SparkStatus, error) {
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

type apiKeyTransport func(*http.Request) (*http.Response, error)

func (transport apiKeyTransport) RoundTrip(request *http.Request) (*http.Response, error) {
	return transport(request)
}

// Successful fetches replace the private cache file, which remains available to a new Lightning instance.
func TestBreezAPIKeyCacheRefresh(t *testing.T) {
	lightning := newTestLightning(t, nil)
	cache := utilconfig.NewFile(lightning.lightningDirectoryPath, "breez-api-key.json")
	var previousInfo os.FileInfo
	for _, key := range []string{"first-key", "updated-key"} {
		lightning.httpClient = &http.Client{
			Timeout: time.Minute,
			Transport: apiKeyTransport(func(request *http.Request) (*http.Response, error) {
				require.Equal(t, http.MethodGet, request.Method)
				require.Equal(t, breezApiKeyUrl, request.URL.String())
				return &http.Response{
					StatusCode: http.StatusOK,
					Body:       io.NopCloser(strings.NewReader(" \n" + key + "\r\n")),
				}, nil
			}),
		}
		apiKey, err := lightning.getBreezApiKey()
		require.NoError(t, err)
		require.Equal(t, key, *apiKey)
		require.Equal(t, time.Minute, lightning.httpClient.Timeout)

		var cachedKey string
		require.NoError(t, cache.ReadJSON(&cachedKey))
		require.Equal(t, key, cachedKey)
		info, err := os.Stat(cache.Path())
		require.NoError(t, err)
		require.Equal(t, os.FileMode(0600), info.Mode().Perm())
		if previousInfo != nil {
			require.False(t, os.SameFile(previousInfo, info), "cache refresh must replace the existing file")
		}
		previousInfo = info
		// Refreshing an existing cache must also tighten its permissions.
		require.NoError(t, os.Chmod(cache.Path(), 0644))
	}

	restarted := newTestLightning(t, nil)
	restarted.lightningDirectoryPath = lightning.lightningDirectoryPath
	restarted.httpClient.Transport = apiKeyTransport(func(*http.Request) (*http.Response, error) {
		return nil, errors.New("server unavailable")
	})
	apiKey, err := restarted.getBreezApiKey()
	require.NoError(t, err)
	require.Equal(t, "updated-key", *apiKey)
}

// Failed or unusable responses preserve and use the cache, or return an error without a cache.
func TestBreezAPIKeyFetchFailure(t *testing.T) {
	for _, testCase := range []struct {
		name       string
		statusCode int
		body       string
		fetchErr   error
		readErr    error
	}{
		{name: "network error", fetchErr: errors.New("server unavailable")},
		{name: "server error", statusCode: http.StatusServiceUnavailable, body: "unavailable"},
		{name: "empty response", statusCode: http.StatusOK},
		{name: "whitespace response", statusCode: http.StatusOK, body: " \r\n\t"},
		{name: "oversized response", statusCode: http.StatusOK, body: strings.Repeat("x", 4097)},
		{name: "body read error", statusCode: http.StatusOK, readErr: errors.New("connection lost")},
	} {
		t.Run(testCase.name, func(t *testing.T) {
			lightning := newTestLightning(t, nil)
			cache := utilconfig.NewFile(lightning.lightningDirectoryPath, "breez-api-key.json")
			require.NoError(t, cache.WriteJSON("cached-key"))
			lightning.httpClient.Transport = apiKeyTransport(func(*http.Request) (*http.Response, error) {
				if testCase.fetchErr != nil {
					return nil, testCase.fetchErr
				}
				var body io.Reader = strings.NewReader(testCase.body)
				if testCase.readErr != nil {
					body = iotest.ErrReader(testCase.readErr)
				}
				return &http.Response{StatusCode: testCase.statusCode, Body: io.NopCloser(body)}, nil
			})

			apiKey, err := lightning.getBreezApiKey()
			require.NoError(t, err)
			require.Equal(t, "cached-key", *apiKey)
			var cachedKey string
			require.NoError(t, cache.ReadJSON(&cachedKey))
			require.Equal(t, "cached-key", cachedKey)

			require.NoError(t, cache.Remove())
			apiKey, err = lightning.getBreezApiKey()
			require.Error(t, err)
			require.Nil(t, apiKey)
		})
	}
}

// An unavailable server cannot be bypassed with a corrupt or empty cached key.
func TestBreezAPIKeyInvalidCache(t *testing.T) {
	for _, contents := range []string{"invalid json", `""`, `" \r\n\t"`, "null"} {
		t.Run(contents, func(t *testing.T) {
			lightning := newTestLightning(t, nil)
			filename := filepath.Join(lightning.lightningDirectoryPath, "breez-api-key.json")
			require.NoError(t, os.WriteFile(filename, []byte(contents), 0600))
			fetchErr := errors.New("server unavailable")
			lightning.httpClient.Transport = apiKeyTransport(func(*http.Request) (*http.Response, error) {
				return nil, fetchErr
			})

			apiKey, err := lightning.getBreezApiKey()
			require.ErrorIs(t, err, fetchErr)
			require.Nil(t, apiKey)
		})
	}
}

// A cache write failure must not block connecting with the fresh key or leave temporary files behind.
func TestBreezAPIKeyCacheWriteFailure(t *testing.T) {
	lightning := newTestLightning(t, nil)
	filename := filepath.Join(lightning.lightningDirectoryPath, "breez-api-key.json")
	require.NoError(t, os.Mkdir(filename, 0700))
	lightning.httpClient.Transport = apiKeyTransport(func(*http.Request) (*http.Response, error) {
		return &http.Response{
			StatusCode: http.StatusOK,
			Body:       io.NopCloser(strings.NewReader("fresh-key")),
		}, nil
	})

	apiKey, err := lightning.getBreezApiKey()
	require.NoError(t, err)
	require.Equal(t, "fresh-key", *apiKey)
	entries, err := os.ReadDir(lightning.lightningDirectoryPath)
	require.NoError(t, err)
	require.Len(t, entries, 1)
}

// A stalled request is canceled after five seconds and falls back to the cached key.
func TestBreezAPIKeyTimeout(t *testing.T) {
	lightning := newTestLightning(t, nil)
	cache := utilconfig.NewFile(lightning.lightningDirectoryPath, "breez-api-key.json")
	require.NoError(t, cache.WriteJSON("cached-key"))
	lightning.httpClient.Transport = apiKeyTransport(func(request *http.Request) (*http.Response, error) {
		deadline, ok := request.Context().Deadline()
		require.True(t, ok)
		require.WithinDuration(t, time.Now().Add(5*time.Second), deadline, time.Second)
		<-request.Context().Done()
		return nil, request.Context().Err()
	})

	apiKey, err := lightning.getBreezApiKey()
	require.NoError(t, err)
	require.Equal(t, "cached-key", *apiKey)
	require.Zero(t, lightning.httpClient.Timeout)
}
