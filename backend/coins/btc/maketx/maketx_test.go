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

package maketx_test

import (
	"bytes"
	"testing"

	"github.com/btcsuite/btcd/btcutil"
	"github.com/btcsuite/btcd/chaincfg"
	"github.com/btcsuite/btcd/chaincfg/chainhash"
	"github.com/btcsuite/btcd/wire"
	"github.com/digitalbitbox/bitbox-wallet-app/backend/accounts/errors"
	"github.com/digitalbitbox/bitbox-wallet-app/backend/coins/btc"
	"github.com/digitalbitbox/bitbox-wallet-app/backend/coins/btc/addresses"
	addressesTest "github.com/digitalbitbox/bitbox-wallet-app/backend/coins/btc/addresses/test"
	"github.com/digitalbitbox/bitbox-wallet-app/backend/coins/btc/maketx"
	"github.com/digitalbitbox/bitbox-wallet-app/backend/coins/coin"
	"github.com/digitalbitbox/bitbox-wallet-app/backend/config"
	"github.com/digitalbitbox/bitbox-wallet-app/backend/signing"
	"github.com/digitalbitbox/bitbox-wallet-app/util/errp"
	"github.com/digitalbitbox/bitbox-wallet-app/util/logging"
	"github.com/digitalbitbox/bitbox-wallet-app/util/socksproxy"
	"github.com/sirupsen/logrus"
	"github.com/stretchr/testify/require"
	"github.com/stretchr/testify/suite"
)

var noDust = btcutil.Amount(0)

var tltc = btc.NewCoin(coin.CodeTLTC, "Litecoin Testnet", "TBTC", coin.BtcUnitDefault, &chaincfg.TestNet3Params, ".", []*config.ServerInfo{}, "", socksproxy.NewSocksProxy(false, ""))
var tbtc = btc.NewCoin(coin.CodeTBTC, "Bitcoin Testnet", "TBTC", coin.BtcUnitDefault, &chaincfg.TestNet3Params, ".", []*config.ServerInfo{}, "https://blockstream.info/testnet/tx/", socksproxy.NewSocksProxy(false, ""))

// For reference, tx vsizes assuming two outputs (normal + change), for N inputs:
// 1 inputs: 226
// 2 inputs: 374
// 3 inputs: 522
// 4 inputs: 670
// 5 inputs: 818
// 6 inputs: 966
// 7 inputs: 1114
// 8 inputs: 1262
// 9 inputs: 1410
// 10 inputs: 1558
const (
	txSizeOneInput   = 226
	txSizeTwoInputs  = 374
	txSizeFiveInputs = 818
)

type newTxSuite struct {
	suite.Suite

	coin coin.Coin

	addressChain       *addresses.AddressChain
	someAddresses      []*addresses.AccountAddress
	inputConfiguration *signing.Configuration
	changeAddress      *addresses.AccountAddress
	outputPkScript     []byte

	log *logrus.Entry
}

func (s *newTxSuite) SetupTest() {
	s.log = logging.Get().WithGroup("newTxTest")
	s.inputConfiguration, s.addressChain = addressesTest.NewAddressChain(
		func(address *addresses.AccountAddress) (bool, error) {
			return false, nil
		},
	)
	someAddresses, err := s.addressChain.EnsureAddresses()
	require.NoError(s.T(), err)
	s.outputPkScript = someAddresses[1].PubkeyScript()
	s.changeAddress = someAddresses[0]
	s.someAddresses = someAddresses[2:]
}

func TestNewTxSuite(t *testing.T) {
	suite.Run(t, &newTxSuite{coin: tbtc})
	suite.Run(t, &newTxSuite{coin: tltc})
}

func (s *newTxSuite) output(amount btcutil.Amount) *wire.TxOut {
	return wire.NewTxOut(int64(amount), s.outputPkScript)
}

func (s *newTxSuite) newTx(
	amount btcutil.Amount,
	feePerKb btcutil.Amount,
	utxo map[wire.OutPoint]maketx.UTXO) (*maketx.TxProposal, error) {
	return maketx.NewTx(
		s.coin,
		utxo,
		s.output(amount),
		feePerKb,
		s.changeAddress,
		s.log,
	)
}

func (s *newTxSuite) outpoint(i int) wire.OutPoint {
	return wire.OutPoint{Hash: chainhash.HashH([]byte(`some-tx`)), Index: uint32(i)}
}

// buildUTXO builds an utxo set from the input. All utxo outpoints are unique.
func (s *newTxSuite) buildUTXO(satoshis ...int64) map[wire.OutPoint]maketx.UTXO {
	utxo := map[wire.OutPoint]maketx.UTXO{}
	for i, satoshi := range satoshis {
		utxo[s.outpoint(i)] = maketx.UTXO{
			TxOut:         wire.NewTxOut(satoshi, s.someAddresses[0].PubkeyScript()),
			Configuration: s.inputConfiguration,
		}
	}
	return utxo
}

