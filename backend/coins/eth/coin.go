// Copyright 2018 Shift Devices AG
// Copyright 2020 Shift Crypto AG
//
// Licensed under the Apache License, Version 2.0 (the "License");
// you may not use this file except in compliance with the License.
// You may obtain a copy of the License at
//
//      http://www.apache.org/licenses/LICENSE-2.0
//
// Unless required by applicable law or agreed to in writing, software
// distributed under the License is distributed on an "AS IS" BASIS,
// WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
// See the License for the specific language governing permissions and
// limitations under the License.

package eth

import (
	"math/big"
	"net/http"
	"strings"
	"sync"

	"github.com/digitalbitbox/bitbox-wallet-app/backend/accounts"
	"github.com/digitalbitbox/bitbox-wallet-app/backend/coins/coin"
	"github.com/digitalbitbox/bitbox-wallet-app/backend/coins/eth/erc20"
	"github.com/digitalbitbox/bitbox-wallet-app/backend/coins/eth/etherscan"
	"github.com/digitalbitbox/bitbox-wallet-app/backend/coins/eth/rpcclient"
	"github.com/digitalbitbox/bitbox-wallet-app/util/logging"
	"github.com/digitalbitbox/bitbox-wallet-app/util/observable"
	"github.com/ethereum/go-ethereum/common"
	"github.com/ethereum/go-ethereum/params"
	"github.com/sirupsen/logrus"
)

// TransactionsSource source of Ethereum transactions. An additional source for this is needed as a
// normal ETH full node does not expose an API endpoint to get transactions per address.
type TransactionsSource interface {
	Transactions(
		blockTipHeight *big.Int,
		address common.Address, endBlock *big.Int, erc20Token *erc20.Token) (
		[]*accounts.TransactionData, error)
}

// Coin models an Ethereum coin.
type Coin struct {
	observable.Implementation
	initOnce              sync.Once
	client                rpcclient.Interface
	code                  coin.Code
	unit                  string
	feeUnit               string
	net                   *params.ChainConfig
	blockExplorerTxPrefix string
	nodeURL               string
	erc20Token            *erc20.Token

	transactionsSource TransactionsSource
	httpClient         *http.Client

	log *logrus.Entry
}

// NewCoin creates a new coin with the given parameters.
// transactionsSource: can be nil, in which case transactions will not be shown.
// For erc20 tokens, provide erc20Token using NewERC20Token() (otherwise keep nil).
func NewCoin(
	code coin.Code,
	unit string,
	feeUnit string,
	net *params.ChainConfig,
	blockExplorerTxPrefix string,
	transactionsSource TransactionsSource,
	nodeURL string,
	erc20Token *erc20.Token,
	httpClient *http.Client,
) *Coin {
	return &Coin{
		code:                  code,
		unit:                  unit,
		feeUnit:               feeUnit,
		net:                   net,
		blockExplorerTxPrefix: blockExplorerTxPrefix,
		nodeURL:               nodeURL,

		transactionsSource: transactionsSource,

		erc20Token: erc20Token,
		httpClient: httpClient,

		log: logging.Get().WithGroup("coin").WithField("code", code),
	}
}

// Net returns the network (mainnet, testnet, etc.).
func (coin *Coin) Net() *params.ChainConfig { return coin.net }

// Initialize implements coin.Coin.
func (coin *Coin) Initialize() {
	coin.initOnce.Do(func() {
		coin.log.Infof("connecting to %s", coin.nodeURL)
		const etherScanPrefix = "etherscan+"
		if strings.HasPrefix(coin.nodeURL, etherScanPrefix) {
			nodeURL := coin.nodeURL[len(etherScanPrefix):]
			coin.log.Infof("Using EtherScan proxy: %s", nodeURL)
			coin.client = etherscan.NewEtherScan(nodeURL, coin.httpClient)
		} else {
			client, err := rpcclient.RPCDial(coin.nodeURL)
			if err != nil {
				// TODO: init conn lazily, feed error via EventStatusChanged
				panic(err)
			}
			coin.client = client
		}
	})
}

// Code implements coin.Coin.
func (coin *Coin) Code() coin.Code {
	return coin.code
}

// Unit implements coin.Coin.
func (coin *Coin) Unit(isFee bool) string {
	if isFee {
		return coin.feeUnit
	}
	return coin.unit
}

// Decimals implements coin.Coin.
func (coin *Coin) Decimals(isFee bool) uint {
	if !isFee && coin.erc20Token != nil {
		return coin.erc20Token.Decimals()
	}
	// Standard Ethereum
	return 18
}

// unitFactor returns 10^coin.Decimals().
func (coin *Coin) unitFactor(isFee bool) *big.Int {
	return new(big.Int).Exp(
		big.NewInt(10),
		new(big.Int).SetUint64(uint64(coin.Decimals(isFee))), nil)
}

// FormatAmount implements coin.Coin.
func (coin *Coin) FormatAmount(amount coin.Amount, isFee bool) string {
	factor := coin.unitFactor(isFee)
	return strings.TrimRight(strings.TrimRight(
		new(big.Rat).SetFrac(amount.BigInt(), factor).FloatString(18),
		"0"), ".")
}

// ToUnit implements coin.Coin.
func (coin *Coin) ToUnit(amount coin.Amount, isFee bool) float64 {
	factor := coin.unitFactor(isFee)
	result, _ := new(big.Rat).SetFrac(amount.BigInt(), factor).Float64()
	return result
}

// BlockExplorerTransactionURLPrefix implements coin.Coin.
func (coin *Coin) BlockExplorerTransactionURLPrefix() string {
	return coin.blockExplorerTxPrefix
}

// TransactionsSource returns an instance of TransactionsSource.
func (coin *Coin) TransactionsSource() TransactionsSource {
	return coin.transactionsSource
}

func (coin *Coin) String() string {
	return string(coin.code)
}

// SmallestUnit implements coin.Coin.
func (coin *Coin) SmallestUnit() string {
	return "wei"
}

// ERC20Token returns nil for a normal Ethereum coin, or the erc20 token details for an erc20 token.
func (coin *Coin) ERC20Token() *erc20.Token {
	return coin.erc20Token
}

// Close implements coin.Coin.
func (coin *Coin) Close() error {
	// TODO: shut down rpc connection.
	return nil
}
