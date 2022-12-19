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
	"bytes"
	"encoding/json"
	"net/http"
	"net/url"
	"strings"

	"github.com/digitalbitbox/bitbox-wallet-app/backend/accounts"
	coinpkg "github.com/digitalbitbox/bitbox-wallet-app/backend/coins/coin"
	"github.com/digitalbitbox/bitbox-wallet-app/backend/signing"
	"github.com/digitalbitbox/bitbox-wallet-app/util/observable"
	"github.com/digitalbitbox/bitbox-wallet-app/util/observable/action"
	"github.com/digitalbitbox/bitbox02-api-go/api/firmware"
)

// aoppCoinMap maps from the asset codes specified by AOPP to our own coin codes.
var aoppCoinMap = map[string]coinpkg.Code{
	"btc": coinpkg.CodeBTC,
	"eth": coinpkg.CodeETH,
}

// aoppBTCScriptTypeMap maps from format codes specified by AOPP to our own script type codes. See
// https://gitlab.com/aopp/address-ownership-proof-protocol/-/blob/450e0446528885109c46e62e8220d869795127a5/README.md#specification
var aoppBTCScriptTypeMap = map[string]signing.ScriptType{
	"p2pkh":  signing.ScriptTypeP2PKH,
	"p2wpkh": signing.ScriptTypeP2WPKH,
	"p2sh":   signing.ScriptTypeP2WPKHP2SH,
}

type account struct {
	Name string        `json:"name"`
	Code accounts.Code `json:"code"`
}

// aoppState is the current state of an AOPP request. See The values below.
type aoppState string

const (
	// The states progress linearly from top to bottom starting at aoppStateInactive. In case of
	// error, the state goes to aoppStateError.

	// Something went wrong. The frontend is to display an error message based on the `ErrorCode`.
	aoppStateError aoppState = "error"

	// Nothing is happening, we are waiting for an AOPP request.
	aoppStateInactive aoppState = "inactive"
	// The user is prompted to continue or cancel a new AOPP request. This is always the first state
	// when a new AOPP request is is handled.
	aoppStateUserApproval aoppState = "user-approval"
	// No keystore is connected, so we are waiting for the user to insert and unlock their
	// device. This state is skipped if a keystore already exists.
	aoppStateAwaitingKeystore aoppState = "awaiting-keystore"
	// Keystore is registered - the user chooses an account from which to get a receive address
	// from.
	aoppStateChoosingAccount aoppState = "choosing-account"
	// The account is still syncing - need to wait for that to finish before we can get a fresh
	// address.
	aoppStateSyncing aoppState = "syncing"
	// The user is prompted to confirm and sign the address on the device.
	aoppStateSigning aoppState = "signing"
	// Everything went well, the address and signature was delievered to the AOPP callback.
	aoppStateSuccess aoppState = "success"
)

// AOPP holds all the state needed to process an AOPP (Address Ownership Proof Protocol) request.
type AOPP struct {
	// State is the current state the request is in. See `aoppState*` for the possible values.
	State aoppState `json:"state"`
	// ErrorCode is an "aopp*" error code, see errors.go. Only applies if State == aoppStateError.
	ErrorCode ErrorCode `json:"errorCode"`
	// Accounts is the list of accounts the user can choose from. Only applies if State == aoppStateChoosingAccount.
	Accounts []account `json:"accounts"`
	// AccountCode is the code of the chosen account from which an address will be taken. Only
	// applies for states after (and excluding) `aoppStateChoosingAccount`.
	AccountCode accounts.Code `json:"accountCode"`
	// Address that will be delivered to the requesting party via the callback. Only applies if
	// State == aoppStateSigning or aoppStateSuccess.
	Address string `json:"address"`
	// AddressID is the ID of the address, used to display the address on the device. Only applies
	// if State == aoppStateSigning or aoppStateSuccess
	AddressID string `json:"addressID"`
	// Callback contains the AOPP callback URL. Available for all states except aoppStateInactive.
	Callback string `json:"callback"`
	// Message is the requested message to be signed. Available for all states except
	// aoppStateInactive.
	Message string `json:"message"`
	// coinCode is the requested asset. Available for all states except aoppStateInactive.
	coinCode coinpkg.Code
	// format is the requested format. Available for all states except aoppStateInactive.
	format string
}

// AOPP returns the current AOPP state.
func (backend *Backend) AOPP() AOPP {
	defer backend.accountsAndKeystoreLock.RLock()()
	return backend.aopp
}

// notifyAOPP sends the aopp state to the frontend. `accountsAndKeystoreLock` must be held when
// calling this function.
func (backend *Backend) notifyAOPP() {
	backend.Notify(observable.Event{
		Subject: "aopp",
		Action:  action.Replace,
		Object:  backend.aopp,
	})
}

