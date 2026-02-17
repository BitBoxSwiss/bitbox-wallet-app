// SPDX-License-Identifier: Apache-2.0

package btc

import (
	"crypto/sha256"
	"encoding/base64"
	"math/big"
	"os"
	"testing"
	"time"

	"github.com/BitBoxSwiss/bitbox-wallet-app/backend/accounts"
	"github.com/BitBoxSwiss/bitbox-wallet-app/backend/coins/btc/blockchain"
	blockchainMock "github.com/BitBoxSwiss/bitbox-wallet-app/backend/coins/btc/blockchain/mocks"
	"github.com/BitBoxSwiss/bitbox-wallet-app/backend/coins/btc/transactions"
	"github.com/BitBoxSwiss/bitbox-wallet-app/backend/coins/btc/types"
	"github.com/BitBoxSwiss/bitbox-wallet-app/backend/coins/coin"
	"github.com/BitBoxSwiss/bitbox-wallet-app/backend/config"
	"github.com/BitBoxSwiss/bitbox-wallet-app/backend/keystore"
	keystoremock "github.com/BitBoxSwiss/bitbox-wallet-app/backend/keystore/mocks"
	"github.com/BitBoxSwiss/bitbox-wallet-app/backend/signing"
	"github.com/BitBoxSwiss/bitbox-wallet-app/util/logging"
	"github.com/BitBoxSwiss/bitbox-wallet-app/util/socksproxy"
	"github.com/BitBoxSwiss/bitbox-wallet-app/util/test"
	"github.com/btcsuite/btcd/btcutil/hdkeychain"
	"github.com/btcsuite/btcd/chaincfg"
	"github.com/btcsuite/btcd/wire"
	"github.com/stretchr/testify/require"
)

func mockKeystore() *keystoremock.KeystoreMock {
	return &keystoremock.KeystoreMock{
		CanSignMessageFunc: func(coin.Code) bool { return true },
		SignBTCMessageFunc: func(_ []byte, _ signing.AbsoluteKeypath, _ signing.ScriptType, _ coin.Code) ([]byte, error) {
			return []byte("signature"), nil
		},
		CanVerifyAddressFunc: func(coin.Coin) (bool, bool, error) {
			return true, false, nil
		},
		VerifyAddressBTCFunc: func(_ *signing.Configuration, _ types.Derivation, _ coin.Coin) error {
			return nil
		},
	}
}

func mockAccount(t *testing.T, accountConfig *config.Account) *Account {
	t.Helper()
	code := coin.CodeTBTC
	unit := "TBTC"
	net := &chaincfg.TestNet3Params

	dbFolder := test.TstTempDir("btc-dbfolder")
	defer func() { _ = os.RemoveAll(dbFolder) }()

	coin := NewCoin(
		code, "Bitcoin Testnet", unit, coin.BtcUnitDefault, net, dbFolder, nil, explorer, socksproxy.NewSocksProxy(false, ""))

	blockchainMock := &blockchainMock.BlockchainMock{}
	blockchainMock.MockRegisterOnConnectionErrorChangedEvent = func(f func(error)) {}

	coin.TstSetMakeBlockchain(func() blockchain.Interface { return blockchainMock })

	keypath, err := signing.NewAbsoluteKeypath("m/84'/1'/0'")
	require.NoError(t, err)
	xpub, err := hdkeychain.NewMaster(make([]byte, 32), net)
	require.NoError(t, err)
	xpub, err = xpub.Neuter()
	require.NoError(t, err)

	signingConfigurations := &signing.Configurations{signing.NewBitcoinConfiguration(
		signing.ScriptTypeP2WPKH,
		[]byte{1, 2, 3, 4},
		keypath,
		xpub)}

	defaultConfig := &config.Account{
		Code:                  "accountcode",
		Name:                  "accountname",
		SigningConfigurations: *signingConfigurations,
	}

	if accountConfig == nil {
		accountConfig = defaultConfig
	}

	return NewAccount(
		&accounts.AccountConfig{
			Config:          accountConfig,
			DBFolder:        dbFolder,
			RateUpdater:     nil,
			GetNotifier:     func(signing.Configurations) accounts.Notifier { return nil },
			GetSaveFilename: func(suggestedFilename string) string { return suggestedFilename },
			ConnectKeystore: func() (keystore.Keystore, error) {
				return mockKeystore(), nil
			},
		},
		coin, nil, nil,
		logging.Get().WithGroup("account_test"),
		nil,
	)
}

