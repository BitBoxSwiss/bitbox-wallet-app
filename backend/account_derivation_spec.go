// SPDX-License-Identifier: Apache-2.0

package backend

import (
	coinpkg "github.com/BitBoxSwiss/bitbox-wallet-app/backend/coins/coin"
	"github.com/BitBoxSwiss/bitbox-wallet-app/backend/signing"
	"github.com/BitBoxSwiss/bitbox-wallet-app/util/errp"
)

type accountDerivationKind int

const (
	accountDerivationKindBTC accountDerivationKind = iota
	accountDerivationKindETH
)

type scriptTypeWithKeypath struct {
	scriptType signing.ScriptType
	keypath    signing.AbsoluteKeypath
}

type accountDerivationSpec struct {
	kind       accountDerivationKind
	btcConfigs []scriptTypeWithKeypath
	ethKeypath signing.AbsoluteKeypath
}

// newAccountDerivationSpec returns the standard account-level derivation for a coin.
func newAccountDerivationSpec(coinCode coinpkg.Code, accountNumber uint16) (accountDerivationSpec, error) {
	coinType, ok := coinpkg.BIP44CoinType(coinCode)
	if !ok {
		return accountDerivationSpec{}, errp.Newf("Unrecognized coin code: %s", coinCode)
	}

	switch coinCode {
	case coinpkg.CodeBTC, coinpkg.CodeTBTC, coinpkg.CodeRBTC:
		return bitcoinAccountDerivationSpec(coinType, accountNumber), nil
	case coinpkg.CodeLTC, coinpkg.CodeTLTC:
		return litecoinAccountDerivationSpec(coinType, accountNumber), nil
	case coinpkg.CodeETH, coinpkg.CodeSEPETH:
		return ethereumAccountDerivationSpec(coinType, accountNumber), nil
	default:
		return accountDerivationSpec{}, errp.Newf("Unrecognized coin code: %s", coinCode)
	}
}

// bitcoinAccountDerivationSpec returns the BTC account configurations in persistence order.
func bitcoinAccountDerivationSpec(
	coinType uint32,
	accountNumber uint16,
) accountDerivationSpec {
	return accountDerivationSpec{
		kind: accountDerivationKindBTC,
		btcConfigs: []scriptTypeWithKeypath{
			btcScriptDerivation(signing.ScriptTypeP2WPKH, 84, coinType, accountNumber),
			btcScriptDerivation(signing.ScriptTypeP2TR, 86, coinType, accountNumber),
			btcScriptDerivation(signing.ScriptTypeP2WPKHP2SH, 49, coinType, accountNumber),
			btcScriptDerivation(signing.ScriptTypeP2PKH, 44, coinType, accountNumber),
		},
	}
}

// litecoinAccountDerivationSpec returns the LTC account configurations in persistence order.
func litecoinAccountDerivationSpec(
	coinType uint32,
	accountNumber uint16,
) accountDerivationSpec {
	return accountDerivationSpec{
		kind: accountDerivationKindBTC,
		btcConfigs: []scriptTypeWithKeypath{
			btcScriptDerivation(signing.ScriptTypeP2WPKH, 84, coinType, accountNumber),
			btcScriptDerivation(signing.ScriptTypeP2WPKHP2SH, 49, coinType, accountNumber),
		},
	}
}

// ethereumAccountDerivationSpec returns the ETH account derivation path.
func ethereumAccountDerivationSpec(
	coinType uint32,
	accountNumber uint16,
) accountDerivationSpec {
	return accountDerivationSpec{
		kind: accountDerivationKindETH,
		ethKeypath: signing.NewAbsoluteKeypathFromUint32(
			44+hardenedKeystart,
			coinType+hardenedKeystart,
			hardenedKeystart,
			0,
			uint32(accountNumber),
		),
	}
}

// btcScriptDerivation returns one script-specific account derivation.
func btcScriptDerivation(
	scriptType signing.ScriptType,
	purpose uint32,
	coinType uint32,
	accountNumber uint16,
) scriptTypeWithKeypath {
	return scriptTypeWithKeypath{
		scriptType: scriptType,
		keypath: signing.NewAbsoluteKeypathFromUint32(
			purpose+hardenedKeystart,
			coinType+hardenedKeystart,
			uint32(accountNumber)+hardenedKeystart,
		),
	}
}
