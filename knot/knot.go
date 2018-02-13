package knot

import (
	"fmt"
	"log"
	"sync"
	"time"

	"golang.org/x/text/language"

	"github.com/btcsuite/btcd/chaincfg"
	"github.com/cloudfoundry-attic/jibber_jabber"
	"github.com/shiftdevices/godbb/coins/btc"
	"github.com/shiftdevices/godbb/coins/btc/addresses"
	"github.com/shiftdevices/godbb/coins/btc/electrum"
	"github.com/shiftdevices/godbb/coins/btc/keystore"
	"github.com/shiftdevices/godbb/coins/ltc"
	"github.com/shiftdevices/godbb/devices/bitbox"
	"github.com/shiftdevices/godbb/devices/usb"
	"github.com/shiftdevices/godbb/util/locker"
)

const (
	// dev server for now
	electrumServerBitcoinTestnet  = "176.9.28.202:51002"
	electrumServerBitcoinMainnet  = "176.9.28.202:50002"
	electrumServerLitecoinTestnet = "176.9.28.202:51004"
	electrumServerLitecoinMainnet = "176.9.28.202:50004"
)

// Interface is the API of the knot.
type Interface interface {
	Wallets() []*Wallet
	UserLanguage() language.Tag
	OnWalletInit(f func(*Wallet))
	OnWalletUninit(f func(*Wallet))
	OnDeviceInit(f func(bitbox.Interface))
	OnDeviceUninit(f func())
	DeviceRegistered() bool
	Start() <-chan interface{}
}

// Wallet wraps a wallet of a specific coin identified by Code.
type Wallet struct {
	Code   string
	Name   string
	Wallet btc.Interface

	net                  *chaincfg.Params
	walletDerivationPath string
	addressType          addresses.AddressType
}

func (wallet *Wallet) init(knot *Knot) error {
	var electrumServer string
	switch wallet.Code {
	case "tbtc":
		electrumServer = electrumServerBitcoinTestnet
	case "tbtc-p2wpkh-p2sh":
		electrumServer = electrumServerBitcoinTestnet
	case "btc":
		electrumServer = electrumServerBitcoinMainnet
	case "btc-p2wpkh-p2sh":
		electrumServer = electrumServerBitcoinMainnet
	case "tltc-p2wpkh-p2sh":
		electrumServer = electrumServerLitecoinTestnet
	case "ltc-p2wpkh-p2sh":
		electrumServer = electrumServerLitecoinMainnet
	default:
		panic(fmt.Sprintf("unknown coin %s", wallet.Code))
	}
	electrumClient, err := electrum.NewElectrumClient(electrumServer, true)
	if err != nil {
		return err
	}
	keystore, err := keystore.NewDBBKeyStore(knot.device, wallet.walletDerivationPath, wallet.net)
	if err != nil {
		return err
	}
	wallet.Wallet, err = btc.NewDeterministicWallet(
		wallet.net,
		keystore,
		electrumClient,
		wallet.addressType,
		func(event btc.Event) {
			if event == btc.EventStatusChanged && wallet.Wallet.Initialized() {
				log.Printf("wallet sync time for %s: %s\n",
					wallet.Code,
					time.Now().Sub(knot.walletsSyncStart))
			}
			knot.events <- walletEvent{Type: "wallet", Code: wallet.Code, Data: string(event)}
		},
	)
	if err != nil {
		return err
	}
	return nil
}

type deviceEvent struct {
	Type string `json:"type"`
	Data string `json:"data"`
}

type devicesEvent deviceEvent

type walletEvent struct {
	Type string `json:"type"`
	Code string `json:"code"`
	Data string `json:"data"`
}

// Knot ties everything together and is the main starting point to use the godbb library.
type Knot struct {
	events chan interface{}

	device         *bitbox.Device
	onWalletInit   func(*Wallet)
	onWalletUninit func(*Wallet)
	onDeviceInit   func(bitbox.Interface)
	onDeviceUninit func()

	wallets          []*Wallet
	walletsLock      locker.Locker
	walletsSyncStart time.Time
}

