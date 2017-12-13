package knot

import (
	"fmt"

	"golang.org/x/text/language"

	"github.com/btcsuite/btcd/chaincfg"
	"github.com/cloudfoundry-attic/jibber_jabber"
	"github.com/shiftdevices/godbb/dbbdevice"
	"github.com/shiftdevices/godbb/dbbdevice/keystore"
	"github.com/shiftdevices/godbb/deterministicwallet"
	"github.com/shiftdevices/godbb/electrum"
	"github.com/shiftdevices/godbb/knot/coins/ltc"
)

// Interface is the API of the knot.
type Interface interface {
	UserLanguage() language.Tag
	OnWalletInit(f func(*Wallet))
	OnWalletUninit(f func(*Wallet))
	OnDeviceInit(f func(dbbdevice.Interface))
	OnDeviceUninit(f func())
	Start() <-chan interface{}
}

// Wallet wraps a wallet of a specific coin identified by Code.
type Wallet struct {
	Code   string
	Wallet deterministicwallet.Interface
}

func (wallet *Wallet) init(knot *Knot) error {
	var electrumServer string
	var net *chaincfg.Params
	var walletDerivationPath = ""
	switch wallet.Code {
	case "tbtc":
		net = &chaincfg.TestNet3Params
		walletDerivationPath = "m/44'/1'/0'"
		electrumServer = electrum.TestServer
	case "btc":
		net = &chaincfg.MainNetParams
		walletDerivationPath = "m/44'/0'/0'"
		electrumServer = electrum.Server
	case "tltc":
		net = &ltc.TestNet4Params
		walletDerivationPath = "m/44'/1'/0'"
		electrumServer = "electrum-ltc.bysh.me:51002"
	case "ltc":
		net = &ltc.MainNetParams
		walletDerivationPath = "m/44'/2'/0'"
		electrumServer = "electrumx.nmdps.net:9434"
	default:
		panic(fmt.Sprintf("unknown coin %s", wallet.Code))
	}
	electrumClient, err := electrum.NewElectrumClient(electrumServer, true)
	if err != nil {
		return err
	}
	keystore, err := keystore.NewDBBKeyStore(knot.device, walletDerivationPath, net)
	if err != nil {
		return err
	}
	wallet.Wallet, err = deterministicwallet.NewDeterministicWallet(
		net,
		keystore,
		electrumClient,
		func(event interface{}) {
			knot.events <- walletEvent{Type: "wallet", Code: wallet.Code, Data: event.(string)}
		},
	)
	if err != nil {
		return err
	}
	return nil
}

type event struct {
	Type string `json:"type"`
	Data string `json:"data"`
}

type walletEvent struct {
	Type string `json:"type"`
	Code string `json:"code"`
	Data string `json:"data"`
}

// Knot ties everything together and is the main starting point to use the godbb library.
type Knot struct {
	events chan interface{}

	device         *dbbdevice.DBBDevice
	onWalletInit   func(*Wallet)
	onWalletUninit func(*Wallet)
	onDeviceInit   func(dbbdevice.Interface)
	onDeviceUninit func()

	wallets []*Wallet
}

// NewKnot creates a new Knot.
func NewKnot() *Knot {
	return &Knot{
		events: make(chan interface{}),
		wallets: []*Wallet{
			&Wallet{Code: "tbtc"},
			&Wallet{Code: "btc"},
			&Wallet{Code: "tltc"},
			&Wallet{Code: "ltc"},
		},
	}
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
func (knot *Knot) OnDeviceInit(f func(dbbdevice.Interface)) {
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
	for _, wallet := range knot.wallets {
		if err := wallet.init(knot); err != nil {
			return err
		}
		knot.onWalletInit(wallet)
		wallet.Wallet.Init()
	}
	return nil
}

func (knot *Knot) uninitWallets() {
	for _, wallet := range knot.wallets {
		if wallet.Wallet != nil {
			knot.onWalletUninit(wallet)
			wallet.Wallet.Close()
			wallet.Wallet = nil
		}
	}
}

func (knot *Knot) register(device *dbbdevice.DBBDevice) error {
	knot.device = device
	knot.onDeviceInit(device)
	knot.device.SetOnEvent(func(ev string) {
		switch ev {
		case "login":
			if err := knot.initWallets(); err != nil {
				// TODO
				panic(err)
			}
		case "statusChanged":
			knot.events <- event{Type: "deviceStatus", Data: knot.device.Status()}
		}
	})
	select {
	case knot.events <- event{Type: "deviceStatus", Data: knot.device.Status()}:
	default:
	}
	return nil
}

func (knot *Knot) unregister(deviceID string) {
	if deviceID == knot.device.DeviceID() {
		knot.device = nil
		knot.onDeviceUninit()
		knot.uninitWallets()
		knot.events <- event{Type: "deviceStatus", Data: "unregistered"}
	}
}

func (knot *Knot) listenHID() {
	dbbdevice.NewManager(knot.register, knot.unregister).ListenHID()
}
