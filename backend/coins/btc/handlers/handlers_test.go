// SPDX-License-Identifier: Apache-2.0

package handlers

import (
	"bytes"
	"encoding/json"
	"errors"
	"net/http"
	"net/http/httptest"
	"strconv"
	"testing"
	"time"

	"github.com/BitBoxSwiss/bitbox-wallet-app/backend"
	"github.com/BitBoxSwiss/bitbox-wallet-app/backend/accounts"
	accountsmocks "github.com/BitBoxSwiss/bitbox-wallet-app/backend/accounts/mocks"
	"github.com/BitBoxSwiss/bitbox-wallet-app/backend/coins/btc"
	coinpkg "github.com/BitBoxSwiss/bitbox-wallet-app/backend/coins/coin"
	coinmocks "github.com/BitBoxSwiss/bitbox-wallet-app/backend/coins/coin/mocks"
	"github.com/BitBoxSwiss/bitbox-wallet-app/backend/keystore"
	"github.com/BitBoxSwiss/bitbox-wallet-app/backend/rates"
	"github.com/BitBoxSwiss/bitbox-wallet-app/backend/signing"
	"github.com/stretchr/testify/require"
)

type usedAddressesAccountMock struct {
	*accountsmocks.InterfaceMock
	usedAddresses    []btc.UsedAddress
	usedAddressesErr error
}

func (mock *usedAddressesAccountMock) GetUsedAddresses() ([]btc.UsedAddress, error) {
	return mock.usedAddresses, mock.usedAddressesErr
}

func newCoinMock() *coinmocks.CoinMock {
	return &coinmocks.CoinMock{
		FormatAmountFunc: func(amount coinpkg.Amount, _ bool) string {
			value, err := amount.Int64()
			if err != nil {
				return ""
			}
			return strconv.FormatInt(value, 10)
		},
		GetFormatUnitFunc: func(bool) string {
			return "BTC"
		},
		UnitFunc: func(bool) string {
			return "BTC"
		},
	}
}

func TestGetUsedAddressesIncludesAdditiveFieldsAndLastUsedSerialization(t *testing.T) {
	timestamp := time.Date(2025, 2, 3, 4, 5, 6, 0, time.UTC)
	nativeSegwit := signing.ScriptTypeP2WPKH
	wrappedSegwit := signing.ScriptTypeP2WPKHP2SH
	usedAddresses := []btc.UsedAddress{
		{
			Address:          "bc1qusedreceiveaddress",
			AddressID:        "receive-id",
			ScriptType:       &nativeSegwit,
			AddressType:      btc.UsedAddressTypeReceive,
			LastUsed:         &timestamp,
			TotalReceived:    coinpkg.NewAmountFromInt64(1234),
			TransactionCount: 2,
		},
		{
			Address:          "3usedchangeaddress",
			AddressID:        "change-id",
			ScriptType:       &wrappedSegwit,
			AddressType:      btc.UsedAddressTypeChange,
			LastUsed:         nil,
			TotalReceived:    coinpkg.NewAmountFromInt64(42),
			TransactionCount: 1,
		},
	}

	accountConfig := &accounts.AccountConfig{
		RateUpdater: rates.NewRateUpdater(nil, t.TempDir()),
	}
	accountMock := &usedAddressesAccountMock{
		InterfaceMock: &accountsmocks.InterfaceMock{
			CoinFunc: func() coinpkg.Coin {
				return newCoinMock()
			},
			ConfigFunc: func() *accounts.AccountConfig {
				return accountConfig
			},
		},
		usedAddresses: usedAddresses,
	}

	handlers := &Handlers{
		account: accountMock,
	}

	response, err := handlers.getUsedAddresses(nil)
	require.NoError(t, err)

	responseBytes, err := json.Marshal(response)
	require.NoError(t, err)

	var payload struct {
		Success   bool `json:"success"`
		Addresses []struct {
			Address          string                                 `json:"address"`
			AddressID        string                                 `json:"addressID"`
			ScriptType       *signing.ScriptType                    `json:"scriptType"`
			AddressType      btc.UsedAddressType                    `json:"addressType"`
			LastUsed         *string                                `json:"lastUsed"`
			TotalReceived    coinpkg.FormattedAmountWithConversions `json:"totalReceived"`
			TransactionCount int                                    `json:"transactionCount"`
		} `json:"addresses"`
	}
	require.NoError(t, json.Unmarshal(responseBytes, &payload))

	require.True(t, payload.Success)
	require.Len(t, payload.Addresses, 2)

	first := payload.Addresses[0]
	require.Equal(t, usedAddresses[0].Address, first.Address)
	require.Equal(t, usedAddresses[0].AddressID, first.AddressID)
	require.Equal(t, usedAddresses[0].ScriptType, first.ScriptType)
	require.Equal(t, usedAddresses[0].AddressType, first.AddressType)
	require.NotNil(t, first.LastUsed)
	require.Equal(t, timestamp.Format(time.RFC3339), *first.LastUsed)
	require.Equal(t, "1234", first.TotalReceived.Amount)
	require.Equal(t, "BTC", first.TotalReceived.Unit)
	require.Equal(t, usedAddresses[0].TransactionCount, first.TransactionCount)

	second := payload.Addresses[1]
	require.Equal(t, usedAddresses[1].Address, second.Address)
	require.Equal(t, usedAddresses[1].AddressID, second.AddressID)
	require.Equal(t, usedAddresses[1].ScriptType, second.ScriptType)
	require.Equal(t, usedAddresses[1].AddressType, second.AddressType)
	require.Nil(t, second.LastUsed)
	require.Equal(t, "42", second.TotalReceived.Amount)
	require.Equal(t, "BTC", second.TotalReceived.Unit)
	require.Equal(t, usedAddresses[1].TransactionCount, second.TransactionCount)
}

