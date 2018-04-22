package backend

import (
	"fmt"
	"path"
	"sync"
	"time"

	"github.com/shiftdevices/godbb/util/errp"
	"github.com/shiftdevices/godbb/util/logging"
	"github.com/sirupsen/logrus"

	"golang.org/x/text/language"

	"github.com/btcsuite/btcd/chaincfg"
	"github.com/btcsuite/btcd/wire"
	"github.com/cloudfoundry-attic/jibber_jabber"
	"github.com/shiftdevices/godbb/backend/coins/btc/addresses"
	"github.com/shiftdevices/godbb/backend/coins/btc/blockchain"
	"github.com/shiftdevices/godbb/backend/coins/btc/electrum"
	"github.com/shiftdevices/godbb/backend/coins/btc/headers"
	"github.com/shiftdevices/godbb/backend/coins/ltc"
	"github.com/shiftdevices/godbb/backend/db/headersdb"
	"github.com/shiftdevices/godbb/backend/db/transactionsdb"
	"github.com/shiftdevices/godbb/backend/devices/bitbox"
	"github.com/shiftdevices/godbb/backend/devices/usb"
	"github.com/shiftdevices/godbb/util/locker"
	"github.com/shiftdevices/godbb/util/semver"
)

// dbFilename is where the database is stored.
const dbFilename = "bitbox.db"

var (
	// Version of the backend as displayed to the user.
	Version = semver.NewSemVer(0, 1, 0)
)

const (
	// reattemptPeriod is the time until re-establishing of the connection
	// to a coin backend is attempted.
	reattemptPeriod = 30 * time.Second
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

	db        *transactionsdb.DB
	appFolder string
	events    chan interface{}

	device         bitbox.Interface
	onWalletInit   func(*Wallet)
	onWalletUninit func(*Wallet)
	onDeviceInit   func(bitbox.Interface)
	onDeviceUninit func()

	wallets          []*Wallet
	walletsLock      locker.Locker
	walletsSyncStart time.Time

	electrumClients     map[wire.BitcoinNet]blockchain.Interface
	electrumClientsLock locker.Locker

	headers     map[wire.BitcoinNet]*headers.Headers
	headersLock locker.Locker

	log *logrus.Entry
}

// NewBackend creates a new backend.
func NewBackend(appFolder string) (*Backend, error) {
	return newBackendFromWallets(
		appFolder,
		[]*Wallet{
			&Wallet{
				Code:                  "btc",
				Name:                  "Bitcoin",
				WalletDerivationPath:  "m/44'/0'/0'",
				BlockExplorerTxPrefix: "https://blockchain.info/tx/",
				net:          &chaincfg.MainNetParams,
				addressType:  addresses.AddressTypeP2PKH,
				errorChannel: make(chan error, 0),
			},
			&Wallet{
				Code:                  "btc-p2wpkh-p2sh",
				Name:                  "Bitcoin Segwit",
				WalletDerivationPath:  "m/49'/0'/0'",
				BlockExplorerTxPrefix: "https://blockchain.info/tx/",
				net:          &chaincfg.MainNetParams,
				addressType:  addresses.AddressTypeP2WPKHP2SH,
				errorChannel: make(chan error, 0),
			},
			&Wallet{
				Code:                  "ltc-p2wpkh-p2sh",
				Name:                  "Litecoin",
				WalletDerivationPath:  "m/49'/2'/0'",
				BlockExplorerTxPrefix: "https://insight.litecore.io/tx/",
				net:          &ltc.MainNetParams,
				addressType:  addresses.AddressTypeP2WPKHP2SH,
				errorChannel: make(chan error, 0),
			},
		}, false)
}

