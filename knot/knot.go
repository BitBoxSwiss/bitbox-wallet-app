package knot

import (
	"github.com/btcsuite/btcd/chaincfg"
	"github.com/shiftdevices/godbb/dbbdevice"
	"github.com/shiftdevices/godbb/dbbdevice/keystore"
	"github.com/shiftdevices/godbb/deterministicwallet"
	"github.com/shiftdevices/godbb/electrum"
)

type Knot struct {
	events chan Event

	device         *dbbdevice.DBBDevice
	bitcoinWallet  *deterministicwallet.DeterministicWallet
	onWalletInit   func(deterministicwallet.Interface)
	onWalletUninit func()
	onDeviceInit   func(dbbdevice.Interface)
	onDeviceUninit func()
}

type Event struct {
	Type string
	Data string
}

func NewKnot() *Knot {
	return &Knot{
		events: make(chan Event),
	}
}

func (knot *Knot) OnWalletInit(f func(deterministicwallet.Interface)) {
	knot.onWalletInit = f
}

func (knot *Knot) OnWalletUninit(f func()) {
	knot.onWalletUninit = f
}

func (knot *Knot) OnDeviceInit(f func(dbbdevice.Interface)) {
	knot.onDeviceInit = f
}

func (knot *Knot) OnDeviceUninit(f func()) {
	knot.onDeviceUninit = f
}

func (knot *Knot) Start() <-chan Event {
	go knot.listenHID()
	return knot.events
}

func (knot *Knot) initWallets() error {
	net := &chaincfg.TestNet3Params
	electrumClient, err := electrum.NewElectrumClient()
	if err != nil {
		return err
	}
	keystore, err := keystore.NewDBBKeyStore(knot.device, "m/44'/1'/0'", net)
	if err != nil {
		return err
	}
	knot.bitcoinWallet, err = deterministicwallet.NewDeterministicWallet(
		net,
		keystore,
		electrumClient,
		func() {
			knot.events <- Event{Type: "sync", Data: "start"}
		},
		func() {
			knot.events <- Event{Type: "sync", Data: "done"}
		},
	)
	if err != nil {
		return err
	}
	knot.bitcoinWallet.EnsureAddresses()
	knot.events <- Event{Type: "wallet", Data: "initialized"}
	knot.onWalletInit(knot.bitcoinWallet)
	return nil
}

func (knot *Knot) uninitWallets() {
	knot.bitcoinWallet = nil
	knot.events <- Event{Type: "wallet", Data: "uninitialized"}
	knot.onWalletUninit()
}

func (knot *Knot) register(device *dbbdevice.DBBDevice) error {
	knot.device = device
	knot.onDeviceInit(device)
	knot.device.SetOnEvent(func(event string) {
		switch event {
		case "login":
			knot.initWallets()
		case "statusChanged":
			knot.events <- Event{Type: "deviceStatus", Data: knot.device.Status()}
		}
	})
	select {
	case knot.events <- Event{Type: "deviceStatus", Data: knot.device.Status()}:
	default:
	}
	return nil
}

func (knot *Knot) unregister(deviceID string) {
	if deviceID == knot.device.DeviceID() {
		knot.device = nil
		knot.onDeviceUninit()
		knot.uninitWallets()
		knot.events <- Event{Type: "deviceStatus", Data: "unregistered"}
	}
}

func (knot *Knot) listenHID() {
	dbbdevice.NewManager(knot.register, knot.unregister).ListenHID()
}
