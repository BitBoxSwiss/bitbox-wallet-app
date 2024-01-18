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
	"bytes"
	"encoding/base64"
	"encoding/json"
	"fmt"
	"io"
	"math/big"
	"net/http"
	"runtime/debug"

	"github.com/digitalbitbox/bitbox-wallet-app/backend"
	"github.com/digitalbitbox/bitbox-wallet-app/backend/accounts"
	accountsTypes "github.com/digitalbitbox/bitbox-wallet-app/backend/accounts/types"
	"github.com/digitalbitbox/bitbox-wallet-app/backend/banners"
	"github.com/digitalbitbox/bitbox-wallet-app/backend/bitsurance"
	"github.com/digitalbitbox/bitbox-wallet-app/backend/coins/btc"
	accountHandlers "github.com/digitalbitbox/bitbox-wallet-app/backend/coins/btc/handlers"
	"github.com/digitalbitbox/bitbox-wallet-app/backend/coins/btc/util"
	"github.com/digitalbitbox/bitbox-wallet-app/backend/coins/coin"
	coinpkg "github.com/digitalbitbox/bitbox-wallet-app/backend/coins/coin"
	"github.com/digitalbitbox/bitbox-wallet-app/backend/coins/eth"
	"github.com/digitalbitbox/bitbox-wallet-app/backend/config"
	"github.com/digitalbitbox/bitbox-wallet-app/backend/devices/bitbox"
	bitboxHandlers "github.com/digitalbitbox/bitbox-wallet-app/backend/devices/bitbox/handlers"
	"github.com/digitalbitbox/bitbox-wallet-app/backend/devices/bitbox02"
	bitbox02Handlers "github.com/digitalbitbox/bitbox-wallet-app/backend/devices/bitbox02/handlers"
	"github.com/digitalbitbox/bitbox-wallet-app/backend/devices/bitbox02bootloader"
	bitbox02bootloaderHandlers "github.com/digitalbitbox/bitbox-wallet-app/backend/devices/bitbox02bootloader/handlers"
	"github.com/digitalbitbox/bitbox-wallet-app/backend/devices/device"
	"github.com/digitalbitbox/bitbox-wallet-app/backend/exchanges"
	"github.com/digitalbitbox/bitbox-wallet-app/backend/keystore"
	"github.com/digitalbitbox/bitbox-wallet-app/backend/rates"
	utilConfig "github.com/digitalbitbox/bitbox-wallet-app/util/config"
	"github.com/digitalbitbox/bitbox-wallet-app/util/errp"
	"github.com/digitalbitbox/bitbox-wallet-app/util/jsonp"
	"github.com/digitalbitbox/bitbox-wallet-app/util/locker"
	"github.com/digitalbitbox/bitbox-wallet-app/util/logging"
	"github.com/digitalbitbox/bitbox-wallet-app/util/observable"
	"github.com/digitalbitbox/bitbox-wallet-app/util/socksproxy"
	"github.com/gorilla/mux"
	"github.com/gorilla/websocket"
	"github.com/sirupsen/logrus"
	qrcode "github.com/skip2/go-qrcode"
)

// Backend models the API of the backend.
type Backend interface {
	observable.Interface

	Config() *config.Config
	DevServers() bool
	DefaultAppConfig() config.AppConfig
	Coin(coinpkg.Code) (coinpkg.Coin, error)
	Testing() bool
	Accounts() backend.AccountsList
	Keystore() keystore.Keystore
	OnAccountInit(f func(accounts.Interface))
	OnAccountUninit(f func(accounts.Interface))
	OnDeviceInit(f func(device.Interface))
	OnDeviceUninit(f func(deviceID string))
	DevicesRegistered() map[string]device.Interface
	Start() <-chan interface{}
	DeregisterKeystore()
	Register(device device.Interface) error
	Deregister(deviceID string)
	RatesUpdater() *rates.RateUpdater
	DownloadCert(string) (string, error)
	CheckElectrumServer(*config.ServerInfo) error
	RegisterTestKeystore(string)
	NotifyUser(string)
	SystemOpen(string) error
	ReinitializeAccounts()
	CheckForUpdateIgnoringErrors() *backend.UpdateFile
	Banners() *banners.Banners
	Environment() backend.Environment
	ChartData() (*backend.Chart, error)
	SupportedCoins(keystore.Keystore) []coinpkg.Code
	CanAddAccount(coinpkg.Code, keystore.Keystore) (string, bool)
	CreateAndPersistAccountConfig(coinCode coinpkg.Code, name string, keystore keystore.Keystore) (accountsTypes.Code, error)
	SetAccountActive(accountCode accountsTypes.Code, active bool) error
	SetTokenActive(accountCode accountsTypes.Code, tokenCode string, active bool) error
	RenameAccount(accountCode accountsTypes.Code, name string) error
	// disabling for now, we'll either bring this back (if user request it) or remove for good
	// AccountSetWatch(filter func(*config.Account) bool, watch *bool) error
	AOPP() backend.AOPP
	AOPPCancel()
	AOPPApprove()
	AOPPChooseAccount(code accountsTypes.Code)
	GetAccountFromCode(code accountsTypes.Code) (accounts.Interface, error)
	HTTPClient() *http.Client
	LookupInsuredAccounts(accountCode accountsTypes.Code) ([]bitsurance.AccountDetails, error)
	Authenticate(force bool)
	TriggerAuth()
	ForceAuth()
	CancelConnectKeystore()
	SetWatchonly(rootFingerprint []byte, watchonly bool) error
	LookupEthAccountCode(address string) (accountsTypes.Code, string, error)
}

// Handlers provides a web api to the backend.
type Handlers struct {
	Router  *mux.Router
	backend Backend
	// apiData consists of the port on which this API will run and the authorization token, generated by the
	// backend to secure the API call. The data is fed into the static javascript app
	// that is served, so the client knows where and how to connect to.
	apiData           *ConnectionData
	backendEvents     chan interface{}
	websocketUpgrader websocket.Upgrader
	log               *logrus.Entry
}

// ConnectionData contains the port and authorization token for communication with the backend.
type ConnectionData struct {
	port    int
	token   string
	devMode bool
}

// NewConnectionData creates a connection data struct which holds the port and token for the API.
// If the port is -1 or the token is empty, we assume dev-mode.
func NewConnectionData(port int, token string) *ConnectionData {
	return &ConnectionData{
		port:    port,
		token:   token,
		devMode: len(token) == 0,
	}
}

func (connectionData *ConnectionData) isDev() bool {
	return connectionData.port == -1 || connectionData.token == ""
}

