// SPDX-License-Identifier: Apache-2.0

// Package accountbuilder prepares account records using coin and keystore inputs.
// Callers own persistence and runtime account lifecycle management.
package accountbuilder

import (
	"fmt"

	accountsTypes "github.com/BitBoxSwiss/bitbox-wallet-app/backend/accounts/types"
	coinpkg "github.com/BitBoxSwiss/bitbox-wallet-app/backend/coins/coin"
	"github.com/BitBoxSwiss/bitbox-wallet-app/backend/config"
	"github.com/BitBoxSwiss/bitbox-wallet-app/backend/signing"
	"github.com/BitBoxSwiss/bitbox-wallet-app/util/errp"
	"github.com/btcsuite/btcd/btcutil/v2/hdkeychain"
	"github.com/sirupsen/logrus"
)

// Keystore provides the capabilities and public keys needed to prepare account records.
type Keystore interface {
	RootFingerprint() ([]byte, error)
	SupportsAccount(coinpkg.Coin, interface{}) bool
	BTCXPubs(coinpkg.Coin, []signing.AbsoluteKeypath) ([]*hdkeychain.ExtendedKey, error)
	ExtendedPublicKey(coinpkg.Coin, signing.AbsoluteKeypath) (*hdkeychain.ExtendedKey, error)
}

// Builder prepares account records without persisting or loading them.
// Hardware access must be serialized by the caller and happen outside database updates.
type Builder struct {
	coin func(coinpkg.Code) (coinpkg.Coin, error)
	log  *logrus.Entry
}

// New creates a builder with a coin resolver and logger.
// Coins are resolved when preparing records so the caller can replace coin instances.
func New(coin func(coinpkg.Code) (coinpkg.Coin, error), log *logrus.Entry) *Builder {
	return &Builder{coin: coin, log: log}
}

// DefaultName returns a default name for a new account. The first account is the coin name,
// the following accounts is the coin name followed by the account number. Note: `accountNumber` is
// 0-indexed, so `accountNumber 1` results in e.g. "Bitcoin 2".
func DefaultName(coin coinpkg.Coin, accountNumber uint16) string {
	if accountNumber > 0 {
		return fmt.Sprintf("%s %d", coin.Name(), accountNumber+1)
	}
	return coin.Name()
}

// Build prepares an account for the given coin and account number. The account numbers
// start at 0 (first account). The account will be a unified account supporting all types that the
// keystore supports. The keypaths will be standard BIP44 keypaths for the respective account types.
// `name` is the name of the new account and will be shown to the user. If empty, a default name will
// be used.
//
// Hardware access happens here, before the returned account is passed to a database update.
// The account is nil when the keystore does not support its construction.
func (builder *Builder) Build(
	coinCode coinpkg.Code,
	accountNumber uint16,
	hiddenBecauseUnused bool,
	name string,
	keystore Keystore,
	activeTokens []string,
) (accountsTypes.Code, *config.Account, error) {
	rootFingerprint, err := keystore.RootFingerprint()
	if err != nil {
		return "", nil, err
	}
	accountCoin, err := builder.coin(coinCode)
	if err != nil {
		return "", nil, err
	}
	if name == "" {
		name = DefaultName(accountCoin, accountNumber)
	}

	// v0 prefix: in case this code turns out to be not unique in the future, we can switch to 'v1-'
	// and avoid any collisions.
	accountCode := accountsTypes.RegularAccountCode(rootFingerprint, string(coinCode), accountNumber)

	log := builder.log.
		WithField("accountCode", accountCode).
		WithField("coinCode", coinCode).
		WithField("accountNumber", accountNumber)
	log.Info("Preparing new account config")

	derivationSpec, err := newAccountDerivationSpec(coinCode, accountNumber)
	if err != nil {
		return "", nil, err
	}

	switch derivationSpec.kind {
	case accountDerivationKindBTC:
		accountConfig, err := builder.buildBTCAccountConfig(
			keystore,
			rootFingerprint,
			accountCoin,
			accountCode,
			hiddenBecauseUnused,
			name,
			derivationSpec.btcConfigs,
		)
		return accountCode, accountConfig, err
	case accountDerivationKindETH:
		accountConfig, err := builder.buildETHAccountConfig(
			keystore,
			rootFingerprint,
			accountCoin,
			accountCode,
			hiddenBecauseUnused,
			derivationSpec.ethKeypath,
			name,
			activeTokens,
		)
		return accountCode, accountConfig, err
	default:
		panic("unhandled account derivation kind")
	}
}

