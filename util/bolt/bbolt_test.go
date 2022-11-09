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

package bolt

import (
	"bytes"
	"compress/gzip"
	_ "embed" // Needed for the go:embed directives below.
	"io/ioutil"
	"os"
	"testing"

	"github.com/digitalbitbox/bitbox-wallet-app/util/logging"
	"github.com/digitalbitbox/bitbox-wallet-app/util/test"
	"github.com/stretchr/testify/require"
	"go.etcd.io/bbolt"
)

func TestOpen(t *testing.T) {
	log := logging.Get().WithGroup("bolt-test")
	// Test db creation.
	filename := test.TstTempFile("bolt")
	db, err := Open(filename, log)
	require.NoError(t, err)
	require.NoError(t, db.Update(func(tx *bbolt.Tx) error {
		bucket, err := tx.CreateBucketIfNotExists([]byte("bucket"))
		require.NoError(t, err)
		require.NoError(t, bucket.Put([]byte("key"), []byte("value")))
		return nil
	}))
	require.NoError(t, db.Close())
	_, err = os.Stat(filename)
	require.NoError(t, err)

	// Test opening existing db.
	db, err = Open(filename, log)
	require.NoError(t, err)
	require.NoError(t, db.Update(func(tx *bbolt.Tx) error {
		bucket, err := tx.CreateBucketIfNotExists([]byte("bucket"))
		require.NoError(t, err)
		require.Equal(t, []byte("value"), bucket.Get([]byte("key")))
		return nil
	}))
	require.NoError(t, db.Close())
}

//go:embed testdata/corrupt.db.gz
var corruptDB []byte

func emptyDB(t *testing.T) []byte {
	t.Helper()
	filename := test.TstTempFile("bolt")
	db, err := bbolt.Open(filename, 0600, nil)
	require.NoError(t, err)
	require.NoError(t, db.Close())
	contents, err := os.ReadFile(filename)
	require.NoError(t, err)
	return contents
}

func TestOpenCorrupt(t *testing.T) {
	log := logging.Get().WithGroup("bolt-test")
	filename := test.TstTempFile("bolt-panics-on-check")

	// Unzip test db.
	gz, err := gzip.NewReader(bytes.NewBuffer(corruptDB))
	require.NoError(t, err)
	dbBytes, err := ioutil.ReadAll(gz)
	require.NoError(t, err)
	require.NoError(t, os.WriteFile(filename, dbBytes, 0600))

	// Open normally without corruption recovery to check the DB is actually corrupt.
	db, err := bbolt.Open(filename, 0600, nil)
	require.NoError(t, err)
	require.Error(t, checkCorruption(db))
	require.NoError(t, db.Close())

	// Open with corruption recovery.
	db, err = Open(filename, log)
	require.NoError(t, err)
	require.NoError(t, db.Close())

	// Check that the recovery created a new DB.
	contents, err := os.ReadFile(filename)
	require.NoError(t, err)
	require.Equal(t, emptyDB(t), contents)
}
