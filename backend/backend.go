package backend

import (
	"fmt"

	"github.com/shiftdevices/godbb/backend/config"
	"golang.org/x/text/language"

	"github.com/btcsuite/btcd/chaincfg"
	"github.com/cloudfoundry-attic/jibber_jabber"
	"github.com/sirupsen/logrus"

	"github.com/shiftdevices/godbb/backend/arguments"
	"github.com/shiftdevices/godbb/backend/coins/btc"
	"github.com/shiftdevices/godbb/backend/coins/coin"
	"github.com/shiftdevices/godbb/backend/coins/ltc"
	"github.com/shiftdevices/godbb/backend/devices/device"
	"github.com/shiftdevices/godbb/backend/devices/usb"
	"github.com/shiftdevices/godbb/backend/keystore"
	"github.com/shiftdevices/godbb/backend/signing"
	"github.com/shiftdevices/godbb/util/errp"
	"github.com/shiftdevices/godbb/util/locker"
	"github.com/shiftdevices/godbb/util/logging"
	"github.com/shiftdevices/godbb/util/observable"
	"github.com/shiftdevices/godbb/util/rpc"
)

type backendEvent struct {
	Type string `json:"type"`
	Data string `json:"data"`
}

type deviceEvent struct {
	DeviceID string `json:"deviceID"`
	Type     string `json:"type"`
	Data     string `json:"data"`
	// TODO: rename Data to Event, Meta to Data.
	Meta interface{} `json:"meta"`
}

// WalletEvent models an event triggered by a wallet.
type WalletEvent struct {
	Type string `json:"type"`
	Code string `json:"code"`
	Data string `json:"data"`
}

// Backend ties everything together and is the main starting point to use the godbb library.
type Backend struct {
	arguments *arguments.Arguments

	config *config.Config

	events chan interface{}

	devices        map[string]device.Interface
	keystores      keystore.Keystores
	onWalletInit   func(*btc.Account)
	onWalletUninit func(*btc.Account)
	onDeviceInit   func(device.Interface)
	onDeviceUninit func(string)

	coins     map[string]*btc.Coin
	coinsLock locker.Locker

	accounts     []*btc.Account
	accountsLock locker.Locker
	// accountsSyncStart time.Time

	// Stored and exposed temporarily through the backend.
	ratesUpdater coin.RatesUpdater

	log *logrus.Entry
}

// NewBackend creates a new backend with the given arguments.
func NewBackend(arguments *arguments.Arguments) *Backend {
	log := logging.Get().WithGroup("backend")
	return &Backend{
		arguments: arguments,
		config:    config.NewConfig(arguments.ConfigFilename()),
		events:    make(chan interface{}, 1000),

		devices:      map[string]device.Interface{},
		keystores:    keystore.NewKeystores(),
		coins:        map[string]*btc.Coin{},
		ratesUpdater: btc.NewRatesUpdater(),
		log:          log,
	}
}

func (backend *Backend) addAccount(
	coin *btc.Coin,
	code string,
	name string,
	keypath string,
	scriptType signing.ScriptType,
) {
	if !backend.config.Config().Backend.AccountActive(code) {
		backend.log.WithField("code", code).WithField("name", name).Info("skipping inactive account")
		return
	}
	backend.log.WithField("code", code).WithField("name", name).Info("init account")
	onEvent := func(code string) func(btc.Event) {
		return func(event btc.Event) {
			backend.events <- WalletEvent{Type: "wallet", Code: code, Data: string(event)}
		}
	}
	absoluteKeypath, err := signing.NewAbsoluteKeypath(keypath)
	if err != nil {
		panic(err)
	}
	getSigningConfiguration := func() (*signing.Configuration, error) {
		return backend.keystores.Configuration(scriptType, absoluteKeypath, backend.keystores.Count())
	}
	if backend.arguments.Multisig() {
		name = name + " Multisig"
	}
	account := btc.NewAccount(coin, backend.arguments.CacheDirectoryPath(), code, name,
		getSigningConfiguration, backend.keystores, onEvent(code), backend.log)
	backend.accounts = append(backend.accounts, account)
}

// Config returns the backend config.
func (backend *Backend) Config() *config.Config {
	return backend.config
}

