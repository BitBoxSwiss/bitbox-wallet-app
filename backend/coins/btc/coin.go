package btc

import (
	"fmt"
	"path"
	"strconv"

	"github.com/btcsuite/btcd/chaincfg"
	"github.com/btcsuite/btcutil"
	"github.com/shiftdevices/godbb/backend/coins/btc/blockchain"
	"github.com/shiftdevices/godbb/backend/coins/btc/electrum"
	"github.com/shiftdevices/godbb/backend/coins/btc/headers"
	"github.com/shiftdevices/godbb/backend/config"
	"github.com/shiftdevices/godbb/backend/db/headersdb"
	"github.com/shiftdevices/godbb/util/locker"
	"github.com/shiftdevices/godbb/util/logging"
	"github.com/sirupsen/logrus"
)

// MainnetCoin stores the mainnet coin.
var MainnetCoin = NewCoin("btc", "BTC", &chaincfg.MainNetParams, "https://blockchain.info/tx/")

// TestnetCoin stores the testnet coin.
var TestnetCoin = NewCoin("tbtc", "TBTC", &chaincfg.TestNet3Params, "https://testnet.blockchain.info/tx/")

// RegtestCoin stores the regtest coin.
var RegtestCoin = NewCoin("rbtc", "RBTC", &chaincfg.RegressionNetParams, "")

// Coin models a Bitcoin-related coin.
type Coin struct {
	name                  string
	unit                  string
	net                   *chaincfg.Params
	blockExplorerTxPrefix string

	blockchain         blockchain.Interface
	electrumClientLock locker.Locker

	headers     *headers.Headers
	headersLock locker.Locker

	log *logrus.Entry
}

// NewCoin creates a new coin with the given parameters.
func NewCoin(
	name string,
	unit string,
	net *chaincfg.Params,
	blockExplorerTxPrefix string) *Coin {
	return &Coin{
		name: name,
		unit: unit,
		net:  net,
		blockExplorerTxPrefix: blockExplorerTxPrefix,

		log: logging.Log.WithGroup("coin").WithField("name", name),
	}
}

// Name returns the coin's name.
func (coin *Coin) Name() string {
	return coin.name
}

// Net returns the coin's network params.
func (coin *Coin) Net() *chaincfg.Params {
	return coin.net
}

// Unit implements coin.Coin.
func (coin *Coin) Unit() string {
	return coin.unit
}

// FormatAmount implements coin.Coin.
func (coin *Coin) FormatAmount(amount int64) string {
	return strconv.FormatFloat(btcutil.Amount(amount).ToUnit(btcutil.AmountBTC), 'f',
		-int(btcutil.AmountBTC+8), 64) + " " + coin.Unit()
}

// FormatAmountAsJSON implements coin.Coin.
func (coin *Coin) FormatAmountAsJSON(amount int64) map[string]string {
	return map[string]string{
		"amount": strconv.FormatFloat(btcutil.Amount(amount).ToUnit(btcutil.AmountBTC), 'f', -int(btcutil.AmountBTC+8), 64),
		"unit":   coin.Unit(),
	}
}

// Blockchain connects to a blockchain backend.
func (coin *Coin) Blockchain() blockchain.Interface {
	defer coin.electrumClientLock.Lock()()
	if coin.blockchain != nil {
		return coin.blockchain
	}
	servers := config.Get().Config().Backend.GetServers(coin.name)
	coin.blockchain = electrum.NewElectrumConnection(servers, coin.log)
	return coin.blockchain
}

// GetHeaders returns the headers from the given folder. This method should only be called if
// the connection to the backend has previously been established.
func (coin *Coin) GetHeaders(dbFolder string) (*headers.Headers, error) {
	defer coin.headersLock.Lock()()
	if coin.headers == nil {
		log := coin.log.WithField("net", coin.name)

		db, err := headersdb.NewDB(
			path.Join(dbFolder, fmt.Sprintf("headers-%s.db", coin.name)))
		if err != nil {
			return nil, err
		}

		coin.headers = headers.NewHeaders(
			coin.net,
			db,
			coin.Blockchain(),
			log)
		coin.headers.Init()
	}
	return coin.headers, nil
}

func (coin *Coin) String() string {
	return coin.name
}
