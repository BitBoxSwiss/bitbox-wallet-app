// Copyright 2018 Shift Devices AG
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

package handlers

import (
	"encoding/json"
	"net/http"
	"time"

	"github.com/digitalbitbox/bitbox-wallet-app/backend/coins/btc"
	"github.com/digitalbitbox/bitbox-wallet-app/backend/coins/btc/transactions"
	"github.com/digitalbitbox/bitbox-wallet-app/backend/coins/btc/util"
	"github.com/digitalbitbox/bitbox-wallet-app/backend/coins/coin"
	"github.com/digitalbitbox/bitbox-wallet-app/backend/keystore"
	"github.com/digitalbitbox/bitbox-wallet-app/util/errp"

	"github.com/btcsuite/btcd/wire"
	"github.com/btcsuite/btcutil"
	"github.com/gorilla/mux"
	"github.com/sirupsen/logrus"
)

// Handlers provides a web api to the account.
type Handlers struct {
	account btc.Interface
	log     *logrus.Entry
}

// NewHandlers creates a new Handlers instance.
func NewHandlers(
	handleFunc func(string, func(*http.Request) (interface{}, error)) *mux.Route, log *logrus.Entry) *Handlers {
	handlers := &Handlers{log: log}

	handleFunc("/init", handlers.postInit).Methods("POST")
	handleFunc("/status", handlers.getAccountStatus).Methods("GET")
	handleFunc("/transactions", handlers.ensureAccountInitialized(handlers.getAccountTransactions)).Methods("GET")
	handleFunc("/info", handlers.ensureAccountInitialized(handlers.getAccountInfo)).Methods("GET")
	handleFunc("/utxos", handlers.ensureAccountInitialized(handlers.getUTXOs)).Methods("GET")
	handleFunc("/balance", handlers.ensureAccountInitialized(handlers.getAccountBalance)).Methods("GET")
	handleFunc("/sendtx", handlers.ensureAccountInitialized(handlers.postAccountSendTx)).Methods("POST")
	handleFunc("/fee-targets", handlers.ensureAccountInitialized(handlers.getAccountFeeTargets)).Methods("GET")
	handleFunc("/tx-proposal", handlers.ensureAccountInitialized(handlers.getAccountTxProposal)).Methods("POST")
	handleFunc("/headers/status", handlers.ensureAccountInitialized(handlers.getHeadersStatus)).Methods("GET")
	handleFunc("/receive-addresses", handlers.ensureAccountInitialized(handlers.getReceiveAddresses)).Methods("GET")
	handleFunc("/verify-address", handlers.ensureAccountInitialized(handlers.postVerifyAddress)).Methods("POST")
	handleFunc("/convert-to-legacy-address", handlers.ensureAccountInitialized(handlers.postConvertToLegacyAddress)).Methods("POST")
	return handlers
}

// Init installs a account as a base for the web api. This needs to be called before any requests are
// made.
func (handlers *Handlers) Init(account btc.Interface) {
	handlers.account = account
}

// Uninit removes the account. After this, no requests should be made.
func (handlers *Handlers) Uninit() {
	handlers.account = nil
}

// formattedAmount with unit.
type formattedAmount struct {
	Amount string `json:"amount"`
	Unit   string `json:"unit"`
}

func (handlers *Handlers) formatBTCAmountAsJSON(amount btcutil.Amount) formattedAmount {
	return formattedAmount{
		Amount: handlers.account.Coin().FormatAmount(coin.NewAmountFromInt64(int64(amount))),
		Unit:   handlers.account.Coin().Unit(),
	}
}

func (handlers *Handlers) formatAmountAsJSON(amount coin.Amount) formattedAmount {
	return formattedAmount{
		Amount: handlers.account.Coin().FormatAmount(amount),
		Unit:   handlers.account.Coin().Unit(),
	}
}

// Transaction is the info returned per transaction by the /transactions endpoint.
type Transaction struct {
	ID               string          `json:"id"`
	VSize            int64           `json:"vsize"`
	Size             int64           `json:"size"`
	Weight           int64           `json:"weight"`
	NumConfirmations int             `json:"numConfirmations"`
	Height           int             `json:"height"`
	Type             string          `json:"type"`
	Amount           formattedAmount `json:"amount"`
	Fee              formattedAmount `json:"fee"`
	FeeRatePerKb     formattedAmount `json:"feeRatePerKb"`
	Time             *string         `json:"time"`
	Addresses        []string        `json:"addresses"`
}

