// Copyright 2021 Shift Crypto AG
//
// Licensed under the Apache License, Version 2.0 (the "License");
// you may not use this file except in compliance with the License.
// You may obtain a copy of the License at
//
//      http://www.apache.org/licenses/LICENSE-2.0
//
// Unless required by applicable law or agreed to in writing, software
// distributed under the License is distributed on an "AS IS" BASIS,
// WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
// See the License for the specific language governing permissions and
// limitations under the License.

package backend

import (
	"fmt"
	"io/ioutil"
	"net/http"
	"net/http/httptest"
	"net/url"
	"testing"

	"github.com/digitalbitbox/bitbox-wallet-app/backend/accounts"
	coinpkg "github.com/digitalbitbox/bitbox-wallet-app/backend/coins/coin"
	keystoremock "github.com/digitalbitbox/bitbox-wallet-app/backend/keystore/mocks"
	"github.com/digitalbitbox/bitbox-wallet-app/backend/keystore/software"
	"github.com/digitalbitbox/bitbox-wallet-app/backend/signing"
	"github.com/stretchr/testify/require"
)

func TestAOPPSuccess(t *testing.T) {
	// From mnemonic: wisdom minute home employ west tail liquid mad deal catalog narrow mistake
	rootKey := mustXKey("xprv9s21ZrQH143K3gie3VFLgx8JcmqZNsBcBc6vAdJrsf4bPRhx69U8qZe3EYAyvRWyQdEfz7ZpyYtL8jW2d2Lfkfh6g2zivq8JdZPQqxoxLwB")
	keystoreHelper := software.NewKeystore(rootKey)
	dummySignature := []byte(`signature`)
	const dummyMsg = "message to be signed"

	ks := &keystoremock.KeystoreMock{
		RootFingerprintFunc: func() ([]byte, error) {
			return []byte{0x55, 0x055, 0x55, 0x55}, nil
		},
		SupportsAccountFunc: func(coin coinpkg.Coin, meta interface{}) bool {
			return true
		},
		SupportsUnifiedAccountsFunc: func() bool {
			return true
		},
		SupportsMultipleAccountsFunc: func() bool {
			return true
		},
		CanSignMessageFunc: func(coinpkg.Code) bool {
			return true
		},
		SignBTCMessageFunc: func(message []byte, keypath signing.AbsoluteKeypath, scriptType signing.ScriptType) ([]byte, error) {
			require.Equal(t, dummyMsg, string(message))
			return dummySignature, nil
		},
		SignETHMessageFunc: func(message []byte, keypath signing.AbsoluteKeypath) ([]byte, error) {
			require.Equal(t, dummyMsg, string(message))
			return dummySignature, nil
		},
		ExtendedPublicKeyFunc: keystoreHelper.ExtendedPublicKey,
	}

	tests := []struct {
		asset       string
		coinCode    coinpkg.Code
		format      string
		address     string
		accountCode accounts.Code
		accountName string
	}{
		{
			asset:       "btc",
			coinCode:    coinpkg.CodeBTC,
			format:      "any", // defaults to p2wpkh
			address:     "bc1qxp6xr63t098rl9udlynrktq00un6vqduzjgua3",
			accountCode: "v0-55555555-btc-0",
			accountName: "Bitcoin",
		},
		{
			asset:       "btc",
			coinCode:    coinpkg.CodeBTC,
			format:      "p2wpkh",
			address:     "bc1qxp6xr63t098rl9udlynrktq00un6vqduzjgua3",
			accountCode: "v0-55555555-btc-0",
			accountName: "Bitcoin",
		},
		{
			asset:       "btc",
			coinCode:    coinpkg.CodeBTC,
			format:      "p2sh",
			address:     "3C4J3CSPSYD3ibV8u1DqqPRtfsUsSbnuPX",
			accountCode: "v0-55555555-btc-0",
			accountName: "Bitcoin",
		},
		{
			asset:       "eth",
			coinCode:    coinpkg.CodeETH,
			format:      "any",
			address:     "0xB7C853464BE7Ae39c366C9C2A9D4b95340a708c7",
			accountCode: "v0-55555555-eth-0",
			accountName: "Ethereum",
		},
	}

	for _, test := range tests {
		test := test
		t.Run("", func(t *testing.T) {
			server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
				require.Equal(t, "POST", r.Method)
				require.Equal(t,
					[]string{"application/json"},
					r.Header["Content-Type"],
				)
				body, err := ioutil.ReadAll(r.Body)
				require.NoError(t, err)

				require.JSONEq(t,
					fmt.Sprintf(`{"version": 0, "address": "%s", "signature": "c2lnbmF0dXJl"}`, test.address),
					string(body),
				)
				w.WriteHeader(http.StatusNoContent)
			}))
			defer server.Close()

			b := newBackend(t, testnetDisabled, regtestDisabled)
			defer b.Close()

			callback := server.URL
			aoppURI := fmt.Sprintf(
				"aopp:?v=0&msg=%s&asset=%s&format=%s&callback=%s",
				dummyMsg, test.asset, test.format, callback)

			callbackURL, err := url.Parse(callback)
			require.NoError(t, err)
			callbackHost := callbackURL.Host

			require.Equal(t, AOPP{State: aoppStateInactive}, b.AOPP())
			b.HandleURI(aoppURI)
			require.Equal(t,
				AOPP{
					State:        aoppStateAwaitingKeystore,
					CallbackHost: callbackHost,
					coinCode:     test.coinCode,
					format:       test.format,
					message:      dummyMsg,
					callback:     callback,
				},
				b.AOPP(),
			)

			b.registerKeystore(ks)

			require.Equal(t,
				AOPP{
					State:        aoppStateChoosingAccount,
					Accounts:     []account{{Name: test.accountName, Code: test.accountCode}},
					CallbackHost: callbackHost,
					coinCode:     test.coinCode,
					format:       test.format,
					message:      dummyMsg,
					callback:     callback,
				},
				b.AOPP(),
			)

			b.AOPPChooseAccount(test.accountCode)
			require.Equal(t,
				AOPP{
					State:        aoppStateSuccess,
					Accounts:     []account{{Name: test.accountName, Code: test.accountCode}},
					Address:      test.address,
					CallbackHost: callbackHost,
					coinCode:     test.coinCode,
					format:       test.format,
					message:      dummyMsg,
					callback:     callback,
				},
				b.AOPP(),
			)
		})
	}
}