// AOPPCancel resets the aopp state.
func (backend *Backend) AOPPCancel() {
	defer backend.accountsAndKeystoreLock.Lock()()
	backend.aopp = AOPP{State: aoppStateInactive}
	backend.notifyAOPP()
}

// aoppSetError pushes an error to the frontend to display. `accountsAndKeystoreLock` must be held
// when calling this function.
func (backend *Backend) aoppSetError(err ErrorCode) {
	backend.aopp.State = aoppStateError
	backend.aopp.ErrorCode = err
	backend.notifyAOPP()
}

// aoppKeystoreRegistered must be called after a keystore is available, to display a list of
// accounts to choose from. It is called when a keystore is registered, or right away in
// `handleAOPP()` if a keystore is already registered. `accountsAndKeystoreLock` must be held when
// calling this function.
func (backend *Backend) aoppKeystoreRegistered() {
	if backend.aopp.State != aoppStateAwaitingKeystore {
		return
	}
	if !backend.keystore.CanSignMessage(backend.aopp.coinCode) {
		backend.aoppSetError(errAOPPUnsupportedKeystore)
		return
	}
	var accounts []account
	var filteredDueToScriptType bool
	for _, acct := range backend.accounts {
		if !acct.Config().Active {
			continue
		}
		if acct.Coin().Code() != backend.aopp.coinCode {
			continue
		}
		// Filter for the requested script type.
		if acct.Coin().Code() == coinpkg.CodeBTC && backend.aopp.format != "any" {
			expectedScriptType, ok := aoppBTCScriptTypeMap[backend.aopp.format]
			if !ok || acct.Config().SigningConfigurations.FindScriptType(expectedScriptType) == -1 {
				filteredDueToScriptType = true
				continue
			}
		}
		accounts = append(accounts, account{
			Name: acct.Config().Name,
			Code: acct.Config().Code,
		})
	}

	if len(accounts) == 0 {
		if filteredDueToScriptType {
			backend.aoppSetError(errAOPPUnsupportedFormat)
		} else {
			backend.aoppSetError(errAOPPNoAccounts)
		}
		return
	}

	backend.aopp.Accounts = accounts
	backend.aopp.State = aoppStateChoosingAccount

	// Automatically use the account if there is only one, skipping the step where the user has to
	// select it manually.
	if len(accounts) == 1 {
		backend.aoppChooseAccount(accounts[0].Code)
		return
	}

	backend.notifyAOPP()
}

// handleAOPP handles an AOPP (Address Ownership Proof Protocol) request. See https://aopp.group/.
func (backend *Backend) handleAOPP(uri url.URL) {
	defer backend.accountsAndKeystoreLock.Lock()()

	backend.aopp = AOPP{State: aoppStateInactive}

	log := backend.log.WithField("aopp-uri", uri.String())
	q := uri.Query()
	backend.aopp.Callback = ""

	if q.Get("v") != "0" {
		log.Error("Can only handle version 0 aopp URIs")
		backend.aoppSetError(errAOPPVersion)
		return
	}

	callback := q.Get("callback")
	if callback == "" {
		log.Error("callback param missing")
		backend.aoppSetError(errAOPPInvalidRequest)
		return
	}
	_, err := url.Parse(callback)
	if err != nil {
		log.WithError(err).Error("Invalid callback")
		backend.aoppSetError(errAOPPInvalidRequest)
		return
	}
	backend.aopp.Callback = callback

	coinCode, ok := aoppCoinMap[strings.ToLower(q.Get("asset"))]
	if !ok {
		log.Error("Unrecognized coin")
		backend.aoppSetError(errAOPPUnsupportedAsset)
		return
	}
	backend.aopp.coinCode = coinCode

	msg := q.Get("msg")
	if msg == "" {
		log.Error("msg param missing")
		backend.aoppSetError(errAOPPInvalidRequest)
		return
	}
	backend.aopp.Message = msg

	backend.aopp.format = q.Get("format")

	backend.aopp.State = aoppStateUserApproval
	backend.notifyAOPP()
}

// AOPPApprove is called when the user approves the AOPP request, moving the state from
// `aoppStateUserApproval` to either `aoppStateAwaitingKeystore` or `aoppStateChoosingAccount`
// depending on if there is a keystore.
func (backend *Backend) AOPPApprove() {
	defer backend.accountsAndKeystoreLock.Lock()()
	if backend.aopp.State != aoppStateUserApproval {
		return
	}
	backend.aopp.State = aoppStateAwaitingKeystore
	if backend.keystore == nil {
		backend.notifyAOPP()
		return
	}
	backend.aoppKeystoreRegistered()
}