// NewHandlers creates a new Handlers instance.
func NewHandlers(
	backend Backend,
	connData *ConnectionData,
) *Handlers {
	log := logging.Get().WithGroup("handlers")
	router := mux.NewRouter()
	handlers := &Handlers{
		Router:        router,
		backend:       backend,
		apiData:       connData,
		backendEvents: make(chan interface{}, 1000),
		websocketUpgrader: websocket.Upgrader{
			ReadBufferSize:  1024,
			WriteBufferSize: 1024,
			CheckOrigin:     func(r *http.Request) bool { return true },
		},
		log: logging.Get().WithGroup("handlers"),
	}

	getAPIRouter := func(subrouter *mux.Router) func(string, func(*http.Request) (interface{}, error)) *mux.Route {
		return func(path string, f func(*http.Request) (interface{}, error)) *mux.Route {
			return subrouter.Handle(path, ensureAPITokenValid(handlers.apiMiddleware(connData.isDev(), f),
				connData, log))
		}
	}

	// Prefer this over `getAPIRouter` and return errors using the `{ success: false, ...}` pattern.
	getAPIRouterNoError := func(subrouter *mux.Router) func(string, func(*http.Request) interface{}) *mux.Route {
		return func(path string, f func(*http.Request) interface{}) *mux.Route {
			return subrouter.Handle(
				path,
				ensureAPITokenValid(
					handlers.apiMiddleware(
						connData.isDev(),
						func(r *http.Request) (interface{}, error) {
							return f(r), nil
						}),
					connData, log))
		}
	}

	apiRouter := router.PathPrefix("/api").Subrouter()
	getAPIRouterNoError(apiRouter)("/qr", handlers.getQRCodeHandler).Methods("GET")
	getAPIRouterNoError(apiRouter)("/config", handlers.getAppConfigHandler).Methods("GET")
	getAPIRouterNoError(apiRouter)("/config/default", handlers.getDefaultConfigHandler).Methods("GET")
	getAPIRouter(apiRouter)("/config", handlers.postAppConfigHandler).Methods("POST")
	getAPIRouterNoError(apiRouter)("/native-locale", handlers.getNativeLocaleHandler).Methods("GET")
	getAPIRouter(apiRouter)("/notify-user", handlers.postNotifyHandler).Methods("POST")
	getAPIRouter(apiRouter)("/open", handlers.postOpenHandler).Methods("POST")
	getAPIRouterNoError(apiRouter)("/update", handlers.getUpdateHandler).Methods("GET")
	getAPIRouterNoError(apiRouter)("/banners/{key}", handlers.getBannersHandler).Methods("GET")
	getAPIRouterNoError(apiRouter)("/using-mobile-data", handlers.getUsingMobileDataHandler).Methods("GET")
	getAPIRouterNoError(apiRouter)("/authenticate", handlers.postAuthenticateHandler).Methods("POST")
	getAPIRouterNoError(apiRouter)("/trigger-auth", handlers.postTriggerAuthHandler).Methods("POST")
	getAPIRouterNoError(apiRouter)("/force-auth", handlers.postForceAuthHandler).Methods("POST")
	getAPIRouter(apiRouter)("/set-dark-theme", handlers.postDarkThemeHandler).Methods("POST")
	getAPIRouterNoError(apiRouter)("/detect-dark-theme", handlers.getDetectDarkThemeHandler).Methods("GET")
	getAPIRouterNoError(apiRouter)("/version", handlers.getVersionHandler).Methods("GET")
	getAPIRouterNoError(apiRouter)("/testing", handlers.getTestingHandler).Methods("GET")
	getAPIRouterNoError(apiRouter)("/account-add", handlers.postAddAccountHandler).Methods("POST")
	getAPIRouterNoError(apiRouter)("/keystores", handlers.getKeystoresHandler).Methods("GET")
	getAPIRouterNoError(apiRouter)("/accounts", handlers.getAccountsHandler).Methods("GET")
	getAPIRouter(apiRouter)("/accounts/total-balance", handlers.getAccountsTotalBalanceHandler).Methods("GET")
	getAPIRouterNoError(apiRouter)("/set-account-active", handlers.postSetAccountActiveHandler).Methods("POST")
	getAPIRouterNoError(apiRouter)("/set-token-active", handlers.postSetTokenActiveHandler).Methods("POST")
	getAPIRouterNoError(apiRouter)("/rename-account", handlers.postRenameAccountHandler).Methods("POST")
	// disabling for now, we'll either bring this back (if user request it) or remove for good
	// getAPIRouterNoError(apiRouter)("/account-set-watch", handlers.postAccountSetWatchHandler).Methods("POST")
	getAPIRouterNoError(apiRouter)("/accounts/reinitialize", handlers.postAccountsReinitializeHandler).Methods("POST")
	getAPIRouter(apiRouter)("/account-summary", handlers.getAccountSummary).Methods("GET")
	getAPIRouterNoError(apiRouter)("/supported-coins", handlers.getSupportedCoinsHandler).Methods("GET")
	getAPIRouter(apiRouter)("/test/register", handlers.postRegisterTestKeystoreHandler).Methods("POST")
	getAPIRouterNoError(apiRouter)("/test/deregister", handlers.postDeregisterTestKeystoreHandler).Methods("POST")
	getAPIRouterNoError(apiRouter)("/rates", handlers.getRatesHandler).Methods("GET")
	getAPIRouterNoError(apiRouter)("/coins/convert-to-plain-fiat", handlers.getConvertToPlainFiatHandler).Methods("GET")
	getAPIRouterNoError(apiRouter)("/coins/convert-from-fiat", handlers.getConvertFromFiatHandler).Methods("GET")
	getAPIRouter(apiRouter)("/coins/tltc/headers/status", handlers.getHeadersStatus(coinpkg.CodeTLTC)).Methods("GET")
	getAPIRouter(apiRouter)("/coins/tbtc/headers/status", handlers.getHeadersStatus(coinpkg.CodeTBTC)).Methods("GET")
	getAPIRouter(apiRouter)("/coins/ltc/headers/status", handlers.getHeadersStatus(coinpkg.CodeLTC)).Methods("GET")
	getAPIRouter(apiRouter)("/coins/btc/headers/status", handlers.getHeadersStatus(coinpkg.CodeBTC)).Methods("GET")
	getAPIRouterNoError(apiRouter)("/coins/btc/set-unit", handlers.postBtcFormatUnit).Methods("POST")
	getAPIRouterNoError(apiRouter)("/coins/btc/parse-external-amount", handlers.getBTCParseExternalAmount).Methods("GET")
	getAPIRouterNoError(apiRouter)("/certs/download", handlers.postCertsDownloadHandler).Methods("POST")
	getAPIRouterNoError(apiRouter)("/electrum/check", handlers.postElectrumCheckHandler).Methods("POST")
	getAPIRouterNoError(apiRouter)("/socksproxy/check", handlers.postSocksProxyCheck).Methods("POST")
	getAPIRouterNoError(apiRouter)("/exchange/by-region/{code}", handlers.getExchangesByRegion).Methods("GET")
	getAPIRouterNoError(apiRouter)("/exchange/deals", handlers.getExchangeDeals).Methods("GET")
	getAPIRouter(apiRouter)("/exchange/buy-supported/{code}", handlers.getExchangeBuySupported).Methods("GET")
	getAPIRouter(apiRouter)("/exchange/moonpay/buy-info/{code}", handlers.getExchangeMoonpayBuyInfo).Methods("GET")
	getAPIRouterNoError(apiRouter)("/exchange/pocket/api-url", handlers.getExchangePocketURL).Methods("GET")
	getAPIRouterNoError(apiRouter)("/exchange/pocket/verify-address", handlers.postPocketWidgetVerifyAddress).Methods("POST")
	getAPIRouterNoError(apiRouter)("/bitsurance/lookup", handlers.postBitsuranceLookup).Methods("POST")
	getAPIRouterNoError(apiRouter)("/bitsurance/url", handlers.getBitsuranceURL).Methods("GET")
	getAPIRouterNoError(apiRouter)("/aopp", handlers.getAOPPHandler).Methods("GET")
	getAPIRouterNoError(apiRouter)("/aopp/cancel", handlers.postAOPPCancelHandler).Methods("POST")
	getAPIRouterNoError(apiRouter)("/aopp/approve", handlers.postAOPPApproveHandler).Methods("POST")
	getAPIRouter(apiRouter)("/aopp/choose-account", handlers.postAOPPChooseAccountHandler).Methods("POST")
	getAPIRouterNoError(apiRouter)("/cancel-connect-keystore", handlers.postCancelConnectKeystoreHandler).Methods("POST")
	getAPIRouterNoError(apiRouter)("/set-watchonly", handlers.postSetWatchonlyHandler).Methods("POST")
	getAPIRouterNoError(apiRouter)("/on-auth-setting-changed", handlers.postOnAuthSettingChangedHandler).Methods("POST")
	getAPIRouterNoError(apiRouter)("/accounts/eth-account-code", handlers.lookupEthAccountCode).Methods("POST")

	devicesRouter := getAPIRouterNoError(apiRouter.PathPrefix("/devices").Subrouter())
	devicesRouter("/registered", handlers.getDevicesRegisteredHandler).Methods("GET")

	handlersMapLock := locker.Locker{}

	accountHandlersMap := map[accountsTypes.Code]*accountHandlers.Handlers{}
	getAccountHandlers := func(accountCode accountsTypes.Code) *accountHandlers.Handlers {
		defer handlersMapLock.Lock()()
		if _, ok := accountHandlersMap[accountCode]; !ok {
			accountHandlersMap[accountCode] = accountHandlers.NewHandlers(getAPIRouter(
				apiRouter.PathPrefix(fmt.Sprintf("/account/%s", accountCode)).Subrouter(),
			), log)
		}
		accHandlers := accountHandlersMap[accountCode]
		log.WithField("account-handlers", accHandlers).Debug("Account handlers")
		return accHandlers
	}

	backend.OnAccountInit(func(account accounts.Interface) {
		log.WithField("code", account.Config().Config.Code).Debug("Initializing account")
		getAccountHandlers(account.Config().Config.Code).Init(account)
	})
	backend.OnAccountUninit(func(account accounts.Interface) {
		getAccountHandlers(account.Config().Config.Code).Uninit()
	})

	deviceHandlersMap := map[string]*bitboxHandlers.Handlers{}
	getDeviceHandlers := func(deviceID string) *bitboxHandlers.Handlers {
		defer handlersMapLock.Lock()()
		if _, ok := deviceHandlersMap[deviceID]; !ok {
			deviceHandlersMap[deviceID] = bitboxHandlers.NewHandlers(getAPIRouter(
				apiRouter.PathPrefix(fmt.Sprintf("/devices/%s", deviceID)).Subrouter(),
			), log)
		}
		return deviceHandlersMap[deviceID]
	}

	bitbox02HandlersMap := map[string]*bitbox02Handlers.Handlers{}
	getBitBox02Handlers := func(deviceID string) *bitbox02Handlers.Handlers {
		defer handlersMapLock.Lock()()
		if _, ok := bitbox02HandlersMap[deviceID]; !ok {
			bitbox02HandlersMap[deviceID] = bitbox02Handlers.NewHandlers(getAPIRouterNoError(
				apiRouter.PathPrefix(fmt.Sprintf("/devices/bitbox02/%s", deviceID)).Subrouter(),
			), log)
		}
		return bitbox02HandlersMap[deviceID]
	}

	bitbox02BootloaderHandlersMap := map[string]*bitbox02bootloaderHandlers.Handlers{}
	getBitBox02BootloaderHandlers := func(deviceID string) *bitbox02bootloaderHandlers.Handlers {
		defer handlersMapLock.Lock()()
		if _, ok := bitbox02BootloaderHandlersMap[deviceID]; !ok {
			bitbox02BootloaderHandlersMap[deviceID] = bitbox02bootloaderHandlers.NewHandlers(getAPIRouter(
				apiRouter.PathPrefix(fmt.Sprintf("/devices/bitbox02-bootloader/%s", deviceID)).Subrouter(),
			), log)
		}
		return bitbox02BootloaderHandlersMap[deviceID]
	}

	backend.OnDeviceInit(func(device device.Interface) {
		switch specificDevice := device.(type) {
		case *bitbox.Device:
			getDeviceHandlers(device.Identifier()).Init(specificDevice)
		case *bitbox02.Device:
			getBitBox02Handlers(device.Identifier()).Init(specificDevice)
		case *bitbox02bootloader.Device:
			getBitBox02BootloaderHandlers(device.Identifier()).Init(specificDevice)
		}
	})
	backend.OnDeviceUninit(func(deviceID string) {
		getDeviceHandlers(deviceID).Uninit()
	})

	apiRouter.HandleFunc("/events", handlers.eventsHandler)

	// The backend relays events in two ways:
	// a) old school through the channel returned by Start()
	// b) new school via observable.
	// Merge both.
	events := backend.Start()
	go func() {
		for {
			handlers.backendEvents <- <-events
		}
	}()
	backend.Observe(func(event observable.Event) { handlers.backendEvents <- event })

	return handlers
}

