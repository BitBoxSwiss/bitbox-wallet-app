package handlers

import (
	"bytes"
	"encoding/json"
	"fmt"
	"net/http"
	"regexp"

	assetfs "github.com/elazarl/go-bindata-assetfs"
	"github.com/gorilla/mux"
	"github.com/gorilla/websocket"
	"github.com/shiftdevices/godbb/deterministicwallet"
	walletHandlers "github.com/shiftdevices/godbb/deterministicwallet/handlers"
	"github.com/shiftdevices/godbb/knot"
	"github.com/shiftdevices/godbb/knot/binweb"
	"github.com/shiftdevices/godbb/util/errp"
	"github.com/shiftdevices/godbb/util/jsonp"
	qrcode "github.com/skip2/go-qrcode"
)

type KnotInterface interface {
	XPub() (string, error)
	DeviceState() string
	Reset() (bool, error)
	OnWalletInit(f func(deterministicwallet.Interface))
	OnWalletUninit(f func())
	Login(string) error
	SetPassword(string) error
	CreateWallet(string) error
	BackupList() (bool, []string, error)
	EraseBackup(string) error
	RestoreBackup(string, string) (bool, error)
	CreateBackup(string) error
	Start() <-chan knot.Event
}

type Handlers struct {
	Router *mux.Router
	knot   KnotInterface
	// apiPort is the port on which this API will run. It is fed into the static javascript app
	// that is served, so the client knows where to connect to.
	apiPort           int
	knotEvents        <-chan knot.Event
	websocketUpgrader websocket.Upgrader
}

func NewHandlers(
	knot KnotInterface,
	apiPort int,
) *Handlers {
	router := mux.NewRouter()
	handlers := &Handlers{
		Router:  router,
		knot:    knot,
		apiPort: apiPort,
		websocketUpgrader: websocket.Upgrader{
			ReadBufferSize:  1024,
			WriteBufferSize: 1024,
			CheckOrigin:     func(r *http.Request) bool { return true },
		},
		knotEvents: knot.Start(),
	}

	getApiRouter := func(subrouter *mux.Router) func(string, func(*http.Request) (interface{}, error)) *mux.Route {
		return func(path string, f func(*http.Request) (interface{}, error)) *mux.Route {
			return subrouter.HandleFunc(path, apiMiddleware(f))
		}

	}

	apiRouter := router.PathPrefix("/api").Subrouter()
	apiHandleFunc := getApiRouter(apiRouter)
	apiRouter.HandleFunc("/qr", handlers.getQRCode).Methods("GET")
	apiHandleFunc("/xpub", handlers.getXPubHandler).Methods("GET")
	apiHandleFunc("/deviceState", handlers.getDeviceStateHandler).Methods("GET")
	apiHandleFunc("/reset-device", handlers.postResetDeviceHandler).Methods("POST")
	apiHandleFunc("/login", handlers.postLoginHandler).Methods("POST")
	apiHandleFunc("/set-password", handlers.postSetPasswordHandler).Methods("POST")
	apiHandleFunc("/create-wallet", handlers.postCreateWalletHandler).Methods("POST")

	apiHandleFunc("/backups/list", handlers.getBackupListHandler).Methods("GET")
	apiHandleFunc("/backups/erase", handlers.postBackupsEraseHandler).Methods("POST")
	apiHandleFunc("/backups/restore", handlers.postBackupsRestoreHandler).Methods("POST")
	apiHandleFunc("/backups/create", handlers.postBackupsCreateHandler).Methods("POST")

	walletHandlers_ := walletHandlers.NewHandlers(
		getApiRouter(apiRouter.PathPrefix("/wallet/btc").Subrouter()),
	)
	knot.OnWalletInit(func(wallet deterministicwallet.Interface) {
		walletHandlers_.Init(wallet)
	})
	knot.OnWalletUninit(func() {
		walletHandlers_.Uninit()
	})

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

func (handlers *Handlers) getQRCode(w http.ResponseWriter, r *http.Request) {
	data := r.URL.Query().Get("data")
	qr, err := qrcode.New(data, qrcode.Medium)
	if err != nil {
		w.WriteHeader(http.StatusInternalServerError)
		return
	}
	w.Header().Set("Content-Type", "image/png")
	qr.Write(256, w)
}

func (handlers *Handlers) getXPubHandler(r *http.Request) (interface{}, error) {
	return handlers.knot.XPub()
}

func (handlers *Handlers) getDeviceStateHandler(r *http.Request) (interface{}, error) {
	return handlers.knot.DeviceState(), nil
}

func (handlers *Handlers) postResetDeviceHandler(r *http.Request) (interface{}, error) {
	didReset, err := handlers.knot.Reset()
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
	if err := handlers.knot.Login(password); err != nil {
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
	if err := handlers.knot.SetPassword(password); err != nil {
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
	if err := handlers.knot.CreateWallet(walletName); err != nil {
		return map[string]interface{}{"success": false, "errorMessage": err.Error()}, nil
	}
	return map[string]interface{}{"success": true}, nil
}

func (handlers *Handlers) getBackupListHandler(r *http.Request) (interface{}, error) {
	sdCardInserted, backupList, err := handlers.knot.BackupList()
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
	return nil, handlers.knot.EraseBackup(filename)
}

func (handlers *Handlers) postBackupsRestoreHandler(r *http.Request) (interface{}, error) {
	jsonBody := map[string]string{}
	if err := json.NewDecoder(r.Body).Decode(&jsonBody); err != nil {
		return nil, errp.WithStack(err)
	}
	didRestore, err := handlers.knot.RestoreBackup(jsonBody["password"], jsonBody["filename"])
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
	return nil, handlers.knot.CreateBackup(jsonBody["backupName"])
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
				case event := <-handlers.knotEvents:
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
