// SPDX-License-Identifier: Apache-2.0

package transactionsdb

import (
	"encoding/hex"
	"encoding/json"
	"path"
	"reflect"
	"testing"
	"testing/quick"
	"time"

	"github.com/BitBoxSwiss/bitbox-wallet-app/backend/coins/btc/blockchain"
	"github.com/BitBoxSwiss/bitbox-wallet-app/backend/coins/btc/types"
	"github.com/BitBoxSwiss/bitbox-wallet-app/util/test"
	"github.com/btcsuite/btcd/btcutil"
	"github.com/btcsuite/btcd/chaincfg/chainhash"
	"github.com/btcsuite/btcd/wire"
	"github.com/stretchr/testify/require"
)

func getDB() *DB {
	db, err := NewDB(path.Join(test.TstTempDir("transactionsdb_test"), "testdb"))
	if err != nil {
		panic(err)
	}
	return db
}

func TestCommit(t *testing.T) {
	db := getDB()
	defer func() {
		require.NoError(t, db.Close())
	}()

	expectedGapLimits := types.GapLimits{Receive: 123, Change: 456}
	store := func() {
		tx, err := db.Begin(true)
		require.NoError(t, err)
		defer tx.Rollback()
		require.NoError(t, tx.PutGapLimits(expectedGapLimits))
		require.NoError(t, tx.Commit())
	}
	retrieve := func() {
		tx, err := db.Begin(false)
		require.NoError(t, err)
		defer tx.Rollback()
		gapLimits, err := tx.GapLimits()
		require.NoError(t, err)
		require.Equal(t, expectedGapLimits, gapLimits)
	}
	store()
	retrieve()
}

func testTx(f func(tx *Tx)) {
	db := getDB()
	defer func() {
		if err := db.Close(); err != nil {
			panic(err)
		}
	}()
	tx, err := db.Begin(true)
	if err != nil {
		panic(err)
	}
	defer tx.Rollback()
	f(tx.(*Tx))
}

func getRawValue(tx *Tx, bucketKey string, key []byte) []byte {
	return tx.tx.Bucket([]byte(bucketKey)).Get(key)
}

// TestTxSerialization checks that Tx marshaling/unmarshaling work with both current and legacy
// chainhash.Hash marshaling methods.
// see https://github.com/btcsuite/btcd/pull/2025.
func TestTxSerialization(t *testing.T) {
	db := getDB()
	defer func() {
		if err := db.Close(); err != nil {
			panic(err)
		}
	}()
	dbTx, err := db.Begin(true)
	require.NoError(t, err)
	defer dbTx.Rollback()

	// create a new Tx
	amount := btcutil.Amount(123)
	tx := &wire.MsgTx{
		Version: wire.TxVersion,
		TxIn: []*wire.TxIn{
			wire.NewTxIn(&wire.OutPoint{Hash: chainhash.HashH(nil), Index: 0}, nil, nil),
		},
		TxOut:    []*wire.TxOut{wire.NewTxOut(int64(amount), []byte("dummyPubKeyScript"))},
		LockTime: 0,
	}
	txHash := tx.TxHash()

	dbTx.PutTx(txHash, tx, 999, nil)

	retrievedTx, err := dbTx.TxInfo(txHash)
	require.NoError(t, err)
	require.Equal(t, txHash, retrievedTx.Tx.TxHash())

	// Override tx bytes marshaling the prevout hash with legacy method.
	transactionsBucket, err := dbTx.(*Tx).tx.CreateBucketIfNotExists([]byte(bucketTransactionsKey))
	require.NoError(t, err)

	hashBytes := [32]byte(tx.TxIn[0].PreviousOutPoint.Hash.CloneBytes())
	legacyMarshalledHash, err := json.Marshal(hashBytes)
	require.NoError(t, err)
	legacySerializedTx := `{
    "Tx": {
      "Version": 1,
      "TxIn": [
        {
          "PreviousOutPoint": {
            "Hash": ` + string(legacyMarshalledHash) + `,
            "Index": 0
          },
          "SignatureScript": null,
          "Witness": null,
          "Sequence": 4294967295
        }
      ],
      "TxOut": [
        {
          "Value": 123,
          "PkScript": "ZHVtbXlQdWJLZXlTY3JpcHQ="
        }
      ],
      "LockTime": 0
    },
    "Height": 999,
    "addresses": {},
    "Verified": null,
    "ts": null,
    "created": "2024-05-08T17:26:36.224472769+02:00"
  }`

	err = transactionsBucket.Put(txHash[:], []byte(legacySerializedTx))
	require.NoError(t, err)

	retrievedTx2, err := dbTx.TxInfo(txHash)
	require.NoError(t, err)
	require.NotNil(t, retrievedTx2)
	require.Equal(t, retrievedTx.Tx.TxHash(), retrievedTx2.Tx.TxHash())
}

