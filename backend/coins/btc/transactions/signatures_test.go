// SPDX-License-Identifier: Apache-2.0

package transactions_test

import (
	"encoding/asn1"
	"math/big"
	"testing"

	"github.com/BitBoxSwiss/bitbox-wallet-app/backend/coins/btc/addresses"
	"github.com/BitBoxSwiss/bitbox-wallet-app/backend/coins/btc/blockchain"
	"github.com/BitBoxSwiss/bitbox-wallet-app/backend/coins/btc/transactions"
	"github.com/BitBoxSwiss/bitbox-wallet-app/backend/coins/btc/types"
	"github.com/BitBoxSwiss/bitbox-wallet-app/backend/signing"
	"github.com/BitBoxSwiss/bitbox-wallet-app/util/errp"
	"github.com/BitBoxSwiss/bitbox-wallet-app/util/logging"
	"github.com/btcsuite/btcd/btcec/v2"
	"github.com/btcsuite/btcd/btcutil/v2/hdkeychain"
	"github.com/btcsuite/btcd/chaincfg/v2"
	"github.com/btcsuite/btcd/chainhash/v2"
	"github.com/btcsuite/btcd/txscript/v2"
	"github.com/btcsuite/btcd/wire/v2"
	"github.com/stretchr/testify/require"
)

func newSignatureTest(t *testing.T) *transactionsSuite {
	t.Helper()
	s := &transactionsSuite{}
	s.SetT(t)
	s.SetupTest()
	return s
}

func signingAddress(t *testing.T, scriptType signing.ScriptType, index uint32) *addresses.AccountAddress {
	t.Helper()
	master, err := hdkeychain.NewMaster(make([]byte, hdkeychain.RecommendedSeedLen), &chaincfg.TestNet3Params)
	require.NoError(t, err)
	xpub, err := master.Neuter()
	require.NoError(t, err)
	configuration := signing.NewBitcoinConfiguration(
		scriptType, []byte{1, 2, 3, 4}, signing.NewEmptyAbsoluteKeypath(), xpub)
	return addresses.NewAccountAddress(configuration, types.Derivation{AddressIndex: index},
		&chaincfg.TestNet3Params, logging.Get().WithGroup("signatures_test"))
}

// signTestInput uses the same deterministic master key as addressesTest.NewAddressChain.
func signTestInput(t *testing.T, tx *wire.MsgTx, index int, address *addresses.AccountAddress, parents ...*wire.MsgTx) {
	t.Helper()
	master, err := hdkeychain.NewMaster(make([]byte, hdkeychain.RecommendedSeedLen), &chaincfg.TestNet3Params)
	require.NoError(t, err)
	chain, err := master.Derive(address.Derivation.SimpleChainIndex())
	require.NoError(t, err)
	key, err := chain.Derive(address.Derivation.AddressIndex)
	require.NoError(t, err)
	privateKey, err := key.ECPrivKey()
	require.NoError(t, err)

	previousOutputs := txscript.NewMultiPrevOutFetcher(nil)
	for _, parent := range parents {
		for outputIndex, output := range parent.TxOut {
			previousOutputs.AddPrevOut(wire.OutPoint{Hash: parent.TxHash(), Index: uint32(outputIndex)}, output)
		}
	}
	output := previousOutputs.FetchPrevOutput(tx.TxIn[index].PreviousOutPoint)
	require.NotNil(t, output)
	sigHashes := txscript.NewTxSigHashes(tx, previousOutputs)
	switch address.AccountConfiguration.ScriptType() {
	case signing.ScriptTypeP2PKH:
		tx.TxIn[index].SignatureScript, err = txscript.SignatureScript(
			tx, index, output.PkScript, txscript.SigHashAll, privateKey, true)
	case signing.ScriptTypeP2WPKHP2SH, signing.ScriptTypeP2WPKH:
		_, script := address.ScriptForHashToSign()
		tx.TxIn[index].Witness, err = txscript.WitnessSignature(
			tx, sigHashes, index, output.Value, script, txscript.SigHashAll, privateKey, true)
		require.NoError(t, err)
		if address.AccountConfiguration.ScriptType() == signing.ScriptTypeP2WPKHP2SH {
			tx.TxIn[index].SignatureScript, err = txscript.NewScriptBuilder().AddData(address.RedeemScript).Script()
		}
	case signing.ScriptTypeP2TR:
		tx.TxIn[index].Witness, err = txscript.TaprootWitnessSignature(
			tx, sigHashes, index, output.Value, output.PkScript, txscript.SigHashDefault, privateKey)
	default:
		t.Fatalf("unsupported test script type: %s", address.AccountConfiguration.ScriptType())
	}
	require.NoError(t, err)
}