// Events returns the push notifications channel.
func (handlers *Handlers) Events() <-chan interface{} {
	return handlers.backendEvents
}

func writeJSON(w io.Writer, value interface{}) {
	if err := json.NewEncoder(w).Encode(value); err != nil {
		panic(err)
	}
}

type activeToken struct {
	// TokenCode is the token code as defined in erc20.go, e.g. "eth-erc20-usdt".
	TokenCode string `json:"tokenCode"`
	// AccountCode is the code of the account, which is not the same as the TokenCode, as there can
	// be many accounts for the same token.
	AccountCode accountsTypes.Code `json:"accountCode"`
}

type keystoreJSON struct {
	config.Keystore
	Connected bool `json:"connected"`
}

type accountJSON struct {
	// Multiple accounts can belong to the same keystore. For now we replicate the keystore info in
	// the accounts. In the future the getAccountsHandler() could return the accounts grouped
	// keystore.
	Keystore              keystoreJSON       `json:"keystore"`
	Active                bool               `json:"active"`
	BitsuranceStatus      string             `json:"bitsuranceStatus"`
	Watch                 bool               `json:"watch"`
	CoinCode              coinpkg.Code       `json:"coinCode"`
	CoinUnit              string             `json:"coinUnit"`
	CoinName              string             `json:"coinName"`
	Code                  accountsTypes.Code `json:"code"`
	Name                  string             `json:"name"`
	IsToken               bool               `json:"isToken"`
	ActiveTokens          []activeToken      `json:"activeTokens,omitempty"`
	BlockExplorerTxPrefix string             `json:"blockExplorerTxPrefix"`
}