// TestTxQuick tests the tx related db functions on random data.
func TestTxQuick(t *testing.T) {
	testTx(func(tx *Tx) {
		allUnverifiedTxHashes := map[chainhash.Hash]struct{}{}
		allTxHashes := map[chainhash.Hash]struct{}{}
		checkTxHashes := func() bool {
			txHashes, err := tx.Transactions()
			if err != nil {
				return false
			}
			txHashesMap := map[chainhash.Hash]struct{}{}
			for _, txHash := range txHashes {
				txHashesMap[txHash] = struct{}{}
			}
			if !reflect.DeepEqual(allTxHashes, txHashesMap) {
				return false
			}

			txHashes, err = tx.UnverifiedTransactions()
			if err != nil {
				return false
			}
			txHashesMap = map[chainhash.Hash]struct{}{}
			for _, txHash := range txHashes {
				txHashesMap[txHash] = struct{}{}
			}
			return reflect.DeepEqual(allUnverifiedTxHashes, txHashesMap)
		}
		require.True(t, checkTxHashes())

		f := func(
			txVersion int32,
			txIns []wire.TxIn,
			txOuts []wire.TxOut,
			txLocktime uint32,
			expectedHeight int,
			setHeaderTimestamp bool,
			headerTimestampSeconds int32,
			headerTimestampNanos uint32,
		) bool {
			txInRefs := make([]*wire.TxIn, len(txIns))
			for k, v := range txIns {
				txInRefs[k] = &v
			}
			txOutRefs := make([]*wire.TxOut, len(txOuts))
			for k, v := range txOuts {
				txOutRefs[k] = &v
			}
			expectedTx := &wire.MsgTx{
				Version:  txVersion,
				TxIn:     txInRefs,
				TxOut:    txOutRefs,
				LockTime: txLocktime,
			}
			expectedTxHash := expectedTx.TxHash()
			var headerTimestamp *time.Time
			if setHeaderTimestamp {
				nanos := int64(headerTimestampNanos % 1e9)
				timestamp := time.Unix(int64(headerTimestampSeconds), nanos)
				headerTimestamp = &timestamp
			}
			if err := tx.PutTx(expectedTxHash, expectedTx, expectedHeight, headerTimestamp); err != nil {
				return false
			}
			txInfo, err := tx.TxInfo(expectedTxHash)
			if err != nil {
				return false
			}
			if !reflect.DeepEqual(expectedTx, txInfo.Tx) {
				return false
			}
			if len(txInfo.Addresses) != 0 {
				return false
			}
			if txInfo.Height != expectedHeight {
				return false
			}
			if setHeaderTimestamp {
				if txInfo.HeaderTimestamp == nil {
					return false
				}
				if txInfo.HeaderTimestamp.UnixNano() != headerTimestamp.UnixNano() {
					return false
				}
			} else if txInfo.HeaderTimestamp != nil {
				return false
			}
			if txInfo.CreatedTimestamp == nil {
				return false
			}
			if txInfo.TxHash.String() != expectedTxHash.String() {
				return false
			}
			allTxHashes[expectedTxHash] = struct{}{}
			allUnverifiedTxHashes[expectedTxHash] = struct{}{}
			return checkTxHashes()
		}
		require.NoError(t, quick.Check(f, nil))

		for txHash := range allUnverifiedTxHashes {
			t.Run("", func(t *testing.T) {
				expectedHeaderTimestamp := time.Unix(time.Now().Unix(), 123)
				require.NoError(t, tx.MarkTxVerified(txHash, expectedHeaderTimestamp))
				delete(allUnverifiedTxHashes, txHash)
				require.True(t, checkTxHashes())
				txInfo, err := tx.TxInfo(txHash)
				require.NoError(t, err)
				require.Equal(t, expectedHeaderTimestamp.String(), txInfo.HeaderTimestamp.String())
				now := time.Now()
				require.NotNil(t, txInfo.CreatedTimestamp)
				require.True(t,
					!txInfo.CreatedTimestamp.After(now) || *txInfo.CreatedTimestamp == now)

				tx.DeleteTx(txHash)
				delete(allTxHashes, txHash)
				require.True(t, checkTxHashes())
			})
		}
	})
}

