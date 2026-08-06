// SPDX-License-Identifier: Apache-2.0

package handlers

import (
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"

	"github.com/ethereum/go-ethereum/common"
	"github.com/stretchr/testify/require"
)

func validWalletConnectTransactionRequest() walletConnectTransactionRequest {
	return walletConnectTransactionRequest{
		From:  "0x1111111111111111111111111111111111111111",
		To:    "0xa29163852021BF4C139D03Dff59ae763AC73e84e",
		Data:  "0xdeadbeef",
		Value: "0x2a",
		Nonce: "0x7",
	}
}

func TestParseWalletConnectTransactionRequest(t *testing.T) {
	for _, test := range []struct {
		name    string
		chainID json.RawMessage
	}{
		{name: "chain ID omitted"},
		{name: "chain ID matches request", chainID: json.RawMessage(`"0xa"`)},
	} {
		t.Run(test.name, func(t *testing.T) {
			request := validWalletConnectTransactionRequest()
			request.ChainID = test.chainID

			transaction, err := parseWalletConnectTransactionRequest(10, request)

			require.NoError(t, err)
			require.Equal(t, common.HexToAddress(request.From), transaction.From)
			require.Equal(t, common.HexToAddress(request.To), transaction.Recipient)
			require.Equal(t, request.To, transaction.RecipientAddress)
			require.Equal(t, []byte{0xde, 0xad, 0xbe, 0xef}, transaction.Data)
			require.Equal(t, "42", transaction.Value.String())
			require.NotNil(t, transaction.Nonce)
			require.Equal(t, uint64(7), *transaction.Nonce)
		})
	}
}

func TestParseWalletConnectTransactionRequestRejectsInvalidWireValues(t *testing.T) {
	for _, test := range []struct {
		name          string
		modifyRequest func(*walletConnectTransactionRequest)
		expectedError string
	}{
		{
			name: "input alias",
			modifyRequest: func(request *walletConnectTransactionRequest) {
				request.Input = json.RawMessage(`"0x1234"`)
			},
			expectedError: "transaction input field is unsupported; use data",
		},
		{
			name: "mismatched embedded chain ID",
			modifyRequest: func(request *walletConnectTransactionRequest) {
				request.ChainID = json.RawMessage(`"0x1"`)
			},
			expectedError: "transaction chain ID does not match request chain",
		},
		{
			name: "invalid embedded chain ID",
			modifyRequest: func(request *walletConnectTransactionRequest) {
				request.ChainID = json.RawMessage(`null`)
			},
			expectedError: "json: cannot unmarshal non-string into Go value of type hexutil.Uint64",
		},
		{
			name: "invalid sender",
			modifyRequest: func(request *walletConnectTransactionRequest) {
				request.From = "invalid"
			},
			expectedError: "invalidAddress",
		},
		{
			name: "contract creation",
			modifyRequest: func(request *walletConnectTransactionRequest) {
				request.To = ""
			},
			expectedError: "invalidAddress",
		},
		{
			name: "invalid nonce",
			modifyRequest: func(request *walletConnectTransactionRequest) {
				request.Nonce = "0xzz"
			},
			expectedError: "strconv.ParseUint: parsing \"zz\": invalid syntax",
		},
		{
			name: "invalid value",
			modifyRequest: func(request *walletConnectTransactionRequest) {
				request.Value = "0xzz"
			},
			expectedError: "error setting transaction value",
		},
		{
			name: "invalid data",
			modifyRequest: func(request *walletConnectTransactionRequest) {
				request.Data = "0xzz"
			},
			expectedError: "encoding/hex: invalid byte: U+007A 'z'",
		},
	} {
		t.Run(test.name, func(t *testing.T) {
			request := validWalletConnectTransactionRequest()
			test.modifyRequest(&request)

			_, err := parseWalletConnectTransactionRequest(10, request)

			require.EqualError(t, err, test.expectedError)
		})
	}
}

func TestWalletConnectSigningHandlersRequireChainID(t *testing.T) {
	for _, test := range []struct {
		name    string
		body    string
		handler func(*Handlers, *http.Request) (interface{}, error)
	}{
		{
			name:    "typed message omitted",
			body:    `{"data":"{}"}`,
			handler: (*Handlers).postEthSignTypedMsg,
		},
		{
			name:    "typed message null",
			body:    `{"chainId":null,"data":"{}"}`,
			handler: (*Handlers).postEthSignTypedMsg,
		},
		{
			name:    "transaction omitted",
			body:    `{"tx":{}}`,
			handler: (*Handlers).postEthSignWalletConnectTx,
		},
		{
			name:    "transaction null",
			body:    `{"chainId":null,"tx":{}}`,
			handler: (*Handlers).postEthSignWalletConnectTx,
		},
	} {
		t.Run(test.name, func(t *testing.T) {
			request := httptest.NewRequest(http.MethodPost, "/", strings.NewReader(test.body))
			response, err := test.handler(&Handlers{}, request)

			require.NoError(t, err)
			require.Equal(t, signingResponse{
				Success:      false,
				ErrorMessage: "chainId is required",
			}, response)
		})
	}
}