func (s *newTxSuite) TestNewTxNoCoins() {
	feePerKb := btcutil.Amount(0)
	_, err := s.newTx(1, feePerKb, s.buildUTXO())
	require.Equal(s.T(), errors.ErrInsufficientFunds, errp.Cause(err))
}

func (s *newTxSuite) check(
	expectedAmount btcutil.Amount,
	feePerKb btcutil.Amount,
	utxo map[wire.OutPoint]maketx.UTXO,
	expectedChange btcutil.Amount,
	expectedDustDonation btcutil.Amount,
	selectedCoins map[int]struct{},
) {
	txProposal, err := s.newTx(expectedAmount, feePerKb, utxo)
	require.NoError(s.T(), err)

	tx := txProposal.Transaction

	// Check invariants independent of the particular coin selection algorithm.
	require.Equal(s.T(), s.coin, txProposal.Coin)
	var output *wire.TxOut
	if expectedChange == 0 {
		require.Nil(s.T(), txProposal.ChangeAddress)
		require.Len(s.T(), tx.TxOut, 1)
		output = tx.TxOut[0]
	} else {
		require.Equal(s.T(), s.changeAddress, txProposal.ChangeAddress)
		require.Len(s.T(), tx.TxOut, 2)
		var changeOutput *wire.TxOut
		if bytes.Equal(s.changeAddress.PubkeyScript(), tx.TxOut[0].PkScript) {
			changeOutput = tx.TxOut[0]
			output = tx.TxOut[1]
		} else {
			changeOutput = tx.TxOut[1]
			output = tx.TxOut[0]
		}
		// Do we receive the correct change on the change address?
		require.Equal(s.T(), int64(expectedChange), changeOutput.Value)
		require.Equal(s.T(), s.changeAddress.PubkeyScript(), changeOutput.PkScript)
	}
	// Are we sending the right amount to the right recipient?
	require.Equal(s.T(), s.output(expectedAmount), output)

	for _, txIn := range tx.TxIn {
		require.Nil(s.T(), txIn.SignatureScript)
		require.Nil(s.T(), txIn.Witness)
		if s.coin == tbtc {
			// RBF for btc
			require.Equal(s.T(), wire.MaxTxInSequenceNum-2, txIn.Sequence)
		} else {
			// No RBF for other coins.
			require.Equal(s.T(), wire.MaxTxInSequenceNum, txIn.Sequence)
		}
	}

	inputSum := int64(0)
	for _, txIn := range tx.TxIn {
		prevOut, ok := utxo[txIn.PreviousOutPoint]
		require.True(s.T(), ok)
		inputSum += prevOut.TxOut.Value
	}
	txFee := btcutil.Amount(inputSum-output.Value) - expectedChange
	// At the moment, the fee is based on the assumption of the tx having two outputs always, even
	// if the change output is not there.

	inputConfigurations := make([]*signing.Configuration, len(tx.TxIn))
	for i := range inputConfigurations {
		inputConfigurations[i] = s.inputConfiguration
	}

	expectedFee := maketx.TstFeeForSerializeSize(
		feePerKb,
		maketx.TstEstimateTxSize(inputConfigurations, len(output.PkScript), len(s.changeAddress.PubkeyScript())),
		s.log) + expectedDustDonation
	require.Equal(s.T(), expectedFee, txFee)
	require.Equal(s.T(), expectedFee, txProposal.Fee)
	require.Equal(s.T(), expectedAmount, txProposal.Amount)

	// Check the coin selection related results.

	// Check the selected coins match the expected selected coins.
	require.Equal(s.T(), len(tx.TxIn), len(selectedCoins))
	for i := range selectedCoins {
		coin := s.outpoint(i)
		found := false
		for _, txIn := range tx.TxIn {
			if txIn.PreviousOutPoint.String() == coin.String() {
				found = true
				break
			}
		}
		require.True(s.T(), found, "didn't find coin %d", i)
	}
}

func (s *newTxSuite) selectCoins(is ...int) map[int]struct{} {
	result := map[int]struct{}{}
	for _, i := range is {
		result[i] = struct{}{}
	}
	return result
}

func (s *newTxSuite) change(value int64) btcutil.Amount {
	return btcutil.Amount(value)
}

func (s *newTxSuite) TestNewTxNoFee() {
	feePerKb := btcutil.Amount(0)

	_, err := s.newTx(1, feePerKb, s.buildUTXO())
	require.Equal(s.T(), errors.ErrInsufficientFunds, errp.Cause(err))

	s.check(btcutil.Amount(1), feePerKb, s.buildUTXO(1), s.change(0), noDust, s.selectCoins(0))
	s.check(btcutil.Amount(1), feePerKb, s.buildUTXO(1, 2), s.change(1), noDust, s.selectCoins(1))
	s.check(btcutil.Amount(1), feePerKb, s.buildUTXO(1, 2, 3), s.change(2), noDust, s.selectCoins(2))
	s.check(btcutil.Amount(1), feePerKb, s.buildUTXO(2), s.change(1), noDust, s.selectCoins(0))
}