func txHistory(txs ...*wire.MsgTx) blockchain.TxHistory {
	history := blockchain.TxHistory{}
	for _, tx := range txs {
		history = append(history, &blockchain.TxInfo{TXHash: blockchain.TXHash(tx.TxHash())})
	}
	return history
}

// Forged spends with matching txids must not change history, balances, or spendability, even if
// the server claims they are confirmed. Valid signatures work for every supported address type.
func TestWalletInputSignatures(t *testing.T) {
	for _, scriptType := range []signing.ScriptType{
		signing.ScriptTypeP2PKH, signing.ScriptTypeP2WPKHP2SH, signing.ScriptTypeP2WPKH, signing.ScriptTypeP2TR,
	} {
		t.Run(string(scriptType), func(t *testing.T) {
			s := newSignatureTest(t)
			address := signingAddress(t, scriptType, 0)
			otherAddress := signingAddress(t, scriptType, 1)
			parent := newTx(chainhash.HashH(nil), 0, address, 1000)
			spend := newTx(parent.TxHash(), 0, address, 900)
			signTestInput(t, spend, 0, address, parent)
			forged := spend.Copy()
			forged.TxOut[0].PkScript = otherAddress.PubkeyScript()
			forged.AddTxOut(wire.NewTxOut(1, address.PubkeyScript()))
			s.blockchainMock.RegisterTxs(parent, spend, forged)
			s.updateAddressHistory(address, txHistory(parent))

			for _, height := range []int{-1, 0, 10} {
				history := txHistory(parent, forged)
				history[1].Height = height
				err := s.transactions.UpdateAddressHistory(address.PubkeyScriptHashHex(), history)
				require.ErrorContains(t, err, "invalid signature for wallet input")
				balance, err := s.transactions.Balance()
				require.NoError(t, err)
				require.Equal(t, newBalance(0, 1000), balance)
				stored, err := transactions.DBView(s.db, func(db transactions.DBTxInterface) (blockchain.TxHistory, error) {
					return db.AddressHistory(address.PubkeyScriptHashHex())
				})
				require.NoError(t, err)
				require.Equal(t, txHistory(parent), stored)
				forgedHash := forged.TxHash()
				s.notifierMock.AssertNotCalled(t, "Put", forgedHash[:])
			}

			s.updateAddressHistory(address, txHistory(parent, spend))
			// Replacing an accepted spend with a forgery must also roll back its removal.
			err := s.transactions.UpdateAddressHistory(address.PubkeyScriptHashHex(), txHistory(parent, forged))
			require.ErrorContains(t, err, "invalid signature for wallet input")
			// Removing the funding transaction in the same update must not hide input ownership.
			err = s.transactions.UpdateAddressHistory(address.PubkeyScriptHashHex(), txHistory(forged))
			require.ErrorContains(t, err, "invalid signature for wallet input")
			outputs, err := s.transactions.SpendableOutputs()
			require.NoError(t, err)
			require.Len(t, outputs, 1)
			require.Contains(t, outputs, wire.OutPoint{Hash: spend.TxHash(), Index: 0})
			listed, err := s.transactions.Transactions(func(blockchain.ScriptHashHex) bool { return false })
			require.NoError(t, err)
			require.Len(t, listed, 2)
		})
	}
}

