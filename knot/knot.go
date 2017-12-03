package knot

import (
	"fmt"

	"github.com/btcsuite/btcd/chaincfg"
	"github.com/shiftdevices/godbb/dbbdevice"
	"github.com/shiftdevices/godbb/dbbdevice/keystore"
	"github.com/shiftdevices/godbb/deterministicwallet"
	"github.com/shiftdevices/godbb/electrum"
	"github.com/shiftdevices/godbb/knot/coins/ltc"
)

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
		electrumServer = "ltc01.knas.systems:50004"
	default:
		panic(fmt.Sprintf("unknown coin %s", wallet.Code))
	}
	electrumClient, err := electrum.NewElectrumClient(electrumServer)
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

type Knot struct {
	events chan interface{}

	device         *dbbdevice.DBBDevice
	onWalletInit   func(*Wallet)
	onWalletUninit func(*Wallet)
	onDeviceInit   func(dbbdevice.Interface)
	onDeviceUninit func()

	wallets []*Wallet
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

func (knot *Knot) OnWalletInit(f func(*Wallet)) {
	knot.onWalletInit = f
}

func (knot *Knot) OnWalletUninit(f func(*Wallet)) {
	knot.onWalletUninit = f
}

func (knot *Knot) OnDeviceInit(f func(dbbdevice.Interface)) {
	knot.onDeviceInit = f
}

func (knot *Knot) OnDeviceUninit(f func()) {
	knot.onDeviceUninit = f
}
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
			knot.initWallets()
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