func newAccountJSON(
	keystore config.Keystore,
	account accounts.Interface,
	activeTokens []activeToken,
	keystoreConnected bool) *accountJSON {
	eth, ok := account.Coin().(*eth.Coin)
	isToken := ok && eth.ERC20Token() != nil
	watch := account.Config().Config.Watch
	return &accountJSON{
		Keystore: keystoreJSON{
			Keystore:  keystore,
			Connected: keystoreConnected,
		},
		Active:                !account.Config().Config.Inactive,
		BitsuranceStatus:      account.Config().Config.InsuranceStatus,
		Watch:                 watch != nil && *watch,
		CoinCode:              account.Coin().Code(),
		CoinUnit:              account.Coin().Unit(false),
		CoinName:              account.Coin().Name(),
		Code:                  account.Config().Config.Code,
		Name:                  account.Config().Config.Name,
		IsToken:               isToken,
		ActiveTokens:          activeTokens,
		BlockExplorerTxPrefix: account.Coin().BlockExplorerTransactionURLPrefix(),
	}
}

func (handlers *Handlers) getQRCodeHandler(r *http.Request) interface{} {
	type result struct {
		Success bool   `json:"success"`
		Message string `json:"message"`
		Data    string `json:"data"`
	}
	data := r.URL.Query().Get("data")
	qr, err := qrcode.New(data, qrcode.Medium)
	if err != nil {
		handlers.log.WithError(err).Error("getQRCodeHandler")
		return result{Success: false, Message: err.Error()}
	}
	bytes, err := qr.PNG(256)
	if err != nil {
		handlers.log.WithError(err).Error("getQRCodeHandler")
		return result{Success: false, Message: err.Error()}
	}
	return result{
		Success: true,
		Data:    "data:image/png;base64," + base64.StdEncoding.EncodeToString(bytes),
	}
}

func (handlers *Handlers) getAppConfigHandler(_ *http.Request) interface{} {
	return handlers.backend.Config().AppConfig()
}

func (handlers *Handlers) getDefaultConfigHandler(_ *http.Request) interface{} {
	return handlers.backend.DefaultAppConfig()
}

func (handlers *Handlers) postAppConfigHandler(r *http.Request) (interface{}, error) {
	appConfig := config.AppConfig{}
	if err := json.NewDecoder(r.Body).Decode(&appConfig); err != nil {
		return nil, errp.WithStack(err)
	}
	return nil, handlers.backend.Config().SetAppConfig(appConfig)
}

// getNativeLocaleHandler returns user preferred UI language as reported
// by the native app layer.
// The response value may be invalid or unsupported by the app.
func (handlers *Handlers) getNativeLocaleHandler(*http.Request) interface{} {
	return handlers.backend.Environment().NativeLocale()
}

func (handlers *Handlers) postNotifyHandler(r *http.Request) (interface{}, error) {
	payload := struct {
		Text string `json:"text"`
	}{}
	if err := json.NewDecoder(r.Body).Decode(&payload); err != nil {
		return nil, errp.WithStack(err)
	}
	handlers.backend.NotifyUser(payload.Text)
	return nil, nil
}

func (handlers *Handlers) postOpenHandler(r *http.Request) (interface{}, error) {
	var url string
	if err := json.NewDecoder(r.Body).Decode(&url); err != nil {
		return nil, errp.WithStack(err)
	}
	return nil, handlers.backend.SystemOpen(url)
}

func (handlers *Handlers) getUpdateHandler(_ *http.Request) interface{} {
	return handlers.backend.CheckForUpdateIgnoringErrors()
}

func (handlers *Handlers) getBannersHandler(r *http.Request) interface{} {
	return handlers.backend.Banners().GetMessage(banners.MessageKey(mux.Vars(r)["key"]))
}

func (handlers *Handlers) getUsingMobileDataHandler(r *http.Request) interface{} {
	return handlers.backend.Environment().UsingMobileData()
}

func (handlers *Handlers) postAuthenticateHandler(r *http.Request) interface{} {
	var force bool
	if err := json.NewDecoder(r.Body).Decode(&force); err != nil {
		return map[string]interface{}{
			"success":      false,
			"errorMessage": err.Error(),
		}
	}

	handlers.backend.Authenticate(force)
	return nil
}

func (handlers *Handlers) postTriggerAuthHandler(r *http.Request) interface{} {
	handlers.backend.TriggerAuth()
	return nil
}

func (handlers *Handlers) postForceAuthHandler(r *http.Request) interface{} {
	handlers.backend.ForceAuth()
	return nil
}

func (handlers *Handlers) postDarkThemeHandler(r *http.Request) (interface{}, error) {
	var isDark bool
	if err := json.NewDecoder(r.Body).Decode(&isDark); err != nil {
		return nil, errp.WithStack(err)
	}
	handlers.backend.Environment().SetDarkTheme(isDark)
	return nil, nil
}

func (handlers *Handlers) getDetectDarkThemeHandler(r *http.Request) interface{} {
	return handlers.backend.Environment().DetectDarkTheme()
}

func (handlers *Handlers) getVersionHandler(_ *http.Request) interface{} {
	return backend.Version.String()
}

func (handlers *Handlers) getTestingHandler(_ *http.Request) interface{} {
	return handlers.backend.Testing()
}

func (handlers *Handlers) postAddAccountHandler(r *http.Request) interface{} {
	var jsonBody struct {
		CoinCode coinpkg.Code `json:"coinCode"`
		Name     string       `json:"name"`
	}

	type response struct {
		Success      bool               `json:"success"`
		AccountCode  accountsTypes.Code `json:"accountCode,omitempty"`
		ErrorMessage string             `json:"errorMessage,omitempty"`
		ErrorCode    string             `json:"errorCode,omitempty"`
	}

	if err := json.NewDecoder(r.Body).Decode(&jsonBody); err != nil {
		return response{Success: false, ErrorMessage: err.Error()}
	}

	keystore := handlers.backend.Keystore()
	if keystore == nil {
		return response{Success: false, ErrorMessage: "Keystore not found"}
	}

	accountCode, err := handlers.backend.CreateAndPersistAccountConfig(jsonBody.CoinCode, jsonBody.Name, keystore)
	if err != nil {
		handlers.log.WithError(err).Error("Could not add account")
		if errCode, ok := errp.Cause(err).(errp.ErrorCode); ok {
			return response{Success: false, ErrorCode: string(errCode)}
		}
		return response{Success: false, ErrorMessage: err.Error()}
	}
	return response{Success: true, AccountCode: accountCode}
}

