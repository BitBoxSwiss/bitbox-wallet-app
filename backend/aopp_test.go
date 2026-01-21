// SPDX-License-Identifier: Apache-2.0

package backend

import (
	"fmt"
	"io"
	"net/http"
	"net/http/httptest"
	"net/url"
	"testing"

	accountsTypes "github.com/BitBoxSwiss/bitbox-wallet-app/backend/accounts/types"
	"github.com/BitBoxSwiss/bitbox-wallet-app/backend/coins/btc"
	coinpkg "github.com/BitBoxSwiss/bitbox-wallet-app/backend/coins/coin"
	keystoremock "github.com/BitBoxSwiss/bitbox-wallet-app/backend/keystore/mocks"
	"github.com/BitBoxSwiss/bitbox-wallet-app/backend/keystore/software"
	"github.com/BitBoxSwiss/bitbox-wallet-app/backend/signing"
	"github.com/BitBoxSwiss/bitbox-wallet-app/util/test"
	"github.com/BitBoxSwiss/bitbox02-api-go/api/firmware"
	"github.com/stretchr/testify/require"
)

const dummyMsg = "message to be signed"
const dummySignature = "signature"

const uriPrefix = "aopp:?"

func defaultParams() url.Values {
	params := url.Values{}
	params.Set("v", "0")
	params.Set("msg", dummyMsg)
	params.Set("format", "any")
	params.Set("asset", "btc")
	params.Set("callback", "http://localhost/aopp/")
	return params
}

func makeKeystore(
	t *testing.T,
	expectedScriptType *signing.ScriptType,
	keystoreHelper *software.Keystore,
) *keystoremock.KeystoreMock {
	t.Helper()

	return &keystoremock.KeystoreMock{
		NameFunc: func() (string, error) {
			return "Mock keystore", nil
		},
		RootFingerprintFunc: func() ([]byte, error) {
			return rootFingerprint1, nil
		},
		SupportsCoinFunc: func(coin coinpkg.Coin) bool {
			return true
		},
		SupportsAccountFunc: func(coin coinpkg.Coin, meta interface{}) bool {
			switch coin.(type) {
			case *btc.Coin:
				scriptType := meta.(signing.ScriptType)
				return scriptType != signing.ScriptTypeP2PKH
			default:
				return true
			}
		},
		SupportsMultipleAccountsFunc: func() bool {
			return true
		},
		CanSignMessageFunc: func(coinpkg.Code) bool {
			return true
		},
		SignBTCMessageFunc: func(message []byte, keypath signing.AbsoluteKeypath, scriptType signing.ScriptType, coin coinpkg.Code) ([]byte, error) {
			require.Equal(t, *expectedScriptType, scriptType)
			require.Equal(t, dummyMsg, string(message))
			return []byte(dummySignature), nil
		},
		SignETHMessageFunc: func(message []byte, keypath signing.AbsoluteKeypath) ([]byte, error) {
			require.Equal(t, dummyMsg, string(message))
			return []byte(dummySignature), nil
		},
		ExtendedPublicKeyFunc: keystoreHelper.ExtendedPublicKey,
		BTCXPubsFunc:          keystoreHelper.BTCXPubs,
	}
}

func scriptTypeRef(s signing.ScriptType) *signing.ScriptType { return &s }