func TestGetUsedAddressesReturnsSuccessFalseOnProviderError(t *testing.T) {
	accountConfig := &accounts.AccountConfig{
		RateUpdater: rates.NewRateUpdater(nil, t.TempDir()),
	}
	accountMock := &usedAddressesAccountMock{
		InterfaceMock: &accountsmocks.InterfaceMock{
			CoinFunc: func() coinpkg.Coin {
				return newCoinMock()
			},
			ConfigFunc: func() *accounts.AccountConfig {
				return accountConfig
			},
		},
		usedAddressesErr: errors.New("boom"),
	}

	handlers := &Handlers{
		account: accountMock,
	}

	response, err := handlers.getUsedAddresses(nil)
	require.NoError(t, err)

	responseBytes, err := json.Marshal(response)
	require.NoError(t, err)

	var payload struct {
		Success   bool   `json:"success"`
		ErrorCode string `json:"errorCode"`
	}
	require.NoError(t, json.Unmarshal(responseBytes, &payload))
	require.False(t, payload.Success)
	require.Equal(t, "loadFailed", payload.ErrorCode)
}

func TestGetUsedAddressesReturnsSyncInProgressErrorCode(t *testing.T) {
	accountConfig := &accounts.AccountConfig{
		RateUpdater: rates.NewRateUpdater(nil, t.TempDir()),
	}
	accountMock := &usedAddressesAccountMock{
		InterfaceMock: &accountsmocks.InterfaceMock{
			CoinFunc: func() coinpkg.Coin {
				return newCoinMock()
			},
			ConfigFunc: func() *accounts.AccountConfig {
				return accountConfig
			},
		},
		usedAddressesErr: accounts.ErrSyncInProgress,
	}

	handlers := &Handlers{
		account: accountMock,
	}

	response, err := handlers.getUsedAddresses(nil)
	require.NoError(t, err)

	responseBytes, err := json.Marshal(response)
	require.NoError(t, err)

	var payload struct {
		Success   bool   `json:"success"`
		ErrorCode string `json:"errorCode"`
	}
	require.NoError(t, json.Unmarshal(responseBytes, &payload))
	require.False(t, payload.Success)
	require.Equal(t, accounts.ErrSyncInProgress.Error(), payload.ErrorCode)
}

type ethSignMessageAccountMock struct {
	*accountsmocks.InterfaceMock
	signETHMessageFunc func(string) (string, string, error)
}

func (mock *ethSignMessageAccountMock) SignETHMessage(message string) (string, string, error) {
	return mock.signETHMessageFunc(message)
}

type btcSignMessageAccountMock struct {
	*accountsmocks.InterfaceMock
	signBTCMessageFunc func(string, string) (string, string, error)
}

func (mock *btcSignMessageAccountMock) SignBTCMessage(addressID string, message string) (string, string, error) {
	return mock.signBTCMessageFunc(addressID, message)
}

func newSignAddressRequest(
	t *testing.T,
	addressID string,
	message string,
	format signing.ScriptType,
) *http.Request {
	t.Helper()
	requestBody := struct {
		AddressID string             `json:"addressID,omitempty"`
		Msg       string             `json:"msg"`
		Format    signing.ScriptType `json:"format,omitempty"`
	}{
		AddressID: addressID,
		Msg:       message,
		Format:    format,
	}
	requestBodyBytes, err := json.Marshal(requestBody)
	require.NoError(t, err)
	return httptest.NewRequest(http.MethodPost, "/sign-address", bytes.NewReader(requestBodyBytes))
}

