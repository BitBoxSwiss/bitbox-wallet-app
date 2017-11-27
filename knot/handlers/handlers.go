package handlers

import (
	"bytes"
	"encoding/json"
	"fmt"
	"net/http"
	"regexp"
	"strconv"

	"github.com/btcsuite/btcd/wire"
	"github.com/btcsuite/btcutil"
	assetfs "github.com/elazarl/go-bindata-assetfs"
	"github.com/gorilla/mux"
	"github.com/gorilla/websocket"
	"github.com/shiftdevices/godbb/deterministicwallet"
	"github.com/shiftdevices/godbb/deterministicwallet/transactions"
	"github.com/shiftdevices/godbb/knot"
	"github.com/shiftdevices/godbb/knot/binweb"
	"github.com/shiftdevices/godbb/util/errp"
	"github.com/shiftdevices/godbb/util/jsonp"
)

type WalletInterface interface {
	XPub() (string, error)
	DeviceState() string
	Reset() (bool, error)
	Login(string) error
	SetPassword(string) error
	CreateWallet(string) error
	BackupList() (bool, []string, error)
	EraseBackup(string) error
	RestoreBackup(string, string) (bool, error)
	CreateBackup(string) error
	Transactions() ([]*transactions.Transaction, error)
	ClassifyTransaction(*wire.MsgTx) (
		transactions.TxType, btcutil.Amount, *btcutil.Amount, error)
	Balance() (*transactions.Balance, error)
	SendTx(string, deterministicwallet.SendAmount, deterministicwallet.FeeTargetCode) error
	Start() <-chan knot.Event
	FeeTargets() ([]*deterministicwallet.FeeTarget, deterministicwallet.FeeTargetCode, error)
	TxProposal(deterministicwallet.SendAmount, deterministicwallet.FeeTargetCode) (
		btcutil.Amount, btcutil.Amount, error)
	WalletState() string
}

type Handlers struct {
	Router *mux.Router
	wallet WalletInterface
	// apiPort is the port on which this API will run. It is fed into the static javascript app
	// that is served, so the client knows where to connect to.
	apiPort           int
	walletEvents      <-chan knot.Event
	websocketUpgrader websocket.Upgrader
}

