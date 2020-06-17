// Copyright 2018 Shift Devices AG
// Copyright 2020 Shift Crypto AG
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
	"encoding/csv"
	"encoding/hex"
	"encoding/json"
	"net/http"
	"os"
	"path"
	"path/filepath"
	"strings"
	"time"

	"github.com/btcsuite/btcd/wire"
	"github.com/btcsuite/btcutil"
	"github.com/digitalbitbox/bitbox-wallet-app/backend/accounts"
	"github.com/digitalbitbox/bitbox-wallet-app/backend/accounts/errors"
	"github.com/digitalbitbox/bitbox-wallet-app/backend/accounts/safello"
	"github.com/digitalbitbox/bitbox-wallet-app/backend/coins/btc"
	"github.com/digitalbitbox/bitbox-wallet-app/backend/coins/btc/transactions"
	"github.com/digitalbitbox/bitbox-wallet-app/backend/coins/btc/util"
	"github.com/digitalbitbox/bitbox-wallet-app/backend/coins/coin"
	"github.com/digitalbitbox/bitbox-wallet-app/backend/coins/eth"
	"github.com/digitalbitbox/bitbox-wallet-app/backend/coins/eth/types"
	"github.com/digitalbitbox/bitbox-wallet-app/backend/keystore"
	"github.com/digitalbitbox/bitbox-wallet-app/util/config"
	"github.com/digitalbitbox/bitbox-wallet-app/util/errp"
	"github.com/gorilla/mux"
	"github.com/sirupsen/logrus"
)

// Handlers provides a web api to the account.
type Handlers struct {
	account accounts.Interface
	log     *logrus.Entry
}

// NewHandlers creates a new Handlers instance.
func NewHandlers(
	handleFunc func(string, func(*http.Request) (interface{}, error)) *mux.Route, log *logrus.Entry) *Handlers {
	handlers := &Handlers{log: log}

	handleFunc("/init", handlers.postInit).Methods("POST")
	handleFunc("/status", handlers.getAccountStatus).Methods("GET")
	handleFunc("/transactions", handlers.ensureAccountInitialized(handlers.getAccountTransactions)).Methods("GET")
	handleFunc("/export", handlers.ensureAccountInitialized(handlers.postExportTransactions)).Methods("POST")
	handleFunc("/info", handlers.ensureAccountInitialized(handlers.getAccountInfo)).Methods("GET")
	handleFunc("/utxos", handlers.ensureAccountInitialized(handlers.getUTXOs)).Methods("GET")
	handleFunc("/balance", handlers.ensureAccountInitialized(handlers.getAccountBalance)).Methods("GET")
	handleFunc("/sendtx", handlers.ensureAccountInitialized(handlers.postAccountSendTx)).Methods("POST")
	handleFunc("/fee-targets", handlers.ensureAccountInitialized(handlers.getAccountFeeTargets)).Methods("GET")
	handleFunc("/tx-proposal", handlers.ensureAccountInitialized(handlers.postAccountTxProposal)).Methods("POST")
	handleFunc("/receive-addresses", handlers.ensureAccountInitialized(handlers.getReceiveAddresses)).Methods("GET")
	handleFunc("/verify-address", handlers.ensureAccountInitialized(handlers.postVerifyAddress)).Methods("POST")
	handleFunc("/can-verify-extended-public-key", handlers.ensureAccountInitialized(handlers.getCanVerifyExtendedPublicKey)).Methods("GET")
	handleFunc("/verify-extended-public-key", handlers.ensureAccountInitialized(handlers.postVerifyExtendedPublicKey)).Methods("POST")
	handleFunc("/has-secure-output", handlers.ensureAccountInitialized(handlers.getHasSecureOutput)).Methods("GET")
	handleFunc("/exchange/safello/buy-supported", handlers.ensureAccountInitialized(handlers.getExchangeSafelloBuySupported)).Methods("GET")
	handleFunc("/exchange/safello/buy", handlers.ensureAccountInitialized(handlers.getExchangeSafelloBuy)).Methods("GET")
	handleFunc("/exchange/safello/process-message", handlers.ensureAccountInitialized(handlers.postExchangeSafelloProcessMessage)).Methods("POST")
	return handlers
}

// Init installs a account as a base for the web api. This needs to be called before any requests are
// made.
func (handlers *Handlers) Init(account accounts.Interface) {
	handlers.account = account
}