func decodeSignAddressResponse(
	t *testing.T,
	response interface{},
) struct {
	Success      bool   `json:"success"`
	Address      string `json:"address"`
	Signature    string `json:"signature"`
	ErrorMessage string `json:"errorMessage"`
	ErrorCode    string `json:"errorCode"`
} {
	t.Helper()
	responseBytes, err := json.Marshal(response)
	require.NoError(t, err)
	var payload struct {
		Success      bool   `json:"success"`
		Address      string `json:"address"`
		Signature    string `json:"signature"`
		ErrorMessage string `json:"errorMessage"`
		ErrorCode    string `json:"errorCode"`
	}
	require.NoError(t, json.Unmarshal(responseBytes, &payload))
	return payload
}

func TestPostSignBTCAddressUsesETHSigner(t *testing.T) {
	var receivedMessage string
	account := &ethSignMessageAccountMock{
		InterfaceMock: &accountsmocks.InterfaceMock{},
		signETHMessageFunc: func(message string) (string, string, error) {
			receivedMessage = message
			return "0xabc", "0xsigned", nil
		},
	}
	handlers := &Handlers{account: account}

	response, err := handlers.postSignBTCAddress(newSignAddressRequest(t, "ignored-address-id", "hello eth", ""))
	require.NoError(t, err)
	payload := decodeSignAddressResponse(t, response)

	require.Equal(t, "hello eth", receivedMessage)
	require.True(t, payload.Success)
	require.Equal(t, "0xabc", payload.Address)
	require.Equal(t, "0xsigned", payload.Signature)
}

func TestPostSignBTCAddressUsesAddressIDSigner(t *testing.T) {
	var receivedAddressID string
	var receivedMessage string
	account := &btcSignMessageAccountMock{
		InterfaceMock: &accountsmocks.InterfaceMock{},
		signBTCMessageFunc: func(addressID string, message string) (string, string, error) {
			receivedAddressID = addressID
			receivedMessage = message
			return "bc1qusedaddress", "signed", nil
		},
	}
	handlers := &Handlers{account: account}

	response, err := handlers.postSignBTCAddress(newSignAddressRequest(t, "address-id", "hello btc", ""))
	require.NoError(t, err)
	payload := decodeSignAddressResponse(t, response)

	require.Equal(t, "address-id", receivedAddressID)
	require.Equal(t, "hello btc", receivedMessage)
	require.True(t, payload.Success)
	require.Equal(t, "bc1qusedaddress", payload.Address)
	require.Equal(t, "signed", payload.Signature)
}

func TestPostSignBTCAddressFallsBackToLegacySignerWhenAddressIDEmpty(t *testing.T) {
	originalSignBTCAddressFn := signBTCAddressFn
	defer func() { signBTCAddressFn = originalSignBTCAddressFn }()

	var receivedMessage string
	var receivedFormat signing.ScriptType
	signBTCAddressFn = func(account accounts.Interface, message string, format signing.ScriptType) (string, string, error) {
		receivedMessage = message
		receivedFormat = format
		return "bc1qlegacyaddress", "legacy-signature", nil
	}

	handlers := &Handlers{account: &accountsmocks.InterfaceMock{}}

	response, err := handlers.postSignBTCAddress(
		newSignAddressRequest(t, "", "legacy message", signing.ScriptTypeP2WPKH),
	)
	require.NoError(t, err)
	payload := decodeSignAddressResponse(t, response)

	require.Equal(t, "legacy message", receivedMessage)
	require.Equal(t, signing.ScriptTypeP2WPKH, receivedFormat)
	require.True(t, payload.Success)
	require.Equal(t, "bc1qlegacyaddress", payload.Address)
	require.Equal(t, "legacy-signature", payload.Signature)
}

func TestPostSignBTCAddressMapsKnownErrors(t *testing.T) {
	tests := []struct {
		name              string
		signErr           error
		expectedErrorCode string
	}{
		{
			name:              "wrong keystore",
			signErr:           backend.ErrWrongKeystore,
			expectedErrorCode: backend.ErrWrongKeystore.Error(),
		},
		{
			name:              "signing aborted",
			signErr:           keystore.ErrSigningAborted,
			expectedErrorCode: "userAbort",
		},
	}

	for _, test := range tests {
		t.Run(test.name, func(t *testing.T) {
			account := &btcSignMessageAccountMock{
				InterfaceMock: &accountsmocks.InterfaceMock{},
				signBTCMessageFunc: func(addressID string, message string) (string, string, error) {
					return "", "", test.signErr
				},
			}
			handlers := &Handlers{account: account}

			response, err := handlers.postSignBTCAddress(newSignAddressRequest(t, "address-id", "message", ""))
			require.NoError(t, err)
			payload := decodeSignAddressResponse(t, response)

			require.False(t, payload.Success)
			require.Equal(t, test.expectedErrorCode, payload.ErrorCode)
		})
	}
}
