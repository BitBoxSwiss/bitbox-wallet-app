package handlers

// The following go:generate command compiles the static web assets into a Go package, so that they
// are built into the binary. The WEBASSETS env var must be set and point to the folder containing
// the web assets.

//go:generate echo $WEBASSETS
//go:generate go-bindata -pkg $GOPACKAGE -o assets.go -prefix $WEBASSETS $WEBASSETS

import (
	"bytes"
	"encoding/json"
	"fmt"
	"net/http"
	"regexp"

	assetfs "github.com/elazarl/go-bindata-assetfs"
	"github.com/gorilla/mux"
	"github.com/gorilla/websocket"
	"github.com/shiftdevices/godbb/backend"
	walletHandlers "github.com/shiftdevices/godbb/coins/btc/handlers"
	"github.com/shiftdevices/godbb/devices/bitbox"
	bitboxHandlers "github.com/shiftdevices/godbb/devices/bitbox/handlers"
	"github.com/shiftdevices/godbb/util/jsonp"
	qrcode "github.com/skip2/go-qrcode"
)

// Handlers provides a web api to the backend.
type Handlers struct {
	Router  *mux.Router
	backend backend.Interface
	// apiPort is the port on which this API will run. It is fed into the static javascript app
	// that is served, so the client knows where to connect to.
	apiPort           int
	backendEvents     <-chan interface{}
	websocketUpgrader websocket.Upgrader
}

// NewHandlers creates a new Handlers instance.
func NewHandlers(
	theBackend backend.Interface,
	apiPort int,
) *Handlers {
	router := mux.NewRouter()
	handlers := &Handlers{
		Router:  router,
		backend: theBackend,
		apiPort: apiPort,
		websocketUpgrader: websocket.Upgrader{
			ReadBufferSize:  1024,
			WriteBufferSize: 1024,
			CheckOrigin:     func(r *http.Request) bool { return true },
		},
		backendEvents: theBackend.Start(),
	}

	getAPIRouter := func(subrouter *mux.Router) func(string, func(*http.Request) (interface{}, error)) *mux.Route {
		return func(path string, f func(*http.Request) (interface{}, error)) *mux.Route {
			return subrouter.HandleFunc(path, apiMiddleware(f))
		}
	}

	apiRouter := router.PathPrefix("/api").Subrouter()
	apiRouter.HandleFunc("/qr", handlers.getQRCode).Methods("GET")
	getAPIRouter(apiRouter)("/version", handlers.getVersion).Methods("GET")

	devicesRouter := getAPIRouter(apiRouter.PathPrefix("/devices").Subrouter())
	devicesRouter("/registered", handlers.getDevicesRegisteredHandler).Methods("GET")
	devicesRouter("/test/register", handlers.registerTestKeyStore).Methods("POST")
	devicesRouter("/test/deregister", handlers.deregisterTestKeyStore).Methods("POST")

	theWalletHandlers := map[string]*walletHandlers.Handlers{}
	for _, wallet := range theBackend.Wallets() {
		theWalletHandlers[wallet.Code] = walletHandlers.NewHandlers(getAPIRouter(
			apiRouter.PathPrefix(fmt.Sprintf("/wallet/%s", wallet.Code)).Subrouter()))
	}

	theBackend.OnWalletInit(func(wallet *backend.Wallet) {
		theWalletHandlers[wallet.Code].Init(wallet.Wallet)
	})
	theBackend.OnWalletUninit(func(wallet *backend.Wallet) {
		theWalletHandlers[wallet.Code].Uninit()
	})

	theDeviceHandlers := bitboxHandlers.NewHandlers(
		getAPIRouter(apiRouter.PathPrefix("/device").Subrouter()),
	)
	theBackend.OnDeviceInit(func(device bitbox.Interface) {
		theDeviceHandlers.Init(device)
	})
	theBackend.OnDeviceUninit(func() {
		theDeviceHandlers.Uninit()
	})

	apiRouter.HandleFunc("/events", handlers.eventsHandler)

	// Serve static files for the UI.
	router.Handle("/{rest:.*}",
		http.FileServer(&assetfs.AssetFS{
			Asset: func(name string) ([]byte, error) {
				body, err := Asset(name)
				if err != nil {
					return nil, err
				}
				if regexp.MustCompile(`^bundle.*\.js$`).MatchString(name) {
					body = handlers.interpolateConstants(body)
				}
				return body, nil
			},
			AssetDir:  AssetDir,
			AssetInfo: AssetInfo,
			Prefix:    "",
		}))

	return handlers
}

func (handlers *Handlers) interpolateConstants(body []byte) []byte {
	for _, info := range []struct {
		key, value string
	}{
		{"API_PORT", fmt.Sprintf("%d", handlers.apiPort)},
		{"LANG", handlers.backend.UserLanguage().String()},
	} {
		body = bytes.Replace(body, []byte(fmt.Sprintf("{{ %s }}", info.key)), []byte(info.value), -1)
	}
	return body
}

func writeJSON(w http.ResponseWriter, value interface{}) {
	if err := json.NewEncoder(w).Encode(value); err != nil {
		panic(err)
	}
}

func (handlers *Handlers) getVersion(_ *http.Request) (interface{}, error) {
	return backend.Version.String(), nil
}

func (handlers *Handlers) getQRCode(w http.ResponseWriter, r *http.Request) {
	data := r.URL.Query().Get("data")
	qr, err := qrcode.New(data, qrcode.Medium)
	if err != nil {
		w.WriteHeader(http.StatusInternalServerError)
		return
	}
	w.Header().Set("Content-Type", "image/png")
	_ = qr.Write(256, w)
}

func (handlers *Handlers) getDevicesRegisteredHandler(_ *http.Request) (interface{}, error) {
	return handlers.backend.DeviceRegistered(), nil
}

func (handlers *Handlers) registerTestKeyStore(_ *http.Request) (interface{}, error) {
	keyStore, err := backend.NewSoftwareBasedKeyStore()
	if err != nil {
		return nil, err
	}
	return nil, handlers.backend.Register(keyStore)
}

func (handlers *Handlers) deregisterTestKeyStore(_ *http.Request) (interface{}, error) {
	handlers.backend.Deregister(backend.DeviceID)
	return true, nil
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
				case event := <-handlers.backendEvents:
					sendChan <- jsonp.MustMarshal(event)
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