// Parents arriving after their spenders must trigger verification within one update, in a later
// update, and across different addresses. An invalid spend must not make its outputs spendable.
func TestWalletInputSignaturesLateParent(t *testing.T) {
	for _, arrival := range []string{"same update", "later update", "another address"} {
		for _, valid := range []bool{false, true} {
			name := arrival
			if valid {
				name += "/valid"
			} else {
				name += "/invalid"
			}
			t.Run(name, func(t *testing.T) {
				s := newSignatureTest(t)
				address := signingAddress(t, signing.ScriptTypeP2WPKH, 0)
				change := address
				if arrival == "another address" {
					change = signingAddress(t, signing.ScriptTypeP2WPKH, 1)
				}
				parent := newTx(chainhash.HashH(nil), 0, address, 1000)
				spend := newTx(parent.TxHash(), 0, change, 900)
				signTestInput(t, spend, 0, address, parent)
				if !valid {
					spend.TxOut[0].Value--
				}
				s.blockchainMock.RegisterTxs(parent, spend)
				history := txHistory(spend, parent)
				if arrival != "same update" {
					s.updateAddressHistory(change, txHistory(spend))
				}
				if arrival == "another address" {
					// A server can omit the spender from the funding address's history.
					history = txHistory(parent)
				}
				if valid {
					s.updateAddressHistory(address, history)
				} else {
					err := s.transactions.UpdateAddressHistory(address.PubkeyScriptHashHex(), history)
					require.ErrorContains(t, err, "invalid signature for wallet input")
					outputs, err := s.transactions.SpendableOutputs()
					require.NoError(t, err)
					require.Empty(t, outputs)
				}
			})
		}
	}
}

// A valid conflicting spender must not hide an invalid cached spend from verification when the
// parent arrives. The single-spender input index is insufficient to find every affected transaction.
func TestWalletInputSignaturesConflictingSpenders(t *testing.T) {
	s := newSignatureTest(t)
	address := signingAddress(t, signing.ScriptTypeP2WPKH, 0)
	change := signingAddress(t, signing.ScriptTypeP2WPKH, 1)
	parent := newTx(chainhash.HashH(nil), 0, address, 1000)
	spend := newTx(parent.TxHash(), 0, change, 900)
	signTestInput(t, spend, 0, address, parent)
	forged := spend.Copy()
	forged.TxOut[0].Value--
	s.blockchainMock.RegisterTxs(parent, spend, forged)
	s.updateAddressHistory(change, txHistory(forged, spend))
	err := s.transactions.UpdateAddressHistory(address.PubkeyScriptHashHex(), txHistory(parent, spend))
	require.ErrorContains(t, err, "invalid signature for wallet input")
	outputs, err := s.transactions.SpendableOutputs()
	require.NoError(t, err)
	require.Empty(t, outputs)
}

// Only wallet-owned inputs are verified. Segwit v0 needs no external parent downloads; Taproot
// fetches external previous outputs for its sighash but does not verify their input signatures.
func TestWalletInputSignaturesExternalInputs(t *testing.T) {
	for _, scriptType := range []signing.ScriptType{signing.ScriptTypeP2WPKH, signing.ScriptTypeP2TR} {
		t.Run(string(scriptType), func(t *testing.T) {
			s := newSignatureTest(t)
			address := signingAddress(t, scriptType, 0)
			external := signingAddress(t, signing.ScriptTypeP2TR, 1)
			parent := newTx(chainhash.HashH(nil), 0, address, 1000)
			otherParent := newTx(chainhash.HashH(nil), 1, external, 2000)
			spend := newTx(parent.TxHash(), 0, address, 2900)
			spend.AddTxIn(wire.NewTxIn(&wire.OutPoint{Hash: otherParent.TxHash(), Index: 0}, nil, nil))
			signTestInput(t, spend, 0, address, parent, otherParent)
			s.blockchainMock.RegisterTxs(parent, spend)
			if scriptType == signing.ScriptTypeP2TR {
				s.blockchainMock.RegisterTxs(otherParent)
			}
			forged := spend.Copy()
			forged.TxOut[0].Value--
			s.blockchainMock.RegisterTxs(forged)
			err := s.transactions.UpdateAddressHistory(address.PubkeyScriptHashHex(), txHistory(parent, forged))
			require.ErrorContains(t, err, "invalid signature for wallet input")
			s.updateAddressHistory(address, txHistory(parent, spend))
			listed, err := s.transactions.Transactions(func(blockchain.ScriptHashHex) bool { return false })
			require.NoError(t, err)
			require.Len(t, listed, 2)
		})
	}
}

