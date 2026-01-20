// SPDX-License-Identifier: Apache-2.0

package btc

import (
	"encoding/binary"

	"github.com/BitBoxSwiss/bitbox-wallet-app/backend/coins/btc/addresses"
	"github.com/BitBoxSwiss/bitbox-wallet-app/backend/coins/btc/blockchain"
	"github.com/BitBoxSwiss/bitbox-wallet-app/backend/coins/btc/maketx"
	coinpkg "github.com/BitBoxSwiss/bitbox-wallet-app/backend/coins/coin"
	"github.com/BitBoxSwiss/bitbox-wallet-app/backend/signing"
	"github.com/BitBoxSwiss/bitbox-wallet-app/util/errp"
	"github.com/btcsuite/btcd/btcec/v2/schnorr"
	"github.com/btcsuite/btcd/btcutil/psbt"
	"github.com/btcsuite/btcd/chaincfg/chainhash"
	"github.com/btcsuite/btcd/txscript"
	"github.com/btcsuite/btcd/wire"
)

// ProposedTransaction contains all the info needed to sign a btc transaction.
type ProposedTransaction struct {
	TXProposal *maketx.TxProposal
	// List of signing configurations that might be used in the tx inputs.
	AccountSigningConfigurations signing.Configurations
	GetPrevTx                    func(chainhash.Hash) (*wire.MsgTx, error)
	FormatUnit                   coinpkg.BtcUnit
	// GetKeystoreAddress returns the address from the same keystore given the script hash,
	// or nil if not found.
	GetKeystoreAddress func(coinpkg.Code, blockchain.ScriptHashHex) (*addresses.AccountAddress, error)
}

// Update populates the PSBT with all information we have about the inputs and outputs required for signing:
//   - key information of inputs and outputs belonging to us
//   - Input UTXOs (PSBT_IN_WITNESS_UTXO)
//   - Previous transactions (PSBT_IN_NON_WITNESS_UTXO) are *not* included here,
//     but is currently left to the keystore to populate if needed.
func (p *ProposedTransaction) Update() error {
	txProposal := p.TXProposal
	rootFingerprint, err := p.AccountSigningConfigurations.RootFingerprint()
	if err != nil {
		return err
	}
	rootFingerprintUint32 := binary.LittleEndian.Uint32(rootFingerprint)
	updater, err := psbt.NewUpdater(txProposal.Psbt)
	if err != nil {
		return err
	}

	// Add key infos to inputs.
	for index, txIn := range txProposal.Psbt.UnsignedTx.TxIn {
		prevOut, ok := p.TXProposal.PreviousOutputs[txIn.PreviousOutPoint]
		if !ok {
			return errp.New("There needs to be exactly one output being spent per input.")
		}
		inputAddress := prevOut.Address
		if err := updater.AddInWitnessUtxo(prevOut.TxOut, index); err != nil {
			return err
		}

		scriptType := inputAddress.AccountConfiguration.ScriptType()
		if scriptType == signing.ScriptTypeP2WPKHP2SH {
			if err := updater.AddInRedeemScript(inputAddress.RedeemScript, index); err != nil {
				return err
			}
		}

		switch scriptType {
		case signing.ScriptTypeP2WPKHP2SH, signing.ScriptTypeP2WPKH:
			if err := updater.AddInBip32Derivation(
				rootFingerprintUint32,
				inputAddress.AbsoluteKeypath().ToUInt32(),
				inputAddress.PublicKey.SerializeCompressed(),
				index); err != nil && err != psbt.ErrDuplicateKey {
				// If we update the same PSBT multiple times, the key info is already present,
				// so we can ignore the duplicate key error.
				return err
			}
		case signing.ScriptTypeP2TR:
			internalKey := schnorr.SerializePubKey(inputAddress.PublicKey)
			txProposal.Psbt.Inputs[index].TaprootInternalKey = internalKey
			txProposal.Psbt.Inputs[index].TaprootBip32Derivation = []*psbt.TaprootBip32Derivation{
				{
					XOnlyPubKey:          internalKey,
					MasterKeyFingerprint: rootFingerprintUint32,
					Bip32Path:            inputAddress.AbsoluteKeypath().ToUInt32(),
				},
			}
		default:
			return errp.Newf("unrecognized script type %s", scriptType)
		}
	}

	// Add key infos to outputs.
	for index, txOut := range txProposal.Psbt.UnsignedTx.TxOut {
		// outputAddress is the recipient address if it belongs to the same keystore. It is nil if
		// the address is external.
		outputAddress, err := p.GetKeystoreAddress(p.TXProposal.Coin.Code(), blockchain.NewScriptHashHex(txOut.PkScript))
		if err != nil {
			return errp.Newf("failed to get address: %v", err)
		}

		// Add key info to output belonging to our keystore.
		if outputAddress != nil {
			scriptType := outputAddress.AccountConfiguration.ScriptType()
			switch scriptType {
			case signing.ScriptTypeP2WPKHP2SH, signing.ScriptTypeP2WPKH:
				if err := updater.AddOutBip32Derivation(
					rootFingerprintUint32,
					outputAddress.AbsoluteKeypath().ToUInt32(),
					outputAddress.PublicKey.SerializeCompressed(),
					index); err != nil && err != psbt.ErrDuplicateKey {
					// If we update the same PSBT multiple times, the key info is already present,
					// so we can ignore the duplicate key error.
					return err
				}
			case signing.ScriptTypeP2TR:
				internalKey := schnorr.SerializePubKey(outputAddress.PublicKey)
				txProposal.Psbt.Outputs[index].TaprootInternalKey = internalKey
				txProposal.Psbt.Outputs[index].TaprootBip32Derivation = []*psbt.TaprootBip32Derivation{
					{
						XOnlyPubKey:          internalKey,
						MasterKeyFingerprint: rootFingerprintUint32,
						Bip32Path:            outputAddress.AbsoluteKeypath().ToUInt32(),
					},
				}
			default:
				return errp.Newf("unrecognized script type %s", scriptType)
			}
		}
	}
	return nil
}

