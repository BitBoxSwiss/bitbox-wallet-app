package btc

import (
	"fmt"
	"path"

	"github.com/btcsuite/btcd/chaincfg"
	"github.com/btcsuite/btcd/wire"
	"github.com/shiftdevices/godbb/backend/coins/btc/blockchain"
	"github.com/shiftdevices/godbb/backend/coins/btc/electrum"
	"github.com/shiftdevices/godbb/backend/coins/btc/headers"
	"github.com/shiftdevices/godbb/backend/db/headersdb"
	"github.com/shiftdevices/godbb/util/errp"
	"github.com/shiftdevices/godbb/util/locker"
	"github.com/shiftdevices/godbb/util/logging"
	"github.com/sirupsen/logrus"
)

const (
	// dev server for now
	electrumServerBitcoinMainnet = "dev.shiftcrypto.ch:50002"
	electrumServerBitcoinTestnet = "dev.shiftcrypto.ch:51002"
	electrumServerBitcoinRegtest = "127.0.0.1:52001"
)

const (
	tlsYes = true
	tlsNo  = false
)

// MainnetCoin stores the mainnet coin.
var MainnetCoin = NewCoin("btc", &chaincfg.MainNetParams, electrumServerBitcoinMainnet, tlsYes, "https://blockchain.info/tx/")

// TestnetCoin stores the testnet coin.
var TestnetCoin = NewCoin("tbtc", &chaincfg.TestNet3Params, electrumServerBitcoinTestnet, tlsYes, "https://testnet.blockchain.info/tx/")

// RegtestCoin stores the regtest coin.
var RegtestCoin = NewCoin("rbtc", &chaincfg.RegressionNetParams, electrumServerBitcoinRegtest, tlsNo, "")

// connectionError indicates an error when establishing a network connection.
type connectionError error

func maybeConnectionError(err error) error {
	if _, ok := errp.Cause(err).(electrum.ConnectionError); ok {
		return connectionError(err)
	}
	return err
}

// Coin models a Bitcoin-related coin.
type Coin struct {
	name                  string
	net                   *chaincfg.Params
	electrumServer        string
	blockExplorerTxPrefix string

	tls                 bool
	electrumClients     map[wire.BitcoinNet]blockchain.Interface
	electrumClientsLock locker.Locker

	headers     map[wire.BitcoinNet]*headers.Headers
	headersLock locker.Locker

	log *logrus.Entry
}

// NewCoin creates a new coin with the given parameters.
func NewCoin(name string, net *chaincfg.Params, electrumServer string, tls bool, blockExplorerTxPrefix string) *Coin {
	return &Coin{
		name:                  name,
		electrumServer:        electrumServer,
		tls:                   tls,
		net:                   net,
		electrumClients:       map[wire.BitcoinNet]blockchain.Interface{},
		blockExplorerTxPrefix: blockExplorerTxPrefix,

		headers: map[wire.BitcoinNet]*headers.Headers{},
		log:     logging.Log.WithGroup("coin").WithField("name", name),
	}
}

// Net returns the coin's network params.
func (coin *Coin) Net() *chaincfg.Params {
	return coin.net
}

// ElectrumClient returns the electrum client for the coin.
func (coin *Coin) ElectrumClient() (blockchain.Interface, error) {
	defer coin.electrumClientsLock.Lock()()
	if _, ok := coin.electrumClients[coin.net.Net]; !ok {
		var err error
		coin.electrumClients[coin.net.Net], err = electrum.NewElectrumClient(
			coin.electrumServer, coin.tls, func(err error) {
				// err = maybeConnectionError(err)
				// if _, ok := errp.Cause(err).(connectionError); !ok {
				// 	coin.log.WithField("error", err).Panic(err.Error())
				// }
				// unlock := coin.electrumClientsLock.Lock()
				// delete(coin.electrumClients, coin.net.Net)
				// unlock()
				// for _, wallet := range coin.wallets {
				// 	if wallet.net.Net != coin.net.Net {
				// 		continue
				// 	}
				// 	select {
				// 	case wallet.errorChannel <- err:
				// 	default:
				// 		wallet.log.WithField("error", err).Error(err.Error())
				// 	}
				// }
			}, coin.log.WithField("net", coin.name))
		if err != nil {
			return nil, maybeConnectionError(err)
		}
	}
	return coin.electrumClients[coin.net.Net], nil
}

// GetHeaders returns the headers from the given folder.
func (coin *Coin) GetHeaders(dbFolder string) (*headers.Headers, error) {
	defer coin.headersLock.Lock()()
	if _, ok := coin.headers[coin.net.Net]; !ok {
		blockchain, err := coin.ElectrumClient()
		if err != nil {
			return nil, err
		}
		log := coin.log.WithField("net", coin.name)

		db, err := headersdb.NewDB(
			path.Join(dbFolder, fmt.Sprintf("headers-%s.db", coin.name)))
		if err != nil {
			return nil, err
		}

		coin.headers[coin.net.Net] = headers.NewHeaders(
			coin.net,
			db,
			blockchain,
			log)
		if err := coin.headers[coin.net.Net].Init(); err != nil {
			return nil, err
		}
	}
	return coin.headers[coin.net.Net], nil
}

func (coin *Coin) String() string {
	return coin.name
}
