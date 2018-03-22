package backend

import (
	"fmt"
	"time"

	"github.com/btcsuite/btcd/chaincfg"
	"github.com/shiftdevices/godbb/coins/btc"
	"github.com/shiftdevices/godbb/coins/btc/addresses"
	"github.com/shiftdevices/godbb/coins/btc/electrum"
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

// Wallet wraps a wallet of a specific coin identified by Code.
type Wallet struct {
	Code   string        `json:"code"`
	Name   string        `json:"name"`
	Wallet btc.Interface `json:"-"`

	WalletDerivationPath  string `json:"keyPath"`
	BlockExplorerTxPrefix string `json:"blockExplorerTxPrefix"`

	net         *chaincfg.Params
	addressType addresses.AddressType
	logEntry    *logrus.Entry
}

func (wallet *Wallet) init(backend *Backend) error {
	wallet.logEntry = wallet.logEntry.WithFields(logrus.Fields{"coin": wallet.Code, "wallet-name": wallet.Name,
		"net": wallet.net.Name, "address-type": wallet.addressType})
	var electrumServer string
	tls := true
	switch wallet.Code {
	case "tbtc", "tbtc-p2wpkh-p2sh":
		electrumServer = electrumServerBitcoinTestnet
	case "rbtc", "rbtc-p2wpkh-p2sh":
		electrumServer = electrumServerBitcoinRegtest
		tls = false
	case "btc", "btc-p2wpkh-p2sh":
		electrumServer = electrumServerBitcoinMainnet
	case "tltc-p2wpkh-p2sh":
		electrumServer = electrumServerLitecoinTestnet
	case "ltc-p2wpkh-p2sh":
		electrumServer = electrumServerLitecoinMainnet
	default:
		wallet.logEntry.Panic("Unknown coin")
		panic(fmt.Sprintf("unknown coin %s", wallet.Code))
	}
	electrumClient, err := electrum.NewElectrumClient(electrumServer, tls, wallet.logEntry)
	if err != nil {
		return err
	}
	keyStore, err := newRelativeKeyStore(backend.device, wallet.WalletDerivationPath, wallet.logEntry)
	if err != nil {
		return err
	}
	wallet.Wallet, err = btc.NewWallet(
		wallet.net,
		keyStore,
		electrumClient,
		wallet.addressType,
		func(event btc.Event) {
			if event == btc.EventStatusChanged && wallet.Wallet.Initialized() {
				wallet.logEntry.WithField("wallet-sync-start", time.Since(backend.walletsSyncStart)).
					Debug("Wallet sync time")
			}
			backend.events <- WalletEvent{Type: "wallet", Code: wallet.Code, Data: string(event)}
		},
		wallet.logEntry,
	)
	return err
}