// FinalizeAndExtract adds the signatureScript/witness for each input based on the available
// signatures and input address configurations, extracts the final signed tx, and performs a
// consensus validity check on it.
func (p *ProposedTransaction) FinalizeAndExtract() (*wire.MsgTx, error) {
	if err := psbt.MaybeFinalizeAll(p.TXProposal.Psbt); err != nil {
		return nil, err
	}
	signedTx, err := psbt.Extract(p.TXProposal.Psbt)
	if err != nil {
		return nil, err
	}

	// Sanity check: see if the created transaction is valid.
	if err := txValidityCheck(signedTx, p.TXProposal.PreviousOutputs,
		p.TXProposal.SigHashes()); err != nil {
		return nil, err
	}
	return signedTx, nil
}

// signTransaction signs all inputs. It assumes all outputs spent belong to this
// wallet. previousOutputs must contain all outputs which are spent by the transaction.
// It returns the signed transaction.
func (account *Account) signTransaction(
	txProposal *maketx.TxProposal,
	getPrevTx func(chainhash.Hash) (*wire.MsgTx, error),
) (*wire.MsgTx, error) {
	signingConfigs := make([]*signing.Configuration, len(account.subaccounts))
	for i, subacc := range account.subaccounts {
		signingConfigs[i] = subacc.signingConfiguration
	}

	proposedTransaction := &ProposedTransaction{
		TXProposal:                   txProposal,
		AccountSigningConfigurations: signingConfigs,
		GetKeystoreAddress:           account.getAddressFromSameKeystore,
		GetPrevTx:                    getPrevTx,
		FormatUnit:                   account.coin.formatUnit,
	}
	if err := proposedTransaction.Update(); err != nil {
		return nil, err
	}
	keystore, err := account.Config().ConnectKeystore()
	if err != nil {
		return nil, err
	}
	if err := keystore.SignTransaction(proposedTransaction); err != nil {
		return nil, err
	}

	return proposedTransaction.FinalizeAndExtract()
}

// txValidityCheck checks if the transaction is valid, including signature/witness checks.
func txValidityCheck(transaction *wire.MsgTx, previousOutputs maketx.PreviousOutputs,
	sigHashes *txscript.TxSigHashes) error {
	for index, txIn := range transaction.TxIn {
		spentOutput, ok := previousOutputs[txIn.PreviousOutPoint]
		if !ok {
			return errp.New("There needs to be exactly one output being spent per input!")
		}
		engine, err := txscript.NewEngine(spentOutput.TxOut.PkScript, transaction, index,
			txscript.StandardVerifyFlags, nil, sigHashes, spentOutput.TxOut.Value, previousOutputs)
		if err != nil {
			return errp.WithStack(err)
		}
		if err := engine.Execute(); err != nil {
			return errp.WithStack(err)
		}
	}
	return nil
}
