// SPDX-License-Identifier: Apache-2.0

package bitbox02

import (
	"bytes"
	"errors"
	"math/big"
	"testing"

	"github.com/BitBoxSwiss/bitbox-wallet-app/backend/coins/btc"
	"github.com/BitBoxSwiss/bitbox-wallet-app/backend/coins/btc/maketx"
	coinpkg "github.com/BitBoxSwiss/bitbox-wallet-app/backend/coins/coin"
	"github.com/BitBoxSwiss/bitbox-wallet-app/backend/coins/eth"
	keystorePkg "github.com/BitBoxSwiss/bitbox-wallet-app/backend/keystore"
	"github.com/BitBoxSwiss/bitbox-wallet-app/backend/keystore/software"
	"github.com/BitBoxSwiss/bitbox-wallet-app/backend/signing"
	"github.com/BitBoxSwiss/bitbox-wallet-app/util/socksproxy"
	bitbox02common "github.com/BitBoxSwiss/bitbox02-api-go/api/common"
	"github.com/BitBoxSwiss/bitbox02-api-go/util/semver"
	"github.com/btcsuite/btcd/btcutil/hdkeychain"
	"github.com/btcsuite/btcd/btcutil/psbt"
	"github.com/btcsuite/btcd/chaincfg"
	"github.com/btcsuite/btcd/wire"
	ethCommon "github.com/ethereum/go-ethereum/common"
	ethTypes "github.com/ethereum/go-ethereum/core/types"
	"github.com/stretchr/testify/require"
)

var errTestCommunication = errors.New("test communication error")

type errorCommunication struct{}

func (errorCommunication) Query([]byte) ([]byte, error) {
	return nil, errTestCommunication
}

func (errorCommunication) Close() {}

func newKeystoreWithVersion(version *semver.SemVer) *keystore {
	return NewDevice(
		"test-device",
		version,
		bitbox02common.ProductBitBox02Multi,
		nil,
		errorCommunication{},
	).keystore
}

