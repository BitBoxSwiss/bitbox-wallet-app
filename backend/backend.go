package backend

import (
	"sync"
	"time"

	"github.com/shiftdevices/godbb/util/logging"
	"github.com/sirupsen/logrus"

	"golang.org/x/text/language"

	"github.com/btcsuite/btcd/chaincfg"
	"github.com/cloudfoundry-attic/jibber_jabber"
	"github.com/shiftdevices/godbb/coins/btc/addresses"
	"github.com/shiftdevices/godbb/coins/ltc"
	"github.com/shiftdevices/godbb/devices/bitbox"
	"github.com/shiftdevices/godbb/devices/usb"
	"github.com/shiftdevices/godbb/util/locker"
	"github.com/shiftdevices/godbb/util/semver"
)

var (
	// Version of the backend as displayed to the user.
	Version = semver.NewSemVer(0, 1, 0)
)

// Interface is the API of the backend.
type Interface interface {
	Testing() bool
	Wallets() []*Wallet
	UserLanguage() language.Tag
	OnWalletInit(f func(*Wallet))
	OnWalletUninit(f func(*Wallet))
	OnDeviceInit(f func(bitbox.Interface))
	OnDeviceUninit(f func())
	DeviceRegistered() bool
	Start() <-chan interface{}
	Register(device bitbox.Interface) error
	Deregister(deviceID string)
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
	events  chan interface{}

	device         bitbox.Interface
	onWalletInit   func(*Wallet)
	onWalletUninit func(*Wallet)
	onDeviceInit   func(bitbox.Interface)
	onDeviceUninit func()

	wallets          []*Wallet
	walletsLock      locker.Locker
	walletsSyncStart time.Time

	logEntry *logrus.Entry
}

// NewBackend creates a new backend.
func NewBackend() *Backend {
	logEntry := logging.Log.WithGroup("backend")
	return &Backend{
		testing: false,
		events:  make(chan interface{}),
		wallets: []*Wallet{
			&Wallet{
				Code:                  "btc",
				Name:                  "Bitcoin",
				WalletDerivationPath:  "m/44'/0'/0'",
				BlockExplorerTxPrefix: "https://blockchain.info/tx/",
				net:         &chaincfg.MainNetParams,
				addressType: addresses.AddressTypeP2PKH,
				logEntry:    logEntry,
			},
			&Wallet{
				Code:                  "btc-p2wpkh-p2sh",
				Name:                  "Bitcoin Segwit",
				WalletDerivationPath:  "m/49'/0'/0'",
				BlockExplorerTxPrefix: "https://blockchain.info/tx/",
				net:         &chaincfg.MainNetParams,
				addressType: addresses.AddressTypeP2WPKHP2SH,
				logEntry:    logEntry,
			},
			&Wallet{
				Code:                  "ltc-p2wpkh-p2sh",
				Name:                  "Litecoin",
				WalletDerivationPath:  "m/49'/2'/0'",
				BlockExplorerTxPrefix: "https://insight.litecore.io/tx/",
				net:         &ltc.MainNetParams,
				addressType: addresses.AddressTypeP2WPKHP2SH,
				logEntry:    logEntry,
			},
		},
		logEntry: logEntry,
	}
}