// buildBTCAccountConfig builds a combined BTC account with the given script types.
func (builder *Builder) buildBTCAccountConfig(
	keystore Keystore,
	rootFingerprint []byte,
	coin coinpkg.Coin,
	code accountsTypes.Code,
	hiddenBecauseUnused bool,
	name string,
	configs []scriptTypeWithKeypath,
) (*config.Account, error) {
	log := builder.log.WithField("code", code)
	var supportedConfigs []scriptTypeWithKeypath
	for _, cfg := range configs {
		if keystore.SupportsAccount(coin, cfg.scriptType) {
			supportedConfigs = append(supportedConfigs, cfg)
		}
	}
	if len(supportedConfigs) == 0 {
		log.Info("skipping unsupported account")
		return nil, nil
	}
	log.Info("preparing account")

	keypaths := make([]signing.AbsoluteKeypath, len(supportedConfigs))
	for i, cfg := range supportedConfigs {
		keypaths[i] = cfg.keypath
	}
	xpubs, err := keystore.BTCXPubs(coin, keypaths)
	if err != nil {
		log.WithError(err).Error("Could not derive xpubs at keypaths")
		return nil, err
	}

	var signingConfigurations signing.Configurations
	for i, cfg := range supportedConfigs {
		signingConfiguration := signing.NewBitcoinConfiguration(
			cfg.scriptType,
			rootFingerprint,
			cfg.keypath,
			xpubs[i],
		)
		signingConfigurations = append(signingConfigurations, signingConfiguration)
	}

	return &config.Account{
		HiddenBecauseUnused:   hiddenBecauseUnused,
		CoinCode:              coin.Code(),
		Name:                  name,
		Code:                  code,
		SigningConfigurations: signingConfigurations,
	}, nil
}

func (builder *Builder) buildETHAccountConfig(
	keystore Keystore,
	rootFingerprint []byte,
	coin coinpkg.Coin,
	code accountsTypes.Code,
	hiddenBecauseUnused bool,
	keypath signing.AbsoluteKeypath,
	name string,
	activeTokens []string,
) (*config.Account, error) {
	log := builder.log.
		WithField("code", code).
		WithField("name", name).
		WithField("keypath", keypath.Encode())

	if !keystore.SupportsAccount(coin, nil) {
		log.Info("skipping unsupported account")
		return nil, nil
	}

	log.Info("preparing account")
	extendedPublicKey, err := keystore.ExtendedPublicKey(coin, keypath)
	if err != nil {
		return nil, err
	}
	signingConfigurations := signing.Configurations{
		signing.NewEthereumConfiguration(
			rootFingerprint,
			keypath,
			extendedPublicKey,
		),
	}

	return &config.Account{
		HiddenBecauseUnused:   hiddenBecauseUnused,
		CoinCode:              coin.Code(),
		Name:                  name,
		Code:                  code,
		SigningConfigurations: signingConfigurations,
		ActiveTokens:          activeTokens,
	}, nil
}

// AddTaproot adds a taproot subaccount to all Bitcoin accounts if the keystore supports it. The
// accounts must come from a detached snapshot so hardware access finishes before the accounts
// database Update callback. It changes their signing configurations in place and returns the
// codes of the accounts it changed. Callers must discard the prepared changes on error.
func (builder *Builder) AddTaproot(
	keystore Keystore,
	accounts []*config.Account,
) ([]accountsTypes.Code, error) {
	var changedAccountCodes []accountsTypes.Code
	for _, account := range accounts {
		if account.CoinCode == coinpkg.CodeBTC ||
			account.CoinCode == coinpkg.CodeTBTC ||
			account.CoinCode == coinpkg.CodeRBTC {
			accountCoin, err := builder.coin(account.CoinCode)
			if err != nil {
				return nil, err
			}
			if keystore.SupportsAccount(accountCoin, signing.ScriptTypeP2TR) &&
				account.SigningConfigurations.FindScriptType(signing.ScriptTypeP2TR) == -1 {
				rootFingerprint, err := keystore.RootFingerprint()
				if err != nil {
					return nil, err
				}
				bip44Coin, ok := coinpkg.BIP44CoinType(account.CoinCode)
				if !ok {
					return nil, errp.Newf("Unrecognized coin code: %s", account.CoinCode)
				}
				accountNumber, err := account.SigningConfigurations[0].AccountNumber()
				if err != nil {
					return nil, err
				}
				keypath := signing.NewAbsoluteKeypathFromUint32(
					86+hardenedKeystart,
					bip44Coin+hardenedKeystart,
					uint32(accountNumber)+hardenedKeystart)
				extendedPublicKey, err := keystore.ExtendedPublicKey(accountCoin, keypath)
				if err != nil {
					return nil, err
				}
				account.SigningConfigurations = append(
					account.SigningConfigurations,
					signing.NewBitcoinConfiguration(
						signing.ScriptTypeP2TR,
						rootFingerprint,
						keypath,
						extendedPublicKey,
					))
				changedAccountCodes = append(changedAccountCodes, account.Code)
			}
		}
	}
	return changedAccountCodes, nil
}