// Every owned input is checked, including a later Taproot input in a transaction that also
// spends a Segwit v0 output. A valid signature on the first input cannot authorize the second.
func TestWalletInputSignaturesMultipleOwnedInputs(t *testing.T) {
	s := newSignatureTest(t)
	address := signingAddress(t, signing.ScriptTypeP2WPKH, 0)
	otherAddress := signingAddress(t, signing.ScriptTypeP2TR, 1)
	parent := newTx(chainhash.HashH(nil), 0, address, 1000)
	otherParent := newTx(chainhash.HashH(nil), 1, otherAddress, 2000)
	spend := newTx(parent.TxHash(), 0, address, 2900)
	spend.AddTxIn(wire.NewTxIn(&wire.OutPoint{Hash: otherParent.TxHash(), Index: 0}, nil, nil))
	signTestInput(t, spend, 0, address, parent, otherParent)
	signTestInput(t, spend, 1, otherAddress, parent, otherParent)
	forged := spend.Copy()
	forged.TxIn[1].Witness[0][0] ^= 1
	s.blockchainMock.RegisterTxs(parent, otherParent, forged)
	s.updateAddressHistory(address, txHistory(parent))
	s.updateAddressHistory(otherAddress, txHistory(otherParent))
	err := s.transactions.UpdateAddressHistory(address.PubkeyScriptHashHex(), txHistory(parent, forged))
	require.ErrorContains(t, err, "invalid signature for wallet input 1")
	s.blockchainMock.RegisterTxs(spend)
	s.updateAddressHistory(address, txHistory(parent, spend))
}

// Unavailable Taproot prevouts must fail verification without accepting the spend
// or indexing the unrelated parent. Malformed outpoint indices must return an error, not panic.
func TestWalletInputSignaturesInvalidPrevouts(t *testing.T) {
	for _, testCase := range []string{"unavailable", "missing", "out of range"} {
		t.Run(testCase, func(t *testing.T) {
			s := newSignatureTest(t)
			address := signingAddress(t, signing.ScriptTypeP2TR, 0)
			external := signingAddress(t, signing.ScriptTypeP2WPKH, 1)
			parent := newTx(chainhash.HashH(nil), 0, address, 1000)
			otherParent := newTx(chainhash.HashH(nil), 1, external, 2000)
			spend := newTx(parent.TxHash(), 0, address, 2900)
			spend.AddTxIn(wire.NewTxIn(&wire.OutPoint{Hash: otherParent.TxHash(), Index: 0}, nil, nil))
			signTestInput(t, spend, 0, address, parent, otherParent)
			if testCase == "out of range" {
				spend.TxIn[1].PreviousOutPoint.Index = ^uint32(0)
			}
			s.blockchainMock.RegisterTxs(parent, otherParent, spend)
			s.updateAddressHistory(address, txHistory(parent))
			s.blockchainMock.transactionGet = func(hash chainhash.Hash) (*wire.MsgTx, error) {
				if hash == otherParent.TxHash() {
					switch testCase {
					case "unavailable":
						return nil, errp.New("unavailable parent")
					case "missing":
						return nil, nil
					}
				}
				return s.blockchainMock.transactions[hash], nil
			}
			err := s.transactions.UpdateAddressHistory(address.PubkeyScriptHashHex(), txHistory(parent, spend))
			require.Error(t, err)
			balance, err := s.transactions.Balance()
			require.NoError(t, err)
			require.Equal(t, newBalance(0, 1000), balance)
		})
	}
}