func TestAOPPSuccess(t *testing.T) {
	// From mnemonic: wisdom minute home employ west tail liquid mad deal catalog narrow mistake
	rootKey := test.TstMustXKey("xprv9s21ZrQH143K3gie3VFLgx8JcmqZNsBcBc6vAdJrsf4bPRhx69U8qZe3EYAyvRWyQdEfz7ZpyYtL8jW2d2Lfkfh6g2zivq8JdZPQqxoxLwB")
	keystoreHelper := software.NewKeystore(rootKey)

	tests := []struct {
		asset        string
		coinCode     coinpkg.Code
		format       string
		scriptType   *signing.ScriptType
		address      string
		addressID    string
		accountCode  accountsTypes.Code
		accountName  string
		xpubRequired bool
		expectedXpub string
	}{
		{
			asset:        "btc",
			coinCode:     coinpkg.CodeBTC,
			format:       "any", // defaults to p2wpkh
			scriptType:   scriptTypeRef(signing.ScriptTypeP2WPKH),
			address:      "bc1qxp6xr63t098rl9udlynrktq00un6vqduzjgua3",
			addressID:    "9959e354fad09a47b0a5b0ac8af1b5f95924526241689b3ed7c472e79d95bde6",
			accountCode:  "v0-55555555-btc-0",
			accountName:  "Bitcoin",
			xpubRequired: true,
			expectedXpub: "xpub6Cxa67Bfe1Aw5VvLM1Ppua9x28CXH1zUYoAuBzFRjR6hWnA6aUcny84KYkeVcZWnWXxKSkxCEyMA8xic54ydBPWm5oziXpsXq6nX8FELMQn",
		},
		{
			asset:       "btc",
			coinCode:    coinpkg.CodeBTC,
			format:      "p2wpkh",
			scriptType:  scriptTypeRef(signing.ScriptTypeP2WPKH),
			address:     "bc1qxp6xr63t098rl9udlynrktq00un6vqduzjgua3",
			addressID:   "9959e354fad09a47b0a5b0ac8af1b5f95924526241689b3ed7c472e79d95bde6",
			accountCode: "v0-55555555-btc-0",
			accountName: "Bitcoin",
		},
		{
			asset:       "btc",
			coinCode:    coinpkg.CodeBTC,
			format:      "p2sh",
			scriptType:  scriptTypeRef(signing.ScriptTypeP2WPKHP2SH),
			address:     "3C4J3CSPSYD3ibV8u1DqqPRtfsUsSbnuPX",
			addressID:   "58c9954205732bcae1b9dd7eccda521ba5257749680fad3336556e0d46f68866",
			accountCode: "v0-55555555-btc-0",
			accountName: "Bitcoin",
		},
		{
			asset:        "eth",
			coinCode:     coinpkg.CodeETH,
			format:       "any",
			address:      "0xB7C853464BE7Ae39c366C9C2A9D4b95340a708c7",
			addressID:    "0xB7C853464BE7Ae39c366C9C2A9D4b95340a708c7",
			accountCode:  "v0-55555555-eth-0",
			accountName:  "Ethereum",
			xpubRequired: true,
			expectedXpub: "xpub6GP83vJASH1kS7dQPWXFjVHDfYajopbG8U3j8peBH67CRCnb8QmDxZJfWpbgCQNHAzCDJ4MyVYjoh7Yv9yo7PQuZ9YyktgrtD9vmeo67Y4E",
		},
	}

	for _, test := range tests {
		t.Run("", func(t *testing.T) {
			handler := http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
				require.Equal(t, "POST", r.Method)
				require.Equal(t,
					[]string{"application/json"},
					r.Header["Content-Type"],
				)
				body, err := io.ReadAll(r.Body)
				require.NoError(t, err)

				jsonBody := fmt.Sprintf(`{"version": 0, "address": "%s", "signature": "c2lnbmF0dXJl"}`, test.address)
				if test.xpubRequired {
					jsonBody = fmt.Sprintf(`{"version": 0, "address": "%s", "signature": "c2lnbmF0dXJl", "xpub": "%s"}`, test.address, test.expectedXpub)
				}
				require.JSONEq(t,
					jsonBody,
					string(body),
				)
				w.WriteHeader(http.StatusNoContent)
			})
			server := httptest.NewServer(handler)
			defer server.Close()

			b := newBackend(t, testnetDisabled, regtestDisabled)
			defer b.Close()

			// Add a second account so we can test the choosing-account step. If there is only one
			// account, the account is used automatically, skipping the step where the user chooses
			// the account.
			ks := makeKeystore(t, test.scriptType, keystoreHelper)
			b.registerKeystore(ks)
			_, err := b.CreateAndPersistAccountConfig(
				test.coinCode,
				"Second account",
				ks,
			)
			require.NoError(t, err)
			b.DeregisterKeystore()

			callback := server.URL
			params := defaultParams()
			params.Set("asset", test.asset)
			params.Set("format", test.format)
			params.Set("callback", callback)

			if test.xpubRequired {
				params.Set("xpub_required", "1")
			}

			require.Equal(t, AOPP{State: aoppStateInactive}, b.AOPP())
			b.HandleURI(uriPrefix + params.Encode())
			require.Equal(t,
				AOPP{
					State:        aoppStateUserApproval,
					Callback:     callback,
					Message:      dummyMsg,
					coinCode:     test.coinCode,
					format:       test.format,
					XpubRequired: test.xpubRequired,
				},
				b.AOPP(),
			)

			b.AOPPApprove()
			require.Equal(t,
				AOPP{
					State:        aoppStateAwaitingKeystore,
					Callback:     callback,
					Message:      dummyMsg,
					coinCode:     test.coinCode,
					format:       test.format,
					XpubRequired: test.xpubRequired,
				},
				b.AOPP(),
			)

			b.registerKeystore(makeKeystore(t, test.scriptType, keystoreHelper))

			require.Equal(t,
				AOPP{
					State: aoppStateChoosingAccount,
					Accounts: []account{
						{Name: test.accountName, Code: test.accountCode},
						{Name: "Second account", Code: regularAccountCode(rootFingerprint1, test.coinCode, 1)},
					},
					Callback:     callback,
					Message:      dummyMsg,
					coinCode:     test.coinCode,
					format:       test.format,
					XpubRequired: test.xpubRequired,
				},
				b.AOPP(),
			)

			b.AOPPChooseAccount(test.accountCode)
			require.Equal(t,
				AOPP{
					State: aoppStateSuccess,
					Accounts: []account{
						{Name: test.accountName, Code: test.accountCode},
						{Name: "Second account", Code: regularAccountCode(rootFingerprint1, test.coinCode, 1)},
					},
					AccountCode:  test.accountCode,
					Address:      test.address,
					AddressID:    test.addressID,
					Callback:     callback,
					Message:      dummyMsg,
					coinCode:     test.coinCode,
					format:       test.format,
					XpubRequired: test.xpubRequired,
				},
				b.AOPP(),
			)
		})
	}

	// There is only one account, so the choosing-account step is skipped.
	t.Run("one-account", func(t *testing.T) {
		server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			w.WriteHeader(http.StatusNoContent)
		}))
		defer server.Close()

		b := newBackend(t, testnetDisabled, regtestDisabled)
		defer b.Close()
		params := defaultParams()
		params.Set("callback", server.URL)
		b.HandleURI(uriPrefix + params.Encode())
		require.Equal(t, aoppStateUserApproval, b.AOPP().State)
		b.AOPPApprove()
		require.Equal(t, aoppStateAwaitingKeystore, b.AOPP().State)
		b.registerKeystore(makeKeystore(t, scriptTypeRef(signing.ScriptTypeP2WPKH), keystoreHelper))
		require.Equal(t, aoppStateSuccess, b.AOPP().State)
	})

	// Keystore is already registered before the AOPP request.
	t.Run("user-approve", func(t *testing.T) {
		server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			w.WriteHeader(http.StatusNoContent)
		}))
		defer server.Close()

		b := newBackend(t, testnetDisabled, regtestDisabled)
		defer b.Close()
		params := defaultParams()
		params.Set("callback", server.URL)
		b.registerKeystore(makeKeystore(t, scriptTypeRef(signing.ScriptTypeP2WPKH), keystoreHelper))
		b.HandleURI(uriPrefix + params.Encode())
		require.Equal(t, aoppStateUserApproval, b.AOPP().State)
		b.AOPPApprove()
		require.Equal(t, aoppStateSuccess, b.AOPP().State)
	})
	// Keystore is already registered before the AOPP request. Edge case: keystore is disconnected
	// during approval.
	t.Run("user-approve-2", func(t *testing.T) {
		b := newBackend(t, testnetDisabled, regtestDisabled)
		defer b.Close()
		params := defaultParams()
		b.registerKeystore(makeKeystore(t, scriptTypeRef(signing.ScriptTypeP2WPKH), keystoreHelper))
		b.HandleURI(uriPrefix + params.Encode())
		require.Equal(t, aoppStateUserApproval, b.AOPP().State)
		b.DeregisterKeystore()
		b.AOPPApprove()
		require.Equal(t, aoppStateAwaitingKeystore, b.AOPP().State)
	})
	//  Keystore watch-only is enabled, but the keystore is still required to sign, as its accounts are not available
	// in the AOPP flow.
	t.Run("watch-only", func(t *testing.T) {
		b := newBackend(t, testnetDisabled, regtestDisabled)
		defer b.Close()
		params := defaultParams()
		b.registerKeystore(makeKeystore(t, scriptTypeRef(signing.ScriptTypeP2WPKH), keystoreHelper))
		fingerprint, err := b.keystore.RootFingerprint()
		require.NoError(t, err)
		b.SetWatchonly(fingerprint, true)
		b.DeregisterKeystore()

		ks2 := makeKeystore(t, scriptTypeRef(signing.ScriptTypeP2WPKH), keystoreHelper)
		ks2.RootFingerprintFunc = func() ([]byte, error) {
			return rootFingerprint2, nil
		}
		b.registerKeystore(ks2)

		b.HandleURI("aopp:?" + params.Encode())
		require.Equal(t, aoppStateUserApproval, b.AOPP().State)
		b.AOPPApprove()

		for _, account := range b.AOPP().Accounts {
			ac := b.accounts.lookup(account.Code)
			require.NotNil(t, ac)
			accountFingerprint, err := ac.Config().Config.SigningConfigurations.RootFingerprint()
			require.NoError(t, err)
			require.Equal(t, accountFingerprint, rootFingerprint2)
		}
	})
}

