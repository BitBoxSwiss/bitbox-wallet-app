package backend

import (
	"fmt"
	"log"
	"time"

	"github.com/btcsuite/btcd/chaincfg"
	"github.com/shiftdevices/godbb/coins/btc"
	"github.com/shiftdevices/godbb/coins/btc/addresses"
	"github.com/shiftdevices/godbb/coins/btc/electrum"
)

const (
	// dev server for now
	electrumServerBitcoinTestnet  = "dev.shiftcrypto.ch:51002"
	electrumServerBitcoinMainnet  = "dev.shiftcrypto.ch:50002"
	electrumServerLitecoinTestnet = "dev.shiftcrypto.ch:51004"
	electrumServerLitecoinMainnet = "dev.shiftcrypto.ch:50004"
)

// Wallet wraps a wallet of a specific coin identified by Code.
type Wallet struct {
	Code   string
	Name   string
	Wallet btc.Interface

	net                  *chaincfg.Params
	walletDerivationPath string
	addressType          addresses.AddressType
}

func (wallet *Wallet) init(backend *Backend) error {
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
	keyStore, err := newRelativeKeyStore(backend.device, wallet.walletDerivationPath)
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
				log.Printf("wallet sync time for %s: %s\n",
					wallet.Code,
					time.Since(backend.walletsSyncStart))
			}
			backend.events <- WalletEvent{Type: "wallet", Code: wallet.Code, Data: string(event)}
		},
	)
	return err
}