// NewKnot creates a new Knot.
func NewKnot() *Knot {
	return &Knot{
		events: make(chan interface{}),
		wallets: []*Wallet{
			&Wallet{
				Code:                 "tbtc",
				Name:                 "Bitcoin Testnet",
				net:                  &chaincfg.TestNet3Params,
				walletDerivationPath: "m/44'/1'/0'",
				addressType:          addresses.AddressTypeP2PKH,
			},
			&Wallet{
				Code:                 "tbtc-p2wpkh-p2sh",
				Name:                 "Bitcoin Testnet Segwit",
				net:                  &chaincfg.TestNet3Params,
				walletDerivationPath: "m/49'/1'/0'",
				addressType:          addresses.AddressTypeP2WPKHP2SH,
			},
			&Wallet{
				Code:                 "btc",
				Name:                 "Bitcoin",
				net:                  &chaincfg.MainNetParams,
				walletDerivationPath: "m/44'/0'/0'",
				addressType:          addresses.AddressTypeP2PKH,
			},
			&Wallet{
				Code:                 "btc-p2wpkh-p2sh",
				Name:                 "Bitcoin Segwit",
				net:                  &chaincfg.MainNetParams,
				walletDerivationPath: "m/49'/0'/0'",
				addressType:          addresses.AddressTypeP2WPKHP2SH,
			},
			&Wallet{
				Code:                 "tltc-p2wpkh-p2sh",
				Name:                 "Litecoin Testnet",
				net:                  &ltc.TestNet4Params,
				walletDerivationPath: "m/49'/1'/0'",
				addressType:          addresses.AddressTypeP2WPKHP2SH,
			},
			&Wallet{
				Code:                 "ltc-p2wpkh-p2sh",
				Name:                 "Litecoin",
				net:                  &ltc.MainNetParams,
				walletDerivationPath: "m/49'/2'/0'",
				addressType:          addresses.AddressTypeP2WPKHP2SH,
			},
		},
	}
}

// Wallets returns the supported wallets.
func (knot *Knot) Wallets() []*Wallet {
	return knot.wallets
}

// UserLanguage returns the language the UI should be presented in to the user.
func (knot *Knot) UserLanguage() language.Tag {
	userLocale, err := jibber_jabber.DetectIETF()
	if err != nil {
		return language.English
	}
	languages := []language.Tag{
		language.English,
		language.German,
	}
	tag, _, _ := language.NewMatcher(languages).Match(language.Make(userLocale))
	return tag
}

// OnWalletInit installs a callback to be called when a wallet is initialized.
func (knot *Knot) OnWalletInit(f func(*Wallet)) {
	knot.onWalletInit = f
}

// OnWalletUninit installs a callback to be called when a wallet is stopped.
func (knot *Knot) OnWalletUninit(f func(*Wallet)) {
	knot.onWalletUninit = f
}

// OnDeviceInit installs a callback to be called when a device is initialized.
func (knot *Knot) OnDeviceInit(f func(bitbox.Interface)) {
	knot.onDeviceInit = f
}

// OnDeviceUninit installs a callback to be called when a device is uninitialized.
func (knot *Knot) OnDeviceUninit(f func()) {
	knot.onDeviceUninit = f
}

// Start starts the background services. It returns a channel of events to handle by the library
// client.
func (knot *Knot) Start() <-chan interface{} {
	go knot.listenHID()
	return knot.events
}

func (knot *Knot) initWallets() error {
	defer knot.walletsLock.Lock()()
	wg := sync.WaitGroup{}
	knot.walletsSyncStart = time.Now()
	for _, wallet := range knot.wallets {
		wg.Add(1)
		go func(wallet *Wallet) {
			defer wg.Done()
			if err := wallet.init(knot); err != nil {
				// TODO
				panic(err)
			}
			knot.onWalletInit(wallet)
			wallet.Wallet.Init()
		}(wallet)
	}
	wg.Wait()
	return nil
}

// DeviceRegistered returns whether a device is plugged in.
func (knot *Knot) DeviceRegistered() bool {
	return knot.device != nil
}

func (knot *Knot) uninitWallets() {
	defer knot.walletsLock.Lock()()
	for _, wallet := range knot.wallets {
		if wallet.Wallet != nil {
			knot.onWalletUninit(wallet)
			wallet.Wallet.Close()
			wallet.Wallet = nil
		}
	}
}

func (knot *Knot) register(device *bitbox.Device) error {
	knot.device = device
	knot.onDeviceInit(device)
	knot.device.SetOnEvent(func(event bitbox.Event) {
		switch event {
		case bitbox.EventStatusChanged:
			if knot.device.Status() == bitbox.StatusSeeded {
				knot.uninitWallets()
				go func() {
					if err := knot.initWallets(); err != nil {
						// TODO
						panic(err)
					}
				}()
			}
			knot.events <- deviceEvent{Type: "device", Data: string(event)}
		}
	})
	select {
	case knot.events <- devicesEvent{Type: "devices", Data: "registeredChanged"}:
	default:
	}
	return nil
}

func (knot *Knot) unregister(deviceID string) {
	if deviceID == knot.device.DeviceID() {
		knot.device = nil
		knot.onDeviceUninit()
		knot.uninitWallets()
		knot.events <- devicesEvent{Type: "devices", Data: "registeredChanged"}
	}
}

func (knot *Knot) listenHID() {
	usb.NewManager(knot.register, knot.unregister).ListenHID()
}