func TestAccount(t *testing.T) {
	account := mockAccount(t, nil)
	require.False(t, account.Synced())
	require.NoError(t, account.Initialize())
	require.Eventually(t, account.Synced, time.Second, time.Millisecond*200)

	balance, err := account.Balance()
	require.NoError(t, err)
	require.Equal(t, big.NewInt(0), balance.Available().BigInt())
	require.Equal(t, big.NewInt(0), balance.Incoming().BigInt())

	transactions, err := account.Transactions()
	require.NoError(t, err)
	require.Equal(t, accounts.OrderedTransactions{}, transactions)

	spendableOutputs, err := account.SpendableOutputs()
	require.NoError(t, err)
	require.Equal(t, []*SpendableOutput{}, spendableOutputs)
}

func TestInsuredAccountAddresses(t *testing.T) {
	net := &chaincfg.TestNet3Params

	wrapSegKeypath, err := signing.NewAbsoluteKeypath("m/49'/1'/0'")
	require.NoError(t, err)
	wrappedSeed := sha256.Sum256([]byte("wrapped"))
	wrapSegXpub, err := hdkeychain.NewMaster(wrappedSeed[:], net)
	require.NoError(t, err)
	wrapSegXpub, err = wrapSegXpub.Neuter()
	require.NoError(t, err)

	natSegKeypath, err := signing.NewAbsoluteKeypath("m/84'/1'/0'")
	require.NoError(t, err)
	natSegSeed := sha256.Sum256([]byte("native"))
	natSegXpub, err := hdkeychain.NewMaster(natSegSeed[:], net)
	require.NoError(t, err)
	natSegXpub, err = natSegXpub.Neuter()
	require.NoError(t, err)

	signingConfigurations := signing.Configurations{
		signing.NewBitcoinConfiguration(
			signing.ScriptTypeP2WPKHP2SH,
			[]byte{1, 2, 3, 4},
			wrapSegKeypath,
			wrapSegXpub),
		signing.NewBitcoinConfiguration(
			signing.ScriptTypeP2WPKH,
			[]byte{1, 2, 3, 4},
			natSegKeypath,
			natSegXpub),
	}
	account := mockAccount(t, &config.Account{
		Code:                  "accountcode",
		Name:                  "accountname",
		SigningConfigurations: signingConfigurations,
	})
	require.NoError(t, account.Initialize())
	require.Eventually(t, account.Synced, time.Second, time.Millisecond*200)

	// check the number of available addresses for native and wrapped segwit.
	addressList, err := account.GetUnusedReceiveAddresses()
	require.NoError(t, err)
	require.Len(t, addressList[0].Addresses, 20)
	require.Equal(t, signing.ScriptTypeP2WPKHP2SH, *addressList[0].ScriptType)
	require.Len(t, addressList[1].Addresses, 20)
	require.Equal(t, signing.ScriptTypeP2WPKH, *addressList[1].ScriptType)

	// Create a new insured account.
	account2 := mockAccount(t, &config.Account{
		Code:                  "accountcode2",
		Name:                  "accountname2",
		SigningConfigurations: signingConfigurations,
		InsuranceStatus:       "active",
	})

	require.NoError(t, account2.Initialize())
	require.Eventually(t, account2.Synced, time.Second, time.Millisecond*200)

	// native segwit is the only address type available.
	addressList, err = account2.GetUnusedReceiveAddresses()
	require.NoError(t, err)
	require.Len(t, addressList, 1)
	require.Len(t, addressList[0].Addresses, 20)
	require.Equal(t, signing.ScriptTypeP2WPKH, *addressList[0].ScriptType)

}

func TestSignAddress(t *testing.T) {
	account := mockAccount(t, nil)
	require.NoError(t, account.Initialize())
	require.Eventually(t, account.Synced, time.Second, time.Millisecond*200)
	// pt2r is not an available script type in the mocked account.
	_, _, err := SignBTCAddress(account, "Hello there", signing.ScriptTypeP2TR)
	require.Error(t, err)
	address, signature, err := SignBTCAddress(account, "Hello there", signing.ScriptTypeP2WPKH)
	require.NoError(t, err)
	require.NotEmpty(t, address)
	require.Equal(t, base64.StdEncoding.EncodeToString([]byte("signature")), signature)

}

func TestIsChange(t *testing.T) {
	account := mockAccount(t, nil)
	require.NoError(t, account.Initialize())
	require.Eventually(t, account.Synced, time.Second, time.Millisecond*200)
	account.ensureAddresses()
	for _, subaccunt := range account.subaccounts {
		unusedReceiveAddresses, err := subaccunt.receiveAddresses.GetUnused()
		require.NoError(t, err)
		unusedChangeAddresses, err := subaccunt.changeAddresses.GetUnused()
		require.NoError(t, err)
		// check IsChange returns true for all change addresses
		for _, changeAddress := range unusedChangeAddresses {
			require.True(t, account.IsChange(changeAddress.PubkeyScriptHashHex()))
		}
		// ensure no false positives
		for _, address := range unusedReceiveAddresses {
			require.False(t, account.IsChange(address.PubkeyScriptHashHex()))
		}
	}
}

