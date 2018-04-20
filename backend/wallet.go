package backend

import (
	"fmt"
	"time"

	"github.com/btcsuite/btcd/chaincfg"
	"github.com/shiftdevices/godbb/backend/coins/btc"
	"github.com/shiftdevices/godbb/backend/coins/btc/addresses"
	"github.com/shiftdevices/godbb/backend/coins/btc/electrum"
	"github.com/shiftdevices/godbb/util/errp"
	"github.com/sirupsen/logrus"
)

const (
	// dev server for now
	electrumServerBitcoinRegtest  = "127.0.0.1:52001"
	electrumServerBitcoinTestnet  = "dev.shiftcrypto.ch:51002"
	electrumServerBitcoinMainnet  = "dev.shiftcrypto.ch:50002"
	electrumServerLitecoinTestnet = "dev.shiftcrypto.ch:51004"
	electrumServerLitecoinMainnet = "dev.shiftcrypto.ch:50004"
)

// connectionError indicates an error when establishing a network connection.
type connectionError error

func maybeConnectionError(err error) error {
	if _, ok := errp.Cause(err).(electrum.ConnectionError); ok {
		return connectionError(err)
	}
	return err
}

// Wallet wraps a wallet of a specific coin identified by Code.
type Wallet struct {
	Code   string        `json:"code"`
	Name   string        `json:"name"`
	Wallet btc.Interface `json:"-"`

	WalletDerivationPath  string `json:"keyPath"`
	BlockExplorerTxPrefix string `json:"blockExplorerTxPrefix"`

	errorChannel chan error
	net          *chaincfg.Params
	addressType  addresses.AddressType
	log          *logrus.Entry
}

func (wallet *Wallet) init(backend *Backend) error {
	wallet.log = backend.log.WithFields(logrus.Fields{"coin": wallet.Code, "wallet-name": wallet.Name,
		"net": wallet.net.Name, "address-type": wallet.addressType})

	electrumClient, err := backend.electrumClient(wallet.net)
	if err != nil {
		return err
	}
	keyStore, err := newRelativeKeyStore(backend.device, wallet.WalletDerivationPath, wallet.log)
	if err != nil {
		return err
	}
	headers, err := backend.getHeaders(wallet.net)
	if err != nil {
		return err
	}
	waitInit := make(chan struct{})
	wallet.Wallet, err = btc.NewWallet(
		wallet.net,
		backend.db.SubDB(fmt.Sprintf("%s-%s", wallet.Code, keyStore.XPub().String()), wallet.log),
		keyStore,
		electrumClient,
		headers,
		wallet.addressType,
		func(event btc.Event) {
			<-waitInit
			if event == btc.EventStatusChanged && wallet.Wallet.Initialized() {
				wallet.log.WithField("wallet-sync-start", time.Since(backend.walletsSyncStart)).
					Debug("Wallet sync time")
			}
			backend.events <- WalletEvent{Type: "wallet", Code: wallet.Code, Data: string(event)}
		},
		wallet.log,
	)
	close(waitInit)
	return err
}
