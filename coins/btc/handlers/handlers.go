package handlers

import (
	"encoding/json"
	"net/http"
	"strconv"
	"strings"

	"github.com/btcsuite/btcutil"
	"github.com/gorilla/mux"
	"github.com/shiftdevices/godbb/coins/btc"
	"github.com/shiftdevices/godbb/coins/btc/transactions"
	"github.com/shiftdevices/godbb/util/errp"
	"github.com/sirupsen/logrus"
)

// Handlers provides a web api to the wallet.
type Handlers struct {
	wallet btc.Interface
	log    *logrus.Entry
}

// NewHandlers creates a new Handlers instance.
func NewHandlers(
	handleFunc func(string, func(*http.Request) (interface{}, error)) *mux.Route, log *logrus.Entry) *Handlers {
	handlers := &Handlers{log: log}

	handleFunc("/status", handlers.getWalletStatus).Methods("GET")
	handleFunc("/transactions", handlers.ensureWalletInitialized(handlers.getWalletTransactions)).Methods("GET")
	handleFunc("/balance", handlers.ensureWalletInitialized(handlers.getWalletBalance)).Methods("GET")
	handleFunc("/sendtx", handlers.ensureWalletInitialized(handlers.postWalletSendTx)).Methods("POST")
	handleFunc("/fee-targets", handlers.ensureWalletInitialized(handlers.getWalletFeeTargets)).Methods("GET")
	handleFunc("/tx-proposal", handlers.ensureWalletInitialized(handlers.getWalletTxProposal)).Methods("POST")
	handleFunc("/receive-address", handlers.ensureWalletInitialized(handlers.getReceiveAddress)).Methods("GET")
	return handlers
}

// Init installs a wallet as a base for the web api. This needs to be called before any requests are
// made.
func (handlers *Handlers) Init(wallet btc.Interface) {
	handlers.wallet = wallet
}

// Uninit removes the wallet. After this, no requests should be made.
func (handlers *Handlers) Uninit() {
	handlers.wallet = nil
}

// Transaction is the info returned per transaction by the /transactions endpoint.
type Transaction struct {
	ID     string `json:"id"`
	Height int    `json:"height"`
	Type   string `json:"type"`
	Amount string `json:"amount"`
	Fee    string `json:"fee"`
}

func (handlers *Handlers) ensureWalletInitialized(h func(*http.Request) (interface{}, error)) func(*http.Request) (interface{}, error) {
	return func(request *http.Request) (interface{}, error) {
		if handlers.wallet == nil {
			return nil, errp.New("Wallet was uninitialized. Cannot handle request.")
		}
		return h(request)
	}
}

func (handlers *Handlers) getWalletTransactions(_ *http.Request) (interface{}, error) {
	result := []Transaction{}
	txs := handlers.wallet.Transactions()
	for _, txInfo := range txs {
		var feeString = ""
		if txInfo.Fee != nil {
			feeString = txInfo.Fee.String()
		}
		result = append(result, Transaction{
			ID:     txInfo.Tx.TxHash().String(),
			Height: txInfo.Height,
			Type: map[transactions.TxType]string{
				transactions.TxTypeReceive:  "receive",
				transactions.TxTypeSend:     "send",
				transactions.TxTypeSendSelf: "send_to_self",
			}[txInfo.Type],
			Amount: txInfo.Amount.String(),
			Fee:    feeString,
		})
	}
	return result, nil
}

func (handlers *Handlers) getWalletBalance(_ *http.Request) (interface{}, error) {
	balance := handlers.wallet.Balance()
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
			return errp.WithStack(err)
		}
		btcAmount, err := btcutil.NewAmount(amount)
		if err != nil {
			return errp.WithStack(err)
		}
		input.sendAmount, err = btc.NewSendAmount(btcAmount)
		if err != nil {
			return errp.WithMessage(err, "Failed to create BTC send amount")
		}
	}
	return nil
}

func (handlers *Handlers) postWalletSendTx(r *http.Request) (interface{}, error) {
	input := &sendTxInput{log: handlers.log}
	if err := json.NewDecoder(r.Body).Decode(&input); err != nil {
		return nil, errp.WithStack(err)
	}

	err := handlers.wallet.SendTx(input.address, input.sendAmount, input.feeTargetCode)
	if errp.Cause(err) == btc.ErrUserAborted {
		return map[string]interface{}{"success": false}, nil
	}
	if err != nil {
		return nil, errp.WithMessage(err, "Failed to send transaction")
	}
	return map[string]interface{}{"success": true}, nil
}

func (handlers *Handlers) getWalletTxProposal(r *http.Request) (interface{}, error) {
	input := &sendTxInput{}
	if err := json.NewDecoder(r.Body).Decode(&input); err != nil {
		return nil, errp.WithStack(err)
	}
	outputAmount, fee, err := handlers.wallet.TxProposal(
		input.sendAmount,
		input.feeTargetCode,
	)
	if err != nil {
		return nil, errp.WithMessage(err, "Failed to create transaction proposal")
	}
	return map[string]string{
		"amount": outputAmount.String(),
		"fee":    fee.String(),
	}, nil
}

func (handlers *Handlers) getWalletFeeTargets(_ *http.Request) (interface{}, error) {
	feeTargets, defaultFeeTarget := handlers.wallet.FeeTargets()
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

func (handlers *Handlers) getWalletStatus(_ *http.Request) (interface{}, error) {
	if handlers.wallet == nil {
		return btc.Disconnected, nil
	} else if !handlers.wallet.Initialized() {
		return btc.Connected, nil
	} else {
		return btc.Initialized, nil
	}
}

func (handlers *Handlers) getReceiveAddress(_ *http.Request) (interface{}, error) {
	address := handlers.wallet.GetUnusedReceiveAddress()
	handlers.wallet.KeyStore().DisplayAddress(address.KeyPath)
	return address.EncodeAddress(), nil
}