// Uninit removes the account. After this, no requests should be made.
func (handlers *Handlers) Uninit() {
	handlers.account = nil
}

// FormattedAmount with unit and conversions.
type FormattedAmount struct {
	Amount      string            `json:"amount"`
	Unit        string            `json:"unit"`
	Conversions map[string]string `json:"conversions"`
}

func (handlers *Handlers) formatAmountAsJSON(amount coin.Amount, isFee bool) FormattedAmount {
	return FormattedAmount{
		Amount:      handlers.account.Coin().FormatAmount(amount, isFee),
		Unit:        handlers.account.Coin().Unit(isFee),
		Conversions: coin.Conversions(amount, handlers.account.Coin(), isFee, handlers.account.RateUpdater()),
	}
}

func (handlers *Handlers) formatBTCAmountAsJSON(amount btcutil.Amount, isFee bool) FormattedAmount {
	return handlers.formatAmountAsJSON(coin.NewAmountFromInt64(int64(amount)), isFee)
}

// Transaction is the info returned per transaction by the /transactions endpoint.
type Transaction struct {
	TxID                     string            `json:"txID"`
	InternalID               string            `json:"internalID"`
	NumConfirmations         int               `json:"numConfirmations"`
	NumConfirmationsComplete int               `json:"numConfirmationsComplete"`
	Type                     string            `json:"type"`
	Status                   accounts.TxStatus `json:"status"`
	Amount                   FormattedAmount   `json:"amount"`
	Fee                      FormattedAmount   `json:"fee"`
	Time                     *string           `json:"time"`
	Addresses                []string          `json:"addresses"`

	// BTC specific fields.
	VSize        int64           `json:"vsize"`
	Size         int64           `json:"size"`
	Weight       int64           `json:"weight"`
	FeeRatePerKb FormattedAmount `json:"feeRatePerKb"`

	// ETH specific fields
	Gas uint64 `json:"gas"`
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
	txs, err := handlers.account.Transactions()
	if err != nil {
		return nil, err
	}
	for _, txInfo := range txs {
		var feeString FormattedAmount
		fee := txInfo.Fee()
		if fee != nil {
			feeString = handlers.formatAmountAsJSON(*fee, true)
		}
		var formattedTime *string
		timestamp := txInfo.Timestamp()
		if timestamp != nil {
			t := timestamp.Format(time.RFC3339)
			formattedTime = &t
		}
		addresses := []string{}
		for _, addressAndAmount := range txInfo.Addresses() {
			addresses = append(addresses, addressAndAmount.Address)
		}
		txInfoJSON := Transaction{
			TxID:                     txInfo.TxID(),
			InternalID:               txInfo.InternalID(),
			NumConfirmations:         txInfo.NumConfirmations(),
			NumConfirmationsComplete: txInfo.NumConfirmationsComplete(),
			Type: map[accounts.TxType]string{
				accounts.TxTypeReceive:  "receive",
				accounts.TxTypeSend:     "send",
				accounts.TxTypeSendSelf: "send_to_self",
			}[txInfo.Type()],
			Status:    txInfo.Status(),
			Amount:    handlers.formatAmountAsJSON(txInfo.Amount(), false),
			Fee:       feeString,
			Time:      formattedTime,
			Addresses: addresses,
		}
		switch specificInfo := txInfo.(type) {
		case *transactions.TxInfo:
			txInfoJSON.VSize = specificInfo.VSize
			txInfoJSON.Size = specificInfo.Size
			txInfoJSON.Weight = specificInfo.Weight
			feeRatePerKb := specificInfo.FeeRatePerKb()
			if feeRatePerKb != nil {
				txInfoJSON.FeeRatePerKb = handlers.formatBTCAmountAsJSON(*feeRatePerKb, true)
			}
		case types.EthereumTransaction:
			txInfoJSON.Gas = specificInfo.Gas()
		}
		result = append(result, txInfoJSON)
	}
	return result, nil
}