// NewBackendForTesting creates a new backend for testing.
func NewBackendForTesting(appFolder string, regtest bool) (*Backend, error) {
	var wallets []*Wallet
	if regtest {
		wallets = []*Wallet{
			&Wallet{
				Code:                  "rbtc",
				Name:                  "Bitcoin Regtest",
				WalletDerivationPath:  "m/44'/1'/0'",
				BlockExplorerTxPrefix: "https://testnet.blockchain.info/tx/",
				net:          &chaincfg.RegressionNetParams,
				addressType:  addresses.AddressTypeP2PKH,
				errorChannel: make(chan error, 0),
			},
			&Wallet{
				Code:                  "rbtc-p2wpkh-p2sh",
				Name:                  "Bitcoin Regtest Segwit",
				WalletDerivationPath:  "m/49'/1'/0'",
				BlockExplorerTxPrefix: "https://testnet.blockchain.info/tx/",
				net:          &chaincfg.RegressionNetParams,
				addressType:  addresses.AddressTypeP2WPKHP2SH,
				errorChannel: make(chan error, 0),
			},
		}
	} else {
		wallets = []*Wallet{
			&Wallet{
				Code:                  "tbtc",
				Name:                  "Bitcoin Testnet",
				WalletDerivationPath:  "m/44'/1'/0'",
				BlockExplorerTxPrefix: "https://testnet.blockchain.info/tx/",
				net:          &chaincfg.TestNet3Params,
				addressType:  addresses.AddressTypeP2PKH,
				errorChannel: make(chan error, 0),
			},
			&Wallet{
				Code:                  "tbtc-p2wpkh-p2sh",
				Name:                  "Bitcoin Testnet Segwit",
				WalletDerivationPath:  "m/49'/1'/0'",
				BlockExplorerTxPrefix: "https://testnet.blockchain.info/tx/",
				net:          &chaincfg.TestNet3Params,
				addressType:  addresses.AddressTypeP2WPKHP2SH,
				errorChannel: make(chan error, 0),
			},
			&Wallet{
				Code:                  "tltc-p2wpkh-p2sh",
				Name:                  "Litecoin Testnet",
				WalletDerivationPath:  "m/49'/1'/0'",
				BlockExplorerTxPrefix: "http://explorer.litecointools.com/tx/",
				net:          &ltc.TestNet4Params,
				addressType:  addresses.AddressTypeP2WPKHP2SH,
				errorChannel: make(chan error, 0),
			},
		}
	}
	return newBackendFromWallets(appFolder, wallets, true)
}

func newBackendFromWallets(appFolder string, wallets []*Wallet, testing bool) (*Backend, error) {
	log := logging.Log.WithGroup("backend")
	log.Infof("App folder: %s", appFolder)
	db, err := transactionsdb.NewDB(path.Join(appFolder, dbFilename))
	if err != nil {
		return nil, err
	}
	return &Backend{
		testing:   testing,
		db:        db,
		appFolder: appFolder,
		events:    make(chan interface{}, 1000),
		wallets:   wallets,

		electrumClients: map[wire.BitcoinNet]blockchain.Interface{},

		headers: map[wire.BitcoinNet]*headers.Headers{},

		log: log,
	}, nil
}

func netName(net *chaincfg.Params) string {
	switch net.Net {
	case wire.TestNet3:
		return "tbtc"
	case wire.TestNet:
		return "rbtc"
	case wire.MainNet:
		return "btc"
	case ltc.TestNet4:
		return "tltc"
	case ltc.MainNet:
		return "ltc"
	default:
		panic(fmt.Sprintf("unknown net %s", net.Net))
	}

}

func (backend *Backend) electrumClient(net *chaincfg.Params) (blockchain.Interface, error) {
	defer backend.electrumClientsLock.Lock()()
	if _, ok := backend.electrumClients[net.Net]; !ok {
		var electrumServer string
		tls := true
		switch net.Net {
		case wire.TestNet3:
			electrumServer = electrumServerBitcoinTestnet
		case wire.TestNet:
			electrumServer = electrumServerBitcoinRegtest
			tls = false
		case wire.MainNet:
			electrumServer = electrumServerBitcoinMainnet
		case ltc.TestNet4:
			electrumServer = electrumServerLitecoinTestnet
		case ltc.MainNet:
			electrumServer = electrumServerLitecoinMainnet
		default:
			backend.log.Panic(fmt.Sprintf("unknown net %s", net.Net))
		}

		var err error
		backend.electrumClients[net.Net], err = electrum.NewElectrumClient(
			electrumServer, tls, func(err error) {
				err = maybeConnectionError(err)
				if _, ok := errp.Cause(err).(connectionError); !ok {
					backend.log.WithField("error", err).Panic(err.Error())
				}
				unlock := backend.electrumClientsLock.Lock()
				delete(backend.electrumClients, net.Net)
				unlock()
				for _, wallet := range backend.wallets {
					if wallet.net.Net != net.Net {
						continue
					}
					select {
					case wallet.errorChannel <- err:
					default:
						wallet.log.WithField("error", err).Error(err.Error())
					}
				}
			}, backend.log.WithField("net", netName(net)))
		if err != nil {
			return nil, maybeConnectionError(err)
		}
	}
	return backend.electrumClients[net.Net], nil
}

