// SPDX-License-Identifier: Apache-2.0

package btc

import (
	"fmt"
	"math/big"
	"os"
	"path"
	"sync"

	"github.com/BitBoxSwiss/bitbox-wallet-app/backend/accounts/errors"
	"github.com/BitBoxSwiss/bitbox-wallet-app/backend/coins/btc/blockchain"
	"github.com/BitBoxSwiss/bitbox-wallet-app/backend/coins/btc/electrum"
	"github.com/BitBoxSwiss/bitbox-wallet-app/backend/coins/btc/headers"
	"github.com/BitBoxSwiss/bitbox-wallet-app/backend/coins/btc/util"
	coinpkg "github.com/BitBoxSwiss/bitbox-wallet-app/backend/coins/coin"
	"github.com/BitBoxSwiss/bitbox-wallet-app/backend/config"
	"github.com/BitBoxSwiss/bitbox-wallet-app/util/errp"
	"github.com/BitBoxSwiss/bitbox-wallet-app/util/logging"
	"github.com/BitBoxSwiss/bitbox-wallet-app/util/observable"
	"github.com/BitBoxSwiss/bitbox-wallet-app/util/observable/action"
	"github.com/BitBoxSwiss/bitbox-wallet-app/util/socksproxy"
	"github.com/BitBoxSwiss/bitbox02-api-go/api/firmware"
	"github.com/btcsuite/btcd/btcutil"
	"github.com/btcsuite/btcd/chaincfg"
	"github.com/sirupsen/logrus"
)

// Coin models a Bitcoin-related coin.
type Coin struct {
	initOnce sync.Once
	code     coinpkg.Code
	name     string
	// unit is the main unit of the coin, e.g. 'BTC'
	unit string
	// formatUnit keeps track of the unit used, e.g. 'BTC' or 'sat' depening on if sat mode is enabled
	formatUnit            coinpkg.BtcUnit
	net                   *chaincfg.Params
	dbFolder              string
	makeBlockchain        func() blockchain.Interface
	blockExplorerTxPrefix string

	observable.Implementation

	blockchain blockchain.Interface
	headers    *headers.Headers

	log *logrus.Entry
}

// NewCoin creates a new coin with the given parameters.
func NewCoin(
	code coinpkg.Code,
	name string,
	unit string,
	formatUnit coinpkg.BtcUnit,
	net *chaincfg.Params,
	dbFolder string,
	servers []*config.ServerInfo,
	blockExplorerTxPrefix string,
	socksProxy socksproxy.SocksProxy,
) *Coin {
	log := logging.Get().WithGroup("coin").WithField("code", code)
	coin := &Coin{
		code:                  code,
		name:                  name,
		unit:                  unit,
		formatUnit:            formatUnit,
		net:                   net,
		dbFolder:              dbFolder,
		blockExplorerTxPrefix: blockExplorerTxPrefix,
		makeBlockchain: func() blockchain.Interface {
			return electrum.NewElectrumConnection(
				servers,
				log,
				socksProxy.GetTCPProxyDialer(),
			)
		},
		log: log,
	}
	return coin
}

// TstSetMakeBlockchain must only be used in unit tests to provide a mock instance for the
// blockchain interface.
func (coin *Coin) TstSetMakeBlockchain(f func() blockchain.Interface) {
	coin.makeBlockchain = f
}

// Initialize implements coinpkg.Coin.
func (coin *Coin) Initialize() {
	coin.initOnce.Do(func() {
		// Init blockchain
		coin.blockchain = coin.makeBlockchain()

		// Init Headers

		// delete old db version (up to v4.10.0, bbolt was used):
		oldDBFilename := path.Join(coin.dbFolder, fmt.Sprintf("headers-%s.db", coin.code))
		if _, err := os.Stat(oldDBFilename); err == nil {
			_ = os.Remove(oldDBFilename)
		}

		db, err := openHeadersDBWithRecovery(
			path.Join(coin.dbFolder, fmt.Sprintf("headers-%s.bin", coin.code)),
			coin.log)
		if err != nil {
			coin.log.WithError(err).Panic("Could not open headers DB")
		}
		coin.headers = headers.NewHeaders(
			coin.net,
			db,
			coin.blockchain,
			coin.log)
		coin.headers.Initialize()
		coin.headers.SubscribeEvent(func(event headers.Event) {
			if event == headers.EventSyncing || event == headers.EventSynced {
				status, err := coin.headers.Status()
				if err != nil {
					coin.log.WithError(err).Error("Could not get headers status")
				}
				coin.Notify(observable.Event{
					Subject: fmt.Sprintf("coins/%s/headers/status", coin.code),
					Action:  action.Replace,
					Object:  status,
				})
			}
		})
	})
}

// Name implements coinpkg.Coin.
func (coin *Coin) Name() string {
	return coin.name
}

// Code implements coinpkg.Coin.
func (coin *Coin) Code() coinpkg.Code {
	return coin.code
}

// Net returns the coin's network params.
func (coin *Coin) Net() *chaincfg.Params {
	return coin.net
}

// Unit implements coinpkg.Coin.
func (coin *Coin) Unit(bool) string {
	return coin.unit
}

// SetFormatUnit implements coin.Coin.
func (coin *Coin) SetFormatUnit(unit coinpkg.BtcUnit) {
	coin.formatUnit = unit
}

