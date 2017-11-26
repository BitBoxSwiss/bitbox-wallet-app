package knot

import (
	"github.com/btcsuite/btcd/chaincfg"
	"github.com/shiftdevices/godbb/dbbdevice"
	"github.com/shiftdevices/godbb/dbbdevice/communication"
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

func (knot *Knot) XPub() (string, error) {
	xpub, err := knot.device.XPub("m/")
	if err != nil {
		return "", err
	}
	return xpub.String(), nil
}

func (knot *Knot) Start() <-chan Event {
	go knot.listenHID()
	return knot.events
}

func (knot *Knot) DeviceState() string {
	if knot.device == nil {
		return "unregistered"
	}
	return knot.device.Status()
}

func (knot *Knot) Reset() (bool, error) {
	return knot.device.Reset()
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

func (knot *Knot) Login(password string) error {
	if err := knot.device.Login(password); err != nil {
		return err
	}
	return knot.initWallets()
}

func (knot *Knot) SetPassword(password string) error {
	return knot.device.SetPassword(password)
}

func (knot *Knot) CreateWallet(walletName string) error {
	return knot.device.CreateWallet(walletName)
}

func (knot *Knot) RestoreBackup(password, filename string) (bool, error) {
	return knot.device.RestoreBackup(password, filename)
}

func (knot *Knot) CreateBackup(backupName string) error {
	return knot.device.CreateBackup(backupName)
}

// BackupList returns a list of backup filenames. It also returns whether or not the SD card was
// inserted.
func (knot *Knot) BackupList() (bool, []string, error) {
	backupList, err := knot.device.BackupList()
	if dbbErr, ok := err.(*communication.DBBErr); ok && dbbErr.Code == dbbdevice.ErrSDCard {
		return false, nil, nil
	}
	if err != nil {
		return false, nil, err
	}
	return true, backupList, nil
}

func (knot *Knot) EraseBackup(filename string) error {
	return knot.device.EraseBackup(filename)
}

func (knot *Knot) register(device *dbbdevice.DBBDevice) error {
	knot.device = device
	knot.device.SetOnEvent(func(event string) {
		switch event {
		case "statusChanged":
			knot.events <- Event{Type: "deviceState", Data: knot.DeviceState()}
		}
	})
	select {
	case knot.events <- Event{Type: "deviceState", Data: knot.DeviceState()}:
	default:
	}
	return nil
}

func (knot *Knot) unregister(deviceID string) {
	if deviceID == knot.device.DeviceID() {
		knot.device = nil
		knot.uninitWallets()
		knot.events <- Event{Type: "deviceState", Data: knot.DeviceState()}
	}
}

func (knot *Knot) listenHID() {
	dbbdevice.NewManager(knot.register, knot.unregister).ListenHID()
}
