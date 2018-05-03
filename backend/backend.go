package backend

import (
	"os"
	"path"

	"golang.org/x/text/language"

	"github.com/btcsuite/btcutil/hdkeychain"
	"github.com/cloudfoundry-attic/jibber_jabber"
	"github.com/shiftdevices/godbb/backend/coins/btc"
	"github.com/shiftdevices/godbb/backend/coins/btc/addresses"
	"github.com/shiftdevices/godbb/backend/coins/ltc"
	"github.com/shiftdevices/godbb/backend/devices/device"
	"github.com/shiftdevices/godbb/backend/devices/usb"
	"github.com/shiftdevices/godbb/backend/keystore"
	"github.com/shiftdevices/godbb/backend/signing"
	"github.com/shiftdevices/godbb/util/errp"
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
	WalletStatus() string
	Testing() bool
	Accounts() []*btc.Account
	UserLanguage() language.Tag
	OnWalletInit(f func(*btc.Account))
	OnWalletUninit(f func(*btc.Account))
	OnDeviceInit(f func(device.Interface))
	OnDeviceUninit(f func())
	DeviceRegistered() bool
	Start() <-chan interface{}
	RegisterKeystore(keystore.Keystore)
	DeregisterKeystore()
	Register(device device.Interface) error
	Deregister(deviceID string)
}

// DefaultAppFolder returns the default location to store application data.
func DefaultAppFolder() string {
	return "."
}

type deviceEvent struct {
	Type string `json:"type"`
	Data string `json:"data"`
}

type devicesEvent deviceEvent

// WalletEvent models an event triggered by a wallet.
type WalletEvent struct {
	Type string `json:"type"`
	Code string `json:"code"`
	Data string `json:"data"`
}

// Backend ties everything together and is the main starting point to use the godbb library.
type Backend struct {
	testing bool
	regtest bool

	appFolder string
	dbFolder  string
	events    chan interface{}

	device         device.Interface
	keystores      keystore.Keystores
	onWalletInit   func(*btc.Account)
	onWalletUninit func(*btc.Account)
	onDeviceInit   func(device.Interface)
	onDeviceUninit func()

	accounts     []*btc.Account
	accountsLock locker.Locker
	// accountsSyncStart time.Time

	log *logrus.Entry
}

// NewBackend creates a new backend.
func NewBackend(appFolder string, testing bool, regtest bool) (*Backend, error) {
	log := logging.Log.WithGroup("backend")
	log.Infof("App folder: %s", appFolder)
	dbFolder := path.Join(appFolder, "cache")
	if err := os.MkdirAll(dbFolder, 0700); err != nil {
		return nil, errp.WithStack(err)
	}
	log.Infof("Created db folder: %s", dbFolder)
	return &Backend{
		testing:   testing,
		regtest:   regtest,
		appFolder: appFolder,
		dbFolder:  dbFolder,
		events:    make(chan interface{}, 1000),
		keystores: keystore.NewKeystores(),

		log: log,
	}, nil
}

func (backend *Backend) addAccount(
	coin *btc.Coin,
	code string,
	name string,
	keypath string,
	addressType addresses.AddressType,
) error {
	onEvent := func(code string) func(btc.Event) {
		return func(event btc.Event) {
			backend.events <- WalletEvent{Type: "wallet", Code: code, Data: string(event)}
		}
	}
	absoluteKeypath, err := signing.NewAbsoluteKeypath(keypath)
	if err != nil {
		return err
	}
	configuration, err := backend.keystores.Configuration(absoluteKeypath, backend.keystores.Count())
	if err != nil {
		return err
	}
	account, err := coin.NewAccount(backend.dbFolder, code, name, configuration, backend.keystores, addresses.AddressTypeP2PKH, onEvent(code))
	if err != nil {
		return err
	}
	backend.accounts = append(backend.accounts, account)
	return nil
}