func defaultProdServers(code string) []*rpc.ServerInfo {
	hostsBtc := []string{"btc.shiftcrypto.ch", "merkle.shiftcrypto.ch"}
	hostsLtc := []string{"ltc.shiftcrypto.ch", "ltc.shamir.shiftcrypto.ch"}
	switch code {
	case "btc":
		port := 443
		return combine(hostsBtc, port, false)
	case "tbtc":
		port := 51002
		return combine(hostsBtc, port, false)
	case "ltc":
		port := 443
		return combine(hostsLtc, port, false)
	case "tltc":
		port := 51004
		return combine(hostsLtc, port, false)
	default:
		panic(errp.Newf("The given code %s is unknown.", code))
	}
}

func defaultDevServers(code string) []*rpc.ServerInfo {
	hosts := []string{"s1.dev.shiftcrypto.ch", "s2.dev.shiftcrypto.ch"}
	port := 0
	switch code {
	case "btc":
		hosts = []string{"dev.shiftcrypto.ch"}
		port = 50002
	case "tbtc":
		port = 51003
	case "ltc":
		hosts = []string{"dev.shiftcrypto.ch"}
		port = 50004
	case "tltc":
		hosts = []string{"dev.shiftcrypto.ch"}
		port = 51004
	default:
		panic(errp.Newf("The given code %s is unknown.", code))
	}
	return combine(hosts, port, true)
}

// combine is a utility function that combines the server/tls information with a given port.
func combine(hosts []string, port int, devmode bool) []*rpc.ServerInfo {
	serverInfos := []*rpc.ServerInfo{}
	for _, host := range hosts {
		server := fmt.Sprintf("%s:%d", host, port)
		serverInfos = append(serverInfos, &rpc.ServerInfo{server, true, devmode})
	}
	return serverInfos
}

func defaultServers(code string, devmode bool) []*rpc.ServerInfo {
	if devmode {
		return defaultDevServers(code)
	}
	return defaultProdServers(code)
}

// Coin returns a Coin instance for a coin type.
func (backend *Backend) Coin(code string) *btc.Coin {
	defer backend.coinsLock.Lock()()
	coin, ok := backend.coins[code]
	if ok {
		return coin
	}
	servers := defaultServers(code, backend.arguments.DevMode())
	dbFolder := backend.arguments.CacheDirectoryPath()
	switch code {
	case "rbtc":
		servers = []*rpc.ServerInfo{{"127.0.0.1:52001", false, false}}
		coin = btc.NewCoin("rbtc", "RBTC", &chaincfg.RegressionNetParams, dbFolder, servers, "", nil)
	case "tbtc":
		coin = btc.NewCoin("tbtc", "TBTC", &chaincfg.TestNet3Params, dbFolder, servers, "https://testnet.blockchain.info/tx/", backend.ratesUpdater)
	case "btc":
		coin = btc.NewCoin("btc", "BTC", &chaincfg.MainNetParams, dbFolder, servers, "https://blockchain.info/tx/", backend.ratesUpdater)
	case "tltc":
		coin = btc.NewCoin("tltc", "TLTC", &ltc.TestNet4Params, dbFolder, servers, "http://explorer.litecointools.com/tx/", backend.ratesUpdater)
	case "ltc":
		coin = btc.NewCoin("ltc", "LTC", &ltc.MainNetParams, dbFolder, servers, "https://insight.litecore.io/tx/", backend.ratesUpdater)
	default:
		panic(errp.Newf("unknown coin code %s", code))
	}
	coin.Init()
	coin.Observe(func(event observable.Event) { backend.events <- event })
	backend.coins[code] = coin
	return coin
}