func NewHandlers(
	wallet WalletInterface,
	apiPort int,
) *Handlers {
	router := mux.NewRouter()
	handlers := &Handlers{
		Router:  router,
		wallet:  wallet,
		apiPort: apiPort,
		websocketUpgrader: websocket.Upgrader{
			ReadBufferSize:  1024,
			WriteBufferSize: 1024,
			CheckOrigin:     func(r *http.Request) bool { return true },
		},
		walletEvents: wallet.Start(),
	}

	apiRouter := router.PathPrefix("/api").Subrouter()
	apiRouter.HandleFunc("/xpub", apiMiddleware(handlers.getXPubHandler)).Methods("GET")
	apiRouter.HandleFunc("/deviceState", apiMiddleware(handlers.getDeviceStateHandler)).Methods("GET")
	apiRouter.HandleFunc("/reset-device", apiMiddleware(handlers.postResetDeviceHandler)).Methods("POST")
	apiRouter.HandleFunc("/login", apiMiddleware(handlers.postLoginHandler)).Methods("POST")
	apiRouter.HandleFunc("/set-password", apiMiddleware(handlers.postSetPasswordHandler)).Methods("POST")
	apiRouter.HandleFunc("/create-wallet", apiMiddleware(handlers.postCreateWalletHandler)).Methods("POST")

	apiRouter.HandleFunc("/backups/list", apiMiddleware(handlers.getBackupListHandler)).Methods("GET")
	apiRouter.HandleFunc("/backups/erase", apiMiddleware(handlers.postBackupsEraseHandler)).Methods("POST")
	apiRouter.HandleFunc("/backups/restore", apiMiddleware(handlers.postBackupsRestoreHandler)).Methods("POST")
	apiRouter.HandleFunc("/backups/create", apiMiddleware(handlers.postBackupsCreateHandler)).Methods("POST")
	apiRouter.HandleFunc("/wallet/btc/transactions", apiMiddleware(handlers.getWalletTransactions)).Methods("GET")
	apiRouter.HandleFunc("/wallet/btc/balance", apiMiddleware(handlers.getWalletBalance)).Methods("GET")
	apiRouter.HandleFunc("/wallet/btc/sendtx", apiMiddleware(handlers.postWalletSendTx)).Methods("POST")
	apiRouter.HandleFunc("/wallet/btc/fee-targets", apiMiddleware(handlers.getWalletFeeTargets)).Methods("GET")
	apiRouter.HandleFunc("/wallet/btc/tx-proposal", apiMiddleware(handlers.getWalletTxProposal)).Methods("POST")
	apiRouter.HandleFunc("/wallet/btc/state", apiMiddleware(handlers.getWalletState)).Methods("GET")
	apiRouter.HandleFunc("/events", handlers.eventsHandler)

	// Serve static files for the UI.
	router.Handle("/{rest:.*}",
		http.FileServer(&assetfs.AssetFS{
			Asset: func(name string) ([]byte, error) {
				body, err := binweb.Asset(name)
				if err != nil {
					return nil, err
				}
				if regexp.MustCompile(`^bundle\..+\.js$`).MatchString(name) {
					// TODO: move function elsewhere, use the template package.
					body = bytes.Replace(body, []byte("{{ API_PORT }}"), []byte(fmt.Sprintf("%d", handlers.apiPort)), -1)
				}
				return body, nil
			},
			AssetDir:  binweb.AssetDir,
			AssetInfo: binweb.AssetInfo,
			Prefix:    "",
		}))

	return handlers
}

func writeJSON(w http.ResponseWriter, value interface{}) {
	if err := json.NewEncoder(w).Encode(value); err != nil {
		panic(err)
	}
}

func (handlers *Handlers) getXPubHandler(r *http.Request) (interface{}, error) {
	return handlers.wallet.XPub()
}

func (handlers *Handlers) getDeviceStateHandler(r *http.Request) (interface{}, error) {
	return handlers.wallet.DeviceState(), nil
}

func (handlers *Handlers) postResetDeviceHandler(r *http.Request) (interface{}, error) {
	didReset, err := handlers.wallet.Reset()
	if err != nil {
		return nil, err
	}
	return map[string]interface{}{"didReset": didReset}, nil
}

func (handlers *Handlers) postLoginHandler(r *http.Request) (interface{}, error) {
	jsonBody := map[string]string{}
	if err := json.NewDecoder(r.Body).Decode(&jsonBody); err != nil {
		return nil, errp.WithStack(err)
	}
	password := jsonBody["password"]
	if err := handlers.wallet.Login(password); err != nil {
		return map[string]interface{}{"success": false, "errorMessage": err.Error()}, nil
	}
	return map[string]interface{}{"success": true}, nil
}

func (handlers *Handlers) postSetPasswordHandler(r *http.Request) (interface{}, error) {
	jsonBody := map[string]string{}
	if err := json.NewDecoder(r.Body).Decode(&jsonBody); err != nil {
		return nil, errp.WithStack(err)
	}
	password := jsonBody["password"]
	if err := handlers.wallet.SetPassword(password); err != nil {
		return map[string]interface{}{"success": false, "errorMessage": err.Error()}, nil
	}
	return map[string]interface{}{"success": true}, nil
}

func (handlers *Handlers) postCreateWalletHandler(r *http.Request) (interface{}, error) {
	jsonBody := map[string]string{}
	if err := json.NewDecoder(r.Body).Decode(&jsonBody); err != nil {
		return nil, errp.WithStack(err)
	}
	walletName := jsonBody["walletName"]
	if err := handlers.wallet.CreateWallet(walletName); err != nil {
		return map[string]interface{}{"success": false, "errorMessage": err.Error()}, nil
	}
	return map[string]interface{}{"success": true}, nil
}