func (backend *Backend) initAccounts() error {
	backend.accounts = []*btc.Account{}
	if backend.testing {
		if backend.regtest {
			if err := backend.addAccount(btc.RegtestCoin, "rbtc", "Bitcoin Regtest", "m/44'/1'/0'", addresses.AddressTypeP2PKH); err != nil {
				return err
			}
			if err := backend.addAccount(btc.RegtestCoin, "rbtc-p2wpkh-p2sh", "Bitcoin Regtest Segwit", "m/49'/1'/0'", addresses.AddressTypeP2WPKHP2SH); err != nil {
				return err
			}
		} else {
			if err := backend.addAccount(btc.TestnetCoin, "tbtc", "Bitcoin Testnet", "m/44'/1'/0'", addresses.AddressTypeP2PKH); err != nil {
				return err
			}
			if err := backend.addAccount(btc.TestnetCoin, "tbtc-p2wpkh-p2sh", "Bitcoin Testnet Segwit", "m/49'/1'/0'", addresses.AddressTypeP2WPKHP2SH); err != nil {
				return err
			}
			if err := backend.addAccount(ltc.TestnetCoin, "tltc-p2wpkh-p2sh", "Litecoin Testnet", "m/49'/1'/0'", addresses.AddressTypeP2WPKHP2SH); err != nil {
				return err
			}
		}
	} else {
		if err := backend.addAccount(btc.MainnetCoin, "btc", "Bitcoin", "m/44'/0'/0'", addresses.AddressTypeP2PKH); err != nil {
			return err
		}
		if err := backend.addAccount(btc.MainnetCoin, "btc-p2wpkh-p2sh", "Bitcoin Segwit", "m/49'/0'/0'", addresses.AddressTypeP2WPKHP2SH); err != nil {
			return err
		}
		if err := backend.addAccount(ltc.MainnetCoin, "ltc-p2wpkh-p2sh", "Litecoin Segwit", "m/49'/2'/0'", addresses.AddressTypeP2WPKHP2SH); err != nil {
			return err
		}
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

// WalletStatus returns whether the wallets have been initialized.
func (backend *Backend) WalletStatus() string {
	if backend.keystores.Count() > 0 {
		return "initialized"
	}
	return "uninitialized"
}

// Testing returns whether this backend is for testing only.
func (backend *Backend) Testing() bool {
	return backend.testing
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
	backend.log.WithField("user-language", tag).Info("Detected user language")
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
func (backend *Backend) OnDeviceUninit(f func()) {
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

// DeviceRegistered returns whether a device is plugged in.
func (backend *Backend) DeviceRegistered() bool {
	return backend.device != nil
}

func (backend *Backend) uninitWallets() {
	defer backend.accountsLock.Lock()()
	for _, account := range backend.accounts {
		account := account
		backend.onWalletUninit(account)
		account.Close()
	}
}

// RegisterKeystore registers the given keystore at this backend.
func (backend *Backend) RegisterKeystore(keystore keystore.Keystore) {
	if err := backend.keystores.Add(keystore); err != nil {
		backend.log.Panic("Failed to add a keystore.", err)
		panic(err)
	}
	backend.uninitWallets()
	if err := backend.initWallets(); err != nil {
		backend.log.Panic("Failed to initialize wallets.", err)
		panic(err)
	}
	backend.events <- deviceEvent{Type: "backend", Data: "walletStatusChanged"}
}

// DeregisterKeystore removes the registered keystore.
func (backend *Backend) DeregisterKeystore() {
	backend.keystores = keystore.NewKeystores()
	backend.uninitWallets()
	backend.events <- deviceEvent{Type: "backend", Data: "walletStatusChanged"}
}

// Register registers the given device at this backend.
func (backend *Backend) Register(theDevice device.Interface) error {
	if backend.device != nil {
		return nil
	}
	backend.device = theDevice
	backend.onDeviceInit(backend.device)
	backend.device.Init(backend.Testing())
	backend.device.SetOnEvent(func(event device.Event) {
		switch event {
		case device.EventKeystoreAvailable:
			absoluteKeypath := signing.NewEmptyAbsoluteKeypath().Child(44, signing.Hardened)
			extendedPublicKey, err := backend.device.ExtendedPublicKey(absoluteKeypath)
			if err != nil {
				panic(err)
			}
			configuration := signing.NewConfiguration(absoluteKeypath,
				[]*hdkeychain.ExtendedKey{extendedPublicKey}, 1)
			backend.RegisterKeystore(backend.device.KeystoreForConfiguration(configuration, 0))
		}
		backend.events <- deviceEvent{Type: "device", Data: string(event)}
	})
	select {
	case backend.events <- devicesEvent{Type: "devices", Data: "registeredChanged"}:
	default:
	}
	return nil
}

// Deregister deregisters the device with the given ID from this backend.
func (backend *Backend) Deregister(deviceID string) {
	if backend.device != nil && deviceID == backend.device.Identifier() {
		backend.device = nil
		backend.onDeviceUninit()
		backend.DeregisterKeystore()
		backend.events <- devicesEvent{Type: "devices", Data: "registeredChanged"}
	}
}

func (backend *Backend) listenHID() {
	usb.NewManager(backend.Register, backend.Deregister).ListenHID()
}