func (s *newTxSuite) TestNewTxDust() {
	// Have one coin be exactly the amount to spend + required fee, so there is no change.  We then
	// add some dust, which does not produce change, but folds into the fee.  Also iterate through
	// some amounts to spend, to check that the dust property is independent of the amount being
	// spent.
	feePerKb := btcutil.Amount(1000) // 1 sat / vbyte
	const maxDust = 545              // dust threshold for a p2pkh change output.
	for baseAmount := int64(500); baseAmount <= 5000000000; baseAmount += 5000000000 / 10 {
		for dust := int64(0); dust <= maxDust; dust++ {
			s.check(btcutil.Amount(baseAmount), feePerKb, s.buildUTXO(400, baseAmount+txSizeOneInput+dust, 450), s.change(0), btcutil.Amount(dust), s.selectCoins(1))
		}
		s.check(btcutil.Amount(baseAmount), feePerKb, s.buildUTXO(400, baseAmount+txSizeOneInput+maxDust+1, 450), s.change(maxDust+1), noDust, s.selectCoins(1))
	}
}

func (s *newTxSuite) TestNewTxInsufficientFunds() {
	const mBTC = 100000
	amount := btcutil.Amount(1000 * mBTC) // 1 BTC

	feePerKb := btcutil.Amount(1000) // 1 sat / vbyte

	_, err := s.newTx(amount, feePerKb, s.buildUTXO())
	require.Equal(s.T(), errors.ErrInsufficientFunds, errp.Cause(err))

	// Using one coin.
	_, err = s.newTx(amount, feePerKb, s.buildUTXO(mBTC))
	require.Equal(s.T(), errors.ErrInsufficientFunds, errp.Cause(err))
	_, err = s.newTx(amount, feePerKb, s.buildUTXO(999*mBTC))
	require.Equal(s.T(), errors.ErrInsufficientFunds, errp.Cause(err))
	// exact coin not enough, as fees need to be covered.
	_, err = s.newTx(amount, feePerKb, s.buildUTXO(1000*mBTC))
	require.Equal(s.T(), errors.ErrInsufficientFunds, errp.Cause(err))
	// One satoshi short of covering the amount and fee.
	_, err = s.newTx(amount, feePerKb, s.buildUTXO(1000*mBTC+txSizeOneInput-1))
	require.Equal(s.T(), errors.ErrInsufficientFunds, errp.Cause(err))
	// Just enough:
	_, err = s.newTx(amount, feePerKb, s.buildUTXO(1000*mBTC+txSizeOneInput))
	require.NoError(s.T(), err)

	// Using two coins.
	_, err = s.newTx(amount, feePerKb, s.buildUTXO(mBTC, mBTC))
	require.Equal(s.T(), errors.ErrInsufficientFunds, errp.Cause(err))
	// exact coin not enough, as fees need to be covered.
	_, err = s.newTx(amount, feePerKb, s.buildUTXO(mBTC, 999*mBTC))
	require.Equal(s.T(), errors.ErrInsufficientFunds, errp.Cause(err))
	// One satoshi short of covering the amount and fee.
	_, err = s.newTx(amount, feePerKb, s.buildUTXO(mBTC, 999*mBTC+txSizeTwoInputs-1))
	require.Equal(s.T(), errors.ErrInsufficientFunds, errp.Cause(err))
	// Just enough:
	_, err = s.newTx(amount, feePerKb, s.buildUTXO(mBTC, 999*mBTC+txSizeTwoInputs))
	require.NoError(s.T(), err)
}

func (s *newTxSuite) TestNewTxCoinSelection() {
	const mBTC = 100000
	amount := btcutil.Amount(1000 * mBTC) // 1 BTC

	feePerKb := btcutil.Amount(1000) // 1 sat / vbyte

	s.check(amount, feePerKb, s.buildUTXO(mBTC, 2*mBTC, 1000*mBTC+txSizeOneInput), s.change(0), noDust, s.selectCoins(2))
	s.check(amount, feePerKb, s.buildUTXO(mBTC, 1000*mBTC), s.change(mBTC-txSizeTwoInputs), noDust, s.selectCoins(0, 1))
	// coins: .5, .3, .1, .1, .9, .8, .6. select .5+.3+.1+.1 to get 1BTC, take .9 to cover the fees.
	s.check(amount, feePerKb, s.buildUTXO(500*mBTC, 300*mBTC, 100*mBTC, 100*mBTC, 90*mBTC, 80*mBTC, 70*mBTC), s.change(90*mBTC-txSizeFiveInputs), noDust, s.selectCoins(0, 1, 2, 3, 4))
}