func (handlers *Handlers) getKeystoresHandler(_ *http.Request) interface{} {
	type json struct {
		Type keystore.Type `json:"type"`
	}
	keystores := []*json{}

	keystore := handlers.backend.Keystore()
	if keystore != nil {
		keystores = append(keystores, &json{
			Type: keystore.Type(),
		})
	}
	return keystores
}

func (handlers *Handlers) getAccountsHandler(_ *http.Request) interface{} {
	persistedAccounts := handlers.backend.Config().AccountsConfig()

	accounts := []*accountJSON{}
	for _, account := range handlers.backend.Accounts() {
		if account.Config().Config.HiddenBecauseUnused {
			continue
		}
		var activeTokens []activeToken

		persistedAccount := account.Config().Config
		if account.Coin().Code() == coinpkg.CodeETH {
			for _, tokenCode := range persistedAccount.ActiveTokens {
				activeTokens = append(activeTokens, activeToken{
					TokenCode:   tokenCode,
					AccountCode: backend.Erc20AccountCode(account.Config().Config.Code, tokenCode),
				})
			}
		}

		rootFingerprint, err := persistedAccount.SigningConfigurations.RootFingerprint()
		if err != nil {
			handlers.log.WithField("code", account.Config().Config.Code).Error("could not identify root fingerprint")
			continue
		}
		keystore, err := persistedAccounts.LookupKeystore(rootFingerprint)
		if err != nil {
			handlers.log.WithField("code", account.Config().Config.Code).Error("could not find keystore of account")
			continue
		}

		keystoreConnected := false
		if connectedKeystore := handlers.backend.Keystore(); connectedKeystore != nil {
			connectedKeystoreRootFingerprint, err := connectedKeystore.RootFingerprint()
			if err != nil {
				handlers.log.WithError(err).Error("Could not retrieve rootFingerprint")
			} else {
				keystoreConnected = bytes.Equal(rootFingerprint, connectedKeystoreRootFingerprint)
			}
		}

		accounts = append(accounts, newAccountJSON(*keystore, account, activeTokens, keystoreConnected))
	}
	return accounts
}

func (handlers *Handlers) lookupEthAccountCode(r *http.Request) interface{} {
	var args struct {
		Address string `json:"address"`
	}
	type response struct {
		Success      bool               `json:"success"`
		Code         accountsTypes.Code `json:"code"`
		Name         string             `json:"name"`
		ErrorMessage string             `json:"errorMessage"`
	}
	if err := json.NewDecoder(r.Body).Decode(&args); err != nil {
		return response{Success: false, ErrorMessage: err.Error()}
	}
	code, name, err := handlers.backend.LookupEthAccountCode(args.Address)
	if err != nil {
		return response{
			Success:      false,
			ErrorMessage: err.Error(),
		}
	}
	return response{
		Success: true,
		Code:    code,
		Name:    name,
	}
}

func (handlers *Handlers) postBtcFormatUnit(r *http.Request) interface{} {
	type response struct {
		Success      bool   `json:"success"`
		ErrorMessage string `json:"errorMessage,omitempty"`
	}

	var request struct {
		Unit coinpkg.BtcUnit `json:"unit"`
	}

	if err := json.NewDecoder(r.Body).Decode(&request); err != nil {
		return response{Success: false}
	}

	unit := request.Unit

	// update BTC format unit for Coins
	btcCoin, err := handlers.backend.Coin(coinpkg.CodeBTC)
	if err != nil {
		return response{Success: false}
	}
	btcCoin.(*btc.Coin).SetFormatUnit(unit)

	btcCoin, err = handlers.backend.Coin(coinpkg.CodeTBTC)
	if err != nil {
		return response{Success: false}
	}
	btcCoin.(*btc.Coin).SetFormatUnit(unit)

	// update BTC format unit for fiat conversions
	for _, account := range handlers.backend.Accounts() {
		account.Config().BtcCurrencyUnit = unit
	}

	return response{Success: true}
}

func (handlers *Handlers) getAccountsTotalBalanceHandler(_ *http.Request) (interface{}, error) {
	totalPerCoin := make(map[coin.Code]*big.Int)
	conversionsPerCoin := make(map[coin.Code]map[string]string)

	totalAmount := make(map[coin.Code]accountHandlers.FormattedAmount)

	for _, account := range handlers.backend.Accounts() {
		if account.Config().Config.Inactive || account.Config().Config.HiddenBecauseUnused {
			continue
		}
		if account.FatalError() {
			continue
		}
		err := account.Initialize()
		if err != nil {
			return nil, err
		}
		coinCode := account.Coin().Code()
		b, err := account.Balance()
		if err != nil {
			return nil, err
		}
		amount := b.Available()
		if _, ok := totalPerCoin[coinCode]; !ok {
			totalPerCoin[coinCode] = amount.BigInt()

		} else {
			totalPerCoin[coinCode] = new(big.Int).Add(totalPerCoin[coinCode], amount.BigInt())
		}

		conversionsPerCoin[coinCode] = coin.Conversions(
			coin.NewAmount(totalPerCoin[coinCode]),
			account.Coin(),
			false,
			account.Config().RateUpdater,
			util.FormatBtcAsSat(handlers.backend.Config().AppConfig().Backend.BtcUnit))
	}

	for k, v := range totalPerCoin {
		currentCoin, err := handlers.backend.Coin(k)
		if err != nil {
			return nil, err
		}
		totalAmount[k] = accountHandlers.FormattedAmount{
			Amount:      currentCoin.FormatAmount(coin.NewAmount(v), false),
			Unit:        currentCoin.GetFormatUnit(false),
			Conversions: conversionsPerCoin[k],
		}
	}
	return totalAmount, nil
}

func (handlers *Handlers) postSetAccountActiveHandler(r *http.Request) interface{} {
	var jsonBody struct {
		AccountCode accountsTypes.Code `json:"accountCode"`
		Active      bool               `json:"active"`
	}

	type response struct {
		Success      bool   `json:"success"`
		ErrorMessage string `json:"errorMessage,omitempty"`
	}

	if err := json.NewDecoder(r.Body).Decode(&jsonBody); err != nil {
		return response{Success: false, ErrorMessage: err.Error()}
	}
	if err := handlers.backend.SetAccountActive(jsonBody.AccountCode, jsonBody.Active); err != nil {
		return response{Success: false, ErrorMessage: err.Error()}
	}
	return response{Success: true}
}

func (handlers *Handlers) postSetTokenActiveHandler(r *http.Request) interface{} {
	var jsonBody struct {
		AccountCode accountsTypes.Code `json:"accountCode"`
		TokenCode   string             `json:"tokenCode"`
		Active      bool               `json:"active"`
	}

	type response struct {
		Success      bool   `json:"success"`
		ErrorMessage string `json:"errorMessage,omitempty"`
	}

	if err := json.NewDecoder(r.Body).Decode(&jsonBody); err != nil {
		return response{Success: false, ErrorMessage: err.Error()}
	}
	if err := handlers.backend.SetTokenActive(jsonBody.AccountCode, jsonBody.TokenCode, jsonBody.Active); err != nil {
		return response{Success: false, ErrorMessage: err.Error()}
	}
	return response{Success: true}
}