func makeSigningConfiguration(
	t *testing.T,
	net *chaincfg.Params,
	scriptType signing.ScriptType,
	keypath string,
	seedLabel string,
) *signing.Configuration {
	t.Helper()
	absoluteKeypath, err := signing.NewAbsoluteKeypath(keypath)
	require.NoError(t, err)
	seed := sha256.Sum256([]byte(seedLabel))
	xpub, err := hdkeychain.NewMaster(seed[:], net)
	require.NoError(t, err)
	xpub, err = xpub.Neuter()
	require.NoError(t, err)
	return signing.NewBitcoinConfiguration(scriptType, []byte{1, 2, 3, 4}, absoluteKeypath, xpub)
}

func mockUnifiedAccount(t *testing.T) *Account {
	t.Helper()
	net := &chaincfg.TestNet3Params
	signingConfigurations := signing.Configurations{
		makeSigningConfiguration(t, net, signing.ScriptTypeP2WPKH, "m/84'/1'/0'", "native"),
		makeSigningConfiguration(t, net, signing.ScriptTypeP2WPKHP2SH, "m/49'/1'/0'", "wrapped"),
	}
	account := mockAccount(t, &config.Account{
		Code:                  "accountcode-unified",
		Name:                  "accountname-unified",
		SigningConfigurations: signingConfigurations,
	})
	require.NoError(t, account.Initialize())
	require.Eventually(t, account.Synced, time.Second, time.Millisecond*200)
	account.ensureAddresses()
	return account
}

func txWithOutputs(outputs ...*wire.TxOut) *wire.MsgTx {
	tx := wire.NewMsgTx(2)
	tx.AddTxIn(&wire.TxIn{
		PreviousOutPoint: wire.OutPoint{},
		Sequence:         wire.MaxTxInSequenceNum,
	})
	for _, txOut := range outputs {
		tx.AddTxOut(txOut)
	}
	return tx
}

func putWalletTransaction(
	t *testing.T,
	account *Account,
	tx *wire.MsgTx,
	height int,
	timestamp *time.Time,
	scriptHashes ...blockchain.ScriptHashHex,
) {
	t.Helper()
	err := transactions.DBUpdate(account.db, func(dbTx transactions.DBTxInterface) error {
		txHash := tx.TxHash()
		if err := dbTx.PutTx(txHash, tx, height, nil); err != nil {
			return err
		}
		for _, scriptHash := range scriptHashes {
			if err := dbTx.AddAddressToTx(txHash, scriptHash); err != nil {
				return err
			}
		}
		if timestamp != nil {
			return dbTx.MarkTxVerified(txHash, *timestamp)
		}
		return nil
	})
	require.NoError(t, err)
}

func TestGetUsedAddressesOnlyUsedScriptTypesAreReturned(t *testing.T) {
	account := mockUnifiedAccount(t)

	firstScriptUnusedReceive, err := account.subaccounts[0].receiveAddresses.GetUnused()
	require.NoError(t, err)
	secondScriptUnusedReceive, err := account.subaccounts[1].receiveAddresses.GetUnused()
	require.NoError(t, err)

	firstScriptAddress := firstScriptUnusedReceive[0]
	secondScriptAddress := secondScriptUnusedReceive[0]

	confirmedAt := time.Date(2025, 1, 15, 11, 0, 0, 0, time.UTC)
	putWalletTransaction(
		t,
		account,
		txWithOutputs(&wire.TxOut{
			Value:    2100,
			PkScript: firstScriptAddress.PubkeyScript(),
		}),
		100,
		&confirmedAt,
		firstScriptAddress.PubkeyScriptHashHex(),
	)

	putWalletTransaction(
		t,
		account,
		txWithOutputs(&wire.TxOut{
			Value:    4200,
			PkScript: secondScriptAddress.PubkeyScript(),
		}),
		0,
		nil,
		secondScriptAddress.PubkeyScriptHashHex(),
	)

	usedAddresses, err := account.GetUsedAddresses()
	require.NoError(t, err)
	require.Len(t, usedAddresses, 1)
	require.Equal(t, firstScriptAddress.ID(), usedAddresses[0].AddressID)
	require.Equal(t, signing.ScriptTypeP2WPKH, *usedAddresses[0].ScriptType)
	require.Equal(t, UsedAddressTypeReceive, usedAddresses[0].AddressType)
	require.Equal(t, 1, usedAddresses[0].TransactionCount)
	require.NotNil(t, usedAddresses[0].LastUsed)
	require.Equal(t, confirmedAt, *usedAddresses[0].LastUsed)
	totalReceived, err := usedAddresses[0].TotalReceived.Int64()
	require.NoError(t, err)
	require.Equal(t, int64(2100), totalReceived)
}

