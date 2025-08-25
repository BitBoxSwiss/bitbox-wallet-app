// Copyright 2022 Shift Crypto AG
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