func (handlers *Handlers) postRenameAccountHandler(r *http.Request) interface{} {
	var jsonBody struct {
		AccountCode accountsTypes.Code `json:"accountCode"`
		Name        string             `json:"name"`
	}

	type response struct {
		Success      bool   `json:"success"`
		ErrorMessage string `json:"errorMessage,omitempty"`
		ErrorCode    string `json:"errorCode,omitempty"`
	}

	if err := json.NewDecoder(r.Body).Decode(&jsonBody); err != nil {
		return response{Success: false, ErrorMessage: err.Error()}
	}
	if err := handlers.backend.RenameAccount(jsonBody.AccountCode, jsonBody.Name); err != nil {
		if errCode, ok := errp.Cause(err).(errp.ErrorCode); ok {
			return response{Success: false, ErrorCode: string(errCode)}
		}
		return response{Success: false, ErrorMessage: err.Error()}
	}
	return response{Success: true}
}

// disabling for now, we'll either bring this back (if user request it) or remove for good
/*
func (handlers *Handlers) postAccountSetWatchHandler(r *http.Request) interface{} {
	var jsonBody struct {
		AccountCode accountsTypes.Code `json:"accountCode"`
		Watch       bool               `json:"watch"`
	}

	type response struct {
		Success      bool   `json:"success"`
		ErrorMessage string `json:"errorMessage,omitempty"`
	}

	if err := json.NewDecoder(r.Body).Decode(&jsonBody); err != nil {
		return response{Success: false, ErrorMessage: err.Error()}
	}

	filter := func(account *config.Account) bool {
		return account.Code == jsonBody.AccountCode
	}
	if err := handlers.backend.AccountSetWatch(filter, &jsonBody.Watch); err != nil {
		return response{Success: false, ErrorMessage: err.Error()}
	}
	return response{Success: true}
}
*/

func (handlers *Handlers) postAccountsReinitializeHandler(_ *http.Request) interface{} {
	handlers.backend.ReinitializeAccounts()
	return nil
}

func (handlers *Handlers) getDevicesRegisteredHandler(_ *http.Request) interface{} {
	jsonDevices := map[string]string{}
	for deviceID, device := range handlers.backend.DevicesRegistered() {
		jsonDevices[deviceID] = device.ProductName()
	}
	return jsonDevices
}

func (handlers *Handlers) postRegisterTestKeystoreHandler(r *http.Request) (interface{}, error) {
	if !handlers.backend.Testing() {
		return nil, errp.New("Test keystore not available")
	}
	jsonBody := map[string]string{}
	if err := json.NewDecoder(r.Body).Decode(&jsonBody); err != nil {
		return nil, errp.WithStack(err)
	}
	pin := jsonBody["pin"]
	handlers.backend.RegisterTestKeystore(pin)
	return nil, nil
}

func (handlers *Handlers) postDeregisterTestKeystoreHandler(_ *http.Request) interface{} {
	handlers.backend.DeregisterKeystore()
	return nil
}

func (handlers *Handlers) getRatesHandler(_ *http.Request) interface{} {
	return handlers.backend.RatesUpdater().LatestPrice()
}

func (handlers *Handlers) getBTCParseExternalAmount(r *http.Request) interface{} {
	type response struct {
		Success bool   `json:"success"`
		Amount  string `json:"amount"`
	}

	amount := r.URL.Query().Get("amount")
	amountRat, valid := new(big.Rat).SetString(amount)
	if !valid {
		return response{
			Success: false,
		}
	}

	btcCoin, err := handlers.backend.Coin(coinpkg.CodeBTC)
	if err != nil {
		handlers.log.WithError(err).Error("Could not get coin " + coinpkg.CodeBTC)
		return response{
			Success: false,
		}
	}

	coinAmount := btcCoin.SetAmount(amountRat, false)
	return response{
		Success: true,
		Amount:  btcCoin.FormatAmount(coinAmount, false),
	}
}

func (handlers *Handlers) getConvertToPlainFiatHandler(r *http.Request) interface{} {
	coinCode := r.URL.Query().Get("from")
	currency := r.URL.Query().Get("to")
	amount := r.URL.Query().Get("amount")

	currentCoin, err := handlers.backend.Coin(coinpkg.Code(coinCode))
	if err != nil {
		handlers.log.WithError(err).Error("Could not get coin " + coinCode)
		return map[string]interface{}{
			"success": false,
		}
	}

	coinAmount, err := currentCoin.ParseAmount(amount)
	if err != nil {
		handlers.log.WithError(err).Error("Error parsing amount " + amount)
		return map[string]interface{}{
			"success": false,
		}
	}

	coinUnitAmount := new(big.Rat).SetFloat64(currentCoin.ToUnit(coinAmount, false))

	coinUnit := currentCoin.Unit(false)
	rate := handlers.backend.RatesUpdater().LatestPrice()[coinUnit][currency]

	convertedAmount := new(big.Rat).Mul(coinUnitAmount, new(big.Rat).SetFloat64(rate))

	btcUnit := handlers.backend.Config().AppConfig().Backend.BtcUnit
	return map[string]interface{}{
		"success":    true,
		"fiatAmount": coinpkg.FormatAsPlainCurrency(convertedAmount, currency == rates.BTC.String(), util.FormatBtcAsSat(btcUnit)),
	}
}

func (handlers *Handlers) getConvertFromFiatHandler(r *http.Request) interface{} {
	isFee := false
	from := r.URL.Query().Get("from")
	to := r.URL.Query().Get("to")
	currentCoin, err := handlers.backend.Coin(coinpkg.Code(to))
	if err != nil {
		return map[string]interface{}{
			"success": false,
			"errMsg":  "internal error",
		}
	}

	fiatStr := r.URL.Query().Get("amount")
	fiatRat, valid := new(big.Rat).SetString(fiatStr)
	if !valid {
		return map[string]interface{}{
			"success": false,
			"errMsg":  "invalid amount",
		}
	}

	unit := currentCoin.Unit(isFee)
	switch unit { // HACK: fake rates for testnet coins
	case "TBTC", "TLTC":
		unit = unit[1:]
	case "GOETH":
		unit = unit[2:]
	case "SEPETH":
		unit = unit[3:]
	}

	if from == rates.BTC.String() && handlers.backend.Config().AppConfig().Backend.BtcUnit == coinpkg.BtcUnitSats {
		fiatRat = coinpkg.Sat2Btc(fiatRat)
	}

	rate := handlers.backend.RatesUpdater().LatestPrice()[unit][from]
	result := coin.NewAmountFromInt64(0)
	if rate != 0.0 {
		amountRat := new(big.Rat).Quo(fiatRat, new(big.Rat).SetFloat64(rate))
		result = currentCoin.SetAmount(amountRat, false)
	}
	return map[string]interface{}{
		"success": true,
		"amount":  currentCoin.FormatAmount(result, false),
	}
}