func TestPutTxHeaderTimestampNotOverwrittenWithNil(t *testing.T) {
	testTx(func(tx *Tx) {
		msgTx := &wire.MsgTx{
			Version: wire.TxVersion,
			TxIn: []*wire.TxIn{
				wire.NewTxIn(&wire.OutPoint{Hash: chainhash.HashH(nil), Index: 0}, nil, nil),
			},
			TxOut:    []*wire.TxOut{wire.NewTxOut(123, []byte("dummyPubKeyScript"))},
			LockTime: 0,
		}
		txHash := msgTx.TxHash()

		t1 := time.Unix(123456, 789)
		require.NoError(t, tx.PutTx(txHash, msgTx, 100, &t1))

		// Should not clear existing HeaderTimestamp.
		require.NoError(t, tx.PutTx(txHash, msgTx, 101, nil))

		txInfo, err := tx.TxInfo(txHash)
		require.NoError(t, err)
		require.NotNil(t, txInfo.HeaderTimestamp)
		require.Equal(t, t1.UnixNano(), txInfo.HeaderTimestamp.UnixNano())
		require.Equal(t, 101, txInfo.Height)
	})
}

func TestInput(t *testing.T) {
	testTx(func(tx *Tx) {
		outpoint1 := wire.OutPoint{
			Hash: [32]byte{
				0x55, 0x55, 0x55, 0x55, 0x55, 0x55, 0x55, 0x55, 0x55, 0x55, 0x55, 0x55, 0x55, 0x55, 0x55, 0x55,
				0x55, 0x55, 0x55, 0x55, 0x55, 0x55, 0x55, 0x55, 0x55, 0x55, 0x55, 0x55, 0x55, 0x55, 0x55, 0x55,
			},
			Index: 2,
		}
		txhash1 := chainhash.Hash([32]byte{
			0x77, 0x77, 0x77, 0x77, 0x77, 0x77, 0x77, 0x77, 0x77, 0x77, 0x77, 0x77, 0x77, 0x77, 0x77, 0x77,
			0x77, 0x77, 0x77, 0x77, 0x77, 0x77, 0x77, 0x77, 0x77, 0x77, 0x77, 0x77, 0x77, 0x77, 0x77, 0x77,
		})
		outpoint2 := wire.OutPoint{
			Hash: [32]byte{
				0x66, 0x66, 0x66, 0x66, 0x66, 0x66, 0x66, 0x66, 0x66, 0x66, 0x66, 0x66, 0x66, 0x66, 0x66, 0x66,
				0x66, 0x66, 0x66, 0x66, 0x66, 0x66, 0x66, 0x66, 0x66, 0x66, 0x66, 0x66, 0x66, 0x66, 0x66, 0x66,
			},
			Index: 32,
		}
		txhash2 := chainhash.Hash([32]byte{
			0x88, 0x88, 0x88, 0x88, 0x88, 0x88, 0x88, 0x88, 0x88, 0x88, 0x88, 0x88, 0x88, 0x88, 0x88, 0x88,
			0x88, 0x88, 0x88, 0x88, 0x88, 0x88, 0x88, 0x88, 0x88, 0x88, 0x88, 0x88, 0x88, 0x88, 0x88, 0x88,
		})

		// does not exist yet
		input, err := tx.Input(outpoint1)
		require.NoError(t, err)
		require.Nil(t, input)

		// no-op, does not exist yet
		tx.DeleteInput(outpoint1)

		require.NoError(t, tx.PutInput(outpoint1, txhash1))
		require.NoError(t, tx.PutInput(outpoint2, txhash2))

		// Test actual db store against fixtures to ensure compatibility does not break
		require.Equal(t,
			"7777777777777777777777777777777777777777777777777777777777777777",
			hex.EncodeToString(getRawValue(tx, "inputs", []byte("5555555555555555555555555555555555555555555555555555555555555555:2"))),
		)
		require.Equal(t,
			"8888888888888888888888888888888888888888888888888888888888888888",
			hex.EncodeToString(getRawValue(tx, "inputs", []byte("6666666666666666666666666666666666666666666666666666666666666666:32"))),
		)

		input, err = tx.Input(outpoint1)
		require.NoError(t, err)
		require.Equal(t, &txhash1, input)

		input, err = tx.Input(outpoint2)
		require.NoError(t, err)
		require.Equal(t, &txhash2, input)

		tx.DeleteInput(outpoint1)
		input, err = tx.Input(outpoint1)
		require.NoError(t, err)
		require.Nil(t, input)
	})
}