func (backend *Backend) getHeaders(net *chaincfg.Params) (*headers.Headers, error) {
	defer backend.headersLock.Lock()()
	if _, ok := backend.headers[net.Net]; !ok {
		blockchain, err := backend.electrumClient(net)
		if err != nil {
			return nil, err
		}
		log := backend.log.WithField("net", netName(net))

		db, err := headersdb.NewDB(
			path.Join(backend.appFolder, fmt.Sprintf("headers-%s.db", netName(net))))
		if err != nil {
			return nil, err
		}

		backend.headers[net.Net] = headers.NewHeaders(
			net,
			db,
			blockchain,
			log)
		if err := backend.headers[net.Net].Init(); err != nil {
			return nil, err
		}
	}
	return backend.headers[net.Net], nil
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
	backend.log.WithField("user-language", tag).Info("Detected user language")
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

// initWallet initializes a single wallet.
func (backend *Backend) initWallet(wallet *Wallet) error {
	if err := wallet.init(backend); err != nil {
		return err
	}
	backend.onWalletInit(wallet)
	wallet.Wallet.Init()
	return nil
}

// handleConnectionError listens on an error channel for incoming connection errors and attempts
// to re-initialize the wallet.
func (backend *Backend) handleConnectionError(wallet *Wallet) {
	for {
		select {
		case err := <-wallet.errorChannel:
			wallet.log.WithFields(logrus.Fields{"error": err, "wallet": wallet.Name}).
				Warning("Connection failed. Retrying... ", wallet.Wallet)
			if wallet.Wallet != nil {
				func() {
					defer backend.walletsLock.Lock()()
					backend.onWalletUninit(wallet)
					wallet.Wallet.Close()
					wallet.Wallet = nil
				}()
			}
			// Re-attempt until the connection is ok again. The errorChannel deliberately has
			// a capacity of 1 so that the wallet is not re-initialized again if multiple errors
			// arrive quickly.
			for {
				err := func() error {
					defer backend.walletsLock.Lock()()
					return backend.initWallet(wallet)
				}()
				if err != nil {
					if connectionError, ok := err.(connectionError); ok {
						backend.log.WithFields(logrus.Fields{"wallet": wallet, "error": connectionError}).
							Debugf("Initializing wallet continued to fail. Trying again in %v",
								reattemptPeriod)
						time.Sleep(reattemptPeriod)
					} else {
						backend.log.WithField("error", err).Panic("Failed to initialize wallet")
					}
				} else {
					break
				}
			}
		}
	}
}

func (backend *Backend) initWallets() error {
	defer backend.walletsLock.Lock()()
	wg := sync.WaitGroup{}
	backend.walletsSyncStart = time.Now()
	for _, wallet := range backend.wallets {
		wg.Add(1)
		go func(wallet *Wallet) {
			defer wg.Done()

			go backend.handleConnectionError(wallet)

			if err := backend.initWallet(wallet); err != nil {
				backend.log.WithField("error", err).Panic("Failed to initialize wallet")
			}
		}(wallet)
	}
	wg.Wait()
	backend.log.Info("wallets init finished")
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
	backend.device.SetPasswordPolicy(backend.Testing())
	backend.device.SetOnEvent(func(event bitbox.Event) {
		switch event {
		case bitbox.EventStatusChanged:
			if backend.device.Status() == bitbox.StatusSeeded {
				backend.uninitWallets()
				go func() {
					if err := backend.initWallets(); err != nil {
						backend.log.Panic("Failed to initialize wallets")
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