func (handlers *Handlers) getBackupListHandler(r *http.Request) (interface{}, error) {
	sdCardInserted, backupList, err := handlers.wallet.BackupList()
	if err != nil {
		return nil, err
	}
	return map[string]interface{}{
		"sdCardInserted": sdCardInserted,
		"backupList":     backupList,
	}, nil
}

func (handlers *Handlers) postBackupsEraseHandler(r *http.Request) (interface{}, error) {
	jsonBody := map[string]string{}
	if err := json.NewDecoder(r.Body).Decode(&jsonBody); err != nil {
		return nil, errp.WithStack(err)
	}
	filename := jsonBody["filename"]
	return nil, handlers.wallet.EraseBackup(filename)
}

func (handlers *Handlers) postBackupsRestoreHandler(r *http.Request) (interface{}, error) {
	jsonBody := map[string]string{}
	if err := json.NewDecoder(r.Body).Decode(&jsonBody); err != nil {
		return nil, errp.WithStack(err)
	}
	didRestore, err := handlers.wallet.RestoreBackup(jsonBody["password"], jsonBody["filename"])
	if err != nil {
		return nil, err
	}
	return map[string]interface{}{"didRestore": didRestore}, nil
}

func (handlers *Handlers) postBackupsCreateHandler(r *http.Request) (interface{}, error) {
	jsonBody := map[string]string{}
	if err := json.NewDecoder(r.Body).Decode(&jsonBody); err != nil {
		return nil, errp.WithStack(err)
	}
	return nil, handlers.wallet.CreateBackup(jsonBody["backupName"])
}

func (handlers *Handlers) getWalletTransactions(r *http.Request) (interface{}, error) {
	result := []map[string]interface{}{}
	txs, err := handlers.wallet.Transactions()
	if err != nil {
		return nil, err
	}
	for _, tx := range txs {
		txType, txAmount, txFee, err := handlers.wallet.ClassifyTransaction(tx.TX)
		var feeString = ""
		if txFee != nil {
			feeString = txFee.String()
		}
		if err != nil {
			return nil, err
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
	balance, err := handlers.wallet.Balance()
	if err != nil {
		return nil, err
	}
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

	if err := handlers.wallet.SendTx(input.address, input.sendAmount, input.feeTargetCode); err != nil {
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

func (handlers *Handlers) getWalletState(r *http.Request) (interface{}, error) {
	return handlers.wallet.WalletState(), nil
}

func (handlers *Handlers) getWalletFeeTargets(r *http.Request) (interface{}, error) {
	feeTargets, defaultFeeTarget, err := handlers.wallet.FeeTargets()
	if err != nil {
		return nil, err
	}
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

func (handlers *Handlers) eventsHandler(w http.ResponseWriter, r *http.Request) {
	conn, err := handlers.websocketUpgrader.Upgrade(w, r, nil)
	if err != nil {
		panic(err)
	}

	sendChan, quitChan := runWebsocket(conn)
	go func() {
		for {
			select {
			case <-quitChan:
				return
			default:
				select {
				case <-quitChan:
					return
				case event := <-handlers.walletEvents:
					sendChan <- jsonp.MustMarshal(map[string]string{
						"type": event.Type,
						"data": event.Data,
					})
				}
			}
		}
	}()
}

func apiMiddleware(h func(*http.Request) (interface{}, error)) func(http.ResponseWriter, *http.Request) {
	return func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type", "text/json")
		// This enables us to run a server on a different port serving just the UI, while still
		// allowing it to access the API.
		w.Header().Set("Access-Control-Allow-Origin", "http://localhost:8080")
		value, err := h(r)
		if err != nil {
			writeJSON(w, map[string]string{"error": err.Error()})
			return
		}
		writeJSON(w, value)
	}
}
