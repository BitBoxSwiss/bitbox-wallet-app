package btc

import (
	"fmt"
	"path"
	"strconv"
	"strings"

	"github.com/btcsuite/btcd/chaincfg"
	"github.com/btcsuite/btcutil"
	"github.com/sirupsen/logrus"

	"github.com/shiftdevices/godbb/backend/coins/btc/blockchain"
	"github.com/shiftdevices/godbb/backend/coins/btc/electrum"
	"github.com/shiftdevices/godbb/backend/coins/btc/headers"
	coinpkg "github.com/shiftdevices/godbb/backend/coins/coin"
	"github.com/shiftdevices/godbb/backend/db/headersdb"
	"github.com/shiftdevices/godbb/util/locker"
	"github.com/shiftdevices/godbb/util/logging"
	"github.com/shiftdevices/godbb/util/observable"
	"github.com/shiftdevices/godbb/util/rpc"
)

// Coin models a Bitcoin-related coin.
type Coin struct {
	name                  string
	unit                  string
	net                   *chaincfg.Params
	servers               []*rpc.ServerInfo
	blockExplorerTxPrefix string

	ratesUpdater coinpkg.RatesUpdater
	observable.Implementation

	blockchain     blockchain.Interface
	blockchainLock locker.Locker

	headers     *headers.Headers
	headersLock locker.Locker

	log *logrus.Entry
}

// NewCoin creates a new coin with the given parameters.
func NewCoin(
	name string,
	unit string,
	net *chaincfg.Params,
	servers []*rpc.ServerInfo,
	blockExplorerTxPrefix string,
	ratesUpdater coinpkg.RatesUpdater,
) *Coin {
	coin := &Coin{
		name:                  name,
		unit:                  unit,
		net:                   net,
		servers:               servers,
		blockExplorerTxPrefix: blockExplorerTxPrefix,
		ratesUpdater:          ratesUpdater,

		log: logging.Get().WithGroup("coin").WithField("name", name),
	}
	if ratesUpdater != nil {
		ratesUpdater.Observe(coin.Notify)
	}
	return coin
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

func formatAsCurrency(amount float64) string {
	formatted := strconv.FormatFloat(amount, 'f', 2, 64)
	position := strings.Index(formatted, ".") - 3
	for position > 0 {
		formatted = formatted[:position] + "'" + formatted[position:]
		position = position - 3
	}
	return formatted
}

// FormatAmountAsJSON implements coin.Coin.
func (coin *Coin) FormatAmountAsJSON(amount int64) coinpkg.FormattedAmount {
	float := btcutil.Amount(amount).ToUnit(btcutil.AmountBTC)
	conversions := coinpkg.Conversions{}
	if coin.ratesUpdater != nil {
		rates := coin.ratesUpdater.Last()
		conversions = coinpkg.Conversions{
			USD: formatAsCurrency(float * rates.USD),
			EUR: formatAsCurrency(float * rates.EUR),
			CHF: formatAsCurrency(float * rates.CHF),
			GBP: formatAsCurrency(float * rates.GBP),
		}
	}
	return coinpkg.FormattedAmount{
		Amount:      strconv.FormatFloat(float, 'f', -int(btcutil.AmountBTC+8), 64),
		Unit:        coin.Unit(),
		Conversions: conversions,
	}
}

// RatesUpdater returns current exchange rates.
func (coin *Coin) RatesUpdater() coinpkg.RatesUpdater {
	return coin.ratesUpdater
}

// Blockchain connects to a blockchain backend.
func (coin *Coin) Blockchain() blockchain.Interface {
	defer coin.blockchainLock.Lock()()
	if coin.blockchain != nil {
		return coin.blockchain
	}
	coin.blockchain = electrum.NewElectrumConnection(coin.servers, coin.log)
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
