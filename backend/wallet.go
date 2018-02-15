package backend

import (
	"fmt"
	"log"
	"time"

	"github.com/btcsuite/btcd/chaincfg"
	"github.com/shiftdevices/godbb/coins/btc"
	"github.com/shiftdevices/godbb/coins/btc/addresses"
	"github.com/shiftdevices/godbb/coins/btc/electrum"
	"github.com/shiftdevices/godbb/coins/btc/keystore"
)

const (
	// dev server for now
	electrumServerBitcoinTestnet  = "176.9.28.202:51002"
	electrumServerBitcoinMainnet  = "176.9.28.202:50002"
	electrumServerLitecoinTestnet = "176.9.28.202:51004"
	electrumServerLitecoinMainnet = "176.9.28.202:50004"
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
	keystore, err := keystore.NewDBBKeyStore(backend.device, wallet.walletDerivationPath, wallet.net)
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
					time.Since(backend.walletsSyncStart))
			}
			backend.events <- walletEvent{Type: "wallet", Code: wallet.Code, Data: string(event)}
		},
	)
	if err != nil {
		return err
	}
	return nil
}