func (handlers *Handlers) postExportTransactions(_ *http.Request) (interface{}, error) {
	name := time.Now().Format("2006-01-02-at-15-04-05-") + handlers.account.Code() + "-export.csv"
	downloadsDir, err := config.DownloadsDir()
	if err != nil {
		return nil, err
	}
	path := filepath.Join(downloadsDir, name)
	handlers.log.Infof("Export transactions to %s.", path)

	file, err := os.Create(path)
	if err != nil {
		return nil, errp.WithStack(err)
	}
	defer func() {
		err := file.Close()
		if err != nil {
			handlers.log.WithError(err).Error("Could not close the exported transactions file.")
		}
	}()

	writer := csv.NewWriter(file)
	defer writer.Flush()

	err = writer.Write([]string{
		"Time",
		"Type",
		"Amount",
		"Unit",
		"Fee",
		"Address",
		"Transaction ID",
	})
	if err != nil {
		return nil, errp.WithStack(err)
	}

	transactions, err := handlers.account.Transactions()
	if err != nil {
		return nil, err
	}
	for _, transaction := range transactions {
		transactionType := map[accounts.TxType]string{
			accounts.TxTypeReceive:  "received",
			accounts.TxTypeSend:     "sent",
			accounts.TxTypeSendSelf: "sent_to_yourself",
		}[transaction.Type()]
		feeString := ""
		fee := transaction.Fee()
		if fee != nil {
			feeString = fee.BigInt().String()
		}
		unit := handlers.account.Coin().SmallestUnit()
		timeString := ""
		if transaction.Timestamp() != nil {
			timeString = transaction.Timestamp().Format(time.RFC3339)
		}
		for _, addressAndAmount := range transaction.Addresses() {
			if transactionType == "sent" && addressAndAmount.Ours {
				transactionType = "sent_to_yourself"
			}
			err := writer.Write([]string{
				timeString,
				transactionType,
				addressAndAmount.Amount.BigInt().String(),
				unit,
				feeString,
				addressAndAmount.Address,
				transaction.TxID(),
			})
			if err != nil {
				return nil, errp.WithStack(err)
			}
			// a multitx is output in one row per receive address. Show the tx fee only in the
			// first row.
			feeString = ""
		}

	}
	return path, nil
}

func (handlers *Handlers) getAccountInfo(_ *http.Request) (interface{}, error) {
	return handlers.account.Info(), nil
}

func (handlers *Handlers) getUTXOs(_ *http.Request) (interface{}, error) {
	result := []map[string]interface{}{}

	t, ok := handlers.account.(*btc.Account)

	if !ok {
		return result, errp.New("Interface must be of type btc.Account")
	}

	for _, output := range t.SpendableOutputs() {
		result = append(result,
			map[string]interface{}{
				"outPoint": output.OutPoint.String(),
				"amount":   handlers.formatBTCAmountAsJSON(btcutil.Amount(output.TxOut.Value), false),
				"address":  output.Address,
			})
	}

	return result, nil
}

func (handlers *Handlers) getAccountBalance(_ *http.Request) (interface{}, error) {
	balance, err := handlers.account.Balance()
	if err != nil {
		return nil, err
	}
	return map[string]interface{}{
		"available":   handlers.formatAmountAsJSON(balance.Available(), false),
		"incoming":    handlers.formatAmountAsJSON(balance.Incoming(), false),
		"hasIncoming": balance.Incoming().BigInt().Sign() > 0,
	}, nil
}

type sendTxInput struct {
	address       string
	sendAmount    coin.SendAmount
	feeTargetCode accounts.FeeTargetCode
	selectedUTXOs map[wire.OutPoint]struct{}
	data          []byte
}

func (input *sendTxInput) UnmarshalJSON(jsonBytes []byte) error {
	jsonBody := struct {
		Address       string   `json:"address"`
		SendAll       string   `json:"sendAll"`
		FeeTarget     string   `json:"feeTarget"`
		Amount        string   `json:"amount"`
		SelectedUTXOS []string `json:"selectedUTXOS"`
		Data          string   `json:"data"`
	}{}
	if err := json.Unmarshal(jsonBytes, &jsonBody); err != nil {
		return errp.WithStack(err)
	}
	input.address = jsonBody.Address
	var err error
	input.feeTargetCode, err = accounts.NewFeeTargetCode(jsonBody.FeeTarget)
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
	input.data, err = hex.DecodeString(strings.TrimPrefix(jsonBody.Data, "0x"))
	if err != nil {
		return errp.WithStack(errors.ErrInvalidData)
	}
	return nil
}

func (handlers *Handlers) postAccountSendTx(r *http.Request) (interface{}, error) {
	err := handlers.account.SendTx()
	if errp.Cause(err) == keystore.ErrSigningAborted {
		return map[string]interface{}{"success": false, "aborted": true}, nil
	}
	if err != nil {
		return map[string]interface{}{"success": false, "errorMessage": err.Error()}, nil
	}
	return map[string]interface{}{"success": true}, nil
}