func (backend *Backend) initAccounts() {
	backend.accounts = []*btc.Account{}
	if backend.arguments.Testing() {
		if backend.arguments.Regtest() {
			RBTC := backend.Coin("rbtc")
			backend.addAccount(RBTC, "rbtc-p2pkh", "Bitcoin Regtest Legacy", "m/44'/1'/0'", signing.ScriptTypeP2PKH)
			backend.addAccount(RBTC, "rbtc-p2wpkh-p2sh", "Bitcoin Regtest Segwit", "m/49'/1'/0'", signing.ScriptTypeP2WPKHP2SH)
		} else {
			TBTC := backend.Coin("tbtc")
			backend.addAccount(TBTC, "tbtc-p2wpkh-p2sh", "Bitcoin Testnet", "m/49'/1'/0'", signing.ScriptTypeP2WPKHP2SH)
			backend.addAccount(TBTC, "tbtc-p2wpkh", "Bitcoin Testnet: bech32", "m/84'/1'/0'", signing.ScriptTypeP2WPKH)
			backend.addAccount(TBTC, "tbtc-p2pkh", "Bitcoin Testnet Legacy", "m/44'/1'/0'", signing.ScriptTypeP2PKH)

			TLTC := backend.Coin("tltc")
			backend.addAccount(TLTC, "tltc-p2wpkh-p2sh", "Litecoin Testnet", "m/49'/1'/0'", signing.ScriptTypeP2WPKHP2SH)
			backend.addAccount(TLTC, "tltc-p2wpkh", "Litecoin Testnet: bech32", "m/84'/1'/0'", signing.ScriptTypeP2WPKH)
		}
	} else {
		BTC := backend.Coin("btc")
		backend.addAccount(BTC, "btc-p2wpkh-p2sh", "Bitcoin", "m/49'/0'/0'", signing.ScriptTypeP2WPKHP2SH)
		backend.addAccount(BTC, "btc-p2wpkh", "Bitcoin: bech32", "m/84'/0'/0'", signing.ScriptTypeP2WPKH)
		backend.addAccount(BTC, "btc-p2pkh", "Bitcoin Legacy", "m/44'/0'/0'", signing.ScriptTypeP2PKH)

		LTC := backend.Coin("ltc")
		backend.addAccount(LTC, "ltc-p2wpkh-p2sh", "Litecoin", "m/49'/2'/0'", signing.ScriptTypeP2WPKHP2SH)
		backend.addAccount(LTC, "ltc-p2wpkh", "Litecoin: bech32", "m/84'/2'/0'", signing.ScriptTypeP2WPKH)
	}
	for _, account := range backend.accounts {
		backend.onWalletInit(account)
	}
}

// WalletStatus returns whether the wallets have been initialized.
func (backend *Backend) WalletStatus() string {
	if backend.keystores.Count() > 0 {
		return "initialized"
	}
	return "uninitialized"
}

// Testing returns whether this backend is for testing only.
func (backend *Backend) Testing() bool {
	return backend.arguments.Testing()
}

// Accounts returns the supported accounts.
func (backend *Backend) Accounts() []*btc.Account {
	return backend.accounts
}

// UserLanguage returns the language the UI should be presented in to the user.
func (backend *Backend) UserLanguage() language.Tag {
	userLocale, err := jibber_jabber.DetectIETF()
	if err != nil {
		return language.English
	}
	languages := []language.Tag{
		language.English,
		language.German,
	}
	tag, _, _ := language.NewMatcher(languages).Match(language.Make(userLocale))
	backend.log.WithField("user-language", tag).Debug("Detected user language")
	return tag
}

// OnWalletInit installs a callback to be called when a wallet is initialized.
func (backend *Backend) OnWalletInit(f func(*btc.Account)) {
	backend.onWalletInit = f
}

// OnWalletUninit installs a callback to be called when a wallet is stopped.
func (backend *Backend) OnWalletUninit(f func(*btc.Account)) {
	backend.onWalletUninit = f
}

// OnDeviceInit installs a callback to be called when a device is initialized.
func (backend *Backend) OnDeviceInit(f func(device.Interface)) {
	backend.onDeviceInit = f
}

// OnDeviceUninit installs a callback to be called when a device is uninitialized.
func (backend *Backend) OnDeviceUninit(f func(string)) {
	backend.onDeviceUninit = f
}

// Start starts the background services. It returns a channel of events to handle by the library
// client.
func (backend *Backend) Start() <-chan interface{} {
	go backend.listenHID()
	go func() {
		err := backend.checkForUpdate()
		if err != nil {
			backend.log.WithField("error", err).Error("The update check failed.")
		}
	}()
	return backend.events
}

