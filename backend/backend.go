package backend

import (
	"golang.org/x/text/language"

	"github.com/cloudfoundry-attic/jibber_jabber"
	"github.com/shiftdevices/godbb/backend/coins/btc"
	"github.com/shiftdevices/godbb/backend/coins/ltc"
	"github.com/shiftdevices/godbb/backend/config"
	"github.com/shiftdevices/godbb/backend/devices/device"
	"github.com/shiftdevices/godbb/backend/devices/usb"
	"github.com/shiftdevices/godbb/backend/keystore"
	"github.com/shiftdevices/godbb/backend/signing"
	"github.com/shiftdevices/godbb/util/locker"
	"github.com/shiftdevices/godbb/util/logging"
	"github.com/shiftdevices/godbb/util/semver"
	"github.com/sirupsen/logrus"
)

var (
	// Version of the backend as displayed to the user.
	Version = semver.NewSemVer(0, 1, 0)
)

const (
// reattemptPeriod is the time until re-establishing of the connection
// to a coin backend is attempted.
// reattemptPeriod = 30 * time.Second
)

// Interface is the API of the backend.
type Interface interface {
	Config() config.AppConfig
	SetConfig(config.AppConfig) error
	WalletStatus() string
	Testing() bool
	Accounts() []*btc.Account
	UserLanguage() language.Tag
	OnWalletInit(f func(*btc.Account))
	OnWalletUninit(f func(*btc.Account))
	OnDeviceInit(f func(device.Interface))
	OnDeviceUninit(f func(deviceID string))
	DevicesRegistered() []string
	Start() <-chan interface{}
	Keystores() keystore.Keystores
	RegisterKeystore(keystore.Keystore)
	DeregisterKeystore()
	Register(device device.Interface) error
	Deregister(deviceID string)
}

// DefaultAppFolder returns the default location to store application data.
func DefaultAppFolder() string {
	return "."
}

type backendEvent struct {
	Type string `json:"type"`
	Data string `json:"data"`
}

type deviceEvent struct {
	DeviceID string `json:"deviceID"`
	Type     string `json:"type"`
	Data     string `json:"data"`
}

// WalletEvent models an event triggered by a wallet.
type WalletEvent struct {
	Type string `json:"type"`
	Code string `json:"code"`
	Data string `json:"data"`
}

// Backend ties everything together and is the main starting point to use the godbb library.
type Backend struct {
	arguments *Arguments

	config *config.Config

	events chan interface{}

	devices        map[string]device.Interface
	keystores      keystore.Keystores
	onWalletInit   func(*btc.Account)
	onWalletUninit func(*btc.Account)
	onDeviceInit   func(device.Interface)
	onDeviceUninit func(string)

	accounts     []*btc.Account
	accountsLock locker.Locker
	// accountsSyncStart time.Time

	log *logrus.Entry
}

