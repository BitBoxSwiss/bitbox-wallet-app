package knot

import (
	"github.com/btcsuite/btcd/chaincfg"
	"github.com/btcsuite/btcutil"
	"github.com/shiftdevices/godbb/dbbdevice"
	"github.com/shiftdevices/godbb/dbbdevice/communication"
	"github.com/shiftdevices/godbb/dbbdevice/keystore"
	"github.com/shiftdevices/godbb/deterministicwallet"
	"github.com/shiftdevices/godbb/deterministicwallet/transactions"
	"github.com/shiftdevices/godbb/electrum"
	"github.com/shiftdevices/godbb/util/errp"
)

type Knot struct {
	events chan Event

	device        *dbbdevice.DBBDevice
	bitcoinWallet *deterministicwallet.DeterministicWallet
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
	return nil
}

func (knot *Knot) Login(password string) error {
	if err := knot.device.Login(password); err != nil {
		return err
	}
	return knot.initWallets()
}

func (knot *Knot) Transactions() ([]*transactions.Transaction, error) {
	if knot.bitcoinWallet == nil {
		return nil, errp.New("wallet not yet initialized")
	}
	return knot.bitcoinWallet.Transactions(), nil
}

func (knot *Knot) ClassifyTransaction(tx *transactions.Transaction) (
	transactions.TxType, btcutil.Amount, *btcutil.Amount, error) {
	if knot.bitcoinWallet == nil {
		return 0, 0, nil, errp.New("wallet not yet initialized")
	}
	txType, amount, fee := knot.bitcoinWallet.ClassifyTransaction(tx)
	return txType, amount, fee, nil
}

func (knot *Knot) Balance() (*transactions.Balance, error) {
	if knot.bitcoinWallet == nil {
		return nil, errp.New("wallet not yet initialized")
	}
	return knot.bitcoinWallet.Balance(), nil
}

func (knot *Knot) SendTx(address string, amount btcutil.Amount) error {
	if knot.bitcoinWallet == nil {
		return errp.New("wallet not yet initialized")
	}
	return knot.bitcoinWallet.SendTx(address, amount)
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
		knot.events <- Event{Type: "deviceState", Data: knot.DeviceState()}
	}
}

func (knot *Knot) listenHID() {
	dbbdevice.NewManager(knot.register, knot.unregister).ListenHID()
}