// NewBackendForTesting creates a new backend for testing.
func NewBackendForTesting(regtest bool) *Backend {
	var wallets []*Wallet
	logEntry := logging.Log.WithGroup("backend")
	if regtest {
		wallets = []*Wallet{
			&Wallet{
				Code:                  "rbtc",
				Name:                  "Bitcoin Regtest",
				WalletDerivationPath:  "m/44'/1'/0'",
				BlockExplorerTxPrefix: "https://testnet.blockchain.info/tx/",
				net:         &chaincfg.RegressionNetParams,
				addressType: addresses.AddressTypeP2PKH,
				logEntry:    logEntry,
			},
			&Wallet{
				Code:                  "rbtc-p2wpkh-p2sh",
				Name:                  "Bitcoin Regtest Segwit",
				WalletDerivationPath:  "m/49'/1'/0'",
				BlockExplorerTxPrefix: "https://testnet.blockchain.info/tx/",
				net:         &chaincfg.RegressionNetParams,
				addressType: addresses.AddressTypeP2WPKHP2SH,
				logEntry:    logEntry,
			},
		}
	} else {
		wallets = []*Wallet{
			&Wallet{
				Code:                  "tbtc",
				Name:                  "Bitcoin Testnet",
				WalletDerivationPath:  "m/44'/1'/0'",
				BlockExplorerTxPrefix: "https://testnet.blockchain.info/tx/",
				net:         &chaincfg.TestNet3Params,
				addressType: addresses.AddressTypeP2PKH,
				logEntry:    logEntry,
			},
			&Wallet{
				Code:                  "tbtc-p2wpkh-p2sh",
				Name:                  "Bitcoin Testnet Segwit",
				WalletDerivationPath:  "m/49'/1'/0'",
				BlockExplorerTxPrefix: "https://testnet.blockchain.info/tx/",
				net:         &chaincfg.TestNet3Params,
				addressType: addresses.AddressTypeP2WPKHP2SH,
				logEntry:    logEntry,
			},
			&Wallet{
				Code:                  "tltc-p2wpkh-p2sh",
				Name:                  "Litecoin Testnet",
				WalletDerivationPath:  "m/49'/1'/0'",
				BlockExplorerTxPrefix: "http://explorer.litecointools.com/tx/",
				net:         &ltc.TestNet4Params,
				addressType: addresses.AddressTypeP2WPKHP2SH,
				logEntry:    logEntry,
			},
		}
	}
	return &Backend{
		testing:  true,
		events:   make(chan interface{}),
		wallets:  wallets,
		logEntry: logEntry,
	}
}

// Testing returns whether this backend is for testing only.
func (backend *Backend) Testing() bool {
	return backend.testing
}

// Wallets returns the supported wallets.
func (backend *Backend) Wallets() []*Wallet {
	return backend.wallets
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
	backend.logEntry.WithField("user-language", tag).Info("Detected user language")
	return tag
}

// OnWalletInit installs a callback to be called when a wallet is initialized.
func (backend *Backend) OnWalletInit(f func(*Wallet)) {
	backend.onWalletInit = f
}

// OnWalletUninit installs a callback to be called when a wallet is stopped.
func (backend *Backend) OnWalletUninit(f func(*Wallet)) {
	backend.onWalletUninit = f
}

// OnDeviceInit installs a callback to be called when a device is initialized.
func (backend *Backend) OnDeviceInit(f func(bitbox.Interface)) {
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

func (backend *Backend) initWallets() error {
	defer backend.walletsLock.Lock()()
	wg := sync.WaitGroup{}
	backend.walletsSyncStart = time.Now()
	for _, wallet := range backend.wallets {
		wg.Add(1)
		go func(wallet *Wallet) {
			defer wg.Done()
			if err := wallet.init(backend); err != nil {
				backend.logEntry.WithField("error", err).Panic("Failed to initialize wallet")
				// TODO: instead of crashing, we should inform the user about an unrecoverable problem
				// and encourage him/her to send in the logs
				panic(err)
			}
			backend.onWalletInit(wallet)
			wallet.Wallet.Init()
		}(wallet)
	}
	wg.Wait()
	return nil
}

// DeviceRegistered returns whether a device is plugged in.
func (backend *Backend) DeviceRegistered() bool {
	return backend.device != nil
}

func (backend *Backend) uninitWallets() {
	defer backend.walletsLock.Lock()()
	for _, wallet := range backend.wallets {
		if wallet.Wallet != nil {
			backend.onWalletUninit(wallet)
			wallet.Wallet.Close()
			wallet.Wallet = nil
		}
	}
}

// Register registers the given device at this backend.
func (backend *Backend) Register(device bitbox.Interface) error {
	backend.device = device
	backend.onDeviceInit(device)
	backend.device.SetOnEvent(func(event bitbox.Event) {
		switch event {
		case bitbox.EventStatusChanged:
			if backend.device.Status() == bitbox.StatusSeeded {
				backend.uninitWallets()
				go func() {
					if err := backend.initWallets(); err != nil {
						backend.logEntry.Panic("Failed to initialize wallets")
						// TODO
						panic(err)
					}
				}()
			}
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
	if deviceID == backend.device.DeviceID() {
		backend.device = nil
		backend.onDeviceUninit()
		backend.uninitWallets()
		backend.events <- devicesEvent{Type: "devices", Data: "registeredChanged"}
	}
}

func (backend *Backend) listenHID() {
	usb.NewManager(backend.Register, backend.Deregister).ListenHID()
}