func TestGetUsedAddressesMixedScriptTypes(t *testing.T) {
	account := mockUnifiedAccount(t)

	firstScriptUnusedReceive, err := account.subaccounts[0].receiveAddresses.GetUnused()
	require.NoError(t, err)
	secondScriptUnusedChange, err := account.subaccounts[1].changeAddresses.GetUnused()
	require.NoError(t, err)

	firstScriptAddress := firstScriptUnusedReceive[0]
	secondScriptAddress := secondScriptUnusedChange[0]

	firstTimestamp := time.Date(2025, 1, 12, 9, 0, 0, 0, time.UTC)
	secondTimestamp := time.Date(2025, 1, 21, 10, 30, 0, 0, time.UTC)

	putWalletTransaction(
		t,
		account,
		txWithOutputs(
			&wire.TxOut{
				Value:    1000,
				PkScript: firstScriptAddress.PubkeyScript(),
			},
			&wire.TxOut{
				Value:    700,
				PkScript: secondScriptAddress.PubkeyScript(),
			},
		),
		100,
		&firstTimestamp,
		firstScriptAddress.PubkeyScriptHashHex(),
		secondScriptAddress.PubkeyScriptHashHex(),
	)
	putWalletTransaction(
		t,
		account,
		txWithOutputs(&wire.TxOut{
			Value:    900,
			PkScript: secondScriptAddress.PubkeyScript(),
		}),
		120,
		&secondTimestamp,
		secondScriptAddress.PubkeyScriptHashHex(),
	)

	usedAddresses, err := account.GetUsedAddresses()
	require.NoError(t, err)
	require.Len(t, usedAddresses, 2)

	firstByID := map[string]UsedAddress{}
	for _, addr := range usedAddresses {
		firstByID[addr.AddressID] = addr
	}

	firstResult, ok := firstByID[firstScriptAddress.ID()]
	require.True(t, ok)
	require.Equal(t, signing.ScriptTypeP2WPKH, *firstResult.ScriptType)
	require.Equal(t, UsedAddressTypeReceive, firstResult.AddressType)
	require.Equal(t, 1, firstResult.TransactionCount)
	firstTotalReceived, err := firstResult.TotalReceived.Int64()
	require.NoError(t, err)
	require.Equal(t, int64(1000), firstTotalReceived)

	secondResult, ok := firstByID[secondScriptAddress.ID()]
	require.True(t, ok)
	require.Equal(t, signing.ScriptTypeP2WPKHP2SH, *secondResult.ScriptType)
	require.Equal(t, UsedAddressTypeChange, secondResult.AddressType)
	require.Equal(t, 2, secondResult.TransactionCount)
	require.NotNil(t, secondResult.LastUsed)
	require.Equal(t, secondTimestamp, *secondResult.LastUsed)
	secondTotalReceived, err := secondResult.TotalReceived.Int64()
	require.NoError(t, err)
	require.Equal(t, int64(1600), secondTotalReceived)
}

func TestVerifyAndSignBTCMessageSupportsChangeAddress(t *testing.T) {
	account := mockAccount(t, nil)
	require.NoError(t, account.Initialize())
	require.Eventually(t, account.Synced, time.Second, time.Millisecond*200)
	account.ensureAddresses()

	unusedChangeAddresses, err := account.subaccounts[0].changeAddresses.GetUnused()
	require.NoError(t, err)
	changeAddress := unusedChangeAddresses[0]

	keystoreMock := mockKeystore()
	account.Config().ConnectKeystore = func() (keystore.Keystore, error) {
		return keystoreMock, nil
	}

	canVerify, err := account.VerifyAddress(changeAddress.ID())
	require.NoError(t, err)
	require.True(t, canVerify)
	verifyCalls := keystoreMock.VerifyAddressBTCCalls()
	require.Len(t, verifyCalls, 1)
	require.Equal(t, changeAddress.AccountConfiguration, verifyCalls[0].AccountConfiguration)
	require.Equal(t, changeAddress.Derivation, verifyCalls[0].Derivation)

	address, signature, err := account.SignBTCMessage(changeAddress.ID(), "Hello")
	require.NoError(t, err)
	require.Equal(t, changeAddress.EncodeForHumans(), address)
	require.Equal(t, base64.StdEncoding.EncodeToString([]byte("signature")), signature)
	signCalls := keystoreMock.SignBTCMessageCalls()
	require.Len(t, signCalls, 1)
	require.Equal(t, changeAddress.AbsoluteKeypath(), signCalls[0].Keypath)
	require.Equal(t, changeAddress.AccountConfiguration.ScriptType(), signCalls[0].ScriptType)
}