func (handlers *Handlers) ensureAccountInitialized(h func(*http.Request) (interface{}, error)) func(*http.Request) (interface{}, error) {
	return func(request *http.Request) (interface{}, error) {
		if handlers.account == nil {
			return nil, errp.New("Account was uninitialized. Cannot handle request.")
		}
		return h(request)
	}
}

func (handlers *Handlers) getAccountTransactions(_ *http.Request) (interface{}, error) {
	result := []Transaction{}
	txs := handlers.account.Transactions()
	for _, txInfo := range txs {
		var feeString, feeRatePerKb formattedAmount
		if txInfo.Fee != nil {
			feeString = handlers.formatBTCAmountAsJSON(*txInfo.Fee)
			feeRatePerKb = handlers.formatBTCAmountAsJSON(*txInfo.FeeRatePerKb())
		}
		var formattedTime *string
		if txInfo.Timestamp != nil {
			t := txInfo.Timestamp.Format(time.RFC3339)
			formattedTime = &t
		}
		result = append(result, Transaction{
			ID:               txInfo.Tx.TxHash().String(),
			NumConfirmations: txInfo.NumConfirmations,
			VSize:            txInfo.VSize,
			Size:             txInfo.Size,
			Weight:           txInfo.Weight,
			Height:           txInfo.Height,
			Type: map[transactions.TxType]string{
				transactions.TxTypeReceive:  "receive",
				transactions.TxTypeSend:     "send",
				transactions.TxTypeSendSelf: "send_to_self",
			}[txInfo.Type],
			Amount:       handlers.formatBTCAmountAsJSON(txInfo.Amount),
			Fee:          feeString,
			FeeRatePerKb: feeRatePerKb,
			Time:         formattedTime,
			Addresses:    txInfo.Addresses,
		})
	}
	return result, nil
}

func (handlers *Handlers) getAccountInfo(_ *http.Request) (interface{}, error) {
	return handlers.account.Info(), nil
}

func (handlers *Handlers) getUTXOs(_ *http.Request) (interface{}, error) {
	result := []map[string]interface{}{}
	for _, output := range handlers.account.SpendableOutputs() {
		result = append(result,
			map[string]interface{}{
				"outPoint": output.OutPoint.String(),
				"amount":   handlers.formatBTCAmountAsJSON(btcutil.Amount(output.TxOut.Value)),
				"address":  output.Address,
			})
	}
	return result, nil
}

func (handlers *Handlers) getAccountBalance(_ *http.Request) (interface{}, error) {
	balance := handlers.account.Balance()
	return map[string]interface{}{
		"available":   handlers.formatAmountAsJSON(balance.Available),
		"incoming":    handlers.formatAmountAsJSON(balance.Incoming),
		"hasIncoming": balance.Incoming.BigInt().Sign() > 0,
	}, nil
}

type sendTxInput struct {
	address       string
	sendAmount    coin.SendAmount
	feeTargetCode btc.FeeTargetCode
	selectedUTXOs map[wire.OutPoint]struct{}
}

func (input *sendTxInput) UnmarshalJSON(jsonBytes []byte) error {
	jsonBody := struct {
		Address       string   `json:"address"`
		SendAll       string   `json:"sendAll"`
		FeeTarget     string   `json:"feeTarget"`
		Amount        string   `json:"amount"`
		SelectedUTXOS []string `json:"selectedUTXOS"`
	}{}
	if err := json.Unmarshal(jsonBytes, &jsonBody); err != nil {
		return errp.WithStack(err)
	}
	input.address = jsonBody.Address
	var err error
	input.feeTargetCode, err = btc.NewFeeTargetCode(jsonBody.FeeTarget)
	if err != nil {
		return errp.WithMessage(err, "Failed to retrieve fee target code")
	}
	if jsonBody.SendAll == "yes" {
		input.sendAmount = coin.NewSendAmountAll()
	} else {
		input.sendAmount = coin.NewSendAmount(jsonBody.Amount)
	}
	input.selectedUTXOs = map[wire.OutPoint]struct{}{}
	for _, outPointString := range jsonBody.SelectedUTXOS {
		outPoint, err := util.ParseOutPoint([]byte(outPointString))
		if err != nil {
			return err
		}
		input.selectedUTXOs[*outPoint] = struct{}{}
	}
	return nil
}

