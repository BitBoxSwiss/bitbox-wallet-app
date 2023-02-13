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
	"strings"

	"github.com/digitalbitbox/bitbox-wallet-app/backend/accounts"
	"github.com/digitalbitbox/bitbox-wallet-app/backend/coins/coin"
	coinpkg "github.com/digitalbitbox/bitbox-wallet-app/backend/coins/coin"
	"github.com/digitalbitbox/bitbox-wallet-app/backend/coins/eth/erc20"
	"github.com/digitalbitbox/bitbox-wallet-app/backend/coins/eth/rpcclient"
	"github.com/digitalbitbox/bitbox-wallet-app/util/errp"
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
	client                rpcclient.Interface
	code                  coin.Code
	name                  string
	unit                  string
	feeUnit               string
	net                   *params.ChainConfig
	blockExplorerTxPrefix string
	erc20Token            *erc20.Token

	transactionsSource TransactionsSource

	log *logrus.Entry
}

// NewCoin creates a new coin with the given parameters.
// transactionsSource: can be nil, in which case transactions will not be processed (in other
// words, account.Transactions() will always be empty apart from the outgoing transactions which //
// are stored in the local database).
// For erc20 tokens, provide erc20Token using NewERC20Token() (otherwise keep nil).
func NewCoin(
	client rpcclient.Interface,
	code coin.Code,
	name string,
	unit string,
	feeUnit string,
	net *params.ChainConfig,
	blockExplorerTxPrefix string,
	transactionsSource TransactionsSource,
	erc20Token *erc20.Token,
) *Coin {
	return &Coin{
		client:                client,
		code:                  code,
		name:                  name,
		unit:                  unit,
		feeUnit:               feeUnit,
		net:                   net,
		blockExplorerTxPrefix: blockExplorerTxPrefix,

		transactionsSource: transactionsSource,

		erc20Token: erc20Token,

		log: logging.Get().WithGroup("coin").WithField("code", code),
	}
}

// Net returns the network (mainnet, testnet, etc.).
func (coin *Coin) Net() *params.ChainConfig { return coin.net }

// ChainID returns the chain ID of the network.
// https://github.com/ethereum/EIPs/blob/master/EIPS/eip-155.md#list-of-chain-ids
func (coin *Coin) ChainID() uint64 { return coin.net.ChainID.Uint64() }

// Initialize implements coin.Coin.
func (coin *Coin) Initialize() {}

// Name implements coin.Coin.
func (coin *Coin) Name() string {
	return coin.name
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

// GetFormatUnit implements coin.Coin.
func (coin *Coin) GetFormatUnit(isFee bool) string {
	return coin.Unit(isFee)
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
	s := new(big.Rat).SetFrac(amount.BigInt(), factor).FloatString(18)
	return strings.TrimRight(strings.TrimRight(s, "0"), ".")
}

// ToUnit implements coin.Coin.
func (coin *Coin) ToUnit(amount coin.Amount, isFee bool) float64 {
	factor := coin.unitFactor(isFee)
	result, _ := new(big.Rat).SetFrac(amount.BigInt(), factor).Float64()
	return result
}

// SetAmount implements coin.Coin.
func (coin *Coin) SetAmount(amount *big.Rat, isFee bool) coin.Amount {
	factor := coin.unitFactor(isFee)
	weiAmount := new(big.Rat).Mul(amount, new(big.Rat).SetInt(factor))
	intWeiAmount, _ := new(big.Int).SetString(weiAmount.FloatString(0), 0)
	return coinpkg.NewAmount(intWeiAmount)
}

// ParseAmount implements coinpkg.Coin.
func (coin *Coin) ParseAmount(amount string) (coinpkg.Amount, error) {
	amountRat, valid := new(big.Rat).SetString(amount)
	if !valid {
		return coinpkg.Amount{}, errp.New("Invalid amount")
	}

	return coin.SetAmount(amountRat, false), nil
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
