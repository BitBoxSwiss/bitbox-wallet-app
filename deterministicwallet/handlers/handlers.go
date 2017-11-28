package handlers

import (
	"encoding/json"
	"net/http"
	"strconv"

	"github.com/btcsuite/btcutil"
	"github.com/gorilla/mux"

	"github.com/shiftdevices/godbb/deterministicwallet"
	"github.com/shiftdevices/godbb/deterministicwallet/transactions"
	"github.com/shiftdevices/godbb/util/errp"
)

type Handlers struct {
	wallet deterministicwallet.Interface
}

func NewHandlers(
	handleFunc func(string, func(*http.Request) (interface{}, error)) *mux.Route) *Handlers {
	handlers := &Handlers{}

	handleFunc("/transactions", handlers.getWalletTransactions).Methods("GET")
	handleFunc("/balance", handlers.getWalletBalance).Methods("GET")
	handleFunc("/sendtx", handlers.postWalletSendTx).Methods("POST")
	handleFunc("/fee-targets", handlers.getWalletFeeTargets).Methods("GET")
	handleFunc("/tx-proposal", handlers.getWalletTxProposal).Methods("POST")
	handleFunc("/state", handlers.getWalletState).Methods("GET")
	handleFunc("/receive-address", handlers.getReceiveAddress).Methods("GET")
	return handlers
}

func (handlers *Handlers) Init(wallet deterministicwallet.Interface) {
	handlers.wallet = wallet
}

func (handlers *Handlers) Uninit() {
	handlers.wallet = nil
}

func (handlers *Handlers) getWalletTransactions(r *http.Request) (interface{}, error) {
	result := []map[string]interface{}{}
	txs := handlers.wallet.Transactions()
	for _, tx := range txs {
		txType, txAmount, txFee := handlers.wallet.ClassifyTransaction(tx.TX)
		var feeString = ""
		if txFee != nil {
			feeString = txFee.String()
		}
		result = append(result, map[string]interface{}{
			"id":     tx.TX.TxHash().String(),
			"height": tx.Height,
			"type": map[transactions.TxType]string{
				transactions.TxTypeReceive:  "receive",
				transactions.TxTypeSend:     "send",
				transactions.TxTypeSendSelf: "send_to_self",
			}[txType],
			"amount": txAmount.String(),
			"fee":    feeString,
		})
	}
	return result, nil
}

func (handlers *Handlers) getWalletBalance(r *http.Request) (interface{}, error) {
	balance := handlers.wallet.Balance()
	return map[string]string{
		"confirmed":   balance.Confirmed.Format(btcutil.AmountBTC),
		"unconfirmed": balance.Unconfirmed.Format(btcutil.AmountBTC),
	}, nil
}

type sendTxInput struct {
	address       string
	sendAmount    deterministicwallet.SendAmount
	feeTargetCode deterministicwallet.FeeTargetCode
}

func (input *sendTxInput) UnmarshalJSON(jsonBytes []byte) error {
	jsonBody := map[string]string{}
	if err := json.Unmarshal(jsonBytes, &jsonBody); err != nil {
		return errp.WithStack(err)
	}
	input.address = jsonBody["address"]
	var err error
	input.feeTargetCode, err = deterministicwallet.NewFeeTargetCode(jsonBody["feeTarget"])
	if err != nil {
		return err
	}
	if jsonBody["sendAll"] == "yes" {
		input.sendAmount = deterministicwallet.NewSendAmountAll()
	} else {
		amount, err := strconv.ParseFloat(jsonBody["amount"], 64)
		if err != nil {
			return errp.WithStack(err)
		}
		btcAmount, err := btcutil.NewAmount(amount)
		if err != nil {
			return errp.WithStack(err)
		}
		input.sendAmount, err = deterministicwallet.NewSendAmount(btcAmount)
		if err != nil {
			return err
		}
	}
	return nil
}

func (handlers *Handlers) postWalletSendTx(r *http.Request) (interface{}, error) {
	input := &sendTxInput{}
	if err := json.NewDecoder(r.Body).Decode(&input); err != nil {
		return nil, errp.WithStack(err)
	}

	err := handlers.wallet.SendTx(input.address, input.sendAmount, input.feeTargetCode)
	if errp.Cause(err) == deterministicwallet.ErrUserAborted {
		return map[string]interface{}{"success": false}, nil
	}
	if err != nil {
		return nil, err
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
		return nil, err
	}
	return map[string]string{
		"amount": outputAmount.String(),
		"fee":    fee.String(),
	}, nil
}

func (handlers *Handlers) getWalletFeeTargets(r *http.Request) (interface{}, error) {
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

func (handlers *Handlers) getWalletState(r *http.Request) (interface{}, error) {
	if handlers.wallet == nil {
		return "uninitialized", nil
	}
	return "initialized", nil
}

func (handlers *Handlers) getReceiveAddress(r *http.Request) (interface{}, error) {
	return handlers.wallet.GetUnusedReceiveAddress().EncodeAddress(), nil
}