func (handlers *Handlers) postAccountSendTx(r *http.Request) (interface{}, error) {
	var input sendTxInput
	if err := json.NewDecoder(r.Body).Decode(&input); err != nil {
		return nil, errp.WithStack(err)
	}
	err := handlers.account.SendTx(input.address, input.sendAmount, input.feeTargetCode, input.selectedUTXOs)
	if errp.Cause(err) == keystore.ErrSigningAborted {
		return map[string]interface{}{"success": false}, nil
	}
	if err != nil {
		return nil, errp.WithMessage(err, "Failed to send transaction")
	}
	return map[string]interface{}{"success": true}, nil
}

func txProposalError(err error) (interface{}, error) {
	if validationErr, ok := errp.Cause(err).(coin.TxValidationError); ok {
		return map[string]interface{}{
			"success":   false,
			"errorCode": validationErr.Error(),
		}, nil
	}
	return nil, errp.WithMessage(err, "Failed to create transaction proposal")
}

func (handlers *Handlers) getAccountTxProposal(r *http.Request) (interface{}, error) {
	var input sendTxInput
	if err := json.NewDecoder(r.Body).Decode(&input); err != nil {
		return txProposalError(errp.WithStack(err))
	}
	outputAmount, fee, total, err := handlers.account.TxProposal(
		input.address,
		input.sendAmount,
		input.feeTargetCode,
		input.selectedUTXOs,
	)
	if err != nil {
		return txProposalError(err)
	}
	return map[string]interface{}{
		"success": true,
		"amount":  handlers.formatAmountAsJSON(outputAmount),
		"fee":     handlers.formatAmountAsJSON(fee),
		"total":   handlers.formatAmountAsJSON(total),
	}, nil
}

func (handlers *Handlers) getHeadersStatus(r *http.Request) (interface{}, error) {
	return handlers.account.HeadersStatus()
}

func (handlers *Handlers) getAccountFeeTargets(_ *http.Request) (interface{}, error) {
	feeTargets, defaultFeeTarget := handlers.account.FeeTargets()
	result := []map[string]interface{}{}
	for _, feeTarget := range feeTargets {
		var feeRatePerKb formattedAmount
		if feeTarget.FeeRatePerKb != nil {
			feeRatePerKb = handlers.formatBTCAmountAsJSON(*feeTarget.FeeRatePerKb)
		}
		result = append(result,
			map[string]interface{}{
				"code":         feeTarget.Code,
				"feeRatePerKb": feeRatePerKb,
			})
	}
	return map[string]interface{}{
		"feeTargets":       result,
		"defaultFeeTarget": defaultFeeTarget,
	}, nil
}

func (handlers *Handlers) postInit(_ *http.Request) (interface{}, error) {
	if handlers.account == nil {
		return nil, errp.New("/init called even though account was not added yet")
	}
	return nil, handlers.account.Init()
}

func (handlers *Handlers) getAccountStatus(_ *http.Request) (interface{}, error) {
	status := []btc.Status{}
	if handlers.account == nil {
		status = append(status, btc.AccountDisabled)
	} else {
		if handlers.account.InitialSyncDone() {
			status = append(status, btc.AccountSynced)
		}

		if handlers.account.Offline() {
			status = append(status, btc.OfflineMode)
		}
	}
	return status, nil
}

func (handlers *Handlers) getReceiveAddresses(_ *http.Request) (interface{}, error) {
	addresses := []interface{}{}
	for _, address := range handlers.account.GetUnusedReceiveAddresses() {
		addresses = append(addresses, struct {
			Address   string `json:"address"`
			AddressID string `json:"addressID"`
		}{
			Address:   address.EncodeForHumans(),
			AddressID: address.ID(),
		})
	}
	return addresses, nil
}

func (handlers *Handlers) postVerifyAddress(r *http.Request) (interface{}, error) {
	var addressID string
	if err := json.NewDecoder(r.Body).Decode(&addressID); err != nil {
		return nil, errp.WithStack(err)
	}
	return handlers.account.VerifyAddress(addressID)
}

func (handlers *Handlers) postConvertToLegacyAddress(r *http.Request) (interface{}, error) {
	var addressID string
	if err := json.NewDecoder(r.Body).Decode(&addressID); err != nil {
		return nil, errp.WithStack(err)
	}
	address, err := handlers.account.ConvertToLegacyAddress(addressID)
	if err != nil {
		return nil, err
	}
	return address.EncodeAddress(), nil
}