// NewBackend creates a new backend with the given arguments.
func NewBackend(arguments *Arguments) *Backend {
	log := logging.Log.WithGroup("backend")
	log.Infof("Arguments: %+v", arguments)
	return &Backend{
		arguments: arguments,
		config:    config.NewConfig(arguments.configFilename),
		events:    make(chan interface{}, 1000),

		devices:   map[string]device.Interface{},
		keystores: keystore.NewKeystores(),
		log:       log,
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
	getConfiguration := func() (*signing.Configuration, error) {
		return backend.keystores.Configuration(scriptType, absoluteKeypath, backend.keystores.Count())
	}
	if backend.arguments.Multisig() {
		name = name + " Multisig"
	}
	account := btc.NewAccount(coin, backend.arguments.CacheDirectoryPath(), code, name,
		getConfiguration, backend.keystores, onEvent(code), backend.log)
	backend.accounts = append(backend.accounts, account)
}

func (backend *Backend) initAccounts() error {
	backend.accounts = []*btc.Account{}
	if backend.arguments.Testing() {
		if backend.arguments.Regtest() {
			backend.addAccount(btc.RegtestCoin, "rbtc", "Bitcoin Regtest", "m/44'/1'/0'", signing.ScriptTypeP2PKH)
			backend.addAccount(btc.RegtestCoin, "rbtc-p2wpkh-p2sh", "Bitcoin Regtest Segwit", "m/49'/1'/0'", signing.ScriptTypeP2WPKHP2SH)
		} else {
			backend.addAccount(btc.TestnetCoin, "tbtc", "Bitcoin Testnet", "m/44'/1'/0'", signing.ScriptTypeP2PKH)
			backend.addAccount(btc.TestnetCoin, "tbtc-p2wpkh-p2sh", "Bitcoin Testnet Segwit", "m/49'/1'/0'", signing.ScriptTypeP2WPKHP2SH)
			backend.addAccount(btc.TestnetCoin, "tbtc-p2wpkh", "Bitcoin Testnet Native Segwit", "m/84'/1'/0'", signing.ScriptTypeP2WPKH)
			backend.addAccount(ltc.TestnetCoin, "tltc-p2wpkh-p2sh", "Litecoin Testnet", "m/49'/1'/0'", signing.ScriptTypeP2WPKHP2SH)
			backend.addAccount(ltc.TestnetCoin, "tltc-p2wpkh", "Litecoin Testnet Native Segwit", "m/84'/1'/0'", signing.ScriptTypeP2WPKH)
		}
	} else {
		backend.addAccount(btc.MainnetCoin, "btc", "Bitcoin", "m/44'/0'/0'", signing.ScriptTypeP2PKH)
		backend.addAccount(btc.MainnetCoin, "btc-p2wpkh-p2sh", "Bitcoin Segwit", "m/49'/0'/0'", signing.ScriptTypeP2WPKHP2SH)
		backend.addAccount(btc.MainnetCoin, "btc-p2wpkh", "Bitcoin Native Segwit", "m/84'/0'/0'", signing.ScriptTypeP2WPKH)
		backend.addAccount(ltc.MainnetCoin, "ltc-p2wpkh-p2sh", "Litecoin Segwit", "m/49'/2'/0'", signing.ScriptTypeP2WPKHP2SH)
	}
	for _, account := range backend.accounts {
		go func(account *btc.Account) {
			backend.onWalletInit(account)
			if err := account.Init(); err != nil {
				// TODO
				panic(err)
			}
		}(account)
	}
	return nil
}

// Config returns the app config.
func (backend *Backend) Config() config.AppConfig {
	return backend.config.Config()
}

// SetConfig sets the app config.
func (backend *Backend) SetConfig(appConfig config.AppConfig) error {
	return backend.config.Set(appConfig)
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
	return backend.events
}

// // handleConnectionError listens on an error channel for incoming connection errors and attempts
// // to re-initialize the wallet.
// func (backend *Backend) handleConnectionError(wallet *btc.Account) {
// 	for {
// 		select {
// 		case err := <-wallet.errorChannel:
// 			wallet.log.WithFields(logrus.Fields{"error": err, "wallet": wallet.Name}).
// 				Warning("Connection failed. Retrying... ", wallet.Account)
// 			if wallet.Account != nil {
// 				func() {
// 					defer backend.walletsLock.Lock()()
// 					backend.onWalletUninit(wallet)
// 					wallet.Account.Close()
// 					wallet.Account = nil
// 				}()
// 			}
// 			// Re-attempt until the connection is ok again. The errorChannel deliberately has
// 			// a capacity of 1 so that the wallet is not re-initialized again if multiple errors
// 			// arrive quickly.
// 			for {
// 				err := func() error {
// 					defer backend.walletsLock.Lock()()
// 					return backend.initWallet(wallet)
// 				}()
// 				if err != nil {
// 					if connectionError, ok := err.(connectionError); ok {
// 						backend.log.WithFields(logrus.Fields{"wallet": wallet, "error": connectionError}).
// 							Debugf("Initializing wallet continued to fail. Trying again in %v",
// 								reattemptPeriod)
// 						time.Sleep(reattemptPeriod)
// 					} else {
// 						backend.log.WithField("error", err).Panic("Failed to initialize wallet")
// 					}
// 				} else {
// 					break
// 				}
// 			}
// 		}
// 	}
// }

func (backend *Backend) initWallets() error {
	defer backend.accountsLock.Lock()()
	return backend.initAccounts()
	// wg := sync.WaitGroup{}
	// backend.walletsSyncStart = time.Now()
	// for _, wallet := range backend.wallets {
	// 	wg.Add(1)
	// 	go func(wallet *Coin) {
	// 		defer wg.Done()

	// 		go backend.handleConnectionError(wallet)

	// 		if err := backend.initWallet(wallet); err != nil {
	// 			backend.log.WithField("error", err).Panic("Failed to initialize wallet")
	// 		}
	// 	}(wallet)
	// }
	// wg.Wait()
	// backend.log.Info("wallets init finished")
	// return nil
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
	backend.uninitWallets()
	if err := backend.initWallets(); err != nil {
		backend.log.Panic("Failed to initialize wallets.", err)
	}
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
	theDevice.SetOnEvent(func(event device.Event) {
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
			if mainKeystore {

				// HACK: for device based, only one is supported at the moment.
				backend.keystores = keystore.NewKeystores()

				backend.RegisterKeystore(theDevice.KeystoreForConfiguration(nil, 0))
			}
		}
		backend.events <- deviceEvent{
			DeviceID: theDevice.Identifier(),
			Type:     "device",
			Data:     string(event),
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
		delete(backend.devices, deviceID)
		backend.onDeviceUninit(deviceID)
		if len(backend.devices) == 0 {
			backend.DeregisterKeystore()
		}
		backend.events <- backendEvent{Type: "devices", Data: "registeredChanged"}
	}
}

func (backend *Backend) listenHID() {
	usb.NewManager(backend.Register, backend.Deregister).ListenHID()
}