func TestAOPPFailures(t *testing.T) {
	// From mnemonic: wisdom minute home employ west tail liquid mad deal catalog narrow mistake
	rootKey := test.TstMustXKey("xprv9s21ZrQH143K3gie3VFLgx8JcmqZNsBcBc6vAdJrsf4bPRhx69U8qZe3EYAyvRWyQdEfz7ZpyYtL8jW2d2Lfkfh6g2zivq8JdZPQqxoxLwB")
	keystoreHelper := software.NewKeystore(rootKey)
	ks := makeKeystore(t, scriptTypeRef(signing.ScriptTypeP2WPKH), keystoreHelper)

	t.Run("wrong_version", func(t *testing.T) {
		b := newBackend(t, testnetDisabled, regtestDisabled)
		defer b.Close()
		params := defaultParams()
		params.Set("v", "1")
		b.HandleURI(uriPrefix + params.Encode())
		require.Equal(t, aoppStateError, b.AOPP().State)
		require.Equal(t, errAOPPVersion, b.AOPP().ErrorCode)

	})
	t.Run("missing_callback", func(t *testing.T) {
		b := newBackend(t, testnetDisabled, regtestDisabled)
		defer b.Close()
		params := defaultParams()
		params.Del("callback")
		b.HandleURI(uriPrefix + params.Encode())
		require.Equal(t, aoppStateError, b.AOPP().State)
		require.Equal(t, errAOPPInvalidRequest, b.AOPP().ErrorCode)
	})
	t.Run("invalid_callback", func(t *testing.T) {
		b := newBackend(t, testnetDisabled, regtestDisabled)
		defer b.Close()
		params := defaultParams()
		params.Set("callback", ":not a valid url")
		b.HandleURI(uriPrefix + params.Encode())
		require.Equal(t, aoppStateError, b.AOPP().State)
		require.Equal(t, errAOPPInvalidRequest, b.AOPP().ErrorCode)
	})
	t.Run("missing_msg", func(t *testing.T) {
		b := newBackend(t, testnetDisabled, regtestDisabled)
		defer b.Close()
		params := defaultParams()
		params.Del("msg")
		b.HandleURI(uriPrefix + params.Encode())
		require.Equal(t, aoppStateError, b.AOPP().State)
		require.Equal(t, errAOPPInvalidRequest, b.AOPP().ErrorCode)
	})
	t.Run("unsupported_asset", func(t *testing.T) {
		b := newBackend(t, testnetDisabled, regtestDisabled)
		defer b.Close()
		params := defaultParams()
		params.Set("asset", "<invalid>")
		b.HandleURI(uriPrefix + params.Encode())
		require.Equal(t, aoppStateError, b.AOPP().State)
		require.Equal(t, errAOPPUnsupportedAsset, b.AOPP().ErrorCode)
	})
	t.Run("cant_sign", func(t *testing.T) {
		b := newBackend(t, testnetDisabled, regtestDisabled)
		defer b.Close()
		params := defaultParams()
		b.HandleURI(uriPrefix + params.Encode())
		b.AOPPApprove()
		ks2 := makeKeystore(t, scriptTypeRef(signing.ScriptTypeP2WPKH), keystoreHelper)
		ks2.CanSignMessageFunc = func(coinpkg.Code) bool {
			return false
		}
		b.registerKeystore(ks2)
		require.Equal(t, aoppStateError, b.AOPP().State)
		require.Equal(t, errAOPPUnsupportedKeystore, b.AOPP().ErrorCode)
	})
	t.Run("no_accounts", func(t *testing.T) {
		b := newBackend(t, testnetDisabled, regtestDisabled)
		defer b.Close()
		params := defaultParams()
		b.registerKeystore(ks)
		require.NoError(t, b.SetAccountActive("v0-55555555-btc-0", false))
		b.HandleURI(uriPrefix + params.Encode())
		b.AOPPApprove()
		require.Equal(t, aoppStateError, b.AOPP().State)
		require.Equal(t, errAOPPNoAccounts, b.AOPP().ErrorCode)
	})
	t.Run("unsupported_format", func(t *testing.T) {
		b := newBackend(t, testnetDisabled, regtestDisabled)
		defer b.Close()
		params := defaultParams()
		params.Set("format", "p2pkh")
		b.HandleURI(uriPrefix + params.Encode())
		b.AOPPApprove()
		b.registerKeystore(ks)
		require.Equal(t, aoppStateError, b.AOPP().State)
		require.Equal(t, errAOPPUnsupportedFormat, b.AOPP().ErrorCode)
	})
	t.Run("signing_aborted", func(t *testing.T) {
		b := newBackend(t, testnetDisabled, regtestDisabled)
		defer b.Close()
		params := defaultParams()
		b.HandleURI(uriPrefix + params.Encode())
		b.AOPPApprove()
		ks2 := makeKeystore(t, scriptTypeRef(signing.ScriptTypeP2WPKH), keystoreHelper)
		ks2.SignBTCMessageFunc = func([]byte, signing.AbsoluteKeypath, signing.ScriptType, coinpkg.Code) ([]byte, error) {
			return nil, firmware.NewError(firmware.ErrUserAbort, "")
		}
		b.registerKeystore(ks2)
		b.AOPPChooseAccount("v0-55555555-btc-0")
		require.Equal(t, aoppStateError, b.AOPP().State)
		require.Equal(t, errAOPPSigningAborted, b.AOPP().ErrorCode)
	})
	t.Run("callback_failed", func(t *testing.T) {
		b := newBackend(t, testnetDisabled, regtestDisabled)
		defer b.Close()

		server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			w.WriteHeader(http.StatusNotFound)
		}))
		defer server.Close()

		params := defaultParams()
		params.Set("callback", server.URL)
		b.HandleURI(uriPrefix + params.Encode())
		b.AOPPApprove()
		b.registerKeystore(ks)
		b.AOPPChooseAccount("v0-55555555-btc-0")
		require.Equal(t, aoppStateError, b.AOPP().State)
		require.Equal(t, errAOPPCallback, b.AOPP().ErrorCode)
	})
}