// Events returns the push notifications channel.
func (backend *Backend) Events() <-chan interface{} {
	return backend.events
}

func (backend *Backend) initWallets() {
	// Since initAccounts replaces all previous accounts, we need to properly close them first.
	backend.uninitWallets()
	defer backend.accountsLock.Lock()()
	backend.initAccounts()
}

// DevicesRegistered returns a slice of device IDs of registered devices.
func (backend *Backend) DevicesRegistered() []string {
	deviceIDs := []string{}
	for deviceID := range backend.devices {
		deviceIDs = append(deviceIDs, deviceID)
	}
	return deviceIDs
}

func (backend *Backend) uninitWallets() {
	defer backend.accountsLock.Lock()()
	for _, account := range backend.accounts {
		account := account
		backend.onWalletUninit(account)
		account.Close()
	}
	backend.accounts = nil
}

// Keystores returns the keystores registered at this backend.
func (backend *Backend) Keystores() keystore.Keystores {
	return backend.keystores
}

// RegisterKeystore registers the given keystore at this backend.
func (backend *Backend) RegisterKeystore(keystore keystore.Keystore) {
	backend.log.Info("registering keystore")
	if err := backend.keystores.Add(keystore); err != nil {
		backend.log.Panic("Failed to add a keystore.", err)
	}
	if backend.arguments.Multisig() && backend.keystores.Count() != 2 {
		return
	}
	backend.initWallets()
	backend.events <- backendEvent{Type: "backend", Data: "walletStatusChanged"}
}

// DeregisterKeystore removes the registered keystore.
func (backend *Backend) DeregisterKeystore() {
	backend.log.Info("deregistering keystore")
	backend.keystores = keystore.NewKeystores()
	backend.uninitWallets()
	backend.events <- backendEvent{Type: "backend", Data: "walletStatusChanged"}
}

// Register registers the given device at this backend.
func (backend *Backend) Register(theDevice device.Interface) error {
	backend.devices[theDevice.Identifier()] = theDevice
	backend.onDeviceInit(theDevice)
	theDevice.Init(backend.Testing())

	mainKeystore := len(backend.devices) == 1
	theDevice.SetOnEvent(func(event device.Event, data interface{}) {
		switch event {
		case device.EventKeystoreGone:
			backend.DeregisterKeystore()
		case device.EventKeystoreAvailable:
			// absoluteKeypath := signing.NewEmptyAbsoluteKeypath().Child(44, signing.Hardened)
			// extendedPublicKey, err := backend.device.ExtendedPublicKey(absoluteKeypath)
			// if err != nil {
			// 	panic(err)
			// }
			// configuration := signing.NewConfiguration(absoluteKeypath,
			// 	[]*hdkeychain.ExtendedKey{extendedPublicKey}, 1)
			if backend.arguments.Multisig() {
				backend.RegisterKeystore(
					theDevice.KeystoreForConfiguration(nil, backend.keystores.Count()))
			} else if mainKeystore {
				// HACK: for device based, only one is supported at the moment.
				backend.keystores = keystore.NewKeystores()

				backend.RegisterKeystore(
					theDevice.KeystoreForConfiguration(nil, backend.keystores.Count()))
			}
		}
		backend.events <- deviceEvent{
			DeviceID: theDevice.Identifier(),
			Type:     "device",
			Data:     string(event),
			Meta:     data,
		}
	})
	select {
	case backend.events <- backendEvent{
		Type: "devices",
		Data: "registeredChanged",
	}:
	default:
	}
	return nil
}

// Deregister deregisters the device with the given ID from this backend.
func (backend *Backend) Deregister(deviceID string) {
	if _, ok := backend.devices[deviceID]; ok {
		backend.onDeviceUninit(deviceID)
		delete(backend.devices, deviceID)
		backend.DeregisterKeystore()
		backend.events <- backendEvent{Type: "devices", Data: "registeredChanged"}
	}
}

func (backend *Backend) listenHID() {
	usb.NewManager(backend.Register, backend.Deregister).ListenHID()
}

// Rates return the latest rates.
func (backend *Backend) Rates() map[string]map[string]float64 {
	return backend.ratesUpdater.Last()
}
