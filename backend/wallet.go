package backend

import (
	"fmt"
	"path"
	"time"

	"github.com/btcsuite/btcd/chaincfg"
	"github.com/shiftdevices/godbb/backend/coins/btc"
	"github.com/shiftdevices/godbb/backend/coins/btc/addresses"
	"github.com/shiftdevices/godbb/backend/coins/btc/electrum"
	"github.com/shiftdevices/godbb/backend/db/transactionsdb"
	"github.com/shiftdevices/godbb/backend/signing"
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
	Code    string        `json:"code"`
	Name    string        `json:"name"`
	Account btc.Interface `json:"-"`

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
	headers, err := backend.getHeaders(wallet.net)
	if err != nil {
		return err
	}
	identifier, err := backend.keystore.Identifier()
	if err != nil {
		return err
	}
	db, err := transactionsdb.NewDB(path.Join(
		backend.dbFolder,
		fmt.Sprintf("account-%s-%s.db", identifier, wallet.Code)))
	if err != nil {
		return err
	}
	walletDerivationPath, err := signing.NewAbsoluteKeypath(wallet.WalletDerivationPath)
	if err != nil {
		return err
	}
	waitInit := make(chan struct{})
	wallet.Account, err = btc.NewAccount(
		wallet.net,
		db,
		walletDerivationPath,
		backend.keystore,
		electrumClient,
		headers,
		wallet.addressType,
		func(event btc.Event) {
			<-waitInit
			if event == btc.EventStatusChanged && wallet.Account.Initialized() {
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
