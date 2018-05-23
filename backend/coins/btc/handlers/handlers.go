package handlers

import (
	"encoding/json"
	"net/http"
	"strconv"
	"strings"
	"time"

	"github.com/btcsuite/btcutil"
	"github.com/gorilla/mux"
	"github.com/shiftdevices/godbb/backend/coins/btc"
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

	handleFunc("/status", handlers.getAccountStatus).Methods("GET")
	handleFunc("/transactions", handlers.ensureAccountInitialized(handlers.getAccountTransactions)).Methods("GET")
	handleFunc("/balance", handlers.ensureAccountInitialized(handlers.getAccountBalance)).Methods("GET")
	handleFunc("/sendtx", handlers.ensureAccountInitialized(handlers.postAccountSendTx)).Methods("POST")
	handleFunc("/fee-targets", handlers.ensureAccountInitialized(handlers.getAccountFeeTargets)).Methods("GET")
	handleFunc("/tx-proposal", handlers.ensureAccountInitialized(handlers.getAccountTxProposal)).Methods("POST")
	handleFunc("/headers/status", handlers.ensureAccountInitialized(handlers.getHeadersStatus)).Methods("GET")
	handleFunc("/receive-address", handlers.ensureAccountInitialized(handlers.getReceiveAddress)).Methods("GET")
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
	ID               string   `json:"id"`
	NumConfirmations int      `json:"numConfirmations"`
	Height           int      `json:"height"`
	Type             string   `json:"type"`
	Amount           string   `json:"amount"`
	Fee              string   `json:"fee"`
	Time             *string  `json:"time"`
	Addresses        []string `json:"addresses"`
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
		var feeString = ""
		if txInfo.Fee != nil {
			feeString = txInfo.Fee.String()
		}
		var formattedTime *string
		if txInfo.Timestamp != nil {
			t := txInfo.Timestamp.Format(time.RFC3339)
			formattedTime = &t
		}
		result = append(result, Transaction{
			ID:               txInfo.Tx.TxHash().String(),
			NumConfirmations: txInfo.NumConfirmations,
			Height:           txInfo.Height,
			Type: map[transactions.TxType]string{
				transactions.TxTypeReceive:  "receive",
				transactions.TxTypeSend:     "send",
				transactions.TxTypeSendSelf: "send_to_self",
			}[txInfo.Type],
			Amount:    txInfo.Amount.String(),
			Fee:       feeString,
			Time:      formattedTime,
			Addresses: txInfo.Addresses,
		})
	}
	return result, nil
}

func (handlers *Handlers) getAccountBalance(_ *http.Request) (interface{}, error) {
	balance := handlers.account.Balance()
	unit := btcutil.AmountBTC.String()
	strip := func(s string) string {
		return strings.TrimSpace(strings.TrimSuffix(s, unit))
	}
	return map[string]interface{}{
		"available":   strip(balance.Available.Format(btcutil.AmountBTC)),
		"incoming":    strip(balance.Incoming.Format(btcutil.AmountBTC)),
		"hasIncoming": balance.Incoming != 0,
		"unit":        unit,
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
	outputAmount, fee, err := handlers.account.TxProposal(
		input.address,
		input.sendAmount,
		input.feeTargetCode,
	)
	if err != nil {
		return txProposalError(err)
	}
	return map[string]interface{}{
		"success": true,
		"amount":  outputAmount.String(),
		"fee":     fee.String(),
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

func (handlers *Handlers) getAccountStatus(_ *http.Request) (interface{}, error) {
	if handlers.account == nil {
		return btc.Disconnected, nil
	} else if !handlers.account.Initialized() {
		return btc.Connected, nil
	} else {
		return btc.Initialized, nil
	}
}

func (handlers *Handlers) getReceiveAddress(_ *http.Request) (interface{}, error) {
	address := handlers.account.GetUnusedReceiveAddress()
	if handlers.account.Keystores().HaveSecureOutput() {
		if err := handlers.account.Keystores().OutputAddress(address.Configuration, handlers.account.Coin()); err != nil {
			return nil, err
		}
	}
	return address.EncodeAddress(), nil
}