func (handlers *Handlers) getHeadersStatus(coinCode coinpkg.Code) func(*http.Request) (interface{}, error) {
	return func(_ *http.Request) (interface{}, error) {
		coin, err := handlers.backend.Coin(coinCode)
		if err != nil {
			return nil, err
		}
		return coin.(*btc.Coin).Headers().Status()
	}
}

func (handlers *Handlers) postCertsDownloadHandler(r *http.Request) interface{} {
	var server string
	if err := json.NewDecoder(r.Body).Decode(&server); err != nil {
		return map[string]interface{}{
			"success":      false,
			"errorMessage": err.Error(),
		}
	}
	pemCert, err := handlers.backend.DownloadCert(server)
	if err != nil {
		return map[string]interface{}{
			"success":      false,
			"errorMessage": err.Error(),
		}
	}
	return map[string]interface{}{
		"success": true,
		"pemCert": pemCert,
	}
}

func (handlers *Handlers) postElectrumCheckHandler(r *http.Request) interface{} {
	var serverInfo config.ServerInfo
	if err := json.NewDecoder(r.Body).Decode(&serverInfo); err != nil {
		return map[string]interface{}{
			"success":      false,
			"errorMessage": err.Error(),
		}
	}

	if err := handlers.backend.CheckElectrumServer(&serverInfo); err != nil {
		handlers.log.
			WithError(err).
			WithField("server-info", serverInfo.String()).
			Info("checking electrum connection failed")
		return map[string]interface{}{
			"success":      false,
			"errorMessage": err.Error(),
		}
	}
	handlers.log.
		WithField("server-info", serverInfo.String()).
		Info("checking electrum connection succeeded")
	return map[string]interface{}{
		"success": true,
	}
}

func (handlers *Handlers) postSocksProxyCheck(r *http.Request) interface{} {
	type response struct {
		Success      bool   `json:"success"`
		ErrorMessage string `json:"errorMessage,omitempty"`
	}

	var endpoint string
	if err := json.NewDecoder(r.Body).Decode(&endpoint); err != nil {
		return response{
			Success:      false,
			ErrorMessage: err.Error(),
		}
	}

	err := socksproxy.NewSocksProxy(true, endpoint).Validate()
	if err != nil {
		return response{
			Success:      false,
			ErrorMessage: err.Error(),
		}
	}
	return response{
		Success: true,
	}
}

func (handlers *Handlers) eventsHandler(w http.ResponseWriter, r *http.Request) {
	conn, err := handlers.websocketUpgrader.Upgrade(w, r, nil)
	if err != nil {
		panic(err)
	}

	sendChan, quitChan := runWebsocket(conn, handlers.apiData, handlers.log)
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

// isAPITokenValid checks whether we are in dev or prod mode and, if we are in prod mode, verifies
// that an authorization token is received as an HTTP Authorization header and that it is valid.
func isAPITokenValid(w http.ResponseWriter, r *http.Request, apiData *ConnectionData, log *logrus.Entry) bool {
	methodLogEntry := log.
		WithField("path", r.URL.Path).
		WithField("method", r.Method)
	methodLogEntry.Debug("endpoint")
	// In dev mode, we allow unauthorized requests
	if apiData.devMode {
		return true
	}

	if len(r.Header.Get("Authorization")) == 0 {
		methodLogEntry.Error("Missing token in API request. WARNING: this could be an attack on the API")
		http.Error(w, "missing token "+r.URL.Path, http.StatusUnauthorized)
		return false
	} else if len(r.Header.Get("Authorization")) != 0 && r.Header.Get("Authorization") != "Basic "+apiData.token {
		methodLogEntry.Error("Incorrect token in API request. WARNING: this could be an attack on the API")
		http.Error(w, "incorrect token", http.StatusUnauthorized)
		return false
	}
	return true
}

// ensureAPITokenValid wraps the given handler with another handler function that calls isAPITokenValid().
func ensureAPITokenValid(h http.Handler, apiData *ConnectionData, log *logrus.Entry) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if isAPITokenValid(w, r, apiData, log) {
			h.ServeHTTP(w, r)
		}
	})
}

func (handlers *Handlers) apiMiddleware(devMode bool, h func(*http.Request) (interface{}, error)) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		defer func() {
			// recover from all panics and log error before panicking again
			if r := recover(); r != nil {
				handlers.log.WithField("panic", true).Errorf("%v\n%s", r, string(debug.Stack()))
				writeJSON(w, map[string]string{"error": fmt.Sprintf("%v", r)})
			}
		}()

		w.Header().Set("Content-Type", "application/json; charset=utf-8")
		if devMode {
			// This enables us to run a server on a different port serving just the UI, while still
			// allowing it to access the API.
			w.Header().Set("Access-Control-Allow-Origin", "http://localhost:8080")
		}
		value, err := h(r)
		if err != nil {
			handlers.log.WithError(err).Error("endpoint failed")
			writeJSON(w, map[string]string{"error": err.Error()})
			return
		}
		writeJSON(w, value)
	})
}
func (handlers *Handlers) getAccountSummary(_ *http.Request) (interface{}, error) {
	return handlers.backend.ChartData()
}

// getSupportedCoinsHandler returns an array of coin codes for which you can add an account.
// Exactly one keystore must be connected, otherwise an empty array is returned.
func (handlers *Handlers) getSupportedCoinsHandler(_ *http.Request) interface{} {
	type element struct {
		CoinCode             coinpkg.Code `json:"coinCode"`
		Name                 string       `json:"name"`
		CanAddAccount        bool         `json:"canAddAccount"`
		SuggestedAccountName string       `json:"suggestedAccountName"`
	}
	keystore := handlers.backend.Keystore()
	if keystore == nil {
		return []string{}
	}
	var result []element
	for _, coinCode := range handlers.backend.SupportedCoins(keystore) {
		coin, err := handlers.backend.Coin(coinCode)
		if err != nil {
			continue
		}
		suggestedAccountName, canAddAccount := handlers.backend.CanAddAccount(coinCode, keystore)
		result = append(result, element{
			CoinCode:             coinCode,
			Name:                 coin.Name(),
			CanAddAccount:        canAddAccount,
			SuggestedAccountName: suggestedAccountName,
		})
	}
	return result
}

func (handlers *Handlers) getExchangesByRegion(r *http.Request) interface{} {
	type errorResult struct {
		Error string `json:"error"`
	}

	acct, err := handlers.backend.GetAccountFromCode(accountsTypes.Code(mux.Vars(r)["code"]))
	if err != nil {
		handlers.log.Error(err)
		return errorResult{Error: err.Error()}
	}

	accountValid := acct != nil && acct.Offline() == nil && !acct.FatalError()
	if !accountValid {
		handlers.log.Error("Account not valid")
		return errorResult{Error: "Account not valid"}
	}

	return exchanges.ListExchangesByRegion(acct, handlers.backend.HTTPClient())
}