func txProposalError(err error) (interface{}, error) {
	if validationErr, ok := errp.Cause(err).(errors.TxValidationError); ok {
		return map[string]interface{}{
			"success":   false,
			"errorCode": validationErr.Error(),
		}, nil
	}
	return nil, errp.WithMessage(err, "Failed to create transaction proposal")
}

func (handlers *Handlers) postAccountTxProposal(r *http.Request) (interface{}, error) {
	var input sendTxInput
	if err := json.NewDecoder(r.Body).Decode(&input); err != nil {
		return txProposalError(errp.WithStack(err))
	}
	outputAmount, fee, total, err := handlers.account.TxProposal(
		input.address,
		input.sendAmount,
		input.feeTargetCode,
		input.selectedUTXOs,
		input.data,
	)
	if err != nil {
		return txProposalError(err)
	}
	return map[string]interface{}{
		"success": true,
		"amount":  handlers.formatAmountAsJSON(outputAmount, false),
		"fee":     handlers.formatAmountAsJSON(fee, true),
		"total":   handlers.formatAmountAsJSON(total, false),
	}, nil
}

func (handlers *Handlers) getAccountFeeTargets(_ *http.Request) (interface{}, error) {
	feeTargets, defaultFeeTarget := handlers.account.FeeTargets()
	result := []map[string]interface{}{}
	for _, feeTarget := range feeTargets {
		result = append(result,
			map[string]interface{}{
				"code": feeTarget.Code(),
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
	return nil, handlers.account.Initialize()
}

func (handlers *Handlers) getAccountStatus(_ *http.Request) (interface{}, error) {
	status := []btc.Status{}
	if handlers.account == nil {
		status = append(status, btc.AccountDisabled)
	} else {
		if handlers.account.Synced() {
			status = append(status, btc.AccountSynced)
		}

		if handlers.account.Offline() {
			status = append(status, btc.OfflineMode)
		}

		if handlers.account.FatalError() {
			status = append(status, btc.FatalError)
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

func (handlers *Handlers) getCanVerifyExtendedPublicKey(_ *http.Request) (interface{}, error) {
	switch specificAccount := handlers.account.(type) {
	case *btc.Account:
		return specificAccount.CanVerifyExtendedPublicKey(), nil
	case *eth.Account:
		// No xpub verification for ethereum accounts
		return []int{}, nil
	default:
		return nil, nil
	}
}

func (handlers *Handlers) postVerifyExtendedPublicKey(r *http.Request) (interface{}, error) {
	var input struct {
		XPubIndex          int `json:"xpubIndex"`
		SigningConfigIndex int `json:"signingConfigIndex"`
	}
	if err := json.NewDecoder(r.Body).Decode(&input); err != nil {
		return nil, errp.WithStack(err)
	}
	btcAccount, ok := handlers.account.(*btc.Account)
	if !ok {
		return nil, errp.New("An account must be BTC based to support xpub verification")
	}
	return btcAccount.VerifyExtendedPublicKey(input.SigningConfigIndex, input.XPubIndex)
}

func (handlers *Handlers) getHasSecureOutput(r *http.Request) (interface{}, error) {
	hasSecureOutput, optional, err := handlers.account.CanVerifyAddresses()
	if err != nil {
		return nil, err
	}
	return map[string]interface{}{
		"hasSecureOutput": hasSecureOutput,
		"optional":        optional,
	}, nil
}

func (handlers *Handlers) getExchangeSafelloBuySupported(r *http.Request) (interface{}, error) {
	return handlers.account.SafelloBuySupported(), nil
}

func (handlers *Handlers) getExchangeSafelloBuy(r *http.Request) (interface{}, error) {
	return handlers.account.SafelloBuy(), nil
}

func (handlers *Handlers) postExchangeSafelloProcessMessage(r *http.Request) (interface{}, error) {
	var message map[string]json.RawMessage
	if err := json.NewDecoder(r.Body).Decode(&message); err != nil {
		return nil, errp.WithStack(err)
	}

	return nil, safello.StoreCallbackJSONMessage(
		path.Join(handlers.account.FilesFolder(), "safello-buy.json"),
		message,
	)
}