func TestInputQuick(t *testing.T) {
	testTx(func(tx *Tx) {
		allOutpoints := []wire.OutPoint{}
		f := func(outPoint wire.OutPoint, expectedTxHash chainhash.Hash) bool {
			if err := tx.PutInput(outPoint, expectedTxHash); err != nil {
				return false
			}
			allOutpoints = append(allOutpoints, outPoint)
			txHash, err := tx.Input(outPoint)
			if err != nil {
				return false
			}
			return reflect.DeepEqual(&expectedTxHash, txHash)
		}
		require.NoError(t, quick.Check(f, nil))

		for _, outPoint := range allOutpoints {
			t.Run("", func(t *testing.T) {
				tx.DeleteInput(outPoint)
				txHash, err := tx.Input(outPoint)
				require.NoError(t, err)
				require.Nil(t, txHash)
			})
		}
	})
}

func TestOutput(t *testing.T) {
	testTx(func(tx *Tx) {
		outpoint1 := wire.OutPoint{
			Hash: [32]byte{
				0x55, 0x55, 0x55, 0x55, 0x55, 0x55, 0x55, 0x55, 0x55, 0x55, 0x55, 0x55, 0x55, 0x55, 0x55, 0x55,
				0x55, 0x55, 0x55, 0x55, 0x55, 0x55, 0x55, 0x55, 0x55, 0x55, 0x55, 0x55, 0x55, 0x55, 0x55, 0x55,
			},
			Index: 2,
		}

		outpoint2 := wire.OutPoint{
			Hash: [32]byte{
				0x66, 0x66, 0x66, 0x66, 0x66, 0x66, 0x66, 0x66, 0x66, 0x66, 0x66, 0x66, 0x66, 0x66, 0x66, 0x66,
				0x66, 0x66, 0x66, 0x66, 0x66, 0x66, 0x66, 0x66, 0x66, 0x66, 0x66, 0x66, 0x66, 0x66, 0x66, 0x66,
			},
			Index: 32,
		}

		output1 := &wire.TxOut{
			Value:    12345,
			PkScript: []byte("script1"),
		}

		output2 := &wire.TxOut{
			Value:    67890,
			PkScript: []byte("script2"),
		}

		// Does not exist yet.
		output, err := tx.Output(outpoint1)
		require.NoError(t, err)
		require.Nil(t, output)

		require.NoError(t, tx.PutOutput(outpoint1, output1))
		require.NoError(t, tx.PutOutput(outpoint2, output2))

		// Test actual db store against fixtures to ensure compatibility does not break
		require.JSONEq(t,
			`{"Value":12345,"PkScript":"c2NyaXB0MQ=="}`,
			string(getRawValue(tx, "outputs", []byte("5555555555555555555555555555555555555555555555555555555555555555:2"))),
		)
		require.JSONEq(t,
			`{"Value":67890,"PkScript":"c2NyaXB0Mg=="}`,
			string(getRawValue(tx, "outputs", []byte("6666666666666666666666666666666666666666666666666666666666666666:32"))),
		)

		output, err = tx.Output(outpoint1)
		require.NoError(t, err)
		require.Equal(t, output1, output)

		output, err = tx.Output(outpoint2)
		require.NoError(t, err)
		require.Equal(t, output2, output)
	})
}

func TestOutputsQuick(t *testing.T) {
	testTx(func(tx *Tx) {
		allOutputs := map[wire.OutPoint]*wire.TxOut{}
		checkOutputs := func() bool {
			outputs, err := tx.Outputs()
			if err != nil {
				return false
			}
			return reflect.DeepEqual(allOutputs, outputs)
		}

		require.True(t, checkOutputs())

		f := func(outPoint wire.OutPoint, txOut wire.TxOut) bool {
			if err := tx.PutOutput(outPoint, &txOut); err != nil {
				return false
			}
			output, err := tx.Output(outPoint)
			if err != nil {
				return false
			}
			allOutputs[outPoint] = &txOut
			if !checkOutputs() {
				return false
			}
			return reflect.DeepEqual(output, &txOut)

		}
		require.NoError(t, quick.Check(f, nil))

		// Test deletion
		for outPoint := range allOutputs {
			t.Run("", func(t *testing.T) {
				delete(allOutputs, outPoint)
				tx.DeleteOutput(outPoint)
				require.True(t, checkOutputs())
				output, err := tx.Output(outPoint)
				require.NoError(t, err)
				require.Nil(t, output)
			})
		}
	})
}

