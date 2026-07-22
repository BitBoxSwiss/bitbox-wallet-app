// SPDX-License-Identifier: Apache-2.0

package handlers

import (
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"

	"github.com/stretchr/testify/require"
)

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
