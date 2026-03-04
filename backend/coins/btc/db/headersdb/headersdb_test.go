// SPDX-License-Identifier: Apache-2.0

package headersdb

import (
	"os"
	"testing"

	"github.com/BitBoxSwiss/bitbox-wallet-app/util/logging"
	"github.com/BitBoxSwiss/bitbox-wallet-app/util/test"
	"github.com/btcsuite/btcd/wire"
	"github.com/stretchr/testify/require"
)

var log = logging.Get().WithGroup("headersdb_test")

func testDB(t *testing.T) *DB {
	t.Helper()
	db, err := NewDB(test.TstTempFile("headersdb"), log)
	require.NoError(t, err)
	return db
}

func TestTip(t *testing.T) {
	db := testDB(t)
	defer db.Close()

	tip, err := db.Tip()
	require.NoError(t, err)
	require.Equal(t, -1, tip)

	require.NoError(t, db.PutHeader(20, &wire.BlockHeader{}))

	tip, err = db.Tip()
	require.NoError(t, err)
	require.Equal(t, 20, tip)

	require.NoError(t, db.RevertTo(10))

	tip, err = db.Tip()
	require.NoError(t, err)
	require.Equal(t, 10, tip)
}

func TestFixTrailingZeroes(t *testing.T) {
	f, err := os.CreateTemp(t.TempDir(), "headersdb")
	require.NoError(t, err)
	filename := f.Name()

	_, err = f.WriteString(
		"aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa" +
			"bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb",
	)
	require.NoError(t, err)
	// Add 10 zero-byte headers that will be stripped off.
	_, err = f.Write(make([]byte, 80*10))
	require.NoError(t, err)
	require.NoError(t, f.Close())

	db, err := NewDB(filename, log)
	require.NoError(t, err)
	defer db.Close()

	tip, err := db.Tip()
	require.NoError(t, err)
	require.Equal(t, 1, tip)
}

func TestInvalidFileSize(t *testing.T) {
	f, err := os.CreateTemp(t.TempDir(), "headersdb")
	require.NoError(t, err)
	filename := f.Name()
	_, err = f.Write([]byte{1})
	require.NoError(t, err)
	require.NoError(t, f.Close())

	_, err = NewDB(filename, log)
	require.Error(t, err)
}