// aoppChooseAccount is called when an AOPP request is being processed and an account should be
// selected. `accountsAndKeystoreLock` must be held when calling this function.
func (backend *Backend) aoppChooseAccount(code accounts.Code) {
	if backend.aopp.State != aoppStateChoosingAccount {
		return
	}

	backend.aopp.AccountCode = code
	backend.aopp.State = aoppStateSyncing
	backend.notifyAOPP()

	log := backend.log.WithField("accountCode", code)
	var account accounts.Interface
	for _, acct := range backend.accounts {
		if acct.Config().Code == code {
			account = acct
			break
		}
	}
	if account == nil {
		log.Error("aopp: could not find account")
		backend.aoppSetError(errAOPPUnknown)
		return
	}
	if err := account.Initialize(); err != nil {
		log.
			WithError(err).
			WithField("code", account.Config().Code).
			Error("could not initialize account")
		backend.aoppSetError(errAOPPUnknown)
		return
	}

	unused := account.GetUnusedReceiveAddresses()

	signingConfigIdx := 0
	// Use the format hint to get a compatible address.
	if account.Coin().Code() == coinpkg.CodeBTC && backend.aopp.format != "any" {
		expectedScriptType, ok := aoppBTCScriptTypeMap[backend.aopp.format]
		if !ok {
			log.Errorf("Unknown aopp format param %s", backend.aopp.format)
			backend.aoppSetError(errAOPPUnknown)
			return
		}
		signingConfigIdx = account.Config().SigningConfigurations.FindScriptType(expectedScriptType)
		if signingConfigIdx == -1 {
			log.Errorf("Unknown aopp format param %s", backend.aopp.format)
			backend.aoppSetError(errAOPPUnknown)
			return
		}
	}
	addr := unused[signingConfigIdx].Addresses[0]

	backend.aopp.Address = addr.EncodeForHumans()
	backend.aopp.AddressID = addr.ID()
	backend.aopp.State = aoppStateSigning
	backend.notifyAOPP()

	var signature []byte
	switch account.Coin().Code() {
	case coinpkg.CodeBTC:
		sig, err := backend.keystore.SignBTCMessage(
			[]byte(backend.aopp.Message),
			addr.AbsoluteKeypath(),
			account.Config().SigningConfigurations[signingConfigIdx].ScriptType(),
		)
		if err != nil {
			if firmware.IsErrorAbort(err) {
				log.WithError(err).Error("user aborted msg signing")
				backend.aoppSetError(errAOPPSigningAborted)
				return
			}
			log.WithError(err).Error("signing error")
			backend.aoppSetError(errAOPPUnknown)
			return
		}
		signature = sig
	case coinpkg.CodeETH:
		sig, err := backend.keystore.SignETHMessage(
			[]byte(backend.aopp.Message),
			addr.AbsoluteKeypath(),
		)
		if err != nil {
			if firmware.IsErrorAbort(err) {
				log.WithError(err).Error("user aborted msg signing")
				backend.aoppSetError(errAOPPSigningAborted)
				return
			}
			log.WithError(err).Error("signing error")
			backend.aoppSetError(errAOPPUnknown)
			return
		}
		signature = sig
	default:
		log.Errorf("unsupported coin: %s", account.Coin().Code())
		backend.aoppSetError(errAOPPUnknown)
		return
	}

	jsonBody, err := json.Marshal(struct {
		Version   int    `json:"version"`
		Address   string `json:"address"`
		Signature []byte `json:"signature"` // is base64 encoded
	}{
		Version:   0,
		Address:   addr.EncodeForHumans(),
		Signature: signature,
	})
	if err != nil {
		log.WithError(err).Error("JSON error")
		backend.aoppSetError(errAOPPUnknown)
		return
	}
	resp, err := backend.httpClient.Post(backend.aopp.Callback, "application/json", bytes.NewBuffer(jsonBody))
	if err != nil {
		log.WithError(err).Error("Error calling callback")
		backend.aoppSetError(errAOPPCallback)
		return
	}
	defer resp.Body.Close() //nolint:errcheck
	if resp.StatusCode != http.StatusNoContent {
		log.Errorf("AOPP callback response code is %d, expected %d", resp.StatusCode, 204)
		backend.aoppSetError(errAOPPCallback)
		return
	}

	backend.aopp.State = aoppStateSuccess
	backend.notifyAOPP()
}

// AOPPChooseAccount is called when an AOPP request is being processed and the user has chosen an
// account.
func (backend *Backend) AOPPChooseAccount(code accounts.Code) {
	defer backend.accountsAndKeystoreLock.Lock()()
	backend.aoppChooseAccount(code)
}