func (handlers *Handlers) postBitsuranceLookup(r *http.Request) interface{} {
	type response struct {
		Success            bool                        `json:"success"`
		ErrorMessage       string                      `json:"errorMessage"`
		BitsuranceAccounts []bitsurance.AccountDetails `json:"bitsuranceAccounts"`
	}

	var request struct {
		AccountCode accountsTypes.Code `json:"code"`
	}

	if err := json.NewDecoder(r.Body).Decode(&request); err != nil {
		handlers.log.Error(err)
		return response{Success: false, ErrorMessage: err.Error()}
	}
	insuredAccounts, err := handlers.backend.LookupInsuredAccounts(request.AccountCode)
	if err != nil {
		handlers.log.Error(err)
		return response{Success: false, ErrorMessage: err.Error()}
	}

	return response{Success: true, BitsuranceAccounts: insuredAccounts}
}

func (handlers *Handlers) getBitsuranceURL(r *http.Request) interface{} {
	lang := handlers.backend.Config().AppConfig().Backend.UserLanguage
	if len(lang) == 0 {
		// userLanguage config is empty if the set locale matches the system locale, so we have
		// to retrieve that.
		lang = utilConfig.MainLocaleFromNative(handlers.backend.Environment().NativeLocale())
	}

	return bitsurance.WidgetURL(handlers.backend.DevServers(), lang)
}
func (handlers *Handlers) getExchangeDeals(r *http.Request) interface{} {
	type exchangeDealsList struct {
		Exchanges []exchanges.ExchangeDeals `json:"exchanges"`
	}

	return exchangeDealsList{
		Exchanges: []exchanges.ExchangeDeals{
			exchanges.PocketDeals(),
			exchanges.MoonpayDeals(),
		},
	}
}

func (handlers *Handlers) getExchangeBuySupported(r *http.Request) (interface{}, error) {
	type supportedExchanges struct {
		Exchanges []string `json:"exchanges"`
	}

	acct, err := handlers.backend.GetAccountFromCode(accountsTypes.Code(mux.Vars(r)["code"]))
	if err != nil {
		return nil, err
	}

	supported := supportedExchanges{Exchanges: []string{}}
	accountValid := acct != nil && acct.Offline() == nil && !acct.FatalError()
	if !accountValid {
		return supported, nil
	}

	if exchanges.IsMoonpaySupported(acct.Coin().Code()) {
		supported.Exchanges = append(supported.Exchanges, exchanges.MoonpayName)
	}
	if exchanges.IsPocketSupported(acct) {
		supported.Exchanges = append(supported.Exchanges, exchanges.PocketName)
	}

	return supported, nil
}

func (handlers *Handlers) getExchangeMoonpayBuyInfo(r *http.Request) (interface{}, error) {
	acct, err := handlers.backend.GetAccountFromCode(accountsTypes.Code(mux.Vars(r)["code"]))
	if err != nil {
		return nil, err
	}

	lang := handlers.backend.Config().AppConfig().Backend.UserLanguage
	if len(lang) == 0 {
		// userLanguage config is empty if the set locale matches the system locale, so we have
		// to retrieve that.
		lang = utilConfig.MainLocaleFromNative(handlers.backend.Environment().NativeLocale())
	}
	params := exchanges.BuyMoonpayParams{
		Fiat: handlers.backend.Config().AppConfig().Backend.MainFiat,
		Lang: lang,
	}
	buy, err := exchanges.MoonpayInfo(acct, params)
	if err != nil {
		return nil, err
	}
	resp := struct {
		URL     string `json:"url"`
		Address string `json:"address"`
	}{
		URL:     buy.URL,
		Address: buy.Address,
	}
	return resp, nil
}

func (handlers *Handlers) getExchangePocketURL(r *http.Request) interface{} {
	lang := handlers.backend.Config().AppConfig().Backend.UserLanguage
	if len(lang) == 0 {
		// userLanguage config is empty if the set locale matches the system locale, so we have
		// to retrieve that.
		lang = utilConfig.MainLocaleFromNative(handlers.backend.Environment().NativeLocale())
	}

	url := exchanges.PocketURL(handlers.backend.DevServers(), lang)
	return url
}

func (handlers *Handlers) postPocketWidgetVerifyAddress(r *http.Request) interface{} {
	type response struct {
		Success      bool   `json:"success"`
		ErrorMessage string `json:"errorMessage,omitempty"`
		ErrorCode    string `json:"errorCode,omitempty"`
	}

	var request struct {
		AccountCode accountsTypes.Code `json:"accountCode"`
		Address     string             `json:"address"`
	}
	if err := json.NewDecoder(r.Body).Decode(&request); err != nil {
		return response{Success: false, ErrorMessage: err.Error()}
	}

	account, err := handlers.backend.GetAccountFromCode(request.AccountCode)
	if err != nil {
		handlers.log.Error(err)
		return response{Success: false, ErrorMessage: err.Error()}
	}

	err = exchanges.PocketWidgetVerifyAddress(account, request.Address)
	if err != nil {
		handlers.log.WithField("code", account.Config().Config.Code).Error(err)
		if errCode, ok := errp.Cause(err).(errp.ErrorCode); ok {
			return response{Success: false, ErrorCode: string(errCode)}
		}
		return response{Success: false, ErrorMessage: err.Error()}
	}
	return response{Success: true}

}

func (handlers *Handlers) getAOPPHandler(r *http.Request) interface{} {
	return handlers.backend.AOPP()
}

func (handlers *Handlers) postAOPPChooseAccountHandler(r *http.Request) (interface{}, error) {
	var request struct {
		AccountCode accountsTypes.Code `json:"accountCode"`
	}
	if err := json.NewDecoder(r.Body).Decode(&request); err != nil {
		return nil, errp.WithStack(err)
	}

	handlers.backend.AOPPChooseAccount(request.AccountCode)
	return nil, nil
}

func (handlers *Handlers) postAOPPCancelHandler(r *http.Request) interface{} {
	handlers.backend.AOPPCancel()
	return nil
}

func (handlers *Handlers) postAOPPApproveHandler(r *http.Request) interface{} {
	handlers.backend.AOPPApprove()
	return nil
}

func (handlers *Handlers) postCancelConnectKeystoreHandler(r *http.Request) interface{} {
	handlers.backend.CancelConnectKeystore()
	return nil
}

func (handlers *Handlers) postSetWatchonlyHandler(r *http.Request) interface{} {
	type response struct {
		Success bool `json:"success"`
	}
	var request struct {
		RootFingerprint jsonp.HexBytes `json:"rootFingerprint"`
		Watchonly       bool           `json:"watchonly"`
	}
	if err := json.NewDecoder(r.Body).Decode(&request); err != nil {
		return response{Success: false}
	}
	if err := handlers.backend.SetWatchonly([]byte(request.RootFingerprint), request.Watchonly); err != nil {
		return response{Success: false}
	}
	return response{Success: true}
}

func (handlers *Handlers) postOnAuthSettingChangedHandler(r *http.Request) interface{} {
	handlers.backend.Environment().OnAuthSettingChanged(
		handlers.backend.Config().AppConfig().Backend.Authentication)
	return nil
}