func TestAddressHistory(t *testing.T) {
	testTx(func(tx *Tx) {
		const key1 = "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa"
		hash1_1 := [32]byte{
			0x55, 0x55, 0x55, 0x55, 0x55, 0x55, 0x55, 0x55, 0x55, 0x55, 0x55, 0x55, 0x55, 0x55, 0x55, 0x55,
			0x55, 0x55, 0x55, 0x55, 0x55, 0x55, 0x55, 0x55, 0x55, 0x55, 0x55, 0x55, 0x55, 0x55, 0x55, 0x55,
		}
		hash1_2 := [32]byte{
			0x66, 0x66, 0x66, 0x66, 0x66, 0x66, 0x66, 0x66, 0x66, 0x66, 0x66, 0x66, 0x66, 0x66, 0x66, 0x66,
			0x66, 0x66, 0x66, 0x66, 0x66, 0x66, 0x66, 0x66, 0x66, 0x66, 0x66, 0x66, 0x66, 0x66, 0x66, 0x66,
		}
		txHistory1 := blockchain.TxHistory{
			{Height: 10, TXHash: blockchain.TXHash(hash1_1)},
			{Height: 20, TXHash: blockchain.TXHash(hash1_2)},
		}
		const key2 = "bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb"
		hash2 := [32]byte{
			0x88, 0x88, 0x88, 0x88, 0x88, 0x88, 0x88, 0x88, 0x88, 0x88, 0x88, 0x88, 0x88, 0x88, 0x88, 0x88,
			0x88, 0x88, 0x88, 0x88, 0x88, 0x88, 0x88, 0x88, 0x88, 0x88, 0x88, 0x88, 0x88, 0x88, 0x88, 0x88,
		}
		txHistory2 := blockchain.TxHistory{
			{Height: 15, TXHash: blockchain.TXHash(hash2)},
		}

		// Does not exist yet.
		history, err := tx.AddressHistory(key1)
		require.NoError(t, err)
		require.Equal(t, blockchain.TxHistory{}, history)

		require.NoError(t, tx.PutAddressHistory(key1, txHistory1))
		require.NoError(t, tx.PutAddressHistory(key2, txHistory2))

		// Test actual db store against fixtures to ensure compatibility does not break
		require.JSONEq(t,
			`[{"height":10,"tx_hash":"5555555555555555555555555555555555555555555555555555555555555555"},{"height":20,"tx_hash":"6666666666666666666666666666666666666666666666666666666666666666"}]`,
			string(getRawValue(tx, "addressHistories", []byte(key1))),
		)
		require.JSONEq(t,
			`[{"height":15,"tx_hash":"8888888888888888888888888888888888888888888888888888888888888888"}]`,
			string(getRawValue(tx, "addressHistories", []byte(key2))),
		)

		history, err = tx.AddressHistory(key1)
		require.NoError(t, err)
		require.Equal(t, txHistory1, history)

		history, err = tx.AddressHistory(key2)
		require.NoError(t, err)
		require.Equal(t, txHistory2, history)

	})
}

// TestAddressHistoryQuick tests storing and retrieving random address histories.
func TestAddressHistoryQuick(t *testing.T) {
	testTx(func(tx *Tx) {
		f := func(scriptHash chainhash.Hash, expectedHistory blockchain.TxHistory) bool {
			scriptHashHex := blockchain.ScriptHashHex(hex.EncodeToString(scriptHash[:]))
			if err := tx.PutAddressHistory(scriptHashHex, expectedHistory); err != nil {
				return false
			}
			history, err := tx.AddressHistory(scriptHashHex)
			if err != nil {
				return false
			}
			return reflect.DeepEqual(expectedHistory, history)

		}
		require.NoError(t, quick.Check(f, nil))
	})
}

func TestGapLimits(t *testing.T) {
	testTx(func(tx *Tx) {
		limits, err := tx.GapLimits()
		require.NoError(t, err)
		require.Equal(t, uint16(0), limits.Receive)
		require.Equal(t, uint16(0), limits.Change)

		require.NoError(t, tx.PutGapLimits(types.GapLimits{Receive: 321, Change: 123}))

		// Test actual db store against fixtures to ensure compatibility does not break
		require.Equal(t,
			"41017b00",
			hex.EncodeToString(getRawValue(tx, "config", []byte("gapLimits"))),
		)

		limits, err = tx.GapLimits()
		require.NoError(t, err)
		require.Equal(t, uint16(321), limits.Receive)
		require.Equal(t, uint16(123), limits.Change)
	})
}
