package handlers

import (
	"encoding/json"
	"net/http"
	"strconv"
	"time"

	"github.com/shiftdevices/godbb/backend/coins/coin"

	"github.com/btcsuite/btcutil"
	"github.com/gorilla/mux"
	"github.com/shiftdevices/godbb/backend/coins/btc"
	"github.com/shiftdevices/godbb/backend/coins/btc/blockchain"
	"github.com/shiftdevices/godbb/backend/coins/btc/transactions"
	"github.com/shiftdevices/godbb/backend/devices/bitbox"
	"github.com/shiftdevices/godbb/util/errp"
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
	handleFunc("/balance", handlers.ensureAccountInitialized(handlers.getAccountBalance)).Methods("GET")
	handleFunc("/sendtx", handlers.ensureAccountInitialized(handlers.postAccountSendTx)).Methods("POST")
	handleFunc("/fee-targets", handlers.ensureAccountInitialized(handlers.getAccountFeeTargets)).Methods("GET")
	handleFunc("/tx-proposal", handlers.ensureAccountInitialized(handlers.getAccountTxProposal)).Methods("POST")
	handleFunc("/headers/status", handlers.ensureAccountInitialized(handlers.getHeadersStatus)).Methods("GET")
	handleFunc("/receive-addresses", handlers.ensureAccountInitialized(handlers.getReceiveAddresses)).Methods("GET")
	handleFunc("/verify-address", handlers.ensureAccountInitialized(handlers.postVerifyAddress)).Methods("POST")
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

// Transaction is the info returned per transaction by the /transactions endpoint.
type Transaction struct {
	ID               string               `json:"id"`
	VSize            int64                `json:"vsize"`
	Size             int64                `json:"size"`
	Weight           int64                `json:"weight"`
	NumConfirmations int                  `json:"numConfirmations"`
	Height           int                  `json:"height"`
	Type             string               `json:"type"`
	Amount           coin.FormattedAmount `json:"amount"`
	Fee              coin.FormattedAmount `json:"fee"`
	FeeRatePerKb     coin.FormattedAmount `json:"feeRatePerKb"`
	Time             *string              `json:"time"`
	Addresses        []string             `json:"addresses"`
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
		var feeString, feeRatePerKbString coin.FormattedAmount
		if txInfo.Fee != nil {
			feeString = handlers.account.Coin().FormatAmountAsJSON(int64(*txInfo.Fee))
			feeRatePerKbString = handlers.account.Coin().FormatAmountAsJSON(int64(*txInfo.FeeRatePerKb()))
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
			Amount:       handlers.account.Coin().FormatAmountAsJSON(int64(txInfo.Amount)),
			Fee:          feeString,
			FeeRatePerKb: feeRatePerKbString,
			Time:         formattedTime,
			Addresses:    txInfo.Addresses,
		})
	}
	return result, nil
}

func (handlers *Handlers) getAccountBalance(_ *http.Request) (interface{}, error) {
	balance := handlers.account.Balance()
	coin := handlers.account.Coin()
	return map[string]interface{}{
		"available":   coin.FormatAmountAsJSON(int64(balance.Available)),
		"incoming":    coin.FormatAmountAsJSON(int64(balance.Incoming)),
		"hasIncoming": balance.Incoming != 0,
	}, nil
}

type sendTxInput struct {
	address       string
	sendAmount    btc.SendAmount
	feeTargetCode btc.FeeTargetCode
	log           *logrus.Entry
}

func (input *sendTxInput) UnmarshalJSON(jsonBytes []byte) error {
	jsonBody := map[string]string{}
	if err := json.Unmarshal(jsonBytes, &jsonBody); err != nil {
		return errp.WithStack(err)
	}
	input.address = jsonBody["address"]
	var err error
	input.feeTargetCode, err = btc.NewFeeTargetCode(jsonBody["feeTarget"], input.log)
	if err != nil {
		return errp.WithMessage(err, "Failed to retrieve fee target code")
	}
	if jsonBody["sendAll"] == "yes" {
		input.sendAmount = btc.NewSendAmountAll()
	} else {
		amount, err := strconv.ParseFloat(jsonBody["amount"], 64)
		if err != nil {
			return errp.WithStack(btc.TxValidationError("invalid amount"))
		}
		btcAmount, err := btcutil.NewAmount(amount)
		if err != nil {
			return errp.WithStack(btc.TxValidationError("invalid amount"))
		}
		input.sendAmount, err = btc.NewSendAmount(btcAmount)
		if err != nil {
			return errp.WithStack(btc.TxValidationError("invalid amount"))
		}
	}
	return nil
}

func (handlers *Handlers) postAccountSendTx(r *http.Request) (interface{}, error) {
	input := &sendTxInput{log: handlers.log}
	if err := json.NewDecoder(r.Body).Decode(&input); err != nil {
		return nil, errp.WithStack(err)
	}

	err := handlers.account.SendTx(input.address, input.sendAmount, input.feeTargetCode)
	if bitbox.IsErrorAbort(err) {
		return map[string]interface{}{"success": false}, nil
	}
	if err != nil {
		return nil, errp.WithMessage(err, "Failed to send transaction")
	}
	return map[string]interface{}{"success": true}, nil
}

func txProposalError(err error) (interface{}, error) {
	if validationErr, ok := errp.Cause(err).(btc.TxValidationError); ok {
		return map[string]interface{}{
			"success": false,
			"errMsg":  validationErr.Error(),
		}, nil
	}
	return nil, errp.WithMessage(err, "Failed to create transaction proposal")
}

func (handlers *Handlers) getAccountTxProposal(r *http.Request) (interface{}, error) {
	input := &sendTxInput{}
	if err := json.NewDecoder(r.Body).Decode(&input); err != nil {
		return txProposalError(errp.WithStack(err))
	}
	outputAmount, fee, total, err := handlers.account.TxProposal(
		input.address,
		input.sendAmount,
		input.feeTargetCode,
	)
	if err != nil {
		return txProposalError(err)
	}
	return map[string]interface{}{
		"success": true,
		"amount":  handlers.account.Coin().FormatAmountAsJSON(int64(outputAmount)),
		"fee":     handlers.account.Coin().FormatAmountAsJSON(int64(fee)),
		"total":   handlers.account.Coin().FormatAmountAsJSON(int64(total)),
	}, nil
}

func (handlers *Handlers) getHeadersStatus(r *http.Request) (interface{}, error) {
	return handlers.account.HeadersStatus()
}

func (handlers *Handlers) getAccountFeeTargets(_ *http.Request) (interface{}, error) {
	feeTargets, defaultFeeTarget := handlers.account.FeeTargets()
	result := []map[string]interface{}{}
	for _, feeTarget := range feeTargets {
		result = append(result,
			map[string]interface{}{
				"code": feeTarget.Code,
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
		if handlers.account.KeystoreAvailable() {
			status = append(status, btc.KeystoreAvailable)
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
			Address       string `json:"address"`
			ScriptHashHex string `json:"scriptHashHex"`
		}{
			Address:       address.EncodeAddress(),
			ScriptHashHex: string(address.PubkeyScriptHashHex()),
		})
	}
	return addresses, nil
}

func (handlers *Handlers) postVerifyAddress(r *http.Request) (interface{}, error) {
	var scriptHashHex string
	if err := json.NewDecoder(r.Body).Decode(&scriptHashHex); err != nil {
		return nil, errp.WithStack(err)
	}
	return handlers.account.VerifyAddress(blockchain.ScriptHashHex(scriptHashHex))
}