func TestSigningFirmwareRequirements(t *testing.T) {
	packet, err := psbt.NewFromUnsignedTx(wire.NewMsgTx(2))
	require.NoError(t, err)
	btcCoin := btc.NewCoin(
		coinpkg.CodeBTC,
		"Bitcoin",
		"BTC",
		coinpkg.BtcUnitDefault,
		&chaincfg.MainNetParams,
		"",
		nil,
		"",
		"",
		socksproxy.NewSocksProxy(false, ""),
	)
	btcTransaction := &btc.ProposedTransaction{
		TXProposal: &maketx.TxProposal{
			Coin: btcCoin,
			Psbt: packet,
		},
	}
	contractCreation := ethTypes.NewContractCreation(
		0,
		big.NewInt(0),
		21_000,
		big.NewInt(1),
		nil,
	)
	walletConnectTransaction := ethTypes.NewTransaction(
		0,
		ethCommon.Address{},
		big.NewInt(0),
		21_000,
		big.NewInt(1),
		nil,
	)

	tests := []struct {
		name               string
		feature            keystorePkg.Feature
		unsupportedVersion *semver.SemVer
		supportedVersion   *semver.SemVer
		sign               func(*keystore) error
	}{
		{
			name:               "BTC transaction",
			feature:            keystorePkg.FeatureBTCTransactionSigning,
			unsupportedVersion: semver.NewSemVer(9, 3, 0),
			supportedVersion:   semver.NewSemVer(9, 4, 0),
			sign: func(keystore *keystore) error {
				return keystore.SignTransaction(btcTransaction)
			},
		},
		{
			name:               "ETH transaction",
			feature:            keystorePkg.FeatureETHTransactionSigning,
			unsupportedVersion: semver.NewSemVer(9, 4, 0),
			supportedVersion:   semver.NewSemVer(9, 5, 0),
			sign: func(keystore *keystore) error {
				return keystore.SignTransaction(&eth.TxProposal{Tx: contractCreation})
			},
		},
		{
			name:               "BTC message",
			feature:            keystorePkg.FeatureMessageSigning,
			unsupportedVersion: semver.NewSemVer(9, 4, 0),
			supportedVersion:   semver.NewSemVer(9, 5, 0),
			sign: func(keystore *keystore) error {
				_, err := keystore.SignBTCMessage(
					nil,
					nil,
					signing.ScriptTypeP2WPKH,
					coinpkg.CodeBTC,
				)
				return err
			},
		},
		{
			name:               "ETH message",
			feature:            keystorePkg.FeatureMessageSigning,
			unsupportedVersion: semver.NewSemVer(9, 4, 0),
			supportedVersion:   semver.NewSemVer(9, 5, 0),
			sign: func(keystore *keystore) error {
				_, err := keystore.SignETHMessage(1, nil, nil)
				return err
			},
		},
		{
			name:               "ETH typed message",
			feature:            keystorePkg.FeatureETHTypedMessageSigning,
			unsupportedVersion: semver.NewSemVer(9, 11, 0),
			supportedVersion:   semver.NewSemVer(9, 12, 0),
			sign: func(keystore *keystore) error {
				_, err := keystore.SignETHTypedMessage(1, nil, nil)
				return err
			},
		},
		{
			name:               "WalletConnect ETH transaction",
			feature:            keystorePkg.FeatureETHTransactionSigning,
			unsupportedVersion: semver.NewSemVer(9, 4, 0),
			supportedVersion:   semver.NewSemVer(9, 5, 0),
			sign: func(keystore *keystore) error {
				_, err := keystore.SignETHWalletConnectTransaction(
					1,
					walletConnectTransaction,
					nil,
				)
				return err
			},
		},
		{
			name:               "payment requests",
			feature:            keystorePkg.FeaturePaymentRequests,
			unsupportedVersion: semver.NewSemVer(9, 19, 0),
			supportedVersion:   semver.NewSemVer(9, 20, 0),
		},
		{
			name:               "swap payment requests",
			feature:            keystorePkg.FeatureSwapPaymentRequests,
			unsupportedVersion: semver.NewSemVer(9, 25, 0),
			supportedVersion:   semver.NewSemVer(9, 26, 0),
		},
	}

	for _, test := range tests {
		t.Run(test.name, func(t *testing.T) {
			unsupportedKeystore := newKeystoreWithVersion(test.unsupportedVersion)
			err := unsupportedKeystore.SupportsFeature(test.feature)
			require.ErrorIs(t, err, keystorePkg.ErrFirmwareUpgradeRequired)
			if test.sign != nil {
				err = test.sign(unsupportedKeystore)
				require.ErrorIs(t, err, keystorePkg.ErrFirmwareUpgradeRequired)
			}

			supportedKeystore := newKeystoreWithVersion(test.supportedVersion)
			require.NoError(t, supportedKeystore.SupportsFeature(test.feature))
			if test.sign != nil {
				err = test.sign(supportedKeystore)
				require.NotErrorIs(t, err, keystorePkg.ErrFirmwareUpgradeRequired)
			}
		})
	}

	require.ErrorIs(
		t,
		newKeystoreWithVersion(semver.NewSemVer(9, 26, 0)).SupportsFeature("unknown"),
		keystorePkg.ErrUnsupportedFeature,
	)
}

func TestSoftwareKeystoreSigningIsNotFirmwareGated(t *testing.T) {
	masterKey, err := hdkeychain.NewMaster(
		bytes.Repeat([]byte{0x01}, 32),
		&chaincfg.MainNetParams,
	)
	require.NoError(t, err)
	softwareKeystore := software.NewKeystore(masterKey)
	require.NoError(t, softwareKeystore.SupportsFeature(keystorePkg.FeatureBTCTransactionSigning))
	require.NoError(t, softwareKeystore.SupportsFeature(keystorePkg.FeatureETHTransactionSigning))
	require.NoError(t, softwareKeystore.SupportsFeature(keystorePkg.FeatureMessageSigning))
	require.ErrorIs(
		t,
		softwareKeystore.SupportsFeature(keystorePkg.FeaturePaymentRequests),
		keystorePkg.ErrUnsupportedFeature,
	)

	_, err = softwareKeystore.SignBTCMessage(
		[]byte("message"),
		signing.NewAbsoluteKeypathFromUint32(),
		signing.ScriptTypeP2WPKH,
		coinpkg.CodeBTC,
	)
	require.NoError(t, err)
}
