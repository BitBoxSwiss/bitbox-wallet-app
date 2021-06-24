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
	const expectedAddress = "bc1qxp6xr63t098rl9udlynrktq00un6vqduzjgua3"

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
		ExtendedPublicKeyFunc: keystoreHelper.ExtendedPublicKey,
	}

	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		require.Equal(t, "POST", r.Method)
		require.Equal(t,
			[]string{"application/json"},
			r.Header["Content-Type"],
		)
		body, err := ioutil.ReadAll(r.Body)
		require.NoError(t, err)

		require.JSONEq(t,
			fmt.Sprintf(`{"version": 0, "address": "%s", "signature": "c2lnbmF0dXJl"}`, expectedAddress),
			string(body),
		)
		w.WriteHeader(http.StatusNoContent)
	}))
	defer server.Close()

	b := newBackend(t, testnetDisabled, regtestDisabled)
	defer b.Close()

	callback := server.URL
	aoppURI := fmt.Sprintf("aopp:?v=0&msg=%s&asset=btc&format=any&callback=%s", dummyMsg, callback)

	callbackURL, err := url.Parse(callback)
	require.NoError(t, err)
	callbackHost := callbackURL.Host

	require.Equal(t, AOPP{State: aoppStateInactive}, b.AOPP())
	b.HandleURI(aoppURI)
	require.Equal(t,
		AOPP{
			State:        aoppStateAwaitingKeystore,
			CallbackHost: callbackHost,
			coinCode:     coinpkg.CodeBTC,
			message:      dummyMsg,
			callback:     callback,
		},
		b.AOPP(),
	)

	b.registerKeystore(ks)

	require.Equal(t,
		AOPP{
			State:        aoppStateChoosingAccount,
			Accounts:     []account{{Name: "Bitcoin", Code: "v0-55555555-btc-0"}},
			CallbackHost: callbackHost,
			coinCode:     coinpkg.CodeBTC,
			message:      dummyMsg,
			callback:     callback,
		},
		b.AOPP(),
	)

	b.AOPPChooseAccount("v0-55555555-btc-0")
	require.Equal(t,
		AOPP{
			State:        aoppStateSuccess,
			Accounts:     []account{{Name: "Bitcoin", Code: "v0-55555555-btc-0"}},
			Address:      expectedAddress,
			CallbackHost: callbackHost,
			coinCode:     coinpkg.CodeBTC,
			message:      dummyMsg,
			callback:     callback,
		},
		b.AOPP(),
	)
}