// Removing funding history in a separate update must not erase knowledge of our input. The
// removed output remains available for signature checks, but not for balances or coin selection.
func TestWalletInputSignaturesRemovedParent(t *testing.T) {
	s := newSignatureTest(t)
	address := signingAddress(t, signing.ScriptTypeP2TR, 0)
	parent := newTx(chainhash.HashH(nil), 0, address, 1000)
	spend := newTx(parent.TxHash(), 0, address, 900)
	signTestInput(t, spend, 0, address, parent)
	spend.TxOut[0].Value--
	s.blockchainMock.RegisterTxs(parent, spend)
	s.updateAddressHistory(address, txHistory(parent))
	parentHash := parent.TxHash()
	s.notifierMock.On("Delete", parentHash[:]).Return(nil).Once()
	s.updateAddressHistory(address, nil)
	err := s.transactions.UpdateAddressHistory(address.PubkeyScriptHashHex(), txHistory(spend))
	require.ErrorContains(t, err, "invalid signature for wallet input")
	balance, err := s.transactions.Balance()
	require.NoError(t, err)
	require.Equal(t, newBalance(0, 0), balance)
	outputs, err := s.transactions.SpendableOutputs()
	require.NoError(t, err)
	require.Empty(t, outputs)
}

// Newly added history entries must not trigger retroactive verification or downloads of unrelated
// cached spends. Simulate an invalid witness cached before signature verification was introduced.
func TestWalletInputSignaturesExistingHistory(t *testing.T) {
	s := newSignatureTest(t)
	address := signingAddress(t, signing.ScriptTypeP2WPKH, 0)
	parent := newTx(chainhash.HashH(nil), 0, address, 1000)
	spend := newTx(parent.TxHash(), 0, address, 900)
	signTestInput(t, spend, 0, address, parent)
	s.blockchainMock.RegisterTxs(parent, spend)
	s.updateAddressHistory(address, txHistory(parent, spend))
	cached := spend.Copy()
	cached.TxIn[0].Witness = nil
	require.Equal(t, spend.TxHash(), cached.TxHash())
	require.NoError(t, transactions.DBUpdate(s.db, func(db transactions.DBTxInterface) error {
		return db.PutTx(cached.TxHash(), cached, 0, nil)
	}))

	incoming := newTx(chainhash.HashH(nil), 1, address, 2000)
	downloads := 0
	s.blockchainMock.transactionGet = func(hash chainhash.Hash) (*wire.MsgTx, error) {
		require.Equal(t, incoming.TxHash(), hash)
		downloads++
		return incoming, nil
	}
	s.updateAddressHistory(address, txHistory(parent, spend, incoming))
	require.Equal(t, 1, downloads)
	stored, err := transactions.DBView(s.db, func(db transactions.DBTxInterface) (*transactions.DBTxInfo, error) {
		return db.TxInfo(spend.TxHash())
	})
	require.NoError(t, err)
	require.Empty(t, stored.Tx.TxIn[0].Witness)
}

// Valid historical signatures must not be rejected just because they violate current relay
// policy. In particular, high-S ECDSA signatures still authorize spending a legacy wallet output.
func TestWalletInputSignaturesHighS(t *testing.T) {
	s := newSignatureTest(t)
	address := signingAddress(t, signing.ScriptTypeP2PKH, 0)
	parent := newTx(chainhash.HashH(nil), 0, address, 1000)
	spend := newTx(parent.TxHash(), 0, address, 900)
	signTestInput(t, spend, 0, address, parent)
	pushes, err := txscript.PushedData(spend.TxIn[0].SignatureScript)
	require.NoError(t, err)
	var signature struct{ R, S *big.Int }
	rest, err := asn1.Unmarshal(pushes[0][:len(pushes[0])-1], &signature)
	require.NoError(t, err)
	require.Empty(t, rest)
	signature.S.Sub(btcec.S256().Params().N, signature.S)
	highS, err := asn1.Marshal(signature)
	require.NoError(t, err)
	spend.TxIn[0].SignatureScript, err = txscript.NewScriptBuilder().
		AddData(append(highS, byte(txscript.SigHashAll))).AddData(pushes[1]).Script()
	require.NoError(t, err)
	s.blockchainMock.RegisterTxs(parent, spend)
	s.updateAddressHistory(address, txHistory(parent, spend))
}
