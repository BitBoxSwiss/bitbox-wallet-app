// Copyright 2018 Shift Devices AG
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

package transactionsdb_test

import (
	"path"
	"testing"

	"github.com/digitalbitbox/bitbox-wallet-app/backend/coins/btc/db/transactionsdb"
	"github.com/digitalbitbox/bitbox-wallet-app/backend/coins/btc/types"
	"github.com/digitalbitbox/bitbox-wallet-app/util/test"
	"github.com/stretchr/testify/require"
)

func getDB() *transactionsdb.DB {
	db, err := transactionsdb.NewDB(path.Join(test.TstTempDir("transactionsdb_test"), "testdb"))
	if err != nil {
		panic(err)
	}
	return db
}

func testTx(f func(tx *transactionsdb.Tx)) {
	db := getDB()
	tx, err := db.Begin()
	if err != nil {
		panic(err)
	}
	defer tx.Rollback()
	f(tx.(*transactionsdb.Tx))
}

func TestGapLimits(t *testing.T) {
	testTx(func(dbTx *transactionsdb.Tx) {
		limits, err := dbTx.GapLimits()
		require.NoError(t, err)
		require.Equal(t, uint16(0), limits.Receive)
		require.Equal(t, uint16(0), limits.Change)

		require.NoError(t, dbTx.PutGapLimits(types.GapLimits{Receive: 321, Change: 123}))
		limits, err = dbTx.GapLimits()
		require.NoError(t, err)
		require.Equal(t, uint16(321), limits.Receive)
		require.Equal(t, uint16(123), limits.Change)
	})
}