// GetFormatUnit implements coin.Coin.
func (coin *Coin) GetFormatUnit(bool) string {
	if coin.formatUnit == coinpkg.BtcUnitSats {
		switch coin.code {
		case coinpkg.CodeBTC:
			return "sat"
		case coinpkg.CodeTBTC:
			return "tsat"
		}
	}

	return coin.unit
}

// Decimals implements coinpkg.Coin.
func (coin *Coin) Decimals(isFee bool) uint {
	return 8
}

// FormatAmount implements coinpkg.Coin.
func (coin *Coin) FormatAmount(amount coinpkg.Amount, isFee bool) string {
	if coin.formatUnit == coinpkg.BtcUnitSats {
		return amount.BigInt().String()
	}
	return new(big.Rat).SetFrac(amount.BigInt(), big.NewInt(unitSatoshi)).FloatString(8)
}

// ToUnit implements coinpkg.Coin.
func (coin *Coin) ToUnit(amount coinpkg.Amount, isFee bool) float64 {
	result, _ := new(big.Rat).SetFrac(amount.BigInt(), big.NewInt(unitSatoshi)).Float64()
	return result
}

// SetAmount implements coinpkg.Coin.
func (coin *Coin) SetAmount(amount *big.Rat, isFee bool) coinpkg.Amount {
	satsAmount := coinpkg.Btc2Sat(amount)
	intSatsAmount, _ := new(big.Int).SetString(satsAmount.FloatString(0), 0)
	return coinpkg.NewAmount(intSatsAmount)
}

// ParseAmount implements coinpkg.Coin.
func (coin *Coin) ParseAmount(amount string) (coinpkg.Amount, error) {
	amountRat, valid := new(big.Rat).SetString(amount)
	if !valid {
		return coinpkg.Amount{}, errp.New("Invalid amount")
	}

	if coin.formatUnit == coinpkg.BtcUnitSats {
		amountRat = coinpkg.Sat2Btc(amountRat)
	}
	return coin.SetAmount(amountRat, false), nil
}

// Blockchain connects to a blockchain backend.
func (coin *Coin) Blockchain() blockchain.Interface {
	return coin.blockchain
}

// Headers returns the coin headers.
func (coin *Coin) Headers() *headers.Headers {
	return coin.headers
}

func (coin *Coin) String() string {
	return string(coin.code)
}

// BlockExplorerTransactionURLPrefix implements coinpkg.Coin.
func (coin *Coin) BlockExplorerTransactionURLPrefix() string {
	return coin.blockExplorerTxPrefix
}

// SmallestUnit implements coinpkg.Coin.
func (coin *Coin) SmallestUnit() string {
	switch coin.code {
	case "ltc", "tltc":
		return "litoshi"
	default:
		return "satoshi"
	}
}

// decodeAddress decodes a btc/ltc address, checking that the format matches the account coin
// type.
func (coin *Coin) decodeAddress(address string) (btcutil.Address, error) {
	btcAddress, err := btcutil.DecodeAddress(address, coin.Net())
	if err != nil {
		return nil, errp.WithStack(errors.ErrInvalidAddress)
	}
	if !btcAddress.IsForNet(coin.Net()) {
		return nil, errp.WithStack(errors.ErrInvalidAddress)
	}
	if _, ok := btcAddress.(*btcutil.AddressTaproot); ok {
		switch coin.code {
		case coinpkg.CodeBTC, coinpkg.CodeTBTC, coinpkg.CodeRBTC:
			// Taproot activated on Bitcoin.
		default:
			// Taproot not activated on other coins.
			return nil, errp.WithStack(errors.ErrInvalidAddress)
		}
	}
	return btcAddress, nil
}

// AddressToPkScript decodes a btc/ltc address, checking that the format matches the account coin
// type, returning the pubKeyScript the address represents.
//
// For silent payment (BIP-352) addresses, `nil` is returned, as it does not encode a pubKeyScript -
// the pubKeyScript is derived from it later.
func (coin *Coin) AddressToPkScript(address string) ([]byte, error) {
	addr, err := coin.decodeAddress(address)
	if err != nil {
		return nil, err
	}
	return util.PkScriptFromAddress(addr)
}

// ValidateSilentPaymentAddress checks if the address is a valid silent payment (BIP-352) address
// matching the account coin type.
func (coin *Coin) ValidateSilentPaymentAddress(address string) error {
	hrp, _, _, err := firmware.DecodeSilentPaymentAddress(address)
	if err != nil {
		return err
	}
	var expectedHrp string
	switch coin.Net().Net {
	case chaincfg.MainNetParams.Net:
		expectedHrp = "sp"
	case chaincfg.TestNet3Params.Net:
		expectedHrp = "tsp"
	default:
		return errp.WithStack(errors.ErrInvalidAddress)
	}

	if hrp != expectedHrp {
		return errp.WithStack(errors.ErrInvalidAddress)
	}
	return nil
}

// Close implements coinpkg.Coin.
func (coin *Coin) Close() error {
	coin.log.Info("closing coin")
	if coin.blockchain != nil {
		coin.blockchain.Close()
	}
	if coin.headers != nil {
		coin.log.Info("closing headers")
		if err := coin.headers.Close(); err != nil {
			return err
		}
	}
	return nil
}
